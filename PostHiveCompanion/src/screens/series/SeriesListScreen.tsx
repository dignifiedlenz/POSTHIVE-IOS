import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {StackNavigationProp} from '@react-navigation/stack';
import {ChevronLeft} from 'lucide-react-native';
import LinearGradient from 'react-native-linear-gradient';
import {theme} from '../../theme';
import {BrandedLoadingScreen} from '../../components/BrandedLoadingScreen';
import {useAuth} from '../../hooks/useAuth';
import {getWorkspaceSeries} from '../../lib/api';
import {Series} from '../../lib/types';
import {ReviewStackParamList} from '../../app/App';

type NavigationProp = StackNavigationProp<ReviewStackParamList, 'SeriesList'>;

const {width: SCREEN_WIDTH} = Dimensions.get('window');
const CARD_HEIGHT = 88;
const DEFAULT_THUMBNAIL = 'https://www.posthive.app/thumbnail/default.png';

interface SeriesCardProps {
  series: Series;
  onPress: () => void;
}

function SeriesCard({series, onPress}: SeriesCardProps) {
  return (
    <TouchableOpacity
      style={styles.seriesCard}
      onPress={onPress}
      activeOpacity={0.85}>
      {series.thumbnail ? (
        <Image
          source={{uri: series.thumbnail}}
          style={styles.cardImage}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.placeholderBackground}>
          <Image source={{uri: DEFAULT_THUMBNAIL}} style={styles.defaultThumb} resizeMode="cover" />
        </View>
      )}
      <LinearGradient
        colors={['rgba(0,0,0,0.8)', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.2)', 'transparent']}
        start={{x: 0, y: 0.5}}
        end={{x: 1, y: 0.5}}
        style={styles.gradientOverlay}
      />
      <View style={styles.cardContent}>
        <Text style={styles.seriesName} numberOfLines={1}>
          {series.name}
        </Text>
        <Text style={styles.itemCount}>
          {series.item_count} {series.item_count === 1 ? 'ITEM' : 'ITEMS'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export function SeriesListScreen() {
  const navigation = useNavigation<NavigationProp>();
  const canGoBack = navigation.canGoBack();
  const {currentWorkspace} = useAuth();
  const [series, setSeries] = useState<Series[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadSeries = useCallback(async () => {
    if (!currentWorkspace?.id) return;
    try {
      const data = await getWorkspaceSeries(currentWorkspace.id);
      setSeries(data);
    } catch (err) {
      console.error('Error loading series:', err);
    }
  }, [currentWorkspace?.id]);

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await loadSeries();
      setIsLoading(false);
    };
    init();
  }, [loadSeries]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadSeries();
    setIsRefreshing(false);
  }, [loadSeries]);

  const handleSeriesPress = (s: Series) => {
    navigation.navigate('SeriesItems', {
      seriesId: s.id,
      seriesName: s.name,
      seriesDescription: s.description,
      thumbnailUrl: s.thumbnail,
      itemCount: s.item_count,
    });
  };

  if (isLoading) {
    return <BrandedLoadingScreen message="Loading series..." />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        {canGoBack ? (
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
            <ChevronLeft size={22} color={theme.colors.textPrimary} />
          </TouchableOpacity>
        ) : (
          <View style={styles.backButton} />
        )}
        <Text style={styles.headerTitle}>SERIES</Text>
        <View style={styles.backButton} />
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionLabel}>ALL SERIES</Text>
        <Text style={styles.sectionCount}>{series.length}</Text>
      </View>

      <FlatList
        data={series}
        keyExtractor={item => item.id}
        renderItem={({item}) => (
          <SeriesCard series={item} onPress={() => handleSeriesPress(item)} />
        )}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Image source={{uri: DEFAULT_THUMBNAIL}} style={styles.emptyThumb} resizeMode="cover" />
            <Text style={styles.emptyTitle}>NO SERIES</Text>
            <Text style={styles.emptySubtitle}>
              Series will appear here when created in projects
            </Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.textPrimary}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.semibold,
    letterSpacing: 1.5,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  sectionLabel: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semibold,
    letterSpacing: 2,
  },
  sectionCount: {
    color: theme.colors.textDisabled,
    fontSize: 11,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingBottom: theme.spacing.xl,
  },
  seriesCard: {
    width: SCREEN_WIDTH,
    height: CARD_HEIGHT,
    overflow: 'hidden',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    position: 'relative',
  },
  cardImage: {
    ...StyleSheet.absoluteFillObject,
  },
  placeholderBackground: {
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
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  cardContent: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.md,
  },
  seriesName: {
    color: '#FFFFFF',
    fontSize: 17,
    fontFamily: theme.typography.fontFamily.bold,
    fontWeight: '700',
  },
  itemCount: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.medium,
    letterSpacing: 1.5,
    marginTop: 4,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xxl,
    paddingHorizontal: theme.spacing.xl,
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.xl,
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
