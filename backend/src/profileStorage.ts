import {
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { join } from 'node:path';
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const endpoint = process.env.DO_SPACES_ENDPOINT;
const bucket = process.env.DO_SPACES_NAME;
const accessKeyId = process.env.DO_SPACES_KEY;
const secretAccessKey = process.env.DO_SPACES_SECRET;

if (!endpoint)
  throw new Error('Environment variable DO_SPACES_ENDPOINT not set');
if (!accessKeyId) throw new Error('Environment variable DO_SPACES_KEY not set');
if (!secretAccessKey)
  throw new Error('Environment variable DO_SPACES_SECRET not set');

const client = new S3Client({
  forcePathStyle: false,
  endpoint,
  // The region doesn't matter since we're using DigitalOcean, but the AWS SDK requires it.
  region: 'us-east-1',
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

export async function uploadProfile(profilesFolder: string): Promise<void> {
  console.log('Uploading profile');

  const { Contents } = await client.send(
    new ListObjectsCommand({
      Bucket: bucket,
    }),
  );
  const contents = Contents ?? [];

  if (contents.length > 0) {
    await client.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: {
          Objects: contents.map((file) => ({
            Key: file.Key,
          })),
        },
      }),
    );
  }

  const files = existsSync(profilesFolder) ? await readdir(profilesFolder) : [];

  for (const file of files) {
    const content = await readFile(join(profilesFolder, file), 'utf-8');
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: file,
        Body: content,
      }),
    );
  }

  console.log('Profile uploaded');
}

export async function downloadProfile(profilesFolder: string): Promise<void> {
  console.log('Downloading profile');

  await mkdir(profilesFolder, {
    recursive: true,
  });

  const { Contents } = await client.send(
    new ListObjectsCommand({
      Bucket: bucket,
    }),
  );
  const contents = Contents ?? [];

  if (contents.length === 0) {
    console.log('No profile downloaded');
    return;
  }

  for (const file of contents) {
    if (!file.Key) continue;

    const { Body } = await client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: file.Key,
      }),
    );
    const fileContent = await Body?.transformToString();

    if (fileContent) {
      await writeFile(join(profilesFolder, file.Key), fileContent);
    }
  }

  console.log('Profile downloaded');
}
