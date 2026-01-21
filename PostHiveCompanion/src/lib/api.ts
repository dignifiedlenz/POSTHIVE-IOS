import {supabase} from './supabase';
import {
  Notification,
  Todo,
  CreateTodoInput,
  Deliverable,
  Comment,
  TodoStatus,
  Workspace,
  Project,
  Client,
  CreateProjectInput,
  CreateDeliverableInput,
  CreateEventInput,
  CalendarEvent,
  WorkspaceMember,
} from './types';
import {resolveThumbnail, resolvePlaybackUrl, extractBunnyGuid, constructBunnyThumbnail} from './utils';

// ===== NOTIFICATIONS =====

export async function getNotifications(
  workspaceId: string,
  limit = 50,
): Promise<Notification[]> {
  const {data, error} = await supabase
    .from('user_notifications')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', {ascending: false})
    .limit(limit);

  if (error) {
    throw error;
  }
  return data || [];
}

export async function getUnreadCount(workspaceId: string): Promise<number> {
  const {count, error} = await supabase
    .from('user_notifications')
    .select('id', {count: 'exact', head: true})
    .eq('workspace_id', workspaceId)
    .is('seen_at', null);

  if (error) {
    throw error;
  }
  return count || 0;
}

export async function markNotificationSeen(
  notificationId: string,
  userId: string,
): Promise<void> {
  await supabase.rpc('mark_notification_seen', {
    p_notification_id: notificationId,
    p_user_id: userId,
  });
}

export async function markAllNotificationsSeen(
  userId: string,
  workspaceId: string,
): Promise<void> {
  await supabase.rpc('mark_all_notifications_seen', {
    p_user_id: userId,
    p_workspace_id: workspaceId,
  });
}

// ===== TODOS =====

interface TodoWithRelations {
  id: string;
  workspace_id: string;
  project_id?: string;
  deliverable_id?: string;
  title: string;
  description?: string;
  status: TodoStatus;
  priority: string;
  due_date?: string;
  due_time?: string;
  estimated_minutes?: number;
  assigned_to?: string;
  created_by: string;
  completed_by?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
  is_private?: boolean;
  assigned_user?: {name: string} | null;
  project?: {name: string} | null;
  deliverable?: {name: string} | null;
}

export async function getTodos(workspaceId: string): Promise<Todo[]> {
  const {data, error} = await supabase
    .from('todos')
    .select(
      `
      *,
      assigned_user:assigned_to(name),
      project:project_id(name),
      deliverable:deliverable_id(name)
    `,
    )
    .eq('workspace_id', workspaceId)
    .order('created_at', {ascending: false});

  if (error) {
    throw error;
  }

  return (data || []).map((todo: TodoWithRelations) => ({
    ...todo,
    assigned_name: todo.assigned_user?.name,
    project_name: todo.project?.name,
    deliverable_name: todo.deliverable?.name,
  })) as Todo[];
}

