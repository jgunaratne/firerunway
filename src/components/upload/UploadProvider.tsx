'use client';

import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useUserData } from '@/lib/UserDataContext';

interface UploadJob {
  filename: string;
  jobId?: string;
  status: 'queued' | 'parsing' | 'storing' | 'done' | 'error';
  error?: string;
  result?: {
    broker?: string;
    totalValue?: number;
    holdingsCount?: number;
    error?: string;
  } | null;
}

interface UploadContextValue {
  jobs: UploadJob[];
  uploading: boolean;
  startUpload: (files: File[]) => Promise<void>;
  dismiss: (jobId: string) => void;
  clearAll: () => void;
}

const UploadContext = createContext<UploadContextValue | null>(null);

export function useUpload() {
  const ctx = useContext(UploadContext);
  if (!ctx) throw new Error('useUpload must be used within UploadProvider');
  return ctx;
}

export function UploadProvider({ children }: { children: ReactNode }) {
  const { uid } = useUserData();
  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const [uploading, setUploading] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const startPolling = useCallback(() => {
    if (pollingRef.current) return;
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/statements/jobs?uid=${uid}`);
        const data = await res.json();
        setJobs(data.jobs);

        const allDone = data.jobs.every((j: UploadJob) => j.status === 'done' || j.status === 'error');
        if (allDone && data.jobs.length > 0) {
          setUploading(false);
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = undefined;
          }
        }
      } catch {
        // Silently fail polling
      }
    }, 2000);
  }, [uid]);

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const startUpload = useCallback(async (files: File[]) => {
    setUploading(true);
    try {
      const formData = new FormData();
      files.forEach((f) => formData.append('files', f));

      const res = await fetch(`/api/statements/upload?uid=${uid}`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Upload failed: ${text}`);
      }

      const data = await res.json();
      setJobs(data.jobs);
      startPolling();
    } catch (err) {
      setJobs([{ filename: 'Upload', status: 'error', error: err instanceof Error ? err.message : 'Unknown error' }]);
      setUploading(false);
    }
  }, [uid, startPolling]);

  const dismiss = useCallback(async (jobId: string) => {
    setJobs((prev) => prev.filter((j) => j.jobId !== jobId));
    try {
      await fetch(`/api/statements/jobs/${jobId}`, { method: 'DELETE' });
    } catch {
      // Ignore dismiss errors
    }
  }, []);

  const clearAll = useCallback(() => {
    setJobs([]);
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = undefined;
    }
    setUploading(false);
  }, []);

  return (
    <UploadContext.Provider value={{ jobs, uploading, startUpload, dismiss, clearAll }}>
      {children}
    </UploadContext.Provider>
  );
}
