import React, {useCallback, useMemo} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Image,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {StackNavigationProp} from '@react-navigation/stack';
import {MessageCircle, Image as ImageIcon, Film} from 'lucide-react-native';
import {formatDistanceToNow} from 'date-fns';
import LinearGradient from 'react-native-linear-gradient';
import {theme} from '../../theme';
import {BrandedLoadingScreen} from '../../components/BrandedLoadingScreen';
import {useAuth} from '../../hooks/useAuth';
import {useDeliverables} from '../../hooks/useDeliverables';
import {Deliverable} from '../../lib/types';
import {DeliverablesStackParamList} from '../../app/App';

type NavigationProp = StackNavigationProp<DeliverablesStackParamList, 'RecentDeliverables'>;

const CARD_HEIGHT = 160;
const DEFAULT_THUMBNAIL = 'https://www.posthive.app/thumbnail/default.png';

interface DeliverableCardProps {
  deliverable: Deliverable;
  onPress: () => void;
}

function formatDueDateShort(dateString?: string | null): string | null {
  if (!dateString) return null;
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {month: 'short', day: 'numeric'});
  } catch {
    return null;
  }
}

function RecentDeliverableCard({deliverable, onPress}: DeliverableCardProps) {
  const hasUnreadComments =
    deliverable.unread_comment_count != null && deliverable.unread_comment_count > 0;
  const isGallery = deliverable.type === 'image_gallery';
  const isAudio = deliverable.type === 'audio';
  const isPdf = deliverable.type === 'pdf';
  const isDocument = deliverable.type === 'document';

  const timeAgo = deliverable.updated_at
    ? formatDistanceToNow(new Date(deliverable.updated_at), {addSuffix: true})
    : null;
  const dueDateShort = formatDueDateShort(deliverable.due_date);

  const versionLabel =
    deliverable.current_version === 100
      ? 'FINAL'
      : isGallery
        ? 'GALLERY'
        : isAudio || isPdf
          ? `V${deliverable.current_version ?? 1}`
          : isDocument
            ? 'DOC'
            : deliverable.current_version != null
              ? `V${deliverable.current_version}`
              : null;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
      {deliverable.thumbnail_url ? (
        <Image
          source={{uri: deliverable.thumbnail_url}}
          style={styles.thumbnail}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.thumbnailPlaceholder}>
          <Image
            source={{uri: DEFAULT_THUMBNAIL}}
            style={styles.defaultThumb}
            resizeMode="cover"
          />
        </View>
      )}

      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.35)', 'rgba(0,0,0,0.88)']}
        locations={[0, 0.5, 1]}
        style={styles.bottomGradient}
      />

      <View style={styles.cardContent}>
        <View style={styles.cardTopRow}>
          {versionLabel && <Text style={styles.versionText}>{versionLabel}</Text>}
          {hasUnreadComments && (
            <View style={styles.unreadBadge}>
              <MessageCircle size={12} color={theme.colors.textInverse} />
              <Text style={styles.unreadCount}>{deliverable.unread_comment_count}</Text>
            </View>
          )}
        </View>

        <View style={styles.titleSection}>
          {deliverable.project_name && (
            <Text style={styles.projectName} numberOfLines={1}>
              {deliverable.project_name.toUpperCase()}
            </Text>
          )}
          <Text style={styles.deliverableName} numberOfLines={1}>
            {deliverable.name}
          </Text>
          {isGallery && (
            <View style={styles.galleryMediaRow}>
              {(deliverable.photo_count ?? 0) > 0 && (
                <View style={styles.galleryMediaItem}>
                  <ImageIcon size={11} color={theme.colors.textMuted} />
                  <Text style={styles.galleryMediaText}>
                    {deliverable.photo_count}{' '}
                    {(deliverable.photo_count ?? 0) === 1 ? 'photo' : 'photos'}
                  </Text>
                </View>
              )}
              {(deliverable.video_count ?? 0) > 0 && (
                <View style={styles.galleryMediaItem}>
                  <Film size={11} color={theme.colors.textMuted} />
                  <Text style={styles.galleryMediaText}>
                    {deliverable.video_count}{' '}
                    {(deliverable.video_count ?? 0) === 1 ? 'video' : 'videos'}
                  </Text>
                </View>
              )}
              {(deliverable.photo_count ?? 0) === 0 &&
                (deliverable.video_count ?? 0) === 0 && (
                  <Text style={styles.galleryMediaText}>No media yet</Text>
                )}
            </View>
          )}
        </View>

        <View style={styles.cardBottomRow}>
          <Text style={styles.metaText}>
            {deliverable.comment_count ?? deliverable.unread_comment_count ?? 0} COMMENTS
          </Text>
          {(dueDateShort || timeAgo) && (
            <Text style={styles.metaText}>{dueDateShort || timeAgo}</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export function RecentDeliverablesScreen() {
  const navigation = useNavigation<NavigationProp>();
  const {user, currentWorkspace} = useAuth();
  const {deliverables, isLoading, isRefreshing, refresh} = useDeliverables({
    workspaceId: currentWorkspace?.id || '',
    userId: user?.id || '',
  });

  const sortedDeliverables = useMemo(
    () =>
      [...deliverables].sort((a, b) => {
        const dateA = new Date(a.updated_at || a.created_at).getTime();
        const dateB = new Date(b.updated_at || b.created_at).getTime();
        return dateB - dateA;
      }),
    [deliverables],
  );

  const handleDeliverablePress = useCallback(
    (deliverable: Deliverable) => {
      // DeliverableReview is a root-stack screen; cast bypasses the inner stack typing.
      (navigation as any).navigate('DeliverableReview', {
        deliverableId: deliverable.id,
      });
    },
    [navigation],
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Image
        source={{uri: DEFAULT_THUMBNAIL}}
        style={styles.emptyThumb}
        resizeMode="cover"
      />
      <Text style={styles.emptyTitle}>NO RECENT DELIVERABLES</Text>
      <Text style={styles.emptySubtitle}>
        Deliverables with recent activity will appear here
      </Text>
    </View>
  );

  if (isLoading) {
    return <BrandedLoadingScreen message="Loading recent deliverables..." />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <FlatList
        data={sortedDeliverables}
        keyExtractor={item => item.id}
        renderItem={({item}) => (
          <RecentDeliverableCard
            deliverable={item}
            onPress={() => handleDeliverablePress(item)}
          />
        )}
        contentContainerStyle={[
          styles.list,
          sortedDeliverables.length === 0 && styles.emptyList,
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
    backgroundColor: 'transparent',
  },
  list: {
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xl,
  },
  emptyList: {
    flexGrow: 1,
    paddingHorizontal: theme.spacing.md,
  },
  card: {
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    height: CARD_HEIGHT,
    borderRadius: 12,
    position: 'relative',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
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
  defaultThumb: {
    width: '100%',
    height: '100%',
    opacity: 0.9,
  },
  bottomGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '70%',
  },
  cardContent: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  versionText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.medium,
  },
  unreadBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.textPrimary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 4,
    borderRadius: 4,
  },
  unreadCount: {
    color: theme.colors.textInverse,
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.bold,
  },
  titleSection: {
    marginBottom: 4,
  },
  projectName: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 9,
    fontFamily: theme.typography.fontFamily.medium,
    letterSpacing: 1,
    marginBottom: 2,
  },
  deliverableName: {
    color: theme.colors.textPrimary,
    fontSize: 15,
    fontFamily: theme.typography.fontFamily.bold,
  },
  galleryMediaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  galleryMediaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  galleryMediaText: {
    color: 'rgba(255, 255, 255, 0.55)',
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.regular,
  },
  cardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaText: {
    color: 'rgba(255, 255, 255, 0.55)',
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.regular,
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
    minHeight: 200,
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
    marginBottom: theme.spacing.sm,
  },
  emptySubtitle: {
    color: theme.colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
  },
});
