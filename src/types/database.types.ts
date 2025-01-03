export interface Database {
  public: {
    Tables: {
      downloads: {
        Row: {
          id: string
          user_id: string
          url: string
          status: 'pending' | 'processing' | 'completed' | 'failed'
          storage_path: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          url: string
          status?: 'pending' | 'processing' | 'completed' | 'failed'
          storage_path?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          url?: string
          status?: 'pending' | 'processing' | 'completed' | 'failed'
          storage_path?: string
          created_at?: string
        }
      }
      files: {
        Row: {
          id: string
          download_id: string
          path: string
          size: number
          created_at: string
        }
        Insert: {
          id?: string
          download_id: string
          path: string
          size: number
          created_at?: string
        }
        Update: {
          id?: string
          download_id?: string
          path?: string
          size?: number
          created_at?: string
        }
      }
    }
  }
}
