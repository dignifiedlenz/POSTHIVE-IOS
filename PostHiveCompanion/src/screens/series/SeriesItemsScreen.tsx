import React, {useState, useEffect, useCallback, useMemo, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
  Animated,
  Share,
  Alert,
} from 'react-native';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import {StackNavigationProp} from '@react-navigation/stack';
import {ChevronLeft, MessageCircle, Share2, Grid3X3, List} from 'lucide-react-native';
import LinearGradient from 'react-native-linear-gradient';
import {theme} from '../../theme';
import {BrandedLoadingScreen} from '../../components/BrandedLoadingScreen';
import {getSeriesItems, createSeriesShareLink} from '../../lib/api';
import {Deliverable} from '../../lib/types';
import {ReviewStackParamList} from '../../app/App';

type RouteParams = RouteProp<ReviewStackParamList, 'SeriesItems'>;
type NavigationProp = StackNavigationProp<ReviewStackParamList>;

const {height: SCREEN_HEIGHT} = Dimensions.get('window');
const HERO_HEIGHT = SCREEN_HEIGHT * 0.4;
const CARD_HEIGHT = 200;
const DEFAULT_THUMBNAIL = 'https://www.posthive.app/thumbnail/default.png';

interface DeliverableCardProps {
  deliverable: Deliverable;
  onPress: () => void;
}

function getDeliverableTypeLabel(type: Deliverable['type']): string {
  switch (type) {
    case 'video':
      return 'VIDEO';
    case 'audio':
      return 'AUDIO';
    case 'image':
      return 'IMAGE';
    case 'image_gallery':
      return 'GALLERY';
    case 'pdf':
      return 'PDF';
    case 'document':
      return 'DOCUMENT';
    default:
      return 'FILE';
  }
}

function getSeriesItemThumbnail(deliverable: Deliverable): string | undefined {
  // Keep non-video items visually consistent with main app series/grid fallback.
  if (deliverable.type !== 'video') {
    return DEFAULT_THUMBNAIL;
  }
  return deliverable.thumbnail_url || undefined;
}

