import React, {useState, useEffect, useRef, useCallback, useMemo} from 'react';
import {
  StatusBar,
  View,
  StyleSheet,
  Text,
  Animated,
  Easing,
  Dimensions,
  Linking,
  Platform,
  ActivityIndicator,
} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import {createStackNavigator} from '@react-navigation/stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {LayoutDashboard, Calendar, Folder, User} from 'lucide-react-native';
import {theme} from '../theme';
import {useAuthState, AuthContext} from '../hooks/useAuth';
import {useOrientation} from '../hooks/useOrientation';
import {SidebarMenu} from '../components/SidebarMenu';
import {LandscapeMenuButton} from '../components/LandscapeMenuButton';
import {CustomTabBar} from '../components/CustomTabBar';
import {TabBarProvider} from '../contexts/TabBarContext';
import {HoldToTalkOverlay} from '../components/HoldToTalkOverlay';
import {NoisyWaveBackground} from '../components/NoisyWaveBackground';

// Screens
import {LoginScreen} from '../screens/auth/LoginScreen';
import {WorkspaceDropdownModal} from '../components/WorkspaceDropdownModal';
import {WelcomeScreen} from '../screens/auth/WelcomeScreen';
import {DashboardScreen} from '../screens/dashboard/DashboardScreen';
import {CreationFlowScreen} from '../screens/creation/CreationFlowScreen';
import {DeliverableReviewScreen} from '../screens/deliverables/DeliverableReviewScreen';
import {ProjectsScreen} from '../screens/projects/ProjectsScreen';
import {ProjectDeliverablesScreen} from '../screens/projects/ProjectDeliverablesScreen';
import {SeriesItemsScreen} from '../screens/series/SeriesItemsScreen';
import {SeriesListScreen} from '../screens/series/SeriesListScreen';
import {ProfileScreen} from '../screens/profile/ProfileScreen';
import {NotificationSettingsScreen} from '../screens/settings/NotificationSettingsScreen';
import {TransferHistoryScreen} from '../screens/transfer/TransferHistoryScreen';
import {TransferDetailScreen} from '../screens/transfer/TransferDetailScreen';
import {CalendarScreen} from '../screens/calendar/CalendarScreen';

// Push Notifications
import {setupBackgroundHandler, usePushNotifications, setupBackgroundRefresh} from '../hooks';

// Initialize background handlers
setupBackgroundHandler();
setupBackgroundRefresh();

const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get('window');

export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
};

export type DashboardStackParamList = {
  DashboardMain: {openNotifications?: boolean};
  CreateTodo: undefined;
  DeliverableReview: {deliverableId: string; versionId?: string; commentId?: string};
};

export type ReviewStackParamList = {
  ProjectsList: undefined;
  SeriesList: undefined;
  ProjectDeliverables: {projectId: string; projectName: string; clientName?: string; thumbnailUrl?: string};
  SeriesItems: {seriesId: string; seriesName: string; seriesDescription?: string; thumbnailUrl?: string; itemCount: number};
  DeliverableReview: {deliverableId: string; versionId?: string; commentId?: string};
};

export type ProfileStackParamList = {
  ProfileMain: undefined;
  NotificationSettings: undefined;
  TransferHistory: undefined;
  TransferDetail: {transfer: import('../lib/api').TransferOperation};
};

export type MainTabParamList = {
  DashboardTab: undefined;
  CalendarTab: {date?: string; scrollToTime?: string};
  ReviewTab: undefined;
  ProfileTab: undefined;
};

const DashboardStack = createStackNavigator<DashboardStackParamList>();
const ReviewStack = createStackNavigator<ReviewStackParamList>();
const ProfileStack = createStackNavigator<ProfileStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

// Wrapper components to handle the stack navigators within tabs
function DashboardStackNavigator() {
  return (
    <DashboardStack.Navigator 
      screenOptions={{
        headerShown: false,
        cardStyle: {backgroundColor: 'transparent'},
      }}>
      <DashboardStack.Screen name="DashboardMain" component={DashboardScreen} />
      <DashboardStack.Screen
        name="CreateTodo"
        component={CreationFlowScreen}
        options={{presentation: 'fullScreenModal'}}
      />
      <DashboardStack.Screen
        name="DeliverableReview"
        component={DeliverableReviewScreen}
      />
    </DashboardStack.Navigator>
  );
}

