// backend/src/config/replicate.ts
import fp from 'fastify-plugin';
import Replicate from 'replicate';

declare module 'fastify' {
  interface FastifyInstance {
    replicate: Replicate;
  }
}

export default fp(async (fastify) => {
  if (!fastify.hasDecorator('replicate')) {
    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN,
      userAgent: 'https://www.npmjs.com/package/create-replicate'
    });

    fastify.decorate('replicate', replicate);
    console.log('Replicate configured with token:', process.env.REPLICATE_API_TOKEN?.slice(0, 6) + '...');
  }
});