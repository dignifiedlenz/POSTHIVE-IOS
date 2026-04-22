import React, {useState, useEffect, useCallback, useMemo} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  FlatList,
  Keyboard,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {
  ChevronLeft,
  Search,
  History,
  Folder,
  Calendar,
  CheckCircle,
  AlertCircle,
  ChevronRight,
} from 'lucide-react-native';
import {theme} from '../../theme';
import {BrandedLoadingScreen} from '../../components/BrandedLoadingScreen';
import {useAuth} from '../../hooks/useAuth';
import {getTransferHistory, TransferOperation} from '../../lib/api';
import {WidgetModule} from '../../lib/WidgetModule';

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

export function TransferHistoryScreen() {
  const navigation = useNavigation();
  const {currentWorkspace} = useAuth();
  const [transfers, setTransfers] = useState<TransferOperation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const loadTransfers = useCallback(async () => {
    if (!currentWorkspace?.id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getTransferHistory(currentWorkspace.id);
      setTransfers(data);
      WidgetModule.updateRecentTransfers(
        data.slice(0, 5).map(transfer => ({
          id: transfer.id,
          fileName:
            transfer.transfer_name ||
            transfer.project_name ||
            transfer.operation_type ||
            'Transfer',
          isUpload: transfer.operation_type?.toLowerCase().includes('upload') ?? false,
          completedAt: transfer.completed_at || transfer.started_at,
        })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transfer history');
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace?.id]);

  useEffect(() => {
    loadTransfers();
  }, [loadTransfers]);

  // Filter transfers by search
  const filteredTransfers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return transfers;
    return transfers.filter(
      t =>
        t.transfer_name?.toLowerCase().includes(q) ||
        t.project_name?.toLowerCase().includes(q) ||
        t.destination_path?.toLowerCase().includes(q) ||
        (t.files_data?.some(f => {
          const path = f.sourcePath || (f as any).source_path;
          const name = f.name || f.fileName || (f as any).file_name || (path ? path.split('/').pop() || path.split('\\').pop() : '') || '';
          return name.toLowerCase().includes(q);
        }) ?? false),
    );
  }, [transfers, searchQuery]);

  const handleTransferPress = (transfer: TransferOperation) => {
    (navigation as any).navigate('TransferDetail', {transfer});
  };

  const renderTransferItem = ({item}: {item: TransferOperation}) => {
    const destLabel =
      item.destinations?.[0]?.label ||
      item.destination_path?.split('/').filter(Boolean).pop() ||
      item.destination_path ||
      'Unknown destination';
    const isCompleted = item.status === 'completed';
    const isFailed = item.status === 'failed';
    const fileCount = item.files_processed || (item.files_data?.length ?? 0) || 1;
    const transferTitle =
      item.transfer_name ||
      item.source_path?.split('/').pop() ||
      item.source_path?.split('\\').pop() ||
      'Transfer';

    return (
      <TouchableOpacity
        style={styles.transferCard}
        onPress={() => handleTransferPress(item)}
        activeOpacity={0.7}>
        <View style={styles.transferHeader}>
          <Folder size={20} color={theme.colors.textSecondary} />
          <Text style={styles.transferTitle} numberOfLines={2}>
            {transferTitle}
          </Text>
          <ChevronRight size={20} color={theme.colors.textMuted} />
        </View>
        <View style={styles.transferMeta}>
          <View style={styles.metaRow}>
            {isCompleted ? (
              <CheckCircle size={12} color={theme.colors.success} />
            ) : isFailed ? (
              <AlertCircle size={12} color={theme.colors.error} />
            ) : (
              <Calendar size={12} color={theme.colors.textMuted} />
            )}
            <Text style={styles.metaText}>
              {isCompleted ? 'Completed' : isFailed ? 'Failed' : item.status} •{' '}
              {formatDate(item.completed_at || item.started_at)}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>
              {fileCount} file{fileCount !== 1 ? 's' : ''} • {formatBytes(item.total_size || 0)}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Folder size={12} color={theme.colors.textMuted} />
            <Text style={styles.metaText} numberOfLines={1}>
              → {destLabel}
            </Text>
          </View>
          {item.project_name && (
            <View style={styles.metaRow}>
              <Text style={styles.metaText}>Project: {item.project_name}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return <BrandedLoadingScreen message="Loading transfers..." />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
          <ChevronLeft size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>TRANSFER HISTORY</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Search size={18} color={theme.colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search transfers..."
          placeholderTextColor={theme.colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
          onSubmitEditing={() => Keyboard.dismiss()}
        />
      </View>

      {error ? (
        <View style={styles.errorContainer}>
          <AlertCircle size={24} color={theme.colors.error} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadTransfers}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : filteredTransfers.length === 0 ? (
        <View style={styles.emptyContainer}>
          <History size={48} color={theme.colors.textMuted} />
          <Text style={styles.emptyTitle}>
            {searchQuery.trim() ? 'No matching transfers' : 'No transfers yet'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {searchQuery.trim()
              ? 'Try a different search term'
              : 'Transfers from the desktop app will appear here'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredTransfers}
          keyExtractor={(item) => item.id}
          renderItem={renderTransferItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <Text style={styles.resultCount}>
              {filteredTransfers.length} transfer{filteredTransfers.length !== 1 ? 's' : ''}
            </Text>
          }
        />
      )}
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
    textTransform: 'uppercase',
    letterSpacing: theme.typography.letterSpacing.wide,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: theme.spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textPrimary,
    paddingVertical: 0,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
  },
  loadingText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textMuted,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  errorText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.error,
    textAlign: 'center',
  },
  retryButton: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  retryText: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
    gap: theme.spacing.sm,
  },
  emptyTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  listContent: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.xl * 2,
  },
  resultCount: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: theme.typography.letterSpacing.wide,
  },
  transferCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  transferHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  transferTitle: {
    flex: 1,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  transferMeta: {
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
});