export async function createTodo(
  workspaceId: string,
  userId: string,
  input: CreateTodoInput,
): Promise<Todo> {
  const {data, error} = await supabase
    .from('todos')
    .insert({
      workspace_id: workspaceId,
      title: input.title,
      description: input.description || null,
      priority: input.priority,
      due_date: input.due_date || null,
      due_time: input.due_time || null,
      estimated_minutes: input.estimated_minutes || null,
      assigned_to: input.assigned_to || null,
      project_id: input.project_id || null,
      deliverable_id: input.deliverable_id || null,
      is_private: input.is_private || false,
      created_by: userId,
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    throw error;
  }
  return data;
}

export async function updateTodoStatus(
  todoId: string,
  status: TodoStatus,
  userId: string,
): Promise<void> {
  const updateData: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (status === 'completed') {
    updateData.completed_by = userId;
    updateData.completed_at = new Date().toISOString();
  } else {
    updateData.completed_by = null;
    updateData.completed_at = null;
  }

  const {error} = await supabase
    .from('todos')
    .update(updateData)
    .eq('id', todoId);

  if (error) {
    throw error;
  }
}

export async function updateTodo(
  todoId: string,
  input: Partial<CreateTodoInput>,
): Promise<Todo> {
  const updateData: Record<string, unknown> = {
    ...input,
    updated_at: new Date().toISOString(),
  };

  const {data, error} = await supabase
    .from('todos')
    .update(updateData)
    .eq('id', todoId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function deleteTodo(todoId: string): Promise<void> {
  const {error} = await supabase.from('todos').delete().eq('id', todoId);

  if (error) {
    throw error;
  }
}

// ===== DELIVERABLES =====

export async function getRecentDeliverables(
  workspaceId: string,
  userId: string,
): Promise<Deliverable[]> {
  console.log('[Dashboard] Fetching deliverables for workspace:', workspaceId);
  
  const {data, error} = await supabase.rpc(
    'get_workspace_deliverables_dashboard',
    {
      p_workspace_id: workspaceId,
      p_limit: 30,
      p_user_id: userId,
    },
  );
  
  console.log('[Dashboard] RPC result:', {
    hasData: !!data,
    dataLength: data?.length || 0,
    error: error?.message,
  });

  // Helper to apply thumbnail from asset map
  const applyThumbnails = (deliverables: any[], assetThumbnails: Record<string, string>) => {
    return deliverables.map((d: any) => {
      // Use proper thumbnail resolution
      const thumbnailUrl = resolveThumbnail({
        deliverable_thumbnail_url: d.thumbnail_url,
        deliverable_thumbnail: d.thumbnail,
        asset_bunny_thumbnail_url: assetThumbnails[d.id],
        version_thumbnail_url: d.latest_thumbnail_url || d.version_thumbnail_url,
        deliverable_type: d.type,
      });

      return {
        ...d,
        thumbnail_url: thumbnailUrl || null,
      };
    });
  };

  // Helper to fetch asset thumbnails for deliverables
  // Following MOBILE_APP_PROJECT_THUMBNAILS.md logic
  const fetchAssetThumbnails = async (deliverableIds: string[]): Promise<Record<string, string>> => {
    if (deliverableIds.length === 0) return {};
    
    try {
      // Step 1: Get latest version for each deliverable
      const {data: versions} = await supabase
        .from('versions')
        .select('deliverable_id, file_url, thumbnail_url, version_number')
        .in('deliverable_id', deliverableIds)
        .order('version_number', {ascending: false});
      
      // Map: deliverable_id → latest version
      const latestVersionByDeliverable: Record<string, any> = {};
      (versions || []).forEach((v: any) => {
        if (!latestVersionByDeliverable[v.deliverable_id]) {
          latestVersionByDeliverable[v.deliverable_id] = v;
        }
      });
      
      // Step 2: Get version_uploads for these deliverables
      const {data: uploads} = await supabase
        .from('version_uploads')
        .select('deliverable_id, version_number, asset_id')
        .in('deliverable_id', deliverableIds);
      
      // Step 3: Get assets
      const assetIds = [...new Set((uploads || []).map((u: any) => u.asset_id).filter(Boolean))];
      let assetMap: Record<string, any> = {};
      
      if (assetIds.length > 0) {
        const {data: assets} = await supabase
          .from('assets')
        .select('id, bunny_thumbnail_url, bunny_stream_video_id, bunny_hls_url, provider')
          .in('id', assetIds);
        
        (assets || []).forEach((a: any) => {
          assetMap[a.id] = a;
        });
      }
      
      // Step 4: Build deliverable -> thumbnail map using priority order
      const thumbnailMap: Record<string, string> = {};
      
      deliverableIds.forEach(deliverableId => {
        if (thumbnailMap[deliverableId]) return; // Already have thumbnail
        
        const version = latestVersionByDeliverable[deliverableId];
        if (!version) return;
        
        let thumb: string | undefined;
        
        // Priority 1: Get from linked asset
        const linkedUpload = (uploads || []).find(
          (u: any) => u.deliverable_id === deliverableId && 
                      u.version_number === version.version_number
        );
        
        if (linkedUpload && assetMap[linkedUpload.asset_id]) {
          const asset = assetMap[linkedUpload.asset_id];
          
          // Try bunny_thumbnail_url first
          if (asset.bunny_thumbnail_url) {
            thumb = asset.bunny_thumbnail_url;
          }
          // Construct from bunny_stream_video_id (use file_url to detect region)
          else if (asset.bunny_stream_video_id && asset.provider !== 'cloudflare' && !asset.bunny_hls_url?.includes('videodelivery.net')) {
            thumb = constructBunnyThumbnail(asset.bunny_stream_video_id, version.file_url);
          }
        }
        
        // Priority 2: Extract GUID from version.file_url
        if (!thumb && version.file_url) {
          const guid = extractBunnyGuid(version.file_url);
          if (guid) {
            thumb = constructBunnyThumbnail(guid, version.file_url);
          }
        }
        
        // Priority 3: Fallback to version.thumbnail_url
        if (!thumb && version.thumbnail_url) {
          thumb = version.thumbnail_url;
        }
        
        if (thumb) {
          thumbnailMap[deliverableId] = thumb;
        }
      });
      
      console.log('[Thumbnail Debug] Fetched thumbnails for', Object.keys(thumbnailMap).length, 'of', deliverableIds.length, 'deliverables');
      
      // Debug: Show what we found
      if (deliverableIds.length > 0) {
        const firstDeliverableId = deliverableIds[0];
        const version = latestVersionByDeliverable[firstDeliverableId];
        const linkedUpload = (uploads || []).find((u: any) => u.deliverable_id === firstDeliverableId);
        const asset = linkedUpload ? assetMap[linkedUpload.asset_id] : null;
        
        console.log('[Thumbnail Debug] First deliverable data:', {
          deliverableId: firstDeliverableId,
          version: version ? {
            file_url: version.file_url,
            thumbnail_url: version.thumbnail_url,
            version_number: version.version_number,
          } : 'NO VERSION',
          linkedUpload: linkedUpload ? {
            asset_id: linkedUpload.asset_id,
            version_number: linkedUpload.version_number,
          } : 'NO UPLOAD',
          asset: asset ? {
            bunny_thumbnail_url: asset.bunny_thumbnail_url,
            bunny_stream_video_id: asset.bunny_stream_video_id,
          } : 'NO ASSET',
          resolvedThumbnail: thumbnailMap[firstDeliverableId] || 'NONE',
        });
      }
      
      return thumbnailMap;
    } catch (err) {
      console.error('[Thumbnail Debug] Error fetching asset thumbnails:', err);
      return {};
    }
  };

  if (error) {
    console.log('[Dashboard] RPC failed, using fallback view');
    // Fallback to view
    const {data: viewData, error: viewError} = await supabase
      .from('workspace_deliverables_dashboard')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('updated_at', {ascending: false})
      .limit(30);

    if (viewError) {
      throw viewError;
    }
    
    // Fetch asset thumbnails for deliverables missing thumbnails
    const deliverableIds = (viewData || []).map((d: any) => d.id);
    const assetThumbnails = await fetchAssetThumbnails(deliverableIds);
    
    // Fetch raw thumbnail field (custom ET thumbnails) from deliverables table
    let deliverableThumbnails: Record<string, string> = {};
    if (deliverableIds.length > 0) {
      const {data: deliverableData} = await supabase
        .from('deliverables')
        .select('id, thumbnail')
        .in('id', deliverableIds);
      
      (deliverableData || []).forEach((d: any) => {
        if (d.thumbnail) {
          deliverableThumbnails[d.id] = d.thumbnail;
        }
      });
    }
    
    // Merge thumbnail data into deliverables
    const deliverablesWithThumbnails = (viewData || []).map((d: any) => ({
      ...d,
      thumbnail: deliverableThumbnails[d.id] || null,
    }));
    
    return applyThumbnails(deliverablesWithThumbnails, assetThumbnails);
  }

  // Fetch asset thumbnails for deliverables
  const deliverableIds = (data || []).map((d: any) => d.id);
  const assetThumbnails = await fetchAssetThumbnails(deliverableIds);
  
  // Fetch raw thumbnail field (custom ET thumbnails) from deliverables table
  let deliverableThumbnails: Record<string, string> = {};
  if (deliverableIds.length > 0) {
    const {data: deliverableData} = await supabase
      .from('deliverables')
      .select('id, thumbnail')
      .in('id', deliverableIds);
    
    (deliverableData || []).forEach((d: any) => {
      if (d.thumbnail) {
        deliverableThumbnails[d.id] = d.thumbnail;
      }
    });
  }
  
  // Merge thumbnail data into deliverables
  const deliverablesWithThumbnails = (data || []).map((d: any) => ({
    ...d,
    thumbnail: deliverableThumbnails[d.id] || null,
  }));
  
  return applyThumbnails(deliverablesWithThumbnails, assetThumbnails);
}

export async function getDeliverable(
  deliverableId: string,
): Promise<Deliverable | null> {
  const {data, error} = await supabase
    .from('deliverables')
    .select(
      `
      *,
      project:projects(name),
      versions(id, version_number, file_url, thumbnail_url, uploaded_at, status)
    `,
    )
    .eq('id', deliverableId)
    .single();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const versions = data.versions || [];
  const latestVersion = versions.sort(
    (a: {version_number: number}, b: {version_number: number}) =>
      b.version_number - a.version_number,
  )[0];

  // Fetch asset for latest version to get Bunny thumbnail
  let asset: any = null;
  if (latestVersion) {
    const {data: upload} = await supabase
      .from('version_uploads')
      .select('asset_id')
      .eq('deliverable_id', deliverableId)
      .eq('version_number', latestVersion.version_number)
      .limit(1)
      .single();

    if (upload?.asset_id) {
      const {data: assetData} = await supabase
        .from('assets')
        .select(`
          id,
          bunny_stream_video_id,
          bunny_hls_url,
          bunny_cdn_url,
          bunny_thumbnail_url,
          storage_url,
          r2_url,
          file_url,
          processing_status
        `)
        .eq('id', upload.asset_id)
        .single();
      asset = assetData;
    }
  }

  // Resolve thumbnail using priority order (including asset data)
  const thumbnailUrl = resolveThumbnail({
    deliverable_thumbnail_url: data.thumbnail_url,
    deliverable_thumbnail: data.thumbnail,
    asset_bunny_thumbnail_url: asset?.bunny_thumbnail_url,
    asset_bunny_stream_video_id: asset?.bunny_stream_video_id,
    asset_bunny_hls_url: asset?.bunny_hls_url,
    asset_provider: asset?.provider,
    version_file_url: latestVersion?.file_url,
    version_thumbnail_url: latestVersion?.thumbnail_url,
    asset_bunny_cdn_url: asset?.bunny_cdn_url,
    asset_r2_url: asset?.r2_url,
    asset_file_url: asset?.file_url,
    deliverable_type: data.type,
  });

  // Resolve playback URL
  const playbackUrl = resolvePlaybackUrl({
    bunny_hls_url: asset?.bunny_hls_url,
    bunny_cdn_url: asset?.bunny_cdn_url,
    storage_url: asset?.storage_url,
    r2_url: asset?.r2_url,
    file_url: latestVersion?.file_url,
    processing_status: asset?.processing_status,
  });

  return {
    ...data,
    project_name: data.project?.name,
    current_version: latestVersion?.version_number,
    latest_version: latestVersion ? {
      ...latestVersion,
      file_url: playbackUrl || latestVersion.file_url,
      thumbnail_url: thumbnailUrl || latestVersion.thumbnail_url,
    } : undefined,
    thumbnail_url: thumbnailUrl,
  };
}

export async function getDeliverableVersions(deliverableId: string) {
  // Fetch versions
  const {data: versions, error} = await supabase
    .from('versions')
    .select('*')
    .eq('deliverable_id', deliverableId)
    .order('version_number', {ascending: false});

  if (error) {
    throw error;
  }

  if (!versions || versions.length === 0) {
    return [];
  }

  // Fetch version_uploads to get asset IDs
  const {data: uploads} = await supabase
    .from('version_uploads')
    .select('version_number, asset_id')
    .eq('deliverable_id', deliverableId);

  // Create a map of version_number to asset_id
  const versionAssetMap: Record<number, string> = {};
  (uploads || []).forEach((u: {version_number: number; asset_id: string}) => {
    versionAssetMap[u.version_number] = u.asset_id;
  });

  // Get unique asset IDs
  const assetIds = [...new Set(Object.values(versionAssetMap))];

  // Fetch assets
  let assetMap: Record<string, any> = {};
  if (assetIds.length > 0) {
    const {data: assets} = await supabase
      .from('assets')
      .select(`
        id,
        bunny_stream_video_id,
        bunny_hls_url,
        bunny_cdn_url,
        bunny_thumbnail_url,
        storage_url,
        r2_url,
        processing_status
      `)
      .in('id', assetIds);

    (assets || []).forEach((a: any) => {
      assetMap[a.id] = a;
    });
  }

  // Combine versions with asset data
  return versions.map((v: any) => {
    const assetId = versionAssetMap[v.version_number];
    const asset = assetId ? assetMap[assetId] : null;

    // Resolve thumbnail for this version
    const thumbnailUrl = resolveThumbnail({
      asset_bunny_thumbnail_url: asset?.bunny_thumbnail_url,
      asset_bunny_stream_video_id: asset?.bunny_stream_video_id,
      asset_bunny_hls_url: asset?.bunny_hls_url,
      asset_provider: asset?.provider,
      version_file_url: v.file_url,
      version_thumbnail_url: v.thumbnail_url,
      asset_bunny_cdn_url: asset?.bunny_cdn_url,
    });

    // Resolve playback URL
    const playbackUrl = resolvePlaybackUrl({
      bunny_hls_url: asset?.bunny_hls_url,
      bunny_cdn_url: asset?.bunny_cdn_url,
      storage_url: asset?.storage_url,
      r2_url: asset?.r2_url,
      file_url: v.file_url,
      processing_status: asset?.processing_status,
    });

    return {
      ...v,
      thumbnail_url: thumbnailUrl || v.thumbnail_url,
      file_url: playbackUrl || v.file_url,
      bunny_hls_url: asset?.bunny_hls_url,
      bunny_cdn_url: asset?.bunny_cdn_url,
      bunny_stream_video_id: asset?.bunny_stream_video_id,
      bunny_thumbnail_url: asset?.bunny_thumbnail_url,
      processing_status: asset?.processing_status,
    };
  });
}

export async function getDeliverableGalleryImages(
  deliverableId: string,
  versionNumber: number,
): Promise<Array<{id: string; url: string; thumbnail_url?: string; name?: string; uploaded_at?: string}>> {
  console.log('[Gallery Debug] getDeliverableGalleryImages', {deliverableId, versionNumber});
  const toPhotos = (
    assets: Array<{
      id: string;
      name?: string;
      file_url?: string | null;
      storage_url?: string | null;
      r2_url?: string | null;
      bunny_cdn_url?: string | null;
      bunny_thumbnail_url?: string | null;
      uploaded_at?: string | null;
    }>,
  ) =>
    assets.map(asset => ({
      id: asset.id,
      url: asset.bunny_cdn_url || asset.r2_url || asset.storage_url || asset.file_url || '',
      thumbnail_url: asset.bunny_thumbnail_url || undefined,
      name: asset.name,
      uploaded_at: asset.uploaded_at || undefined,
    }));

  // Try to read assets from version_uploads (preferred)
  const versionNumbers = Array.from(
    new Set([versionNumber, 0].filter(v => v !== null && v !== undefined)),
  );
  const {data: versionUploads, error: uploadsError} = await supabase
    .from('version_uploads')
    .select('asset_id')
    .eq('deliverable_id', deliverableId)
    .in('version_number', versionNumbers)
    .not('asset_id', 'is', null);

  console.log('[Gallery Debug] version_uploads result', {
    error: uploadsError?.message || null,
    count: versionUploads?.length || 0,
  });

  if (!uploadsError && versionUploads && versionUploads.length > 0) {
    const assetIds = versionUploads.map(vu => vu.asset_id).filter(Boolean);
    if (assetIds.length > 0) {
      const {data: assets, error: assetsError} = await supabase
        .from('assets')
        .select('id, name, storage_url, r2_url, bunny_cdn_url, bunny_thumbnail_url, uploaded_at, type, mime_type')
        .in('id', assetIds)
        .or('type.in.(image,foto),mime_type.ilike.image/%');

      console.log('[Gallery Debug] assets from version_uploads', {
        error: assetsError?.message || null,
        count: assets?.length || 0,
      });

      if (!assetsError && assets && assets.length > 0) {
        return toPhotos(assets);
      }
    }
  }

  // Secondary fallback: any version_uploads for this deliverable
  const {data: anyUploads, error: anyUploadsError} = await supabase
    .from('version_uploads')
    .select('asset_id')
    .eq('deliverable_id', deliverableId)
    .not('asset_id', 'is', null);

  console.log('[Gallery Debug] any version_uploads result', {
    error: anyUploadsError?.message || null,
    count: anyUploads?.length || 0,
  });

  if (!anyUploadsError && anyUploads && anyUploads.length > 0) {
    const anyAssetIds = anyUploads.map(vu => vu.asset_id).filter(Boolean);
    if (anyAssetIds.length > 0) {
      const {data: anyAssets, error: anyAssetsError} = await supabase
        .from('assets')
        .select('id, name, storage_url, r2_url, bunny_cdn_url, bunny_thumbnail_url, uploaded_at, type, mime_type')
        .in('id', anyAssetIds)
        .or('type.in.(image,foto),mime_type.ilike.image/%');

      console.log('[Gallery Debug] assets from any version_uploads', {
        error: anyAssetsError?.message || null,
        count: anyAssets?.length || 0,
      });

      if (!anyAssetsError && anyAssets && anyAssets.length > 0) {
        return toPhotos(anyAssets);
      }
    }
  }

  // Fallback: deliverable-tagged assets for the project (if version_uploads missing)
  const {data: deliverableData} = await supabase
    .from('deliverables')
    .select('project_id, type')
    .eq('id', deliverableId)
    .single();

  console.log('[Gallery Debug] deliverable lookup', {
    projectId: deliverableData?.project_id || null,
    deliverableType: deliverableData?.type || null,
  });

  if (!deliverableData?.project_id) {
    return [];
  }

  if (deliverableData.type === 'image_gallery') {
    const {data: fotoAssets, error: fotoError} = await supabase
      .from('assets')
      .select('id, name, storage_url, r2_url, bunny_cdn_url, bunny_thumbnail_url, uploaded_at, type, mime_type')
      .eq('project_id', deliverableData.project_id)
      .eq('type', 'foto')
      .order('uploaded_at', {ascending: false});

    console.log('[Gallery Debug] project fotos assets', {
      error: fotoError?.message || null,
      count: fotoAssets?.length || 0,
    });

    if (!fotoError && fotoAssets && fotoAssets.length > 0) {
      return toPhotos(fotoAssets);
    }
  }

  const baseAssetsQuery = supabase
    .from('assets')
    .select('id, name, storage_url, r2_url, bunny_cdn_url, bunny_thumbnail_url, uploaded_at, type, mime_type')
    .eq('project_id', deliverableData.project_id)
    .contains('tags', ['deliverables'])
    .or('type.in.(image,foto),mime_type.ilike.image/%')
    .order('uploaded_at', {ascending: false});

  const versionTag = `version-${versionNumber}`;
  const {data: taggedAssets} = await baseAssetsQuery.contains('tags', ['deliverables', versionTag]);

  console.log('[Gallery Debug] tagged assets', {
    versionTag,
    count: taggedAssets?.length || 0,
  });

  if (taggedAssets && taggedAssets.length > 0) {
    return toPhotos(taggedAssets);
  }

  const {data: fallbackAssets, error: fallbackError} = await baseAssetsQuery;
  console.log('[Gallery Debug] fallback assets', {
    error: fallbackError?.message || null,
    count: fallbackAssets?.length || 0,
  });
  if (fallbackError || !fallbackAssets) {
    return [];
  }

  return toPhotos(fallbackAssets);
}

export async function getDeliverableComments(
  deliverableId: string,
): Promise<Comment[]> {
  const {data, error} = await supabase
    .from('comments')
    .select(
      `
      id,
      content,
      timestamp,
      start_time,
      end_time,
      created_at,
      parent_id,
      completed,
      completed_by,
      completed_at,
      is_client_comment,
      client_name,
      client_email,
      author:users!comments_author_id_fkey (id, name, email, avatar),
      version:versions!comments_version_id_fkey (id, version_number, deliverable_id)
    `,
    )
    .eq('version.deliverable_id', deliverableId)
    .order('created_at', {ascending: true});

  if (error) {
    throw error;
  }

  interface CommentData {
    id: string;
    content: string;
    created_at: string;
    start_time?: string | number;
    end_time?: string | number;
    timestamp?: string | number;
    completed?: boolean;
    completed_by?: string;
    completed_at?: string;
    parent_id?: string;
    is_client_comment?: boolean;
    client_name?: string;
    client_email?: string;
    author: {
      id: string;
      name: string;
      email: string;
      avatar?: string;
    } | null;
    version: {
      id: string;
      version_number: number;
      deliverable_id: string;
    } | null;
  }

  return ((data || []) as CommentData[])
    .filter((c: CommentData) => c.version !== null)
    .map((c: CommentData) => {
      // Parse timestamps (may come as strings from DB)
      const startTime = c.start_time ? parseFloat(String(c.start_time)) : undefined;
      const endTime = c.end_time ? parseFloat(String(c.end_time)) : undefined;
      
      // Handle client comments vs authenticated user comments
      // Client comments have is_client_comment=true and use client_name/client_email
      const author = c.is_client_comment 
        ? {
            id: 'client',
            name: c.client_name || 'Client',
            email: c.client_email || '',
            avatar: undefined,
          }
        : c.author || {
            id: 'unknown',
            name: 'Unknown User',
            email: '',
            avatar: undefined,
          };
      
      return {
        id: c.id,
        content: c.content,
        author,
        created_at: c.created_at,
        start_time: startTime,
        end_time: endTime,
        timestamp: c.timestamp ? parseFloat(String(c.timestamp)) : undefined,
        version_number: c.version!.version_number,
        completed: c.completed || false,
        completed_by: c.completed_by,
        completed_at: c.completed_at,
        parent_id: c.parent_id,
        is_client_comment: c.is_client_comment || false,
      };
    });
}

export async function addComment(
  deliverableId: string,
  versionNumber: number,
  userId: string,
  content: string,
  startTime?: number,
  endTime?: number,
  parentId?: string,
): Promise<void> {
  // Get version ID
  const {data: versionData, error: versionError} = await supabase
    .from('versions')
    .select('id')
    .eq('deliverable_id', deliverableId)
    .eq('version_number', versionNumber)
    .single();

  if (versionError) {
    throw versionError;
  }

  const {error} = await supabase.from('comments').insert({
    version_id: versionData.id,
    author_id: userId,
    content,
    start_time: startTime ?? null,
    end_time: endTime ?? null,
    timestamp: startTime ?? null,
    parent_id: parentId ?? null,
  });

  if (error) {
    throw error;
  }
}

export async function toggleCommentComplete(
  commentId: string,
  currentlyCompleted: boolean,
  userId: string,
): Promise<void> {
  const {error} = await supabase
    .from('comments')
    .update({
      completed: !currentlyCompleted,
      completed_by: !currentlyCompleted ? userId : null,
      completed_at: !currentlyCompleted ? new Date().toISOString() : null,
    })
    .eq('id', commentId);

  if (error) {
    throw error;
  }
}

export async function deleteComment(commentId: string): Promise<void> {
  const {error} = await supabase.from('comments').delete().eq('id', commentId);

  if (error) {
    throw error;
  }
}

// ===== WORKSPACES =====

export interface PrimaryWorkspace {
  workspace_id: string;
  workspace_name: string;
  workspace_slug: string;
}

export async function getUserPrimaryWorkspace(): Promise<PrimaryWorkspace | null> {
  try {
    const {data, error} = await supabase.rpc('get_user_primary_workspace');

    if (error) {
      console.log('Error getting primary workspace:', error);
      return null;
    }

    // Return the first (and only) primary workspace
    return data && data.length > 0 ? data[0] : null;
  } catch {
    // RPC function may not exist - return null
    return null;
  }
}

export async function getUserPreferredWorkspace(userId: string): Promise<string | null> {
  try {
    const {data, error} = await supabase
      .from('users')
      .select('preferred_workspace_id')
      .eq('id', userId)
      .single();

    if (error || !data) {
      return null;
    }

    return data?.preferred_workspace_id || null;
  } catch {
    // Column may not exist - return null
    return null;
  }
}

export async function setUserPreferredWorkspace(userId: string, workspaceId: string): Promise<void> {
  try {
    const {error} = await supabase
      .from('users')
      .update({preferred_workspace_id: workspaceId})
      .eq('id', userId);

    if (error) {
      // Silently ignore - column may not exist in database
      // This is an optional feature
    }
  } catch {
    // Silently ignore any errors
  }
}

export async function getUserWorkspaces(userId: string): Promise<Workspace[]> {
  const {data, error} = await supabase
    .from('workspace_members')
    .select(
      `
      role,
      workspace:workspaces (id, name, slug, logo, tier)
    `,
    )
    .eq('user_id', userId);

  if (error) {
    throw error;
  }

  interface WorkspaceMemberData {
    role: string;
    workspace: {
      id: string;
      name: string;
      slug: string;
      logo?: string;
      tier?: string;
    };
  }

  return ((data || []) as WorkspaceMemberData[]).map(
    (m: WorkspaceMemberData) => ({
      ...m.workspace,
      role: m.role,
      tier: (m.workspace.tier as Workspace['tier']) || 'free',
    }),
  );
}

// ===== PROJECTS =====

export async function getProjects(workspaceId: string): Promise<Project[]> {
  // Use RPC function to get projects ordered by most recent activity
  // (comments, versions, or deliverables - whichever is most recent)
  const {data: rpcData, error: rpcError} = await supabase
    .rpc('get_projects_with_activity', {workspace_id_param: workspaceId});

  let projects: any[];
  
  if (rpcError) {
    // Fallback to regular query if RPC fails
    console.warn('get_projects_with_activity RPC failed, falling back:', rpcError);
    const {data, error} = await supabase
      .from('projects')
      .select(`
        *,
        client:clients(id, name)
      `)
      .eq('workspace_id', workspaceId)
      .order('updated_at', {ascending: false});

    if (error) {
      console.error('Projects query error:', error);
      throw error;
    }
    projects = data || [];
  } else {
    // Transform RPC data to match expected format
    projects = (rpcData || []).map((row: any) => ({
      id: row.project_id,
      workspace_id: workspaceId,
      name: row.project_name,
      description: row.project_description,
      thumbnail: row.project_thumbnail,
      status: row.project_status,
      deadline: row.project_deadline,
      client_id: row.project_client_id,
      project_type: row.project_type || 'video',
      created_by: row.project_created_by,
      created_at: row.project_created_at,
      updated_at: row.project_updated_at,
      client: row.client_id ? {
        id: row.client_id,
        name: row.client_name,
      } : null,
    }));
    
    // RPC only returns active projects, so also fetch archived ones
    const {data: archivedData} = await supabase
      .from('projects')
      .select(`
        *,
        client:clients(id, name)
      `)
      .eq('workspace_id', workspaceId)
      .eq('status', 'archived')
      .order('updated_at', {ascending: false});
    
    if (archivedData && archivedData.length > 0) {
      const archivedProjects = archivedData.map((p: any) => ({
        id: p.id,
        workspace_id: workspaceId,
        name: p.name,
        description: p.description,
        thumbnail: p.thumbnail,
        status: p.status,
        deadline: p.deadline,
        client_id: p.client_id,
        project_type: p.project_type || 'video',
        created_by: p.created_by,
        created_at: p.created_at,
        updated_at: p.updated_at,
        client: p.client,
      }));
      projects = [...projects, ...archivedProjects];
    }
  }
  
  if (projects.length === 0) {
    return [];
  }

  // Step 2: Enrich thumbnails for projects that don't have one
  // Following MOBILE_APP_PROJECT_THUMBNAILS.md logic
  const projectIds = projects.map((p: any) => p.id);
  
  // Filter projects that don't have thumbnails
  const projectsNeedingThumbnails = projects.filter((p: any) => !p.thumbnail);
  const projectIdsNeedingThumbnails = projectsNeedingThumbnails.map((p: any) => p.id);
  
  let deliverableData: Record<string, {count: number; thumbnail?: string}> = {};
  
  if (projectIdsNeedingThumbnails.length > 0) {
    // Step 2a: Get latest deliverable for each project (ordered by created_at DESC)
    const {data: latestDeliverables} = await supabase
      .from('deliverables')
      .select('id, project_id, created_at')
      .in('project_id', projectIdsNeedingThumbnails)
      .order('created_at', {ascending: false});
    
    // Map: project_id → latest deliverable_id
    const latestByProject: Record<string, string> = {};
    (latestDeliverables || []).forEach((d: any) => {
      if (!latestByProject[d.project_id]) {
        latestByProject[d.project_id] = d.id;
      }
    });
    
    const deliverableIds = Object.values(latestByProject);
    
    if (deliverableIds.length > 0) {
      // Step 2b: Get latest version for each deliverable + version_uploads (parallel queries)
      const [versionsResult, uploadsResult] = await Promise.all([
        supabase
          .from('versions')
          .select('deliverable_id, file_url, thumbnail_url, version_number')
          .in('deliverable_id', deliverableIds)
          .order('version_number', {ascending: false}),
        supabase
          .from('version_uploads')
          .select('deliverable_id, version_number, asset_id')
          .in('deliverable_id', deliverableIds),
      ]);
      
      const versions = versionsResult.data || [];
      const uploads = uploadsResult.data || [];
      
      // Map: deliverable_id → latest version (first one in ordered array)
      const versionByDeliverable: Record<string, any> = {};
      versions.forEach((v: any) => {
        if (!versionByDeliverable[v.deliverable_id]) {
          versionByDeliverable[v.deliverable_id] = v;
        }
      });
      
      // Step 2c: Get assets for version_uploads
      const assetIds = [...new Set((uploads || []).map((u: any) => u.asset_id).filter(Boolean))];
      let assetsMap: Record<string, any> = {};
      
      if (assetIds.length > 0) {
        const {data: assets} = await supabase
          .from('assets')
          .select('id, bunny_thumbnail_url, bunny_stream_video_id, bunny_hls_url, provider')
          .in('id', assetIds);
        
        (assets || []).forEach((a: any) => {
          assetsMap[a.id] = a;
        });
      }
      
      // Step 2d: Resolve thumbnails for each project
      projectsNeedingThumbnails.forEach((project: any) => {
        const latestDeliverableId = latestByProject[project.id];
        if (!latestDeliverableId) return;
        
        const version = versionByDeliverable[latestDeliverableId];
        if (!version) return;
        
        // Find the version_upload linking this version to an asset
        const linkedUpload = (uploads || []).find(
          (u: any) => u.deliverable_id === latestDeliverableId && 
                      u.version_number === version.version_number
        );
        
        let thumb: string | undefined;
        
        // Priority 1: Get from linked asset
        if (linkedUpload && assetsMap[linkedUpload.asset_id]) {
          const asset = assetsMap[linkedUpload.asset_id];
          
          // Priority 1a: asset.bunny_thumbnail_url
          if (asset.bunny_thumbnail_url) {
            thumb = asset.bunny_thumbnail_url;
          }
          // Priority 1b: Construct from bunny_stream_video_id
          else if (asset.bunny_stream_video_id && asset.provider !== 'cloudflare' && !asset.bunny_hls_url?.includes('videodelivery.net')) {
            thumb = constructBunnyThumbnail(asset.bunny_stream_video_id, version.file_url);
          }
        }
        
        // Priority 2: Extract GUID from version.file_url
        if (!thumb && version.file_url) {
          const guid = extractBunnyGuid(version.file_url);
          if (guid) {
            thumb = constructBunnyThumbnail(guid, version.file_url);
          }
        }
        
        // Priority 3: Fallback to version.thumbnail_url
        if (!thumb && version.thumbnail_url) {
          thumb = version.thumbnail_url;
        }
        
        // Store thumbnail for this project
        if (thumb) {
          if (!deliverableData[project.id]) {
            deliverableData[project.id] = {count: 0};
          }
          deliverableData[project.id].thumbnail = thumb;
        }
      });
    }
  }
  
  // Step 3: Get deliverable counts for all projects
  if (projectIds.length > 0) {
    const {data: allDeliverables} = await supabase
      .from('deliverables')
      .select('id, project_id')
      .in('project_id', projectIds);
    
    (allDeliverables || []).forEach((d: any) => {
      if (!deliverableData[d.project_id]) {
        deliverableData[d.project_id] = {count: 0};
      }
      deliverableData[d.project_id].count++;
    });
  }

  return projects.map((p: any) => {
    // Determine status - check for explicit archived flag or status field
    let status: 'active' | 'completed' | 'archived' = 'active';
    if (p.archived === true) {
      status = 'archived';
    } else if (p.status === 'archived') {
      status = 'archived';
    } else if (p.status === 'completed') {
      status = 'completed';
    }
    
    // Priority: 1. Direct project thumbnail, 2. Derived from latest deliverable
    const thumbnailUrl = p.thumbnail || deliverableData[p.id]?.thumbnail || null;
    
    console.log('[Project Thumbnail]', p.name, ':', {
      direct: p.thumbnail ? 'SET' : 'unset',
      derived: deliverableData[p.id]?.thumbnail ? 'SET' : 'unset',
      final: thumbnailUrl ? 'SET' : 'NONE',
    });
    
    return {
      id: p.id,
      workspace_id: p.workspace_id,
      name: p.name,
      description: p.description,
      thumbnail_url: thumbnailUrl,
      status,
      due_date: p.due_date || p.deadline,
      created_at: p.created_at,
      updated_at: p.updated_at,
      deliverable_count: deliverableData[p.id]?.count || 0,
      client: p.client || undefined,
      client_name: p.client?.name || undefined,
    };
  });
}

export async function getProjectDeliverables(
  projectId: string,
): Promise<Deliverable[]> {
  const {data, error} = await supabase
    .from('deliverables')
    .select(
      `
      *,
      project:projects(name),
      versions(*)
    `,
    )
    .eq('project_id', projectId)
    .order('updated_at', {ascending: false});

  if (error) {
    throw error;
  }

  const deliverables = data || [];
  if (deliverables.length === 0) {
    return [];
  }

  // Helper to fetch asset thumbnails for deliverables
  // Using same logic as getRecentDeliverables for consistency
  const fetchAssetThumbnails = async (deliverableIds: string[]): Promise<Record<string, string>> => {
    if (deliverableIds.length === 0) return {};
    
    try {
      // Step 1: Get latest version for each deliverable
      const {data: versions} = await supabase
        .from('versions')
        .select('deliverable_id, file_url, thumbnail_url, version_number')
        .in('deliverable_id', deliverableIds)
        .order('version_number', {ascending: false});
      
      // Map: deliverable_id → latest version
      const latestVersionByDeliverable: Record<string, any> = {};
      (versions || []).forEach((v: any) => {
        if (!latestVersionByDeliverable[v.deliverable_id]) {
          latestVersionByDeliverable[v.deliverable_id] = v;
        }
      });
      
      // Step 2: Get version_uploads for these deliverables
      const {data: uploads} = await supabase
        .from('version_uploads')
        .select('deliverable_id, version_number, asset_id')
        .in('deliverable_id', deliverableIds);
      
      // Step 3: Get assets
      const assetIds = [...new Set((uploads || []).map((u: any) => u.asset_id).filter(Boolean))];
      let assetMap: Record<string, any> = {};
      
      if (assetIds.length > 0) {
        const {data: assets} = await supabase
          .from('assets')
          .select('id, bunny_thumbnail_url, bunny_stream_video_id, bunny_hls_url, provider')
          .in('id', assetIds);
        
        (assets || []).forEach((a: any) => {
          assetMap[a.id] = a;
        });
      }
      
      // Step 4: Build deliverable -> thumbnail map using priority order
      // Same logic as dashboard for consistency
      const thumbnailMap: Record<string, string> = {};
      
      deliverableIds.forEach(deliverableId => {
        if (thumbnailMap[deliverableId]) return; // Already have thumbnail
        
        const version = latestVersionByDeliverable[deliverableId];
        if (!version) return;
        
        let thumb: string | undefined;
        
        // Priority 1: Get from linked asset
        const linkedUpload = (uploads || []).find(
          (u: any) => u.deliverable_id === deliverableId && 
                      u.version_number === version.version_number
        );
        
        if (linkedUpload && assetMap[linkedUpload.asset_id]) {
          const asset = assetMap[linkedUpload.asset_id];
          
          // Try bunny_thumbnail_url first
          if (asset.bunny_thumbnail_url) {
            thumb = asset.bunny_thumbnail_url;
          }
          // Construct from bunny_stream_video_id (use file_url to detect region)
          else if (asset.bunny_stream_video_id && asset.provider !== 'cloudflare' && !asset.bunny_hls_url?.includes('videodelivery.net')) {
            thumb = constructBunnyThumbnail(asset.bunny_stream_video_id, version.file_url);
          }
        }
        
        // Priority 2: Extract GUID from version.file_url
        if (!thumb && version.file_url) {
          const guid = extractBunnyGuid(version.file_url);
          if (guid) {
            thumb = constructBunnyThumbnail(guid, version.file_url);
          }
        }
        
        // Priority 3: Fallback to version.thumbnail_url
        if (!thumb && version.thumbnail_url) {
          thumb = version.thumbnail_url;
        }
        
        if (thumb) {
          thumbnailMap[deliverableId] = thumb;
        }
      });
      
      console.log('[Project Deliverables] Fetched thumbnails for', Object.keys(thumbnailMap).length, 'of', deliverableIds.length, 'deliverables');
      
      return thumbnailMap;
    } catch (err) {
      console.error('[Project Deliverables] Error fetching asset thumbnails:', err);
      return {};
    }
  };

  // Fetch asset thumbnails for all deliverables
  const deliverableIds = deliverables.map((d: any) => d.id);
  const assetThumbnails = await fetchAssetThumbnails(deliverableIds);

  return deliverables.map((d: any) => {
    const versions = d.versions || [];
    const latestVersion = versions.sort(
      (a: {version_number: number}, b: {version_number: number}) =>
        b.version_number - a.version_number,
    )[0];

    // Use proper thumbnail resolution with pre-fetched asset thumbnail
    // Same approach as dashboard for consistency
    const thumbnailUrl = resolveThumbnail({
      deliverable_thumbnail_url: d.thumbnail_url,
      deliverable_thumbnail: d.thumbnail,
      asset_bunny_thumbnail_url: assetThumbnails[d.id],
      version_file_url: latestVersion?.file_url,
      version_thumbnail_url: latestVersion?.thumbnail_url,
      deliverable_type: d.type,
    });

    return {
      ...d,
      project_name: d.project?.name,
      current_version: latestVersion?.version_number,
      thumbnail_url: thumbnailUrl || null,
    };
  });
}

// ===== CLIENTS =====

export async function getClients(workspaceId: string): Promise<Client[]> {
  const {data, error} = await supabase
    .from('clients')
    .select('id, workspace_id, name, company, email, created_at')
    .eq('workspace_id', workspaceId)
    .order('name');

  if (error) {
    throw error;
  }
  return data || [];
}

// ===== CREATE PROJECT =====

export async function createProject(
  workspaceId: string,
  userId: string,
  input: CreateProjectInput,
): Promise<Project> {
  const {data, error} = await supabase
    .from('projects')
    .insert({
      workspace_id: workspaceId,
      name: input.name,
      description: input.description || null,
      deadline: input.deadline || null,
      client_id: input.client_id || null,
      project_type: input.project_type || 'video',
      created_by: userId,
      status: 'active',
    })
    .select(`
      *,
      client:clients(id, name)
    `)
    .single();

  if (error) {
    throw error;
  }

  return {
    id: data.id,
    workspace_id: data.workspace_id,
    name: data.name,
    description: data.description,
    thumbnail_url: data.thumbnail || null,
    status: data.status || 'active',
    due_date: data.deadline,
    created_at: data.created_at,
    updated_at: data.updated_at,
    deliverable_count: 0,
    client: data.client || undefined,
    client_name: data.client?.name || undefined,
  };
}

// ===== CREATE DELIVERABLE =====

export async function createDeliverable(
  projectId: string,
  userId: string,
  input: CreateDeliverableInput,
): Promise<Deliverable> {
  const isImageGallery = input.type === 'image_gallery';
  const versionNumber = isImageGallery ? 0 : 1;

  const {data, error} = await supabase
    .from('deliverables')
    .insert({
      project_id: projectId,
      name: input.name,
      description: input.description || null,
      type: input.type,
      status: 'draft',
      current_version: versionNumber,
      due_date: isImageGallery ? null : (input.due_date || null),
      due_time: isImageGallery ? null : (input.due_time || null),
      created_by: userId,
    })
    .select(`
      *,
      project:projects(name)
    `)
    .single();

  if (error) {
    throw error;
  }

  return {
    id: data.id,
    project_id: data.project_id,
    project_name: data.project?.name,
    name: data.name,
    description: data.description,
    type: data.type,
    status: data.status,
    due_date: data.due_date,
    created_at: data.created_at,
    updated_at: data.updated_at,
    current_version: data.current_version,
  };
}

// ===== CLIENT REVIEW SHARE =====

export interface CreateShareLinkInput {
  deliverableId: string;
  versionNumber: number;
  expiresInDays: number;
  password?: string | null;
  allowDownloads: boolean;
}

export interface ShareLink {
  url: string;
}

export async function createClientReviewShareLink(
  input: CreateShareLinkInput,
): Promise<ShareLink> {
  const {data: sessionData} = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  if (!accessToken) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${API_BASE_URL}/api/client-review/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      deliverableId: input.deliverableId,
      versionNumber: input.versionNumber,
      expiresInDays: input.expiresInDays,
      password: input.password || null,
      allowDownloads: input.allowDownloads,
    }),
  });

  const data = await parseJSONResponse(response);

  if (!response.ok) {
    throw new Error(data.error || 'Failed to create share link');
  }

  return {url: data.link.url};
}

