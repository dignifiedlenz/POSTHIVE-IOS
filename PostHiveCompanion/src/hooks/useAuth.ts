import {useState, useEffect, useCallback, createContext, useContext, useRef} from 'react';
import {Platform} from 'react-native';
import {User as SupabaseUser, Session} from '@supabase/supabase-js';
import {
  supabase,
  signOut as supabaseSignOut,
  getSignInWithBrowserUrl,
  createSessionFromUrl,
} from '../lib/supabase';
import {isNativeAuthSessionAvailable, startNativeAuthSession} from '../lib/nativeAuthSession';
import {devLog, devWarn} from '../lib/devLog';
import {getUserWorkspaces, getUserPreferredWorkspace, getUserPrimaryWorkspace, setUserPreferredWorkspace} from '../lib/api';
import {Workspace} from '../lib/types';
import {clearCredentials} from '../lib/secureStorage';

interface AuthContextValue {
  user: SupabaseUser | null;
  session: Session | null;
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  preferredWorkspaceId: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  needsWorkspaceSelection: boolean;
  showWelcome: boolean;
  error: string | null;
  showAuthWebView: boolean;
  signInWithBrowser: () => Promise<void>;
  closeAuthWebView: () => void;
  refreshAuthState: () => Promise<void>;
  signOut: () => Promise<void>;
  selectWorkspace: (workspace: Workspace) => void;
  switchWorkspace: () => void;
  dismissWelcome: () => void;
  clearError: () => void;
  setError: (message: string | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function useAuthState() {
  const isMountedRef = useRef(true);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [preferredWorkspaceId, setPreferredWorkspaceId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAuthWebView, setShowAuthWebView] = useState(false);

  const isAuthenticated = !!user && !!session;
  // Need workspace selection if authenticated but no workspace selected
  const needsWorkspaceSelection = isAuthenticated && !currentWorkspace && workspaces.length > 0;

  const resolveWorkspaceState = useCallback(async (userId: string) => {
    devLog('[mobile-auth] workspace:resolve:start', {userId});
    const userWorkspaces = await getUserWorkspaces(userId);
    devLog('[mobile-auth] workspace:resolve:fetched', {
      count: userWorkspaces.length,
      ids: userWorkspaces.map(w => w.id),
    });

    if (!isMountedRef.current) {
      return;
    }

    setWorkspaces(userWorkspaces);

    let selectedWorkspace: Workspace | null = null;
    let selectedPreferredId: string | null = null;

    if (userWorkspaces.length > 0) {
      const primaryWorkspace = await getUserPrimaryWorkspace();
      if (!isMountedRef.current) {
        return;
      }

      if (primaryWorkspace) {
        const primary = userWorkspaces.find(w => w.id === primaryWorkspace.workspace_id);
        if (primary) {
          devLog('✅ Using primary workspace:', primary.name);
          selectedWorkspace = primary;
          selectedPreferredId = primary.id;
        }
      }

      if (!selectedWorkspace) {
        const preferredId = await getUserPreferredWorkspace(userId);
        if (!isMountedRef.current) {
          return;
        }

        devLog('Preferred workspace ID:', preferredId);
        const preferredWorkspace = preferredId
          ? userWorkspaces.find(w => w.id === preferredId)
          : null;

        if (preferredWorkspace) {
          devLog('✅ Using preferred workspace:', preferredWorkspace.name);
          selectedWorkspace = preferredWorkspace;
          selectedPreferredId = preferredId;
        }
      }

      if (!selectedWorkspace && userWorkspaces.length === 1) {
        devLog('✅ Using first workspace (only one available):', userWorkspaces[0].name);
        selectedWorkspace = userWorkspaces[0];
        selectedPreferredId = userWorkspaces[0].id;
      }
    }

    setCurrentWorkspace(selectedWorkspace);
    setPreferredWorkspaceId(selectedPreferredId || selectedWorkspace?.id || null);
    devLog('[mobile-auth] workspace:resolve:final', {
      selectedWorkspaceId: selectedWorkspace?.id || null,
      preferredWorkspaceId: selectedPreferredId || selectedWorkspace?.id || null,
      needsWorkspaceSelection: userWorkspaces.length > 0 && !selectedWorkspace,
    });
  }, []);

  const refreshAuthState = useCallback(async (retryCount = 0) => {
    if (isMountedRef.current) {
      setIsLoading(true);
    }

    try {
      const {data: {session: existingSession}} = await supabase.auth.getSession();
      devLog('[mobile-auth] refreshAuthState:getSession', {
        hasSession: !!existingSession,
        userId: existingSession?.user?.id || null,
        retryCount,
      });

      if (!isMountedRef.current) {
        return;
      }

      if (existingSession) {
        setSession(existingSession);
        setUser(existingSession.user);
        await resolveWorkspaceState(existingSession.user.id);
      } else {
        // AsyncStorage can be slow to hydrate on cold start (e.g. when not connected to Metro).
        // Retry once after a short delay to allow storage to be ready.
        if (retryCount < 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
          if (isMountedRef.current) {
            return refreshAuthState(retryCount + 1);
          }
        } else {
          setSession(null);
          setUser(null);
          setWorkspaces([]);
          setCurrentWorkspace(null);
          setPreferredWorkspaceId(null);
        }
      }
    } catch (err) {
      console.error('[mobile-auth] refreshAuthState:error', err);
      if (isMountedRef.current) {
        setError('Failed to refresh authentication state.');
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [resolveWorkspaceState]);

  const handleSignedInSession = useCallback(async (newSession: Session) => {
    devLog('[mobile-auth] handleSignedInSession:start', {
      userId: newSession.user.id,
      email: newSession.user.email,
    });

    if (isMountedRef.current) {
      setIsLoading(true);
      setError(null);
      setShowAuthWebView(false);
      setCurrentWorkspace(null);
      setWorkspaces([]);
      setSession(newSession);
      setUser(newSession.user);
    }

    try {
      await resolveWorkspaceState(newSession.user.id);
    } catch (workspaceErr) {
      console.error('Error loading workspaces:', workspaceErr);
      if (isMountedRef.current) {
        setError('Signed in, but failed to load your workspaces.');
      }
    } finally {
      if (isMountedRef.current) {
        devLog('[mobile-auth] handleSignedInSession:done');
        setIsLoading(false);
      }
    }
  }, [resolveWorkspaceState]);

  // Initialize auth state
  useEffect(() => {
    isMountedRef.current = true;
    
    const initializeAuth = async () => {
      try {
        devLog('Initializing auth...');
        await refreshAuthState();
      } catch (err) {
        console.error('Error initializing auth:', err);
      } finally {
        if (isMountedRef.current) {
          devLog('Auth initialization complete');
        }
      }
    };

    // Set up auth state change listener
    const {data: {subscription}} = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        devLog('Auth state change:', event);
        if (event === 'SIGNED_IN' && newSession) {
          devLog('[mobile-auth] auth-state:SIGNED_IN', {
            userId: newSession.user.id,
            email: newSession.user.email,
            hasAccessToken: !!newSession.access_token,
            accessTokenLength: newSession.access_token?.length || 0,
          });
          // Important: do not await Supabase calls inside onAuthStateChange.
          // Defer follow-up work so setSession() can fully resolve.
          setTimeout(() => {
            void handleSignedInSession(newSession);
          }, 0);
        } else if (event === 'SIGNED_OUT') {
          devLog('[mobile-auth] auth-state:SIGNED_OUT');
          setSession(null);
          setUser(null);
          setWorkspaces([]);
          setCurrentWorkspace(null);
        }
      },
    );

    // Run initialization
    initializeAuth();
    
    // Safety timeout - if auth takes more than 10 seconds, stop loading
    const timeout = setTimeout(() => {
      if (isMountedRef.current) {
        devWarn('Auth initialization timed out');
        setIsLoading(false);
      }
    }, 10000);
    
    // Cleanup
    return () => {
      isMountedRef.current = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [handleSignedInSession, refreshAuthState]);

  const signInWithBrowser = useCallback(async () => {
    setError(null);

    if (Platform.OS === 'ios' && isNativeAuthSessionAvailable()) {
      setIsLoading(true);
      try {
        const authUrl = getSignInWithBrowserUrl();
        const callbackUrl = await startNativeAuthSession(authUrl);
        const result = await createSessionFromUrl(callbackUrl);
        if (!result) {
          setError('Invalid auth response');
          return;
        }
        await refreshAuthState();
      } catch (err: unknown) {
        const e = err as {code?: string; message?: string};
        if (e?.code === 'E_CANCELLED') {
          return;
        }
        setError(typeof e?.message === 'string' ? e.message : 'Sign-in failed');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    setShowAuthWebView(true);
  }, [refreshAuthState]);

  const closeAuthWebView = useCallback(() => {
    setShowAuthWebView(false);
  }, []);

  const selectWorkspace = useCallback((workspace: Workspace) => {
    setCurrentWorkspace(workspace);
    setPreferredWorkspaceId(workspace.id);
    // Welcome screen removed - go straight to app
    // Optionally save as preferred (fire and forget, don't block on errors)
    if (user) {
      setUserPreferredWorkspace(user.id, workspace.id).catch(() => {
        // Silently ignore - preferred_workspace_id column may not exist
      });
    }
  }, [user]);

  const dismissWelcome = useCallback(() => {
    setShowWelcome(false);
  }, []);

  const switchWorkspace = useCallback(() => {
    // Clear current workspace to trigger workspace selection screen
    setCurrentWorkspace(null);
  }, []);

  const signOut = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      await supabaseSignOut();
      // Clear stored credentials on sign out
      await clearCredentials();
      setUser(null);
      setSession(null);
      setWorkspaces([]);
      setCurrentWorkspace(null);
      setPreferredWorkspaceId(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign out failed';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    user,
    session,
    workspaces,
    currentWorkspace,
    preferredWorkspaceId,
    isLoading,
    isAuthenticated,
    needsWorkspaceSelection,
    showWelcome,
    error,
    showAuthWebView,
    signInWithBrowser,
    closeAuthWebView,
    refreshAuthState,
    signOut,
    selectWorkspace,
    switchWorkspace,
    dismissWelcome,
    clearError,
    setError,
  };
}

export {AuthContext};
export type {AuthContextValue};

