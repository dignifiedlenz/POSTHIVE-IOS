# Mobile App: Browser-Based Authentication

## Overview

The mobile app uses **browser-based authentication** for security best practices. Credentials (email, password) never touch the app—users sign in through the web app in their system browser.

## Flow

1. User taps **"Sign in with Browser"** in the app
2. App opens `https://www.posthive.app/signin?redirectTo=/auth/electron-callback` in the system browser
3. User signs in on the web (email/password or OAuth)
4. Web redirects to `/auth/electron-callback`, which redirects to `posthive://auth/callback?access_token=...&refresh_token=...`
5. OS opens the app with this deep link
6. App parses tokens and sets the Supabase session via `setSession()`

## Security Benefits

- **No credential storage** – Passwords are never stored in the app or device keychain
- **System browser** – Uses the OS browser (Safari/Chrome) which may already have the user logged in
- **OAuth-ready** – The web app can support Google, Apple, etc. without app changes
- **PKCE-compatible** – Web-based OAuth flows use standard PKCE when applicable

## Configuration

### Supabase Dashboard

If you add OAuth providers (Google, Apple) to the web sign-in, add this to **Auth → URL Configuration → Redirect URLs**:

```
posthive://auth/callback
```

For email/password only, no Supabase config change is needed—the flow stays within the web app.

### iOS

The `posthive://` URL scheme is registered in `Info.plist` under `CFBundleURLTypes`.

### Android

The `posthive://` scheme is registered in `AndroidManifest.xml` via an intent-filter.

## Shared with Electron

The same `/auth/electron-callback` page is used by the Electron desktop app. Both Electron and mobile receive tokens via the `posthive://auth/callback` deep link.
