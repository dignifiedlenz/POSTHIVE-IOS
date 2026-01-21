import {useState, useEffect, useCallback, createContext, useContext} from 'react';
import {User as SupabaseUser, Session} from '@supabase/supabase-js';
import {supabase, signIn as supabaseSignIn, signOut as supabaseSignOut} from '../lib/supabase';
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
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  selectWorkspace: (workspace: Workspace) => void;
  switchWorkspace: () => void;
  dismissWelcome: () => void;
  clearError: () => void;
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
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [preferredWorkspaceId, setPreferredWorkspaceId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAuthenticated = !!user && !!session;
  // Need workspace selection if authenticated but no workspace selected
  const needsWorkspaceSelection = isAuthenticated && !currentWorkspace && workspaces.length > 0;

  // Initialize auth state
  useEffect(() => {
    let isMounted = true;
    
    const initializeAuth = async () => {
      try {
        console.log('Initializing auth...');
        const {data: {session: existingSession}} = await supabase.auth.getSession();
        console.log('Got session:', existingSession ? 'yes' : 'no');
        
        if (existingSession && isMounted) {
          setSession(existingSession);
          setUser(existingSession.user);
          
          // Load workspaces
          try {
            const userWorkspaces = await getUserWorkspaces(existingSession.user.id);
            console.log('Loaded workspaces:', userWorkspaces.length);
            
            if (isMounted) {
              setWorkspaces(userWorkspaces);
              
              // Auto-select workspace: Primary > Preferred > First workspace
              if (userWorkspaces.length > 0) {
                let selectedWorkspace: Workspace | null = null;
                let selectedPreferredId: string | null = null;
                
                // Step 1: Try to get primary workspace first
                const primaryWorkspace = await getUserPrimaryWorkspace();
                if (primaryWorkspace) {
                  const primary = userWorkspaces.find(w => w.id === primaryWorkspace.workspace_id);
                  if (primary) {
                    console.log('✅ Using primary workspace:', primary.name);
                    selectedWorkspace = primary;
                    selectedPreferredId = primary.id;
                  }
                }
                
                // Step 2: Try to get preferred workspace (last used) if no primary found
                if (!selectedWorkspace) {
                  const preferredId = await getUserPreferredWorkspace(existingSession.user.id);
                  console.log('Preferred workspace ID:', preferredId);
                  
                  const preferredWorkspace = preferredId 
                    ? userWorkspaces.find(w => w.id === preferredId)
                    : null;
                  
                  if (preferredWorkspace) {
                    console.log('✅ Using preferred workspace:', preferredWorkspace.name);
                    selectedWorkspace = preferredWorkspace;
                    selectedPreferredId = preferredId;
                  }
                }
                
                // Step 3: Fallback to first workspace if only one exists
                if (!selectedWorkspace && userWorkspaces.length === 1) {
                  console.log('✅ Using first workspace (only one available):', userWorkspaces[0].name);
                  selectedWorkspace = userWorkspaces[0];
                  selectedPreferredId = userWorkspaces[0].id;
                }
                
                // Set the selected workspace and preferred ID
                if (selectedWorkspace) {
                  setCurrentWorkspace(selectedWorkspace);
                  setPreferredWorkspaceId(selectedPreferredId || selectedWorkspace.id);
                }
              }
            }
          } catch (workspaceErr) {
            console.error('Error loading workspaces:', workspaceErr);
          }
        }
      } catch (err) {
        console.error('Error initializing auth:', err);
      } finally {
        if (isMounted) {
          console.log('Auth initialization complete');
          setIsLoading(false);
        }
      }
    };

    // Set up auth state change listener
    const {data: {subscription}} = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        console.log('Auth state change:', event);
        if (event === 'SIGNED_IN' && newSession) {
          setSession(newSession);
          setUser(newSession.user);
        } else if (event === 'SIGNED_OUT') {
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
      if (isMounted) {
        console.warn('Auth initialization timed out');
        setIsLoading(false);
      }
    }, 10000);
    
    // Cleanup
    return () => {
      isMounted = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const {user: signedInUser, session: newSession} = await supabaseSignIn(email, password);
      setUser(signedInUser);
      setSession(newSession);
      
      // Load workspaces
      const userWorkspaces = await getUserWorkspaces(signedInUser.id);
      setWorkspaces(userWorkspaces);
      
      // Auto-select workspace: Primary > Preferred > First workspace
      let autoSelectedWorkspace = false;
      if (userWorkspaces.length > 0) {
        // Step 1: Try to get primary workspace first
        const primaryWorkspace = await getUserPrimaryWorkspace();
        if (primaryWorkspace) {
          const primary = userWorkspaces.find(w => w.id === primaryWorkspace.workspace_id);
          if (primary) {
            console.log('✅ Using primary workspace:', primary.name);
            setCurrentWorkspace(primary);
            setPreferredWorkspaceId(primary.id);
            autoSelectedWorkspace = true;
          }
        }
        
        // Step 2: Try preferred workspace if no primary found
        if (!autoSelectedWorkspace) {
          const preferredId = await getUserPreferredWorkspace(signedInUser.id);
          setPreferredWorkspaceId(preferredId);
          const preferredWorkspace = preferredId 
            ? userWorkspaces.find(w => w.id === preferredId)
            : null;
          
          if (preferredWorkspace) {
            console.log('✅ Using preferred workspace:', preferredWorkspace.name);
            setCurrentWorkspace(preferredWorkspace);
            autoSelectedWorkspace = true;
          } else if (userWorkspaces.length === 1) {
            // Step 3: Fallback to first workspace if only one exists
            console.log('✅ Using first workspace (only one available):', userWorkspaces[0].name);
            setCurrentWorkspace(userWorkspaces[0]);
            setPreferredWorkspaceId(userWorkspaces[0].id);
            autoSelectedWorkspace = true;
          }
        }
      }
      
      // Welcome screen removed - go straight to app
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign in failed';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
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
    signIn,
    signOut,
    selectWorkspace,
    switchWorkspace,
    dismissWelcome,
    clearError,
  };
}

export {AuthContext};
export type {AuthContextValue};

