import Fastify, { type FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import httpErrors from 'http-errors';

import { checkServer, type ServerInfo, ServerStatus } from './checker.js';

const fastify = Fastify({
  logger: true,
});
await fastify.register(cors);

type ServerConfig = {
  host: string;
  port?: number;
  interval: number;
};

const servers = new Map<string, ServerConfig>([
  [
    'spifftopia',
    {
      host: 'test.spifftopia.net',
      interval: 60 * 2,
    },
  ],
]);

const serverInfos = new Map<string, ServerInfo>();

type StatusRequest = FastifyRequest<{
  Params: {
    serverName: string;
  };
}>;

function checkAndStoreServer(name: string, server: ServerConfig) {
  console.log('##### Running checker!')
  checkServer(server.host, server.port)
    .then((info) => {
      console.log('##### Checker done!')
      serverInfos.set(name, info);
    })
    .catch((err) => {
      console.error(`Error while checking ${name}:`, err);
      serverInfos.set(name, {
        status: ServerStatus.Unknown,
        message: 'Failed checking server',
        queue: null,
        queueTime: null,
        checkedAt: new Date(),
      });
    });
}

for (const [name, server] of servers.entries()) {
  setInterval(() => {
    checkAndStoreServer(name, server);
  }, server.interval * 1000);
  checkAndStoreServer(name, server);
}

// Declare a route
fastify.get('/status/:serverName', (request: StatusRequest, reply) => {
  const { serverName } = request.params;
  const info = serverInfos.get(serverName);

  if (!info) {
    throw new httpErrors.NotFound();
  }

  reply.send(info);
});

// Run the server!
fastify.listen({ port: 4000 }, (err, address) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }

  console.log(`Server is now listening on ${address}`);
});
