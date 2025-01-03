import { FastifyRequest as OriginalFastifyRequest } from 'fastify'
import { User } from '@supabase/supabase-js'

declare module 'fastify' {
  interface FastifyRequest extends OriginalFastifyRequest {
    user: User
  }
}
