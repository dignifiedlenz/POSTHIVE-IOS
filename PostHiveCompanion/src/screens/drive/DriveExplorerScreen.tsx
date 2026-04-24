import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  Modal,
  RefreshControl,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import DocumentPicker from 'react-native-document-picker';
import ReactNativeBlobUtil from 'react-native-blob-util';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  FileAudio,
  FileImage,
  FileText,
  Film,
  Folder,
  HardDrive,
  Play,
  Plus,
  RefreshCw,
  Users,
  X,
} from 'lucide-react-native';

import {CameraRoll} from '@react-native-camera-roll/camera-roll';
import {theme} from '../../theme';
import {useAuth} from '../../hooks/useAuth';
import {
  getClients,
  getDownloadUrl,
  getDriveAssets,
  initDriveUpload,
  completeDriveUpload,
} from '../../lib/api';
import {resolvePlaybackUrl, resolveAssetThumbnail} from '../../lib/utils';
import type {Client, DriveAsset} from '../../lib/types';
import {VideoPlayer} from '../../components/VideoPlayer';

function formatFileSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return '--';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size >= 10 ? size.toFixed(0) : size.toFixed(1)} ${units[unitIndex]}`;
}

function getAssetLabel(asset: DriveAsset): string {
  return asset.display_name || asset.name || 'Untitled';
}

const SUPPORTED_VIDEO_EXTENSIONS = ['mp4', 'mov', 'm4v', 'mp4v', '3gp'];
const SUPPORTED_PHOTO_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'heic', 'heif', 'tiff', 'tif', 'bmp'];

function getFileExtension(url: string): string {
  const urlPath = url.split('?')[0];
  return urlPath.split('.').pop()?.toLowerCase() || '';
}

function isAssetSupportedForCameraRoll(
  url: string,
  asset: DriveAsset,
): {supported: boolean; mediaType: 'photo' | 'video'} {
  const extension = getFileExtension(url);
  const type = asset.type || '';
  const mime = (asset.mime_type || '').toLowerCase();

  if (SUPPORTED_VIDEO_EXTENSIONS.includes(extension) || mime.startsWith('video/')) {
    return {supported: true, mediaType: 'video'};
  }
  if (
    SUPPORTED_PHOTO_EXTENSIONS.includes(extension) ||
    mime.startsWith('image/') ||
    ['image', 'graphic', 'foto'].includes(type)
  ) {
    return {supported: true, mediaType: 'photo'};
  }
  if (type === 'video') return {supported: true, mediaType: 'video'};
  if (['image', 'graphic', 'foto'].includes(type)) return {supported: true, mediaType: 'photo'};

  return {supported: false, mediaType: 'video'};
}

function getAssetIcon(asset: DriveAsset) {
  if (asset.is_folder) {
    return Folder;
  }

  if (asset.type === 'video') {
    return Film;
  }

  if (asset.type === 'audio') {
    return FileAudio;
  }

  if (asset.type === 'image' || asset.type === 'graphic' || asset.type === 'foto') {
    return FileImage;
  }

  if (
    asset.type === 'document' ||
    asset.type === 'pdf' ||
    (asset.mime_type || '').includes('pdf') ||
    (asset.mime_type || '').includes('document')
  ) {
    return FileText;
  }

  return FileText;
}

function DriveAssetListRow({
  asset,
  onPress,
  busy,
}: {
  asset: DriveAsset;
  onPress: () => void;
  busy: boolean;
}) {
  const thumbUrl = resolveAssetThumbnail({
    type: asset.type,
    mime_type: asset.mime_type ?? undefined,
    bunny_cdn_url: asset.bunny_cdn_url ?? undefined,
    playback_url: asset.playback_url ?? undefined,
    storage_url: asset.storage_url ?? undefined,
  });
  const isVideo =
    asset.type === 'video' || (asset.mime_type || '').startsWith('video/');
  const Icon = getAssetIcon(asset);

  return (
    <TouchableOpacity
      style={styles.driveListRow}
      onPress={onPress}
      activeOpacity={0.8}
      disabled={busy}>
      <View style={styles.driveListThumb}>
        {thumbUrl ? (
          <Image source={{uri: thumbUrl}} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <View style={styles.driveListThumbPlaceholder}>
            {asset.is_folder ? (
              <Folder size={22} color={theme.colors.textMuted} />
            ) : isVideo ? (
              <Play size={22} color={theme.colors.textMuted} fill={theme.colors.textMuted} />
            ) : asset.type === 'image' || (asset.mime_type || '').startsWith('image/') ? (
              <FileImage size={20} color={theme.colors.textMuted} />
            ) : (
              <Icon size={20} color={theme.colors.textMuted} />
            )}
          </View>
        )}
        {isVideo && !asset.is_folder && (
          <View style={styles.driveListPlayBadge}>
            <Play size={12} color="#fff" fill="#fff" />
          </View>
        )}
      </View>
      <View style={styles.driveListBody}>
        <Text style={styles.driveListTitle} numberOfLines={2}>
          {getAssetLabel(asset)}
        </Text>
        <Text style={styles.driveListMeta} numberOfLines={1}>
          {asset.is_folder
            ? 'Folder'
            : `${formatFileSize(asset.file_size)}${
                asset.uploaded_at ? ` · ${new Date(asset.uploaded_at).toLocaleDateString()}` : ''
              }`}
        </Text>
      </View>
      {busy ? (
        <ActivityIndicator size="small" color={theme.colors.textPrimary} />
      ) : asset.is_folder ? (
        <ChevronRight size={18} color={theme.colors.textMuted} />
      ) : (
        <View style={{width: 18}} />
      )}
    </TouchableOpacity>
  );
}

type FolderCrumb = {
  id: string | null;
  name: string;
};

export function DriveExplorerScreen() {
  const insets = useSafeAreaInsets();
  const {currentWorkspace} = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [folderStack, setFolderStack] = useState<FolderCrumb[]>([{id: null, name: 'Drive'}]);
  const [assets, setAssets] = useState<DriveAsset[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [refreshingClients, setRefreshingClients] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [openingAssetId, setOpeningAssetId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoModalAsset, setVideoModalAsset] = useState<DriveAsset | null>(null);
  const [downloadingAssetId, setDownloadingAssetId] = useState<string | null>(null);
  const [confirmDownloadAsset, setConfirmDownloadAsset] = useState<DriveAsset | null>(null);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadedBytes, setDownloadedBytes] = useState(0);
  const [downloadStatus, setDownloadStatus] = useState<'downloading' | 'saving' | 'success' | 'error'>('downloading');
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloadSize, setDownloadSize] = useState<number | null>(null);
  const downloadingAssetRef = useRef<DriveAsset | null>(null);
  const downloadProgressAnim = useRef(new Animated.Value(0)).current;
  const successScaleAnim = useRef(new Animated.Value(0)).current;

  const currentFolderId = folderStack[folderStack.length - 1]?.id ?? null;

  const selectedClient = useMemo(
    () => clients.find(client => client.id === selectedClientId) || null,
    [clients, selectedClientId],
  );

  const sortedClients = useMemo(
    () => [...clients].sort((a, b) => a.name.localeCompare(b.name, undefined, {sensitivity: 'base'})),
    [clients],
  );

  const sortedAssets = useMemo(() => {
    const label = (a: DriveAsset) => getAssetLabel(a);
    const folders = assets
      .filter(a => a.is_folder)
      .sort((a, b) => label(a).localeCompare(label(b), undefined, {sensitivity: 'base'}));
    const files = assets
      .filter(a => !a.is_folder)
      .sort((a, b) => label(a).localeCompare(label(b), undefined, {sensitivity: 'base'}));
    return [...folders, ...files];
  }, [assets]);

  const loadClients = useCallback(
    async (opts?: {isRefresh?: boolean}) => {
      if (!currentWorkspace?.id) {
        setClients([]);
        setSelectedClientId(null);
        setClientsLoading(false);
        setRefreshingClients(false);
        return;
      }

      if (opts?.isRefresh) {
        setRefreshingClients(true);
      } else {
        setClientsLoading(true);
      }

      try {
        setError(null);
        const nextClients = await getClients(currentWorkspace.id);
        setClients(nextClients);
        setSelectedClientId(prev => {
          if (prev && nextClients.some(client => client.id === prev)) {
            return prev;
          }
          return null;
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load clients';
        setError(message);
      } finally {
        setClientsLoading(false);
        setRefreshingClients(false);
      }
    },
    [currentWorkspace?.id],
  );

  const loadAssets = useCallback(async (isRefresh = false) => {
    if (!currentWorkspace?.id || !selectedClientId) {
      setAssets([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      const nextAssets = await getDriveAssets(currentWorkspace.id, selectedClientId, currentFolderId);
      setAssets(nextAssets);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load drive items';
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentFolderId, currentWorkspace?.id, selectedClientId]);

  useEffect(() => {
    void loadClients();
  }, [loadClients]);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  const handleClientPress = (clientId: string) => {
    setSelectedClientId(clientId);
    setFolderStack([{id: null, name: 'Drive'}]);
    setError(null);
  };

  const handleBackToClients = () => {
    setSelectedClientId(null);
    setFolderStack([{id: null, name: 'Drive'}]);
    setAssets([]);
    setError(null);
  };

  const handleFolderPress = (asset: DriveAsset) => {
    setFolderStack(prev => [...prev, {id: asset.id, name: getAssetLabel(asset)}]);
  };

  const handleBackPress = () => {
    setFolderStack(prev => (prev.length > 1 ? prev.slice(0, -1) : prev));
  };

  const resetDownloadModal = useCallback(() => {
    setShowDownloadModal(false);
    setDownloadProgress(0);
    setDownloadedBytes(0);
    setDownloadStatus('downloading');
    setDownloadError(null);
    setDownloadSize(null);
    downloadingAssetRef.current = null;
    downloadProgressAnim.setValue(0);
    successScaleAnim.setValue(0);
  }, [downloadProgressAnim, successScaleAnim]);

  const animateSuccess = useCallback(() => {
    Animated.sequence([
      Animated.timing(downloadProgressAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: false,
      }),
      Animated.spring(successScaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, [downloadProgressAnim, successScaleAnim]);

  const handleDownloadRequest = useCallback((asset: DriveAsset) => {
    const rawUrl = asset.storage_url || asset.playback_url || asset.bunny_cdn_url || null;
    if (!rawUrl) {
      Alert.alert('Unavailable', 'This file does not have a downloadable URL.');
      return;
    }
    setConfirmDownloadAsset(asset);
  }, []);

  const handleDownloadConfirm = useCallback(async (assetOverride?: DriveAsset) => {
    const asset = assetOverride ?? confirmDownloadAsset;
    setConfirmDownloadAsset(null);
    if (!asset) return;
    downloadingAssetRef.current = asset;
    setDownloadSize(asset.file_size ?? null);

    const rawUrl = asset.storage_url || asset.playback_url || asset.bunny_cdn_url || null;
    if (!rawUrl) return;

    try {
      setDownloadingAssetId(asset.id);
      resetDownloadModal();
      setShowDownloadModal(true);

      const signedUrl = await getDownloadUrl(rawUrl, getAssetLabel(asset));
      const {supported: canUseCameraRoll, mediaType} = isAssetSupportedForCameraRoll(
        signedUrl,
        asset,
      );
      const extension =
        getFileExtension(signedUrl) || (mediaType === 'video' ? 'mp4' : 'jpg');
      const sanitizedName = getAssetLabel(asset).replace(/[^a-zA-Z0-9-_]/g, '_');
      const fileName = `PostHive_${sanitizedName}.${extension}`;
      const tempFilePath = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/${fileName}`;

      const response = await ReactNativeBlobUtil.config({
        fileCache: true,
        path: tempFilePath,
        followRedirect: true,
      })
        .fetch('GET', signedUrl)
        .progress({interval: 100}, (received, total) => {
          const progress = total > 0 ? received / total : 0;
          setDownloadProgress(progress);
          setDownloadedBytes(received);
          Animated.timing(downloadProgressAnim, {
            toValue: progress,
            duration: 100,
            useNativeDriver: false,
          }).start();
        });

      if (response.info().status !== 200) {
        throw new Error(`Download failed with status ${response.info().status}`);
      }

      const downloadedPath = response.path();
      setDownloadStatus('saving');

      if (canUseCameraRoll) {
        try {
          await CameraRoll.save(`file://${downloadedPath}`, {
            type: mediaType,
            album: 'PostHive',
          });
          setDownloadStatus('success');
          animateSuccess();
          setTimeout(resetDownloadModal, 2500);
        } catch (cameraRollError: unknown) {
          const msg =
            cameraRollError instanceof Error ? cameraRollError.message : String(cameraRollError);
          if (msg.includes('3302') || (cameraRollError as {code?: number})?.code === 3302) {
            resetDownloadModal();
            await Share.share({url: `file://${downloadedPath}`, title: fileName});
          } else {
            throw cameraRollError;
          }
        }
      } else {
        resetDownloadModal();
        await Share.share({url: `file://${downloadedPath}`, title: fileName});
      }

      setTimeout(async () => {
        try {
          await ReactNativeBlobUtil.fs.unlink(downloadedPath);
        } catch {
          /* ignore */
        }
      }, 5000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Download failed';
      setDownloadStatus('error');
      setDownloadError(message);
      downloadingAssetRef.current = asset;
    } finally {
      setDownloadingAssetId(null);
    }
  }, [
    confirmDownloadAsset,
    resetDownloadModal,
    animateSuccess,
    downloadProgressAnim,
  ]);

  const handleUploadPress = useCallback(async () => {
    if (!currentWorkspace?.id || !selectedClientId) {
      Alert.alert('Select a client', 'Please select a client before uploading.');
      return;
    }

    try {
      const result = await DocumentPicker.pick({
        type: [DocumentPicker.types.allFiles],
        copyTo: 'cachesDirectory',
      });

      if (result.canceled) return;

      const file = result.assets[0];
      // fileCopyUri is a file path when copyTo is used; uri may be content:// on Android
      const filePath = file.fileCopyUri || file.uri || '';
      const fileName = file.name || 'upload';
      const fileSize = file.size ?? 0;
      const mimeType = file.mimeType || 'application/octet-stream';

      setUploading(true);
      setError(null);

      const init = await initDriveUpload({
        fileName,
        fileSize,
        fileType: mimeType,
        workspaceId: currentWorkspace.id,
        clientId: selectedClientId,
        parentFolderId: currentFolderId,
        tags: ['drive'],
      });

      const putResponse = await ReactNativeBlobUtil.fetch(
        'PUT',
        init.uploadUrl,
        {
          'Content-Type': mimeType,
        },
        ReactNativeBlobUtil.wrap(filePath),
      );

      if (putResponse.respInfo.status < 200 || putResponse.respInfo.status >= 300) {
        throw new Error(`Upload failed (${putResponse.respInfo.status})`);
      }

      await completeDriveUpload(init.assetId, fileSize);
      await loadAssets(true);
      Alert.alert('Uploaded', `${fileName} has been uploaded.`);
    } catch (err: any) {
      if (err?.code === 'DOCUMENT_PICKER_CANCELED') return;
      const message = err instanceof Error ? err.message : 'Upload failed';
      Alert.alert('Upload failed', message);
    } finally {
      setUploading(false);
    }
  }, [
    currentWorkspace?.id,
    selectedClientId,
    currentFolderId,
    loadAssets,
  ]);

  const handleOpenAsset = async (asset: DriveAsset) => {
    if (asset.is_folder) {
      handleFolderPress(asset);
      return;
    }

    const isVideo =
      asset.type === 'video' || (asset.mime_type || '').startsWith('video/');

    if (isVideo) {
      const streamUrl = resolvePlaybackUrl({
        playback_url: asset.playback_url ?? undefined,
        bunny_cdn_url: asset.bunny_cdn_url ?? undefined,
        storage_url: asset.storage_url ?? undefined,
        processing_status: asset.processing_status ?? undefined,
      }) || asset.playback_url;

      if (streamUrl) {
        setVideoModalAsset(asset);
        return;
      }
      Alert.alert('Unavailable', 'This video does not have a stream URL yet.');
      return;
    }

    const rawUrl =
      asset.storage_url ||
      asset.playback_url ||
      asset.bunny_cdn_url ||
      null;

    if (!rawUrl) {
      Alert.alert('Unavailable', 'This file does not have a downloadable URL yet.');
      return;
    }

    setOpeningAssetId(asset.id);
    try {
      handleDownloadRequest(asset);
    } finally {
      setOpeningAssetId(null);
    }
  };

  const clientPicker = (
    <View style={styles.flexFill}>
      {error && sortedClients.length > 0 ? (
        <View style={styles.clientErrorBanner}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => void loadClients()}>
            <Text style={styles.errorRetry}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      {clientsLoading && sortedClients.length === 0 ? (
        <View style={[styles.centerState, styles.flexFill]}>
          <ActivityIndicator color={theme.colors.textPrimary} />
          <Text style={styles.centerStateText}>Loading clients…</Text>
        </View>
      ) : (
        <FlatList
          data={sortedClients}
          keyExtractor={item => item.id}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshingClients}
              onRefresh={() => void loadClients({isRefresh: true})}
              tintColor={theme.colors.textPrimary}
            />
          }
          ListEmptyComponent={
            <View style={styles.centerState}>
              {error ? (
                <>
                  <Text style={styles.errorText}>{error}</Text>
                  <TouchableOpacity onPress={() => void loadClients()}>
                    <Text style={styles.errorRetry}>Retry</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Users size={32} color={theme.colors.textMuted} />
                  <Text style={styles.centerStateText}>No clients yet</Text>
                  <Text style={styles.centerStateHint}>Add a client in the web app to browse their drive.</Text>
                </>
              )}
            </View>
          }
          renderItem={({item}) => (
            <TouchableOpacity
              style={styles.clientListRow}
              onPress={() => handleClientPress(item.id)}
              activeOpacity={0.8}>
              <View style={styles.clientListIcon}>
                <Users size={22} color={theme.colors.textMuted} />
              </View>
              <View style={styles.clientListBody}>
                <Text style={styles.clientListName} numberOfLines={2}>
                  {item.name}
                </Text>
                {item.company ? (
                  <Text style={styles.clientListMeta} numberOfLines={1}>
                    {item.company}
                  </Text>
                ) : null}
              </View>
              <ChevronRight size={18} color={theme.colors.textMuted} />
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );

  const driveBrowser = (
    <View style={styles.flexFill}>
      <View style={styles.breadcrumbRow}>
        <TouchableOpacity
          onPress={handleBackPress}
          disabled={folderStack.length <= 1}
          style={[styles.backButton, folderStack.length <= 1 && styles.backButtonDisabled]}
          activeOpacity={0.8}>
          <ChevronLeft size={16} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.breadcrumbText} numberOfLines={1}>
          {folderStack.map(crumb => crumb.name).join(' / ')}
        </Text>
      </View>

      {error && sortedAssets.length > 0 ? (
        <View style={styles.clientErrorBanner}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => void loadAssets()}>
            <Text style={styles.errorRetry}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {loading && sortedAssets.length === 0 ? (
        <View style={[styles.centerState, styles.flexFill]}>
          <ActivityIndicator size="small" color={theme.colors.textPrimary} />
          <Text style={styles.centerStateText}>Loading drive…</Text>
        </View>
      ) : (
        <FlatList
          data={sortedAssets}
          keyExtractor={item => item.id}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void loadAssets(true)}
              tintColor={theme.colors.textPrimary}
            />
          }
          ListEmptyComponent={
            <View style={styles.centerState}>
              {error ? (
                <>
                  <Text style={styles.errorText}>{error}</Text>
                  <TouchableOpacity onPress={() => void loadAssets()}>
                    <Text style={styles.errorRetry}>Retry</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <HardDrive size={24} color={theme.colors.textMuted} />
                  <Text style={styles.centerStateText}>This folder is empty.</Text>
                </>
              )}
            </View>
          }
          renderItem={({item}) => (
            <DriveAssetListRow
              asset={item}
              busy={openingAssetId === item.id}
              onPress={() => void handleOpenAsset(item)}
            />
          )}
        />
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.header}>
        {selectedClientId ? (
          <TouchableOpacity
            style={styles.headerTitleBlock}
            onPress={handleBackToClients}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Change client">
            <View style={styles.headerBackChevron}>
              <ChevronLeft size={20} color={theme.colors.textPrimary} />
            </View>
            <View style={styles.headerTitleTextWrap}>
              <Text style={styles.eyebrow}>Drive</Text>
              <Text style={styles.title} numberOfLines={1}>
                {selectedClient?.name || 'Client'}
              </Text>
            </View>
          </TouchableOpacity>
        ) : (
          <View style={styles.headerTitleTextWrap}>
            <Text style={styles.eyebrow}>Drive</Text>
            <Text style={styles.title}>Select a client</Text>
            <Text style={styles.headerHint}>Pick a client, then browse their drive as a list.</Text>
          </View>
        )}
        {selectedClientId ? (
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => void handleUploadPress()}
              disabled={uploading}
              activeOpacity={0.8}>
              {uploading ? (
                <ActivityIndicator size="small" color={theme.colors.textPrimary} />
              ) : (
                <Plus size={18} color={theme.colors.textPrimary} />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => void loadAssets(true)}
              disabled={loading && sortedAssets.length === 0}
              activeOpacity={0.8}>
              <RefreshCw size={18} color={theme.colors.textPrimary} />
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      {selectedClientId ? driveBrowser : clientPicker}

      <Modal
        visible={!!videoModalAsset}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setVideoModalAsset(null)}>
        <View style={styles.videoModal}>
          <View
            style={[
              styles.videoModalHeader,
              {
                paddingTop: Math.max(insets.top, 16),
                paddingHorizontal: Math.max(insets.left, insets.right, theme.spacing.md),
              },
            ]}>
            <TouchableOpacity
              onPress={() => setVideoModalAsset(null)}
              style={styles.videoModalClose}
              hitSlop={{top: 12, bottom: 12, left: 12, right: 12}}>
              <Text style={styles.videoModalCloseText}>Done</Text>
            </TouchableOpacity>
            <Text style={styles.videoModalTitle} numberOfLines={1}>
              {videoModalAsset ? getAssetLabel(videoModalAsset) : ''}
            </Text>
            {videoModalAsset && (
              <TouchableOpacity
                onPress={() => handleDownloadRequest(videoModalAsset)}
                disabled={downloadingAssetId === videoModalAsset.id}
                style={styles.videoModalDownload}
                hitSlop={{top: 12, bottom: 12, left: 12, right: 12}}>
                {downloadingAssetId === videoModalAsset.id ? (
                  <ActivityIndicator size="small" color={theme.colors.accent} />
                ) : (
                  <Download size={20} color={theme.colors.accent} />
                )}
              </TouchableOpacity>
            )}
          </View>
          {videoModalAsset && (
            <View style={styles.videoModalPlayer}>
              <VideoPlayer
                source={
                  resolvePlaybackUrl({
                    playback_url: videoModalAsset.playback_url ?? undefined,
                    bunny_cdn_url: videoModalAsset.bunny_cdn_url ?? undefined,
                    storage_url: videoModalAsset.storage_url ?? undefined,
                    processing_status: videoModalAsset.processing_status ?? undefined,
                  }) || videoModalAsset.playback_url || ''
                }
                poster={resolveAssetThumbnail({
                  type: videoModalAsset.type,
                  mime_type: videoModalAsset.mime_type ?? undefined,
                  bunny_cdn_url: videoModalAsset.bunny_cdn_url ?? undefined,
                  playback_url: videoModalAsset.playback_url ?? undefined,
                  storage_url: videoModalAsset.storage_url ?? undefined,
                })}
                fillContainer
                showOverlayHeader
                title={getAssetLabel(videoModalAsset)}
                onBack={() => setVideoModalAsset(null)}
              />
            </View>
          )}
        </View>
      </Modal>

      {/* Confirm download modal */}
      <Modal
        visible={!!confirmDownloadAsset}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmDownloadAsset(null)}>
        <View style={downloadModalStyles.overlay}>
          <View style={downloadModalStyles.container}>
            <View style={downloadModalStyles.iconContainer}>
              <View style={downloadModalStyles.downloadIcon}>
                {confirmDownloadAsset &&
                (confirmDownloadAsset.type === 'video' ||
                  (confirmDownloadAsset.mime_type || '').startsWith('video/')) ? (
                  <Film size={32} color={theme.colors.accent} />
                ) : (
                  <FileImage size={32} color={theme.colors.accent} />
                )}
              </View>
            </View>
            <Text style={downloadModalStyles.title}>Save to Camera Roll</Text>
            <Text style={downloadModalStyles.subtitle} numberOfLines={2}>
              {confirmDownloadAsset ? getAssetLabel(confirmDownloadAsset) : ''}
            </Text>
            <Text style={downloadModalStyles.sizeText}>
              Size: {confirmDownloadAsset ? formatFileSize(confirmDownloadAsset.file_size) : '--'}
            </Text>
            <View style={downloadModalStyles.confirmButtons}>
              <TouchableOpacity
                style={downloadModalStyles.cancelButton}
                onPress={() => setConfirmDownloadAsset(null)}>
                <Text style={downloadModalStyles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={downloadModalStyles.confirmButton}
                onPress={() => void handleDownloadConfirm()}>
                <Download size={18} color="#fff" />
                <Text style={downloadModalStyles.confirmButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Download progress modal */}
      <Modal
        visible={showDownloadModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (downloadStatus !== 'downloading' && downloadStatus !== 'saving') {
            resetDownloadModal();
          }
        }}>
        <View style={downloadModalStyles.overlay}>
          <View style={downloadModalStyles.container}>
            <View style={downloadModalStyles.iconContainer}>
              {downloadStatus === 'success' ? (
                <Animated.View style={{transform: [{scale: successScaleAnim}]}}>
                  <View style={downloadModalStyles.successIcon}>
                    <Check size={32} color={theme.colors.success} strokeWidth={3} />
                  </View>
                </Animated.View>
              ) : downloadStatus === 'error' ? (
                <View style={downloadModalStyles.errorIcon}>
                  <X size={32} color={theme.colors.error} strokeWidth={3} />
                </View>
              ) : (
                <View style={downloadModalStyles.downloadIcon}>
                  <Download size={32} color={theme.colors.accent} />
                </View>
              )}
            </View>
            <Text style={downloadModalStyles.title}>
              {downloadStatus === 'downloading' && 'Downloading'}
              {downloadStatus === 'saving' && 'Saving to Camera Roll'}
              {downloadStatus === 'success' && 'Saved!'}
              {downloadStatus === 'error' && 'Download Failed'}
            </Text>
            {(downloadStatus === 'downloading' || downloadStatus === 'saving') && (
              <View style={downloadModalStyles.progressContainer}>
                <View style={downloadModalStyles.progressTrack}>
                  <Animated.View
                    style={[
                      downloadModalStyles.progressFill,
                      {
                        width: downloadProgressAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0%', '100%'],
                        }),
                      },
                    ]}
                  />
                </View>
                <Text style={downloadModalStyles.progressText}>
                  {downloadStatus === 'saving'
                    ? 'Saving...'
                    : `${formatFileSize(downloadedBytes)} / ${formatFileSize(downloadSize || 0)}`}
                </Text>
              </View>
            )}
            {downloadStatus === 'success' && (
              <Text style={downloadModalStyles.successText}>
                Check the "PostHive" album in Photos
              </Text>
            )}
            {downloadStatus === 'error' && (
              <>
                <Text style={downloadModalStyles.errorText}>
                  {downloadError || 'Something went wrong'}
                </Text>
                <TouchableOpacity
                  style={downloadModalStyles.retryButton}
                  onPress={() => {
                    const asset = downloadingAssetRef.current;
                    resetDownloadModal();
                    if (asset) void handleDownloadConfirm(asset);
                  }}>
                  <Text style={downloadModalStyles.retryButtonText}>Try Again</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={downloadModalStyles.dismissButton}
                  onPress={resetDownloadModal}>
                  <Text style={downloadModalStyles.dismissButtonText}>Dismiss</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  flexFill: {
    flex: 1,
  },
  header: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
  },
  headerTitleBlock: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    minWidth: 0,
  },
  headerBackChevron: {
    marginRight: 2,
  },
  headerTitleTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  headerHint: {
    marginTop: 6,
    color: theme.colors.textMuted,
    fontSize: theme.typography.fontSize.sm,
    lineHeight: 20,
  },
  eyebrow: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.fontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: theme.typography.letterSpacing.wide,
    marginBottom: 4,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSize.xl,
    fontFamily: theme.typography.fontFamily.bold,
  },
  headerActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: 140,
    flexGrow: 1,
  },
  clientErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    padding: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  errorRetry: {
    color: theme.colors.accent,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.medium,
  },
  clientListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  clientListIcon: {
    width: 44,
    height: 44,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  clientListBody: {
    flex: 1,
    minWidth: 0,
  },
  clientListName: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSize.md,
    fontFamily: theme.typography.fontFamily.medium,
  },
  clientListMeta: {
    marginTop: 2,
    color: theme.colors.textMuted,
    fontSize: theme.typography.fontSize.xs,
  },
  driveListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  driveListThumb: {
    width: 56,
    height: 56,
    borderRadius: theme.borderRadius.sm,
    overflow: 'hidden',
    backgroundColor: '#111',
  },
  driveListThumbPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
  },
  driveListPlayBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 4,
    padding: 4,
  },
  driveListBody: {
    flex: 1,
    minWidth: 0,
  },
  driveListTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.medium,
  },
  driveListMeta: {
    marginTop: 2,
    color: theme.colors.textMuted,
    fontSize: theme.typography.fontSize.xs,
  },
  breadcrumbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  backButton: {
    width: 32,
    height: 32,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonDisabled: {
    opacity: 0.4,
  },
  breadcrumbText: {
    flex: 1,
    color: theme.colors.textSecondary,
    fontSize: theme.typography.fontSize.xs,
  },
  centerState: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.xl,
    paddingHorizontal: theme.spacing.lg,
  },
  centerStateText: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.fontSize.sm,
    textAlign: 'center',
  },
  centerStateHint: {
    marginTop: theme.spacing.xs,
    color: theme.colors.textMuted,
    fontSize: theme.typography.fontSize.xs,
    textAlign: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: theme.typography.fontSize.sm,
    textAlign: 'center',
  },
  videoModal: {
    flex: 1,
    backgroundColor: '#000',
  },
  videoModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  videoModalClose: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  videoModalCloseText: {
    color: theme.colors.accent,
    fontSize: theme.typography.fontSize.md,
    fontFamily: theme.typography.fontFamily.medium,
  },
  videoModalTitle: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSize.md,
    fontFamily: theme.typography.fontFamily.medium,
  },
  videoModalDownload: {
    padding: 8,
    marginRight: -8,
  },
  videoModalPlayer: {
    flex: 1,
  },
});

const downloadModalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  container: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xl,
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
  },
  iconContainer: {
    marginBottom: theme.spacing.lg,
  },
  downloadIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.colors.accent + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.colors.successBackground,
    borderWidth: 2,
    borderColor: theme.colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.colors.error + '20',
    borderWidth: 2,
    borderColor: theme.colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: theme.typography.fontSize.lg,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  sizeText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.lg,
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    width: '100%',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: theme.typography.fontSize.md,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.textSecondary,
  },
  confirmButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.accent,
  },
  confirmButtonText: {
    fontSize: theme.typography.fontSize.md,
    fontFamily: theme.typography.fontFamily.semibold,
    color: theme.colors.textInverse,
  },
  progressContainer: {
    width: '100%',
    marginBottom: theme.spacing.md,
  },
  progressTrack: {
    height: 6,
    backgroundColor: theme.colors.surfaceBorder,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: theme.spacing.sm,
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.accent,
    borderRadius: 3,
  },
  progressText: {
    fontSize: theme.typography.fontSize.xs,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  successText: {
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
  },
  errorText: {
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.error,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  retryButton: {
    backgroundColor: theme.colors.accent,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
    width: '100%',
    alignItems: 'center',
  },
  retryButtonText: {
    fontSize: theme.typography.fontSize.md,
    fontFamily: theme.typography.fontFamily.semibold,
    color: theme.colors.textInverse,
  },
  dismissButton: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xl,
  },
  dismissButtonText: {
    fontSize: theme.typography.fontSize.md,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.textMuted,
  },
});
