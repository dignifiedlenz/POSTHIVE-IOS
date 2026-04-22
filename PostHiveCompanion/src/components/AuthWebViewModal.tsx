import React, {useCallback, useRef, useEffect} from 'react';
import {
  Modal,
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  Platform,
} from 'react-native';
import {WebView} from 'react-native-webview';
import {X} from 'lucide-react-native';
import {getSignInWithBrowserUrl} from '../lib/supabase';
import {createSessionFromUrl} from '../lib/supabase';
import {createSessionFromTokens} from '../lib/supabase';
import {theme} from '../theme';
import {devLog} from '../lib/devLog';

const AUTH_CALLBACK_PREFIX = 'posthive://auth/callback';

interface AuthWebViewModalProps {
  visible: boolean;
  onClose: () => void;
  onAuthSuccess?: () => Promise<void> | void;
  onError?: (message: string) => void;
}

/**
 * In-app WebView modal for browser-based auth.
 * Loads the sign-in page and intercepts posthive://auth/callback to create the session.
 * This avoids the known iOS redirect issues with InAppBrowser.openAuth / ASWebAuthenticationSession.
 */
export function AuthWebViewModal({visible, onClose, onAuthSuccess, onError}: AuthWebViewModalProps) {
  const authUrl = getSignInWithBrowserUrl();
  const handlingCallback = useRef(false);

  useEffect(() => {
    if (visible) {
      handlingCallback.current = false;
      devLog('[mobile-auth] webview:opened', {authUrl});
    }
  }, [visible]);

  const handleAuthCallback = useCallback(
    (url: string) => {
      if (handlingCallback.current) return;
      devLog('[mobile-auth] webview:handle-callback', {
        preview: url.slice(0, 120),
      });
      handlingCallback.current = true;
      createSessionFromUrl(url)
        .then(async (result) => {
          devLog('[mobile-auth] webview:callback-result', {
            success: !!result,
            hasAccessToken: !!result?.access_token,
            hasRefreshToken: !!result?.refresh_token,
          });
          if (result) {
            await onAuthSuccess?.();
            onClose();
          } else {
            onError?.('Invalid auth response');
          }
        })
        .catch((err) => {
          console.error('[mobile-auth] webview:callback-error', err);
          onError?.(err instanceof Error ? err.message : 'Sign-in failed');
        })
        .finally(() => {
          handlingCallback.current = false;
        });
    },
    [onAuthSuccess, onClose, onError],
  );

  const handleShouldStartLoadWithRequest = useCallback(
    (request: {url: string}) => {
      const {url} = request;
      if (
        url.includes('/auth/mobile') ||
        url.includes('/auth/electron-callback') ||
        url.startsWith(AUTH_CALLBACK_PREFIX)
      ) {
        devLog('[mobile-auth] webview:should-start', {
          preview: url.slice(0, 160),
        });
      }
      if (url.startsWith(AUTH_CALLBACK_PREFIX)) {
        handleAuthCallback(url);
        return false;
      }
      return true;
    },
    [handleAuthCallback],
  );

  const handleNavigationStateChange = useCallback(
    (navState: {url?: string}) => {
      const url = navState?.url;
      if (
        url?.includes('/auth/mobile') ||
        url?.includes('/auth/electron-callback') ||
        url?.startsWith(AUTH_CALLBACK_PREFIX)
      ) {
        devLog('[mobile-auth] webview:navigation-state', {
          preview: url.slice(0, 160),
        });
      }
      if (url?.startsWith(AUTH_CALLBACK_PREFIX)) {
        handleAuthCallback(url);
      }
    },
    [handleAuthCallback],
  );

  const handleMessage = useCallback(
    (event: {nativeEvent: {data: string}}) => {
      try {
        devLog('[mobile-auth] webview:message-received', {
          preview: event.nativeEvent.data.slice(0, 160),
        });
        const data = JSON.parse(event.nativeEvent.data);
        if (
          data?.type === 'auth_tokens' &&
          typeof data?.access_token === 'string' &&
          typeof data?.refresh_token === 'string'
        ) {
          if (handlingCallback.current) return;
          devLog('[mobile-auth] webview:message-auth-tokens', {
            accessTokenLength: data.access_token.length,
            refreshTokenLength: data.refresh_token.length,
          });
          handlingCallback.current = true;
          createSessionFromTokens(data.access_token, data.refresh_token)
            .then(async (result) => {
              devLog('[mobile-auth] webview:token-message-result', {
                success: !!result,
              });
              if (result) {
                await onAuthSuccess?.();
                onClose();
              } else {
                onError?.('Invalid auth token handoff');
              }
            })
            .catch((err) => {
              console.error('[mobile-auth] webview:token-message-error', err);
              onError?.(err instanceof Error ? err.message : 'Sign-in failed');
            })
            .finally(() => {
              handlingCallback.current = false;
            });
          return;
        }
        if (data?.type === 'auth' && typeof data?.url === 'string' && data.url.startsWith(AUTH_CALLBACK_PREFIX)) {
          handleAuthCallback(data.url);
        }
      } catch {
        // Ignore non-JSON or invalid messages
      }
    },
    [handleAuthCallback],
  );

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Sign in</Text>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeButton}
            hitSlop={{top: 12, bottom: 12, left: 12, right: 12}}
            accessibilityLabel="Close">
            <X size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>
        </View>
        <WebView
          source={{uri: authUrl}}
          style={styles.webview}
          onMessage={handleMessage}
          onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
          onNavigationStateChange={handleNavigationStateChange}
          originWhitelist={['https://*', 'http://*', 'posthive://*']}
          startInLoadingState
          renderLoading={() => (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={theme.colors.textPrimary} />
            </View>
          )}
          onError={(syntheticEvent) => {
            console.error('[mobile-auth] webview:error', syntheticEvent.nativeEvent);
          }}
          sharedCookiesEnabled
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'ios' ? 8 : 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  closeButton: {
    padding: 4,
  },
  webview: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
});