function ReviewStackNavigator() {
  return (
    <ReviewStack.Navigator 
      screenOptions={{
        headerShown: false,
        cardStyle: {backgroundColor: 'transparent'},
      }}>
      <ReviewStack.Screen
        name="ProjectsList"
        component={ProjectsScreen}
      />
      <ReviewStack.Screen
        name="SeriesList"
        component={SeriesListScreen}
      />
      <ReviewStack.Screen
        name="ProjectDeliverables"
        component={ProjectDeliverablesScreen}
      />
      <ReviewStack.Screen
        name="SeriesItems"
        component={SeriesItemsScreen}
      />
      <ReviewStack.Screen
        name="DeliverableReview"
        component={DeliverableReviewScreen}
      />
    </ReviewStack.Navigator>
  );
}

function ProfileStackNavigator() {
  return (
    <ProfileStack.Navigator 
      screenOptions={{
        headerShown: false,
        cardStyle: {backgroundColor: 'transparent'},
      }}>
      <ProfileStack.Screen name="ProfileMain" component={ProfileScreen} />
      <ProfileStack.Screen
        name="NotificationSettings"
        component={NotificationSettingsScreen}
      />
      <ProfileStack.Screen
        name="TransferHistory"
        component={TransferHistoryScreen}
      />
      <ProfileStack.Screen
        name="TransferDetail"
        component={TransferDetailScreen}
      />
    </ProfileStack.Navigator>
  );
}

// Authenticated app wrapper with push notifications
interface AuthenticatedAppProps {
  userId?: string;
  workspaceId?: string;
  onTabIndexChange?: (index: number) => void;
}

