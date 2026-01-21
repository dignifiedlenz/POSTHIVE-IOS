import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {StackNavigationProp} from '@react-navigation/stack';
import {Folder, Archive} from 'lucide-react-native';
import LinearGradient from 'react-native-linear-gradient';
import {theme} from '../../theme';
import {useAuth} from '../../hooks/useAuth';
import {getProjects} from '../../lib/api';
import {Project} from '../../lib/types';
import {ReviewStackParamList} from '../../app/App';

type NavigationProp = StackNavigationProp<ReviewStackParamList, 'ProjectsList'>;

const {width: SCREEN_WIDTH} = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH;
const CARD_HEIGHT = 88;

interface ProjectCardProps {
  project: Project;
  onPress: () => void;
}

function ProjectCard({project, onPress}: ProjectCardProps) {
  const isArchived = project.status === 'archived';
  const clientName = project.client?.name || project.client_name;
  
  return (
    <TouchableOpacity 
      style={[styles.projectCard, isArchived && styles.projectCardArchived]} 
      onPress={onPress} 
      activeOpacity={0.85}
    >
      {/* Background image or placeholder */}
      {project.thumbnail_url ? (
        <Image
          source={{uri: project.thumbnail_url}}
          style={styles.cardImage}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.placeholderBackground}>
          <Folder size={28} color="rgba(255,255,255,0.15)" />
        </View>
      )}
      
      {/* Gradient overlay - left to right fade */}
      <LinearGradient
        colors={['rgba(0,0,0,0.8)', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.2)', 'transparent']}
        start={{x: 0, y: 0.5}}
        end={{x: 1, y: 0.5}}
        style={styles.gradientOverlay}
      />
      
      {/* Content - left aligned, vertically centered */}
      <View style={styles.cardContent}>
        <Text style={styles.projectName} numberOfLines={1}>
          {project.name}
        </Text>
        {clientName && (
          <Text style={styles.clientName} numberOfLines={1}>
            {clientName.toUpperCase()}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

export function ProjectsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const {currentWorkspace} = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadProjects = useCallback(async () => {
    if (!currentWorkspace?.id) return;

    try {
      const data = await getProjects(currentWorkspace.id);
      setProjects(data);
    } catch (err) {
      console.error('Error loading projects:', err);
    }
  }, [currentWorkspace?.id]);

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await loadProjects();
      setIsLoading(false);
    };
    init();
  }, [loadProjects]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadProjects();
    setIsRefreshing(false);
  }, [loadProjects]);

  const activeProjects = projects.filter(p => p.status === 'active' || p.status === 'completed');
  const archivedProjects = projects.filter(p => p.status === 'archived');

  const handleProjectPress = (project: Project) => {
    const clientName = project.client?.name || project.client_name;
    navigation.navigate('ProjectDeliverables', {
      projectId: project.id, 
      projectName: project.name,
      clientName: clientName,
      thumbnailUrl: project.thumbnail_url,
    });
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.textPrimary} />
        </View>
      </SafeAreaView>
    );
  }

  const renderArchivedSection = () => {
    if (archivedProjects.length === 0) return null;

    return (
      <View style={styles.archivedSection}>
        <View style={styles.divider}>
          <View style={styles.dividerContent}>
            <Archive size={10} color={theme.colors.textMuted} />
            <Text style={styles.dividerText}>ARCHIVED</Text>
          </View>
        </View>
        {archivedProjects.map(project => (
          <ProjectCard 
            key={project.id} 
            project={project} 
            onPress={() => handleProjectPress(project)} 
          />
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Section header with count */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionLabel}>PROJECTS</Text>
        <Text style={styles.sectionCount}>{projects.length}</Text>
      </View>

      <FlatList
        data={activeProjects}
        keyExtractor={item => item.id}
        renderItem={({item}) => (
          <ProjectCard project={item} onPress={() => handleProjectPress(item)} />
        )}
        contentContainerStyle={styles.list}
        ListFooterComponent={renderArchivedSection}
        ListEmptyComponent={
          archivedProjects.length === 0 ? (
            <View style={styles.emptyState}>
              <Folder size={40} color={theme.colors.textMuted} />
              <Text style={styles.emptyTitle}>NO PROJECTS</Text>
              <Text style={styles.emptySubtitle}>
                Projects will appear here once created
              </Text>
            </View>
          ) : null
        }
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.textPrimary}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent', // Show wave background
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  sectionLabel: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semibold,
    letterSpacing: 2,
  },
  sectionCount: {
    color: theme.colors.textDisabled,
    fontSize: 11,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingBottom: theme.spacing.xl,
  },
  projectCard: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    overflow: 'hidden',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    position: 'relative',
  },
  projectCardArchived: {
    opacity: 0.5,
  },
  cardImage: {
    ...StyleSheet.absoluteFillObject,
  },
  placeholderBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  cardContent: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.md,
  },
  projectName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: theme.typography.fontFamily.semibold,
  },
  clientName: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.medium,
    letterSpacing: 1.5,
    marginTop: 4,
  },
  archivedSection: {
    marginTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.surfaceElevated,
  },
  dividerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dividerText: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.semibold,
    letterSpacing: 1.5,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xxl,
    paddingHorizontal: theme.spacing.xl,
    marginHorizontal: theme.spacing.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.colors.borderHover,
  },
  emptyTitle: {
    color: theme.colors.textPrimary,
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semibold,
    letterSpacing: 2,
    marginTop: theme.spacing.md,
  },
  emptySubtitle: {
    color: theme.colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
  },
});
