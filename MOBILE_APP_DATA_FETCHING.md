# PostHive Mobile App - Data Fetching Reference

This document explains exactly how to fetch thumbnails, versions, and comments (including client review comments) for the React Native companion app.

---

## 1. THUMBNAIL RESOLUTION

PostHive uses multiple storage providers. Thumbnails must be resolved with this priority:

### Thumbnail Priority Order
```
1. deliverable.thumbnail_url          (Direct deliverable thumbnail - set by webhook)
2. deliverable.thumbnail              (Legacy field)
3. asset.bunny_thumbnail_url          (Bunny Stream generated thumbnail)
4. Constructed Bunny URL              (Built from bunny_stream_video_id)
5. version.thumbnail_url              (Version-specific thumbnail)
6. asset.bunny_cdn_url                (Bunny CDN URL as fallback)
7. asset.r2_url                       (R2 storage URL)
8. asset.file_url                     (Original file URL for images)
```

### Bunny Thumbnail URL Construction
When `bunny_stream_video_id` is available, construct thumbnail URLs:
```typescript
const BUNNY_REGION = 'nyc'; // or from env NEXT_PUBLIC_BUNNY_REGION

function constructBunnyThumbnail(bunnyStreamVideoId: string): string {
  return `https://${BUNNY_REGION}.b-cdn.net/${bunnyStreamVideoId}/thumbnail.jpg`;
}

// Alternative thumbnails (numbered variants)
function constructBunnyThumbnailVariants(bunnyStreamVideoId: string): string[] {
  const region = BUNNY_REGION;
  return [
    `https://${region}.b-cdn.net/${bunnyStreamVideoId}/thumbnail.jpg`,
    `https://${region}.b-cdn.net/${bunnyStreamVideoId}/thumbnail_01.jpg`,
    `https://${region}.b-cdn.net/${bunnyStreamVideoId}/thumbnail_02.jpg`,
  ];
}
```

### Complete Thumbnail Resolution Function
```typescript
interface ThumbnailSources {
  deliverable_thumbnail_url?: string;
  deliverable_thumbnail?: string;
  asset_bunny_thumbnail_url?: string;
  asset_bunny_stream_video_id?: string;
  version_thumbnail_url?: string;
  asset_bunny_cdn_url?: string;
  asset_r2_url?: string;
  asset_file_url?: string;
  deliverable_type?: string;
}

function resolveThumbnail(sources: ThumbnailSources): string | undefined {
  const BUNNY_REGION = 'nyc';
  
  // Priority 1-2: Direct deliverable thumbnails
  if (sources.deliverable_thumbnail_url) return sources.deliverable_thumbnail_url;
  if (sources.deliverable_thumbnail) return sources.deliverable_thumbnail;
  
  // Priority 3: Bunny Stream thumbnail
  if (sources.asset_bunny_thumbnail_url) return sources.asset_bunny_thumbnail_url;
  
  // Priority 4: Construct from Bunny video ID
  if (sources.asset_bunny_stream_video_id) {
    return `https://${BUNNY_REGION}.b-cdn.net/${sources.asset_bunny_stream_video_id}/thumbnail.jpg`;
  }
  
  // Priority 5: Version thumbnail
  if (sources.version_thumbnail_url) return sources.version_thumbnail_url;
  
  // Priority 6-7: CDN/Storage fallbacks
  if (sources.asset_bunny_cdn_url) return sources.asset_bunny_cdn_url;
  if (sources.asset_r2_url) return sources.asset_r2_url;
  
  // Priority 8: For images, use the file itself
  if (sources.deliverable_type === 'image' && sources.asset_file_url) {
    return sources.asset_file_url;
  }
  
  return undefined;
}
```

---

## 2. VERSION FETCHING

### Version Data Structure
```typescript
interface Version {
  id: string;                       // UUID
  deliverable_id: string;           // UUID
  version_number: number;           // 1, 2, 3... (100+ = FINAL)
  file_url: string;                 // Original file URL
  thumbnail_url?: string;           // Version-specific thumbnail
  uploaded_at: string;              // ISO timestamp
  status: string;                   // 'processing' | 'ready' | 'error'
  
