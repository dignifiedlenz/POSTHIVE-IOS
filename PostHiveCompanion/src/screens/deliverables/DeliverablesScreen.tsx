import React, {useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {StackNavigationProp} from '@react-navigation/stack';
import {Film, MessageCircle, ChevronRight} from 'lucide-react-native';
import {formatDistanceToNow} from 'date-fns';
import LinearGradient from 'react-native-linear-gradient';
import {theme} from '../../theme';
import {BrandedLoadingScreen} from '../../components/BrandedLoadingScreen';
import {useAuth} from '../../hooks/useAuth';
import {useDeliverables} from '../../hooks/useDeliverables';
import {Deliverable} from '../../lib/types';
import {DeliverablesStackParamList} from '../../app/App';

type NavigationProp = StackNavigationProp<
  DeliverablesStackParamList,
  'DeliverablesList'
>;

const {width: SCREEN_WIDTH} = Dimensions.get('window');
const CARD_HEIGHT = 220;

interface DeliverableCardProps {
  deliverable: Deliverable;
  onPress: () => void;
}

function DeliverableThumbnailCard({deliverable, onPress}: DeliverableCardProps) {
  const hasUnreadComments =
    deliverable.unread_comment_count != null && deliverable.unread_comment_count > 0;

  // Format the date
  const timeAgo = deliverable.updated_at
    ? formatDistanceToNow(new Date(deliverable.updated_at), {addSuffix: true})
    : null;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.9}>
      {/* Full-bleed thumbnail */}
      {deliverable.thumbnail_url ? (
        <Image
          source={{uri: deliverable.thumbnail_url}}
          style={styles.thumbnail}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.thumbnailPlaceholder}>
          <Film size={48} color={theme.colors.textMuted} />
        </View>
      )}
      
      {/* Bottom gradient overlay - smooth fade from transparent to dark */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.7)', 'rgba(0,0,0,0.85)']}
        locations={[0, 0.4, 0.7, 1]}
        style={styles.bottomGradient}
      />
      
      {/* Version badge - top left */}
      {deliverable.current_version != null && (
        <Text style={styles.versionText}>
          {deliverable.current_version === 100 ? 'Final' : `V${deliverable.current_version}`}
        </Text>
      )}
      
      {/* Unread comments badge - top right */}
      {hasUnreadComments && (
        <View style={styles.unreadBadge}>
          <MessageCircle size={12} color={theme.colors.textInverse} />
          <Text style={styles.unreadCount}>{deliverable.unread_comment_count}</Text>
        </View>
      )}
      
      {/* Title and subtitle - bottom */}
      <View style={styles.cardContent}>
        <Text style={styles.deliverableName} numberOfLines={1}>
          {deliverable.name}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {timeAgo || deliverable.project_name}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export function DeliverablesScreen() {
  const navigation = useNavigation<NavigationProp>();
  const {user, currentWorkspace} = useAuth();
  const {deliverables, isLoading, isRefreshing, refresh} = useDeliverables({
    workspaceId: currentWorkspace?.id || '',
    userId: user?.id || '',
  });

  const handleDeliverablePress = useCallback(
    (deliverable: Deliverable) => {
      navigation.navigate('DeliverableReview', {
        deliverableId: deliverable.id,
      });
    },
    [navigation],
  );

  const handleShowAllProjects = useCallback(() => {
    navigation.navigate('Projects');
  }, [navigation]);

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Film size={40} color={theme.colors.textMuted} />
      <Text style={styles.emptyTitle}>NO ITEMS TO REVIEW</Text>
      <Text style={styles.emptySubtitle}>
        Deliverables with recent activity will appear here
      </Text>
    </View>
  );

  if (isLoading) {
    return <BrandedLoadingScreen message="Loading deliverables..." />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header with section label and all projects link */}
      <View style={styles.header}>
        <Text style={styles.sectionLabel}>REVIEW</Text>
        <TouchableOpacity 
          style={styles.allProjectsButton}
          onPress={handleShowAllProjects}>
          <Text style={styles.allProjectsText}>ALL PROJECTS</Text>
          <ChevronRight size={12} color={theme.colors.textMuted} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={deliverables}
        keyExtractor={item => item.id}
        renderItem={({item}) => (
          <DeliverableThumbnailCard
            deliverable={item}
            onPress={() => handleDeliverablePress(item)}
          />
        )}
        contentContainerStyle={[
          styles.list,
          deliverables.length === 0 && styles.emptyList,
        ]}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refresh}
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
    backgroundColor: 'transparent', // Show wave background
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
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
  allProjectsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  allProjectsText: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.semibold,
    letterSpacing: 1,
  },
  list: {
    paddingBottom: theme.spacing.xl,
  },
  emptyList: {
    flex: 1,
    paddingHorizontal: theme.spacing.md,
  },
  card: {
    width: SCREEN_WIDTH,
    height: CARD_HEIGHT,
    position: 'relative',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  thumbnail: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.surface,
  },
  thumbnailPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '60%',
  },
  versionText: {
    position: 'absolute',
    top: theme.spacing.md,
    left: theme.spacing.md,
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.medium,
  },
  unreadBadge: {
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
  unreadCount: {
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
  deliverableName: {
    color: theme.colors.textPrimary,
    fontSize: 20,
    fontFamily: theme.typography.fontFamily.semibold,
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.regular,
    marginTop: 4,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.colors.borderHover,
    marginTop: theme.spacing.md,
    marginHorizontal: theme.spacing.md,
  },
  emptyTitle: {
    color: theme.colors.textPrimary,
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semibold,
    letterSpacing: 2,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  emptySubtitle: {
    color: theme.colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
  },
});
