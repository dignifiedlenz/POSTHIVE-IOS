import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  Linking,
  Platform,
  Animated,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {LogOut, User, Building2, Mail, RefreshCw, Bell, ChevronRight, FileText, HelpCircle, MessageSquare} from 'lucide-react-native';
import {theme} from '../../theme';
import {useAuth} from '../../hooks/useAuth';
import {WorkspaceDropdownModal} from '../../components/WorkspaceDropdownModal';
import {useStaggeredAnimation} from '../../hooks/useStaggeredAnimation';

export function ProfileScreen() {
  const navigation = useNavigation();
  const {user, currentWorkspace, workspaces, signOut, selectWorkspace} = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showWorkspaceDropdown, setShowWorkspaceDropdown] = useState(false);
  const canSwitchWorkspace = workspaces.length > 1;

  // Staggered animations - 5 sections: avatar, info, settings, legal, actions
  const {getAnimatedStyle} = useStaggeredAnimation({
    itemCount: 5,
    staggerDelay: 60,
    duration: 350,
    initialDelay: 50,
  });

  const userName =
    user?.user_metadata?.name ||
    user?.user_metadata?.full_name ||
    user?.email?.split('@')[0] ||
    'User';

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            setIsLoggingOut(true);
            try {
              await signOut();
            } catch (error) {
              Alert.alert('Error', 'Failed to sign out. Please try again.');
            } finally {
              setIsLoggingOut(false);
            }
          },
        },
      ],
      {cancelable: true},
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView 
        style={styles.content} 
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}>
        {/* Avatar Section */}
        <Animated.View style={[styles.avatarSection, getAnimatedStyle(0)]}>
          <View style={styles.avatar}>
            <User size={32} color={theme.colors.textPrimary} />
          </View>
          <Text style={styles.userName}>{userName}</Text>
        </Animated.View>

        {/* Info Cards */}
        <Animated.View style={[styles.infoSection, getAnimatedStyle(1)]}>
          {user?.email && (
            <TouchableOpacity style={styles.infoCard} activeOpacity={0.7}>
              <View style={styles.infoIcon}>
                <Mail size={16} color={theme.colors.textSecondary} />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>EMAIL</Text>
                <Text style={styles.infoValue} numberOfLines={1}>{user.email}</Text>
              </View>
            </TouchableOpacity>
          )}

          {currentWorkspace && (
            <TouchableOpacity 
              style={styles.infoCard} 
              activeOpacity={0.7}
              onPress={canSwitchWorkspace ? () => setShowWorkspaceDropdown(true) : undefined}>
              <View style={styles.infoIcon}>
                <Building2 size={16} color={theme.colors.textSecondary} />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>WORKSPACE</Text>
                <Text style={styles.infoValue} numberOfLines={1}>{currentWorkspace.name}</Text>
              </View>
              {canSwitchWorkspace && (
                <ChevronRight size={16} color={theme.colors.textMuted} />
              )}
            </TouchableOpacity>
          )}
        </Animated.View>

        {/* Settings Section */}
        <Animated.View style={[styles.settingsSection, getAnimatedStyle(2)]}>
          <View style={styles.settingsCard}>
            <TouchableOpacity
              style={styles.settingsButton}
              onPress={() => navigation.navigate('NotificationSettings' as never)}
              activeOpacity={0.7}>
              <View style={styles.settingsButtonIcon}>
                <Bell size={16} color={theme.colors.textSecondary} />
              </View>
              <View style={styles.settingsButtonContent}>
                <Text style={styles.settingsButtonTitle}>Notifications</Text>
                <Text style={styles.settingsButtonSubtitle} numberOfLines={1}>
                  Manage notification preferences
                </Text>
              </View>
              <ChevronRight size={16} color={theme.colors.textMuted} />
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Legal & Support Section */}
        <Animated.View style={[styles.settingsSection, getAnimatedStyle(3)]}>
          <View style={styles.settingsCard}>
            <TouchableOpacity
              style={styles.settingsButton}
              onPress={() => Linking.openURL('https://www.posthive.app/legal/privacy')}
              activeOpacity={0.7}>
              <View style={styles.settingsButtonIcon}>
                <FileText size={16} color={theme.colors.textSecondary} />
              </View>
              <View style={styles.settingsButtonContent}>
                <Text style={styles.settingsButtonTitle}>Privacy Policy</Text>
              </View>
              <ChevronRight size={16} color={theme.colors.textMuted} />
            </TouchableOpacity>

            <View style={styles.separator} />

            <TouchableOpacity
              style={styles.settingsButton}
              onPress={() => Linking.openURL('https://www.posthive.app/legal/terms')}
              activeOpacity={0.7}>
              <View style={styles.settingsButtonIcon}>
                <FileText size={16} color={theme.colors.textSecondary} />
              </View>
              <View style={styles.settingsButtonContent}>
                <Text style={styles.settingsButtonTitle}>Terms of Service</Text>
              </View>
              <ChevronRight size={16} color={theme.colors.textMuted} />
            </TouchableOpacity>

            <View style={styles.separator} />

            <TouchableOpacity
              style={styles.settingsButton}
              onPress={() => {
                const subject = encodeURIComponent('Support Request');
                const body = encodeURIComponent(`Workspace: ${currentWorkspace?.name || 'N/A'}\n\n`);
                Linking.openURL(`mailto:support@posthive.app?subject=${subject}&body=${body}`).catch(() => {
                  Alert.alert('Error', 'Unable to open email client');
                });
              }}
              activeOpacity={0.7}>
              <View style={styles.settingsButtonIcon}>
                <HelpCircle size={16} color={theme.colors.textSecondary} />
              </View>
              <View style={styles.settingsButtonContent}>
                <Text style={styles.settingsButtonTitle}>Contact Support</Text>
                <Text style={styles.settingsButtonSubtitle} numberOfLines={1}>
                  Get help or report an issue
                </Text>
              </View>
              <ChevronRight size={16} color={theme.colors.textMuted} />
            </TouchableOpacity>

            <View style={styles.separator} />

            <TouchableOpacity
              style={styles.settingsButton}
              onPress={() => {
                const subject = encodeURIComponent('App Feedback');
                const body = encodeURIComponent(`App Version: ${Platform.OS === 'ios' ? 'iOS' : 'Android'}\nWorkspace: ${currentWorkspace?.name || 'N/A'}\n\nFeedback:\n`);
                Linking.openURL(`mailto:feedback@posthive.app?subject=${subject}&body=${body}`).catch(() => {
                  Alert.alert('Error', 'Unable to open email client');
                });
              }}
              activeOpacity={0.7}>
              <View style={styles.settingsButtonIcon}>
                <MessageSquare size={16} color={theme.colors.textSecondary} />
              </View>
              <View style={styles.settingsButtonContent}>
                <Text style={styles.settingsButtonTitle}>Feedback</Text>
                <Text style={styles.settingsButtonSubtitle} numberOfLines={1}>
                  Share your thoughts or report bugs
                </Text>
              </View>
              <ChevronRight size={16} color={theme.colors.textMuted} />
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Actions Section */}
        <Animated.View style={[styles.actionsSection, getAnimatedStyle(4)]}>
          {canSwitchWorkspace && (
            <TouchableOpacity
              style={styles.switchWorkspaceButton}
              onPress={() => setShowWorkspaceDropdown(true)}
              activeOpacity={0.8}>
              <RefreshCw size={18} color={theme.colors.textPrimary} />
              <Text style={styles.switchWorkspaceText}>Switch Workspace</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
            disabled={isLoggingOut}
            activeOpacity={0.8}>
            {isLoggingOut ? (
              <ActivityIndicator size="small" color={theme.colors.textSecondary} />
            ) : (
              <>
                <LogOut size={16} color={theme.colors.textSecondary} />
                <Text style={styles.logoutText}>Sign Out</Text>
              </>
            )}
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>

      {/* Workspace Dropdown Modal */}
      <WorkspaceDropdownModal
        visible={showWorkspaceDropdown}
        workspaces={workspaces}
        currentWorkspace={currentWorkspace}
        onSelectWorkspace={(workspace) => {
          selectWorkspace(workspace);
          setShowWorkspaceDropdown(false);
        }}
        onClose={() => setShowWorkspaceDropdown(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent', // Show wave background
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.xl * 2,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: theme.spacing.lg,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.sm,
  },
  userName: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: theme.typography.letterSpacing.wide,
  },
  infoSection: {
    gap: theme.spacing.xs,
    marginTop: theme.spacing.md,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  infoIcon: {
    width: 32,
    height: 32,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: '600',
    color: theme.colors.textMuted,
    letterSpacing: theme.typography.letterSpacing.wide,
    marginBottom: 1,
  },
  infoValue: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textPrimary,
  },
  settingsSection: {
    marginTop: theme.spacing.lg,
  },
  settingsCard: {
    backgroundColor: 'transparent',
  },
  settingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  separator: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginLeft: theme.spacing.md + 32 + theme.spacing.md,
  },
  settingsButtonIcon: {
    width: 32,
    height: 32,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsButtonContent: {
    flex: 1,
  },
  settingsButtonTitle: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 1,
  },
  settingsButtonSubtitle: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.textSecondary,
  },
  actionsSection: {
    marginTop: theme.spacing.xl,
    gap: theme.spacing.xs,
  },
  switchWorkspaceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    minHeight: 44,
  },
  switchWorkspaceText: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: theme.typography.letterSpacing.wide,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    backgroundColor: 'transparent',
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
  },
  logoutText: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: theme.typography.letterSpacing.wide,
  },
});

