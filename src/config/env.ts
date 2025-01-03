import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { z } from 'zod'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '..', '..')

// Load environment variables from .env file
dotenv.config({ path: join(rootDir, '.env') })

// Validate required environment variables
const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_SUPABASE_STORAGE',
  'NEXT_PUBLIC_SUPABASE_BUCKET',
  'PORT',
  'REPLICATE_TOKEN'
]

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`)
  }
}

const configSchema = z.object({
  supabase: z.object({
    url: z.string(),
    anonKey: z.string().optional(),
    serviceRoleKey: z.string(),
    storage: z.object({
      url: z.string(),
      bucket: z.string()
    })
  }),
  server: z.object({
    port: z.number()
  }),
  replicateToken: z.string().min(1, 'Replicate API token is required')
  replicateToken: process.env.REPLICATE_TOKEN
  })

export const config = configSchema.parse({
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    storage: {
      url: process.env.NEXT_PUBLIC_SUPABASE_STORAGE,
      bucket: process.env.NEXT_PUBLIC_SUPABASE_BUCKET
    }
  },
  server: {
    port: Number(process.env.PORT)
  },
  replicate: {
    apiToken: process.env.REPLICATE_API_TOKEN
  }
})
