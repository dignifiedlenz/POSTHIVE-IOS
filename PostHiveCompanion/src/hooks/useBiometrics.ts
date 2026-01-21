import {useState, useCallback} from 'react';
import * as LocalAuthentication from 'react-native-local-authentication';
import {getCredentials} from '../lib/secureStorage';

export interface BiometricsState {
  isAvailable: boolean;
  isSupported: boolean;
  biometricType: 'FaceID' | 'TouchID' | 'Biometrics' | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook for Face ID / Touch ID authentication
 */
export function useBiometrics() {
  const [state, setState] = useState<BiometricsState>({
    isAvailable: false,
    isSupported: false,
    biometricType: null,
    isLoading: true,
    error: null,
  });

  /**
   * Check if biometrics are available and supported
   */
  const checkBiometrics = useCallback(async () => {
    try {
      setState(prev => ({...prev, isLoading: true, error: null}));

      const isSupported = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();

      let biometricType: 'FaceID' | 'TouchID' | 'Biometrics' | null = null;
      if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        biometricType = 'FaceID';
      } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        biometricType = 'TouchID';
      } else if (supportedTypes.length > 0) {
        biometricType = 'Biometrics';
      }

      const isAvailable = isSupported && isEnrolled;

      setState({
        isAvailable,
        isSupported,
        biometricType,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to check biometrics';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: message,
      }));
    }
  }, []);

  /**
   * Authenticate using Face ID / Touch ID
   */
  const authenticate = useCallback(async (): Promise<boolean> => {
    try {
      setState(prev => ({...prev, isLoading: true, error: null}));

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to sign in',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
        fallbackLabel: 'Use Passcode',
      });

      setState(prev => ({...prev, isLoading: false}));

      if (result.success) {
        return true;
      } else {
        const errorMessage = result.error === 'user_cancel' 
          ? 'Authentication cancelled'
          : result.error === 'user_fallback'
          ? 'Fallback to passcode'
          : 'Authentication failed';
        setState(prev => ({...prev, error: errorMessage}));
        return false;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Authentication failed';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: message,
      }));
      return false;
    }
  }, []);

  /**
   * Authenticate and retrieve stored credentials
   */
  const authenticateAndGetCredentials = useCallback(async (): Promise<{
    email: string;
    password: string;
  } | null> => {
    const authenticated = await authenticate();
    if (!authenticated) {
      return null;
    }

    const credentials = await getCredentials();
    return credentials;
  }, [authenticate]);

  return {
    ...state,
    checkBiometrics,
    authenticate,
    authenticateAndGetCredentials,
  };
}

