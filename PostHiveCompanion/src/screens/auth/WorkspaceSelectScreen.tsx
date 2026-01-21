import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Star, Plus} from 'lucide-react-native';
import {theme} from '../../theme';
import {Workspace} from '../../lib/types';

interface WorkspaceSelectScreenProps {
  workspaces: Workspace[];
  onSelectWorkspace: (workspace: Workspace) => void;
  primaryWorkspaceId?: string;
  onCreateWorkspace?: () => void;
}

// Get tier display info matching web app
const getTierDisplayInfo = (tier: string) => {
  switch (tier) {
    case 'enterprise':
      return {name: 'Enterprise', isPremium: true};
    case 'pro':
      return {name: 'Pro', isPremium: false};
    case 'team':
      return {name: 'Team', isPremium: false};
    default:
      return {name: 'Free', isPremium: false};
  }
};

export function WorkspaceSelectScreen({
  workspaces,
  onSelectWorkspace,
  primaryWorkspaceId,
  onCreateWorkspace,
}: WorkspaceSelectScreenProps) {
  const renderWorkspace = ({item}: {item: Workspace}) => {
    const tierInfo = getTierDisplayInfo(item.tier || 'free');
    const isPrimary = primaryWorkspaceId === item.id;

    return (
      <TouchableOpacity
        style={styles.workspaceItem}
        onPress={() => onSelectWorkspace(item)}
        activeOpacity={0.7}>
        <View style={styles.workspaceInfo}>
          <Text style={styles.workspaceName}>{item.name}</Text>
          <Text
            style={[
              styles.tierLabel,
              tierInfo.isPremium && styles.tierLabelPremium,
            ]}>
            {tierInfo.name}
          </Text>
        </View>
        <Star
          size={20}
          color={isPrimary ? '#facc15' : 'rgba(255, 255, 255, 0.3)'}
          fill={isPrimary ? '#facc15' : 'transparent'}
          style={[
            styles.starIcon,
            !isPrimary && styles.starIconMuted,
          ]}
        />
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyText}>
        Create your first workspace to get started
      </Text>
      <Text style={styles.emptySubtext}>
        Invitations to existing workspaces will appear here
      </Text>
      {onCreateWorkspace && (
        <TouchableOpacity
          style={styles.createButtonOutline}
          onPress={onCreateWorkspace}
          activeOpacity={0.7}>
          <Plus size={16} color={theme.colors.textPrimary} />
          <Text style={styles.createButtonOutlineText}>Create Workspace</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Big Centered Logo */}
      <View style={styles.logoContainer}>
        <Text style={styles.logo}>POSTHIVE</Text>
      </View>

      {/* Centered Heading */}
      <View style={styles.headingContainer}>
        <Text style={styles.heading}>Your Workspaces</Text>
      </View>

      {/* New Button */}
      {onCreateWorkspace && workspaces.length > 0 && (
        <View style={styles.actionBar}>
          <TouchableOpacity
            style={styles.newButton}
            onPress={onCreateWorkspace}
            activeOpacity={0.7}>
            <Plus size={16} color={theme.colors.textInverse} />
            <Text style={styles.newButtonText}>New</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Workspaces List */}
      {workspaces.length === 0 ? (
        renderEmptyState()
      ) : (
        <FlatList
          data={workspaces}
          keyExtractor={item => item.id}
          renderItem={renderWorkspace}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  logoContainer: {
    alignItems: 'center',
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
  },
  logo: {
    color: theme.colors.textPrimary,
    fontSize: 42, // Matches splash animation end size (56 * 0.75)
    fontWeight: '900',
    letterSpacing: -0.75,
  },
  headingContainer: {
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  heading: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.fontSize.xl,
    fontWeight: '500',
  },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.textPrimary,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm + 2,
    gap: theme.spacing.sm,
  },
  newButtonText: {
    color: theme.colors.textInverse,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '300',
  },
  list: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  workspaceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    backgroundColor: 'transparent',
  },
  workspaceInfo: {
    flex: 1,
  },
  workspaceName: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSize.xl,
    fontWeight: '500',
    marginBottom: 4,
  },
  tierLabel: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: theme.typography.fontSize.xs,
  },
  tierLabelPremium: {
    color: '#d4af37', // Premium gold color
  },
  starIcon: {
    marginLeft: theme.spacing.md,
  },
  starIconMuted: {
    opacity: 0.5,
  },
  separator: {
    height: theme.spacing.md,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  emptyText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.fontSize.md,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
  },
  emptySubtext: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.fontSize.sm,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  createButtonOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm + 4,
    gap: theme.spacing.sm,
  },
  createButtonOutlineText: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '400',
  },
});
