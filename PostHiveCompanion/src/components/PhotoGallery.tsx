import React, {useState, useRef, useCallback, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Alert,
  Share as RNShare,
  StatusBar,
  ScrollView,
  Animated,
  useWindowDimensions,
  Dimensions,
  PanResponder,
  GestureResponderEvent,
} from 'react-native';
import {X, Share2, Download, Image as ImageIcon} from 'lucide-react-native';
import LinearGradient from 'react-native-linear-gradient';
import {theme} from '../theme';
import {CameraRoll} from '@react-native-camera-roll/camera-roll';
import ReactNativeBlobUtil from 'react-native-blob-util';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';

export interface Photo {
  id: string;
  url: string;
  thumbnail_url?: string;
  name?: string;
  uploaded_at?: string;
}

interface PhotoGalleryProps {
  photos: Photo[];
  initialIndex?: number;
  onClose?: () => void;
}

export function PhotoGallery({photos, initialIndex = 0, onClose}: PhotoGalleryProps) {
  const {width: windowWidth, height: windowHeight} = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [selectedIndex, setSelectedIndex] = useState(initialIndex);
  const [isDownloading, setIsDownloading] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const didScrollRef = useRef(false);
  const verticalSwipeStartRef = useRef<number | null>(null);
  const loadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({
        x: selectedIndex * windowWidth,
        animated: false,
      });
    }
  }, [selectedIndex, windowWidth]);

  const currentPhoto = photos[selectedIndex];

  const handleShare = useCallback(async () => {
    if (!currentPhoto) return;

    try {
      const result = await RNShare.share({
        message: currentPhoto.name
          ? `Check out this photo: ${currentPhoto.name}`
          : 'Check out this photo',
        url: currentPhoto.url,
        title: currentPhoto.name || 'Photo',
      });

      if (result.action === RNShare.sharedAction) {
        // Share was successful
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to share photo');
    }
  }, [currentPhoto]);

  const handleDownload = useCallback(async () => {
    if (!currentPhoto) return;

    setIsDownloading(true);
    let tempFilePath: string | null = null;
    
    try {
      // Extract file extension from URL or default to .jpg
      const urlPath = currentPhoto.url.split('?')[0];
      const extension = urlPath.split('.').pop()?.toLowerCase() || 'jpg';
      // Supported photo formats on iOS Camera Roll
      const supportedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'heic', 'heif', 'tiff', 'tif', 'bmp'];
      const validExtension = supportedExtensions.includes(extension) ? extension : 'jpg';
      
      // Download the file to a temporary location first
      const fileName = `PostHive_photo_${Date.now()}.${validExtension}`;
      tempFilePath = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/${fileName}`;
      
      console.log('Downloading photo from:', currentPhoto.url);
      
      const response = await ReactNativeBlobUtil.config({
        fileCache: true,
        path: tempFilePath,
        followRedirect: true,
      }).fetch('GET', currentPhoto.url);
      
      const status = response.info().status;
      console.log('Download response status:', status);
      
      if (status !== 200) {
        throw new Error(`Download failed with status ${status}`);
      }
      
      const downloadedPath = response.path();
      const fileStats = await ReactNativeBlobUtil.fs.stat(downloadedPath);
      console.log('Downloaded file size:', fileStats.size, 'bytes');
      
      // Try to save to camera roll
      try {
        await CameraRoll.save(`file://${downloadedPath}`, {
          type: 'photo',
          album: 'PostHive',
        });

        Alert.alert('Saved', 'Photo saved to your Camera Roll');
      } catch (cameraRollError: any) {
        // If camera roll fails (e.g., unsupported format), fall back to share sheet
        console.log('Camera Roll save failed, falling back to share sheet:', cameraRollError);
        
        if (cameraRollError?.message?.includes('3302') || cameraRollError?.code === 3302) {
          // Format not supported - use share sheet instead
          await RNShare.share({
            url: `file://${downloadedPath}`,
            title: fileName,
          });
        } else {
          throw cameraRollError;
        }
      }
      
      // Clean up temp file after a delay (share sheet might still need it)
      setTimeout(async () => {
        try {
          await ReactNativeBlobUtil.fs.unlink(downloadedPath);
        } catch (cleanupError) {
          console.log('Cleanup error (non-critical):', cleanupError);
        }
      }, 5000);
    } catch (error) {
      console.error('Download error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to download photo';
      
      // Check if it's a permission error
      if (errorMessage.includes('permission') || errorMessage.includes('Permission')) {
        Alert.alert(
          'Permission Required',
          'Please grant photo library access in Settings to save photos.',
        );
      } else if (errorMessage.includes('cancelled') || errorMessage.includes('canceled')) {
        // User cancelled share sheet - not an error
        console.log('Share cancelled by user');
      } else {
        Alert.alert('Save Failed', errorMessage || 'Failed to save photo. Please try again.');
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
  }, [currentPhoto]);

  const handleScrollEnd = useCallback(
    (event: any) => {
      const offsetX = event.nativeEvent.contentOffset.x;
      const index = Math.round(offsetX / windowWidth);
      if (index !== selectedIndex && index >= 0 && index < photos.length) {
        setSelectedIndex(index);
      }
      didScrollRef.current = false;
    },
    [selectedIndex, photos.length, windowWidth],
  );

  // Reset loading state when photo changes
  useEffect(() => {
    setImageLoading(false);
    setShowLoadingOverlay(false);
    if (loadingTimerRef.current) {
      clearTimeout(loadingTimerRef.current);
    }
  }, [selectedIndex]);

  // Pan responder for vertical swipe to close
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Only capture if it's a clear vertical swipe
        const isVertical = Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 1.5;
        const isSignificant = Math.abs(gestureState.dy) > 15;
        
        if (isVertical && isSignificant) {
          verticalSwipeStartRef.current = gestureState.dy;
          return true;
        }
        return false;
      },
      onPanResponderMove: (evt, gestureState) => {
        // Don't interfere with horizontal scrolling
        if (Math.abs(gestureState.dx) > Math.abs(gestureState.dy)) {
          return false;
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        const swipeDistance = Math.abs(gestureState.dy);
        // Close if swiped more than 100px vertically
        if (swipeDistance > 100) {
          onClose?.();
        }
        verticalSwipeStartRef.current = null;
      },
    }),
  ).current;

  if (photos.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <ImageIcon size={48} color={theme.colors.textMuted} />
        <Text style={styles.emptyText}>No photos available</Text>
      </View>
    );
  }

  return (
    <Modal
      visible={true}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent>
      <StatusBar hidden />
      <SafeAreaView style={styles.modalContainer} edges={[]}>
        {/* Header - Always visible with solid background */}
        <View style={[styles.headerOverlay, {paddingTop: insets.top}]}>
          <LinearGradient
            colors={['rgba(0,0,0,0.95)', 'rgba(0,0,0,0.7)', 'rgba(0,0,0,0.0)']}
            style={styles.headerGradient}>
            <View style={[styles.header, {paddingTop: theme.spacing.md}]}>
              <TouchableOpacity
                style={styles.headerButton}
                onPress={onClose}
                hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                <X size={24} color="#FFFFFF" />
              </TouchableOpacity>

              <View style={styles.headerInfo}>
                <Text style={styles.headerTitle} numberOfLines={1}>
                  {currentPhoto?.name || `Photo ${selectedIndex + 1}`}
                </Text>
                <Text style={styles.headerSubtitle}>
                  {selectedIndex + 1} of {photos.length}
                </Text>
              </View>

              <View style={styles.headerActions}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={handleShare}
                  hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                  <Share2 size={20} color="#FFFFFF" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={handleDownload}
                  disabled={isDownloading}
                  hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                  {isDownloading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Download size={20} color="#FFFFFF" />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Image Viewer */}
        <View 
          style={styles.imageContainer}
          {...panResponder.panHandlers}>
          <ScrollView
            ref={scrollViewRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScrollBeginDrag={() => {
              didScrollRef.current = true;
            }}
            onMomentumScrollEnd={handleScrollEnd}
            contentOffset={{x: initialIndex * windowWidth, y: 0}}
            scrollEventThrottle={16}>
            {photos.map((photo, index) => (
              <View 
                key={photo.id} 
                style={[styles.imageWrapper, {width: windowWidth, height: windowHeight}]}>
                <ScrollView
                  style={{width: windowWidth, height: windowHeight}}
                  contentContainerStyle={styles.zoomContent}
                  maximumZoomScale={3}
                  minimumZoomScale={1}
                  bouncesZoom
                  showsHorizontalScrollIndicator={false}
                  showsVerticalScrollIndicator={false}
                  pinchGestureEnabled>
                  <Image
                    source={{uri: photo.url}}
                    style={{width: windowWidth, height: windowHeight}}
                    resizeMode="contain"
                    onLoadStart={() => {
                      if (index === selectedIndex) {
                        setImageLoading(true);
                        setShowLoadingOverlay(false);
                        if (loadingTimerRef.current) {
                          clearTimeout(loadingTimerRef.current);
                        }
                        loadingTimerRef.current = setTimeout(() => {
                          setShowLoadingOverlay(true);
                        }, 200);
                      }
                    }}
                    onLoadEnd={() => {
                      if (index === selectedIndex) {
                        setImageLoading(false);
                        setShowLoadingOverlay(false);
                        if (loadingTimerRef.current) {
                          clearTimeout(loadingTimerRef.current);
                        }
                      }
                    }}
                    onError={() => {
                      if (index === selectedIndex) {
                        setImageLoading(false);
                        setShowLoadingOverlay(false);
                        if (loadingTimerRef.current) {
                          clearTimeout(loadingTimerRef.current);
                        }
                      }
                    }}
                  />
                </ScrollView>
                {imageLoading && showLoadingOverlay && index === selectedIndex && (
                  <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color="#FFFFFF" />
                  </View>
                )}
              </View>
            ))}
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

interface PhotoGridProps {
  photos: Photo[];
  onPhotoPress: (index: number) => void;
  columns?: number;
}

export function PhotoGrid({photos, onPhotoPress, columns = 3}: PhotoGridProps) {
  // Use static portrait dimensions - don't adapt to rotation
  const [portraitWidth] = useState(() => Dimensions.get('window').width);
  if (photos.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <ImageIcon size={48} color={theme.colors.textMuted} />
        <Text style={styles.emptyText}>No photos available</Text>
      </View>
    );
  }

  const itemSize = (portraitWidth - theme.spacing.md * (columns + 1)) / columns;

  return (
    <View style={styles.gridContainer}>
      {photos.map((photo, index) => (
        <TouchableOpacity
          key={photo.id}
          style={[styles.gridItem, {width: itemSize, height: itemSize}]}
          onPress={() => onPhotoPress(index)}
          activeOpacity={0.8}>
          <Image
            source={{uri: photo.thumbnail_url || photo.url}}
            style={styles.gridImage}
            resizeMode="cover"
          />
          {index === photos.length - 1 && photos.length % columns !== 0 && (
            <View style={styles.gridOverlay} />
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  emptyText: {
    marginTop: theme.spacing.md,
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.textMuted,
    fontFamily: theme.typography.fontFamily.regular,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    elevation: 1000,
  },
  headerGradient: {
    paddingBottom: theme.spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    minHeight: 56,
  },
  headerButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerInfo: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: theme.spacing.md,
  },
  headerTitle: {
    fontSize: theme.typography.fontSize.md,
    fontFamily: theme.typography.fontFamily.semibold,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: theme.typography.fontSize.xs,
    fontFamily: theme.typography.fontFamily.regular,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  actionButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  imageWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: theme.spacing.md,
    gap: theme.spacing.md,
  },
  gridItem: {
    backgroundColor: theme.colors.surface,
    overflow: 'hidden',
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
});
