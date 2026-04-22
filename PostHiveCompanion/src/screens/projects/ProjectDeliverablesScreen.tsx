import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
  PanResponder,
} from 'react-native';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import {StackNavigationProp} from '@react-navigation/stack';
import {TabView, type Route} from 'react-native-tab-view';
import {ChevronLeft} from 'lucide-react-native';
import LinearGradient from 'react-native-linear-gradient';
import {theme} from '../../theme';
import {BrandedLoadingScreen} from '../../components/BrandedLoadingScreen';
import {ProjectsStackParamList} from '../../app/App';
import {ProjectProvider} from '../../contexts/ProjectContext';
import {ProjectDeliverablesTab} from './ProjectDeliverablesTab';
import {ProjectResourcesTab} from './ProjectResourcesTab';
import {ProjectLinksTodosTab} from './ProjectLinksTodosTab';

type RouteParams = RouteProp<ProjectsStackParamList, 'ProjectDeliverables'>;
type NavigationProp = StackNavigationProp<ProjectsStackParamList>;

const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get('window');
const HERO_HEIGHT = SCREEN_HEIGHT * 0.22;

const PROJECT_TAB_ROUTES: Route[] = [
  {key: 'deliverables', title: 'Deliverables'},
  {key: 'resources', title: 'Resources'},
  {key: 'linksTodos', title: 'Links & Todos'},
];

function ProjectTabBar({
  navigationState,
  jumpTo,
}: {
  navigationState: {index: number; routes: Route[]};
  jumpTo: (key: string) => void;
}) {
  return (
    <View style={projectStyles.tabBar}>
      {navigationState.routes.map((route, i) => (
        <TouchableOpacity
          key={route.key}
          style={[
            projectStyles.tabItem,
            navigationState.index === i && projectStyles.tabItemActive,
          ]}
          onPress={() => jumpTo(route.key)}>
          <Text
            style={[
              projectStyles.tabLabel,
              navigationState.index === i && projectStyles.tabLabelActive,
            ]}>
            {route.title}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const EDGE_SWIPE_WIDTH = 28;
const SWIPE_BACK_THRESHOLD = 60;

function getPageX(evt: {nativeEvent: {pageX?: number; locationX?: number; touches?: {pageX?: number}[]}}): number {
  const n = evt.nativeEvent;
  return n.pageX ?? n.touches?.[0]?.pageX ?? n.locationX ?? 0;
}

export function ProjectDeliverablesScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteParams>();
  const {projectId, projectName, clientName, thumbnailUrl} = route.params;
  const [index, setIndex] = useState(0);

  const panResponder = React.useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: (evt) => getPageX(evt) < EDGE_SWIPE_WIDTH,
        onPanResponderRelease: (_evt, gestureState) => {
          if (gestureState.dx > SWIPE_BACK_THRESHOLD) {
            navigation.goBack();
          }
        },
      }),
    [navigation],
  );

  const renderScene = ({route: {key}}: {route: Route}) => {
    switch (key) {
      case 'deliverables':
        return <ProjectDeliverablesTab />;
      case 'resources':
        return <ProjectResourcesTab />;
      case 'linksTodos':
        return <ProjectLinksTodosTab />;
      default:
        return null;
    }
  };

  return (
    <ProjectProvider
      params={{
        projectId,
        projectName,
        clientName,
        thumbnailUrl,
      }}>
      <View style={projectStyles.container}>
        <View style={projectStyles.heroSection}>
          {thumbnailUrl ? (
            <>
              <Animated.Image
                source={{uri: thumbnailUrl}}
                style={projectStyles.heroImage}
                resizeMode="cover"
              />
            </>
          ) : (
            <View style={projectStyles.heroNoImage} />
          )}
          <LinearGradient
            colors={[
              'rgba(0,0,0,0.2)',
              'rgba(0,0,0,0.5)',
              'rgba(0,0,0,0.85)',
              theme.colors.background,
            ]}
            locations={[0, 0.35, 0.65, 1]}
            style={projectStyles.heroGradient}
          />
          <View style={projectStyles.heroContent}>
            <Text style={projectStyles.projectTitle} numberOfLines={2}>
              {projectName}
            </Text>
            {clientName && (
              <Text style={projectStyles.clientName}>{clientName.toUpperCase()}</Text>
            )}
            <View style={projectStyles.decorativeLine} />
          </View>
        </View>

        <View style={projectStyles.floatingHeader} pointerEvents="box-none">
          <TouchableOpacity
            style={projectStyles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}>
            <ChevronLeft size={20} color={theme.colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Left-edge swipe to go back - captures gesture before TabView */}
        <View
          style={projectStyles.edgeSwipeZone}
          {...panResponder.panHandlers}
          pointerEvents="auto"
        />

        <View style={projectStyles.tabViewContainer}>
          <TabView
            navigationState={{index, routes: PROJECT_TAB_ROUTES}}
            renderScene={renderScene}
            onIndexChange={setIndex}
            initialLayout={{width: SCREEN_WIDTH}}
            renderTabBar={(props) => <ProjectTabBar {...props} />}
            swipeEnabled={true}
            lazy={false}
          />
        </View>
      </View>
    </ProjectProvider>
  );
}

const projectStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  heroSection: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: HERO_HEIGHT,
    overflow: 'hidden',
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  heroNoImage: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.surfaceElevated,
  },
  heroGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  heroContent: {
    position: 'absolute',
    bottom: theme.spacing.lg + 8,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  floatingHeader: {
    position: 'absolute',
    top: 44,
    left: theme.spacing.md,
    zIndex: 1000,
    elevation: 10,
  },
  edgeSwipeZone: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: EDGE_SWIPE_WIDTH,
    zIndex: 20,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  projectTitle: {
    color: theme.colors.textPrimary,
    fontSize: 22,
    fontFamily: theme.typography.fontFamily.bold,
    textAlign: 'center',
    lineHeight: 26,
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: {width: 0, height: 2},
    textShadowRadius: 10,
  },
  clientName: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.semibold,
    letterSpacing: 2,
    marginTop: theme.spacing.xs,
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 6,
  },
  decorativeLine: {
    width: 30,
    height: 1,
    backgroundColor: theme.colors.textPrimary,
    marginTop: theme.spacing.sm,
  },
  tabViewContainer: {
    flex: 1,
    marginTop: HERO_HEIGHT - 24,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: theme.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  tabItem: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
  },
  tabItemActive: {
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.textPrimary,
  },
  tabLabel: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.textMuted,
    letterSpacing: 1,
  },
  tabLabelActive: {
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily.bold,
  },
});
