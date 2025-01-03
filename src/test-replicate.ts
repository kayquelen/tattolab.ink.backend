import 'dotenv/config';
import Replicate from "replicate";
import fs from 'fs/promises';
import path from 'path';

interface ReplicateInput {
  width: number;
  height: number;
  prompt: string;
  refine: string;
  scheduler: string;
  lora_scale: number;
  num_outputs: number;
  guidance_scale: number;
  apply_watermark: boolean;
  high_noise_frac: number;
  negative_prompt: string;
  prompt_strength: number;
  num_inference_steps: number;
}

async function testReplicate(): Promise<void> {
  try {
    console.log('Initializing Replicate...');
    console.log('API Token:', process.env.REPLICATE_API_TOKEN?.slice(0, 6) + '...');

    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN as string,
    });

    console.log('Replicate initialized, running model...');

    const MODEL = "fofr/sdxl-fresh-ink:8515c238222fa529763ec99b4ba1fa9d32ab5d6ebc82b4281de99e4dbdcec943" as const;

    const input: ReplicateInput = {
      width: 1024,
      height: 1024,
      prompt: "A minimalist line art tattoo of a small flower, fresh ink style",
      refine: "expert_ensemble_refiner",
      scheduler: "K_EULER",
      lora_scale: 0.6,
      num_outputs: 1,
      guidance_scale: 7.5,
      apply_watermark: false,
      high_noise_frac: 0.9,
      negative_prompt: "ugly, broken, distorted, nsfw, inappropriate content",
      prompt_strength: 0.8,
      num_inference_steps: 25
    };

    const output = await replicate.run(MODEL, { input });

    console.log('Generation completed!');

    // Criar diretório para as imagens se não existir
    const outputDir = path.join(process.cwd(), 'generated');
    await fs.mkdir(outputDir, { recursive: true });

    // Para cada stream no array de output
    let index = 0;
    const outputArray = Array.isArray(output) ? output : [output];

    for (const stream of outputArray) {
      if (stream instanceof ReadableStream) {
        console.log(`Processing stream ${index}...`);
        const reader = stream.getReader();
        const chunks: Uint8Array[] = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }

        // Concatenar todos os chunks em um único buffer
        const buffer = Buffer.concat(chunks);

        // Salvar o buffer como imagem
        const filename = path.join(outputDir, `tattoo_${Date.now()}_${index}.png`);
        await fs.writeFile(filename, buffer);
        console.log(`Image saved to: ${filename}`);
      }
      index++;
    }

  } catch (error: unknown) {
    console.error('Test failed:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
    } else {
      console.error('Unknown error occurred');
    }
  }
}

testReplicate().catch((error: unknown) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});