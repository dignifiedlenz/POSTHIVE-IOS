/**
 * @format
 */

// URL polyfill required for Supabase to work in React Native
import 'react-native-url-polyfill/auto';

import {AppRegistry} from 'react-native';
import App from './src/app/App';
import {name as appName} from './app.json';

// In dev: suppress noisy "1" rejections from native modules (common, harmless)
if (__DEV__ && global.HermesInternal?.enablePromiseRejectionTracker) {
  const defaultOptions = require('react-native/Libraries/promiseRejectionTrackingOptions').default;
  global.HermesInternal.enablePromiseRejectionTracker({
    ...defaultOptions,
    onUnhandled: (id, rejection) => {
      const msg = typeof rejection === 'string' ? rejection : String(rejection);
      if (msg === '1' || msg === '0') {
        console.warn('[Unhandled promise rejection]', msg, '- often from native module');
        return;
      }
      defaultOptions.onUnhandled(id, rejection);
    },
  });
}

AppRegistry.registerComponent(appName, () => App);
