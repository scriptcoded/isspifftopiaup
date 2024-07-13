import Fastify, { type FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import httpErrors from 'http-errors';
import * as path from 'node:path';

import { checkServer, type ServerInfo, ServerStatus } from './checker.js';
import { downloadProfile, uploadProfile } from './profileStorage.js';

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

const profilesFolder = path.resolve('.minecraft');
await downloadProfile(profilesFolder);

function checkAndStoreServer(name: string, server: ServerConfig) {
  console.log('##### Running checker!');
  checkServer(profilesFolder, server.host, server.port)
    .then((info) => {
      console.log('##### Checker done!');
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

fastify.get('/', (request, reply) => {
  reply.send({
    alive: true,
  });
});

// Declare a route
fastify.get('/status/:serverName', (request: StatusRequest, reply) => {
  const { serverName } = request.params;
  const info = serverInfos.get(serverName);

  if (!info) {
    throw new httpErrors.NotFound();
  }

  reply.send(info);

  // reply.send({
  //   status: ServerStatus.Online,
  //   queue: 412,
  //   queueTime: {
  //     minutes: 102,
  //     seconds: 30,
  //   },
  //   checkedAt: new Date(),
  //   message: null,
  // } satisfies ServerInfo);
});

// Run the server!
fastify.listen({ port: 4000, host: '0.0.0.0' }, (err, address) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }

  console.log(`Server is now listening on ${address}`);
});
