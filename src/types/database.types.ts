import { FastifyInstance } from 'fastify';
import { ReplicateService } from '../services/replicate.service.js';
import { LoggerService } from '../services/logger.service.js';
import { Database } from '../types/database';

type Generation = Database['public']['Tables']['generations']['Row'];
type GenerationInput = Database['public']['Tables']['generations']['Insert'];

const generateSchema = {
  body: {
    type: 'object',
    required: ['prompt'],
    properties: {
      prompt: { type: 'string' },
      negative_prompt: { type: 'string' },
      width: { type: 'number', default: 1024 },
      height: { type: 'number', default: 1024 },
      num_inference_steps: { type: 'number', default: 50 },
      guidance_scale: { type: 'number', default: 7.5 },
      high_noise_frac: { type: 'number', default: 0.8 },
      apply_watermark: { type: 'boolean', default: true }
    }
  }
};

export default async function aiRoutes(fastify: FastifyInstance) {
  const service = new ReplicateService(fastify);

  fastify.post<{
    Body: GenerationInput
  }>('/generate', {
    schema: generateSchema,
    handler: async (request, reply) => {
      try {
        const userId = request.user.id;
        LoggerService.info('Generate request received:', { userId, body: request.body });

        const result = await service.generateImage(request.body, userId);
        return reply.send(result);
      } catch (error: any) {
        LoggerService.error('Generate route error:', error);
        return reply.code(500).send({
          error: 'generation_failed',
          message: error?.message || 'Failed to generate image'
        });
      }
    }
  });

  fastify.get('/generations', {
    handler: async (request, reply) => {
      const userId = request.user.id;

      try {
        LoggerService.info('📋 Starting generations fetch', {
          userId,
          timestamp: new Date().toISOString()
        });

        const { data: generations, error } = await fastify.supabase
          .from('generations')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (error) {
          LoggerService.error('❌ Database query error:', error);
          throw error;
        }

        LoggerService.info('📦 Raw generations fetched:', {
          count: generations?.length || 0,
          firstItem: generations?.[0]
        });

        type GenerationWithSignedUrls = Generation & { urls?: string[] };

        const generationsWithUrls = await Promise.all(
          (generations || []).map(async (generation: Generation) => {
            LoggerService.info('🖼️ Processing generation:', {
              id: generation.id,
              hasOutputUrls: !!generation.output_urls
            });

            if (generation.output_urls?.length) {
              const signedUrls = await Promise.all(
                generation.output_urls.map(async (url: string) => {
                  try {
                    const path = url.split('pages/')[1];
                    LoggerService.info('🔐 Creating signed URL for:', { path });

                    const { data: { signedUrl }, error } = await fastify.supabase
                      .storage
                      .from('pages')
                      .createSignedUrl(path, 60 * 60 * 24);

                    if (error) {
                      LoggerService.error('❌ Signed URL creation failed:', error);
                      return null;
                    }

                    return signedUrl;
                  } catch (error: any) {
                    LoggerService.error('❌ URL signing error:', error);
                    return null;
                  }
                })
              );

              const validUrls = signedUrls.filter((url): url is string => url !== null);

              return {
                ...generation,
                urls: validUrls
              } as GenerationWithSignedUrls;
            }

            return {
              ...generation,
              urls: []
            } as GenerationWithSignedUrls;
          })
        );

        LoggerService.info('🎉 Generations processed successfully', {
          userId,
          totalCount: generationsWithUrls.length,
          hasUrls: generationsWithUrls.some(g => g.urls?.length > 0)
        });

        return reply.send(generationsWithUrls);

      } catch (error: any) {
        LoggerService.error('❌ Generation list error:', {
          userId,
          error: error?.message,
          stack: error?.stack
        });

        return reply.code(500).send({
          error: 'fetch_failed',
          message: error?.message || 'Failed to fetch generations'
        });
      }
    }
  });
}