  // Asset info (joined)
  bunny_stream_video_id?: string;
  bunny_hls_url?: string;           // HLS streaming URL (preferred for playback)
  bunny_cdn_url?: string;           // CDN URL
  bunny_thumbnail_url?: string;
  processing_status?: string;       // 'pending' | 'processing' | 'ready' | 'error'
}
```

### Fetch Versions for a Deliverable
```typescript
async function getDeliverableVersions(deliverableId: string): Promise<Version[]> {
  const { data, error } = await supabase
    .from('versions')
    .select(`
      id,
      deliverable_id,
      version_number,
      file_url,
      thumbnail_url,
      uploaded_at,
      status
    `)
    .eq('deliverable_id', deliverableId)
    .order('version_number', { ascending: false });

  if (error) throw error;
  return data || [];
}
```

### Fetch Version with Asset Details (for playback)
```typescript
async function getVersionWithAsset(versionId: string): Promise<Version & { asset?: AssetDetails }> {
  // Get version
  const { data: version, error: versionError } = await supabase
    .from('versions')
    .select('*')
    .eq('id', versionId)
    .single();

  if (versionError) throw versionError;

  // Get linked asset via version_uploads
  const { data: upload } = await supabase
    .from('version_uploads')
    .select('asset_id')
    .eq('deliverable_id', version.deliverable_id)
    .eq('version_number', version.version_number)
    .limit(1)
    .single();

  let asset = null;
  if (upload?.asset_id) {
    const { data: assetData } = await supabase
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
      .eq('id', upload.asset_id)
      .single();
    
    asset = assetData;
  }

  return { ...version, asset };
}
```

### Version Number Display
```typescript
function formatVersionNumber(versionNumber: number): string {
  if (versionNumber >= 100) return 'FINAL';
  return `V${versionNumber}`;
}
```

---

## 3. PLAYBACK URL RESOLUTION

For video playback, choose the best available URL:

```typescript
interface PlaybackSources {
  bunny_hls_url?: string;           // Best - adaptive streaming
  bunny_cdn_url?: string;           // Good - CDN delivery
  storage_url?: string;             // Fallback - direct storage
  r2_url?: string;                  // Fallback - R2 storage
  file_url?: string;                // Last resort - original URL
  processing_status?: string;
}

function resolvePlaybackUrl(sources: PlaybackSources): string | undefined {
  // Only use HLS if processing is complete
  if (sources.processing_status === 'ready' && sources.bunny_hls_url) {
    return sources.bunny_hls_url;
  }
  
  // CDN URL for direct playback
  if (sources.bunny_cdn_url) return sources.bunny_cdn_url;
  if (sources.storage_url) return sources.storage_url;
  if (sources.r2_url) return convertR2ToPublic(sources.r2_url);
  if (sources.file_url) return sources.file_url;
  
  return undefined;
}

// R2 URL conversion (if needed)
function convertR2ToPublic(r2Url: string): string {
  if (r2Url.includes('r2.cloudflarestorage.com')) {
    // Replace with public CDN domain
    return r2Url.replace(
      /https:\/\/[^/]+\.r2\.cloudflarestorage\.com/,
      'https://your-r2-public-domain.com'
    );
  }
  return r2Url;
}
```

---

## 4. COMMENTS FETCHING (Authenticated Users)

### Comment Data Structure
```typescript
interface Comment {
  id: string;
  content: string;
  
  // Timestamps (for video comments)
  timestamp?: number;              // Legacy single timestamp (seconds)
  start_time?: number;             // Start of time range (seconds)
  end_time?: number;               // End of time range (seconds)
  
  // Computed properties
  isRange: boolean;                // true if start_time && end_time exist
  duration?: number;               // end_time - start_time
  
  // Version info
  version_number: number;
  version_display: string;         // "V1", "V2", "FINAL"
  
  // Author info
  author: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  
  // Metadata
  created_at: string;
  parent_id?: string;              // For replies
  completed: boolean;
  completed_by?: string;
  completed_at?: string;
  
  // Client comment flag
  is_client_comment: boolean;
  
