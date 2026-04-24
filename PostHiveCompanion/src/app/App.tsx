import React, {useState, useEffect, useRef, useCallback} from 'react';
import {
  StatusBar,
  View,
  StyleSheet,
  Animated,
  Easing,
  Dimensions,
  Linking,
  Platform,
} from 'react-native';
import {createSessionFromUrl} from '../lib/supabase';
import {
  NavigationContainer,
  type NavigatorScreenParams,
} from '@react-navigation/native';
import {createStackNavigator} from '@react-navigation/stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createNativeBottomTabNavigator} from '@react-navigation/bottom-tabs/unstable';
import {SafeAreaProvider, useSafeAreaInsets} from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import ReanimatedDrawerLayout, {
  DrawerPosition,
  DrawerType,
  type DrawerLayoutMethods,
} from 'react-native-gesture-handler/ReanimatedDrawerLayout';
import Reanimated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import {useAuthState, AuthContext} from '../hooks/useAuth';
import {SidebarDrawerProvider} from '../contexts/SidebarDrawerContext';
import {SidebarMenu, SIDEBAR_WIDTH} from '../components/SidebarMenu';
import {MainAppTopBar} from '../components/MainAppTopBar';
import {MainFloatingCreateFab} from '../components/MainFloatingCreateFab';
import {TabSwipeWrapper} from '../components/TabSwipeWrapper';
import {TabBarProvider, useTabBar} from '../contexts/TabBarContext';
import {theme} from '../theme';
import {MessageCircle, Home, Film, Layers, Calendar as CalendarGlyph} from 'lucide-react-native';

// Screens
import {AuthWelcomeScreen} from '../screens/auth/AuthWelcomeScreen';
import {WorkspaceDropdownModal} from '../components/WorkspaceDropdownModal';
import {AuthWebViewModal} from '../components/AuthWebViewModal';
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
import {DriveExplorerScreen} from '../screens/drive/DriveExplorerScreen';
import {NotificationsScreen} from '../screens/notifications/NotificationsScreen';
import {RecentDeliverablesScreen} from '../screens/deliverables/RecentDeliverablesScreen';
import {AssistantChatScreen} from '../screens/assistant/AssistantChatScreen';

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

/** Dashboard hub + flows that start from home (reviews opened from dashboard, etc.). */
export type HomeStackParamList = {
  Dashboard: {openNotifications?: boolean} | undefined;
  CreateTodo:
    | {
        initialCreationType?: 'project' | 'deliverable' | 'task' | 'event';
      }
    | undefined;
  ProjectDeliverables: {
    projectId: string;
    projectName: string;
    clientName?: string;
    thumbnailUrl?: string;
  };
  SeriesList: undefined;
  SeriesItems: {
    seriesId: string;
    seriesName: string;
    seriesDescription?: string;
    thumbnailUrl?: string;
    itemCount: number;
  };
  /** Formerly on the root `Menu` stack — kept on Home so the main tab bar stays visible. */
  Profile: undefined;
  NotificationSettings: undefined;
  TransferHistory: undefined;
  TransferDetail: {transfer: import('../lib/api').TransferOperation};
  DriveExplorer: undefined;
  Notifications: undefined;
};

export type AssistantStackParamList = {
  AssistantChat: undefined;
};

export type DeliverablesStackParamList = {
  RecentDeliverables: undefined;
};

export type ProjectsStackParamList = {
  Projects: undefined;
  ProjectDeliverables: {
    projectId: string;
    projectName: string;
    clientName?: string;
    thumbnailUrl?: string;
  };
  SeriesList: undefined;
  SeriesItems: {
    seriesId: string;
    seriesName: string;
    seriesDescription?: string;
    thumbnailUrl?: string;
    itemCount: number;
  };
};

export type CalendarStackParamList = {
  Calendar: {date?: string; scrollToTime?: string} | undefined;
};

