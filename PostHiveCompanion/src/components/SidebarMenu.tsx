import React, {useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {
  Mail,
  ChevronDown,
  X,
} from 'lucide-react-native';

import {theme} from '../theme';
import {useAuth} from '../hooks/useAuth';
import {WorkspaceDropdownModal} from './WorkspaceDropdownModal';
import {canAccessWorkspaceNotifications} from '../lib/utils';

const {width: SCREEN_WIDTH} = Dimensions.get('window');
/** Slightly wider so right-aligned labels (e.g. NOTIFICATION SETTINGS) breathe. */
export const SIDEBAR_WIDTH = Math.min(320, Math.round(SCREEN_WIDTH * 0.86));

interface SidebarMenuProps {
  onClose: () => void;
  currentRoute: string;
  onNavigate: (route: string, params?: object) => void;
}

interface MenuItem {
  label: string;
  action: 'tab' | 'screen' | 'link' | 'signout';
  route?: string;
  screen?: string;
  params?: object;
  url?: string;
  subtitle?: string;
  activeRoutes?: string[];
}

const primaryItems: MenuItem[] = [
  {
    label: 'Drive',
    action: 'screen',
    route: 'Menu',
    screen: 'DriveExplorer',
    activeRoutes: ['DriveExplorer'],
  },
  {
    label: 'Transfers',
    action: 'screen',
    route: 'Menu',
    screen: 'TransferHistory',
    activeRoutes: ['TransferHistory', 'TransferDetail'],
  },
  {
    label: 'Notifications',
    action: 'screen',
    route: 'Menu',
    screen: 'Notifications',
    activeRoutes: ['Notifications'],
  },
];

const footerItems: MenuItem[] = [
  {
    label: 'Account',
    action: 'screen',
    route: 'Menu',
    screen: 'Profile',
    activeRoutes: ['Profile'],
  },
  {
    label: 'Notification Settings',
    action: 'screen',
    route: 'Menu',
    screen: 'NotificationSettings',
  },
  {
    label: 'Privacy Policy',
    action: 'link',
    url: 'https://www.posthive.app/legal/privacy',
  },
  {
    label: 'Terms of Service',
    action: 'link',
    url: 'https://www.posthive.app/legal/terms',
  },
  {
    label: 'Contact Support',
    action: 'link',
    url: 'mailto:lorenz@posthive.app?subject=Support%20Request',
  },
  {
    label: 'Feedback',
    action: 'link',
    url: 'mailto:lorenz@posthive.app?subject=App%20Feedback',
  },
  {
    label: 'Sign Out',
    action: 'signout',
  },
];

export function SidebarMenu({
  onClose,
  currentRoute,
  onNavigate,
}: SidebarMenuProps) {
  const insets = useSafeAreaInsets();
  const {user, currentWorkspace, workspaces, selectWorkspace, signOut} = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [showWorkspaceDropdown, setShowWorkspaceDropdown] = useState(false);

  const userName = useMemo(
    () =>
      user?.user_metadata?.name ||
      user?.user_metadata?.full_name ||
      user?.email?.split('@')[0] ||
      'User',
    [user],
  );

  const navPrimaryItems = useMemo(() => {
    if (canAccessWorkspaceNotifications(currentWorkspace?.role)) {
      return primaryItems;
    }
    return primaryItems.filter(i => i.label !== 'Notifications');
  }, [currentWorkspace?.role]);

  const runItemAction = async (item: MenuItem) => {
    if (item.action === 'tab' && item.route) {
      onNavigate(item.route, item.params);
      onClose();
      return;
    }

    if (item.action === 'screen' && item.route && item.screen) {
      onNavigate(item.route, item.params ?? {screen: item.screen});
      onClose();
      return;
    }

    if (item.action === 'link' && item.url) {
      await Linking.openURL(item.url);
      onClose();
      return;
    }

    if (item.action === 'signout') {
      Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            setIsSigningOut(true);
            try {
              await signOut();
            } finally {
              setIsSigningOut(false);
              onClose();
            }
          },
        },
      ]);
    }
  };

  const handleItemPress = (item: MenuItem) => {
    void runItemAction(item).catch(() => {
      Alert.alert('Action failed', 'Unable to complete that action right now.');
    });
  };

  const padEnd = Math.max(20, insets.right + 4);
  const padStart = Math.max(20, insets.left + 4);

  return (
    <View style={styles.sidebar}>
      <View
        style={[
          styles.content,
          {
            paddingTop: insets.top + 14,
            paddingBottom: insets.bottom + 18,
            paddingRight: padEnd,
            paddingLeft: padStart,
          },
        ]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.workspaceSwitcher}
            onPress={() => setShowWorkspaceDropdown(true)}
            activeOpacity={0.8}>
            <Text style={styles.workspaceSwitcherLabel}>Workspace</Text>
            <View style={styles.workspaceSwitcherRow}>
              <Text style={styles.workspaceSwitcherName} numberOfLines={1}>
                {currentWorkspace?.name || 'Select workspace'}
              </Text>
              <ChevronDown size={16} color={theme.colors.textPrimary} />
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeButton}
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
            accessibilityRole="button"
            accessibilityLabel="Close menu">
            <X size={22} color={theme.colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <View style={styles.profileCard}>
          <View style={styles.profileText}>
            <Text style={styles.profileName} numberOfLines={1}>
              {userName}
            </Text>
            {user?.email ? (
              <View style={styles.metaRow}>
                <Text style={styles.metaText} numberOfLines={1}>
                  {user.email}
                </Text>
                <Mail size={12} color={theme.colors.textMuted} />
              </View>
            ) : null}
          </View>
        </View>

        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Navigate</Text>
            <View style={styles.menuItems}>
              {navPrimaryItems.map(item => {
                const isActive = item.activeRoutes?.includes(currentRoute) ?? false;

                return (
                  <TouchableOpacity
                    key={item.label}
                    style={[styles.menuItem, isActive && styles.menuItemActive]}
                    onPress={() => handleItemPress(item)}
                    activeOpacity={0.75}>
                    <View style={styles.menuItemContent}>
                      <Text
                        style={[styles.menuItemText, isActive && styles.menuItemTextActive]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.85}>
                        {item.label}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.sectionDivider} />

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>More</Text>
            <View style={styles.menuItems}>
              {footerItems.map(item => {
                const isBusy = item.action === 'signout' && isSigningOut;

                return (
                  <TouchableOpacity
                    key={item.label}
                    style={styles.footerItem}
                    onPress={() => handleItemPress(item)}
                    activeOpacity={0.75}
                    disabled={isBusy}>
                    {isBusy ? (
                      <ActivityIndicator size="small" color={theme.colors.textSecondary} />
                    ) : null}
                    <Text style={styles.footerItemText} numberOfLines={1}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </ScrollView>
      </View>
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
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    flex: 1,
    backgroundColor: '#000',
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: 'rgba(255,255,255,0.08)',
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  closeButton: {
    padding: 4,
    marginTop: 2,
  },
  workspaceSwitcher: {
    flex: 1,
    minWidth: 0,
    alignItems: 'flex-end',
  },
  workspaceSwitcherLabel: {
    alignSelf: 'flex-end',
    color: theme.colors.textMuted,
    fontSize: theme.typography.fontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  workspaceSwitcherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    maxWidth: '100%',
  },
  workspaceSwitcherName: {
    flexShrink: 1,
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSize.md,
    fontFamily: theme.typography.fontFamily.bold,
    textAlign: 'right',
  },
  profileCard: {
    flexDirection: 'row',
    paddingTop: 18,
    paddingBottom: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'flex-end',
  },
  profileText: {
    maxWidth: '100%',
    gap: 4,
    alignItems: 'flex-end',
  },
  profileName: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSize.md,
    fontFamily: theme.typography.fontFamily.bold,
    textAlign: 'right',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'flex-end',
    maxWidth: '100%',
  },
  metaText: {
    flexShrink: 1,
    color: theme.colors.textMuted,
    fontSize: theme.typography.fontSize.xs,
    textAlign: 'right',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 8,
    paddingBottom: 8,
  },
  section: {
    paddingTop: 14,
  },
  sectionLabel: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.fontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 8,
    textAlign: 'right',
    alignSelf: 'stretch',
  },
  sectionDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginVertical: 14,
  },
  menuItems: {
    gap: 2,
  },
  menuItem: {
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: 8,
    alignItems: 'flex-end',
  },
  menuItemActive: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  menuItemContent: {
    alignItems: 'flex-end',
    maxWidth: '100%',
  },
  menuItemText: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSize.md,
    fontFamily: theme.typography.fontFamily.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    textAlign: 'right',
  },
  menuItemTextActive: {
    color: theme.colors.textPrimary,
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  footerItemText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.fontSize.sm,
    textAlign: 'right',
  },
});
