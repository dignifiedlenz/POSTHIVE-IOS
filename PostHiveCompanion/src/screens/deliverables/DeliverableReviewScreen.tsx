import React, {useRef, useState, useCallback, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Share as RNShare,
  Switch,
  Animated,
  Dimensions,
} from 'react-native';
import {Comment} from '../../lib/types';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation, useRoute, RouteProp, useFocusEffect} from '@react-navigation/native';
import {Send, Clock, Share, Copy, Lock, X, Check, Download, CheckCircle, Circle, FileVideo, FileImage} from 'lucide-react-native';
import {theme} from '../../theme';
import {useAuth} from '../../hooks/useAuth';
import {useDeliverableDetail} from '../../hooks/useDeliverables';
import {VideoPlayer, VideoPlayerRef} from '../../components/VideoPlayer';
import {
  AudioPlayerWithWaveform,
  AudioPlayerWithWaveformRef,
} from '../../components/AudioPlayerWithWaveform';
import {CommentItem} from '../../components/CommentItem';
import {ReviewStackParamList} from '../../app/App';
import {formatVideoTimestamp} from '../../lib/utils';
import {createClientReviewShareLink, getDeliverableGalleryImages, markDeliverableCommentsAsRead, markDeliverableAsFinal, unmarkDeliverableAsFinal} from '../../lib/api';
import {CameraRoll} from '@react-native-camera-roll/camera-roll';
import ReactNativeBlobUtil from 'react-native-blob-util';
import {PhotoGallery, Photo, PhotoGrid} from '../../components/PhotoGallery';
import {BrandedLoadingScreen} from '../../components/BrandedLoadingScreen';
import {useTabBar} from '../../contexts/TabBarContext';

// Supported file extensions for Camera Roll
const SUPPORTED_VIDEO_EXTENSIONS = ['mp4', 'mov', 'm4v', 'mp4v', '3gp'];
const SUPPORTED_PHOTO_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'heic', 'heif', 'tiff', 'tif', 'bmp'];

function getFileExtension(url: string): string {
  const urlPath = url.split('?')[0];
  return urlPath.split('.').pop()?.toLowerCase() || '';
}

function isSupportedForCameraRoll(url: string, deliverableType: string): {supported: boolean; mediaType: 'photo' | 'video'} {
  const extension = getFileExtension(url);
  
  if (SUPPORTED_VIDEO_EXTENSIONS.includes(extension)) {
    return {supported: true, mediaType: 'video'};
  }
  if (SUPPORTED_PHOTO_EXTENSIONS.includes(extension)) {
    return {supported: true, mediaType: 'photo'};
  }
  
  // Fallback to deliverable type if extension not recognized
  if (deliverableType === 'video') {
    return {supported: true, mediaType: 'video'};
  }
  if (deliverableType === 'image') {
    return {supported: true, mediaType: 'photo'};
  }
  
  return {supported: false, mediaType: 'video'};
}

type RouteParams = RouteProp<ReviewStackParamList, 'DeliverableReview'>;

