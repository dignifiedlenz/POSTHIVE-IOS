import React, {useState, useEffect, useCallback, useMemo, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  ScrollView,
  Image,
  Animated,
  Share,
  Alert,
  useWindowDimensions,
} from 'react-native';
import {FileVideo, FileImage, File, Star, Play, X, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, ArrowUpDown, Download, Check} from 'lucide-react-native';
import {theme} from '../../theme';
import {useProjectParams} from '../../contexts/ProjectContext';
import {useAuth} from '../../hooks/useAuth';
import {
  getProjectResources,
  getDownloadUrl,
  updateAssetTagsAndRating,
  type ProjectResource,
} from '../../lib/api';
import {CameraRoll} from '@react-native-camera-roll/camera-roll';
import ReactNativeBlobUtil from 'react-native-blob-util';
import {resolvePlaybackUrl, resolveAssetThumbnail} from '../../lib/utils';
import {VideoPlayer} from '../../components/VideoPlayer';


type SortOption = 'uploaded_at' | 'name' | 'rating';

function sortResources(resources: ProjectResource[], sort: SortOption): ProjectResource[] {
  const arr = [...resources];
  switch (sort) {
    case 'name':
      return arr.sort((a, b) =>
        (a.display_name || a.name || '').localeCompare(b.display_name || b.name || ''),
      );
    case 'rating':
      return arr.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    case 'uploaded_at':
    default:
      return arr.sort(
        (a, b) =>
          new Date(b.uploaded_at || 0).getTime() - new Date(a.uploaded_at || 0).getTime(),
      );
  }
}

function formatFileSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return '--';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size >= 10 ? size.toFixed(0) : size.toFixed(1)} ${units[unitIndex]}`;
}

const SUPPORTED_VIDEO_EXT = ['mp4', 'mov', 'm4v', 'mp4v', '3gp'];
const SUPPORTED_PHOTO_EXT = ['jpg', 'jpeg', 'png', 'gif', 'heic', 'heif', 'tiff', 'tif', 'bmp'];

function getFileExtension(url: string): string {
  const path = url.split('?')[0];
  return path.split('.').pop()?.toLowerCase() || '';
}

function isResourceSupportedForCameraRoll(
  url: string,
  resource: ProjectResource,
): {supported: boolean; mediaType: 'photo' | 'video'} {
  const ext = getFileExtension(url);
  const type = resource.type || '';
  const mime = (resource.mime_type || '').toLowerCase();
  if (SUPPORTED_VIDEO_EXT.includes(ext) || mime.startsWith('video/')) {
    return {supported: true, mediaType: 'video'};
  }
  if (
    SUPPORTED_PHOTO_EXT.includes(ext) ||
    mime.startsWith('image/') ||
    ['image', 'graphic', 'foto'].includes(type)
  ) {
    return {supported: true, mediaType: 'photo'};
  }
  if (type === 'video') return {supported: true, mediaType: 'video'};
  if (['image', 'graphic', 'foto'].includes(type)) return {supported: true, mediaType: 'photo'};
  return {supported: false, mediaType: 'video'};
}

function getDownloadableUrl(resource: ProjectResource): string | null {
  return resource.storage_url || resource.playback_url || resource.bunny_cdn_url || null;
}

function ResourceCard({
  resource,
  onPress,
}: {
  resource: ProjectResource;
  onPress: () => void;
}) {
  const playbackUrl =
    resolvePlaybackUrl({
      playback_url: resource.playback_url ?? undefined,
      bunny_cdn_url: resource.bunny_cdn_url ?? undefined,
      storage_url: resource.storage_url ?? undefined,
      processing_status: resource.processing_status ?? undefined,
    }) || resource.playback_url || resource.storage_url || resource.bunny_cdn_url || '';
  const thumbUrl = resolveAssetThumbnail({
    type: resource.type,
    mime_type: resource.mime_type,
    bunny_cdn_url: resource.bunny_cdn_url,
    playback_url: resource.playback_url,
    storage_url: resource.storage_url,
  });
  const isVideo =
    resource.type === 'video' ||
    (resource.mime_type || '').startsWith('video/');

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.8}>
      <View style={styles.cardThumb}>
        {thumbUrl ? (
          <Image source={{uri: thumbUrl}} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <View style={styles.cardPlaceholder}>
            {isVideo ? (
              <Play size={40} color={theme.colors.textMuted} fill={theme.colors.textMuted} />
            ) : resource.type === 'image' ? (
              <FileImage size={32} color={theme.colors.textMuted} />
            ) : (
              <File size={32} color={theme.colors.textMuted} />
            )}
          </View>
        )}
        {isVideo && (
          <View style={styles.playOverlay}>
            <Play size={24} color="#fff" fill="#fff" />
          </View>
        )}
        {resource.rating != null && resource.rating > 0 && (
          <View style={styles.ratingBadge}>
            <Star size={12} color="#FFD700" fill="#FFD700" />
            <Text style={styles.ratingText}>{resource.rating}</Text>
          </View>
        )}
      </View>
      <Text style={styles.cardTitle} numberOfLines={2}>
        {resource.display_name || resource.name}
      </Text>
      {((resource.tags || []).filter(t => t !== 'resources')).length > 0 && (
        <View style={styles.tagsRow}>
          {(resource.tags || []).filter(t => t !== 'resources').slice(0, 2).map(tag => (
            <View key={tag} style={styles.tagChip}>
              <Text style={styles.tagChipText} numberOfLines={1}>{tag}</Text>
            </View>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
}

export function ProjectResourcesTab() {
  const {width: screenWidth} = useWindowDimensions();
  const {projectId} = useProjectParams();
  const {currentWorkspace} = useAuth();
  const [resources, setResources] = useState<ProjectResource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedResource, setSelectedResource] = useState<ProjectResource | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [editTagsArray, setEditTagsArray] = useState<string[]>([]);
  const [tagInputValue, setTagInputValue] = useState('');
  const [editRating, setEditRating] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('uploaded_at');
  const [topCollapsed, setTopCollapsed] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [confirmDownloadResource, setConfirmDownloadResource] = useState<ProjectResource | null>(null);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadedBytes, setDownloadedBytes] = useState(0);
  const [downloadStatus, setDownloadStatus] = useState<'downloading' | 'saving' | 'success' | 'error'>('downloading');
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloadSize, setDownloadSize] = useState<number | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const downloadingResourceRef = useRef<ProjectResource | null>(null);
  const downloadProgressAnim = useRef(new Animated.Value(0)).current;
  const successScaleAnim = useRef(new Animated.Value(0)).current;
  const carouselScrollRef = useRef<ScrollView>(null);
  const isScrollingProgrammatically = useRef(false);
  const skipNextScrollSync = useRef(false);

  const sortedResources = useMemo(
    () => sortResources(resources, sortBy),
    [resources, sortBy],
  );

  const cardSize = (screenWidth - theme.spacing.md * 3) / 2;

  useEffect(() => {
    if (selectedResource && sortedResources.length > 0) {
      const idx = sortedResources.findIndex(r => r.id === selectedResource.id);
      if (idx >= 0) setSelectedIndex(idx);
    }
  }, [sortBy]);

  const handleCarouselScroll = useCallback(() => {
    if (sortedResources.length <= 1 || isScrollingProgrammatically.current) return;
    setTopCollapsed(true);
  }, [sortedResources.length]);

  const handleCarouselScrollEnd = useCallback(
    (evt: {nativeEvent: {contentOffset: {x: number}}}) => {
      if (sortedResources.length <= 1) return;
      skipNextScrollSync.current = true;
      const x = evt.nativeEvent.contentOffset.x;
      const idx = Math.round(x / screenWidth);
      const clamped = Math.max(0, Math.min(sortedResources.length - 1, idx));
      const target = sortedResources[clamped];
      setSelectedIndex(clamped);
      setSelectedResource(target);
      setEditTagsArray((target.tags || []).filter(t => t !== 'resources'));
      setEditRating(target.rating ?? null);
      setTopCollapsed(false);
      isScrollingProgrammatically.current = false;
    },
    [sortedResources, screenWidth],
  );

  const workspaceId = currentWorkspace?.id || '';

  const loadResources = useCallback(async () => {
    if (!workspaceId || !projectId) return;
    setIsLoading(true);
    try {
      const data = await getProjectResources(workspaceId, projectId);
      setResources(data);
    } catch (err) {
      console.error('Failed to load project resources:', err);
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, projectId]);

  useEffect(() => {
    loadResources();
  }, [loadResources]);

  const RESOURCE_SYSTEM_TAG = 'resources';

  const openResource = (resource: ProjectResource, index: number) => {
    setSelectedResource(resource);
    setSelectedIndex(index);
    setTopCollapsed(false);
    setEditTagsArray((resource.tags || []).filter(t => t !== RESOURCE_SYSTEM_TAG));
    setEditRating(resource.rating ?? null);
  };

  useEffect(() => {
    if (selectedResource && sortedResources.length > 1 && !skipNextScrollSync.current) {
      isScrollingProgrammatically.current = true;
      const t = setTimeout(() => {
        carouselScrollRef.current?.scrollTo({x: selectedIndex * screenWidth, animated: false});
        setTimeout(() => {
          isScrollingProgrammatically.current = false;
        }, 100);
      }, 50);
      return () => clearTimeout(t);
    }
    skipNextScrollSync.current = false;
  }, [selectedResource, selectedIndex, sortedResources.length, screenWidth]);

  const closeResource = () => setSelectedResource(null);

  const saveTagsAndRating = useCallback(
    async (tags: string[], rating: number | null) => {
      if (!selectedResource || !workspaceId) return;
      setIsSaving(true);
      try {
        const fullTags = [...new Set([...tags, RESOURCE_SYSTEM_TAG])];
        await updateAssetTagsAndRating(selectedResource.id, fullTags, rating);
        setResources(prev =>
          prev.map(r =>
            r.id === selectedResource.id ? {...r, tags: fullTags, rating} : r,
          ),
        );
        setSelectedResource(prev =>
          prev ? {...prev, tags: fullTags, rating} : null,
        );
      } catch (err) {
        console.error('Failed to update tags/rating:', err);
      } finally {
        setIsSaving(false);
      }
    },
    [selectedResource, workspaceId],
  );

  const addTag = useCallback(() => {
    const tag = tagInputValue.trim();
    if (!tag) return;
    const next = [...editTagsArray, tag];
    setEditTagsArray(next);
    setTagInputValue('');
    saveTagsAndRating(next, editRating);
  }, [tagInputValue, editTagsArray, editRating, saveTagsAndRating]);

  const removeTag = useCallback(
    (tagToRemove: string) => {
      const next = editTagsArray.filter(t => t !== tagToRemove);
      setEditTagsArray(next);
      saveTagsAndRating(next, editRating);
    },
    [editTagsArray, editRating, saveTagsAndRating],
  );

  const handleRatingChange = useCallback(
    (n: number) => {
      const newRating = editRating === n ? null : n;
      setEditRating(newRating);
      saveTagsAndRating(editTagsArray, newRating);
    },
    [editRating, editTagsArray, saveTagsAndRating],
  );

  const resetDownloadModal = useCallback(() => {
    setShowDownloadModal(false);
    setDownloadProgress(0);
    setDownloadedBytes(0);
    setDownloadStatus('downloading');
    setDownloadError(null);
    setDownloadSize(null);
    downloadingResourceRef.current = null;
    downloadProgressAnim.setValue(0);
    successScaleAnim.setValue(0);
  }, [downloadProgressAnim, successScaleAnim]);

  const animateSuccess = useCallback(() => {
    Animated.sequence([
      Animated.timing(downloadProgressAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: false,
      }),
      Animated.spring(successScaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, [downloadProgressAnim, successScaleAnim]);

  const handleDownloadRequest = useCallback((resource: ProjectResource) => {
    const url = getDownloadableUrl(resource);
    if (!url) {
      Alert.alert('Unavailable', 'This file does not have a downloadable URL.');
      return;
    }
    setConfirmDownloadResource(resource);
  }, []);

  const handleDownloadConfirm = useCallback(async (resourceOverride?: ProjectResource) => {
    const resource = resourceOverride ?? confirmDownloadResource;
    setConfirmDownloadResource(null);
    if (!resource) return;

    const rawUrl = getDownloadableUrl(resource);
    if (!rawUrl) {
      return;
    }

    const label = resource.display_name || resource.name || 'file';
    try {
      setIsDownloading(true);
      downloadingResourceRef.current = resource;
      setDownloadSize(resource.file_size ?? null);
      resetDownloadModal();
      setShowDownloadModal(true);

      const signedUrl = await getDownloadUrl(rawUrl, label);
      const {supported: canUseCameraRoll, mediaType} = isResourceSupportedForCameraRoll(
        signedUrl,
        resource,
      );
      const ext = getFileExtension(signedUrl) || (mediaType === 'video' ? 'mp4' : 'jpg');
      const sanitizedName = label.replace(/[^a-zA-Z0-9-_]/g, '_');
      const fileName = `PostHive_${sanitizedName}.${ext}`;
      const tempPath = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/${fileName}`;

      const response = await ReactNativeBlobUtil.config({
        fileCache: true,
        path: tempPath,
        followRedirect: true,
      })
        .fetch('GET', signedUrl)
        .progress({interval: 100}, (received, total) => {
          const progress = total > 0 ? received / total : 0;
          setDownloadProgress(progress);
          setDownloadedBytes(received);
          Animated.timing(downloadProgressAnim, {
            toValue: progress,
            duration: 100,
            useNativeDriver: false,
          }).start();
        });

      if (response.info().status !== 200) {
        throw new Error(`Download failed with status ${response.info().status}`);
      }

      const downloadedPath = response.path();
      setDownloadStatus('saving');

      if (canUseCameraRoll) {
        try {
          await CameraRoll.save(`file://${downloadedPath}`, {
            type: mediaType,
            album: 'PostHive',
          });
          setDownloadStatus('success');
          animateSuccess();
          setTimeout(resetDownloadModal, 2500);
        } catch (crErr: unknown) {
          const msg = crErr instanceof Error ? crErr.message : String(crErr);
          if (msg.includes('3302') || (crErr as {code?: number})?.code === 3302) {
            resetDownloadModal();
            await Share.share({url: `file://${downloadedPath}`, title: fileName});
          } else {
            throw crErr;
          }
        }
      } else {
        resetDownloadModal();
        await Share.share({url: `file://${downloadedPath}`, title: fileName});
      }

      setTimeout(async () => {
        try {
          await ReactNativeBlobUtil.fs.unlink(downloadedPath);
        } catch {
          /* ignore */
        }
      }, 5000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Download failed';
      setDownloadStatus('error');
      setDownloadError(message);
      downloadingResourceRef.current = resource;
    } finally {
      setIsDownloading(false);
    }
  }, [
    confirmDownloadResource,
    resetDownloadModal,
    animateSuccess,
    downloadProgressAnim,
  ]);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    );
  }

  if (resources.length === 0) {
    return (
      <View style={styles.center}>
        <File size={48} color={theme.colors.textMuted} />
        <Text style={styles.emptyTitle}>No resources yet</Text>
        <Text style={styles.emptySubtitle}>
          Upload clips and assets from the web app to see them here
        </Text>
      </View>
    );
  }

  const playbackUrl = selectedResource
    ? resolvePlaybackUrl({
        bunny_cdn_url: selectedResource.bunny_cdn_url,
        storage_url: selectedResource.storage_url,
        processing_status: selectedResource.processing_status,
      }) ||
        selectedResource.playback_url ||
        selectedResource.storage_url ||
        selectedResource.bunny_cdn_url ||
        ''
    : '';
  const isVideo =
    selectedResource &&
    (selectedResource.type === 'video' ||
      (selectedResource.mime_type || '').startsWith('video/'));

  const sortLabel =
    sortBy === 'uploaded_at' ? 'Upload date' : sortBy === 'name' ? 'Name' : 'Rating';

  return (
    <View style={styles.container}>
      <View style={styles.sortBar}>
        <TouchableOpacity
          style={styles.sortBtn}
          onPress={() => setShowSortMenu(m => !m)}
          activeOpacity={0.7}>
          <ArrowUpDown size={16} color={theme.colors.textMuted} />
          <Text style={styles.sortBtnText}>Sort: {sortLabel}</Text>
          <ChevronDown size={14} color={theme.colors.textMuted} />
        </TouchableOpacity>
        {showSortMenu && (
          <View style={styles.sortMenu}>
            {(['uploaded_at', 'name', 'rating'] as const).map(opt => (
              <TouchableOpacity
                key={opt}
                style={[styles.sortMenuItem, sortBy === opt && styles.sortMenuItemActive]}
                onPress={() => {
                  setSortBy(opt);
                  setShowSortMenu(false);
                }}>
                <Text
                  style={[
                    styles.sortMenuText,
                    sortBy === opt && styles.sortMenuTextActive,
                  ]}>
                  {opt === 'uploaded_at' ? 'Upload date' : opt === 'name' ? 'Name' : 'Rating'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
      <FlatList
        data={sortedResources}
        keyExtractor={r => r.id}
        numColumns={2}
        contentContainerStyle={styles.list}
        columnWrapperStyle={styles.row}
        renderItem={({item, index}) => (
          <View style={{width: cardSize}}>
            <ResourceCard resource={item} onPress={() => openResource(item, index)} />
          </View>
        )}
      />

      <Modal
        visible={!!selectedResource}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeResource}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={closeResource} style={styles.closeBtn}>
              <X size={24} color={theme.colors.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalHeaderCenter}
              onPress={() => setTopCollapsed(c => !c)}
              activeOpacity={0.7}>
              <Text style={styles.modalTitle} numberOfLines={1}>
                {selectedResource?.display_name || selectedResource?.name}
              </Text>
              {sortedResources.length > 1 && (
                <Text style={styles.modalCounter}>
                  {selectedIndex + 1} / {sortedResources.length}
                </Text>
              )}
            </TouchableOpacity>
            {selectedResource && getDownloadableUrl(selectedResource) && (
              <TouchableOpacity
                onPress={() => handleDownloadRequest(selectedResource)}
                disabled={isDownloading}
                style={styles.downloadBtn}
                hitSlop={{top: 12, bottom: 12, left: 12, right: 12}}>
                {isDownloading ? (
                  <ActivityIndicator size="small" color={theme.colors.accent} />
                ) : (
                  <Download size={22} color={theme.colors.accent} />
                )}
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => setTopCollapsed(c => !c)}
              style={styles.headerChevronBtn}>
              {topCollapsed ? (
                <ChevronDown size={20} color={theme.colors.textMuted} />
              ) : (
                <ChevronUp size={20} color={theme.colors.textMuted} />
              )}
            </TouchableOpacity>
          </View>

          {selectedResource && (
            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              {sortedResources.length > 1 ? (
                <View style={[styles.playerWrap, {width: screenWidth}]}>
                  <ScrollView
                    ref={carouselScrollRef}
                    horizontal
                    pagingEnabled
                    scrollEnabled={true}
                    removeClippedSubviews={false}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{width: sortedResources.length * screenWidth}}
                    onScroll={handleCarouselScroll}
                    onMomentumScrollEnd={handleCarouselScrollEnd}
                    onScrollEndDrag={handleCarouselScrollEnd}
                    scrollEventThrottle={16}
                  >
                    {sortedResources.map((r, idx) => {
                      const isNearby =
                        idx >= selectedIndex - 1 && idx <= selectedIndex + 1;
                      const thumbUrl = resolveAssetThumbnail({
                        type: r.type,
                        mime_type: r.mime_type,
                        bunny_cdn_url: r.bunny_cdn_url,
                        playback_url: r.playback_url,
                        storage_url: r.storage_url,
                      });
                      const url =
                        resolvePlaybackUrl({
                          bunny_cdn_url: r.bunny_cdn_url,
                          storage_url: r.storage_url,
                          processing_status: r.processing_status,
                        }) ||
                        r.playback_url ||
                        r.storage_url ||
                        r.bunny_cdn_url ||
                        '';
                      const isVid =
                        r.type === 'video' || (r.mime_type || '').startsWith('video/');
                      return (
                        <View key={r.id} style={[styles.carouselItem, {width: screenWidth, height: (screenWidth * 9) / 16}]}>
                          {isNearby ? (
                            isVid && url ? (
                              <VideoPlayer
                                source={url}
                                poster={thumbUrl}
                                fillContainer
                                forcePaused={idx !== selectedIndex}
                                onFullscreenChange={(fs) => {
                                  if (!fs) {
                                    requestAnimationFrame(() => {
                                      carouselScrollRef.current?.scrollTo({
                                        x: selectedIndex * screenWidth,
                                        animated: false,
                                      });
                                    });
                                  }
                                }}
                              />
                            ) : (
                              <View style={[styles.nonVideoPlaceholder, styles.nonVideoPlaceholderCarousel]}>
                                <File size={48} color={theme.colors.textMuted} />
                                <Text style={styles.nonVideoText}>
                                  Preview not available
                                </Text>
                              </View>
                            )
                          ) : (
                            <View style={[styles.nonVideoPlaceholder, styles.nonVideoPlaceholderCarousel]}>
                              {isVid ? (
                                <>
                                  {thumbUrl && (
                                    <Image
                                      source={{uri: thumbUrl}}
                                      style={StyleSheet.absoluteFill}
                                      resizeMode="cover"
                                    />
                                  )}
                                  <View style={styles.playOverlay}>
                                    <Play size={32} color="#fff" fill="#fff" />
                                  </View>
                                </>
                              ) : (
                                <File size={48} color={theme.colors.textMuted} />
                              )}
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </ScrollView>
                </View>
              ) : (
                <View style={styles.playerWrap}>
                  {isVideo && playbackUrl ? (
                    <VideoPlayer
                      source={playbackUrl}
                      poster={resolveAssetThumbnail({
                        type: selectedResource.type,
                        mime_type: selectedResource.mime_type,
                        bunny_cdn_url: selectedResource.bunny_cdn_url,
                        playback_url: selectedResource.playback_url,
                        storage_url: selectedResource.storage_url,
                      })}
                      fillContainer
                    />
                  ) : (
                    <View style={styles.nonVideoPlaceholder}>
                      <File size={48} color={theme.colors.textMuted} />
                      <Text style={styles.nonVideoText}>
                        Preview not available for this file type
                      </Text>
                    </View>
                  )}
                </View>
              )}
              {sortedResources.length > 1 && (
                <View style={styles.swipeHintRow}>
                  {selectedIndex > 0 && (
                    <View style={styles.swipeHintChip}>
                      <ChevronLeft size={14} color={theme.colors.textMuted} />
                      <Text style={styles.swipeHintText}>Swipe right for previous</Text>
                    </View>
                  )}
                  {selectedIndex < resources.length - 1 && (
                    <View style={styles.swipeHintChip}>
                      <Text style={styles.swipeHintText}>Swipe left for next</Text>
                      <ChevronRight size={14} color={theme.colors.textMuted} />
                    </View>
                  )}
                </View>
              )}

              {!topCollapsed && (
              <View style={styles.metaSection}>
                <Text style={styles.sectionTitle}>Tags</Text>
                <View style={styles.tagsChipRow}>
                  {editTagsArray.map(tag => (
                    <TouchableOpacity
                      key={tag}
                      style={styles.tagChipEditable}
                      onPress={() => removeTag(tag)}
                    >
                      <Text style={styles.tagChipEditableText}>{tag}</Text>
                      <X size={12} color={theme.colors.textMuted} />
                    </TouchableOpacity>
                  ))}
                  <TextInput
                    style={styles.tagInputInline}
                    value={tagInputValue}
                    onChangeText={setTagInputValue}
                    placeholder="Type and press return"
                    placeholderTextColor={theme.colors.textMuted}
                    onSubmitEditing={addTag}
                    returnKeyType="done"
                    autoCorrect={false}
                    blurOnSubmit={false}
                  />
                </View>

                <Text style={[styles.sectionTitle, {marginTop: theme.spacing.lg}]}>
                  Rating
                </Text>
                <View style={styles.ratingRow}>
                  {[1, 2, 3, 4, 5].map(n => (
                    <TouchableOpacity
                      key={n}
                      onPress={() => handleRatingChange(n)}
                      style={styles.starBtn}>
                      <Star
                        size={28}
                        color={n <= (editRating || 0) ? '#FFD700' : theme.colors.textMuted}
                        fill={n <= (editRating || 0) ? '#FFD700' : 'transparent'}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              )}
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* Confirm download modal */}
      <Modal
        visible={!!confirmDownloadResource}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmDownloadResource(null)}>
        <View style={downloadModalStyles.overlay}>
          <View style={downloadModalStyles.container}>
            <View style={downloadModalStyles.iconContainer}>
              <View style={downloadModalStyles.downloadIcon}>
                {confirmDownloadResource &&
                (confirmDownloadResource.type === 'video' ||
                  (confirmDownloadResource.mime_type || '').startsWith('video/')) ? (
                  <FileVideo size={32} color={theme.colors.accent} />
                ) : (
                  <FileImage size={32} color={theme.colors.accent} />
                )}
              </View>
            </View>
            <Text style={downloadModalStyles.title}>Save to Camera Roll</Text>
            <Text style={downloadModalStyles.subtitle} numberOfLines={2}>
              {confirmDownloadResource?.display_name || confirmDownloadResource?.name || ''}
            </Text>
            <Text style={downloadModalStyles.sizeText}>
              Size: {confirmDownloadResource ? formatFileSize(confirmDownloadResource.file_size) : '--'}
            </Text>
            <View style={downloadModalStyles.confirmButtons}>
              <TouchableOpacity
                style={downloadModalStyles.cancelButton}
                onPress={() => setConfirmDownloadResource(null)}>
                <Text style={downloadModalStyles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={downloadModalStyles.confirmButton}
                onPress={() => void handleDownloadConfirm()}>
                <Download size={18} color="#fff" />
                <Text style={downloadModalStyles.confirmButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Download progress modal */}
      <Modal
        visible={showDownloadModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (downloadStatus !== 'downloading' && downloadStatus !== 'saving') {
            resetDownloadModal();
          }
        }}>
        <View style={downloadModalStyles.overlay}>
          <View style={downloadModalStyles.container}>
            <View style={downloadModalStyles.iconContainer}>
              {downloadStatus === 'success' ? (
                <Animated.View style={{transform: [{scale: successScaleAnim}]}}>
                  <View style={downloadModalStyles.successIcon}>
                    <Check size={32} color={theme.colors.success} strokeWidth={3} />
                  </View>
                </Animated.View>
              ) : downloadStatus === 'error' ? (
                <View style={downloadModalStyles.errorIcon}>
                  <X size={32} color={theme.colors.error} strokeWidth={3} />
                </View>
              ) : (
                <View style={downloadModalStyles.downloadIcon}>
                  <Download size={32} color={theme.colors.accent} />
                </View>
              )}
            </View>
            <Text style={downloadModalStyles.title}>
              {downloadStatus === 'downloading' && 'Downloading'}
              {downloadStatus === 'saving' && 'Saving to Camera Roll'}
              {downloadStatus === 'success' && 'Saved!'}
              {downloadStatus === 'error' && 'Download Failed'}
            </Text>
            {(downloadStatus === 'downloading' || downloadStatus === 'saving') && (
              <View style={downloadModalStyles.progressContainer}>
                <View style={downloadModalStyles.progressTrack}>
                  <Animated.View
                    style={[
                      downloadModalStyles.progressFill,
                      {
                        width: downloadProgressAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0%', '100%'],
                        }),
                      },
                    ]}
                  />
                </View>
                <Text style={downloadModalStyles.progressText}>
                  {downloadStatus === 'saving'
                    ? 'Saving...'
                    : `${formatFileSize(downloadedBytes)} / ${formatFileSize(downloadSize || 0)}`}
                </Text>
              </View>
            )}
            {downloadStatus === 'success' && (
              <Text style={downloadModalStyles.successText}>
                Check the "PostHive" album in Photos
              </Text>
            )}
            {downloadStatus === 'error' && (
              <>
                <Text style={downloadModalStyles.errorText}>
                  {downloadError || 'Something went wrong'}
                </Text>
                <TouchableOpacity
                  style={downloadModalStyles.retryButton}
                  onPress={() => {
                    const resource = downloadingResourceRef.current;
                    resetDownloadModal();
                    if (resource) void handleDownloadConfirm(resource);
                  }}>
                  <Text style={downloadModalStyles.retryButtonText}>Try Again</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={downloadModalStyles.dismissButton}
                  onPress={resetDownloadModal}>
                  <Text style={downloadModalStyles.dismissButtonText}>Dismiss</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
  },
  emptyTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.textPrimary,
    marginTop: theme.spacing.md,
  },
  emptySubtitle: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
  },
  sortBar: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.surfaceBorder,
  },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  sortBtnText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textMuted,
  },
  sortMenu: {
    marginTop: theme.spacing.sm,
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
  },
  sortMenuItem: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  sortMenuItemActive: {
    backgroundColor: theme.colors.surface,
  },
  sortMenuText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textPrimary,
  },
  sortMenuTextActive: {
    fontFamily: theme.typography.fontFamily.semibold,
    color: theme.colors.accent,
  },
  list: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  row: {
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  card: {
    width: '100%',
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
  },
  cardThumb: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#111',
  },
  cardPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  ratingBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 2,
  },
  ratingText: {
    color: '#FFD700',
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.semibold,
  },
  cardTitle: {
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.textPrimary,
    padding: theme.spacing.sm,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    paddingHorizontal: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
  },
  tagChip: {
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    maxWidth: 60,
  },
  tagChipText: {
    fontSize: 10,
    color: theme.colors.textMuted,
  },
  modal: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.surfaceBorder,
  },
  closeBtn: {
    padding: theme.spacing.sm,
    marginRight: theme.spacing.sm,
  },
  modalHeaderCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  modalTitle: {
    flex: 1,
    fontSize: theme.typography.fontSize.lg,
    fontFamily: theme.typography.fontFamily.semibold,
    color: theme.colors.textPrimary,
  },
  modalCounter: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textMuted,
  },
  headerChevronBtn: {
    padding: theme.spacing.sm,
  },
  downloadBtn: {
    padding: theme.spacing.sm,
    marginRight: theme.spacing.xs,
  },
  modalContent: {
    flex: 1,
  },
  playerWrap: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
  },
  nonVideoPlaceholder: {
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
  },
  nonVideoPlaceholderCarousel: {
    flex: 1,
    height: undefined,
  },
  nonVideoText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.sm,
  },
  swipeHint: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
  },
  swipeHintRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    alignItems: 'center',
  },
  swipeHintChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
  },
  swipeHintText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.textMuted,
  },
  metaSection: {
    padding: theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.semibold,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.sm,
  },
  tagsChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: theme.spacing.sm,
    minHeight: 44,
  },
  tagChipEditable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
  },
  tagChipEditableText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textPrimary,
  },
  tagInputInline: {
    flex: 1,
    minWidth: 120,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSize.md,
  },
  carouselItem: {
    backgroundColor: '#000',
  },
  ratingRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    alignItems: 'center',
  },
  starBtn: {
    padding: 4,
  },
});

const downloadModalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  container: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xl,
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
  },
  iconContainer: {
    marginBottom: theme.spacing.lg,
  },
  downloadIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.colors.accent + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.colors.successBackground,
    borderWidth: 2,
    borderColor: theme.colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.colors.error + '20',
    borderWidth: 2,
    borderColor: theme.colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: theme.typography.fontSize.lg,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  sizeText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.lg,
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    width: '100%',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: theme.typography.fontSize.md,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.textSecondary,
  },
  confirmButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.accent,
  },
  confirmButtonText: {
    fontSize: theme.typography.fontSize.md,
    fontFamily: theme.typography.fontFamily.semibold,
    color: theme.colors.textInverse,
  },
  progressContainer: {
    width: '100%',
    marginBottom: theme.spacing.md,
  },
  progressTrack: {
    height: 6,
    backgroundColor: theme.colors.surfaceBorder,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: theme.spacing.sm,
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.accent,
    borderRadius: 3,
  },
  progressText: {
    fontSize: theme.typography.fontSize.xs,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  successText: {
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
  },
  errorText: {
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.error,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  retryButton: {
    backgroundColor: theme.colors.accent,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
    width: '100%',
    alignItems: 'center',
  },
  retryButtonText: {
    fontSize: theme.typography.fontSize.md,
    fontFamily: theme.typography.fontFamily.semibold,
    color: theme.colors.textInverse,
  },
  dismissButton: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xl,
  },
  dismissButtonText: {
    fontSize: theme.typography.fontSize.md,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.textMuted,
  },
});
