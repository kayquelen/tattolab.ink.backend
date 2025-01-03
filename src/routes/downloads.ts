import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { DownloadService } from '../services/download.service.js';

export default async function downloadRoutes(fastify: FastifyInstance) {
  // Create a new download
  fastify.post('/downloads', {
    schema: {
      body: Type.Object({
        url: Type.String({ format: 'uri' })
      }),
      response: {
        200: Type.Object({
          id: Type.String(),
          url: Type.String(),
          status: Type.String(),
          storage_path: Type.String(),
          created_at: Type.String()
        })
      }
    }
  }, async (request, reply) => {
    const { url } = request.body as { url: string };
    const userId = request.user?.id;

    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const download = await DownloadService.createDownload(url, userId);
    return reply.send(download);
  });

  // Get a specific download
  fastify.get('/downloads/:id', {
    schema: {
      params: Type.Object({
        id: Type.String()
      }),
      response: {
        200: Type.Object({
          id: Type.String(),
          url: Type.String(),
          status: Type.String(),
          storage_path: Type.String(),
          created_at: Type.String()
        })
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.user?.id;

    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const download = await DownloadService.getDownload(id, userId);
    return reply.send(download);
  });

  // List all downloads for a user
  fastify.get('/downloads', {
    schema: {
      response: {
        200: Type.Array(Type.Object({
          id: Type.String(),
          url: Type.String(),
          status: Type.String(),
          storage_path: Type.String(),
          created_at: Type.String()
        }))
      }
    }
  }, async (request, reply) => {
    const userId = request.user?.id;

    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const downloads = await DownloadService.listDownloads(userId);
    return reply.send(downloads);
  });

  // Delete a download
  fastify.delete('/downloads/:id', {
    schema: {
      params: Type.Object({
        id: Type.String()
      })
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.user?.id;

    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    await DownloadService.deleteDownload(id, userId);
    return reply.send({ success: true });
  });

  // Cancel a download
  fastify.post('/downloads/:id/cancel', {
    schema: {
      params: Type.Object({
        id: Type.String()
      })
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.user?.id;

    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    await DownloadService.cancelDownload(id, userId);
    return reply.send({ success: true });
  });
}
