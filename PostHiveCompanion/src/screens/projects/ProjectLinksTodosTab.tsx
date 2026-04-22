import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {Link2, CheckSquare} from 'lucide-react-native';
import {theme} from '../../theme';
import {useProjectParams} from '../../contexts/ProjectContext';

export function ProjectLinksTodosTab() {
  const {projectName} = useProjectParams();
  return (
    <View style={styles.container}>
      <View style={styles.placeholder}>
        <View style={styles.iconRow}>
          <Link2 size={32} color={theme.colors.textMuted} />
          <CheckSquare size={32} color={theme.colors.textMuted} />
        </View>
        <Text style={styles.title}>Links & Todos</Text>
        <Text style={styles.subtitle}>
          Links and todos for {projectName} will appear here
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
  },
  iconRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  title: {
    fontSize: theme.typography.fontSize.lg,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
});
