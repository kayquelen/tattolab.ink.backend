import { FastifyInstance } from 'fastify';
import { ReplicateService } from '../services/replicate.service.js';
import { LoggerService } from '../services/logger.service.js';
import type { ReplicateInput } from '../services/replicate.service.js';

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
      ai_generations: {
        Row: {
          id: string
          created_at: string
          user_id: string
          mask: string | null
          seed: number | null
          image: string | null
          width: number
          height: number
          prompt: string
          negative_prompt: string | null
          refine: string | null
          scheduler: string | null
          lora_scale: number | null
          num_outputs: number
          refine_steps: number | null
          guidance_scale: number | null
          apply_watermark: boolean
          high_noise_frac: number | null
          prompt_strength: number | null
          num_inference_steps: number
          disable_safety_checker: boolean
          output_urls: string[]
          status: string
          error: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          user_id: string
          mask?: string | null
          seed?: number | null
          image?: string | null
          width: number
          height: number
          prompt: string
          negative_prompt?: string | null
          refine?: string | null
          scheduler?: string | null
          lora_scale?: number | null
          num_outputs: number
          refine_steps?: number | null
          guidance_scale?: number | null
          apply_watermark: boolean
          high_noise_frac?: number | null
          prompt_strength?: number | null
          num_inference_steps: number
          disable_safety_checker: boolean
          output_urls?: string[]
          status?: 'pending' | 'processing' | 'completed' | 'failed'
          error?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          user_id?: string
          mask?: string | null
          seed?: number | null
          image?: string | null
          width?: number
          height?: number
          prompt?: string
          negative_prompt?: string | null
          refine?: string | null
          scheduler?: string | null
          lora_scale?: number | null
          num_outputs?: number
          refine_steps?: number | null
          guidance_scale?: number | null
          apply_watermark?: boolean
          high_noise_frac?: number | null
          prompt_strength?: number | null
          num_inference_steps?: number
          disable_safety_checker?: boolean
          output_urls?: string[]
          status?: 'pending' | 'processing' | 'completed' | 'failed'
          error?: string | null
        }
      }
    }
  }
}

export type Generation = Database['public']['Tables']['ai_generations']['Row']
export type GenerationInput = Database['public']['Tables']['ai_generations']['Insert']
export interface GenerationWithSignedUrls extends Generation {
  urls?: string[]
}

export interface GenerateImageInput {
  prompt: string
  negative_prompt: string | null
  width: number
  height: number
  num_inference_steps: number
  guidance_scale: number | null
  high_noise_frac: number | null
  apply_watermark: boolean
  disable_safety_checker: boolean
  num_outputs: number
  refine?: string | null
  scheduler?: string | null
  lora_scale?: number | null
}

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

        const input: ReplicateInput = {
          prompt: request.body.prompt,
          negative_prompt: request.body.negative_prompt || undefined,
          width: request.body.width,
          height: request.body.height
        };

        const result = await service.generateImage(input, userId);
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
          .from('ai_generations')
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

                    const { data, error } = await fastify.supabase
                      .storage
                      .from('pages')
                      .createSignedUrl(path, 60 * 60 * 24);

                    const signedUrl = data?.signedUrl;
                    if (!signedUrl) {
                      return null;
                    }

                    return signedUrl;
                  } catch (error: any) {
                    LoggerService.error('❌ URL signing error:', error);
                    return null;
                  }
                })
              );

              const validUrls = signedUrls.filter((url: string | null): url is string => url !== null);

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
          hasUrls: generationsWithUrls.some((g: GenerationWithSignedUrls) => g.urls && g.urls.length > 0)
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