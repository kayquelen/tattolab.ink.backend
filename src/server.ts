import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from './config/env.js';
import { LoggerService } from './services/logger.service.js';
import downloadRoutes from './routes/downloads.js';
import aiRoutes from './routes/ai.routes.js';
import { supabase } from './lib/supabase.js';
import { createClient } from '@supabase/supabase-js';
import replicateConfig from './config/replicate.js';

// 1. Inicializar Fastify
const fastify = Fastify({
  logger: true
});

// 2. Registrar Supabase como decorador
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

// 3. Configurar parser JSON (sem os ":")
fastify.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
  try {
    const json = JSON.parse(body);
    done(null, json);
  } catch (err) {
    done(err);
  }
});

// 3. Configurar CORS
await fastify.register(cors, {
  origin: [
    'http://localhost:5173',
    'http://localhost:3000'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
});

// Adicionar antes do CORS
fastify.decorate('config', config);

// Authentication middleware
fastify.addHook('onRequest', async (request, reply) => {
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Extrair apenas o token, removendo qualquer prefixo
    const token = authHeader.split('Bearer').pop()?.trim();
    if (!token) {
      throw new Error('No token provided');
    }

    console.log('Auth Header:', authHeader);
    console.log('Extracted Token:', token);

    // Criar um novo cliente Supabase
    const supabaseClient = createClient(
      config.supabase.url,
      config.supabase.serviceRoleKey
    );

    // Verificar o token
    const { data: { user }, error } = await supabaseClient.auth.getUser(token);

    console.log('User:', user);
    console.log('Error:', error);

    if (error || !user) {
      throw new Error('Invalid user token');
    }

    // Attach user to request
    request.user = user;

  } catch (error) {
    console.error('Auth error:', error);
    reply.code(401).send({
      error: 'unauthorized',
      message: error.message
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
} catch (err) {
  LoggerService.error('Error starting server', err);
  process.exit(1);
}
