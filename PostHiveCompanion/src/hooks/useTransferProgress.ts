/**
 * useTransferProgress Hook
 * 
 * Subscribes to real-time transfer progress updates from the Electron desktop app.
 * Used to update Live Activities showing file transfer status.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useLiveActivity } from './useLiveActivity';

export interface TransferSession {
  id: string;
  user_id: string;
  workspace_id: string;
  project_id: string | null;
  project_name: string | null;
  transfer_name: string;
  status: 'in_progress' | 'completed' | 'failed' | 'paused' | 'cancelled';
  progress: number;
  total_files: number;
  completed_files: number;
  total_bytes: number;
  bytes_transferred: number;
  current_file_name: string | null;
  current_file_progress: number;
  current_file_size: number;
  current_file_bytes_transferred: number;
  active_files: Array<{
    fileName: string;
    fileSize: number;
    bytesTransferred: number;
    progress: number;
    camera?: string;
    rollType?: string;
  }>;
  destinations: Array<{
    id: string;
    name: string;
    progress: number;
    bytesTransferred: number;
    totalBytes: number;
  }>;
  started_at: string;
  updated_at: string;
  completed_at: string | null;
  device_name: string | null;
  device_id: string | null;
}

interface UseTransferProgressOptions {
  workspaceId?: string;
  userId?: string;
  enabled?: boolean;
  onTransferStart?: (session: TransferSession) => void;
  onTransferProgress?: (session: TransferSession) => void;
  onTransferComplete?: (session: TransferSession) => void;
  onTransferFailed?: (session: TransferSession) => void;
}

export function useTransferProgress({
  workspaceId,
  userId,
  enabled = true,
  onTransferStart,
  onTransferProgress,
  onTransferComplete,
  onTransferFailed,
}: UseTransferProgressOptions) {
  const [activeSessions, setActiveSessions] = useState<TransferSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const subscriptionRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const previousStatusRef = useRef<Map<string, string>>(new Map());

  // Fetch active transfer sessions
  const fetchActiveSessions = useCallback(async () => {
    if (!workspaceId && !userId) return;

    try {
      let query = supabase
        .from('transfer_sessions')
        .select('*')
        .in('status', ['in_progress', 'paused'])
        .order('updated_at', { ascending: false })
        .limit(10);

      if (workspaceId) {
        query = query.eq('workspace_id', workspaceId);
      }

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        throw fetchError;
      }

      setActiveSessions(data || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching transfer sessions:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch sessions'));
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, userId]);

  // Handle session updates
  const handleSessionUpdate = useCallback((payload: any) => {
    const session = payload.new as TransferSession;
    const previousStatus = previousStatusRef.current.get(session.id);

    // Update local state
    setActiveSessions(prev => {
      const existingIndex = prev.findIndex(s => s.id === session.id);
      
      if (session.status === 'completed' || session.status === 'failed' || session.status === 'cancelled') {
        // Remove completed/failed sessions from active list
        return prev.filter(s => s.id !== session.id);
      }

      if (existingIndex >= 0) {
        // Update existing session
        const updated = [...prev];
        updated[existingIndex] = session;
        return updated;
      } else {
        // Add new session
        return [session, ...prev];
      }
    });

    // Track status for change detection
    previousStatusRef.current.set(session.id, session.status);

    // Trigger callbacks based on status changes
    if (!previousStatus && session.status === 'in_progress') {
      // New transfer started
      onTransferStart?.(session);
    } else if (session.status === 'in_progress') {
      // Progress update
      onTransferProgress?.(session);
    } else if (session.status === 'completed') {
      // Transfer completed
      onTransferComplete?.(session);
      previousStatusRef.current.delete(session.id);
    } else if (session.status === 'failed') {
      // Transfer failed
      onTransferFailed?.(session);
      previousStatusRef.current.delete(session.id);
    }
  }, [onTransferStart, onTransferProgress, onTransferComplete, onTransferFailed]);

  // Handle new session inserts
  const handleSessionInsert = useCallback((payload: any) => {
    const session = payload.new as TransferSession;
    
    if (session.status === 'in_progress' || session.status === 'paused') {
      setActiveSessions(prev => [session, ...prev]);
      previousStatusRef.current.set(session.id, session.status);
      onTransferStart?.(session);
    }
  }, [onTransferStart]);

  // Set up real-time subscription
  useEffect(() => {
    if (!enabled || (!workspaceId && !userId)) {
      return;
    }

    // Initial fetch
    fetchActiveSessions();

    // Set up real-time subscription
    const channelName = workspaceId 
      ? `transfer_sessions_workspace_${workspaceId}`
      : `transfer_sessions_user_${userId}`;

    // Remove existing subscription
    if (subscriptionRef.current) {
      supabase.removeChannel(subscriptionRef.current);
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'transfer_sessions',
          filter: workspaceId 
            ? `workspace_id=eq.${workspaceId}`
            : `user_id=eq.${userId}`,
        },
        handleSessionInsert
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'transfer_sessions',
          filter: workspaceId 
            ? `workspace_id=eq.${workspaceId}`
            : `user_id=eq.${userId}`,
        },
        handleSessionUpdate
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Subscribed to transfer progress updates');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Transfer progress subscription error');
        }
      });

    subscriptionRef.current = channel;

    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
      }
    };
  }, [enabled, workspaceId, userId, fetchActiveSessions, handleSessionInsert, handleSessionUpdate]);

  // Get the most recent active session
  const currentSession = activeSessions.length > 0 ? activeSessions[0] : null;

  // Format bytes for display
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  // Calculate transfer speed
  const getTransferSpeed = (session: TransferSession): string => {
    if (!session.started_at || session.bytes_transferred === 0) return '0 B/s';
    
    const startTime = new Date(session.started_at).getTime();
    const now = Date.now();
    const elapsedSeconds = (now - startTime) / 1000;
    
    if (elapsedSeconds <= 0) return '0 B/s';
    
    const bytesPerSecond = session.bytes_transferred / elapsedSeconds;
    return `${formatBytes(bytesPerSecond)}/s`;
  };

  // Calculate ETA
  const getETA = (session: TransferSession): string => {
    if (!session.started_at || session.bytes_transferred === 0) return '--';
    
    const startTime = new Date(session.started_at).getTime();
    const now = Date.now();
    const elapsedSeconds = (now - startTime) / 1000;
    
    if (elapsedSeconds <= 0) return '--';
    
    const bytesPerSecond = session.bytes_transferred / elapsedSeconds;
    if (bytesPerSecond <= 0) return '--';
    
    const remainingBytes = session.total_bytes - session.bytes_transferred;
    const remainingSeconds = remainingBytes / bytesPerSecond;
    
    if (remainingSeconds < 60) {
      return `${Math.round(remainingSeconds)}s`;
    } else if (remainingSeconds < 3600) {
      return `${Math.round(remainingSeconds / 60)}m`;
    } else {
      const hours = Math.floor(remainingSeconds / 3600);
      const minutes = Math.round((remainingSeconds % 3600) / 60);
      return `${hours}h ${minutes}m`;
    }
  };

  return {
    activeSessions,
    currentSession,
    isLoading,
    error,
    refresh: fetchActiveSessions,
    formatBytes,
    getTransferSpeed,
    getETA,
  };
}



