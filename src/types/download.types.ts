export interface DownloadProgress {
  totalFiles: number;
  downloadedFiles: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}