/** Native tabs: one stack per primary surface (no shared PagerView). */
export type MainTabParamList = {
  Assistant: NavigatorScreenParams<AssistantStackParamList> | undefined;
  Home: NavigatorScreenParams<HomeStackParamList> | undefined;
  Deliverables: NavigatorScreenParams<DeliverablesStackParamList> | undefined;
  Projects: NavigatorScreenParams<ProjectsStackParamList> | undefined;
  Calendar: NavigatorScreenParams<CalendarStackParamList> | undefined;
};

export type AuthenticatedRootParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  /**
   * DeliverableReview lives at the root level (above the tab navigator) so it presents
   * over the iOS native bottom tab bar. The unstable native bottom tab navigator does not
   * expose a per-screen "hide tab bar" option, so the only way to give the review a true
   * full-screen surface is to escape the tab navigator entirely.
   */
  DeliverableReview: {deliverableId: string; versionId?: string; commentId?: string};
};

/** @deprecated Use HomeStackParamList */
export type MainStackParamList = HomeStackParamList;

/** @deprecated Use HomeStackParamList */
export type DashboardStackParamList = HomeStackParamList;

/** @deprecated Use DeliverablesStackParamList */
export type RecentDeliverablesStackParamList = DeliverablesStackParamList;

/**
 * @deprecated Prefer `HomeStackParamList` / `ProjectsStackParamList` / `DeliverablesStackParamList`.
 * Kept for screens that still import `ReviewStackParamList`.
 */
export type ReviewStackParamList = HomeStackParamList;

const HomeStack = createStackNavigator<HomeStackParamList>();
const AssistantStack = createStackNavigator<AssistantStackParamList>();
const DeliverablesStack = createStackNavigator<DeliverablesStackParamList>();
const ProjectsStack = createStackNavigator<ProjectsStackParamList>();
const CalendarStack = createStackNavigator<CalendarStackParamList>();
const RootStack = createStackNavigator<AuthenticatedRootParamList>();
const NativeTab = createNativeBottomTabNavigator<MainTabParamList>();
const JsTab = createBottomTabNavigator<MainTabParamList>();

/** Space below floating top bar (safe area + bar chrome); keep in sync with MainAppTopBar layout */
const MAIN_FLOATING_TOP_BAR_EXTRA = 64;

/** Solid stack cards for settings / drive / transfers (avoid transparent bleed over the dashboard). */
const HOME_OPAQUE_CARD_STYLE = {backgroundColor: theme.colors.background};

function AuthenticatedChrome({children}: {children: React.ReactNode}) {
  const insets = useSafeAreaInsets();
  // Height of the bottom scrim: covers the system tab bar area + a soft fade
  // above it so content doesn't collide visually with the nav icons.
  const bottomScrimHeight = Math.max(insets.bottom, 0) + 110;
  return (
    <View style={styles.mainPagerRoot}>
      <View style={[styles.mainPagerContent, {paddingTop: insets.top + MAIN_FLOATING_TOP_BAR_EXTRA}]}>
        <TabSwipeWrapper>{children}</TabSwipeWrapper>
      </View>
      <LinearGradient
        pointerEvents="none"
        colors={[
          'rgba(0,0,0,0)',
          'rgba(0,0,0,0.55)',
          'rgba(0,0,0,0.92)',
          'rgba(0,0,0,0.96)',
        ]}
        locations={[0, 0.55, 0.85, 1]}
        style={[styles.bottomNavScrim, {height: bottomScrimHeight}]}
      />
      <View style={styles.mainPagerTopOverlay} pointerEvents="box-none">
        <MainAppTopBar />
      </View>
    </View>
  );
}

function AssistantChatRoot() {
  return (
    <AuthenticatedChrome>
      <AssistantChatScreen />
    </AuthenticatedChrome>
  );
}

function DashboardRoot() {
  return (
    <AuthenticatedChrome>
      <DashboardScreen />
    </AuthenticatedChrome>
  );
}

