import Replicate from 'replicate'
import dotenv from 'dotenv'
dotenv.config()

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
  userAgent: 'https://www.npmjs.com/package/create-replicate'
})
const model = 'fofr/sdxl-fresh-ink:8515c238222fa529763ec99b4ba1fa9d32ab5d6ebc82b4281de99e4dbdcec943'
const input = {
  width: 1024,
  height: 1024,
  prompt: 'A fresh ink TOK tattoo',
  refine: 'expert_ensemble_refiner',
  scheduler: 'K_EULER',
  lora_scale: 0.6,
  num_outputs: 1,
  guidance_scale: 7.5,
  apply_watermark: false,
  high_noise_frac: 0.9,
  negative_prompt: 'ugly, broken, distorted',
  prompt_strength: 0.8,
  num_inference_steps: 25,
}

console.log('Using model: %s', model)
console.log('With input: %O', input)

console.log('Running...')
const output = await replicate.run(model, { input })
console.log('Done!', output)
