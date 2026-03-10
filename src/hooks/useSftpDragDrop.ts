import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface UploadProgress {
  fileName: string;
  progress: number;
  status: 'uploading' | 'completed' | 'error';
  error?: string;
}

interface DragDropState {
  isDragging: boolean;
  uploadProgress: Map<string, UploadProgress>;
  errors: Map<string, string>;
}

const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB

export function useSftpDragDrop(sessionId: string | null, currentPath: string) {
  const [state, setState] = useState<DragDropState>({
    isDragging: false,
    uploadProgress: new Map(),
    errors: new Map(),
  });

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setState(prev => ({ ...prev, isDragging: true }));
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set isDragging to false if we're leaving the drop zone entirely
    if (e.currentTarget === e.target) {
      setState(prev => ({ ...prev, isDragging: false }));
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const uploadFile = useCallback(async (file: File, remotePath: string) => {
    if (!sessionId) {
      throw new Error('No active SFTP session');
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`File size exceeds 2GB limit: ${file.name}`);
    }

    // Update progress
    setState(prev => {
      const newProgress = new Map(prev.uploadProgress);
      newProgress.set(file.name, {
        fileName: file.name,
        progress: 0,
        status: 'uploading',
      });
      return { ...prev, uploadProgress: newProgress };
    });

    try {
      // Read file as array buffer
      const arrayBuffer = await file.arrayBuffer();
      const data = Array.from(new Uint8Array(arrayBuffer));

      // Upload via SFTP
      await invoke('remote_files_upload', {
        protocol: 'sftp',
        sessionId,
        path: remotePath,
        data,
      });

      // Update progress to completed
      setState(prev => {
        const newProgress = new Map(prev.uploadProgress);
        newProgress.set(file.name, {
          fileName: file.name,
          progress: 100,
          status: 'completed',
        });
        return { ...prev, uploadProgress: newProgress };
      });

      // Remove from progress after 2 seconds
      setTimeout(() => {
        setState(prev => {
          const newProgress = new Map(prev.uploadProgress);
          newProgress.delete(file.name);
          return { ...prev, uploadProgress: newProgress };
        });
      }, 2000);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Provide user-friendly error messages
      let friendlyMessage = errorMessage;
      if (errorMessage.includes('permission') || errorMessage.includes('Permission denied')) {
        friendlyMessage = `Permission denied: Cannot upload to ${remotePath}. Check server permissions.`;
      } else if (errorMessage.includes('network') || errorMessage.includes('connection')) {
        friendlyMessage = `Network error: Connection lost during upload. Please try again.`;
      } else if (errorMessage.includes('No space')) {
        friendlyMessage = `Server storage full: Cannot upload ${file.name}.`;
      } else if (errorMessage.includes('Session not found')) {
        friendlyMessage = `SFTP session expired. Please reconnect and try again.`;
      }
      
      setState(prev => {
        const newProgress = new Map(prev.uploadProgress);
        const newErrors = new Map(prev.errors);
        
        newProgress.set(file.name, {
          fileName: file.name,
          progress: 0,
          status: 'error',
          error: friendlyMessage,
        });
        newErrors.set(file.name, friendlyMessage);
        
        return { ...prev, uploadProgress: newProgress, errors: newErrors };
      });

      throw new Error(friendlyMessage);
    }
  }, [sessionId]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setState(prev => ({ ...prev, isDragging: false }));

    if (!sessionId) {
      console.error('No active SFTP session');
      return;
    }

    const items = Array.from(e.dataTransfer.items);
    const files: File[] = [];

    // Validate and collect files
    for (const item of items) {
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) {
          // Reject folders (folders have empty type)
          if (file.type === '' && file.size === 0) {
            setState(prev => {
              const newErrors = new Map(prev.errors);
              newErrors.set(file.name, 'Folder upload is not supported. Please upload files only.');
              return { ...prev, errors: newErrors };
            });
            continue;
          }
          files.push(file);
        }
      }
    }

    // Upload files
    for (const file of files) {
      const remotePath = `${currentPath}/${file.name}`.replace('//', '/');
      try {
        await uploadFile(file, remotePath);
      } catch (error) {
        console.error(`Failed to upload ${file.name}:`, error);
      }
    }
  }, [sessionId, currentPath, uploadFile]);

  const clearError = useCallback((fileName: string) => {
    setState(prev => {
      const newErrors = new Map(prev.errors);
      const newProgress = new Map(prev.uploadProgress);
      newErrors.delete(fileName);
      newProgress.delete(fileName);
      return { ...prev, errors: newErrors, uploadProgress: newProgress };
    });
  }, []);

  return {
    ...state,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    uploadFile,
    clearError,
  };
}