// ===== CREATE EVENT =====

const API_BASE_URL = 'https://www.posthive.app'; // Production Next.js app (use www to avoid redirect stripping auth header)

// ===== MARK COMMENTS AS READ =====

export async function markDeliverableCommentsAsRead(
  deliverableId: string,
  versionId?: string,
  markAsRead: boolean = true,
): Promise<void> {
  console.log(`[markDeliverableCommentsAsRead] Starting - deliverableId: ${deliverableId}, versionId: ${versionId || 'none'}, markAsRead: ${markAsRead}`);
  
  const {data: sessionData, error: sessionError} = await supabase.auth.getSession();
  console.log(`[markDeliverableCommentsAsRead] Session fetch - hasSession: ${!!sessionData.session}, error: ${sessionError?.message || 'none'}`);
  
  const accessToken = sessionData.session?.access_token;
  console.log(`[markDeliverableCommentsAsRead] Access token - present: ${!!accessToken}, length: ${accessToken?.length || 0}, preview: ${accessToken ? `${accessToken.substring(0, 20)}...` : 'null'}`);

  if (!accessToken) {
    console.error(`[markDeliverableCommentsAsRead] ERROR - No access token found!`);
    throw new Error('Not authenticated');
  }

  const url = `${API_BASE_URL}/api/deliverables/${deliverableId}/unread-comments`;
  const requestBody = {
    markAsRead,
    versionId: versionId || undefined,
  };
  
  console.log(`[markDeliverableCommentsAsRead] Making request to: ${url}`);
  console.log(`[markDeliverableCommentsAsRead] Request body:`, JSON.stringify(requestBody));
  console.log(`[markDeliverableCommentsAsRead] Authorization header: Bearer ${accessToken.substring(0, 20)}...`);

  const response = await fetch(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(requestBody),
    },
  );

  console.log(`[markDeliverableCommentsAsRead] Response status: ${response.status}, ok: ${response.ok}`);

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Failed to parse error');
    console.error(`[markDeliverableCommentsAsRead] ERROR - Status: ${response.status}, Body: ${errorText}`);
    let error;
    try {
      error = JSON.parse(errorText);
    } catch {
      error = {error: errorText || 'Failed to mark comments as read'};
    }
    throw new Error(error.error || 'Failed to mark comments as read');
  }
  
  console.log(`[markDeliverableCommentsAsRead] SUCCESS - Comments marked as read`);
}

