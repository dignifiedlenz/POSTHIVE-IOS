/**
 * useBackgroundRefresh.ts
 *
 * Registers iOS Background App Refresh so widgets stay updated when the app
 * is closed. iOS will wake the app periodically (typically every 15+ minutes,
 * throttled by the system) to run our sync.
 */

import {Platform} from 'react-native';
import BackgroundFetch from 'react-native-background-fetch';
import {syncWidgetDataInBackground} from '../lib/widgetBackgroundSync';

export function setupBackgroundRefresh(): void {
  if (Platform.OS !== 'ios') return;

  BackgroundFetch.configure(
    {
      minimumFetchInterval: 15, // minutes - iOS minimum
      stopOnTerminate: false,
      startOnBoot: false,
    },
    async (taskId: string) => {
      console.log('[BackgroundRefresh] Task started:', taskId);
      try {
        const success = await syncWidgetDataInBackground();
        console.log('[BackgroundRefresh] Sync complete:', success);
      } catch (err) {
        console.warn('[BackgroundRefresh] Error:', err);
      } finally {
        BackgroundFetch.finish(taskId);
      }
    },
    (taskId: string) => {
      console.warn('[BackgroundRefresh] Timeout:', taskId);
      BackgroundFetch.finish(taskId);
    },
  ).then(status => {
    console.log('[BackgroundRefresh] Configured, status:', status);
  });
}
