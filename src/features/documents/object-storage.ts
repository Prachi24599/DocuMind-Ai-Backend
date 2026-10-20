import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { config } from '../../config/env';

export class ObjectStorageNotConfiguredError extends Error {
  readonly statusCode = 503;

  constructor() {
    super('Document storage is not configured.');
    this.name = 'ObjectStorageNotConfiguredError';
  }
}

export class ObjectStorageOperationError extends Error {
  readonly statusCode = 502;

  constructor() {
    super('Unable to store the document.');
    this.name = 'ObjectStorageOperationError';
  }
}

let client: S3Client | undefined;

const getStorage = (): { client: S3Client; bucket: string } => {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME } = config;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
    throw new ObjectStorageNotConfiguredError();
  }

  client ??= new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });

  return { client, bucket: R2_BUCKET_NAME };
};

export const uploadPrivateObject = async (
  key: string,
  body: Buffer,
  contentType: 'application/pdf',
): Promise<void> => {
  try {
    const storage = getStorage();
    await storage.client.send(new PutObjectCommand({
      Bucket: storage.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }));
  } catch (error) {
    if (error instanceof ObjectStorageNotConfiguredError) throw error;
    throw new ObjectStorageOperationError();
  }
};

export const removePrivateObject = async (key: string): Promise<void> => {
  try {
    const storage = getStorage();
    await storage.client.send(new DeleteObjectCommand({
      Bucket: storage.bucket,
      Key: key,
    }));
  } catch (error) {
    if (error instanceof ObjectStorageNotConfiguredError) throw error;
    throw new ObjectStorageOperationError();
  }
};
