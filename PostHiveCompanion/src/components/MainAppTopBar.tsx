import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import {Menu, ChevronDown} from 'lucide-react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {theme} from '../theme';
import {useAuth} from '../hooks/useAuth';
import {useSidebarDrawer} from '../contexts/SidebarDrawerContext';
import {WorkspaceDropdownModal} from './WorkspaceDropdownModal';

/** PNG-first URLs — RN Image is unreliable with .ico on some Android builds */
const FAVICON_CANDIDATES = [
  'https://www.google.com/s2/favicons?domain=posthive.app&sz=128',
  'https://www.posthive.app/apple-touch-icon.png',
  'https://posthive.app/apple-touch-icon.png',
];

const {width: SCREEN_W} = Dimensions.get('window');
const LEFT_CLUSTER_MAX = Math.min(SCREEN_W * 0.62, SCREEN_W - 120);

export function MainAppTopBar() {
  const insets = useSafeAreaInsets();
  const {openSidebar} = useSidebarDrawer();
  const {currentWorkspace, workspaces, selectWorkspace} = useAuth();
  const [showWorkspaceDropdown, setShowWorkspaceDropdown] = useState(false);
  const [faviconAttempt, setFaviconAttempt] = useState(0);

  const showMarkFallback = faviconAttempt >= FAVICON_CANDIDATES.length;
  const faviconUri = FAVICON_CANDIDATES[Math.min(faviconAttempt, FAVICON_CANDIDATES.length - 1)];

  return (
    <>
      <View style={[styles.wrap, {paddingTop: insets.top + 6, zIndex: 300}]}>
        <View style={styles.shell}>
          <View style={styles.row}>
            <View style={[styles.leftCluster, {maxWidth: LEFT_CLUSTER_MAX}]}>
              <View style={styles.faviconPlate}>
                {showMarkFallback ? (
                  <View style={styles.faviconFallback}>
                    <Text style={styles.faviconFallbackText}>PH</Text>
                  </View>
                ) : (
                  <Image
                    key={faviconUri}
                    source={{uri: faviconUri}}
                    style={styles.favicon}
                    resizeMode="cover"
                    accessibilityLabel="PostHive"
                    onError={() =>
                      setFaviconAttempt(a =>
                        a + 1 >= FAVICON_CANDIDATES.length ? FAVICON_CANDIDATES.length : a + 1,
                      )
                    }
                  />
                )}
              </View>
              <TouchableOpacity
                style={styles.workspaceTap}
                onPress={() => setShowWorkspaceDropdown(true)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Choose workspace">
                <View style={styles.workspaceRow}>
                  <Text style={styles.workspaceName} numberOfLines={1}>
                    {currentWorkspace?.name || 'Select workspace'}
                  </Text>
                  <ChevronDown size={16} color={theme.colors.textPrimary} />
                </View>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              onPress={openSidebar}
              hitSlop={{top: 12, bottom: 12, left: 12, right: 12}}
              accessibilityRole="button"
              accessibilityLabel="Open menu"
              style={styles.menuBtn}>
              <Menu size={24} color={theme.colors.textPrimary} strokeWidth={2} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
      <WorkspaceDropdownModal
        visible={showWorkspaceDropdown}
        workspaces={workspaces}
        currentWorkspace={currentWorkspace}
        onSelectWorkspace={workspace => {
          selectWorkspace(workspace);
          setShowWorkspaceDropdown(false);
        }}
        onClose={() => setShowWorkspaceDropdown(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 12,
    paddingBottom: 6,
  },
  shell: {
    backgroundColor: 'transparent',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingLeft: 12,
    paddingRight: 10,
    minHeight: 52,
    backgroundColor: 'transparent',
  },
  leftCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  faviconPlate: {
    width: 34,
    height: 34,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  favicon: {
    width: '100%',
    height: '100%',
  },
  faviconFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  faviconFallbackText: {
    color: theme.colors.textPrimary,
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.bold,
    letterSpacing: -0.5,
  },
  workspaceTap: {
    flex: 1,
    minWidth: 0,
    marginLeft: 12,
    paddingVertical: 2,
  },
  workspaceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  workspaceName: {
    flex: 1,
    minWidth: 0,
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSize.md,
    fontFamily: theme.typography.fontFamily.bold,
  },
  menuBtn: {
    marginLeft: 8,
    padding: 4,
  },
});
