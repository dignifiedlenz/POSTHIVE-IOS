import {createClient} from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {SUPABASE_URL, SUPABASE_ANON_KEY} from '@env';
import {devLog} from './devLog';

const supabaseUrl = SUPABASE_URL;
const supabaseAnonKey = SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '[mobile-auth] Supabase env vars missing. Ensure .env has SUPABASE_URL and SUPABASE_ANON_KEY. ' +
    'Run "npx react-native run-ios" to rebuild with env vars.',
  );
}

/** Web app base URL for browser-based auth (credentials never touch the app) */
export const AUTH_WEB_BASE_URL = 'https://www.posthive.app';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export const getCurrentUser = async () => {
  const {
    data: {user},
    error,
  } = await supabase.auth.getUser();
  if (error) {
    throw error;
  }
  return user;
};

/**
 * Get the URL to open in the browser for sign-in.
 * User authenticates on the web app; after success, the web redirects to
 * posthive://auth/callback with tokens. The app handles that deep link.
 */
export function getSignInWithBrowserUrl(): string {
  const redirectTo = encodeURIComponent('/auth/electron-callback');
  return `${AUTH_WEB_BASE_URL}/auth/mobile?redirectTo=${redirectTo}`;
}

export async function createSessionFromTokens(
  accessToken: string,
  refreshToken: string
): Promise<{access_token: string; refresh_token: string} | null> {
  try {
    devLog('[mobile-auth] createSessionFromTokens:start', {
      hasAccessToken: !!accessToken,
      hasRefreshToken: !!refreshToken,
      accessTokenLength: accessToken?.length || 0,
      refreshTokenLength: refreshToken?.length || 0,
    });

    if (!accessToken || !refreshToken) {
      devLog('[mobile-auth] createSessionFromTokens:missing-tokens');
      return null;
    }

    devLog('[mobile-auth] createSessionFromTokens:setSession:before');
    const {error} = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (error) {
      console.error('[mobile-auth] createSessionFromTokens:setSession-error', error);
      return null;
    }

    const {data: sessionData} = await supabase.auth.getSession();
    devLog('[mobile-auth] createSessionFromTokens:setSession:after', {
      hasSession: !!sessionData.session,
      userId: sessionData.session?.user?.id || null,
    });

    return {access_token: accessToken, refresh_token: refreshToken};
  } catch (err) {
    console.error('[mobile-auth] createSessionFromTokens:error', err);
    return null;
  }
}

/**
 * Create a session from an auth callback URL.
 * Supports: posthive://auth/callback?access_token=...&refresh_token=...
 * or: posthive://auth/callback?code=... (fetches tokens from API)
 */
export async function createSessionFromUrl(url: string): Promise<{access_token: string; refresh_token: string} | null> {
  try {
    devLog('[mobile-auth] createSessionFromUrl:start', {
      hasUrl: !!url,
      preview: url.slice(0, 120),
    });
    const parsed = new URL(url);
    let accessToken = parsed.searchParams.get('access_token');
    let refreshToken = parsed.searchParams.get('refresh_token');
    const code = parsed.searchParams.get('code');

    devLog('[mobile-auth] createSessionFromUrl:parsed', {
      hasAccessToken: !!accessToken,
      hasRefreshToken: !!refreshToken,
      hasCode: !!code,
    });

    if (!accessToken || !refreshToken) {
      if (code) {
        const handoffUrl = `${AUTH_WEB_BASE_URL}/api/auth/mobile-handoff?code=${encodeURIComponent(code)}`;
        devLog('[mobile-auth] createSessionFromUrl:redeeming-code', {
          handoffUrl,
        });
        const res = await fetch(handoffUrl);
        devLog('[mobile-auth] createSessionFromUrl:redeem-response', {
          ok: res.ok,
          status: res.status,
        });
        if (!res.ok) return null;
        const data = (await res.json()) as {access_token?: string; refresh_token?: string};
        accessToken = data?.access_token ?? null;
        refreshToken = data?.refresh_token ?? null;
      }
    }

    if (!accessToken || !refreshToken) {
      devLog('[mobile-auth] createSessionFromUrl:missing-final-tokens');
      return null;
    }

    return await createSessionFromTokens(accessToken, refreshToken);
  } catch (err) {
    console.error('[mobile-auth] createSessionFromUrl:parse-error', err);
    return null;
  }
}

export const signOut = async () => {
  const {error} = await supabase.auth.signOut();
  if (error) {
    throw error;
  }
};

export const getSession = async () => {
  const {data, error} = await supabase.auth.getSession();
  if (error) {
    throw error;
  }
  return data.session;
};

