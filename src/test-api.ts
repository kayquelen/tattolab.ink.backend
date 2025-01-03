import fastify from 'fastify';

const server = fastify();

// Registrar parser JSON
server.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
  try {
    const json = JSON.parse(body);
    done(null, json);
  } catch (err) {
    done(err);
  }
});

// Rota de teste
server.post('/test', async (request, reply) => {
  console.log('Headers:', request.headers);
  console.log('Body:', request.body);
  return { success: true, received: request.body };
});

// Iniciar servidor
const start = async () => {
  try {
    await server.listen({ port: 54976, host: '0.0.0.0' });
    console.log('Server running on port 54976');
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

start();