function AuthenticatedApp({userId, workspaceId, onTabIndexChange}: AuthenticatedAppProps) {
  const navigationRef = useRef<any>(null);
  const orientation = useOrientation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentRoute, setCurrentRoute] = useState('DashboardTab');
  const [isNavReady, setIsNavReady] = useState(false);
  const [currentTabIndex, setCurrentTabIndex] = useState(0);
  const launchDeepLinkHandled = useRef(false);
  const previousWorkspaceId = useRef<string | undefined>(workspaceId);

  // Initialize push notifications
  usePushNotificationHandler(userId, workspaceId, navigationRef);

  // Handle deep links
  useEffect(() => {
    const handleDeepLink = (url: string, isInitial = false) => {
      console.log('Deep link received:', url);
      
      if (url.startsWith('posthive://')) {
        const path = url.replace('posthive://', '');
        let handled = true;
        
        if (path === 'activity') {
          // Navigate to DashboardTab and open notifications
          navigationRef.current?.navigate('DashboardTab', {
            screen: 'DashboardMain',
            params: {openNotifications: true},
          });
        } else if (path.startsWith('deliverable/')) {
          const deliverableId = path.replace('deliverable/', '');
          navigationRef.current?.navigate('DashboardTab', {
            screen: 'DeliverableReview',
            params: {deliverableId},
          });
        } else if (path === 'deliverables') {
          navigationRef.current?.navigate('ReviewTab');
        } else if (path === 'series') {
          navigationRef.current?.navigate('ReviewTab', {
            screen: 'SeriesList',
          });
        } else if (path === 'calendar') {
          navigationRef.current?.navigate('CalendarTab');
        } else if (path === 'transfers') {
          // Navigate to dashboard for transfers
          navigationRef.current?.navigate('DashboardTab');
        } else {
          handled = false;
        }

        if (isInitial && handled) {
          launchDeepLinkHandled.current = true;
        }
      }
    };

    // Handle initial URL (app opened via deep link)
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink(url, true);
      }
    });

    // Handle deep links while app is running
    const subscription = Linking.addEventListener('url', (event) => {
      handleDeepLink(event.url);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Ensure dashboard is the default landing tab
  useEffect(() => {
    if (!isNavReady || !workspaceId) {
      return;
    }

    const workspaceChanged = Boolean(
      previousWorkspaceId.current && previousWorkspaceId.current !== workspaceId,
    );
    const isFirstWorkspaceLoad = !previousWorkspaceId.current;
    const shouldResetToDashboard =
      workspaceChanged || (isFirstWorkspaceLoad && !launchDeepLinkHandled.current);

    if (shouldResetToDashboard) {
      navigationRef.current?.reset({
        index: 0,
        routes: [{name: 'DashboardTab'}],
      });
    }

    previousWorkspaceId.current = workspaceId;
  }, [isNavReady, workspaceId]);

  // Listen to navigation state changes to track current route
  useEffect(() => {
    const unsubscribe = navigationRef.current?.addListener('state', (e: any) => {
      const state = e.data.state;
      if (state) {
        const route = state.routes[state.index];
        if (route?.name) {
          setCurrentRoute(route.name);
        }
      }
    });

    return unsubscribe;
  }, []);

  return (
    <>
      {/* Navigation content */}
      <NavigationContainer 
        ref={navigationRef}
        theme={{
          dark: true,
          colors: {
            primary: '#FFFFFF',
            background: 'transparent',
            card: 'transparent',
            text: '#FFFFFF',
            border: 'transparent',
            notification: '#FFFFFF',
          },
          fonts: {
            regular: {fontFamily: 'System', fontWeight: '400'},
            medium: {fontFamily: 'System', fontWeight: '500'},
            bold: {fontFamily: 'System', fontWeight: '700'},
            heavy: {fontFamily: 'System', fontWeight: '900'},
          },
        }}
        onReady={() => setIsNavReady(true)}
        onStateChange={(state) => {
          if (state) {
            const route = state.routes[state.index];
            if (route?.name) {
              setCurrentRoute(route.name);
            }
            // Update tab index for wave animation
            if (state.index !== undefined) {
              setCurrentTabIndex(state.index);
              onTabIndexChange?.(state.index);
            }
          }
        }}>
        <MainTabs orientation={orientation} onMenuPress={() => setSidebarOpen(true)} />
        {orientation === 'landscape' && (
          <>
            <LandscapeMenuButton onPress={() => setSidebarOpen(true)} />
            <SidebarMenu
              isOpen={sidebarOpen}
              onClose={() => setSidebarOpen(false)}
              currentRoute={currentRoute}
            />
          </>
        )}
      </NavigationContainer>
      {/* Hold-to-Talk Overlay */}
      <HoldToTalkOverlay />
    </>
  );
}

// Push notification handler - uses navigation ref passed from parent
function usePushNotificationHandler(
  userId: string | undefined,
  workspaceId: string | undefined,
  navigationRef: React.RefObject<any>,
) {
  const handleNotificationPress = useCallback((data: Record<string, unknown>) => {
    // Navigate based on notification data
    if (data.deliverable_id) {
      navigationRef.current?.navigate('DashboardTab', {
        screen: 'DeliverableReview',
        params: {
          deliverableId: data.deliverable_id,
          versionId: data.version_id as string | undefined,
          commentId: data.comment_id as string | undefined,
        },
      });
    } else if (data.todo_id) {
      navigationRef.current?.navigate('DashboardTab');
    } else if (data.project_id) {
      navigationRef.current?.navigate('ReviewTab', {
        screen: 'ProjectDeliverables',
        params: {
          projectId: data.project_id,
          projectName: (data.project_name as string) || 'Project',
        },
      });
    }
  }, [navigationRef]);

  // Initialize push notifications
  usePushNotifications({
    userId,
    workspaceId,
    onNotificationPress: handleNotificationPress,
  });
}

interface MainTabsProps {
  orientation: 'portrait' | 'landscape';
  onMenuPress: () => void;
}

function MainTabs({orientation, onMenuPress}: MainTabsProps) {
  const isLandscape = orientation === 'landscape';

  return (
    <Tab.Navigator
      initialRouteName="DashboardTab"
      tabBar={(props) => (isLandscape ? null : <CustomTabBar {...props} />)}
      screenOptions={{
        headerShown: false,
        sceneStyle: {backgroundColor: 'transparent'},
      }}>
      <Tab.Screen
        name="DashboardTab"
        component={DashboardStackNavigator}
        options={{
          tabBarLabel: 'Dashboard',
          tabBarIcon: ({color, size}) => (
            <LayoutDashboard size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ReviewTab"
        component={ReviewStackNavigator}
        options={{
          tabBarLabel: 'Projects',
          tabBarIcon: ({color, size}) => (
            <Folder size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="CalendarTab"
        component={CalendarScreen}
        options={{
          tabBarLabel: 'Calendar',
          tabBarIcon: ({color, size}) => (
            <Calendar size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileStackNavigator}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({color, size}) => (
            <User size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

// Animated Splash Overlay
interface SplashOverlayProps {
  isLoading: boolean;
  onComplete: () => void;
}

function SplashOverlay({isLoading, onComplete}: SplashOverlayProps) {
  const logoTranslateX = useRef(new Animated.Value(0)).current;
  const logoOpacity = useRef(new Animated.Value(1)).current;
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (!isLoading && isVisible) {
      // Delay before starting animation
      const timer = setTimeout(() => {
        // Slide left and fade out
        Animated.parallel([
          Animated.timing(logoTranslateX, {
            toValue: -SCREEN_WIDTH,
            duration: 600,
            useNativeDriver: true,
            easing: Easing.in(Easing.cubic),
          }),
          Animated.timing(logoOpacity, {
            toValue: 0,
            duration: 500,
            delay: 100,
            useNativeDriver: true,
            easing: Easing.out(Easing.ease),
          }),
        ]).start(() => {
          setIsVisible(false);
          onComplete();
        });
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [isLoading, isVisible, logoTranslateX, logoOpacity, onComplete]);

  if (!isVisible) {
    return null;
  }

  return (
    <View style={styles.splashOverlay} pointerEvents={isLoading ? 'auto' : 'none'}>
      {/* Animated logo */}
      <Animated.View
        style={[
          styles.logoContainer,
          {
            opacity: logoOpacity,
            transform: [
              {translateX: logoTranslateX},
            ],
          },
        ]}>
        <Text style={styles.logo}>POSTHIVE</Text>
        {isLoading && (
          <ActivityIndicator
            size="large"
            color={theme.colors.textPrimary}
            style={styles.splashSpinner}
          />
        )}
      </Animated.View>
    </View>
  );
}

// Auth Screen with animated content
interface AuthScreenProps {
  authState: ReturnType<typeof useAuthState>;
  animationReady: boolean;
}

function AuthScreen({authState, animationReady}: AuthScreenProps) {
  const loginOpacity = useRef(new Animated.Value(0)).current;
  const loginTranslateX = useRef(new Animated.Value(SCREEN_WIDTH)).current;

  // Initial animation - login slides in from right
  useEffect(() => {
    if (animationReady) {
      Animated.parallel([
        Animated.timing(loginOpacity, {
          toValue: 1,
          duration: 600,
          delay: 200,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
        Animated.timing(loginTranslateX, {
          toValue: 0,
          duration: 600,
          delay: 200,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
      ]).start();
    }
  }, [animationReady, loginOpacity, loginTranslateX]);

  // Show login screen
  return (
    <Animated.View
      style={[
        styles.authContainer,
        {
          opacity: loginOpacity,
          transform: [
            {translateX: loginTranslateX},
          ],
        },
      ]}>
      <LoginScreen />
    </Animated.View>
  );
}

function AppContent() {
  const authState = useAuthState();
  const [splashComplete, setSplashComplete] = useState(false);
  const welcomeOpacity = useRef(new Animated.Value(0)).current;
  const welcomeTranslateX = useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const appOpacity = useRef(new Animated.Value(0)).current;
  const appTranslateX = useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const prevShowWelcome = useRef(authState.showWelcome);
  const prevIsAuthenticated = useRef<boolean>(!!(authState.isAuthenticated && authState.currentWorkspace));

  const handleSplashComplete = useCallback(() => {
    setSplashComplete(true);
  }, []);

  // Calculate auth step for wave animation (changes trigger wave shift)
  // Must be defined before any conditional returns
  const authStep = useMemo(() => {
    if (authState.isLoading) return 0;
    if (!authState.isAuthenticated) return 1;
    if (authState.needsWorkspaceSelection) return 2;
    return 3;
  }, [authState.isLoading, authState.isAuthenticated, authState.needsWorkspaceSelection]);

  // Animate welcome screen entrance
  useEffect(() => {
    if (authState.showWelcome && !prevShowWelcome.current) {
      Animated.parallel([
        Animated.timing(welcomeOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
        Animated.timing(welcomeTranslateX, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
      ]).start();
    }
    prevShowWelcome.current = authState.showWelcome;
  }, [authState.showWelcome, welcomeOpacity, welcomeTranslateX]);

  // Animate main app entrance (from workspace selection or welcome)
  useEffect(() => {
    if (authState.isAuthenticated && authState.currentWorkspace && !authState.isLoading && !prevIsAuthenticated.current) {
      // App slides in from right after workspace selection
      Animated.parallel([
        Animated.timing(appOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
        Animated.timing(appTranslateX, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
      ]).start();
    }
    prevIsAuthenticated.current = !!(authState.isAuthenticated && authState.currentWorkspace);
  }, [authState.isAuthenticated, authState.currentWorkspace, authState.isLoading, appOpacity, appTranslateX]);

  // Show welcome screen after login/workspace selection
  if (authState.showWelcome && authState.user) {
    const userName = authState.user.user_metadata?.name || 
                     authState.user.user_metadata?.full_name || 
                     authState.user.email?.split('@')[0] || 
                     'there';
    return (
      <AuthContext.Provider value={authState}>
        <Animated.View
          style={[
            styles.fullScreen,
            {
              opacity: welcomeOpacity,
              transform: [
                {translateX: welcomeTranslateX},
              ],
            },
          ]}>
          <WelcomeScreen
            userName={userName}
            onComplete={authState.dismissWelcome}
          />
        </Animated.View>
      </AuthContext.Provider>
    );
  }

  // Main app when authenticated with workspace
  const [globalTabIndex, setGlobalTabIndex] = useState(0);
  
  if (authState.isAuthenticated && authState.currentWorkspace && !authState.isLoading) {
    return (
      <AuthContext.Provider value={authState}>
        <View style={styles.fullScreen}>
          {/* Global background - always visible behind everything */}
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <NoisyWaveBackground tabIndex={globalTabIndex} />
          </View>
          <Animated.View
            style={[
              styles.fullScreen,
              {
                opacity: appOpacity,
                transform: [
                  {translateX: appTranslateX},
                ],
                backgroundColor: 'transparent',
              },
            ]}>
            <AuthenticatedApp
              userId={authState.user?.id}
              workspaceId={authState.currentWorkspace?.id}
              onTabIndexChange={setGlobalTabIndex}
            />
          </Animated.View>
        </View>
      </AuthContext.Provider>
    );
  }

  // Auth flow with splash animation
  return (
    <AuthContext.Provider value={authState}>
      <View style={styles.container}>
        {/* Global wave background for auth flow */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <NoisyWaveBackground tabIndex={authStep} />
        </View>

        {/* Background content (Login) */}
        <AuthScreen 
          authState={authState} 
          animationReady={splashComplete && !authState.isLoading}
        />
        
        {/* Splash overlay on top */}
        <SplashOverlay
          isLoading={authState.isLoading}
          onComplete={handleSplashComplete}
        />

        {/* Workspace selection modal - shown when authenticated but no workspace selected */}
        {authState.needsWorkspaceSelection && (
          <WorkspaceDropdownModal
            visible={authState.needsWorkspaceSelection}
            workspaces={authState.workspaces}
            currentWorkspace={null}
            onSelectWorkspace={authState.selectWorkspace}
            onClose={() => {
              // Don't allow closing if workspace is required
            }}
          />
        )}
      </View>
    </AuthContext.Provider>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <TabBarProvider>
          <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
          <View style={styles.appContainer}>
            <AppContent />
          </View>
        </TabBarProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000', // Black background for wave effect
  },
  appContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent', // Transparent to show wave background
  },
  splashOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    backgroundColor: 'transparent', // Show wave background
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 101,
  },
  logo: {
    color: theme.colors.textPrimary,
    fontSize: 56,
    fontWeight: '900',
    letterSpacing: -1,
  },
  splashSpinner: {
    marginTop: 24,
  },
  fullScreen: {
    flex: 1,
    width: '100%',
  },
  authContainer: {
    flex: 1,
  },
});
