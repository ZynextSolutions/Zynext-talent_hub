import { createReadStream, createWriteStream } from 'node:fs';
import { access, mkdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { env } from '../config/env';

function uploadsRoot(): string {
  return path.resolve(process.cwd(), 'uploads');
}

export interface StorageDriver {
  put(key: string, body: Buffer, contentType?: string): Promise<void>;
  getStream(key: string): Promise<Readable>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  localPath(key: string): string | null;
}

class LocalDiskDriver implements StorageDriver {
  constructor(private root: string) {}

  private abs(key: string): string {
    const abs = path.resolve(this.root, key);
    if (!abs.startsWith(path.resolve(this.root))) {
      throw new Error('Invalid storage key');
    }
    return abs;
  }

  async put(key: string, body: Buffer): Promise<void> {
    const dest = this.abs(key);
    await mkdir(path.dirname(dest), { recursive: true });
    await pipeline(Readable.from(body), createWriteStream(dest));
  }

  async getStream(key: string): Promise<Readable> {
    return createReadStream(this.abs(key));
  }

  async delete(key: string): Promise<void> {
    try {
      await unlink(this.abs(key));
    } catch {
      // missing is fine
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await access(this.abs(key));
      return true;
    } catch {
      return false;
    }
  }

  localPath(key: string): string {
    return this.abs(key);
  }
}

class S3Driver implements StorageDriver {
  private client: S3Client;

  constructor(
    private bucket: string,
    endpoint: string,
    region: string,
    accessKey: string,
    secretKey: string,
    forcePathStyle: boolean,
  ) {
    this.client = new S3Client({
      region,
      endpoint,
      forcePathStyle,
      credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
    });
  }

  async put(key: string, body: Buffer, contentType?: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async getStream(key: string): Promise<Readable> {
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    if (!res.Body) throw new Error('Empty object');
    return res.Body as Readable;
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch {
      return false;
    }
  }

  localPath(): null {
    return null;
  }
}

function createDriver(): StorageDriver {
  if (env.S3_BUCKET && env.S3_ENDPOINT && env.S3_ACCESS_KEY && env.S3_SECRET_KEY) {
    return new S3Driver(
      env.S3_BUCKET,
      env.S3_ENDPOINT,
      env.S3_REGION ?? 'us-east-1',
      env.S3_ACCESS_KEY,
      env.S3_SECRET_KEY,
      env.S3_FORCE_PATH_STYLE !== 'false',
    );
  }
  return new LocalDiskDriver(uploadsRoot());
}

let driver: StorageDriver | null = null;

export function getStorage(): StorageDriver {
  if (!driver) driver = createDriver();
  return driver;
}

export function publicPathToKey(publicPath: string): string {
  const normalized = publicPath.startsWith('/') ? publicPath : `/${publicPath}`;
  return normalized.replace(/^\/uploads\//, '');
}
