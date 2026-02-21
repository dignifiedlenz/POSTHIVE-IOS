import React, {useState, useEffect, useCallback, useRef} from 'react';
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
import {ChevronLeft, Film, MessageCircle, Share2} from 'lucide-react-native';
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

interface DeliverableCardProps {
  deliverable: Deliverable;
  onPress: () => void;
}

function SeriesItemCard({deliverable, onPress}: DeliverableCardProps) {
  const hasUnreadComments =
    deliverable.unread_comment_count != null && deliverable.unread_comment_count > 0;

  const statusLabel = deliverable.status === 'final' ? 'FINAL' : deliverable.status.toUpperCase();
  const isFinal = deliverable.status === 'final';

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.9}>
      {/* Thumbnail */}
      {deliverable.thumbnail_url ? (
        <Image
          source={{uri: deliverable.thumbnail_url}}
          style={styles.cardThumbnail}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.cardPlaceholder}>
          <Film size={48} color={theme.colors.textMuted} />
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

export function SeriesItemsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteParams>();
  const {seriesId, seriesName, seriesDescription, thumbnailUrl, itemCount} = route.params;
  
  const [items, setItems] = useState<Deliverable[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

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
    navigation.navigate('DeliverableReview', {deliverableId: deliverable.id});
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
      <Film size={40} color={theme.colors.textMuted} />
      <Text style={styles.emptyTitle}>NO ITEMS</Text>
      <Text style={styles.emptySubtitle}>
        Items in this series will appear here
      </Text>
    </View>
  );

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
            <Film size={64} color={theme.colors.textMuted} />
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
            <Text style={styles.sectionLabel}>ITEMS</Text>
            <Text style={styles.itemCount}>{items.length}</Text>
          </View>

          {items.length > 0 ? (
            <View style={styles.cardList}>
              {items.map((item) => (
                <SeriesItemCard
                  key={item.id}
                  deliverable={item}
                  onPress={() => handleItemPress(item)}
                />
              ))}
            </View>
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
  // Card list
  cardList: {
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.md,
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
    fontSize: 18,
    fontFamily: theme.typography.fontFamily.semibold,
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