function RecentDeliverablesRoot() {
  return (
    <AuthenticatedChrome>
      <RecentDeliverablesScreen />
    </AuthenticatedChrome>
  );
}

function ProjectsRoot() {
  return (
    <AuthenticatedChrome>
      <ProjectsScreen />
    </AuthenticatedChrome>
  );
}

function CalendarRoot() {
  return (
    <AuthenticatedChrome>
      <CalendarScreen />
    </AuthenticatedChrome>
  );
}

function DriveExplorerHomeRoot() {
  return (
    <AuthenticatedChrome>
      <DriveExplorerScreen />
    </AuthenticatedChrome>
  );
}

function TransferHistoryHomeRoot() {
  return (
    <AuthenticatedChrome>
      <TransferHistoryScreen />
    </AuthenticatedChrome>
  );
}

function TransferDetailHomeRoot() {
  return (
    <AuthenticatedChrome>
      <TransferDetailScreen />
    </AuthenticatedChrome>
  );
}

function NotificationsHomeRoot() {
  return (
    <AuthenticatedChrome>
      <NotificationsScreen />
    </AuthenticatedChrome>
  );
}

function ProfileHomeRoot() {
  return (
    <AuthenticatedChrome>
      <ProfileScreen />
    </AuthenticatedChrome>
  );
}

function NotificationSettingsHomeRoot() {
  return (
    <AuthenticatedChrome>
      <NotificationSettingsScreen />
    </AuthenticatedChrome>
  );
}

function AssistantStackNavigator() {
  return (
    <AssistantStack.Navigator
      initialRouteName="AssistantChat"
      screenOptions={{
        headerShown: false,
        cardStyle: {backgroundColor: 'transparent'},
        gestureEnabled: true,
      }}>
      <AssistantStack.Screen name="AssistantChat" component={AssistantChatRoot} />
    </AssistantStack.Navigator>
  );
}

function HomeStackNavigator() {
  return (
    <HomeStack.Navigator
      initialRouteName="Dashboard"
      screenOptions={{
        headerShown: false,
        cardStyle: {backgroundColor: 'transparent'},
        gestureEnabled: true,
      }}>
      <HomeStack.Screen name="Dashboard" component={DashboardRoot} />
      <HomeStack.Screen
        name="CreateTodo"
        component={CreationFlowScreen}
        options={{presentation: 'modal'}}
      />
      <HomeStack.Screen name="ProjectDeliverables" component={ProjectDeliverablesScreen} />
      <HomeStack.Screen name="SeriesList" component={SeriesListScreen} />
      <HomeStack.Screen name="SeriesItems" component={SeriesItemsScreen} />
      <HomeStack.Screen
        name="Profile"
        component={ProfileHomeRoot}
        options={{cardStyle: HOME_OPAQUE_CARD_STYLE}}
      />
      <HomeStack.Screen
        name="NotificationSettings"
        component={NotificationSettingsHomeRoot}
        options={{cardStyle: HOME_OPAQUE_CARD_STYLE}}
      />
      <HomeStack.Screen
        name="TransferHistory"
        component={TransferHistoryHomeRoot}
        options={{cardStyle: HOME_OPAQUE_CARD_STYLE}}
      />
      <HomeStack.Screen
        name="TransferDetail"
        component={TransferDetailHomeRoot}
        options={{cardStyle: HOME_OPAQUE_CARD_STYLE}}
      />
      <HomeStack.Screen
        name="DriveExplorer"
        component={DriveExplorerHomeRoot}
        options={{cardStyle: HOME_OPAQUE_CARD_STYLE}}
      />
      <HomeStack.Screen
        name="Notifications"
        component={NotificationsHomeRoot}
        options={{cardStyle: HOME_OPAQUE_CARD_STYLE}}
      />
    </HomeStack.Navigator>
  );
}

