'use client';

import { useCallback, useState, useRef } from 'react';
import { useUpload } from './UploadProvider';

export default function UploadZone() {
  const { startUpload, uploading } = useUpload();
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const pdfFiles = Array.from(files).filter((f) => f.name.toLowerCase().endsWith('.pdf'));
    if (pdfFiles.length === 0) return;
    await startUpload(pdfFiles);
  }, [startUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!uploading) setIsDragActive(true);
  }, [uploading]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (!uploading && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, [uploading, handleFiles]);

  const handleClick = useCallback(() => {
    if (!uploading) fileInputRef.current?.click();
  }, [uploading]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
      e.target.value = '';
    }
  }, [handleFiles]);

  return (
    <div className="w-full">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        className={`
          glass-card p-12 text-center cursor-pointer transition-all duration-200
          ${isDragActive ? 'border-accent bg-accent/5 scale-[1.01]' : ''}
          ${uploading ? 'opacity-60 cursor-wait' : 'hover:border-accent/50'}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          multiple
          onChange={handleInputChange}
          className="hidden"
          disabled={uploading}
        />

        <div className="mb-6">
          <svg className="w-16 h-16 mx-auto text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>

        <h3 className="text-xl font-semibold text-text-primary mb-2">
          {isDragActive ? 'Drop your PDFs here' : 'Drop your brokerage PDF statements here'}
        </h3>
        <p className="text-text-secondary text-sm mb-6">
          or click to browse • Upload multiple at once
        </p>

        <div className="flex justify-center gap-3">
          {['Fidelity', 'Schwab', 'Vanguard', 'Webull'].map((broker) => (
            <span
              key={broker}
              className="px-3 py-1 rounded-full text-xs font-medium bg-bg-elevated text-text-secondary border border-border"
            >
              {broker}
            </span>
          ))}
        </div>
      </div>

      {uploading && (
        <div className="mt-4 glass-card p-4 text-center">
          <div className="flex items-center justify-center gap-2 text-sm text-text-secondary">
            <span className="inline-block w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            Processing in background — you can navigate away
          </div>
        </div>
      )}
    </div>
  );
}
