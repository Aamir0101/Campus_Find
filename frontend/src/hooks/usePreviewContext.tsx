import { createContext, useContext, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { setPreviewStateMode } from '../services/apiClient';
import type { PreviewStateMode } from '../types/domain';

interface PreviewContextValue {
  previewStateMode: PreviewStateMode;
  changePreviewStateMode: (mode: PreviewStateMode) => void;
}

const PreviewContext = createContext<PreviewContextValue | null>(null);

export function PreviewStateProvider({ children }: { children: ReactNode }) {
  const [previewStateMode, setMode] = useState<PreviewStateMode>('populated');
  const queryClient = useQueryClient();

  const changePreviewStateMode = (mode: PreviewStateMode) => {
    setMode(mode);
    setPreviewStateMode(mode);
    void queryClient.invalidateQueries();
  };

  return (
    <PreviewContext.Provider value={{ previewStateMode, changePreviewStateMode }}>
      {children}
    </PreviewContext.Provider>
  );
}

export function usePreviewState() {
  const ctx = useContext(PreviewContext);
  if (!ctx) {
    throw new Error('usePreviewState must be used within PreviewStateProvider');
  }
  return ctx;
}
