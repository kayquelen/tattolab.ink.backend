import type { Database } from '../types/database.types.js'
import { LoggerService } from './logger.service.js'
import { config } from '../config/env.js'
import { DownloadProgress } from '../types/download.types.js'
import { SingleBar } from 'cli-progress'
import { exec } from 'child_process'
import { promisify } from 'util'
import { join } from 'path'
import { mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { supabase } from '../lib/supabase.js'
import PQueue from 'p-queue'
import axios from 'axios'
import fs from 'fs'
import path from 'path'

// Queue for managing concurrent downloads
const downloadQueue = new PQueue({ concurrency: 2 });

export class WebsiteService {
  private static progressMap = new Map<string, DownloadProgress>();

  static getProgress(downloadId: string): DownloadProgress | undefined {
    return this.progressMap.get(downloadId);
  }

  static async downloadWebsite(url: string, downloadId: string, userId: string): Promise<void> {
    const startTime = Date.now();
    const tempDir = await mkdtemp(join(tmpdir(), 'website-download-'));

    // Initialize progress
    this.progressMap.set(downloadId, {
      totalFiles: 0,
      downloadedFiles: 0,
      status: 'pending'
    });

    LoggerService.info('Starting website download', {
      downloadId,
      userId,
      url
    });

    try {
      await downloadQueue.add(async () => {
        // Update status to processing
        this.progressMap.set(downloadId, {
          ...this.getProgress(downloadId)!,
          status: 'processing'
        });

        // Update download status in database
        await supabase
          .from('downloads')
          .update({ status: 'processing' })
          .eq('id', downloadId);

        LoggerService.info('Download in progress', {
          downloadId,
          status: 'processing'
        });

        // Validate URL
        try {
          const response = await axios.head(url);
          if (response.status !== 200) {
            throw new Error(`Site returned status code ${response.status}`);
          }
        } catch (error: any) {
          if (error.code === 'ERR_TLS_CERT_ALTNAME_INVALID') {
            throw new Error('Site não encontrado ou certificado SSL inválido. Verifique se a URL está correta.');
          }
          if (error.code === 'ENOTFOUND') {
            throw new Error('Site não encontrado. Verifique se a URL está correta.');
          }
          throw error;
        }

        // Download file
        const response = await axios({
          method: 'GET',
          url: url,
          responseType: 'arraybuffer'
        });

        // Get filename from URL or Content-Disposition header
        let filename = path.basename(url);
        const contentDisposition = response.headers['content-disposition'];
        if (contentDisposition) {
          const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(contentDisposition);
          if (matches != null && matches[1]) {
            filename = matches[1].replace(/['"]/g, '');
          }
        }

        // Save file
        const filePath = join(tempDir, filename);
        fs.writeFileSync(filePath, response.data);

        LoggerService.info('File downloaded', {
          downloadId,
          filename,
          size: response.data.length
        });

        // Update status to processing for upload
        this.progressMap.set(downloadId, {
          ...this.getProgress(downloadId)!,
          status: 'processing',
          downloadedFiles: 1,
          totalFiles: 1
        });

        // Upload file to Supabase Storage
        try {
          const storagePath = `${userId}/downloads/${downloadId}/${filename}`;

          LoggerService.info('Uploading file to storage', {
            downloadId,
            filename,
            storagePath
          });

          const { error: uploadError } = await supabase.storage
            .from(config.supabase.storage.bucket)
            .upload(storagePath, response.data, {
              contentType: response.headers['content-type'] || 'application/octet-stream'
            });

          if (uploadError) {
            throw uploadError;
          }

          // Update download record with storage path
          await supabase
            .from('downloads')
            .update({
              status: 'completed',
              storage_path: storagePath
            })
            .eq('id', downloadId);

          // Update progress status to completed
          this.progressMap.set(downloadId, {
            ...this.getProgress(downloadId)!,
            status: 'completed'
          });

          const duration = Date.now() - startTime;
          LoggerService.info('Download complete', {
            downloadId,
            filename,
            size: response.data.length,
            duration
          });
        } catch (error) {
          LoggerService.error('Upload error', {
            downloadId,
            error
          });
          throw error;
        }

        // Clean up temp directory
        await rm(tempDir, { recursive: true, force: true });
      });
    } catch (error) {
      // Update status to failed
      this.progressMap.set(downloadId, {
        ...this.getProgress(downloadId)!,
        status: 'failed'
      });

      // Update download status in database
      await supabase
        .from('downloads')
        .update({ status: 'failed' })
        .eq('id', downloadId);

      LoggerService.error('Download error occurred', {
        downloadId,
        error
      });

      // Clean up temp directory
      if (fs.existsSync(tempDir)) {
        await rm(tempDir, { recursive: true, force: true });
      }

      throw error;
    }
  }
}
