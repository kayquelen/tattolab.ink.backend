// backend/src/services/replicate.service.ts
import { FastifyInstance } from 'fastify';

interface GenerateImageInput {
  prompt: string;
  width?: number;
  height?: number;
  negative_prompt?: string;
}

export class ReplicateService {
  private MODEL = "fofr/sdxl-fresh-ink:8515c238222fa529763ec99b4ba1fa9d32ab5d6ebc82b4281de99e4dbdcec943";

  constructor(private fastify: FastifyInstance) {
    console.log('ReplicateService initialized');
    console.log('Fastify instance:', !!this.fastify);
    console.log('Replicate available:', !!this.fastify.replicate);
    console.log('Supabase available:', !!this.fastify.supabase);
  }

  async generateImage(input: GenerateImageInput, userId: string) {
    console.log('=== Starting generateImage ===');
    console.log('Input:', JSON.stringify(input, null, 2));
    console.log('UserId:', userId);
    console.log('Fastify instance available:', !!this.fastify);
    console.log('Replicate instance:', this.fastify.replicate);

    let generationId: string | null = null;

    try {
      console.log('Creating initial database record...');

      // Primeiro, criar o registro no banco com status 'pending'
      const { data: generation, error: dbError } = await this.fastify.supabase
        .from('ai_generations')
        .insert({
          user_id: userId,
          prompt: input.prompt,
          negative_prompt: input.negative_prompt,
          width: input.width || 1024,
          height: input.height || 1024,
          refine: "expert_ensemble_refiner",
          scheduler: "K_EULER",
          lora_scale: 0.6,
          num_outputs: 1,
          guidance_scale: 7.5,
          apply_watermark: false,
          high_noise_frac: 0.9,
          prompt_strength: 0.8,
          num_inference_steps: 25,
          status: 'pending'
        })
        .select()
        .single();

      if (dbError) {
        console.error('Database error:', dbError);
        throw new Error(`Failed to create generation record: ${dbError.message}`);
      }

      console.log('Database record created:', generation);
      generationId = generation.id;

      console.log('Starting Replicate generation...');
      console.log('Model:', this.MODEL);

      // Gerar imagem com Replicate
      const output = await this.fastify.replicate.run(
        this.MODEL,
        {
          input: {
            width: input.width || 1024,
            height: input.height || 1024,
            prompt: input.prompt,
            refine: "expert_ensemble_refiner",
            scheduler: "K_EULER",
            lora_scale: 0.6,
            num_outputs: 1,
            guidance_scale: 7.5,
            apply_watermark: false,
            high_noise_frac: 0.9,
            negative_prompt: input.negative_prompt || "ugly, broken, distorted, nsfw, inappropriate content",
            prompt_strength: 0.8,
            num_inference_steps: 25
          }
        }
      );

      console.log('Replicate output received:', output);
      const output_urls = [];
      let index = 0;

      // Processar cada stream de output
      console.log('Processing output streams...');
      for (const stream of output) {
        console.log('Processing stream:', typeof stream);
        if (stream instanceof ReadableStream) {
          console.log('Stream is ReadableStream');
          const reader = stream.getReader();
          const chunks = [];

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
          }

          const buffer = Buffer.concat(chunks);
          const filename = `generations/${userId}/tattoo_${Date.now()}_${index}.png`;

          console.log('Uploading to Storage:', filename);

          // Upload para o Storage
          const { data: storageData, error: storageError } = await this.fastify.supabase
            .storage
            .from(this.fastify.config.supabase.storage.bucket)
            .upload(filename, buffer, {
              contentType: 'image/png',
              cacheControl: '3600',
              upsert: false
            });

          if (storageError) {
            console.error('Storage error:', storageError);
            throw new Error(`Failed to upload to storage: ${storageError.message}`);
          }

          console.log('Upload successful:', storageData);

          // Gerar URL assinada ao invés de pública
          const { data: { signedUrl } } = await this.fastify.supabase
            .storage
            .from(this.fastify.config.supabase.storage.bucket)
            .createSignedUrl(filename, 60 * 60 * 24 * 7); // 7 dias de expiração

          console.log('Signed URL generated:', signedUrl);
          output_urls.push(signedUrl);
          index++;
        }
      }

      console.log('All streams processed');
      console.log('Updating database record...');

      // Atualizar registro com URLs e status
      const { data: updatedGeneration, error: updateError } = await this.fastify.supabase
        .from('ai_generations')
        .update({
          output_urls,
          status: 'completed'
        })
        .eq('id', generationId)
        .select()
        .single();

      if (updateError) {
        console.error('Update error:', updateError);
        throw new Error(`Failed to update generation: ${updateError.message}`);
      }

      console.log('Database record updated:', updatedGeneration);

      return {
        success: true,
        id: updatedGeneration.id,
        urls: output_urls,
        prompt: input.prompt,
        status: 'completed',
        created_at: updatedGeneration.created_at
      };

    } catch (error) {
      console.error('=== Generation failed ===');
      console.error('Error details:', error);
      console.error('Stack trace:', error.stack);

      // Se temos um ID de geração, atualizar com erro
      if (generationId) {
        console.log('Updating generation with error status...');
        await this.fastify.supabase
          .from('ai_generations')
          .update({
            status: 'error',
            error: error.message
          })
          .eq('id', generationId);
      }

      throw error;
    }
  }

  async saveGeneration(params: any, userId: string, outputUrls: string[]) {
    const { data, error } = await this.fastify.supabase
      .from('ai_generations')
      .insert({
        user_id: userId,
        prompt: params.prompt,
        negative_prompt: params.negative_prompt,
        width: params.width,
        height: params.height,
        output_urls: outputUrls,
        status: 'completed'
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  }
}