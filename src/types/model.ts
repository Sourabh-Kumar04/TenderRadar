export type ModelLoadStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface ModelProgressInfo {
  status: ModelLoadStatus;
  progress: number; // 0 - 100
  file?: string;
  loadedBytes?: number;
  totalBytes?: number;
  errorMessage?: string;
}
