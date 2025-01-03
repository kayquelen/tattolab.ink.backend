import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { LoggerService } from '../services/logger.service.js';
import { supabase } from '../lib/supabase.js';

// Initialize Supabase client
// const supabase = createClient<Database>(
//   config.supabase.url,
//   config.supabase.anonKey
// );

export default async function authRoutes(fastify: FastifyInstance) {
  // Login route
  fastify.post('/login', {
    schema: {
      body: Type.Object({
        email: Type.String({ format: 'email' }),
        password: Type.String()
      }),
      response: {
        200: Type.Object({
          user: Type.Object({
            id: Type.String(),
            email: Type.String()
          }),
          session: Type.Object({
            access_token: Type.String(),
            refresh_token: Type.String(),
            expires_in: Type.Number()
          })
        })
      }
    }
  }, async (request, reply) => {
    const { email, password } = request.body as { email: string; password: string };

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        LoggerService.error('Login error', error);
        return reply.code(401).send({ error: error.message });
      }

      return reply.send({
        user: {
          id: data.user.id,
          email: data.user.email
        },
        session: {
          access_token: data.session?.access_token,
          refresh_token: data.session?.refresh_token,
          expires_in: data.session?.expires_in
        }
      });
    } catch (error) {
      LoggerService.error('Login error', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Register route
  fastify.post('/register', {
    schema: {
      body: Type.Object({
        email: Type.String({ format: 'email' }),
        password: Type.String()
      }),
      response: {
        200: Type.Object({
          user: Type.Object({
            id: Type.String(),
            email: Type.String()
          }),
          session: Type.Object({
            access_token: Type.String(),
            refresh_token: Type.String(),
            expires_in: Type.Number()
          })
        })
      }
    }
  }, async (request, reply) => {
    const { email, password } = request.body as { email: string; password: string };

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password
      });

      if (error) {
        LoggerService.error('Registration error', error);
        return reply.code(400).send({ error: error.message });
      }

      return reply.send({
        user: {
          id: data.user?.id,
          email: data.user?.email
        },
        session: {
          access_token: data.session?.access_token,
          refresh_token: data.session?.refresh_token,
          expires_in: data.session?.expires_in
        }
      });
    } catch (error) {
      LoggerService.error('Registration error', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}