  // Nested replies (optional)
  replies?: Comment[];
}
```

### Fetch Comments for Deliverable (Authenticated)
```typescript
async function getDeliverableComments(deliverableId: string): Promise<Comment[]> {
  const { data: comments, error } = await supabase
    .from('comments')
    .select(`
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
      author:users!comments_author_id_fkey (
        id,
        name,
        email,
        avatar
      ),
      version:versions!comments_version_id_fkey (
        id,
        version_number,
        deliverable_id
      )
    `)
    .eq('version.deliverable_id', deliverableId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  // Transform to Comment interface
  return (comments || [])
    .filter((c: any) => c.version !== null)
    .map((c: any) => transformComment(c));
}

function transformComment(raw: any): Comment {
  const startTime = raw.start_time ? parseFloat(raw.start_time) : undefined;
  const endTime = raw.end_time ? parseFloat(raw.end_time) : undefined;
  const isRange = startTime !== undefined && endTime !== undefined && endTime > startTime;
  
  // Handle client comments vs authenticated user comments
  const author = raw.is_client_comment 
    ? {
        id: 'client',
        name: raw.client_name || 'Client',
        email: raw.client_email || '',
        avatar: undefined
      }
    : {
        id: raw.author?.id || '',
        name: raw.author?.name || 'Unknown User',
        email: raw.author?.email || '',
        avatar: raw.author?.avatar
      };

  const versionNumber = raw.version?.version_number || 1;

  return {
    id: raw.id,
    content: raw.content,
    timestamp: raw.timestamp ? parseFloat(raw.timestamp) : undefined,
    start_time: startTime,
    end_time: endTime,
    isRange,
    duration: isRange ? endTime! - startTime! : undefined,
    version_number: versionNumber,
    version_display: versionNumber >= 100 ? 'FINAL' : `V${versionNumber}`,
    author,
    created_at: raw.created_at,
    parent_id: raw.parent_id || undefined,
    completed: raw.completed || false,
    completed_by: raw.completed_by || undefined,
    completed_at: raw.completed_at || undefined,
    is_client_comment: raw.is_client_comment || false
  };
}
```

---

## 5. CLIENT REVIEW COMMENTS (Public/Unauthenticated)

Client review uses special RPC functions that bypass RLS.

### Client Review Data Structure
```typescript
interface ClientReviewData {
  isValid: boolean;
  
  deliverable: {
    id: string;
    name: string;
    description?: string;
    type: 'video' | 'image' | 'image_gallery' | 'audio' | 'pdf';
  };
  
  project: {
    name: string;
    client?: { name: string };
  };
  
  version: {
    id: string;
    number: number;
    fileUrl: string;
    thumbnailUrl?: string;
    asset?: {
      bunny_stream_video_id?: string;
      bunny_hls_url?: string;
      bunny_cdn_url?: string;
      bunny_thumbnail_url?: string;
      storage_url?: string;
      r2_url?: string;
      processing_status?: string;
    };
  };
  
  allowComments: boolean;
  allowDownloads: boolean;
  comments: ClientReviewComment[];
  expiresAt?: string;
  
  // For image galleries
  galleryImages?: GalleryImage[];
}

interface ClientReviewComment {
  id: string;
  content: string;
  timestamp?: number;              // Single timestamp (seconds)
  start_time?: number;             // Range start (seconds)
  end_time?: number;               // Range end (seconds)
  created_at: string;
  is_client_comment: boolean;
  client_name?: string;            // Name entered by client
  client_email?: string;           // Email entered by client
  author?: {                       // Only for internal team comments
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
}
```

### Fetch Client Review Data via API
```typescript
async function fetchClientReview(token: string, password?: string): Promise<ClientReviewData> {
  const url = new URL(`/api/client-review/${token}`, API_BASE_URL);
  if (password) {
    url.searchParams.set('password', password);
  }

  const response = await fetch(url.toString());
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to load review');
  }
  
  return response.json();
}
```

### Fetch Client Review Comments via RPC (Alternative)
```typescript
// Uses security definer function - bypasses RLS
// Only returns client comments (is_client_comment = true)
async function getClientReviewComments(versionId: string): Promise<ClientReviewComment[]> {
  const { data, error } = await supabase.rpc('get_client_review_comments', {
    p_version_id: versionId
  });

  if (error) throw error;

  return (data || []).map((c: any) => ({
    id: c.id,
    content: c.content,
    timestamp: c.comment_timestamp ? parseFloat(c.comment_timestamp) : undefined,
    start_time: c.start_time ? parseFloat(c.start_time) : undefined,
    end_time: c.end_time ? parseFloat(c.end_time) : undefined,
    created_at: c.created_at,
    is_client_comment: c.is_client_comment,
    client_name: c.client_name,
    client_email: c.client_email,
    author: c.author_id ? {
      id: c.author_id,
      name: c.author_name,
      email: c.author_email,
      avatar: c.author_avatar
    } : undefined
  }));
}
```

### Add Client Review Comment
```typescript
interface AddClientCommentInput {
  clientName: string;              // Required
  clientEmail?: string;            // Optional
  content: string;                 // Required
  timestamp?: number;              // Optional - single timestamp
  start_time?: number;             // Optional - range start
  end_time?: number;               // Optional - range end
}

async function addClientComment(token: string, input: AddClientCommentInput): Promise<ClientReviewComment> {
  const response = await fetch(`/api/client-review/${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientName: input.clientName,
      clientEmail: input.clientEmail,
      content: input.content,
      timestamp: input.timestamp,
      start_time: input.start_time,
      end_time: input.end_time
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to add comment');
  }

  const result = await response.json();
  return result.comment;
}
```

---

## 6. RPC FUNCTIONS REFERENCE

These PostgreSQL functions are available via Supabase RPC:

### `get_client_review_data(p_token TEXT)`
Returns deliverable, project, version, and permissions for a client review link.

**Returns:**
| Column | Type | Description |
|--------|------|-------------|
| deliverable_id | UUID | Deliverable ID |
| deliverable_name | TEXT | Deliverable name |
| deliverable_description | TEXT | Description |
| deliverable_type | TEXT | 'video', 'image', 'image_gallery', etc |
| project_id | UUID | Project ID |
| project_name | TEXT | Project name |
| client_name | TEXT | Client name (from project) |
| workspace_id | UUID | Workspace ID |
| workspace_name | TEXT | Workspace name |
| version_id | UUID | Version ID |
| version_number | INTEGER | Version number |
| file_url | TEXT | File URL |
| thumbnail_url | TEXT | Thumbnail URL |
| allow_comments | BOOLEAN | Whether comments are allowed |
| allow_downloads | BOOLEAN | Whether downloads are allowed |
| expires_at | TIMESTAMP | Link expiration date |

### `get_client_review_comments(p_version_id UUID)`
Returns comments for a specific version (client review mode - only client comments).

**Returns:**
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Comment ID |
| content | TEXT | Comment content |
| comment_timestamp | NUMERIC | Single timestamp (seconds) |
| start_time | NUMERIC | Range start (seconds) |
| end_time | NUMERIC | Range end (seconds) |
| created_at | TIMESTAMP | When comment was created |
| is_client_comment | BOOLEAN | Always true for this function |
| client_name | TEXT | Client's name |
| client_email | TEXT | Client's email |
| author_id | UUID | User ID (null for client comments) |
| author_name | TEXT | User name (null for client comments) |
| author_email | TEXT | User email (null for client comments) |
| author_avatar | TEXT | User avatar URL (null for client comments) |

### `add_client_comment(p_token, p_client_name, p_content, p_client_email, p_timestamp, p_start_time, p_end_time)`
Adds a client comment to a review (bypasses RLS).

---

## 7. DATABASE SCHEMA REFERENCE

### `versions` Table
```sql
versions (
  id UUID PRIMARY KEY,
  deliverable_id UUID REFERENCES deliverables(id),
  version_number INTEGER NOT NULL,
  file_url TEXT,
  thumbnail_url TEXT,
  uploaded_at TIMESTAMP DEFAULT NOW(),
  status TEXT DEFAULT 'processing',
  UNIQUE(deliverable_id, version_number)
)
```

### `version_uploads` Table (Links versions to assets)
```sql
version_uploads (
  id UUID PRIMARY KEY,
  deliverable_id UUID REFERENCES deliverables(id),
  version_number INTEGER,
  asset_id UUID REFERENCES assets(id),
  file_url TEXT,
  mime_type TEXT
)
```

### `assets` Table (File storage metadata)
```sql
assets (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  name TEXT,
  type TEXT,
  file_url TEXT,
  storage_url TEXT,
  r2_url TEXT,
  bunny_stream_video_id TEXT,       -- Bunny Stream GUID
  bunny_hls_url TEXT,               -- HLS streaming URL
  bunny_cdn_url TEXT,               -- CDN URL
  bunny_thumbnail_url TEXT,         -- Thumbnail URL
  processing_status TEXT,           -- 'pending' | 'processing' | 'ready' | 'error'
  stream_ready BOOLEAN DEFAULT FALSE
)
```

### `comments` Table
```sql
comments (
  id UUID PRIMARY KEY,
  version_id UUID REFERENCES versions(id),
  author_id UUID REFERENCES users(id),  -- NULL for client comments
  content TEXT NOT NULL,
  timestamp NUMERIC,                    -- Legacy single timestamp
  start_time NUMERIC,                   -- Range start
  end_time NUMERIC,                     -- Range end
  parent_id UUID REFERENCES comments(id),
  completed BOOLEAN DEFAULT FALSE,
  completed_by UUID,
  completed_at TIMESTAMP,
  is_client_comment BOOLEAN DEFAULT FALSE,
  client_name TEXT,                     -- For client comments
  client_email TEXT,                    -- For client comments
  created_at TIMESTAMP DEFAULT NOW()
)
```

---

## 8. COMPLETE EXAMPLE: FETCH DELIVERABLE WITH ALL DATA

```typescript
interface DeliverableWithFullData {
  deliverable: Deliverable;
  versions: Version[];
  latestVersion: Version;
  comments: Comment[];
  thumbnailUrl?: string;
  playbackUrl?: string;
}

async function fetchDeliverableWithFullData(deliverableId: string): Promise<DeliverableWithFullData> {
  // 1. Fetch deliverable
  const { data: deliverable, error: delError } = await supabase
    .from('deliverables')
    .select('*')
    .eq('id', deliverableId)
    .single();
  
  if (delError) throw delError;

  // 2. Fetch versions
  const { data: versions, error: versionsError } = await supabase
    .from('versions')
    .select('*')
    .eq('deliverable_id', deliverableId)
    .order('version_number', { ascending: false });
  
  if (versionsError) throw versionsError;

  const latestVersion = versions?.[0];

  // 3. Fetch asset for latest version
  let asset = null;
  if (latestVersion) {
    const { data: upload } = await supabase
      .from('version_uploads')
      .select('asset_id')
      .eq('deliverable_id', deliverableId)
      .eq('version_number', latestVersion.version_number)
      .limit(1)
      .single();

    if (upload?.asset_id) {
      const { data: assetData } = await supabase
        .from('assets')
        .select('*')
        .eq('id', upload.asset_id)
        .single();
      asset = assetData;
    }
  }

  // 4. Fetch comments
  const comments = await getDeliverableComments(deliverableId);

  // 5. Resolve thumbnail
  const thumbnailUrl = resolveThumbnail({
    deliverable_thumbnail_url: deliverable.thumbnail_url,
    deliverable_thumbnail: deliverable.thumbnail,
    asset_bunny_thumbnail_url: asset?.bunny_thumbnail_url,
    asset_bunny_stream_video_id: asset?.bunny_stream_video_id,
    version_thumbnail_url: latestVersion?.thumbnail_url,
    asset_bunny_cdn_url: asset?.bunny_cdn_url,
    asset_r2_url: asset?.r2_url,
    asset_file_url: asset?.file_url,
    deliverable_type: deliverable.type
  });

  // 6. Resolve playback URL
  const playbackUrl = resolvePlaybackUrl({
    bunny_hls_url: asset?.bunny_hls_url,
    bunny_cdn_url: asset?.bunny_cdn_url,
    storage_url: asset?.storage_url,
    r2_url: asset?.r2_url,
    file_url: latestVersion?.file_url,
    processing_status: asset?.processing_status
  });

  return {
    deliverable,
    versions: versions || [],
    latestVersion,
    comments,
    thumbnailUrl,
    playbackUrl
  };
}
```

---

## 9. TIMESTAMP FORMATTING

```typescript
// Format seconds to MM:SS or HH:MM:SS
function formatTimestamp(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Format comment timestamp display
function formatCommentTimestamp(comment: Comment): string {
  if (comment.isRange && comment.start_time !== undefined && comment.end_time !== undefined) {
    return `${formatTimestamp(comment.start_time)} - ${formatTimestamp(comment.end_time)}`;
  }
  if (comment.start_time !== undefined) {
    return formatTimestamp(comment.start_time);
  }
  if (comment.timestamp !== undefined) {
    return formatTimestamp(comment.timestamp);
  }
  return '';
}
```