export function DeliverableReviewScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteParams>();
  const {deliverableId, versionId, commentId} = route.params;
  const {user} = useAuth();

  const videoRef = useRef<VideoPlayerRef>(null);
  const audioRef = useRef<AudioPlayerWithWaveformRef>(null);
  const commentsListRef = useRef<FlatList<Comment>>(null);
  const [commentText, setCommentText] = useState('');
  const [currentVideoTime, setCurrentVideoTime] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [highlightedCommentId, setHighlightedCommentId] = useState<string | null>(commentId || null);
  
  // Share modal state
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [sharePassword, setSharePassword] = useState('');
  const [shareExpiresInDays, setShareExpiresInDays] = useState(30);
  const [allowDownloads, setAllowDownloads] = useState(true);
  const [isCreatingShare, setIsCreatingShare] = useState(false);
  const [shareCreated, setShareCreated] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  
  // Gallery state
  const [galleryPhotos, setGalleryPhotos] = useState<Photo[]>([]);
  const [isLoadingGallery, setIsLoadingGallery] = useState(false);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  // Track video fullscreen state
  const [isVideoFullscreen, setIsVideoFullscreen] = useState(false);
  
  // Action menu state
  const [showActionMenu, setShowActionMenu] = useState(false);
  
  // Comment popup (from video overlay trigger)
  const [showCommentPopup, setShowCommentPopup] = useState(false);
  
  // Tab bar visibility control
  const {showTabBar, hideTabBar} = useTabBar();
  const insets = useSafeAreaInsets();

  // Handle video fullscreen changes - just track state, tab bar stays hidden on this screen
  const handleFullscreenChange = useCallback((fullscreen: boolean) => {
    setIsVideoFullscreen(fullscreen);
  }, []);

  // Hide tab bar when entering review screen, restore when leaving
  useFocusEffect(
    useCallback(() => {
      // Hide tab bar when this screen is focused
      hideTabBar();
      
      return () => {
        // Restore tab bar when leaving
        showTabBar();
      };
    }, [hideTabBar, showTabBar]),
  );

  const {
    deliverable,
    versions,
    comments,
    selectedVersion,
    setSelectedVersion,
    currentVersion,
    isLoading,
    postComment,
    toggleComplete,
    removeComment,
    refresh: refreshDeliverable,
  } = useDeliverableDetail({
    deliverableId,
    userId: user?.id || '',
    initialVersionId: versionId,
  });

  // Mark comments as read when version changes (skip for galleries)
  useEffect(() => {
    if (deliverable?.type === 'image_gallery' || !currentVersion || isLoading) {
      console.log(`[DeliverableReview] Skipping mark as read - currentVersion: ${!!currentVersion}, isLoading: ${isLoading}`);
      return;
    }
    
    console.log(`[DeliverableReview] Setting up mark as read for deliverableId: ${deliverableId}, versionId: ${currentVersion.id}, versionNumber: ${currentVersion.version_number}`);
    
    const markCommentsAsRead = async () => {
      console.log(`[DeliverableReview] Starting markCommentsAsRead - deliverableId: ${deliverableId}, versionId: ${currentVersion.id}`);
      try {
        await markDeliverableCommentsAsRead(deliverableId, currentVersion.id, true);
        console.log('[DeliverableReview] ✅ SUCCESS - Marked comments as read for version:', currentVersion.version_number);
      } catch (error: any) {
        console.error('[DeliverableReview] ❌ ERROR marking comments as read:', error);
        console.error('[DeliverableReview] Error details:', {
          message: error?.message,
          stack: error?.stack,
          deliverableId,
          versionId: currentVersion.id,
        });
        // Don't throw - this is a background operation
      }
    };
    
    // Small delay to ensure version is fully loaded
    const timer = setTimeout(() => {
      console.log(`[DeliverableReview] Timer fired, calling markCommentsAsRead`);
      markCommentsAsRead();
    }, 300);
    
    return () => {
      console.log(`[DeliverableReview] Cleaning up mark as read timer`);
      clearTimeout(timer);
    };
  }, [deliverableId, currentVersion?.id, isLoading]);

  // Load gallery images when deliverable is image_gallery
  useEffect(() => {
    const loadGalleryImages = async () => {
      if (deliverable?.type !== 'image_gallery') {
        setGalleryPhotos([]);
        return;
      }

      const versionNumber = currentVersion?.version_number ?? deliverable.current_version ?? 0;
      console.log('[Gallery Debug] Loading images', {
        deliverableId,
        versionNumber,
        currentVersionNumber: currentVersion?.version_number,
        deliverableCurrentVersion: deliverable.current_version,
      });
      setIsLoadingGallery(true);
      try {
        const photos = await getDeliverableGalleryImages(
          deliverableId,
          versionNumber,
        );
        console.log('[Gallery Debug] Loaded images', {
          count: photos.length,
          sample: photos[0]?.id || null,
        });
        setGalleryPhotos(photos);
      } catch (error) {
        console.error('Error loading gallery images:', error);
        setGalleryPhotos([]);
      } finally {
        setIsLoadingGallery(false);
      }
    };

    loadGalleryImages();
  }, [deliverable?.type, deliverable?.current_version, deliverableId, currentVersion?.version_number]);

  const handleTimeUpdate = useCallback((time: number) => {
    setCurrentVideoTime(time);
  }, []);

  const handleTimestampPress = useCallback((timestamp: number) => {
    const mediaRef = deliverable?.type === 'audio' ? audioRef : videoRef;
    mediaRef.current?.seekTo(timestamp);
    mediaRef.current?.play();
  }, [deliverable?.type]);

  const handleSubmitComment = useCallback(async () => {
    if (!commentText.trim()) return;

    setIsSubmitting(true);
    try {
      await postComment(commentText.trim(), currentVideoTime);
      setCommentText('');
    } catch {
      Alert.alert('Error', 'Failed to post comment');
    } finally {
      setIsSubmitting(false);
    }
  }, [commentText, currentVideoTime, postComment]);

  const handleToggleComplete = useCallback(
    async (comment: any) => {
      try {
        await toggleComplete(comment);
      } catch {
        Alert.alert('Error', 'Failed to update comment');
      }
    },
    [toggleComplete],
  );

  const handleDeleteComment = useCallback(
    async (comment: any) => {
      Alert.alert(
        'Delete Comment',
        'Are you sure you want to delete this comment?',
        [
          {text: 'Cancel', style: 'cancel'},
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await removeComment(comment.id);
              } catch {
                Alert.alert('Error', 'Failed to delete comment');
              }
            },
          },
        ],
      );
    },
    [removeComment],
  );

  const handleReplyToComment = useCallback(
    (comment: any) => {
      // Pre-fill reply with @mention and seek to timestamp if available
      const mention = `@${comment.author?.name || 'User'} `;
      setCommentText(mention);
      if (comment.start_time != null) {
        const mediaRef = deliverable?.type === 'audio' ? audioRef : videoRef;
        mediaRef.current?.seekTo(comment.start_time);
      }
    },
    [deliverable?.type],
  );

  const addTimestamp = useCallback(() => {
    const timestamp = formatVideoTimestamp(currentVideoTime);
    setCommentText(prev => (prev ? `${prev} [${timestamp}]` : `[${timestamp}] `));
  }, [currentVideoTime]);

  // Share functionality
  const createShareLink = useCallback(async () => {
    if (!deliverable) return;

    setIsCreatingShare(true);
    try {
      const fallbackVersionNumber = deliverable.current_version ?? 0;
      const versionNumber = (currentVersion?.version_number ?? fallbackVersionNumber) === 100 
        ? 100 
        : (currentVersion?.version_number ?? fallbackVersionNumber);

      const result = await createClientReviewShareLink({
        deliverableId: deliverable.id,
        versionNumber,
        expiresInDays: shareExpiresInDays,
        password: sharePassword || null,
        allowDownloads,
      });

      setShareLink(result.url);
      setShareCreated(true);
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to create share link',
      );
    } finally {
      setIsCreatingShare(false);
    }
  }, [deliverable, currentVersion, shareExpiresInDays, sharePassword, allowDownloads]);

  const copyShareLink = useCallback(async () => {
    if (!shareLink) return;
    
    try {
      // Use native share API (includes copy option on iOS/Android)
      await RNShare.share({
        message: shareLink,
        title: 'Share Review Link',
      });
      // Note: On iOS/Android, the Share API includes a copy option,
      // so users can copy directly from the share sheet
    } catch (error) {
      // Share API not available or user cancelled
      // This is expected behavior - no need to show error
      console.log('Share cancelled or unavailable');
    }
  }, [shareLink]);

  const resetShareModal = useCallback(() => {
    setShowShareModal(false);
    setShareLink(null);
    setSharePassword('');
    setShareExpiresInDays(30);
    setAllowDownloads(true);
    setShareCreated(false);
    setIsCreatingShare(false);
  }, []);

  // File size state
  const [downloadSize, setDownloadSize] = useState<number | null>(null);
  const [isFetchingSize, setIsFetchingSize] = useState(false);
  
  // Download progress modal state
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadedBytes, setDownloadedBytes] = useState(0);
  const [downloadStatus, setDownloadStatus] = useState<'downloading' | 'saving' | 'success' | 'error'>('downloading');
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const downloadProgressAnim = useRef(new Animated.Value(0)).current;
  const successScaleAnim = useRef(new Animated.Value(0)).current;

  // Get downloadable URL - prefer storage URLs (actual files) over streaming URLs
  const getDownloadableUrl = useCallback(() => {
    // Priority: storage_url (B2) > r2_url (Cloudflare R2) > bunny_cdn_url > file_url
    // storage_url and r2_url are the actual video files
    // bunny_cdn_url and file_url might be HLS streaming URLs
    
    // First try storage URLs (these are the actual files)
    if (currentVersion?.storage_url) {
      return currentVersion.storage_url;
    }
    if (currentVersion?.r2_url) {
      return currentVersion.r2_url;
    }
    
    // Fall back to CDN/file URLs only if they're not HLS
    const fallbackUrl = currentVersion?.bunny_cdn_url || currentVersion?.file_url;
    if (fallbackUrl && !fallbackUrl.includes('.m3u8') && !fallbackUrl.includes('playlist')) {
      return fallbackUrl;
    }
    
    return null;
  }, [currentVersion?.storage_url, currentVersion?.r2_url, currentVersion?.bunny_cdn_url, currentVersion?.file_url]);

  // Fetch file size when version changes
  useEffect(() => {
    const fetchFileSize = async () => {
      const url = getDownloadableUrl();
      if (!url) {
        setDownloadSize(null);
        return;
      }
      
      setIsFetchingSize(true);
      try {
        const response = await fetch(url, {method: 'HEAD'});
        const contentLength = response.headers.get('content-length');
        if (contentLength) {
          setDownloadSize(parseInt(contentLength, 10));
        } else {
          setDownloadSize(null);
        }
      } catch (error) {
        console.log('Could not fetch file size:', error);
        setDownloadSize(null);
      } finally {
        setIsFetchingSize(false);
      }
    };
    
    fetchFileSize();
  }, [getDownloadableUrl]);

  // Format file size for display
  const formatFileSize = useCallback((bytes: number | null): string => {
    if (bytes === null) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }, []);

  // Check if current file can be saved to camera roll
  const canSaveToCameraRoll = useCallback(() => {
    const url = getDownloadableUrl();
    if (!url) return false;
    const deliverableType = deliverable?.type || 'video';
    const {supported} = isSupportedForCameraRoll(url, deliverableType);
    return supported;
  }, [getDownloadableUrl, deliverable?.type]);

  // Get the appropriate button text with size
  const getDownloadButtonText = useCallback(() => {
    if (isDownloading) return 'Saving...';
    if (!getDownloadableUrl()) return 'Stream Only';
    
    const sizeText = downloadSize ? ` (${formatFileSize(downloadSize)})` : '';
    const actionText = canSaveToCameraRoll() ? 'Save to Camera Roll' : 'Save to Files';
    return `${actionText}${sizeText}`;
  }, [isDownloading, canSaveToCameraRoll, getDownloadableUrl, downloadSize, formatFileSize]);

  // Reset download modal
  const resetDownloadModal = useCallback(() => {
    setShowDownloadModal(false);
    setDownloadProgress(0);
    setDownloadedBytes(0);
    setDownloadStatus('downloading');
    setDownloadError(null);
    downloadProgressAnim.setValue(0);
    successScaleAnim.setValue(0);
  }, [downloadProgressAnim, successScaleAnim]);

  // Animate success
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

  // Download functionality
  const handleDownload = useCallback(async () => {
    const downloadableUrl = getDownloadableUrl();
    
    if (!downloadableUrl) {
      Alert.alert(
        'Cannot Download',
        'This video is only available for streaming and cannot be downloaded directly.',
      );
      return;
    }
    
    if (isDownloading) return;

    // Reset and show modal
    resetDownloadModal();
    setShowDownloadModal(true);
    setIsDownloading(true);
    
    let tempFilePath: string | null = null;
    
    try {
      const fileUrl = downloadableUrl;
      const deliverableName = deliverable?.name || 'deliverable';
      const versionNumber = currentVersion?.version_number === 100 
        ? 'Final' 
        : `V${currentVersion?.version_number || 1}`;
      
      // Determine media type and if camera roll is supported
      const deliverableType = deliverable?.type || 'video';
      const {supported: canUseCameraRoll, mediaType} = isSupportedForCameraRoll(fileUrl, deliverableType);
      
      // Extract file extension from URL
      const extension = getFileExtension(fileUrl) || (mediaType === 'video' ? 'mp4' : 'jpg');
      
      const sanitizedName = deliverableName.replace(/[^a-zA-Z0-9-_]/g, '_');
      const fileName = `PostHive_${sanitizedName}_${versionNumber}.${extension}`;
      tempFilePath = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/${fileName}`;
      
      // Download with progress tracking
      const response = await ReactNativeBlobUtil.config({
        fileCache: true,
        path: tempFilePath,
        followRedirect: true,
      })
        .fetch('GET', fileUrl)
        .progress({interval: 100}, (received, total) => {
          const progress = total > 0 ? received / total : 0;
          setDownloadProgress(progress);
          setDownloadedBytes(received);
          
          // Animate progress bar
          Animated.timing(downloadProgressAnim, {
            toValue: progress,
            duration: 100,
            useNativeDriver: false,
          }).start();
        });
      
      const status = response.info().status;
      
      if (status !== 200) {
        throw new Error(`Download failed with status ${status}`);
      }
      
      const downloadedPath = response.path();
      
      // Update status to saving
      setDownloadStatus('saving');
      
      if (canUseCameraRoll) {
        // Save the downloaded file to camera roll
        try {
          await CameraRoll.save(`file://${downloadedPath}`, {
            type: mediaType,
            album: 'PostHive',
          });

          // Show success
          setDownloadStatus('success');
          animateSuccess();
          
          // Auto-close after delay
          setTimeout(() => {
            resetDownloadModal();
          }, 2500);
        } catch (cameraRollError: any) {
          // If camera roll fails (e.g., unsupported format), fall back to share sheet
          console.log('Camera Roll save failed, falling back to share sheet:', cameraRollError);
          
          if (cameraRollError?.message?.includes('3302') || cameraRollError?.code === 3302) {
            resetDownloadModal();
            await RNShare.share({
              url: `file://${downloadedPath}`,
              title: fileName,
            });
          } else {
            throw cameraRollError;
          }
        }
      } else {
        // For unsupported formats, use the share sheet
        resetDownloadModal();
        await RNShare.share({
          url: `file://${downloadedPath}`,
          title: fileName,
        });
      }
      
      // Clean up temp file after a delay
      setTimeout(async () => {
        try {
          await ReactNativeBlobUtil.fs.unlink(downloadedPath);
        } catch (cleanupError) {
          console.log('Cleanup error (non-critical):', cleanupError);
        }
      }, 5000);
    } catch (error) {
      console.error('Download error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to download file';
      
      if (errorMessage.includes('cancelled') || errorMessage.includes('canceled')) {
        // User cancelled - just close modal
        resetDownloadModal();
      } else {
        setDownloadStatus('error');
        setDownloadError(errorMessage);
      }
      
      // Clean up temp file on error
      if (tempFilePath) {
        try {
          await ReactNativeBlobUtil.fs.unlink(tempFilePath);
        } catch (cleanupError) {
          // Ignore cleanup errors
        }
      }
    } finally {
      setIsDownloading(false);
    }
  }, [currentVersion, deliverable, isDownloading, getDownloadableUrl, resetDownloadModal, animateSuccess, downloadProgressAnim]);

  // Finalization functionality
  const isFinalVersion = currentVersion?.version_number === 100 || deliverable?.current_version === 100;
  
  const handleFinalize = useCallback(async () => {
    if (!deliverable || isFinalizing) return;

    // Confirm finalization
    Alert.alert(
      'Mark as Final',
      `Are you sure you want to mark "${deliverable.name}" as final? This will create a FINAL version from the current version.`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Mark as Final',
          style: 'default',
          onPress: async () => {
            setIsFinalizing(true);
            try {
              await markDeliverableAsFinal(deliverable.id);
              Alert.alert(
                'Success',
                `"${deliverable.name}" has been marked as final.`,
                [{text: 'OK'}],
              );
              // Refresh the deliverable to show the new FINAL version
              await refreshDeliverable();
              // Select the FINAL version (100)
              setSelectedVersion(100);
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Failed to finalize deliverable';
              Alert.alert('Error', errorMessage);
            } finally {
              setIsFinalizing(false);
            }
          },
        },
      ],
    );
  }, [deliverable, isFinalizing, refreshDeliverable, setSelectedVersion]);

  const handleUnfinalize = useCallback(async () => {
    if (!deliverable || isFinalizing) return;

    // Confirm unfinalization
    Alert.alert(
      'Remove Final Status',
      `Are you sure you want to remove the final status from "${deliverable.name}"? This will revert it to the previous version.`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Remove Final',
          style: 'destructive',
          onPress: async () => {
            setIsFinalizing(true);
            try {
              await unmarkDeliverableAsFinal(deliverable.id);
              Alert.alert(
                'Success',
                `"${deliverable.name}" has been reverted from final status.`,
                [{text: 'OK'}],
              );
              // Refresh the deliverable to update versions
              await refreshDeliverable();
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Failed to remove final status';
              Alert.alert('Error', errorMessage);
            } finally {
              setIsFinalizing(false);
            }
          },
        },
      ],
    );
  }, [deliverable, isFinalizing, refreshDeliverable]);

  // Scroll to and highlight the target comment when loading completes
  useEffect(() => {
    if (!isLoading && commentId && comments.length > 0) {
      const commentIndex = comments.findIndex(c => c.id === commentId);
      if (commentIndex !== -1) {
        // Small delay to ensure list is rendered
        setTimeout(() => {
          commentsListRef.current?.scrollToIndex({
            index: commentIndex,
            animated: true,
            viewPosition: 0.3, // Position in upper third of visible area
          });
          // Also seek media to comment timestamp if available
          const comment = comments[commentIndex];
          if (comment.start_time != null) {
            const mediaRef = deliverable?.type === 'audio' ? audioRef : videoRef;
            mediaRef.current?.seekTo(comment.start_time);
          }
        }, 300);
      }
    }
  }, [isLoading, commentId, comments, deliverable?.type]);

  // Clear highlight after animation
  useEffect(() => {
    if (highlightedCommentId) {
      const timer = setTimeout(() => {
        setHighlightedCommentId(null);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [highlightedCommentId]);

  // Handle photo press for gallery - MUST be before any early returns
  const handlePhotoPress = useCallback((index: number) => {
    setPreviewIndex(index);
  }, []);

  const handleClosePreview = useCallback(() => {
    setPreviewIndex(null);
  }, []);

  if (isLoading) {
    return <BrandedLoadingScreen />;
  }

  const videoUrl = currentVersion?.file_url || '';
  const isImageGallery = deliverable?.type === 'image_gallery';

  // Create comment markers for the video timeline
  const commentMarkers = comments
    .filter(c => c.start_time != null)
    .map(c => ({
      id: c.id,
      time: c.start_time!,
    }));

  // Show photo gallery preview modal
  if (previewIndex !== null && isImageGallery) {
    return (
      <PhotoGallery
        photos={galleryPhotos}
        initialIndex={previewIndex}
        onClose={handleClosePreview}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}>
        {/* Image Gallery or Video Player - at the top */}
        {isImageGallery ? (
          <View style={styles.galleryContainer}>
            <View style={styles.galleryHeader}>
              <Text style={styles.galleryTitle} numberOfLines={1}>
                {deliverable?.name || 'Gallery'}
              </Text>
              {galleryPhotos.length > 0 && (
                <Text style={styles.gallerySubtitle}>{galleryPhotos.length} photos</Text>
              )}
            </View>
            <View style={styles.galleryContent}>
              {isLoadingGallery ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={theme.colors.accent} />
                </View>
              ) : galleryPhotos.length > 0 ? (
                <ScrollView
                  contentContainerStyle={styles.galleryScrollContent}
                  showsVerticalScrollIndicator={false}>
                  <PhotoGrid photos={galleryPhotos} onPhotoPress={handlePhotoPress} columns={3} />
                </ScrollView>
              ) : (
                <View style={styles.emptyGallery}>
                  <Text style={styles.emptyGalleryText}>No images in this gallery yet</Text>
                </View>
              )}
            </View>
          </View>
        ) : deliverable?.type === 'audio' ? (
          <AudioPlayerWithWaveform
            ref={audioRef}
            source={videoUrl}
            onTimeUpdate={handleTimeUpdate}
            commentMarkers={commentMarkers}
            onFullscreenChange={handleFullscreenChange}
            title={deliverable?.name}
            onBack={() => navigation.goBack()}
            onMenuPress={() => setShowActionMenu(true)}
            onCommentPress={(time) => {
              setCurrentVideoTime(time);
              setShowCommentPopup(true);
            }}
            commentPopupOverlay={
              showCommentPopup && isVideoFullscreen ? (
                <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
                  <TouchableOpacity
                    style={styles.commentPopupOverlay}
                    activeOpacity={1}
                    onPress={() => setShowCommentPopup(false)}>
                    <KeyboardAvoidingView
                      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                      style={styles.commentPopupKeyboard}>
                      <TouchableOpacity
                        activeOpacity={1}
                        onPress={e => e.stopPropagation()}
                        style={[styles.commentPopupContent, {paddingHorizontal: Math.max(insets.left, insets.right, theme.spacing.md), paddingBottom: Math.max(insets.bottom, theme.spacing.sm)}]}>
                        <View style={styles.commentPopupInputRow}>
                          <TouchableOpacity
                            style={styles.timestampButton}
                            onPress={addTimestamp}>
                            <Clock size={14} color="rgba(255, 255, 255, 0.7)" />
                            <Text style={styles.timestampButtonText}>
                              {formatVideoTimestamp(currentVideoTime)}
                            </Text>
                          </TouchableOpacity>
                          <TextInput
                            style={styles.commentPopupInput}
                            placeholder="Leave feedback..."
                            placeholderTextColor={theme.colors.textMuted}
                            value={commentText}
                            onChangeText={setCommentText}
                            multiline
                            maxLength={1000}
                            autoFocus
                            autoCorrect={false}
                            autoCapitalize="none"
                          />
                          <TouchableOpacity
                            style={[
                              styles.sendButton,
                              (!commentText.trim() || isSubmitting) && styles.sendButtonDisabled,
                            ]}
                            onPress={async () => {
                              await handleSubmitComment();
                              setShowCommentPopup(false);
                            }}
                            disabled={!commentText.trim() || isSubmitting}>
                            {isSubmitting ? (
                              <ActivityIndicator size="small" color={theme.colors.textPrimary} />
                            ) : (
                              <Send
                                size={18}
                                color={commentText.trim() ? theme.colors.textPrimary : theme.colors.textMuted}
                              />
                            )}
                          </TouchableOpacity>
                        </View>
                      </TouchableOpacity>
                    </KeyboardAvoidingView>
                  </TouchableOpacity>
                </View>
              ) : null
            }
            showOverlayHeader
          />
        ) : (
          <VideoPlayer
            ref={videoRef}
            source={videoUrl}
            poster={currentVersion?.thumbnail_url}
            onTimeUpdate={handleTimeUpdate}
            commentMarkers={commentMarkers}
            onFullscreenChange={handleFullscreenChange}
            title={deliverable?.name}
            onBack={() => navigation.goBack()}
            onMenuPress={() => setShowActionMenu(true)}
            onCommentPress={(time) => {
              setCurrentVideoTime(time);
              setShowCommentPopup(true);
            }}
            commentPopupOverlay={
              showCommentPopup && isVideoFullscreen ? (
                <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
                  <TouchableOpacity
                    style={styles.commentPopupOverlay}
                    activeOpacity={1}
                    onPress={() => setShowCommentPopup(false)}>
                    <KeyboardAvoidingView
                      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                      style={styles.commentPopupKeyboard}>
                      <TouchableOpacity
                        activeOpacity={1}
                        onPress={e => e.stopPropagation()}
                        style={[styles.commentPopupContent, {paddingHorizontal: Math.max(insets.left, insets.right, theme.spacing.md), paddingBottom: Math.max(insets.bottom, theme.spacing.sm)}]}>
                        <View style={styles.commentPopupInputRow}>
                          <TouchableOpacity
                            style={styles.timestampButton}
                            onPress={addTimestamp}>
                            <Clock size={14} color="rgba(255, 255, 255, 0.7)" />
                            <Text style={styles.timestampButtonText}>
                              {formatVideoTimestamp(currentVideoTime)}
                            </Text>
                          </TouchableOpacity>
                          <TextInput
                            style={styles.commentPopupInput}
                            placeholder="Leave feedback..."
                            placeholderTextColor={theme.colors.textMuted}
                            value={commentText}
                            onChangeText={setCommentText}
                            multiline
                            maxLength={1000}
                            autoFocus
                            autoCorrect={false}
                            autoCapitalize="none"
                          />
                          <TouchableOpacity
                            style={[
                              styles.sendButton,
                              (!commentText.trim() || isSubmitting) && styles.sendButtonDisabled,
                            ]}
                            onPress={async () => {
                              await handleSubmitComment();
                              setShowCommentPopup(false);
                            }}
                            disabled={!commentText.trim() || isSubmitting}>
                            {isSubmitting ? (
                              <ActivityIndicator size="small" color={theme.colors.textPrimary} />
                            ) : (
                              <Send
                                size={18}
                                color={commentText.trim() ? theme.colors.textPrimary : theme.colors.textMuted}
                              />
                            )}
                          </TouchableOpacity>
                        </View>
                      </TouchableOpacity>
                    </KeyboardAvoidingView>
                  </TouchableOpacity>
                </View>
              ) : null
            }
            showOverlayHeader
          />
        )}

        {/* Version Selector */}
        {!isImageGallery && versions.length >= 1 && (
          <View style={styles.versionSelector}>
            {[...versions]
              .filter(v => v.version_number < 100) // Show regular versions
              .sort((a, b) => a.version_number - b.version_number)
              .map(v => {
                const label = `V${v.version_number}`;
                return (
                  <TouchableOpacity
                    key={v.id}
                    style={[
                      styles.versionButton,
                      selectedVersion === v.version_number &&
                        styles.versionButtonActive,
                    ]}
                    onPress={() => setSelectedVersion(v.version_number)}>
                    <Text
                      style={[
                        styles.versionText,
                        selectedVersion === v.version_number &&
                          styles.versionTextActive,
                      ]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            
            {/* Final Version Button - either select existing or create new */}
            {(() => {
              const hasFinalVersion = versions.some(v => v.version_number === 100);
              
              if (hasFinalVersion) {
                // Show selectable Final tab
                return (
                  <TouchableOpacity
                    style={[
                      styles.versionButton,
                      styles.versionButtonFinal,
                      selectedVersion === 100 && styles.versionButtonActive,
                    ]}
                    onPress={() => setSelectedVersion(100)}>
                    <CheckCircle size={12} color={selectedVersion === 100 ? theme.colors.textPrimary : theme.colors.success} style={{marginRight: 4}} />
                    <Text
                      style={[
                        styles.versionText,
                        styles.versionTextFinal,
                        selectedVersion === 100 && styles.versionTextActive,
                      ]}>
                      Final
                    </Text>
                  </TouchableOpacity>
                );
              } else {
                // Show "Mark Final" button to create final version
                return (
                  <TouchableOpacity
                    style={[
                      styles.versionButton,
                      styles.versionButtonMarkFinal,
                    ]}
                    onPress={handleFinalize}
                    disabled={isFinalizing}>
                    {isFinalizing ? (
                      <ActivityIndicator size="small" color={theme.colors.success} />
                    ) : (
                      <>
                        <Circle size={12} color={theme.colors.textMuted} style={{marginRight: 4}} />
                        <Text style={[styles.versionText, styles.versionTextMarkFinal]}>
                          Final
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                );
              }
            })()}
          </View>
        )}

        {/* Comments List */}
        {!isImageGallery && (
          <FlatList
            ref={commentsListRef}
            data={comments}
            keyExtractor={item => item.id}
            renderItem={({item, index}) => (
              <CommentItem
                comment={item}
                currentUserId={user?.id}
                onTimestampPress={handleTimestampPress}
                onToggleComplete={() => handleToggleComplete(item)}
                onReply={() => handleReplyToComment(item)}
                onDelete={() => handleDeleteComment(item)}
                isLast={index === comments.length - 1}
                isHighlighted={item.id === highlightedCommentId}
              />
            )}
            contentContainerStyle={styles.commentsList}
            ListEmptyComponent={
              <View style={styles.emptyComments}>
                <Text style={styles.emptyCommentsText}>
                  No comments yet. Be the first to add feedback!
                </Text>
              </View>
            }
            showsVerticalScrollIndicator={false}
            onScrollToIndexFailed={(info) => {
              // Handle scroll failure by scrolling to offset
              setTimeout(() => {
                commentsListRef.current?.scrollToOffset({
                  offset: info.averageItemLength * info.index,
                  animated: true,
                });
              }, 100);
            }}
          />
        )}

        {/* Comment Input */}
        {!isImageGallery && (
          <View style={styles.commentInputContainer}>
            <TouchableOpacity
              style={styles.timestampButton}
              onPress={addTimestamp}>
              <Clock size={14} color="rgba(255, 255, 255, 0.7)" />
              <Text style={styles.timestampButtonText}>
                {formatVideoTimestamp(currentVideoTime)}
              </Text>
            </TouchableOpacity>
            <TextInput
              style={styles.commentInput}
              placeholder="Leave feedback..."
              placeholderTextColor={theme.colors.textMuted}
              value={commentText}
              onChangeText={setCommentText}
              multiline
              maxLength={1000}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                (!commentText.trim() || isSubmitting) && styles.sendButtonDisabled,
              ]}
              onPress={handleSubmitComment}
              disabled={!commentText.trim() || isSubmitting}>
              {isSubmitting ? (
                <ActivityIndicator size="small" color={theme.colors.textPrimary} />
              ) : (
                <Send 
                  size={18} 
                  color={commentText.trim() ? theme.colors.textPrimary : theme.colors.textMuted} 
                />
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Action Menu */}
        <Modal
          visible={showActionMenu}
          transparent
          animationType="fade"
          onRequestClose={() => setShowActionMenu(false)}>
          <TouchableOpacity
            style={styles.actionMenuOverlay}
            activeOpacity={1}
            onPress={() => setShowActionMenu(false)}>
            <View style={styles.actionMenuContainer}>
              <TouchableOpacity
                style={styles.actionMenuItem}
                onPress={() => {
                  setShowActionMenu(false);
                  handleDownload();
                }}
                disabled={isDownloading || !currentVersion?.file_url}>
                <Download size={20} color={theme.colors.textPrimary} />
                <Text style={styles.actionMenuText}>
                  {getDownloadButtonText()}
                </Text>
              </TouchableOpacity>
              <View style={styles.actionMenuDivider} />
              {/* Mark as Final / Remove Final */}
              {!isFinalVersion ? (
                <TouchableOpacity
                  style={styles.actionMenuItem}
                  onPress={() => {
                    setShowActionMenu(false);
                    handleFinalize();
                  }}
                  disabled={isFinalizing || !currentVersion}>
                  <CheckCircle size={20} color={theme.colors.success} />
                  <Text style={styles.actionMenuText}>
                    {isFinalizing ? 'Finalizing...' : 'Mark as Final'}
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.actionMenuItem}
                  onPress={() => {
                    setShowActionMenu(false);
                    handleUnfinalize();
                  }}
                  disabled={isFinalizing}>
                  <Circle size={20} color={theme.colors.warning} />
                  <Text style={styles.actionMenuText}>
                    {isFinalizing ? 'Reverting...' : 'Remove Final Status'}
                  </Text>
                </TouchableOpacity>
              )}
              <View style={styles.actionMenuDivider} />
              <TouchableOpacity
                style={styles.actionMenuItem}
                onPress={() => {
                  setShowActionMenu(false);
                  setShowShareModal(true);
                }}>
                <Share size={20} color={theme.colors.textPrimary} />
                <Text style={styles.actionMenuText}>Share with Client</Text>
              </TouchableOpacity>
              <View style={styles.actionMenuDivider} />
              <TouchableOpacity
                style={[styles.actionMenuItem, styles.actionMenuCancel]}
                onPress={() => setShowActionMenu(false)}>
                <Text style={styles.actionMenuCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Comment popup - triggered from video overlay (Modal only when NOT fullscreen; fullscreen uses overlay inside VideoPlayer) */}
        <Modal
          visible={showCommentPopup && !isVideoFullscreen}
          transparent
          animationType="slide"
          onRequestClose={() => setShowCommentPopup(false)}>
          <TouchableOpacity
            style={styles.commentPopupOverlay}
            activeOpacity={1}
            onPress={() => setShowCommentPopup(false)}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={styles.commentPopupKeyboard}>
              <TouchableOpacity
                activeOpacity={1}
                onPress={e => e.stopPropagation()}
                style={[styles.commentPopupContent, {paddingHorizontal: Math.max(insets.left, insets.right, theme.spacing.md), paddingBottom: Math.max(insets.bottom, theme.spacing.sm)}]}>
              <View style={styles.commentPopupInputRow}>
                <TouchableOpacity
                  style={styles.timestampButton}
                  onPress={addTimestamp}>
                  <Clock size={14} color="rgba(255, 255, 255, 0.7)" />
                  <Text style={styles.timestampButtonText}>
                    {formatVideoTimestamp(currentVideoTime)}
                  </Text>
                </TouchableOpacity>
                <TextInput
                  style={styles.commentPopupInput}
                  placeholder="Leave feedback..."
                  placeholderTextColor={theme.colors.textMuted}
                  value={commentText}
                  onChangeText={setCommentText}
                  multiline
                  maxLength={1000}
                  autoFocus
                  autoCorrect={false}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={[
                    styles.sendButton,
                    (!commentText.trim() || isSubmitting) && styles.sendButtonDisabled,
                  ]}
                  onPress={async () => {
                    await handleSubmitComment();
                    setShowCommentPopup(false);
                  }}
                  disabled={!commentText.trim() || isSubmitting}>
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color={theme.colors.textPrimary} />
                  ) : (
                    <Send
                      size={18}
                      color={commentText.trim() ? theme.colors.textPrimary : theme.colors.textMuted}
                    />
                  )}
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
            </KeyboardAvoidingView>
          </TouchableOpacity>
        </Modal>

        {/* Share Modal */}
        <ShareModal
          visible={showShareModal}
          deliverableName={deliverable?.name || 'Deliverable'}
          versionNumber={currentVersion?.version_number || 1}
          shareLink={shareLink}
          sharePassword={sharePassword}
          setSharePassword={setSharePassword}
          shareExpiresInDays={shareExpiresInDays}
          setShareExpiresInDays={setShareExpiresInDays}
          allowDownloads={allowDownloads}
          setAllowDownloads={setAllowDownloads}
          isCreatingShare={isCreatingShare}
          shareCreated={shareCreated}
          onCreateShare={createShareLink}
          onCopyLink={copyShareLink}
          onClose={resetShareModal}
        />

        {/* Download Progress Modal */}
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
              {/* Icon */}
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
                    {(deliverable?.type === 'video' || deliverable?.type === undefined) ? (
                      <FileVideo size={32} color={theme.colors.accent} />
                    ) : (
                      <FileImage size={32} color={theme.colors.accent} />
                    )}
                  </View>
                )}
              </View>

              {/* Title */}
              <Text style={downloadModalStyles.title}>
                {downloadStatus === 'downloading' && 'Downloading'}
                {downloadStatus === 'saving' && 'Saving to Camera Roll'}
                {downloadStatus === 'success' && 'Saved!'}
                {downloadStatus === 'error' && 'Download Failed'}
              </Text>

              {/* Subtitle / File name */}
              <Text style={downloadModalStyles.subtitle} numberOfLines={1}>
                {deliverable?.name || 'File'}
                {currentVersion?.version_number === 100 ? ' (Final)' : ` V${currentVersion?.version_number || 1}`}
              </Text>

              {/* Progress bar (only during download) */}
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
                      : `${formatFileSize(downloadedBytes)} / ${formatFileSize(downloadSize || 0)}`
                    }
                  </Text>
                </View>
              )}

              {/* Success message */}
              {downloadStatus === 'success' && (
                <Text style={downloadModalStyles.successText}>
                  Check the "PostHive" album in Photos
                </Text>
              )}

              {/* Error message */}
              {downloadStatus === 'error' && (
                <>
                  <Text style={downloadModalStyles.errorText}>
                    {downloadError || 'Something went wrong'}
                  </Text>
                  <TouchableOpacity
                    style={downloadModalStyles.retryButton}
                    onPress={() => {
                      resetDownloadModal();
                      handleDownload();
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ===== SHARE MODAL COMPONENT =====

interface ShareModalProps {
  visible: boolean;
  deliverableName: string;
  versionNumber: number;
  shareLink: string | null;
  sharePassword: string;
  setSharePassword: (password: string) => void;
  shareExpiresInDays: number;
  setShareExpiresInDays: (days: number) => void;
  allowDownloads: boolean;
  setAllowDownloads: (allow: boolean) => void;
  isCreatingShare: boolean;
  shareCreated: boolean;
  onCreateShare: () => void;
  onCopyLink: () => void;
  onClose: () => void;
}

function ShareModal({
  visible,
  deliverableName,
  versionNumber,
  shareLink,
  sharePassword,
  setSharePassword,
  shareExpiresInDays,
  setShareExpiresInDays,
  allowDownloads,
  setAllowDownloads,
  isCreatingShare,
  shareCreated,
  onCreateShare,
  onCopyLink,
  onClose,
}: ShareModalProps) {
  const versionDisplay = versionNumber === 100 ? 'Final' : `V${versionNumber}`;
  const {height: SCREEN_HEIGHT} = Dimensions.get('window');
  
  // Animation values
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const successScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Animate in
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(contentOpacity, {
          toValue: 1,
          duration: 400,
          delay: 100,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Reset animations when closing
      slideAnim.setValue(SCREEN_HEIGHT);
      opacityAnim.setValue(0);
      contentOpacity.setValue(0);
      successScale.setValue(0);
    }
  }, [visible, slideAnim, opacityAnim, contentOpacity, successScale, SCREEN_HEIGHT]);

  // Animate success state when share is created
  useEffect(() => {
    if (shareCreated) {
      Animated.spring(successScale, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }).start();
    } else {
      successScale.setValue(0);
    }
  }, [shareCreated, successScale]);

  const handleClose = useCallback(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(contentOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  }, [slideAnim, opacityAnim, contentOpacity, SCREEN_HEIGHT, onClose]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
      presentationStyle="fullScreen">
      <Animated.View
        style={[
          shareModalStyles.overlay,
          {
            opacity: opacityAnim,
          },
        ]}>
        <Animated.View
          style={[
            shareModalStyles.container,
            {
              transform: [{translateY: slideAnim}],
            },
          ]}>
          <SafeAreaView style={shareModalStyles.safeArea} edges={['top']}>
            {/* Header */}
            <View style={shareModalStyles.header}>
              <Text style={shareModalStyles.headerTitle}>SHARE WITH CLIENT</Text>
              <TouchableOpacity
                onPress={handleClose}
                style={shareModalStyles.closeButton}
                hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                <X size={24} color={theme.colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <Animated.View style={{opacity: contentOpacity, flex: 1}}>
              <ScrollView
                style={shareModalStyles.content}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={shareModalStyles.contentContainer}>
            {!shareCreated ? (
              <>
                <Text style={shareModalStyles.description}>
                  Create a secure link for your client to review{' '}
                  <Text style={shareModalStyles.bold}>{deliverableName}</Text> {versionDisplay}.
                </Text>

                <View style={shareModalStyles.infoBox}>
                  <Share size={16} color={theme.colors.accent} />
                  <Text style={shareModalStyles.infoText}>
                    Clients can view the video and leave timestamped comments
                  </Text>
                </View>

                {/* Expiration */}
                <View style={shareModalStyles.field}>
                  <Text style={shareModalStyles.label}>Link expires in (days)</Text>
                  <View style={shareModalStyles.selectContainer}>
                    {[7, 14, 30, 60, 90].map(days => (
                      <TouchableOpacity
                        key={days}
                        style={[
                          shareModalStyles.selectOption,
                          shareExpiresInDays === days && shareModalStyles.selectOptionActive,
                        ]}
                        onPress={() => setShareExpiresInDays(days)}>
                        <Text
                          style={[
                            shareModalStyles.selectOptionText,
                            shareExpiresInDays === days &&
                              shareModalStyles.selectOptionTextActive,
                          ]}>
                          {days}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Password */}
                <View style={shareModalStyles.field}>
                  <Text style={shareModalStyles.label}>Password (optional)</Text>
                  <View style={shareModalStyles.passwordContainer}>
                    <TextInput
                      style={shareModalStyles.passwordInput}
                      placeholder="Leave empty for no password"
                      placeholderTextColor={theme.colors.textMuted}
                      value={sharePassword}
                      onChangeText={setSharePassword}
                      secureTextEntry
                    />
                    {sharePassword ? (
                      <Lock size={16} color={theme.colors.textMuted} />
                    ) : null}
                  </View>
                  <Text style={shareModalStyles.hint}>
                    Add a password for extra security
                  </Text>
                </View>

                {/* Allow Downloads */}
                <View style={shareModalStyles.field}>
                  <View style={shareModalStyles.switchRow}>
                    <Text style={shareModalStyles.label}>Allow Downloads</Text>
                    <Switch
                      value={allowDownloads}
                      onValueChange={setAllowDownloads}
                      trackColor={{
                        false: theme.colors.surfaceBorder,
                        true: theme.colors.accent,
                      }}
                      thumbColor={theme.colors.textPrimary}
                    />
                  </View>
                  <Text style={shareModalStyles.hint}>
                    Allow clients to download the video file
                  </Text>
                </View>

                {/* Actions */}
                <View style={shareModalStyles.actions}>
                  <TouchableOpacity
                    style={[shareModalStyles.button, shareModalStyles.buttonSecondary]}
                    onPress={onClose}>
                    <Text style={shareModalStyles.buttonSecondaryText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      shareModalStyles.button,
                      shareModalStyles.buttonPrimary,
                      isCreatingShare && shareModalStyles.buttonDisabled,
                    ]}
                    onPress={onCreateShare}
                    disabled={isCreatingShare}>
                    {isCreatingShare ? (
                      <ActivityIndicator size="small" color={theme.colors.textInverse} />
                    ) : (
                      <Text style={shareModalStyles.buttonPrimaryText}>
                        Create Share Link
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <Animated.View
                  style={[
                    shareModalStyles.successContainer,
                    {
                      opacity: successScale,
                      transform: [
                        {
                          scale: successScale.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.8, 1],
                          }),
                        },
                      ],
                    },
                  ]}>
                  <View style={shareModalStyles.successIcon}>
                    <Check size={24} color={theme.colors.success} />
                  </View>
                  <Text style={shareModalStyles.successTitle}>SHARE LINK CREATED</Text>
                  <Text style={shareModalStyles.successText}>
                    Your client can now review{' '}
                    <Text style={shareModalStyles.bold}>{deliverableName}</Text> {versionDisplay}
                  </Text>
                </Animated.View>

                {/* Share Link */}
                <View style={shareModalStyles.field}>
                  <Text style={shareModalStyles.label}>Client Review Link</Text>
                  <View style={shareModalStyles.linkContainer}>
                    <TextInput
                      style={shareModalStyles.linkInput}
                      value={shareLink || ''}
                      editable={false}
                      selectTextOnFocus
                    />
                    <TouchableOpacity
                      style={shareModalStyles.copyButton}
                      onPress={onCopyLink}>
                      <Copy size={18} color={theme.colors.textPrimary} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Info Box */}
                <View style={shareModalStyles.infoBoxSuccess}>
                  <Text style={shareModalStyles.infoTitle}>
                    What your client will see:
                  </Text>
                  <Text style={shareModalStyles.infoItem}>
                    • The video for {versionDisplay}
                  </Text>
                  <Text style={shareModalStyles.infoItem}>
                    • Ability to leave timestamped comments
                  </Text>
                  <Text style={shareModalStyles.infoItem}>
                    • All existing comments from your team
                  </Text>
                  {allowDownloads && (
                    <Text style={shareModalStyles.infoItem}>
                      • Download button to save the video
                    </Text>
                  )}
                  <Text style={shareModalStyles.infoItem}>
                    • Clean interface without project navigation
                  </Text>
                </View>

                {/* Done Button */}
                <TouchableOpacity
                  style={[shareModalStyles.button, shareModalStyles.buttonPrimary]}
                  onPress={onClose}>
                  <Text style={shareModalStyles.buttonPrimaryText}>Done</Text>
                </TouchableOpacity>
              </>
              )}
              </ScrollView>
            </Animated.View>
          </SafeAreaView>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

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
    marginBottom: theme.spacing.lg,
    textAlign: 'center',
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

const shareModalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    minHeight: 60,
  },
  headerTitle: {
    color: theme.colors.textPrimary,
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semibold,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  closeButton: {
    padding: theme.spacing.xs,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  description: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.fontSize.md,
    marginBottom: theme.spacing.lg,
    lineHeight: 22,
  },
  bold: {
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.textPrimary,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surfaceElevated,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
  },
  infoText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.fontSize.sm,
    flex: 1,
  },
  field: {
    marginBottom: theme.spacing.lg,
  },
  label: {
    color: theme.colors.textPrimary,
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.semibold,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: theme.spacing.sm,
  },
  selectContainer: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
    flexWrap: 'wrap',
  },
  selectOption: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
  },
  selectOptionActive: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  selectOptionText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.medium,
  },
  selectOptionTextActive: {
    color: theme.colors.textInverse,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  passwordInput: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSize.md,
    paddingVertical: theme.spacing.sm,
  },
  hint: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.fontSize.xs,
    marginTop: theme.spacing.xs,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  button: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimary: {
    backgroundColor: theme.colors.accent,
  },
  buttonSecondary: {
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonPrimaryText: {
    color: theme.colors.textInverse,
    fontSize: theme.typography.fontSize.md,
    fontFamily: theme.typography.fontFamily.semibold,
  },
  buttonSecondaryText: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSize.md,
    fontFamily: theme.typography.fontFamily.semibold,
  },
  successContainer: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  successIcon: {
    width: 64,
    height: 64,
    backgroundColor: theme.colors.successBackground,
    borderWidth: 2,
    borderColor: theme.colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
  successTitle: {
    color: theme.colors.textPrimary,
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semibold,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: theme.spacing.xs,
  },
  successText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.fontSize.md,
    textAlign: 'center',
  },
  linkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  linkInput: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: 'monospace',
    paddingVertical: theme.spacing.sm,
  },
  copyButton: {
    padding: theme.spacing.xs,
  },
  infoBoxSuccess: {
    backgroundColor: theme.colors.accent + '20',
    borderWidth: 1,
    borderColor: theme.colors.accent + '40',
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  infoTitle: {
    color: theme.colors.accent,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.semibold,
    marginBottom: theme.spacing.sm,
  },
  infoItem: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.fontSize.sm,
    marginBottom: theme.spacing.xs,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Action menu styles
  actionMenuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  actionMenuContainer: {
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  actionMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  actionMenuText: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSize.md,
    fontFamily: theme.typography.fontFamily.medium,
  },
  actionMenuDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  actionMenuCancel: {
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  actionMenuCancelText: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.fontSize.md,
    fontFamily: theme.typography.fontFamily.medium,
    textAlign: 'center',
    flex: 1,
  },
  versionSelector: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.xs,
    paddingBottom: 0,
    gap: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  versionButton: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: 0,
    backgroundColor: 'transparent',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  versionButtonActive: {
    borderBottomColor: theme.colors.textPrimary,
  },
  versionText: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '500',
  },
  versionTextActive: {
    color: theme.colors.textPrimary,
    fontWeight: '600',
  },
  versionButtonFinal: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  versionTextFinal: {
    color: theme.colors.success,
  },
  versionButtonMarkFinal: {
    flexDirection: 'row',
    alignItems: 'center',
    opacity: 0.6,
  },
  versionTextMarkFinal: {
    color: theme.colors.textMuted,
  },
  commentsList: {
    paddingHorizontal: theme.spacing.xs,
    paddingTop: theme.spacing.xs,
    paddingBottom: theme.spacing.lg,
  },
  emptyComments: {
    padding: theme.spacing.xl,
    alignItems: 'center',
  },
  emptyCommentsText: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.fontSize.md,
    textAlign: 'center',
  },
  galleryContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  galleryHeader: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  galleryTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSize.lg,
    fontFamily: theme.typography.fontFamily.bold,
  },
  gallerySubtitle: {
    marginTop: 4,
    color: theme.colors.textMuted,
    fontSize: theme.typography.fontSize.xs,
    fontFamily: theme.typography.fontFamily.regular,
  },
  galleryContent: {
    flex: 1,
  },
  galleryScrollContent: {
    paddingBottom: theme.spacing.xl,
  },
  emptyGallery: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
  },
  emptyGalleryText: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.fontSize.md,
    textAlign: 'center',
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xl,
    backgroundColor: '#0A0A0A',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    gap: theme.spacing.sm,
  },
  timestampButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    paddingHorizontal: 8,
    paddingVertical: 0,
    height: 44,
    gap: 4,
  },
  timestampButtonText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.semibold,
    letterSpacing: 0.5,
  },
  commentInput: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSize.md,
    maxHeight: 100,
    minHeight: 44,
    paddingVertical: 12,
    paddingHorizontal: 0,
    textAlignVertical: 'center',
  },
  commentInputNoTimestamp: {
    paddingLeft: 0,
  },
  sendButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    paddingVertical: 0,
  },
  sendButtonDisabled: {
    backgroundColor: 'transparent',
  },
  commentPopupOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  commentPopupKeyboard: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
  },
  commentPopupContent: {
    backgroundColor: theme.colors.surfaceElevated,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: theme.spacing.sm,
  },
  commentPopupInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  commentPopupInput: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSize.md,
    maxHeight: 44,
    minHeight: 32,
    paddingVertical: 6,
    paddingHorizontal: 0,
    textAlignVertical: 'center',
  },
});

