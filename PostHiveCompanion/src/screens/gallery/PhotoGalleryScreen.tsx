import React, {useState, useCallback} from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Text,
  ActivityIndicator,
} from 'react-native';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import {ChevronLeft, Grid, Image as ImageIcon} from 'lucide-react-native';
import {theme} from '../../theme';
import {PhotoGallery, PhotoGrid, Photo} from '../../components/PhotoGallery';

type PhotoGalleryScreenRouteParams = {
  photos: Photo[];
  initialIndex?: number;
  title?: string;
};

type RouteParams = RouteProp<{PhotoGallery: PhotoGalleryScreenRouteParams}, 'PhotoGallery'>;

export function PhotoGalleryScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteParams>();
  const {photos, initialIndex = 0, title} = route.params || {photos: []};

  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'preview'>('grid');

  const handlePhotoPress = useCallback((index: number) => {
    setPreviewIndex(index);
    setViewMode('preview');
  }, []);

  const handleClosePreview = useCallback(() => {
    setPreviewIndex(null);
    setViewMode('grid');
  }, []);

  if (viewMode === 'preview' && previewIndex !== null) {
    return (
      <PhotoGallery
        photos={photos}
        initialIndex={previewIndex}
        onClose={handleClosePreview}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
          <ChevronLeft size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.headerContent}>
          <Text style={styles.title} numberOfLines={1}>
            {title || 'Photo Gallery'}
          </Text>
          {photos.length > 0 && (
            <Text style={styles.subtitle}>{photos.length} photos</Text>
          )}
        </View>

        <View style={styles.headerRight} />
      </View>

      {/* Grid View */}
      <View style={styles.content}>
        <PhotoGrid photos={photos} onPhotoPress={handlePhotoPress} columns={3} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: theme.spacing.md,
  },
  headerRight: {
    width: 44,
  },
  title: {
    fontSize: theme.typography.fontSize.lg,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: theme.typography.fontSize.xs,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
});












