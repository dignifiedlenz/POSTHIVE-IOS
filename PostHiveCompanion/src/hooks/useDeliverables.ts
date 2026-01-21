import {useState, useEffect, useCallback} from 'react';
import {
  getRecentDeliverables,
  getDeliverable,
  getDeliverableVersions,
  getDeliverableComments,
  addComment,
  toggleCommentComplete,
  deleteComment,
} from '../lib/api';
import {Deliverable, Comment, Version} from '../lib/types';

interface UseDeliverablesOptions {
  workspaceId: string;
  userId: string;
}

export function useDeliverables({workspaceId, userId}: UseDeliverablesOptions) {
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load deliverables
  const loadDeliverables = useCallback(async () => {
    if (!workspaceId || !userId) return;

    try {
      const data = await getRecentDeliverables(workspaceId, userId);
      setDeliverables(data);
      setError(null);
    } catch (err) {
      console.error('Error loading deliverables:', err);
      setError('Failed to load deliverables');
    }
  }, [workspaceId, userId]);

  // Initial load
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await loadDeliverables();
      setIsLoading(false);
    };
    init();
  }, [loadDeliverables]);

  // Refresh
  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadDeliverables();
    setIsRefreshing(false);
  }, [loadDeliverables]);

  return {
    deliverables,
    isLoading,
    isRefreshing,
    error,
    refresh,
  };
}

interface UseDeliverableDetailOptions {
  deliverableId: string;
  userId: string;
  initialVersionId?: string;
}

export function useDeliverableDetail({
  deliverableId,
  userId,
  initialVersionId,
}: UseDeliverableDetailOptions) {
  const [deliverable, setDeliverable] = useState<Deliverable | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialVersionApplied, setInitialVersionApplied] = useState(false);

  // Load deliverable detail
  const loadDeliverable = useCallback(async () => {
    if (!deliverableId) return;

    try {
      const [deliverableData, versionsData, commentsData] = await Promise.all([
        getDeliverable(deliverableId),
        getDeliverableVersions(deliverableId),
        getDeliverableComments(deliverableId),
      ]);

      setDeliverable(deliverableData);
      setVersions(versionsData);
      setComments(commentsData);

      // Set selected version: prefer initialVersionId if provided and not yet applied
      if (versionsData.length > 0) {
        if (initialVersionId && !initialVersionApplied) {
          // Find the version that matches the initialVersionId
          const targetVersion = versionsData.find(v => v.id === initialVersionId);
          if (targetVersion) {
            setSelectedVersion(targetVersion.version_number);
          } else {
            // Fall back to latest
            setSelectedVersion(versionsData[0].version_number);
          }
          setInitialVersionApplied(true);
        } else if (!initialVersionApplied) {
          // Default to latest version
          setSelectedVersion(versionsData[0].version_number);
          setInitialVersionApplied(true);
        }
      } else if (!initialVersionApplied && deliverableData?.type === 'image_gallery') {
        // Galleries don't have versions; use current_version (defaults to 0)
        const fallbackVersion = deliverableData.current_version ?? 0;
        setSelectedVersion(fallbackVersion);
        setInitialVersionApplied(true);
      }

      setError(null);
    } catch (err) {
      console.error('Error loading deliverable:', err);
      setError('Failed to load deliverable');
    }
  }, [deliverableId, initialVersionId, initialVersionApplied]);

  // Initial load
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await loadDeliverable();
      setIsLoading(false);
    };
    init();
  }, [loadDeliverable]);

  // Load comments for specific version
  const loadComments = useCallback(async () => {
    if (!deliverableId) return;

    setIsLoadingComments(true);
    try {
      const commentsData = await getDeliverableComments(deliverableId);
      setComments(commentsData);
    } catch (err) {
      console.error('Error loading comments:', err);
    } finally {
      setIsLoadingComments(false);
    }
  }, [deliverableId]);

  // Add comment
  const postComment = useCallback(
    async (
      content: string,
      startTime?: number,
      endTime?: number,
      parentId?: string,
    ) => {
      try {
        await addComment(
          deliverableId,
          selectedVersion,
          userId,
          content,
          startTime,
          endTime,
          parentId,
        );
        // Reload comments
        await loadComments();
      } catch (err) {
        console.error('Error posting comment:', err);
        throw err;
      }
    },
    [deliverableId, selectedVersion, userId, loadComments],
  );

  // Toggle comment complete
  const toggleComplete = useCallback(
    async (comment: Comment) => {
      try {
        await toggleCommentComplete(
          comment.id,
          comment.completed || false,
          userId,
        );
        // Update local state
        setComments(prev =>
          prev.map(c =>
            c.id === comment.id
              ? {
                  ...c,
                  completed: !c.completed,
                  completed_by: !c.completed ? userId : undefined,
                  completed_at: !c.completed
                    ? new Date().toISOString()
                    : undefined,
                }
              : c,
          ),
        );
      } catch (err) {
        console.error('Error toggling comment complete:', err);
        throw err;
      }
    },
    [userId],
  );

  // Delete comment
  const removeComment = useCallback(
    async (commentId: string) => {
      try {
        await deleteComment(commentId);
        // Update local state
        setComments(prev => prev.filter(c => c.id !== commentId));
      } catch (err) {
        console.error('Error deleting comment:', err);
        throw err;
      }
    },
    [],
  );

  // Get current version data
  const currentVersion = versions.find(v => v.version_number === selectedVersion);

  // Filter comments for selected version
  const versionComments = comments.filter(
    c => c.version_number === selectedVersion,
  );

  return {
    deliverable,
    versions,
    comments: versionComments,
    allComments: comments,
    selectedVersion,
    setSelectedVersion,
    currentVersion,
    isLoading,
    isLoadingComments,
    error,
    postComment,
    toggleComplete,
    removeComment,
    refresh: loadDeliverable,
  };
}

