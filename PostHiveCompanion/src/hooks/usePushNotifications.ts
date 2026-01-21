import {useState, useEffect, useCallback, useRef} from 'react';
import {Platform, Linking, AppState, NativeModules, NativeEventEmitter} from 'react-native';
import notifee, {
  AndroidImportance,
  AuthorizationStatus,
  EventType,
} from '@notifee/react-native';
import {supabase} from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Get our custom native push notification module
const {PushNotificationModule} = NativeModules;

const DEVICE_TOKEN_KEY = '@posthive_device_token';
const NOTIFICATION_PREFS_KEY = '@posthive_notification_prefs';

export interface NotificationPreferences {
  enabled: boolean;
  uploads: boolean;
  comments: boolean;
  mentions: boolean;
  todos: boolean;
  deliverableUpdates: boolean;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  enabled: true,
  uploads: true,
  comments: true,
  mentions: true,
  todos: true,
  deliverableUpdates: true,
};

interface UsePushNotificationsOptions {
  userId?: string;
  workspaceId?: string;
  onNotificationPress?: (data: Record<string, unknown>) => void;
}

export function usePushNotifications({
  userId,
  workspaceId,
  onNotificationPress,
}: UsePushNotificationsOptions) {
  const [permissionStatus, setPermissionStatus] = useState<AuthorizationStatus | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFERENCES);
  const [isLoading, setIsLoading] = useState(true);
  const appState = useRef(AppState.currentState);

  // Load saved preferences
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const saved = await AsyncStorage.getItem(NOTIFICATION_PREFS_KEY);
        if (saved) {
          setPreferences({...DEFAULT_PREFERENCES, ...JSON.parse(saved)});
        }
      } catch (error) {
        console.error('Error loading notification preferences:', error);
      }
    };
    loadPreferences();
  }, []);

  // Save preferences when changed
  const updatePreferences = useCallback(async (newPrefs: Partial<NotificationPreferences>) => {
    setPreferences(prevPrefs => {
      const updated = {...prevPrefs, ...newPrefs};
      // Save to AsyncStorage
      AsyncStorage.setItem(NOTIFICATION_PREFS_KEY, JSON.stringify(updated)).catch(error => {
        console.error('Error saving notification preferences:', error);
      });
      
      // Sync to backend if user is logged in
      if (userId && workspaceId) {
        syncPreferencesToBackend(userId, updated).catch(error => {
          console.error('Error syncing preferences to backend:', error);
        });
      }
      
      return updated;
    });
  }, [userId, workspaceId]);

  // Sync preferences to Supabase
  const syncPreferencesToBackend = async (
    uid: string,
    prefs: NotificationPreferences,
  ) => {
    try {
      await supabase.from('user_notification_preferences').upsert(
        {
          user_id: uid,
          push_enabled: prefs.enabled,
          push_uploads: prefs.uploads,
          push_comments: prefs.comments,
          push_mentions: prefs.mentions,
          push_todos: prefs.todos,
          push_deliverable_updates: prefs.deliverableUpdates,
          updated_at: new Date().toISOString(),
        },
        {onConflict: 'user_id'},
      );
    } catch (error) {
      console.error('Error syncing preferences to backend:', error);
    }
  };

  // Create notification channel for Android
  const createNotificationChannel = async () => {
    if (Platform.OS === 'android') {
      await notifee.createChannel({
        id: 'posthive_default',
        name: 'PostHive Notifications',
        importance: AndroidImportance.HIGH,
        vibration: true,
        sound: 'default',
      });

      await notifee.createChannel({
        id: 'posthive_comments',
        name: 'Comments',
        importance: AndroidImportance.HIGH,
        vibration: true,
      });

      await notifee.createChannel({
        id: 'posthive_uploads',
        name: 'Uploads',
        importance: AndroidImportance.DEFAULT,
      });

      await notifee.createChannel({
        id: 'posthive_todos',
        name: 'Tasks',
        importance: AndroidImportance.HIGH,
        vibration: true,
      });
    }
  };

  // Request notification permissions
  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      if (Platform.OS === 'ios' && PushNotificationModule) {
        // Use our custom native module for iOS
        const granted = await PushNotificationModule.registerForPushNotifications();
        console.log('Push permission granted:', granted);
        
        setPermissionStatus(
          granted ? AuthorizationStatus.AUTHORIZED : AuthorizationStatus.DENIED,
        );

        // Poll for device token (it arrives asynchronously)
        if (granted) {
          setTimeout(async () => {
            try {
              const token = await PushNotificationModule.getDeviceToken();
              if (token) {
                console.log('Got device token:', token);
                registerDeviceToken(token);
              }
            } catch (e) {
              console.log('Error getting device token:', e);
            }
          }, 2000);
        }

        return granted;
      } else if (Platform.OS === 'ios') {
        // Fallback to notifee if native module not available
        const settings = await notifee.requestPermission();
        setPermissionStatus(settings.authorizationStatus);
        return (
          settings.authorizationStatus === AuthorizationStatus.AUTHORIZED ||
          settings.authorizationStatus === AuthorizationStatus.PROVISIONAL
        );
      } else {
        // Android - use notifee
        const settings = await notifee.requestPermission();
        setPermissionStatus(settings.authorizationStatus);

        return (
          settings.authorizationStatus === AuthorizationStatus.AUTHORIZED ||
          settings.authorizationStatus === AuthorizationStatus.PROVISIONAL
        );
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }, [registerDeviceToken]);

  // Register device token with backend
  const registerDeviceToken = useCallback(async (token: string) => {
    if (!userId) {
      console.log('No user ID, skipping device token registration');
      return;
    }

    try {
      // Save token locally
      await AsyncStorage.setItem(DEVICE_TOKEN_KEY, token);

      // Register with Supabase
      const {error} = await supabase.from('user_push_tokens').upsert(
        {
          user_id: userId,
          token,
          platform: Platform.OS,
          device_id: `${Platform.OS}_${Date.now()}`,
          active: true,
          updated_at: new Date().toISOString(),
        },
        {onConflict: 'user_id,token'},
      );

      if (error) {
        console.error('Error registering push token:', error);
      } else {
        console.log('Push token registered successfully');
        setIsRegistered(true);
      }
    } catch (error) {
      console.error('Error in registerDeviceToken:', error);
    }
  }, [userId]);

  // Unregister device (on logout)
  const unregisterDevice = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem(DEVICE_TOKEN_KEY);
      if (token && userId) {
        await supabase
          .from('user_push_tokens')
          .update({active: false})
          .eq('user_id', userId)
          .eq('token', token);
      }
      await AsyncStorage.removeItem(DEVICE_TOKEN_KEY);
      setIsRegistered(false);
    } catch (error) {
      console.error('Error unregistering device:', error);
    }
  }, [userId]);

  // Initialize push notifications
  const initialize = useCallback(async () => {
    setIsLoading(true);
    try {
      // Create Android channels
      await createNotificationChannel();

      if (Platform.OS === 'ios') {
        // Check current iOS permission status
        if (PushNotificationModule) {
          try {
            const status = await PushNotificationModule.checkPermissionStatus();
            console.log('iOS permission status:', status);
            
            if (status === 'authorized' || status === 'provisional') {
              setPermissionStatus(AuthorizationStatus.AUTHORIZED);
              
              // Try to get existing device token
              const token = await PushNotificationModule.getDeviceToken();
              if (token) {
                console.log('Found existing device token:', token);
                registerDeviceToken(token);
              } else {
                // Request permission again to trigger token generation
                console.log('No token found, registering for remote notifications...');
                await PushNotificationModule.registerForPushNotifications();
                
                // Poll for token
                setTimeout(async () => {
                  const newToken = await PushNotificationModule.getDeviceToken();
                  if (newToken) {
                    console.log('Got device token after registration:', newToken);
                    registerDeviceToken(newToken);
                  }
                }, 2000);
              }
            } else if (status === 'denied') {
              setPermissionStatus(AuthorizationStatus.DENIED);
            } else {
              setPermissionStatus(AuthorizationStatus.NOT_DETERMINED);
            }
          } catch (e) {
            console.log('Native push module error:', e);
            // Fallback to notifee
            const settings = await notifee.getNotificationSettings();
            setPermissionStatus(settings.authorizationStatus);
          }
        } else {
          // Fallback to notifee
          const settings = await notifee.getNotificationSettings();
          setPermissionStatus(settings.authorizationStatus);
        }
      } else {
        // Android - check notifee permission status
        const settings = await notifee.getNotificationSettings();
        setPermissionStatus(settings.authorizationStatus);
      }
    } catch (error) {
      console.error('Error initializing push notifications:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId, registerDeviceToken]);

  // Handle notification press (foreground) via notifee
  useEffect(() => {
    return notifee.onForegroundEvent(({type, detail}) => {
      if (type === EventType.PRESS && detail.notification?.data) {
        onNotificationPress?.(detail.notification.data as Record<string, unknown>);
      }
    });
  }, [onNotificationPress]);

  // Initialize on mount when user is available
  useEffect(() => {
    if (userId) {
      initialize();
    }
  }, [userId, initialize]);

  // Re-check permissions when app comes to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async nextAppState => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // App came to foreground - recheck permissions using notifee
        const settings = await notifee.getNotificationSettings();
        setPermissionStatus(settings.authorizationStatus);
      }
      appState.current = nextAppState;
    });

    return () => subscription.remove();
  }, []);

  // Handle permission denied - show settings prompt
  const openSettings = useCallback(() => {
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    } else {
      Linking.openSettings();
    }
  }, []);

  return {
    permissionStatus,
    isRegistered,
    isLoading,
    preferences,
    hasPermission:
      permissionStatus === AuthorizationStatus.AUTHORIZED ||
      permissionStatus === AuthorizationStatus.PROVISIONAL,
    requestPermission,
    updatePreferences,
    unregisterDevice,
    initialize,
    openSettings,
  };
}

// Background notification handler for notifee
export function setupBackgroundHandler() {
  // Notifee handles background notifications automatically
  // This is a placeholder for any custom background handling
  notifee.onBackgroundEvent(async ({type, detail}) => {
    console.log('Background notification event:', type, detail);
  });
}
