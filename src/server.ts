import Fastify, { FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import { config } from './config/env.js';
import { LoggerService } from './services/logger.service.js';
import downloadRoutes from './routes/downloads.js';
import aiRoutes from './routes/ai.routes.js';
import { supabase } from './lib/supabase.js';
import { createClient, User } from '@supabase/supabase-js';
import replicateConfig from './config/replicate.js';

// Extender o tipo Request do Fastify para incluir o user
declare module 'fastify' {
  interface FastifyRequest {
    user: User;
  }
}

// Inicializar Fastify
const fastify = Fastify({
  logger: true
});

// Registrar Supabase como decorador
fastify.decorate('supabase', createClient(
  config.supabase.url,
  config.supabase.serviceRoleKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    },
    db: {
      schema: 'public'
    },
    global: {
      headers: {
        'X-Client-Info': 'tattoolab-backend'
      }
    }
  }
));

// Log para debug
console.log('Supabase Config:', {
  url: config.supabase.url,
  hasServiceKey: !!config.supabase.serviceRoleKey,
  storage: {
    url: config.supabase.storage.url,
    bucket: config.supabase.storage.bucket
  }
});

// Configurar parser JSON com tipos corretos
fastify.addContentTypeParser('application/json', { parseAs: 'string' }, (req: FastifyRequest, body: string, done) => {
  try {
    const json = JSON.parse(body);
    done(null, json);
  } catch (err) {
    done(err as Error); // Type assertion para Error
  }
});

// Configurar CORS
await fastify.register(cors, {
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://www.tattoolab.ink'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
});

// Adicionar config como decorador
fastify.decorate('config', config);

// Authentication middleware com tipos corretos
interface AuthError extends Error {
  message: string;
}

fastify.addHook('onRequest', async (request, reply) => {
  // Lista de rotas públicas que não precisam de autenticação
  const publicRoutes = ['/', '/health'];

  // Verifica se a rota atual é pública
  if (publicRoutes.includes(request.url)) {
    return;
  }

  try {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.split('Bearer').pop()?.trim();
    if (!token) {
      throw new Error('No token provided');
    }

    console.log('Auth Header:', authHeader);
    console.log('Token:', token);

    const supabaseClient = createClient(
      config.supabase.url,
      config.supabase.serviceRoleKey
    );

    const { data: { user }, error } = await supabaseClient.auth.getUser(token);

    if (error || !user) {
      throw new Error('Invalid user token');
    }

    request.user = user;

  } catch (error: unknown) {
    const authError = error as AuthError;
    console.error('Auth error:', authError);
    reply.code(401).send({
      error: 'unauthorized',
      message: authError.message || 'Authentication failed'
    });
  }
});

// Register Replicate plugin
await fastify.register(replicateConfig);

// Register routes
await fastify.register(downloadRoutes);
await fastify.register(aiRoutes, { prefix: '/api/ai' });

// Root route
fastify.get('/', async () => {
  return { status: 'ok', message: 'Clookit API is running!' };
});

// Health check route
fastify.get('/health', async () => {
  return { status: 'ok' };
});

// Start server
try {
  await fastify.listen({ port: config.server.port, host: '0.0.0.0' });
  LoggerService.info(`Server listening on port ${config.server.port}`);
} catch (err: unknown) {
  const error = err as Error;
  LoggerService.error('Error starting server', error);
  process.exit(1);
}