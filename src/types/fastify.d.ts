import { FastifyRequest as OriginalFastifyRequest, FastifyInstance } from 'fastify'
import { User, SupabaseClient } from '@supabase/supabase-js'
import type { Config } from '../config/env'

declare module 'fastify' {
  interface FastifyRequest extends OriginalFastifyRequest {
    user: User
  }

  interface FastifyInstance {
    supabase: SupabaseClient
    config: Config
  }
}


