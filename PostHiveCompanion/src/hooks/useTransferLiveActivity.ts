/**
 * useTransferLiveActivity Hook
 * 
 * Connects transfer progress updates to iOS Live Activities.
 * Shows real-time file transfer progress on the lock screen and Dynamic Island.
 */

import { useEffect, useCallback, useRef } from 'react';
import { NativeModules, Platform } from 'react-native';
import { useTransferProgress, TransferSession } from './useTransferProgress';

const { LiveActivityModule } = NativeModules;

interface UseTransferLiveActivityOptions {
  workspaceId?: string;
  userId?: string;
  enabled?: boolean;
  onError?: (error: Error) => void;
}

interface TransferActivityState {
  activityId: string | null;
  sessionId: string | null;
  isActive: boolean;
}

export function useTransferLiveActivity({
  workspaceId,
  userId,
  enabled = true,
  onError,
}: UseTransferLiveActivityOptions) {
  const activityStateRef = useRef<TransferActivityState>({
    activityId: null,
    sessionId: null,
    isActive: false,
  });

  // Check if Live Activities are available
  const isAvailable = Platform.OS === 'ios' && LiveActivityModule?.isAvailable?.() === true;

  // Start a Live Activity for a transfer
  const startTransferActivity = useCallback(async (session: TransferSession) => {
    if (!isAvailable || !LiveActivityModule) {
      console.log('📱 Live Activities not available');
      return;
    }

    // Don't start if we already have an activity for this session
    if (activityStateRef.current.sessionId === session.id && activityStateRef.current.isActive) {
      return;
    }

    try {
      // End any existing activity first
      if (activityStateRef.current.activityId) {
        await LiveActivityModule.endTransferActivity(activityStateRef.current.activityId);
      }

      // Start new activity
      const activityId = await LiveActivityModule.startTransferActivity({
        sessionId: session.id,
        transferName: session.transfer_name,
        projectName: session.project_name || 'Transfer',
        totalFiles: session.total_files,
        completedFiles: session.completed_files,
        progress: session.progress / 100, // Convert to 0-1 range
        currentFileName: session.current_file_name || '',
        totalBytes: session.total_bytes,
        bytesTransferred: session.bytes_transferred,
        deviceName: session.device_name || 'Desktop',
      });

      activityStateRef.current = {
        activityId,
        sessionId: session.id,
        isActive: true,
      };

      console.log('📱 Started transfer Live Activity:', activityId);
    } catch (error) {
      console.error('📱 Failed to start transfer Live Activity:', error);
      onError?.(error instanceof Error ? error : new Error('Failed to start activity'));
    }
  }, [isAvailable, onError]);

  // Update the Live Activity with new progress
  const updateTransferActivity = useCallback(async (session: TransferSession) => {
    if (!isAvailable || !LiveActivityModule || !activityStateRef.current.activityId) {
      return;
    }

    // Only update if this is the same session
    if (activityStateRef.current.sessionId !== session.id) {
      return;
    }

    try {
      await LiveActivityModule.updateTransferActivity(activityStateRef.current.activityId, {
        completedFiles: session.completed_files,
        progress: session.progress / 100,
        currentFileName: session.current_file_name || '',
        bytesTransferred: session.bytes_transferred,
        // Calculate speed from active files if available
        currentFileProgress: session.current_file_progress / 100,
      });
    } catch (error) {
      console.error('📱 Failed to update transfer Live Activity:', error);
    }
  }, [isAvailable]);

  // End the Live Activity
  const endTransferActivity = useCallback(async (completed: boolean = true) => {
    if (!isAvailable || !LiveActivityModule || !activityStateRef.current.activityId) {
      return;
    }

    try {
      await LiveActivityModule.endTransferActivity(
        activityStateRef.current.activityId,
        completed ? 'completed' : 'failed'
      );

      console.log('📱 Ended transfer Live Activity:', activityStateRef.current.activityId);
    } catch (error) {
      console.error('📱 Failed to end transfer Live Activity:', error);
    } finally {
      activityStateRef.current = {
        activityId: null,
        sessionId: null,
        isActive: false,
      };
    }
  }, [isAvailable]);

  // Handle transfer events
  const handleTransferStart = useCallback((session: TransferSession) => {
    console.log('📱 Transfer started:', session.transfer_name);
    startTransferActivity(session);
  }, [startTransferActivity]);

  const handleTransferProgress = useCallback((session: TransferSession) => {
    updateTransferActivity(session);
  }, [updateTransferActivity]);

  const handleTransferComplete = useCallback((session: TransferSession) => {
    console.log('📱 Transfer completed:', session.transfer_name);
    endTransferActivity(true);
  }, [endTransferActivity]);

  const handleTransferFailed = useCallback((session: TransferSession) => {
    console.log('📱 Transfer failed:', session.transfer_name);
    endTransferActivity(false);
  }, [endTransferActivity]);

  // Use the transfer progress hook
  const {
    activeSessions,
    currentSession,
    isLoading,
    error,
    refresh,
    formatBytes,
    getTransferSpeed,
    getETA,
  } = useTransferProgress({
    workspaceId,
    userId,
    enabled: enabled && isAvailable,
    onTransferStart: handleTransferStart,
    onTransferProgress: handleTransferProgress,
    onTransferComplete: handleTransferComplete,
    onTransferFailed: handleTransferFailed,
  });

  // Start activity for any existing active session on mount
  useEffect(() => {
    if (currentSession && !activityStateRef.current.isActive) {
      startTransferActivity(currentSession);
    }
  }, [currentSession, startTransferActivity]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (activityStateRef.current.activityId) {
        endTransferActivity(false);
      }
    };
  }, [endTransferActivity]);

  return {
    activeSessions,
    currentSession,
    isLoading,
    error,
    isAvailable,
    hasActiveActivity: activityStateRef.current.isActive,
    refresh,
    formatBytes,
    getTransferSpeed,
    getETA,
    // Manual controls
    startActivity: startTransferActivity,
    endActivity: endTransferActivity,
  };
}



