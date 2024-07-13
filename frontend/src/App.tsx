import LoadingDots from './components/LoadingDots';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import calendar from 'dayjs/plugin/calendar';

dayjs.extend(calendar);

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
  checkedAt: string;
};

async function fetchStatus(serverName: string): Promise<ServerInfo> {
  const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/status/${serverName}`);

  if (response.status === 404) {
    throw new Error('Not found')
  }

  const data = await response.json();

  return data
}

function getStatusText(status: ServerStatus | undefined) {
  switch (status) {
    case ServerStatus.Online:
      return <>Spifftopia is currently <span className="text-green-400">online!</span></>
    case ServerStatus.Offline:
      return <>Spifftopia is currently <span className="text-red-400">offline.</span></>
    case ServerStatus.Maintenance:
      return <>Spifftopia is currently <span className="text-orange-400">under maintenance.</span></>
    case ServerStatus.Unknown:
      return <>The status of Spifftopia is currently unknown.</>
  }
}

function getCheckedAt(timestamp: string |undefined) {
  if (!timestamp) return null
  return dayjs(timestamp).calendar(null, {
    sameDay: "[today at] HH:mm:ss",
    nextDay: "[tomorrow at] HH:mm:ss",
    nextWeek: "dddd [at] HH:mm:ss",
    lastDay: "[yesterday at] HH:mm:ss",
    lastWeek: "[last] dddd [at] HH:mm:ss",
    sameElse: "YYYY-MM-DD",
  })
}

export default function Home() {
  const query = useQuery({
    queryKey: ['status', 'spifftopia'],
    queryFn: ({ queryKey }) => fetchStatus(queryKey[1]),
    refetchInterval: 30 * 1000,
    refetchIntervalInBackground: true,
    retry: true
  });

  const statusText = getStatusText(query.data?.status)
  const checkedAt = getCheckedAt(query.data?.checkedAt)

  return (
    <main className="min-h-screen flex justify-center items-center">
      <div className="space-y-6">
        {(query.isLoading || query.isError) ? (
          <h1 className="text-5xl">
            Investigating
            <LoadingDots />
          </h1>
        ) : (
          <>
            <h1 className="text-5xl">
              {statusText}
            </h1>
            {query.data?.status === ServerStatus.Online && (
              <p className="text-2xl">
                There are{' '}
                <span className="text-sky-400">{query.data?.queue}</span> in queue
                and the estimated queue time is{' '}
                <span className="text-sky-400">
                  {query.data?.queueTime?.minutes} minutes
                </span>{' '}
                and{' '}
                <span className="text-sky-400">
                  {query.data?.queueTime?.seconds} seconds
                </span>.
              </p>
            )}
            <p>Last checked {checkedAt}</p>
          </>
        )}
      </div>
    </main>
  );
}
