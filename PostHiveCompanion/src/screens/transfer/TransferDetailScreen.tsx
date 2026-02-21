import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import {
  ChevronLeft,
  Folder,
  Calendar,
  CheckCircle,
  AlertCircle,
  FileText,
} from 'lucide-react-native';
import {theme} from '../../theme';
import {TransferOperation, TransferFile} from '../../lib/api';

type TransferDetailParams = {
  TransferDetail: {transfer: TransferOperation};
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Extract file name from file object - handles camelCase, snake_case, and path fallbacks
function getFileName(file: TransferFile & Record<string, unknown>): string {
  const f = file as Record<string, unknown>;
  const name = f.name ?? f.fileName ?? f.file_name;
  if (typeof name === 'string' && name) return name;
  const path = f.sourcePath ?? f.source_path ?? (f.destinationPaths as string[])?.[0] ?? f.destPath ?? (f as any).destination_path;
  if (typeof path === 'string') {
    const parts = path.split(/[/\\]/).filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1];
  }
  return 'Unknown file';
}

function getFileSize(file?: TransferFile & {file_size?: number}): number | undefined {
  return file?.size ?? file?.fileSize ?? (file as any)?.file_size;
}

export function TransferDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<TransferDetailParams, 'TransferDetail'>>();
  const {transfer} = route.params;

  const files = transfer.files_data ?? [];
  const destLabel =
    transfer.destinations?.[0]?.label ||
    transfer.destination_path?.split('/').filter(Boolean).pop() ||
    transfer.destination_path ||
    'Unknown destination';
  const isCompleted = transfer.status === 'completed';
  const isFailed = transfer.status === 'failed';

  const transferTitle =
    transfer.transfer_name ||
    transfer.source_path?.split('/').pop() ||
    transfer.source_path?.split('\\').pop() ||
    'Transfer';

  const renderFileItem = ({item}: {item: TransferFile}) => {
    const fileName = getFileName(item);
    const fileSize = getFileSize(item);
    const category = item.category;

    return (
      <View style={styles.fileCard}>
        <View style={styles.fileHeader}>
          <FileText size={16} color={theme.colors.textSecondary} />
          <Text style={styles.fileName} numberOfLines={2}>
            {fileName}
          </Text>
        </View>
        <View style={styles.fileMeta}>
          {(fileSize !== undefined || category) && (
            <View style={styles.metaRow}>
              <Text style={styles.metaText}>
                {[fileSize !== undefined && formatBytes(fileSize), category]
                  .filter(Boolean)
                  .join(' • ')}
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
          <ChevronLeft size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {transferTitle}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Transfer summary */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          {isCompleted ? (
            <CheckCircle size={16} color={theme.colors.success} />
          ) : isFailed ? (
            <AlertCircle size={16} color={theme.colors.error} />
          ) : (
            <Calendar size={16} color={theme.colors.textMuted} />
          )}
          <Text style={styles.summaryText}>
            {isCompleted ? 'Completed' : isFailed ? 'Failed' : transfer.status} •{' '}
            {formatDate(transfer.completed_at || transfer.started_at)}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Folder size={16} color={theme.colors.textMuted} />
          <Text style={styles.summaryText} numberOfLines={1}>
            → {destLabel}
          </Text>
        </View>
        {transfer.project_name && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryText}>Project: {transfer.project_name}</Text>
          </View>
        )}
        <View style={styles.summaryRow}>
          <Text style={styles.summaryText}>
            {transfer.files_processed} file{transfer.files_processed !== 1 ? 's' : ''} •{' '}
            {formatBytes(transfer.total_size || 0)} total
          </Text>
        </View>
      </View>

      {/* Files list */}
      <View style={styles.filesSection}>
        <Text style={styles.sectionTitle}>
          FILES ({files.length})
        </Text>
        {files.length === 0 ? (
          <View style={styles.emptyFiles}>
            <FileText size={32} color={theme.colors.textMuted} />
            <Text style={styles.emptyText}>
              No file details available for this transfer
            </Text>
            <Text style={styles.emptySubtext}>
              {transfer.files_processed > 0
                ? `${transfer.files_processed} files were transferred, but names weren't recorded (older sync). New transfers from the desktop app will include file names.`
                : 'File names are stored when transfers are completed from the desktop app.'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={files}
            keyExtractor={(item, idx) => `${transfer.id}-${getFileName(item)}-${idx}`}
            renderItem={renderFileItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  backButton: {
    padding: theme.spacing.xs,
  },
  headerTitle: {
    flex: 1,
    fontSize: theme.typography.fontSize.lg,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  summaryCard: {
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: theme.spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  summaryText: {
    flex: 1,
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  filesSection: {
    flex: 1,
    paddingHorizontal: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: '600',
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: theme.typography.letterSpacing.wide,
  },
  listContent: {
    paddingBottom: theme.spacing.xl * 2,
  },
  fileCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  fileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  fileName: {
    flex: 1,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  fileMeta: {
    marginTop: theme.spacing.xs,
    gap: theme.spacing.xs,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  metaText: {
    flex: 1,
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.textSecondary,
  },
  emptyFiles: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xl,
    gap: theme.spacing.sm,
  },
  emptyText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginTop: theme.spacing.xs,
    paddingHorizontal: theme.spacing.lg,
    opacity: 0.9,
  },
});
