import fastify, { FastifyRequest } from 'fastify';

const server = fastify();

interface JSONParserDone {
  (err: Error | null, body?: unknown): void;
}

// Registrar parser JSON com tipos corretos
server.addContentTypeParser(
  'application/json',
  { parseAs: 'string' },
  (req: FastifyRequest, body: string, done: JSONParserDone) => {
    try {
      const json = JSON.parse(body);
      done(null, json);
    } catch (err) {
      done(err as Error);
    }
  }
);

// Interface para o body da requisição
interface TestRequestBody {
  [key: string]: unknown;
}

// Rota de teste com tipagem
server.post<{
  Body: TestRequestBody;
}>('/test', async (request, reply) => {
  console.log('Headers:', request.headers);
  console.log('Body:', request.body);

  return {
    success: true,
    received: request.body
  };
});

// Iniciar servidor
const start = async () => {
  try {
    await server.listen({ port: 54976, host: '0.0.0.0' });
    console.log('Server running on port 54976');
  } catch (err: unknown) {
    const error = err as Error;
    console.error(error);
    process.exit(1);
  }
};

start();