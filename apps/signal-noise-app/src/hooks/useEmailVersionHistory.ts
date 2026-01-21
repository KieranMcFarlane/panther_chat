import { useState, useCallback } from 'react';

interface EmailVersion {
  id: string;
  version_number: number;
  content: string;
  subject?: string;
  to_email?: string;
  change_type: 'initial' | 'ai_suggestion' | 'user_edit' | 'diff_applied' | 'manual_save' | 'restore';
  change_description?: string;
  created_at: string;
  metadata: any;
}

interface VersionHistoryState {
  threadId: string | null;
  versions: EmailVersion[];
  currentVersion: number;
  isLoading: boolean;
  error: string | null;
}

interface UseEmailVersionHistoryReturn {
  state: VersionHistoryState;
  saveVersion: (data: {
    toEmail: string;
    subject?: string;
    content: string;
    changeType?: string;
    changeDescription?: string;
    userId?: string;
    metadata?: any;
  }) => Promise<{ success: boolean; versionId?: string; error?: string }>;
  loadHistory: (threadId?: string, toEmail?: string, subject?: string) => Promise<void>;
  restoreVersion: (threadId: string, versionNumber: number) => Promise<{
    success: boolean;
    content?: string;
    subject?: string;
    toEmail?: string;
    error?: string;
  }>;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => Promise<boolean>;
  redo: () => Promise<boolean>;
  clearHistory: () => void;
}

export const useEmailVersionHistory = (): UseEmailVersionHistoryReturn => {
  const [state, setState] = useState<VersionHistoryState>({
    threadId: null,
    versions: [],
    currentVersion: 0,
    isLoading: false,
    error: null
  });

  const saveVersion = useCallback(async (data: {
    toEmail: string;
    subject?: string;
    content: string;
    changeType?: string;
    changeDescription?: string;
    userId?: string;
    metadata?: any;
  }) => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const response = await fetch('/api/email-versions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toEmail: data.toEmail,
          subject: data.subject,
          content: data.content,
          changeType: data.changeType || 'user_edit',
          changeDescription: data.changeDescription,
          userId: data.userId,
          metadata: data.metadata || {}
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save version');
      }

      // Update local state
      setState(prev => ({
        ...prev,
        threadId: result.threadId,
        currentVersion: Math.max(prev.currentVersion, 0) + 1,
        isLoading: false
      }));

      // Refresh history
      await loadHistory(result.threadId);

      return { success: true, versionId: result.versionId };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({ ...prev, error: errorMessage, isLoading: false }));
      return { success: false, error: errorMessage };
    }
  }, []);

  const loadHistory = useCallback(async (threadId?: string, toEmail?: string, subject?: string) => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const params = new URLSearchParams();
      if (threadId) params.set('threadId', threadId);
      else if (toEmail) {
        params.set('toEmail', toEmail);
        if (subject) params.set('subject', subject);
      }

      const response = await fetch(`/api/email-versions?${params}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to load history');
      }

      setState(prev => ({
        ...prev,
        threadId: result.threadId,
        versions: result.versions || [],
        currentVersion: result.versions?.[0]?.version_number || 0,
        isLoading: false
      }));

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({ ...prev, error: errorMessage, isLoading: false }));
    }
  }, []);

  const restoreVersion = useCallback(async (threadId: string, versionNumber: number) => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const response = await fetch('/api/email-versions/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId, versionNumber })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to restore version');
      }

      // Update current version and refresh history
      setState(prev => ({
        ...prev,
        currentVersion: result.restoredVersion.version_number,
        isLoading: false
      }));

      await loadHistory(threadId);

      return {
        success: true,
        content: result.restoredVersion.content,
        subject: result.restoredVersion.subject,
        toEmail: result.restoredVersion.to_email
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({ ...prev, error: errorMessage, isLoading: false }));
      return { success: false, error: errorMessage };
    }
  }, [loadHistory]);

  const canUndo = state.currentVersion > 1;
  const canRedo = state.currentVersion < (state.versions[0]?.version_number || 0);

  const undo = useCallback(async () => {
    if (!canUndo || !state.threadId) return false;

    const previousVersion = state.currentVersion - 1;
    const previousVersionData = state.versions.find(v => v.version_number === previousVersion);
    
    if (!previousVersionData) return false;

    const result = await restoreVersion(state.threadId, previousVersion);
    return result.success;
  }, [canUndo, state.threadId, state.currentVersion, state.versions, restoreVersion]);

  const redo = useCallback(async () => {
    if (!canRedo || !state.threadId) return false;

    const nextVersion = state.currentVersion + 1;
    const nextVersionData = state.versions.find(v => v.version_number === nextVersion);
    
    if (!nextVersionData) return false;

    const result = await restoreVersion(state.threadId, nextVersion);
    return result.success;
  }, [canRedo, state.threadId, state.currentVersion, state.versions, restoreVersion]);

  const clearHistory = useCallback(() => {
    setState({
      threadId: null,
      versions: [],
      currentVersion: 0,
      isLoading: false,
      error: null
    });
  }, []);

  return {
    state,
    saveVersion,
    loadHistory,
    restoreVersion,
    canUndo,
    canRedo,
    undo,
    redo,
    clearHistory
  };
};