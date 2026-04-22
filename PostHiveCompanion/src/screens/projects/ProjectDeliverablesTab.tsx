import React, {useState, useEffect, useCallback, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  RefreshControl,
  Dimensions,
  Animated,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {StackNavigationProp} from '@react-navigation/stack';
import {MessageCircle} from 'lucide-react-native';
import LinearGradient from 'react-native-linear-gradient';
import {theme} from '../../theme';
import {getProjectDeliverables, getProjectSeries} from '../../lib/api';
import {Deliverable, Series} from '../../lib/types';
import {ProjectsStackParamList} from '../../app/App';
import {useProjectParams} from '../../contexts/ProjectContext';

type NavigationProp = StackNavigationProp<ProjectsStackParamList>;

const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get('window');
const CARD_HEIGHT = 200;
const DEFAULT_THUMBNAIL = 'https://www.posthive.app/thumbnail/default.png';

interface DeliverableCardProps {
  deliverable: Deliverable;
  onPress: () => void;
}

function VerticalDeliverableCard({deliverable, onPress}: DeliverableCardProps) {
  const hasUnreadComments =
    deliverable.unread_comment_count != null && deliverable.unread_comment_count > 0;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
      {deliverable.thumbnail_url ? (
        <Image
          source={{uri: deliverable.thumbnail_url}}
          style={styles.cardThumbnail}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.cardPlaceholder}>
          <Image
            source={{uri: DEFAULT_THUMBNAIL}}
            style={styles.defaultThumb}
            resizeMode="cover"
          />
        </View>
      )}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.85)']}
        locations={[0, 0.4, 1]}
        style={styles.cardGradient}
      />
      {deliverable.current_version != null && (
        <Text style={styles.cardVersionText}>
          {deliverable.current_version === 100 ? 'Final' : `V${deliverable.current_version}`}
        </Text>
      )}
      {hasUnreadComments && (
        <View style={styles.cardUnreadBadge}>
          <MessageCircle size={12} color={theme.colors.textInverse} />
          <Text style={styles.cardUnreadCount}>{deliverable.unread_comment_count}</Text>
        </View>
      )}
      <View style={styles.cardContent}>
        <Text style={styles.cardName} numberOfLines={1}>
          {deliverable.name}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export function ProjectDeliverablesTab() {
  const navigation = useNavigation<NavigationProp>();
  const {projectId} = useProjectParams();
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [series, setSeries] = useState<Series[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [deliverablesData, seriesData] = await Promise.all([
        getProjectDeliverables(projectId),
        getProjectSeries(projectId),
      ]);
      setDeliverables(deliverablesData);
      setSeries(seriesData);
    } catch (err) {
      console.error('Error loading project data:', err);
    }
  }, [projectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
  }, [loadData]);

  const handleDeliverablePress = (deliverable: Deliverable) => {
    (navigation as any).navigate('DeliverableReview', {deliverableId: deliverable.id});
  };

  const handleSeriesPress = (s: Series) => {
    navigation.navigate('SeriesItems', {
      seriesId: s.id,
      seriesName: s.name,
      seriesDescription: s.description,
      thumbnailUrl: s.thumbnail,
      itemCount: s.item_count,
    });
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Image source={{uri: DEFAULT_THUMBNAIL}} style={styles.emptyThumb} resizeMode="cover" />
      <Text style={styles.emptyTitle}>NO DELIVERABLES</Text>
      <Text style={styles.emptySubtitle}>Deliverables for this project will appear here</Text>
    </View>
  );

  return (
    <Animated.ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          tintColor={theme.colors.textPrimary}
        />
      }>
      {series.length > 0 && (
        <View style={styles.seriesSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>SERIES</Text>
            <Text style={styles.deliverableCount}>{series.length}</Text>
          </View>
          <View style={styles.seriesList}>
            {series.map((s) => (
              <TouchableOpacity
                key={s.id}
                style={styles.seriesCard}
                onPress={() => handleSeriesPress(s)}
                activeOpacity={0.85}>
                {s.thumbnail ? (
                  <Image
                    source={{uri: s.thumbnail}}
                    style={styles.seriesCardImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.seriesCardPlaceholder}>
                    <Image
                      source={{uri: DEFAULT_THUMBNAIL}}
                      style={styles.defaultThumb}
                      resizeMode="cover"
                    />
                  </View>
                )}
                <LinearGradient
                  colors={[
                    'rgba(0,0,0,0.8)',
                    'rgba(0,0,0,0.5)',
                    'rgba(0,0,0,0.2)',
                    'transparent',
                  ]}
                  start={{x: 0, y: 0.5}}
                  end={{x: 1, y: 0.5}}
                  style={styles.seriesCardGradient}
                />
                <View style={styles.seriesCardContent}>
                  <Text style={styles.seriesCardName} numberOfLines={1}>
                    {s.name}
                  </Text>
                  <Text style={styles.seriesCardCount}>
                    {s.item_count} {s.item_count === 1 ? 'ITEM' : 'ITEMS'}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

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
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 100,
  },
  seriesSection: {
    backgroundColor: theme.colors.background,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
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
  seriesList: {
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  seriesCard: {
    width: '100%',
    height: 72,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
    position: 'relative',
  },
  seriesCardImage: {
    ...StyleSheet.absoluteFillObject,
  },
  seriesCardPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seriesCardGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  seriesCardContent: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.md,
  },
  seriesCardName: {
    color: '#FFFFFF',
    fontSize: 17,
    fontFamily: theme.typography.fontFamily.bold,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 3,
  },
  seriesCardCount: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.medium,
    letterSpacing: 1.5,
    marginTop: 4,
  },
  deliverablesSection: {
    backgroundColor: theme.colors.background,
    paddingTop: theme.spacing.lg,
    minHeight: SCREEN_HEIGHT * 0.4,
  },
  cardList: {
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.md,
  },
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
  defaultThumb: {
    width: '100%',
    height: '100%',
    opacity: 0.9,
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
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 3,
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
    width: 56,
    height: 56,
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
