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
import {LogOut, User, Building2, Mail, RefreshCw, Bell, ChevronRight, ChevronLeft, FileText, HelpCircle, MessageSquare, History, Trash2} from 'lucide-react-native';
import {theme} from '../../theme';
import {useAuth} from '../../hooks/useAuth';
import {requestAccountDeletion} from '../../lib/api';
import {WorkspaceDropdownModal} from '../../components/WorkspaceDropdownModal';
import {useStaggeredAnimation} from '../../hooks/useStaggeredAnimation';

export function ProfileScreen() {
  const navigation = useNavigation();
  const {user, session, currentWorkspace, workspaces, signOut, selectWorkspace} = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
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

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete account',
      'This permanently deletes your PostHive account. If you are the only member of a workspace you created, deletion may be blocked until you add another member or remove the workspace on the web app.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Are you sure?',
              'This cannot be undone. Your account and access will be removed.',
              [
                {text: 'Cancel', style: 'cancel'},
                {
                  text: 'Delete permanently',
                  style: 'destructive',
                  onPress: async () => {
                    if (!session?.access_token) {
                      Alert.alert('Error', 'Not signed in.');
                      return;
                    }
                    setIsDeletingAccount(true);
                    try {
                      await requestAccountDeletion(session.access_token);
                      await signOut();
                      Alert.alert('Account deleted', 'Your account has been removed.');
                    } catch (e) {
                      const msg = e instanceof Error ? e.message : 'Deletion failed';
                      Alert.alert('Could not delete account', msg);
                    } finally {
                      setIsDeletingAccount(false);
                    }
                  },
                },
              ],
            );
          },
        },
      ],
    );
  };

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
      <View style={styles.screenHeader}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
          accessibilityRole="button"
          accessibilityLabel="Back">
          <ChevronLeft size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.screenHeaderTitle}>ACCOUNT</Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView 
        style={styles.content} 
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}>
        {/* Avatar Section */}
        <Animated.View style={[styles.avatarSection, getAnimatedStyle(0)]}>
          <View style={styles.avatar}>
            <User size={22} color={theme.colors.textPrimary} />
          </View>
          <Text style={styles.userName} numberOfLines={2}>
            {userName}
          </Text>
        </Animated.View>

        {/* Info Cards */}
        <Animated.View style={[styles.infoSection, getAnimatedStyle(1)]}>
          {user?.email && (
            <TouchableOpacity style={styles.infoCard} activeOpacity={0.7}>
              <View style={styles.infoIcon}>
                <Mail size={14} color={theme.colors.textSecondary} />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>EMAIL</Text>
                <Text style={styles.infoValue} numberOfLines={1}>{user.email}</Text>
              </View>
            </TouchableOpacity>
          )}

          {currentWorkspace && canSwitchWorkspace && (
            <TouchableOpacity
              style={styles.infoCard}
              activeOpacity={0.7}
              onPress={() => setShowWorkspaceDropdown(true)}>
              <View style={styles.infoIcon}>
                <Building2 size={14} color={theme.colors.textSecondary} />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>WORKSPACE</Text>
                <Text style={styles.infoValue} numberOfLines={1}>
                  {currentWorkspace.name}
                </Text>
              </View>
              <ChevronRight size={16} color={theme.colors.textMuted} />
            </TouchableOpacity>
          )}
        </Animated.View>

        {/* Settings Section */}
        <Animated.View style={[styles.settingsSection, getAnimatedStyle(2)]}>
          <View style={styles.settingsCard}>
            <TouchableOpacity
              style={styles.settingsButton}
              onPress={() => navigation.navigate('TransferHistory' as never)}
              activeOpacity={0.7}>
              <View style={styles.settingsButtonIcon}>
                <History size={14} color={theme.colors.textSecondary} />
              </View>
              <View style={styles.settingsButtonContent}>
                <Text style={styles.settingsButtonTitle}>Transfer History</Text>
                <Text style={styles.settingsButtonSubtitle} numberOfLines={1}>
                  File transfer activity
                </Text>
              </View>
              <ChevronRight size={16} color={theme.colors.textMuted} />
            </TouchableOpacity>

            <View style={styles.separator} />

            <TouchableOpacity
              style={styles.settingsButton}
              onPress={() => navigation.navigate('NotificationSettings' as never)}
              activeOpacity={0.7}>
              <View style={styles.settingsButtonIcon}>
                <Bell size={14} color={theme.colors.textSecondary} />
              </View>
              <View style={styles.settingsButtonContent}>
                <Text style={styles.settingsButtonTitle}>Notifications</Text>
                <Text style={styles.settingsButtonSubtitle} numberOfLines={1}>
                  Push & email
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
                <FileText size={14} color={theme.colors.textSecondary} />
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
                <FileText size={14} color={theme.colors.textSecondary} />
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
                Linking.openURL(`mailto:lorenz@posthive.app?subject=${subject}&body=${body}`).catch(() => {
                  Alert.alert('Error', 'Unable to open email client');
                });
              }}
              activeOpacity={0.7}>
              <View style={styles.settingsButtonIcon}>
                <HelpCircle size={14} color={theme.colors.textSecondary} />
              </View>
              <View style={styles.settingsButtonContent}>
                <Text style={styles.settingsButtonTitle}>Contact Support</Text>
                <Text style={styles.settingsButtonSubtitle} numberOfLines={1}>
                  Email support
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
                Linking.openURL(`mailto:lorenz@posthive.app?subject=${subject}&body=${body}`).catch(() => {
                  Alert.alert('Error', 'Unable to open email client');
                });
              }}
              activeOpacity={0.7}>
              <View style={styles.settingsButtonIcon}>
                <MessageSquare size={14} color={theme.colors.textSecondary} />
              </View>
              <View style={styles.settingsButtonContent}>
                <Text style={styles.settingsButtonTitle}>Feedback</Text>
                <Text style={styles.settingsButtonSubtitle} numberOfLines={1}>
                  Bugs & ideas
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
            style={styles.deleteAccountButton}
            onPress={handleDeleteAccount}
            disabled={isDeletingAccount || isLoggingOut}
            activeOpacity={0.8}>
            {isDeletingAccount ? (
              <ActivityIndicator size="small" color={theme.colors.error} />
            ) : (
              <>
                <Trash2 size={16} color={theme.colors.error} />
                <Text style={styles.deleteAccountText}>Delete account</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
            disabled={isLoggingOut || isDeletingAccount}
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
  screenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.xs,
    paddingBottom: theme.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  screenHeaderTitle: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: '600',
    color: theme.colors.textMuted,
    letterSpacing: theme.typography.letterSpacing.wide,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xl + theme.spacing.md,
  },
  avatarSection: {
    alignItems: 'center',
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xs,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.xs,
  },
  userName: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: theme.typography.letterSpacing.wide,
    textAlign: 'center',
  },
  infoSection: {
    gap: 2,
    marginTop: theme.spacing.sm,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  infoIcon: {
    width: 28,
    height: 28,
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
    marginBottom: 0,
  },
  infoValue: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textPrimary,
    marginTop: 1,
  },
  settingsSection: {
    marginTop: theme.spacing.md,
  },
  settingsCard: {
    backgroundColor: 'transparent',
  },
  settingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.sm,
    minHeight: theme.sizes.buttonHeight,
  },
  separator: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginLeft: theme.spacing.md + 28 + theme.spacing.sm,
  },
  settingsButtonIcon: {
    width: 28,
    height: 28,
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
    marginBottom: 0,
  },
  settingsButtonSubtitle: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.textSecondary,
    marginTop: 2,
    lineHeight: 14,
  },
  actionsSection: {
    marginTop: theme.spacing.lg,
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
  deleteAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    backgroundColor: 'transparent',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    minHeight: 44,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  deleteAccountText: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.error,
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