// Helper function to safely parse JSON responses
async function parseJSONResponse(response: Response): Promise<any> {
  const contentType = response.headers.get('content-type');
  
  // Check if response is JSON
  if (!contentType || !contentType.includes('application/json')) {
    const text = await response.text();
    // If it's an HTML error page, try to extract useful info
    if (text.trim().startsWith('<')) {
      throw new Error(`Server returned HTML instead of JSON. Status: ${response.status} ${response.statusText}`);
    }
    throw new Error(`Server returned non-JSON response (${contentType}): ${text.substring(0, 200)}`);
  }
  
  try {
    return await response.json();
  } catch (error) {
    // If JSON parsing fails, get the raw text for debugging
    const text = await response.text();
    throw new Error(`Failed to parse JSON response: ${error instanceof Error ? error.message : 'Unknown error'}. Response: ${text.substring(0, 200)}`);
  }
}

// ===== AI COMMAND =====

export interface AICommandResult {
  success: boolean;
  message: string;
  isAnswer?: boolean; // Flag to indicate this is an answer/clarification, not a completed action
  data?: {
    type: 'todo' | 'event' | 'deliverable' | 'project';
    id?: string;
    title?: string;
    name?: string;
    eventId?: string;
  };
}

export async function executeAICommand(
  command: string,
  workspaceSlug: string,
): Promise<AICommandResult> {
  const {data: sessionData} = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  if (!accessToken) {
    throw new Error('Not authenticated');
  }

  // Log token for debugging (first 20 chars for security)
  console.log('🔑 [AI Command] Access Token:', accessToken.substring(0, 20) + '...' + accessToken.substring(accessToken.length - 10));
  console.log('🔑 [AI Command] Full Token (for testing):', accessToken);
  console.log('📤 [AI Command] Request:', {
    url: `${API_BASE_URL}/api/ai/command`,
    command,
    workspaceSlug,
  });

  const response = await fetch(`${API_BASE_URL}/api/ai/command`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      command,
      workspaceSlug,
    }),
  });

  const data = await parseJSONResponse(response);

  console.log('📥 [AI Command] Response:', {
    status: response.status,
    statusText: response.statusText,
    success: data.success,
    message: data.message,
  });

  if (!response.ok) {
    // Handle both error formats: { error: '...' } and { success: false, message: '...' }
    const errorMessage = data.message || data.error || `Failed to execute command (${response.status})`;
    console.error('❌ [AI Command] API error:', {
      status: response.status,
      statusText: response.statusText,
      data,
      errorMessage
    });
    throw new Error(errorMessage);
  }

  console.log('✅ [AI Command] Success:', data.message);
  return data;
}

