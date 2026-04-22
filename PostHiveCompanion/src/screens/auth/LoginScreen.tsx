import React, {useState} from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {theme} from '../../theme';
import {Button} from '../../components/ui';
import {useAuth} from '../../hooks/useAuth';

export function LoginScreen() {
  const {signInWithBrowser, error, clearError} = useAuth();
  const [isOpening, setIsOpening] = useState(false);

  const handleSignInWithBrowser = async () => {
    clearError();
    setIsOpening(true);
    try {
      await signInWithBrowser();
    } catch {
      // Error is handled by useAuth
    } finally {
      setIsOpening(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Big Centered Logo */}
        <View style={styles.logoContainer}>
          <Text style={styles.logo}>POSTHIVE</Text>
        </View>

        <View style={styles.header}>
          <Text style={styles.title}>Sign In</Text>
          <Text style={styles.subtitle}>
            For your security, sign in through your browser. Your credentials
            never touch the app.
          </Text>
        </View>

        <View style={styles.form}>
          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Button
            title={isOpening ? 'Opening...' : 'Sign in'}
            onPress={handleSignInWithBrowser}
            loading={isOpening}
            fullWidth
            style={styles.signInButton}
          />

          <Text style={styles.securityNote}>
            Opens sign-in in the app. Your credentials never touch the app.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    flex: 1,
    padding: theme.spacing.lg,
  },
  logoContainer: {
    alignItems: 'center',
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
  },
  logo: {
    color: theme.colors.textPrimary,
    fontSize: 42,
    fontFamily: theme.typography.fontFamily.wordmark,
    letterSpacing: -0.75,
    textTransform: 'uppercase',
  },
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSize.xxl,
    fontFamily: theme.typography.fontFamily.bold,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.regular,
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: theme.spacing.lg,
  },
  form: {
    marginBottom: theme.spacing.xl,
  },
  errorContainer: {
    backgroundColor: theme.colors.errorBackground,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: theme.colors.errorBorder,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: theme.typography.fontSize.xs,
    fontFamily: theme.typography.fontFamily.medium,
    fontWeight: '500',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  signInButton: {
    marginTop: theme.spacing.lg,
  },
  securityNote: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.fontSize.xs,
    fontFamily: theme.typography.fontFamily.regular,
    fontWeight: '400',
    textAlign: 'center',
    marginTop: theme.spacing.xl,
    lineHeight: 18,
    paddingHorizontal: theme.spacing.md,
  },
});
