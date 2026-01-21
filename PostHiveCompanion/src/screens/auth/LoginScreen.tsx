import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Modal,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Eye, EyeOff, FaceId, X} from 'lucide-react-native';
import {theme} from '../../theme';
import {Button, Input} from '../../components/ui';
import {useAuth} from '../../hooks/useAuth';
import {useBiometrics} from '../../hooks/useBiometrics';
import {saveCredentials, hasStoredCredentials} from '../../lib/secureStorage';

export function LoginScreen() {
  const {signIn, isLoading, error, clearError} = useAuth();
  const {
    isAvailable: isBiometricsAvailable,
    biometricType,
    checkBiometrics,
    authenticateAndGetCredentials,
  } = useBiometrics();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [hasStoredCreds, setHasStoredCreds] = useState(false);
  const [isBiometricsLoading, setIsBiometricsLoading] = useState(false);
  const [showFaceIdPrompt, setShowFaceIdPrompt] = useState(false);
  const [pendingCredentials, setPendingCredentials] = useState<{
    email: string;
    password: string;
  } | null>(null);

  // Check biometrics availability and stored credentials on mount
  useEffect(() => {
    const initialize = async () => {
      await checkBiometrics();
      const hasCreds = await hasStoredCredentials();
      setHasStoredCreds(hasCreds);
    };
    initialize();
  }, [checkBiometrics]);

  const handleSignIn = async () => {
    clearError();
    setLocalError(null);

    if (!email.trim()) {
      setLocalError('Please enter your email');
      return;
    }

    if (!password) {
      setLocalError('Please enter your password');
      return;
    }

    try {
      await signIn(email.trim(), password);
      
      // If biometrics are available and user doesn't have stored credentials,
      // show prompt to enable Face ID
      if (isBiometricsAvailable && !hasStoredCreds) {
        setPendingCredentials({email: email.trim(), password});
        setShowFaceIdPrompt(true);
      }
    } catch {
      // Error is handled by useAuth
    }
  };

  const handleEnableFaceId = async () => {
    if (pendingCredentials) {
      await saveCredentials(pendingCredentials.email, pendingCredentials.password);
      setHasStoredCreds(true);
    }
    setShowFaceIdPrompt(false);
    setPendingCredentials(null);
  };

  const handleSkipFaceId = () => {
    setShowFaceIdPrompt(false);
    setPendingCredentials(null);
  };

  const handleFaceIdSignIn = async () => {
    clearError();
    setLocalError(null);
    setIsBiometricsLoading(true);

    try {
      const credentials = await authenticateAndGetCredentials();
      
      if (!credentials) {
        setLocalError('Failed to retrieve credentials');
        setIsBiometricsLoading(false);
        return;
      }

      setEmail(credentials.email);
      setPassword(credentials.password);

      // Sign in with retrieved credentials
      await signIn(credentials.email, credentials.password);
      setHasStoredCreds(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Face ID sign in failed';
      setLocalError(message);
    } finally {
      setIsBiometricsLoading(false);
    }
  };

  const displayError = localError || error;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled">
          {/* Big Centered Logo */}
          <View style={styles.logoContainer}>
            <Text style={styles.logo}>POSTHIVE</Text>
          </View>

          <View style={styles.header}>
            <Text style={styles.title}>Sign In</Text>
          </View>

          <View style={styles.form}>
            {displayError && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{displayError}</Text>
              </View>
            )}

            <View style={styles.inputContainer}>
              <Input
                placeholder="Email"
                value={email}
                onChangeText={text => {
                  setEmail(text);
                  setLocalError(null);
                }}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                autoComplete="email"
                containerStyle={styles.tallInput}
              />
            </View>

            <View style={styles.inputContainer}>
              <Input
                placeholder="Password"
                value={password}
                onChangeText={text => {
                  setPassword(text);
                  setLocalError(null);
                }}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="password"
                containerStyle={styles.tallInput}
                rightIcon={
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                    {showPassword ? (
                      <EyeOff size={20} color={theme.colors.textMuted} />
                    ) : (
                      <Eye size={20} color={theme.colors.textMuted} />
                    )}
                  </TouchableOpacity>
                }
              />
            </View>

            <Button
              title="Sign In"
              onPress={handleSignIn}
              loading={isLoading && !isBiometricsLoading}
              fullWidth
              style={styles.signInButton}
            />

            {/* Face ID / Touch ID Button */}
            {isBiometricsAvailable && hasStoredCreds && (
              <TouchableOpacity
                style={styles.biometricsButton}
                onPress={handleFaceIdSignIn}
                disabled={isLoading || isBiometricsLoading}>
                <View style={styles.biometricsButtonContent}>
                  <FaceId
                    size={24}
                    color={theme.colors.textPrimary}
                    style={styles.biometricsIcon}
                  />
                  <Text style={styles.biometricsButtonText}>
                    {isBiometricsLoading
                      ? 'Authenticating...'
                      : biometricType === 'FaceID' ? 'Face ID' : biometricType === 'TouchID' ? 'Touch ID' : 'Biometrics'}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Face ID Enable Prompt Modal */}
      <Modal
        visible={showFaceIdPrompt}
        transparent
        animationType="fade"
        onRequestClose={handleSkipFaceId}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={handleSkipFaceId}
              hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
              <X size={20} color={theme.colors.textMuted} />
            </TouchableOpacity>

            <View style={styles.modalIconContainer}>
              <FaceId size={48} color={theme.colors.textPrimary} />
            </View>

            <Text style={styles.modalTitle}>
              Enable {biometricType === 'FaceID' ? 'Face ID' : biometricType === 'TouchID' ? 'Touch ID' : 'Biometrics'}?
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={handleSkipFaceId}>
                <Text style={styles.modalButtonTextSecondary}>Not Now</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={handleEnableFaceId}>
                <Text style={styles.modalButtonTextPrimary}>Enable</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent', // Show wave background
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: theme.spacing.lg,
  },
  logoContainer: {
    alignItems: 'center',
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
  },
  logo: {
    color: theme.colors.textPrimary,
    fontSize: 42, // Matches splash animation end size (56 * 0.75)
    fontWeight: '900',
    letterSpacing: -0.75,
  },
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSize.xxl,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  form: {
    marginBottom: theme.spacing.xl,
  },
  inputContainer: {
    marginBottom: theme.spacing.lg,
  },
  tallInput: {
    height: 56,
  },
  errorContainer: {
    backgroundColor: theme.colors.errorBackground,
    borderRadius: 0, // Sharp edges
    borderWidth: 1,
    borderColor: theme.colors.errorBorder,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: theme.typography.fontSize.xs,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  signInButton: {
    marginTop: theme.spacing.xl,
  },
  biometricsButton: {
    marginTop: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: 'transparent',
    borderRadius: 0, // Sharp edges
  },
  biometricsButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  biometricsIcon: {
    marginRight: theme.spacing.sm,
  },
  biometricsButtonText: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  modalContent: {
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 0, // Sharp edges
    padding: theme.spacing.xl,
    width: '100%',
    maxWidth: 400,
    position: 'relative',
  },
  modalCloseButton: {
    position: 'absolute',
    top: theme.spacing.md,
    right: theme.spacing.md,
    padding: theme.spacing.xs,
  },
  modalIconContainer: {
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
    marginTop: theme.spacing.md,
  },
  modalTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSize.xl,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: theme.spacing.md,
    letterSpacing: -0.5,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  modalButton: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderWidth: 1,
    borderRadius: 0, // Sharp edges
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonSecondary: {
    backgroundColor: 'transparent',
    borderColor: theme.colors.border,
  },
  modalButtonPrimary: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  modalButtonTextSecondary: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalButtonTextPrimary: {
    color: theme.colors.accentText,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

