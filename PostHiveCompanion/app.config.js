/**
 * Expo config for EAS Build / Submit and Expo tooling.
 * Native projects remain the source of truth; keep bundle IDs in sync with Xcode / Gradle.
 *
 * Link to Expo: run `cd PostHiveCompanion && npx eas-cli init`
 * Builds: `npx eas-cli build --platform ios --profile production`
 */
module.exports = {
  expo: {
    name: 'POSTHIVE',
    slug: 'posthive-companion',
    version: '1.0.0',
    orientation: 'default',
    userInterfaceStyle: 'automatic',
    ios: {
      bundleIdentifier: 'app.posthive.companion',
      buildNumber: '2',
    },
    android: {
      package: 'com.posthivecompanion',
      versionCode: 2,
    },
    extra: {
      eas: {
        // Filled automatically by `eas init` (projectId for EAS / Launch)
      },
    },
  },
};