function DeliverablesStackNavigator() {
  return (
    <DeliverablesStack.Navigator
      initialRouteName="RecentDeliverables"
      screenOptions={{
        headerShown: false,
        cardStyle: {backgroundColor: 'transparent'},
        gestureEnabled: true,
      }}>
      <DeliverablesStack.Screen name="RecentDeliverables" component={RecentDeliverablesRoot} />
    </DeliverablesStack.Navigator>
  );
}

function ProjectsStackNavigator() {
  return (
    <ProjectsStack.Navigator
      initialRouteName="Projects"
      screenOptions={{
        headerShown: false,
        cardStyle: {backgroundColor: 'transparent'},
        gestureEnabled: true,
      }}>
      <ProjectsStack.Screen name="Projects" component={ProjectsRoot} />
      <ProjectsStack.Screen name="ProjectDeliverables" component={ProjectDeliverablesScreen} />
      <ProjectsStack.Screen name="SeriesList" component={SeriesListScreen} />
      <ProjectsStack.Screen name="SeriesItems" component={SeriesItemsScreen} />
    </ProjectsStack.Navigator>
  );
}

function CalendarStackNavigator() {
  return (
    <CalendarStack.Navigator
      initialRouteName="Calendar"
      screenOptions={{
        headerShown: false,
        cardStyle: {backgroundColor: 'transparent'},
        gestureEnabled: true,
      }}>
      <CalendarStack.Screen name="Calendar" component={CalendarRoot} />
    </CalendarStack.Navigator>
  );
}

/** iOS native tabs: Navigation theme uses `colors.card: transparent`, which became the default
 *  `tabBarBackgroundColor` — on the simulator the bar can look like floating icons with no chrome.
 *  Give the tab bar its own dark surface (still works with blur on device). */
const nativeTabScreenOptions = {
  headerShown: false,
  sceneStyle: {backgroundColor: 'transparent' as const},
  tabBarActiveTintColor: '#FFFFFF',
  tabBarInactiveTintColor: 'rgba(255,255,255,0.42)',
  tabBarBlurEffect: 'systemMaterialDark' as const,
  tabBarStyle: {
    backgroundColor: 'rgba(10, 10, 10, 0.94)',
  },
};

function IOSNativeMainTabs() {
  return (
    <NativeTab.Navigator initialRouteName="Home" screenOptions={nativeTabScreenOptions}>
      <NativeTab.Screen
        name="Assistant"
        component={AssistantStackNavigator}
        options={{
          title: 'Assistant',
          tabBarLabel: 'Assistant',
          tabBarIcon: ({focused}) => ({
            type: 'sfSymbol',
            name: focused ? 'sparkles' : 'sparkles',
          }),
        }}
      />
      <NativeTab.Screen
        name="Home"
        component={HomeStackNavigator}
        options={{
          title: 'Home',
          tabBarLabel: 'Home',
          tabBarIcon: ({focused}) => ({
            type: 'sfSymbol',
            name: focused ? 'house.fill' : 'house',
          }),
        }}
      />
      <NativeTab.Screen
        name="Deliverables"
        component={DeliverablesStackNavigator}
        options={{
          title: 'Deliverables',
          tabBarLabel: 'Deliverables',
          tabBarIcon: ({focused}) => ({
            type: 'sfSymbol',
            name: focused ? 'play.rectangle.fill' : 'play.rectangle',
          }),
        }}
      />
      <NativeTab.Screen
        name="Projects"
        component={ProjectsStackNavigator}
        options={{
          title: 'Projects',
          tabBarLabel: 'Projects',
          tabBarIcon: ({focused}) => ({
            type: 'sfSymbol',
            name: focused ? 'square.stack.fill' : 'square.stack',
          }),
        }}
      />
      <NativeTab.Screen
        name="Calendar"
        component={CalendarStackNavigator}
        options={{
          title: 'Calendar',
          tabBarLabel: 'Calendar',
          tabBarIcon: ({focused}) => ({
            type: 'sfSymbol',
            name: focused ? 'calendar' : 'calendar',
          }),
        }}
      />
    </NativeTab.Navigator>
  );
}

