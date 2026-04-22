import React, {useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Platform,
  Linking,
} from 'react-native';
import {AppleNativeGlassSwitch} from '../../components/native/AppleNativeGlassSwitch';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {
  Bell,
  BellOff,
  ChevronLeft,
  Upload,
  MessageSquare,
  AtSign,
  CheckSquare,
  ExternalLink,
} from 'lucide-react-native';
import {AuthorizationStatus} from '@notifee/react-native';
import {theme} from '../../theme';
import {BrandedLoadingScreen} from '../../components/BrandedLoadingScreen';
import {useAuth} from '../../hooks/useAuth';
import {
  usePushNotifications,
  NotificationPreferences,
} from '../../hooks/usePushNotifications';

const DEFAULT_THUMBNAIL = 'https://www.posthive.app/thumbnail/default.png';

interface SettingRowProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}

function SettingRow({
  icon,
  title,
  subtitle,
  value,
  onValueChange,
  disabled,
}: SettingRowProps) {
  return (
    <View style={[styles.settingRow, disabled && styles.settingRowDisabled]}>
      <View style={styles.settingIcon}>{icon}</View>
      <View style={styles.settingContent}>
        <Text style={[styles.settingTitle, disabled && styles.textDisabled]}>
          {title}
        </Text>
        {subtitle && (
          <Text style={[styles.settingSubtitle, disabled && styles.textDisabled]}>
            {subtitle}
          </Text>
        )}
      </View>
      <AppleNativeGlassSwitch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        accessibilityLabel={title}
      />
    </View>
  );
}