export async function createEvent(
  workspaceId: string,
  input: CreateEventInput,
): Promise<CalendarEvent> {
  const {data: sessionData} = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  if (!accessToken) {
    throw new Error('Not authenticated');
  }

  // First try the HTTP API for Google Calendar sync support
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/workspaces/${workspaceId}/calendar/events`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(input),
      },
    );

    if (response.ok) {
      const result = await parseJSONResponse(response);
      // Return the created event
      return result.event || result;
    }
  } catch (apiError) {
    console.log('[Event] HTTP API not available, falling back to direct insert');
  }

  // Fallback: Direct Supabase insert (no Google Calendar sync)
  const {data: user} = await supabase.auth.getUser();
  const userId = user.user?.id;

  const {data, error} = await supabase
    .from('calendar_events')
    .insert({
      workspace_id: workspaceId,
      source_type: 'posthive',
      title: input.title,
      description: input.description || null,
      start_time: input.start_time,
      end_time: input.end_time,
      is_all_day: input.is_all_day || false,
      location: input.location || null,
      meeting_link: input.meeting_link || null,
      project_id: input.project_id || null,
      created_by: userId,
      visibility: (input as any).visibility || 'workspace', // Default to workspace if not specified
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

// ===== WORKSPACE MEMBERS =====

export async function getWorkspaceMembers(
  workspaceId: string,
): Promise<WorkspaceMember[]> {
  const {data, error} = await supabase
    .from('workspace_members')
    .select(`
      user_id,
      role,
      users:user_id (id, name, email, avatar)
    `)
    .eq('workspace_id', workspaceId);

  if (error) {
    throw error;
  }

  interface MemberData {
    user_id: string;
    role: string;
    users: {
      id: string;
      name: string;
      email: string;
      avatar?: string;
    } | null;
  }

  return ((data || []) as MemberData[])
    .filter((m: MemberData) => m.users !== null)
    .map((m: MemberData) => ({
      user_id: m.user_id,
      name: m.users!.name,
      email: m.users!.email,
      avatar: m.users!.avatar,
      role: m.role,
    }));
}

// ===== AUTO SCHEDULER =====

export interface TriggerAutoSchedulerResult {
  success: boolean;
  scheduled_count?: number;
  skipped?: boolean;
  reason?: string;
  error?: string;
}

// ===== FINALIZE DELIVERABLE =====

export async function markDeliverableAsFinal(
  deliverableId: string,
): Promise<{success: boolean; message: string}> {
  const {data: sessionData} = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  if (!accessToken) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(
    `${API_BASE_URL}/api/deliverables/${deliverableId}/mark-final`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  const data = await parseJSONResponse(response);

  if (!response.ok) {
    throw new Error(data.error || 'Failed to mark deliverable as final');
  }

  return {success: true, message: data.message || 'Deliverable marked as final'};
}

export async function unmarkDeliverableAsFinal(
  deliverableId: string,
): Promise<{success: boolean; message: string}> {
  const {data: sessionData} = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  if (!accessToken) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(
    `${API_BASE_URL}/api/deliverables/${deliverableId}/unmark-final`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  const data = await parseJSONResponse(response);

  if (!response.ok) {
    throw new Error(data.error || 'Failed to unmark deliverable as final');
  }

  return {success: true, message: data.message || 'Deliverable unmarked as final'};
}

// ===== AUTO SCHEDULER =====

export async function triggerAutoScheduler(
  workspaceId: string,
): Promise<TriggerAutoSchedulerResult> {
  const {data: sessionData} = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  if (!accessToken) {
    throw new Error('Not authenticated');
  }

  // Use the workspace-specific endpoint which is more robust
  const response = await fetch(`${API_BASE_URL}/api/workspaces/${workspaceId}/planner/trigger`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const data = await parseJSONResponse(response);

  if (!response.ok) {
    // Handle specific error cases
    if (data.error === 'MISSING_ESTIMATES') {
      throw new Error('Some tasks are missing time estimates. Please add estimates before scheduling.');
    }
    throw new Error(data.error || data.message || 'Failed to trigger auto scheduler');
  }

  return data;
}