const androidTabBarTheme = {
  tabBarActiveTintColor: '#FFFFFF',
  tabBarInactiveTintColor: 'rgba(255,255,255,0.45)',
  tabBarStyle: {
    backgroundColor: '#0A0A0A',
    borderTopColor: 'rgba(255,255,255,0.08)',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
};

function AndroidMaterialMainTabs() {
  return (
    <JsTab.Navigator initialRouteName="Home" screenOptions={{headerShown: false, ...androidTabBarTheme}}>
      <JsTab.Screen
        name="Assistant"
        component={AssistantStackNavigator}
        options={{
          tabBarLabel: 'Assistant',
          tabBarIcon: ({color, size}) => <MessageCircle size={size ?? 22} color={color} />,
        }}
      />
      <JsTab.Screen
        name="Home"
        component={HomeStackNavigator}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({color, size}) => <Home size={size ?? 22} color={color} />,
        }}
      />
      <JsTab.Screen
        name="Deliverables"
        component={DeliverablesStackNavigator}
        options={{
          tabBarLabel: 'Deliverables',
          tabBarIcon: ({color, size}) => <Film size={size ?? 22} color={color} />,
        }}
      />
      <JsTab.Screen
        name="Projects"
        component={ProjectsStackNavigator}
        options={{
          tabBarLabel: 'Projects',
          tabBarIcon: ({color, size}) => <Layers size={size ?? 22} color={color} />,
        }}
      />
      <JsTab.Screen
        name="Calendar"
        component={CalendarStackNavigator}
        options={{
          tabBarLabel: 'Calendar',
          tabBarIcon: ({color, size}) => <CalendarGlyph size={size ?? 22} color={color} />,
        }}
      />
    </JsTab.Navigator>
  );
}

// Authenticated app wrapper with push notifications
interface AuthenticatedAppProps {
  userId?: string;
  workspaceId?: string;
}

interface DrawerAnimatedShellProps {
  drawerProgress?: SharedValue<number>;
  children: React.ReactNode;
}

function DrawerAnimatedShell({drawerProgress, children}: DrawerAnimatedShellProps) {
  const contentStyle = useAnimatedStyle(() => {
    const progress = drawerProgress?.value ?? 0;

    return {
      transform: [
        {
          translateX: interpolate(progress, [0, 1], [0, -14], Extrapolation.CLAMP),
        },
      ],
    };
  }, [drawerProgress]);

  const blurStyle = useAnimatedStyle(() => {
    const progress = drawerProgress?.value ?? 0;

    return {
      opacity: interpolate(progress, [0, 1], [0, 1], Extrapolation.CLAMP),
    };
  }, [drawerProgress]);

  return (
    <Reanimated.View style={[styles.appContentLayer, contentStyle]}>
      {children}
      <Reanimated.View pointerEvents="none" style={[styles.sidebarBackdrop, blurStyle]}>
        <View style={styles.sidebarDimmer} />
      </Reanimated.View>
    </Reanimated.View>
  );
}

