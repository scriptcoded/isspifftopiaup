import mc, { Server } from 'minecraft-protocol';
import nbt from 'prismarine-nbt';

export enum ServerStatus {
  Online = 'Online',
  Offline = 'Offline',
  Maintenance = 'Maintenance',
  Unknown = 'Unknown',
}

export type QueueTime = {
  minutes: number;
  seconds: number;
};

export type ServerInfo = {
  status: ServerStatus;
  queue: number | null;
  message: string | null;
  queueTime: QueueTime | null;
  checkedAt: Date;
};

const WAIT_REGEX = /(?:(\d+):)?(\d+)/;
const TOTAL_TIMEOUT = 90;
const LIMBO_TIMEOUT = 60;

function parsePosition(position: string) {
  return Number.parseInt(position.replace(/\D*/g, ''), 10);
}

function parseWait(wait: string) {
  const match = wait.match(WAIT_REGEX);

  if (!match) return null;

  const minutes = Number.parseInt(match[1], 10);
  const seconds = Number.parseInt(match[2], 10);

  return {
    minutes,
    seconds,
  };
}

export function checkServer(host: string, port = 25565): Promise<ServerInfo> {
  const info: ServerInfo = {
    status: ServerStatus.Unknown,
    queue: null,
    message: null,
    queueTime: null,
    checkedAt: new Date(),
  };

  return new Promise((resolve, reject) => {
    const client = mc.createClient({
      host,
      port,
      version: '1.20.4',
      username: 'wildevy',
      auth: 'microsoft',
    });

    let finishedGracefully = false;
    let inLimbo = false;

    const timeoutTimer = setTimeout(() => {
      if (!finishedGracefully) {
        info.status = ServerStatus.Unknown;
        info.message = `Received no expected status within ${TOTAL_TIMEOUT} seconds`;
        resolveGracefully();
      }
    }, TOTAL_TIMEOUT * 1000);
    let limboTimer: NodeJS.Timeout;

    const resolveGracefully = () => {
      finishedGracefully = true;

      clearTimeout(timeoutTimer);
      clearTimeout(limboTimer);

      client.end();
      resolve(info);
    };

    const rejectGracefully = (error: unknown) => {
      clearTimeout(timeoutTimer);
      client.end();
      reject(error);
    };

    client.on('connect', () => {
      console.log('Connected!');
    });

    client.on('end', (reason) => {
      console.log('Client ended. Reason:', reason);

      if (!finishedGracefully) {
        setTimeout(() => {
          if (!finishedGracefully) {
            info.status = ServerStatus.Unknown;
            info.message = `Disconnected: ${reason}`;
            resolveGracefully();
          }
        }, 500);
      }
    });

    client.on('state', (newState) => {
      console.log('State:', newState);
    });

    client.on('systemChat', ({ formattedMessage }) => {
      const compound = nbt.simplify(nbt.string(JSON.parse(formattedMessage)));
      const { text } = compound;

      console.log('systemChat:', compound);

      if (text.includes('queue') && !inLimbo) {
        inLimbo = true;

        limboTimer = setTimeout(() => {
          info.status = ServerStatus.Online;
          info.queue = -1;
          resolveGracefully();
        }, LIMBO_TIMEOUT * 1000);
        return;
      }
    });

    client.on('playerChat', (data) => {
      console.log('playerChat:', data);
    });

    client.on('packet', (data, packetMeta, buffer, fullBuffer) => {
      if (packetMeta.name === 'disconnect') {
        const compound = nbt.comp(data.reason.value);
        const simplified = nbt.simplify(compound);
        const text = simplified?.extra?.[0]?.text;

        if (text?.toLowerCase().includes('maintenance')) {
          info.status = ServerStatus.Maintenance;
          resolveGracefully();
          return;
        }
      }

      if (packetMeta.name === 'action_bar') {
        const compound = nbt.comp(data);
        const simplified = nbt.simplify(compound);

        console.log('Action bar:', JSON.stringify(simplified));

        const [positionText, _, waitText] = simplified.text.extra;

        const position = parsePosition(positionText.text);
        const wait = parseWait(waitText.text);

        info.status = ServerStatus.Online;
        info.queue = position - 1;
        info.queueTime = wait;
        resolveGracefully();
        return;
      }

      console.log('Packet:', packetMeta, JSON.stringify(data));
    });

    client.on('error', (error) => {
      if (error instanceof AggregateError) {
        const connectionRefused = error.errors.some(
          (err) => 'code' in err && err.code === 'ECONNREFUSED',
        );
        if (connectionRefused) {
          info.status = ServerStatus.Offline;
          resolveGracefully;
          return;
        }
      }
      rejectGracefully(error);
    });
  });
}
