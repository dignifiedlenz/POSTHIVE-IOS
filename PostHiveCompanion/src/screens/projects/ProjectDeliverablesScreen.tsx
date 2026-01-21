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
} from 'react-native';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import {StackNavigationProp} from '@react-navigation/stack';
import {ChevronLeft, Film, MessageCircle, Folder} from 'lucide-react-native';
import LinearGradient from 'react-native-linear-gradient';
import {theme} from '../../theme';
import {getProjectDeliverables} from '../../lib/api';
import {Deliverable} from '../../lib/types';
import {ReviewStackParamList} from '../../app/App';

type RouteParams = RouteProp<ReviewStackParamList, 'ProjectDeliverables'>;
type NavigationProp = StackNavigationProp<ReviewStackParamList>;

const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get('window');
const HERO_HEIGHT = SCREEN_HEIGHT * 0.5;
const CARD_HEIGHT = 200;

interface DeliverableCardProps {
  deliverable: Deliverable;
  onPress: () => void;
}

function VerticalDeliverableCard({deliverable, onPress}: DeliverableCardProps) {
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

export function ProjectDeliverablesScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteParams>();
  const {projectId, projectName, clientName, thumbnailUrl} = route.params;
  
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Scroll animation for blur effect
  const scrollY = useRef(new Animated.Value(0)).current;

  const loadDeliverables = useCallback(async () => {
    try {
      const data = await getProjectDeliverables(projectId);
      setDeliverables(data);
    } catch (err) {
      console.error('Error loading deliverables:', err);
    }
  }, [projectId]);

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await loadDeliverables();
      setIsLoading(false);
    };
    init();
  }, [loadDeliverables]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadDeliverables();
    setIsRefreshing(false);
  }, [loadDeliverables]);

  const handleDeliverablePress = (deliverable: Deliverable) => {
    navigation.navigate('DeliverableReview', {deliverableId: deliverable.id});
  };

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
      <Text style={styles.emptyTitle}>NO DELIVERABLES</Text>
      <Text style={styles.emptySubtitle}>
        Deliverables for this project will appear here
      </Text>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.container}>
        {/* Static hero for loading */}
        <View style={styles.heroSection}>
          {thumbnailUrl ? (
            <Image
              source={{uri: thumbnailUrl}}
              style={styles.heroImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.heroNoImage}>
              <Folder size={48} color={theme.colors.textMuted} />
            </View>
          )}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.4)', theme.colors.background]}
            locations={[0, 0.6, 1]}
            style={styles.heroGradient}
          />
          <View style={styles.heroContent}>
            <Text style={styles.projectTitle} numberOfLines={2}>{projectName}</Text>
            {clientName && (
              <Text style={styles.clientName}>{clientName.toUpperCase()}</Text>
            )}
            <View style={styles.decorativeLine} />
          </View>
        </View>
        {/* Back button - outside heroSection to ensure it's clickable */}
        <View style={styles.floatingHeader} pointerEvents="box-none">
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}>
            <ChevronLeft size={20} color={theme.colors.textPrimary} />
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.textPrimary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Fixed hero background with parallax */}
      <View style={styles.heroSection}>
        {thumbnailUrl ? (
          <>
            {/* Main image with parallax */}
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
            {/* Blur overlay that increases on scroll */}
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
            <Folder size={64} color={theme.colors.textMuted} />
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
          <Text style={styles.projectTitle} numberOfLines={2}>{projectName}</Text>
          {clientName && (
            <Text style={styles.clientName}>{clientName.toUpperCase()}</Text>
          )}
          <View style={styles.decorativeLine} />
        </Animated.View>

      </View>

      {/* Back button - outside heroSection to ensure it's clickable */}
      <View style={styles.floatingHeader} pointerEvents="box-none">
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}>
          <ChevronLeft size={20} color={theme.colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Scrollable content */}
      <Animated.ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{nativeEvent: {contentOffset: {y: scrollY}}}],
          {useNativeDriver: true}
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

        {/* Deliverables section */}
        <View style={styles.deliverablesSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>DELIVERABLES</Text>
            <Text style={styles.deliverableCount}>{deliverables.length}</Text>
          </View>

          {deliverables.length > 0 ? (
            <View style={styles.cardList}>
              {deliverables.map((item) => (
                <VerticalDeliverableCard
                  key={item.id}
                  deliverable={item}
                  onPress={() => handleDeliverablePress(item)}
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
  // Hero section - fixed at top
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
    elevation: 10, // Android
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  projectTitle: {
    color: theme.colors.textPrimary,
    fontSize: 34,
    fontFamily: theme.typography.fontFamily.bold,
    textAlign: 'center',
    lineHeight: 40,
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: {width: 0, height: 2},
    textShadowRadius: 10,
  },
  clientName: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.semibold,
    letterSpacing: 3,
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
  // Spacer to push content below hero
  heroSpacer: {
    height: HERO_HEIGHT - 40,
  },
  // Deliverables section
  deliverablesSection: {
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
  deliverableCount: {
    color: theme.colors.textDisabled,
    fontSize: 11,
  },
  // Vertical card list
  cardList: {
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.md,
  },
  // Card styles
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