function SeriesItemCard({deliverable, onPress}: DeliverableCardProps) {
  const [thumbnailError, setThumbnailError] = useState(false);
  const hasUnreadComments =
    deliverable.unread_comment_count != null && deliverable.unread_comment_count > 0;

  const statusLabel = deliverable.status === 'final' ? 'FINAL' : deliverable.status.toUpperCase();
  const isFinal = deliverable.status === 'final';
  const thumbnailSource = getSeriesItemThumbnail(deliverable);
  const hasThumbnail = !!thumbnailSource && !thumbnailError;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.9}>
      {/* Thumbnail */}
      {hasThumbnail ? (
        <>
          <Image
            source={{uri: thumbnailSource}}
            style={styles.cardThumbnail}
            resizeMode="cover"
            onError={() => setThumbnailError(true)}
          />
          <View style={styles.thumbnailDarkOverlay} />
        </>
      ) : (
        <View style={styles.cardPlaceholder}>
          <Image source={{uri: DEFAULT_THUMBNAIL}} style={styles.placeholderImage} resizeMode="cover" />
        </View>
      )}
      
      {/* Bottom gradient overlay */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.85)']}
        locations={[0, 0.4, 1]}
        style={styles.cardGradient}
      />
      
      {/* Version badge - top left */}
      {deliverable.current_version != null && (
        <Text style={styles.cardVersionText}>
          {deliverable.current_version === 100 ? 'Final' : `V${deliverable.current_version}`}
        </Text>
      )}
      
      {/* Unread comments badge - top right */}
      {hasUnreadComments && (
        <View style={styles.cardUnreadBadge}>
          <MessageCircle size={12} color={theme.colors.textInverse} />
          <Text style={styles.cardUnreadCount}>{deliverable.unread_comment_count}</Text>
        </View>
      )}
      
      {/* Title and status - bottom */}
      <View style={styles.cardContent}>
        <Text style={styles.cardName} numberOfLines={1}>
          {deliverable.name}
        </Text>
        <View style={[styles.cardStatusBadge, isFinal && styles.cardStatusFinal]}>
          <Text style={[styles.cardStatusText, isFinal && styles.cardStatusTextFinal]}>
            {statusLabel}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function SeriesGridItemCard({deliverable, onPress}: DeliverableCardProps) {
  const [thumbnailError, setThumbnailError] = useState(false);
  const hasUnreadComments =
    deliverable.unread_comment_count != null && deliverable.unread_comment_count > 0;
  const thumbnailSource = getSeriesItemThumbnail(deliverable);
  const hasThumbnail = !!thumbnailSource && !thumbnailError;

  return (
    <TouchableOpacity
      style={styles.gridCard}
      onPress={onPress}
      activeOpacity={0.9}>
      <View style={styles.gridMedia}>
        {hasThumbnail ? (
          <>
            <Image
              source={{uri: thumbnailSource}}
              style={styles.gridThumbnail}
              resizeMode="cover"
              onError={() => setThumbnailError(true)}
            />
            <View style={styles.thumbnailDarkOverlay} />
          </>
        ) : (
          <View style={styles.gridPlaceholder}>
            <Image source={{uri: DEFAULT_THUMBNAIL}} style={styles.placeholderImage} resizeMode="cover" />
          </View>
        )}

        {hasUnreadComments && (
          <View style={styles.gridUnreadBadge}>
            <MessageCircle size={10} color={theme.colors.textInverse} />
            <Text style={styles.gridUnreadCount}>{deliverable.unread_comment_count}</Text>
          </View>
        )}
      </View>

      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.35)', 'rgba(0,0,0,0.9)']}
        locations={[0, 0.45, 1]}
        style={styles.gridCardOverlay}
      />
      <View style={styles.gridMetaOverlay}>
        <Text style={styles.gridName} numberOfLines={1}>
          {deliverable.name}
        </Text>
        <Text style={styles.gridType} numberOfLines={1}>
          {getDeliverableTypeLabel(deliverable.type)}
        </Text>
        {deliverable.current_version != null && (
          <Text style={styles.gridVersionCentered}>
            {deliverable.current_version === 100 ? 'Final' : `V${deliverable.current_version}`}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

export function SeriesItemsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteParams>();
  const {seriesId, seriesName, seriesDescription, thumbnailUrl, itemCount} = route.params;
  
  const [items, setItems] = useState<Deliverable[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [layoutMode, setLayoutMode] = useState<'grid' | 'list'>('grid');

  // Scroll animation for blur effect
  const scrollY = useRef(new Animated.Value(0)).current;

  const loadItems = useCallback(async () => {
    try {
      const data = await getSeriesItems(seriesId);
      setItems(data);
    } catch (err) {
      console.error('Error loading series items:', err);
    }
  }, [seriesId]);

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await loadItems();
      setIsLoading(false);
    };
    init();
  }, [loadItems]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadItems();
    setIsRefreshing(false);
  }, [loadItems]);

  const handleItemPress = (deliverable: Deliverable) => {
    (navigation as any).navigate('DeliverableReview', {deliverableId: deliverable.id});
  };

  const handleShare = useCallback(async () => {
    setIsSharing(true);
    try {
      const result = await createSeriesShareLink({seriesId});
      
      // Show share sheet
      await Share.share({
        message: result.url,
        title: `Review: ${seriesName}`,
      });
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create share link');
    } finally {
      setIsSharing(false);
    }
  }, [seriesId, seriesName]);

  // Animated values for parallax and blur effect
  const imageScale = scrollY.interpolate({
    inputRange: [-100, 0, HERO_HEIGHT],
    outputRange: [1.2, 1, 1.5],
    extrapolate: 'clamp',
  });

  const imageTranslateY = scrollY.interpolate({
    inputRange: [0, HERO_HEIGHT],
    outputRange: [0, -HERO_HEIGHT * 0.3],
    extrapolate: 'clamp',
  });

  const blurOverlayOpacity = scrollY.interpolate({
    inputRange: [0, HERO_HEIGHT * 0.3, HERO_HEIGHT * 0.6],
    outputRange: [0, 0.5, 1],
    extrapolate: 'clamp',
  });

  const titleOpacity = scrollY.interpolate({
    inputRange: [0, HERO_HEIGHT * 0.4],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const titleTranslateY = scrollY.interpolate({
    inputRange: [0, HERO_HEIGHT * 0.4],
    outputRange: [0, -50],
    extrapolate: 'clamp',
  });

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Image source={{uri: DEFAULT_THUMBNAIL}} style={styles.emptyThumb} resizeMode="cover" />
      <Text style={styles.emptyTitle}>NO ITEMS</Text>
      <Text style={styles.emptySubtitle}>
        Items in this series will appear here
      </Text>
    </View>
  );

  const gridRows = useMemo(() => {
    const rows: Deliverable[][] = [];
    for (let i = 0; i < items.length; i += 2) {
      rows.push(items.slice(i, i + 2));
    }
    return rows;
  }, [items]);

  if (isLoading) {
    return <BrandedLoadingScreen message="Loading series..." />;
  }

  return (
    <View style={styles.container}>
      {/* Fixed hero background with parallax */}
      <View style={styles.heroSection}>
        {thumbnailUrl ? (
          <>
            <Animated.Image
              source={{uri: thumbnailUrl}}
              style={[
                styles.heroImage,
                {
                  transform: [
                    {scale: imageScale},
                    {translateY: imageTranslateY},
                  ],
                },
              ]}
              resizeMode="cover"
              blurRadius={0}
            />
            <Animated.View
              style={[
                styles.blurOverlay,
                {opacity: blurOverlayOpacity},
              ]}>
              <Animated.Image
                source={{uri: thumbnailUrl}}
                style={[
                  styles.heroImage,
                  {
                    transform: [
                      {scale: imageScale},
                      {translateY: imageTranslateY},
                    ],
                  },
                ]}
                resizeMode="cover"
                blurRadius={20}
              />
            </Animated.View>
          </>
        ) : (
          <View style={styles.heroNoImage}>
            <Image source={{uri: DEFAULT_THUMBNAIL}} style={styles.heroDefaultImage} resizeMode="cover" />
          </View>
        )}
        
        {/* Gradient overlay */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.7)', theme.colors.background]}
          locations={[0, 0.4, 0.7, 1]}
          style={styles.heroGradient}
        />

        {/* Animated title */}
        <Animated.View
          style={[
            styles.heroContent,
            {
              opacity: titleOpacity,
              transform: [{translateY: titleTranslateY}],
            },
          ]}>
          <Text style={styles.seriesLabel}>SERIES</Text>
          <Text style={styles.seriesTitle} numberOfLines={2}>{seriesName}</Text>
          {seriesDescription ? (
            <Text style={styles.seriesDescription} numberOfLines={2}>{seriesDescription}</Text>
          ) : null}
          <View style={styles.decorativeLine} />
        </Animated.View>
      </View>

      {/* Back button and share button */}
      <View style={styles.floatingHeader} pointerEvents="box-none">
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}>
          <ChevronLeft size={20} color={theme.colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <View style={styles.floatingShare} pointerEvents="box-none">
        <TouchableOpacity
          style={styles.shareButton}
          onPress={handleShare}
          disabled={isSharing}
          activeOpacity={0.7}>
          {isSharing ? (
            <ActivityIndicator size="small" color={theme.colors.textPrimary} />
          ) : (
            <Share2 size={18} color={theme.colors.textPrimary} />
          )}
        </TouchableOpacity>
      </View>

      {/* Scrollable content */}
      <Animated.ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{nativeEvent: {contentOffset: {y: scrollY}}}],
          {useNativeDriver: true},
        )}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.textPrimary}
          />
        }>
        {/* Spacer for hero */}
        <View style={styles.heroSpacer} />

        {/* Items section */}
        <View style={styles.itemsSection}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderLeft}>
              <Text style={styles.sectionLabel}>ITEMS</Text>
              <Text style={styles.itemCount}>{items.length}</Text>
            </View>
            <View style={styles.layoutToggle}>
              <TouchableOpacity
                style={[
                  styles.layoutButton,
                  layoutMode === 'grid' && styles.layoutButtonActive,
                ]}
                onPress={() => setLayoutMode('grid')}>
                <Grid3X3
                  size={14}
                  color={
                    layoutMode === 'grid'
                      ? theme.colors.textPrimary
                      : theme.colors.textMuted
                  }
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.layoutButton,
                  layoutMode === 'list' && styles.layoutButtonActive,
                ]}
                onPress={() => setLayoutMode('list')}>
                <List
                  size={14}
                  color={
                    layoutMode === 'list'
                      ? theme.colors.textPrimary
                      : theme.colors.textMuted
                  }
                />
              </TouchableOpacity>
            </View>
          </View>

          {items.length > 0 ? (
            layoutMode === 'grid' ? (
              <View style={styles.gridRows}>
                {gridRows.map((row, rowIndex) => (
                  <View key={`row-${rowIndex}`} style={styles.gridRow}>
                    {row.map((item) => (
                      <SeriesGridItemCard
                        key={item.id}
                        deliverable={item}
                        onPress={() => handleItemPress(item)}
                      />
                    ))}
                    {row.length === 1 && <View style={styles.gridCardSpacer} />}
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.cardList}>
                {items.map((item) => (
                  <SeriesItemCard
                    key={item.id}
                    deliverable={item}
                    onPress={() => handleItemPress(item)}
                  />
                ))}
              </View>
            )
          ) : (
            renderEmptyState()
          )}
        </View>
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  // Hero section
  heroSection: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: HERO_HEIGHT,
    overflow: 'hidden',
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  blurOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  heroNoImage: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroDefaultImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    opacity: 0.8,
  },
  heroGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  heroContent: {
    position: 'absolute',
    bottom: theme.spacing.xl,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  floatingHeader: {
    position: 'absolute',
    top: 60,
    left: theme.spacing.md,
    zIndex: 1000,
    elevation: 10,
  },
  floatingShare: {
    position: 'absolute',
    top: 60,
    right: theme.spacing.md,
    zIndex: 1000,
    elevation: 10,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  shareButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  seriesLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semibold,
    letterSpacing: 3,
    marginBottom: theme.spacing.xs,
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 6,
  },
  seriesTitle: {
    color: theme.colors.textPrimary,
    fontSize: 34,
    fontFamily: theme.typography.fontFamily.bold,
    textAlign: 'center',
    lineHeight: 40,
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: {width: 0, height: 2},
    textShadowRadius: 10,
  },
  seriesDescription: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.regular,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 6,
  },
  decorativeLine: {
    width: 50,
    height: 2,
    backgroundColor: theme.colors.textPrimary,
    marginTop: theme.spacing.lg,
  },
  // Spacer
  heroSpacer: {
    height: HERO_HEIGHT - 40,
  },
  // Items section
  itemsSection: {
    backgroundColor: theme.colors.background,
    paddingTop: theme.spacing.lg,
    paddingBottom: 100,
    minHeight: SCREEN_HEIGHT * 0.6,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  sectionLabel: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.semibold,
    letterSpacing: 1.5,
  },
  itemCount: {
    color: theme.colors.textDisabled,
    fontSize: 11,
  },
  layoutToggle: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  layoutButton: {
    width: 32,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  layoutButtonActive: {
    backgroundColor: theme.colors.surfaceElevated,
  },
  // Card list
  cardList: {
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.md,
  },
  gridRows: {
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.md,
  },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  gridCard: {
    flex: 1,
  },
  gridCardSpacer: {
    flex: 1,
  },
  gridMedia: {
    position: 'relative',
    width: '100%',
    aspectRatio: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
    backgroundColor: theme.colors.surfaceElevated,
  },
  gridThumbnail: {
    ...StyleSheet.absoluteFillObject,
  },
  gridPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceElevated,
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
  },
  gridCardOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  gridUnreadBadge: {
    position: 'absolute',
    top: theme.spacing.sm,
    right: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.textPrimary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 3,
  },
  gridUnreadCount: {
    color: theme.colors.textInverse,
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.bold,
  },
  gridMetaOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.sm,
  },
  gridName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: theme.typography.fontFamily.bold,
    fontWeight: '700',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 3,
  },
  gridType: {
    marginTop: 2,
    color: 'rgba(255,255,255,0.75)',
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.semibold,
    letterSpacing: 1,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 3,
  },
  gridVersionCentered: {
    marginTop: 4,
    color: 'rgba(255,255,255,0.9)',
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semibold,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 3,
  },
  // Card styles (matching ProjectDeliverableCard)
  card: {
    width: '100%',
    height: CARD_HEIGHT,
    position: 'relative',
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  cardThumbnail: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.surface,
  },
  thumbnailDarkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  cardPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '60%',
  },
  cardVersionText: {
    position: 'absolute',
    top: theme.spacing.md,
    left: theme.spacing.md,
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.medium,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 3,
  },
  cardUnreadBadge: {
    position: 'absolute',
    top: theme.spacing.md,
    right: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.textPrimary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  cardUnreadCount: {
    color: theme.colors.textInverse,
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.bold,
  },
  cardContent: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
  },
  cardName: {
    color: theme.colors.textPrimary,
    fontSize: 20,
    fontFamily: theme.typography.fontFamily.bold,
    fontWeight: '700',
    marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 3,
  },
  cardStatusBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  cardStatusFinal: {
    borderColor: theme.colors.success,
    backgroundColor: 'rgba(74, 222, 128, 0.2)',
  },
  cardStatusText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.bold,
    letterSpacing: 1,
  },
  cardStatusTextFinal: {
    color: theme.colors.success,
  },
  // Loading & Empty states
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: theme.spacing.xxl,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xxl,
    marginHorizontal: theme.spacing.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.colors.borderHover,
  },
  emptyThumb: {
    width: 64,
    height: 64,
    opacity: 0.85,
  },
  emptyTitle: {
    color: theme.colors.textPrimary,
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semibold,
    letterSpacing: 2,
    marginTop: theme.spacing.md,
  },
  emptySubtitle: {
    color: theme.colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
  },
});
