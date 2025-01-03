import { Database } from '../types/database.types.js'
import { WebsiteService } from './website.service.js'
import { LoggerService } from './logger.service.js'
import { supabase } from '../lib/supabase.js'
import { config } from '../config/env.js'

// Initialize Supabase client with service role key for admin access
// const supabase = createClient<Database>(
//   config.supabase.url,
//   config.supabase.serviceRoleKey,
//   {
//     auth: {
//       autoRefreshToken: false,
//       persistSession: false
//     }
//   }
// );

export class DownloadService {
  static async createDownload(url: string, userId: string) {
    LoggerService.info('Creating new download', { url, userId })

    try {
      const { data: download, error } = await supabase
        .from('downloads')
        .insert([
          {
            url,
            user_id: userId,
            status: 'pending',
            storage_path: `${userId}/downloads/`
          }
        ])
        .select()
        .single()

      if (error) {
        LoggerService.error('Failed to create download record', { error, url, userId })
        throw new Error(`Failed to create download: ${error.message}`)
      }

      LoggerService.info('Download record created', { downloadId: download.id, url, userId })

      // Start download process
      WebsiteService.downloadWebsite(url, download.id, userId)
        .catch(async (error) => {
          LoggerService.error('Download process failed', { error, downloadId: download.id })
          // Update download status to error if something goes wrong
          await supabase
            .from('downloads')
            .update({ status: 'failed' })
            .eq('id', download.id)
        })

      return download
    } catch (error) {
      LoggerService.error('Error in createDownload', { error, url, userId })
      throw error
    }
  }

  static async getDownload(id: string, userId: string) {
    LoggerService.debug('Fetching download', { downloadId: id, userId })

    try {
      const { data: download, error } = await supabase
        .from('downloads')
        .select('*')
        .eq('id', id)
        .eq('user_id', userId)
        .single()

      if (error) {
        LoggerService.error('Failed to fetch download', { error, downloadId: id, userId })
        throw new Error(`Failed to get download: ${error.message}`)
      }

      // Get download progress
      const progress = WebsiteService.getProgress(id)
      if (progress) {
        LoggerService.debug('Updating download status from progress', {
          downloadId: id,
          status: progress.status,
          progress
        })

        // Update download status based on progress
        await supabase
          .from('downloads')
          .update({ status: progress.status })
          .eq('id', id)

        download.status = progress.status
      }

      return download
    } catch (error) {
      LoggerService.error('Error in getDownload', { error, downloadId: id, userId })
      throw error
    }
  }

  static async listDownloads(userId: string) {
    LoggerService.debug('Listing downloads', { userId })

    try {
      const { data: downloads, error } = await supabase
        .from('downloads')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) {
        LoggerService.error('Failed to list downloads', { error, userId })
        throw new Error(`Failed to list downloads: ${error.message}`)
      }

      // Update status for each download based on progress
      for (const download of downloads) {
        const progress = WebsiteService.getProgress(download.id)
        if (progress) {
          download.status = progress.status
        }
      }

      return downloads
    } catch (error) {
      LoggerService.error('Error in listDownloads', { error, userId })
      throw error
    }
  }

  static async deleteDownload(id: string, userId: string) {
    LoggerService.debug('Deleting download', { downloadId: id, userId })

    try {
      // Get the download first to get the storage_path
      const { data: download, error: fetchError } = await supabase
        .from('downloads')
        .select('storage_path')
        .eq('id', id)
        .eq('user_id', userId)
        .single()

      if (fetchError) {
        throw new Error(`Failed to fetch download: ${fetchError.message}`)
      }

      // Delete files from storage
      if (download?.storage_path) {
        const { error: storageError } = await supabase.storage
          .from(config.supabase.storage.bucket)
          .remove([download.storage_path])

        if (storageError) {
          LoggerService.error('Failed to delete storage files', { error: storageError, downloadId: id })
        }
      }

      // Delete download record
      const { error } = await supabase
        .from('downloads')
        .delete()
        .eq('id', id)
        .eq('user_id', userId)

      if (error) {
        LoggerService.error('Failed to delete download', { error, downloadId: id, userId })
        throw new Error(`Failed to delete download: ${error.message}`)
      }

      LoggerService.info('Download deleted', { downloadId: id, userId })
    } catch (error) {
      LoggerService.error('Error in deleteDownload', { error, downloadId: id, userId })
      throw error
    }
  }

  static async cancelDownload(id: string, userId: string) {
    LoggerService.debug('Canceling download', { downloadId: id, userId })

    try {
      // Update download status to canceled
      const { error } = await supabase
        .from('downloads')
        .update({ status: 'failed' })
        .eq('id', id)
        .eq('user_id', userId)

      if (error) {
        LoggerService.error('Failed to cancel download', { error, downloadId: id, userId })
        throw new Error(`Failed to cancel download: ${error.message}`)
      }

      LoggerService.info('Download canceled', { downloadId: id, userId })
    } catch (error) {
      LoggerService.error('Error in cancelDownload', { error, downloadId: id, userId })
      throw error
    }
  }
}
