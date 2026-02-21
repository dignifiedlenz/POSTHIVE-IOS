import React from 'react';
import {View, Text, StyleSheet, ActivityIndicator} from 'react-native';
import {NoisyWaveBackground} from './NoisyWaveBackground';
import {theme} from '../theme';

interface BrandedLoadingScreenProps {
  /** Optional message shown below the spinner (e.g. "Loading transfers...") */
  message?: string;
}

/**
 * Full-screen loading state with wave background and POSTHIVE branding.
 * Use for initial screen loads, auth, and any loading that should feel branded.
 */
export function BrandedLoadingScreen({message}: BrandedLoadingScreenProps) {
  return (
    <View style={styles.container}>
      <NoisyWaveBackground />
      <View style={styles.content}>
        <Text style={styles.logo}>POSTHIVE</Text>
        <ActivityIndicator
          size="large"
          color={theme.colors.textPrimary}
          style={styles.spinner}
        />
        {message ? (
          <Text style={styles.message}>{message}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  content: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    color: theme.colors.textPrimary,
    fontSize: 56,
    fontWeight: '900',
    letterSpacing: -1,
    marginBottom: theme.spacing.xl,
  },
  spinner: {
    marginBottom: theme.spacing.md,
  },
  message: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.fontSize.sm,
    letterSpacing: theme.typography.letterSpacing.wide,
  },
});
