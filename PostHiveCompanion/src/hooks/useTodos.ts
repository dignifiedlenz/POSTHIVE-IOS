import {useState, useEffect, useCallback} from 'react';
import {
  getTodos,
  createTodo,
  updateTodoStatus,
  deleteTodo,
} from '../lib/api';
import {Todo, CreateTodoInput, TodoStatus} from '../lib/types';

interface UseTodosOptions {
  workspaceId: string;
  userId: string;
}

export function useTodos({workspaceId, userId}: UseTodosOptions) {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load todos
  const loadTodos = useCallback(async () => {
    if (!workspaceId) {
      console.log('useTodos: No workspaceId, skipping load');
      return;
    }

    try {
      console.log('useTodos: Loading todos for workspace:', workspaceId);
      const data = await getTodos(workspaceId);
      console.log('useTodos: Loaded', data.length, 'todos');
      setTodos(data);
      setError(null);
    } catch (err) {
      console.error('useTodos: Error loading todos:', err);
      setError('Failed to load tasks');
    }
  }, [workspaceId]);

  // Initial load
  useEffect(() => {
    let isMounted = true;
    
    const init = async () => {
      if (!workspaceId) {
        console.log('useTodos: Skipping init - no workspaceId');
        setIsLoading(false);
        return;
      }
      
      setIsLoading(true);
      await loadTodos();
      if (isMounted) {
        setIsLoading(false);
      }
    };
    
    init();
    
    // Safety timeout - increased to 15 seconds and log more details
    const timeout = setTimeout(() => {
      if (isMounted && isLoading) {
        console.warn('useTodos: Loading timed out after 15 seconds', {
          workspaceId,
          hasWorkspaceId: !!workspaceId,
        });
        setIsLoading(false);
        setError('Loading timed out. Please try refreshing.');
      }
    }, 15000);
    
    return () => {
      isMounted = false;
      clearTimeout(timeout);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  // Refresh
  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadTodos();
    setIsRefreshing(false);
  }, [loadTodos]);

  // Create todo
  const addTodo = useCallback(
    async (input: CreateTodoInput) => {
      try {
        const newTodo = await createTodo(workspaceId, userId, input);
        setTodos(prev => [newTodo, ...prev]);
        return newTodo;
      } catch (err) {
        console.error('Error creating todo:', err);
        throw err;
      }
    },
    [workspaceId, userId],
  );

  // Update todo status
  const updateStatus = useCallback(
    async (todoId: string, status: TodoStatus) => {
      // Optimistic update
      setTodos(prev =>
        prev.map(t =>
          t.id === todoId
            ? {
                ...t,
                status,
                completed_at:
                  status === 'completed' ? new Date().toISOString() : undefined,
                completed_by: status === 'completed' ? userId : undefined,
              }
            : t,
        ),
      );

      try {
        await updateTodoStatus(todoId, status, userId);
      } catch (err) {
        console.error('Error updating todo status:', err);
        // Revert on error
        await loadTodos();
        throw err;
      }
    },
    [userId, loadTodos],
  );

  // Delete todo
  const removeTodo = useCallback(
    async (todoId: string) => {
      // Optimistic update
      setTodos(prev => prev.filter(t => t.id !== todoId));

      try {
        await deleteTodo(todoId);
      } catch (err) {
        console.error('Error deleting todo:', err);
        // Revert on error
        await loadTodos();
        throw err;
      }
    },
    [loadTodos],
  );

  // Toggle todo status (convenience method)
  const toggleStatus = useCallback(
    async (todo: Todo) => {
      const nextStatus: TodoStatus =
        todo.status === 'completed' ? 'pending' : 'completed';
      await updateStatus(todo.id, nextStatus);
    },
    [updateStatus],
  );

  // Filter helpers
  const pendingTodos = todos.filter(t => t.status === 'pending');
  const inProgressTodos = todos.filter(t => t.status === 'in_progress');
  const completedTodos = todos.filter(t => t.status === 'completed');

  return {
    todos,
    pendingTodos,
    inProgressTodos,
    completedTodos,
    isLoading,
    isRefreshing,
    error,
    refresh,
    addTodo,
    updateStatus,
    removeTodo,
    toggleStatus,
  };
}