export function NotificationSettingsScreen() {
  const navigation = useNavigation();
  const {user, currentWorkspace} = useAuth();

  const {
    permissionStatus,
    isLoading,
    preferences,
    hasPermission,
    requestPermission,
    updatePreferences,
  } = usePushNotifications({
    userId: user?.id,
    workspaceId: currentWorkspace?.id,
  });

  const handleRequestPermission = useCallback(async () => {
    const granted = await requestPermission();
    if (granted) {
      updatePreferences({enabled: true});
    }
  }, [requestPermission, updatePreferences]);

  const handleToggleMaster = useCallback(
    (value: boolean) => {
      if (value && !hasPermission) {
        handleRequestPermission();
      } else {
        updatePreferences({enabled: value});
      }
    },
    [hasPermission, handleRequestPermission, updatePreferences],
  );

  const handleToggle = useCallback(
    (key: keyof NotificationPreferences) => (value: boolean) => {
      updatePreferences({[key]: value});
    },
    [updatePreferences],
  );

  const openSystemSettings = useCallback(() => {
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    } else {
      Linking.openSettings();
    }
  }, []);

  const isDisabled = !preferences.enabled || !hasPermission;

  if (isLoading) {
    return <BrandedLoadingScreen message="Loading settings..." />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
          <ChevronLeft size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>NOTIFICATIONS</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Permission Status Banner */}
        {permissionStatus === AuthorizationStatus.DENIED && (
          <TouchableOpacity
            style={styles.permissionBanner}
            onPress={openSystemSettings}
            activeOpacity={0.8}>
            <BellOff size={20} color={theme.colors.warning} />
            <View style={styles.permissionBannerContent}>
              <Text style={styles.permissionBannerTitle}>
                Notifications Disabled
              </Text>
              <Text style={styles.permissionBannerSubtitle}>
                Tap to open settings and enable notifications
              </Text>
            </View>
            <ExternalLink size={16} color={theme.colors.textMuted} />
          </TouchableOpacity>
        )}

        {/* Master Toggle */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>MASTER CONTROL</Text>
          <View style={styles.masterToggle}>
            <View style={styles.masterIcon}>
              {preferences.enabled && hasPermission ? (
                <Bell size={24} color={theme.colors.success} />
              ) : (
                <BellOff size={24} color={theme.colors.textMuted} />
              )}
            </View>
            <View style={styles.masterContent}>
              <Text style={styles.masterTitle}>Push Notifications</Text>
              <Text style={styles.masterSubtitle}>
                {preferences.enabled && hasPermission
                  ? 'You will receive push notifications'
                  : 'Push notifications are disabled'}
              </Text>
            </View>
            <AppleNativeGlassSwitch
              value={preferences.enabled && hasPermission}
              onValueChange={handleToggleMaster}
              accessibilityLabel="Push Notifications"
            />
          </View>
        </View>

        {/* Notification Types */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>NOTIFICATION TYPES</Text>
          <View style={styles.settingsCard}>
            <SettingRow
              icon={<Upload size={18} color={isDisabled ? theme.colors.textMuted : theme.colors.textSecondary} />}
              title="Uploads"
              subtitle="New versions and file uploads"
              value={preferences.uploads}
              onValueChange={handleToggle('uploads')}
              disabled={isDisabled}
            />

            <View style={styles.separator} />

            <SettingRow
              icon={<MessageSquare size={18} color={isDisabled ? theme.colors.textMuted : theme.colors.textSecondary} />}
              title="Comments"
              subtitle="New comments on your deliverables"
              value={preferences.comments}
              onValueChange={handleToggle('comments')}
              disabled={isDisabled}
            />

            <View style={styles.separator} />

            <SettingRow
              icon={<AtSign size={18} color={isDisabled ? theme.colors.textMuted : theme.colors.textSecondary} />}
              title="Mentions"
              subtitle="When someone mentions you"
              value={preferences.mentions}
              onValueChange={handleToggle('mentions')}
              disabled={isDisabled}
            />

            <View style={styles.separator} />

            <SettingRow
              icon={<CheckSquare size={18} color={isDisabled ? theme.colors.textMuted : theme.colors.textSecondary} />}
              title="Tasks"
              subtitle="Task assignments and due dates"
              value={preferences.todos}
              onValueChange={handleToggle('todos')}
              disabled={isDisabled}
            />

            <View style={styles.separator} />

            <SettingRow
              icon={(
                <Image
                  source={{uri: DEFAULT_THUMBNAIL}}
                  style={{width: 18, height: 18, opacity: isDisabled ? 0.5 : 0.9}}
                  resizeMode="cover"
                />
              )}
              title="Deliverable Updates"
              subtitle="Status changes and approvals"
              value={preferences.deliverableUpdates}
              onValueChange={handleToggle('deliverableUpdates')}
              disabled={isDisabled}
            />
          </View>
        </View>

        {/* Info Footer */}
        <View style={styles.infoSection}>
          <Text style={styles.infoText}>
            Push notifications are sent to this device when important events
            happen in your workspace. You can adjust these settings at any time.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
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
    paddingBottom: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: '600',
    color: theme.colors.textMuted,
    letterSpacing: theme.typography.letterSpacing.wide,
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xl * 2,
  },
  permissionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.warningBackground,
    borderWidth: 1,
    borderColor: theme.colors.warningBorder,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  permissionBannerContent: {
    flex: 1,
  },
  permissionBannerTitle: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.warning,
    marginBottom: 2,
  },
  permissionBannerSubtitle: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.textSecondary,
  },
  section: {
    marginBottom: theme.spacing.xl,
  },
  sectionLabel: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: '600',
    color: theme.colors.textMuted,
    letterSpacing: theme.typography.letterSpacing.wide,
    marginBottom: theme.spacing.sm,
  },
  masterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    gap: theme.spacing.md,
  },
  masterIcon: {
    width: 44,
    height: 44,
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  masterContent: {
    flex: 1,
  },
  masterTitle: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  masterSubtitle: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.textSecondary,
  },
  settingsCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    gap: theme.spacing.md,
  },
  settingRowDisabled: {
    opacity: 0.5,
  },
  settingIcon: {
    width: 36,
    height: 36,
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.textSecondary,
  },
  textDisabled: {
    color: theme.colors.textMuted,
  },
  separator: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginLeft: theme.spacing.md + 36 + theme.spacing.md,
  },
  infoSection: {
    paddingTop: theme.spacing.md,
  },
  infoText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
});












