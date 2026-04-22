# POSTHIVE iOS — App Store submission runbook

Use this checklist after code changes are merged. Bundle ID: **`app.posthive.companion`**.

## Apple Developer

1. Register App IDs: `app.posthive.companion`, `app.posthive.companion.TaskLiveActivityWidget`.
2. Enable: Push Notifications, App Groups `group.com.posthive.companion`, Sign in with Apple only if required by your web auth.
3. **Rotate APNs key** if `AuthKey_*.p8` was ever committed; upload the new key to your push backend (e.g. Supabase).
4. Regenerate provisioning profiles or use Xcode automatic signing (Team `ZJMC964HL6`).

## App Store Connect — app record (`asc_app_record`)

- **Name:** POSTHIVE  
- **Bundle ID:** app.posthive.companion  
- **Primary category:** Productivity (or Business)  
- **Secondary:** Photo & Video  
- **Privacy Policy URL:** https://www.posthive.app/legal/privacy  
- **Support URL:** https://www.posthive.app/support (or your support page)  
- **Keywords / subtitle / description:** align with product marketing.  
- **Age rating:** complete questionnaire honestly (UGC → may be 12+).

## App Privacy questionnaire (`asc_privacy_label`)

Align answers with [PostHiveCompanion/ios/PostHiveCompanion/PrivacyInfo.xcprivacy](../PostHiveCompanion/ios/PostHiveCompanion/PrivacyInfo.xcprivacy):

- Email, name, user ID — linked to user, not used for tracking, app functionality.  
- Other user content — workspaces, deliverables, comments.  
- Audio — voice commands.  
- Device ID — push notification token.  

No tracking; no data sold.

## Demo account (`demo_account`)

1. Create `appreview@posthive.app` (or similar) with a known password.  
2. Seed: at least one workspace, a few deliverables, calendar items if you showcase them.  
3. Ensure the account is **not** blocked by workspace-ownership deletion rules.  
4. Paste credentials and short navigation steps in **App Review → Notes**.

Suggested review notes snippet:

- Sign-in: tap Sign in; system browser (ASWebAuthenticationSession) opens `posthive.app`; completes to `posthive://auth/callback`.  
- **Background modes:** `remote-notification` for push; `fetch` for widget / background sync.  
- **Microphone / Speech:** only when using voice command UI.  
- **Live Activities:** only started from user actions (e.g. transfer / task).  
- **Account deletion:** Profile → Delete account (calls `POST /api/auth/delete-account` with Bearer token).

## Screenshots (`screenshots`)

- **Required:** 6.9" (e.g. iPhone 16 Pro Max) — 1320×2868 portrait, 3–10 screenshots.  
- **Recommended:** 6.5" — 1242×2688.  
- Capture: login, dashboard, deliverable review, calendar, notifications/settings as appropriate.

## Build & upload (`archive_upload`)

```bash
cd PostHiveCompanion/ios
pod install
open PostHiveCompanion.xcworkspace
```

Xcode: scheme **PostHiveCompanion** → **Any iOS Device (arm64)** → **Product → Archive** (Release).  
Organizer → **Distribute App** → App Store Connect → Upload.

Bump `CURRENT_PROJECT_VERSION` in Xcode if the previous build number was already used.

## TestFlight QA (`testflight_qa`)

- Install from TestFlight on a **physical** device running **iOS 26**.  
- Full flow: sign-in, workspace, push (if enabled), voice (optional), save to photo library (optional), Live Activity (if applicable).  
- **IPv6-only** network test (Settings → hotspot / NAT64 if available).  
- Sign out and **Delete account** on a throwaway test user.

## Submit for review (`submit_review`)

- Export compliance: `ITSAppUsesNonExemptEncryption = false` in Info.plist (standard HTTPS only).  
- Attach screenshots, set copyright, pricing.  
- **App Review information:** contact, phone, demo user/password, notes above.  
- Submit; typical review 24–48h.

## Icon audit (`icon_audit`)

Run on macOS:

```bash
sips -g hasAlpha PostHiveCompanion/ios/PostHiveCompanion/Images.xcassets/AppIcon.appiconset/Icon-1024.png
```

`hasAlpha: no` is required for App Store marketing icon.