function AuthenticatedApp({userId, workspaceId}: AuthenticatedAppProps) {
  const navigationRef = useRef<any>(null);
  const drawerRef = useRef<DrawerLayoutMethods | null>(null);
  const [currentRoute, setCurrentRoute] = useState('Dashboard');
  const [isNavReady, setIsNavReady] = useState(false);
  const launchDeepLinkHandled = useRef(false);
  const previousWorkspaceId = useRef<string | undefined>(workspaceId);
  const {pendingVoiceCommand} = useTabBar();
  const lastRoutedVoiceNonce = useRef(0);

  // Route any committed voice command to the assistant tab so the AssistantChatScreen can
  // pick it up and submit. We don't consume `pendingVoiceCommand` here — that's the assistant
  // screen's job after it sends.
  useEffect(() => {
    if (!pendingVoiceCommand) return;
    if (pendingVoiceCommand.nonce === lastRoutedVoiceNonce.current) return;
    lastRoutedVoiceNonce.current = pendingVoiceCommand.nonce;
    if (currentRoute === 'AssistantChat') return;
    navigationRef.current?.navigate('MainTabs', {
      screen: 'Assistant',
      params: {screen: 'AssistantChat'},
    });
  }, [pendingVoiceCommand, currentRoute]);

  const getActiveRouteName = useCallback((state: any): string => {
    const route = state?.routes?.[state.index ?? 0];
    if (!route) {
      return 'Dashboard';
    }
    if (route.state) {
      return getActiveRouteName(route.state);
    }
    return route.name;
  }, []);

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
          navigationRef.current?.navigate('MainTabs', {
            screen: 'Home',
            params: {screen: 'Dashboard'},
          });
        } else if (path.startsWith('deliverable/')) {
          const deliverableId = path.replace('deliverable/', '');
          navigationRef.current?.navigate('DeliverableReview', {deliverableId});
        } else if (path === 'deliverables') {
          navigationRef.current?.navigate('MainTabs', {
            screen: 'Deliverables',
            params: {screen: 'RecentDeliverables'},
          });
        } else if (path === 'series') {
          navigationRef.current?.navigate('MainTabs', {
            screen: 'Projects',
            params: {screen: 'SeriesList'},
          });
        } else if (path === 'calendar') {
          navigationRef.current?.navigate('MainTabs', {
            screen: 'Calendar',
            params: {screen: 'Calendar'},
          });
        } else if (path === 'transfers') {
          navigationRef.current?.navigate('MainTabs', {
            screen: 'Home',
            params: {screen: 'TransferHistory'},
          });
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
        routes: [{name: 'MainTabs'}],
      });
    }

    previousWorkspaceId.current = workspaceId;
  }, [isNavReady, workspaceId]);

  // Listen to navigation state changes to track current route
  useEffect(() => {
    const unsubscribe = navigationRef.current?.addListener('state', (e: any) => {
      const state = e.data.state;
      if (state) {
        setCurrentRoute(getActiveRouteName(state));
      }
    });

    return unsubscribe;
  }, [getActiveRouteName]);

  const openSidebar = useCallback(() => {
    drawerRef.current?.openDrawer?.({animationSpeed: 22});
  }, []);

  const closeSidebar = useCallback(() => {
    drawerRef.current?.closeDrawer?.({animationSpeed: 22});
  }, []);

  return (
    <>
      <ReanimatedDrawerLayout
        ref={drawerRef}
        drawerWidth={SIDEBAR_WIDTH}
        drawerPosition={DrawerPosition.RIGHT}
        drawerType={DrawerType.FRONT}
        edgeWidth={24}
        minSwipeDistance={8}
        overlayColor="transparent"
        animationSpeed={22}
        renderNavigationView={() => (
          <SidebarMenu
            onClose={closeSidebar}
            currentRoute={currentRoute}
            onNavigate={(route, params) => navigationRef.current?.navigate(route, params)}
          />
        )}>
        {(drawerProgress) => (
          <DrawerAnimatedShell drawerProgress={drawerProgress}>
            <SidebarDrawerProvider openSidebar={openSidebar}>
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
                    regular: {
                      fontFamily: theme.typography.fontFamily.regular,
                      fontWeight: '400',
                    },
                    medium: {
                      fontFamily: theme.typography.fontFamily.medium,
                      fontWeight: '500',
                    },
                    bold: {
                      fontFamily: theme.typography.fontFamily.bold,
                      fontWeight: '700',
                    },
                    heavy: {
                      fontFamily: theme.typography.fontFamily.bold,
                      fontWeight: '700',
                    },
                  },
                }}
                onReady={() => setIsNavReady(true)}
                onStateChange={(state) => {
                  if (state) {
                    setCurrentRoute(getActiveRouteName(state));
                  }
                }}>
                <View style={styles.authenticatedNavWrap}>
                  <AuthenticatedRoot />
                  {currentRoute === 'AssistantChat' || currentRoute === 'Assistant' ? null : (
                    <MainFloatingCreateFab />
                  )}
                </View>
              </NavigationContainer>
            </SidebarDrawerProvider>
          </DrawerAnimatedShell>
        )}
      </ReanimatedDrawerLayout>
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
    if (data.deliverable_id) {
      navigationRef.current?.navigate('DeliverableReview', {
        deliverableId: data.deliverable_id as string,
        versionId: data.version_id as string | undefined,
        commentId: data.comment_id as string | undefined,
      });
    } else if (data.todo_id) {
      navigationRef.current?.navigate('MainTabs', {
        screen: 'Home',
        params: {screen: 'Dashboard'},
      });
    } else if (data.project_id) {
      navigationRef.current?.navigate('MainTabs', {
        screen: 'Projects',
        params: {
          screen: 'ProjectDeliverables',
          params: {
            projectId: data.project_id as string,
            projectName: (data.project_name as string) || 'Project',
          },
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

function AuthenticatedRoot() {
  return (
    <RootStack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: {backgroundColor: 'transparent'},
      }}>
      <RootStack.Screen name="MainTabs" component={MainTabs} />
      <RootStack.Screen
        name="DeliverableReview"
        component={DeliverableReviewScreen}
        options={{presentation: 'card'}}
      />
    </RootStack.Navigator>
  );
}

function MainTabs() {
  // iOS uses the SwiftUI-backed "liquid glass" navigator from
  // `@react-navigation/bottom-tabs/unstable`. As-published it imports
  // `BottomTabs` / `BottomTabsScreen` from `react-native-screens`, but RNS
  // 4.24.0 only exposes those under the `Tabs` namespace (`Tabs.Host` /
  // `Tabs.Screen`), so the imports resolve to `undefined` and the app
  // red-screens with "Element type is invalid: ... NativeBottomTabView".
  // We work around that with a local patch in
  //   patches/@react-navigation+bottom-tabs+*.patch
  // applied via `patch-package` on postinstall. Drop the patch once RNS
  // re-exports the flat names (or react-navigation switches to the namespace).
  return (
    <View style={styles.mainTabsWrap}>
      {Platform.OS === 'ios' ? <IOSNativeMainTabs /> : <AndroidMaterialMainTabs />}
    </View>
  );
}

// Auth Screen - welcome with Get Started opening auth directly
interface AuthScreenProps {
  authState: ReturnType<typeof useAuthState>;
  animationReady: boolean;
}

function AuthScreen({authState, animationReady}: AuthScreenProps) {
  const welcomeOpacity = useRef(new Animated.Value(0)).current;

  // Fade in welcome once ready
  useEffect(() => {
    if (animationReady) {
      Animated.timing(welcomeOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }).start();
    }
  }, [animationReady, welcomeOpacity]);

  return (
    <Animated.View
      style={[
        styles.authContainer,
        StyleSheet.absoluteFill,
        {opacity: welcomeOpacity},
      ]}
      pointerEvents={animationReady ? 'auto' : 'none'}>
      <AuthWelcomeScreen
        onGetStarted={authState.signInWithBrowser}
        error={authState.error}
        clearError={authState.clearError}
      />
    </Animated.View>
  );
}

function AppContent() {
  const authState = useAuthState();
  const [forceShowWelcome, setForceShowWelcome] = useState(false);

  // Escape hatch: if loading takes >3s, show welcome so user isn't stuck
  useEffect(() => {
    if (!authState.isLoading) return;
    const t = setTimeout(() => setForceShowWelcome(true), 3000);
    return () => clearTimeout(t);
  }, [authState.isLoading]);

  // Handle auth callback from browser (posthive://auth/callback?access_token=...&refresh_token=...)
  useEffect(() => {
    const handleAuthCallback = async (url: string | null) => {
      if (!url || !url.startsWith('posthive://auth/callback')) return;
      try {
        await createSessionFromUrl(url);
      } catch (err) {
        console.error('Auth callback error:', err);
      }
    };

    Linking.getInitialURL().then(handleAuthCallback);
    const subscription = Linking.addEventListener('url', ({url}) => handleAuthCallback(url));
    return () => subscription.remove();
  }, []);
  const welcomeOpacity = useRef(new Animated.Value(0)).current;
  const welcomeTranslateX = useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const appOpacity = useRef(new Animated.Value(0)).current;
  const appTranslateX = useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const prevShowWelcome = useRef(authState.showWelcome);
  const prevIsAuthenticated = useRef<boolean>(!!(authState.isAuthenticated && authState.currentWorkspace));

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
        <View style={styles.fullScreen}>
          <View style={styles.startupBackdrop} pointerEvents="none" />
          <Animated.View
            style={[
              styles.fullScreen,
              {
                opacity: welcomeOpacity,
                transform: [{translateX: welcomeTranslateX}],
              },
            ]}>
            <WelcomeScreen
              userName={userName}
              onComplete={authState.dismissWelcome}
            />
          </Animated.View>
        </View>
      </AuthContext.Provider>
    );
  }

  const showDashboard = authState.isAuthenticated && authState.currentWorkspace && !authState.isLoading;
  // Authenticated users stay on a solid backdrop while workspace state resolves or the picker is shown.
  const showAuthContent =
    forceShowWelcome || (!authState.isLoading && !authState.isAuthenticated);

  return (
    <AuthContext.Provider value={authState}>
      <View style={styles.container}>
        <View style={styles.startupBackdrop} pointerEvents="none" />

        {/* Welcome screen - only mount while signed out */}
        {showAuthContent && (
          <AuthScreen
            authState={authState}
            animationReady={showAuthContent}
          />
        )}

        {/* Dashboard - slides in from right when authenticated with workspace */}
        {showDashboard && (
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              {
                opacity: appOpacity,
                transform: [{translateX: appTranslateX}],
                backgroundColor: 'transparent',
              },
            ]}
            pointerEvents="box-none">
            <AuthenticatedApp
              userId={authState.user?.id}
              workspaceId={authState.currentWorkspace?.id}
            />
          </Animated.View>
        )}

        {/* Workspace selection modal - shown when authenticated but no workspace selected */}
        {authState.needsWorkspaceSelection && (
          <WorkspaceDropdownModal
            visible={authState.needsWorkspaceSelection}
            workspaces={authState.workspaces}
            currentWorkspace={null}
            onSelectWorkspace={authState.selectWorkspace}
            onClose={() => {}}
          />
        )}

        {/* In-app auth WebView */}
        <AuthWebViewModal
          visible={authState.showAuthWebView}
          onClose={authState.closeAuthWebView}
          onAuthSuccess={authState.refreshAuthState}
          onError={(msg) => authState.setError(msg)}
        />
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
    backgroundColor: '#000000',
  },
  appContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  startupBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
  },
  fullScreen: {
    flex: 1,
    width: '100%',
  },
  authContainer: {
    flex: 1,
  },
  appContentLayer: {
    flex: 1,
  },
  sidebarBackdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 900,
  },
  sidebarDimmer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.52)',
  },
  mainTabsWrap: {
    flex: 1,
  },
  authenticatedNavWrap: {
    flex: 1,
  },
  mainPagerRoot: {
    flex: 1,
    // Opaque base so transparent tab scenes / stack cards (Assistant, etc.) never show the
    // system window color (white in light mode). Dashboard still paints its own backdrop on top.
    backgroundColor: theme.colors.background,
  },
  mainPagerContent: {
    flex: 1,
  },
  mainPagerTopOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 200,
    elevation: 24,
  },
  // Soft black scrim rising from the bottom so screen content fades out
  // before colliding with the system tab bar. Sits below the FAB (zIndex
  // 850) and the floating top bar (zIndex 200), but above screen content.
  bottomNavScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 150,
    elevation: 18,
  },
});

