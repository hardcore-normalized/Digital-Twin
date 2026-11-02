import type { StorageKind } from "../db/schema";

export type StoredFileInfo = { path: string; updatedAt?: string; size?: number };

/** Where twin markdown files live. Paths look like "twins/priya@acme.com/ABOUT.md". */
export interface TwinStorage {
  kind: StorageKind;
  read(path: string): Promise<string | null>;
  write(path: string, content: string): Promise<void>;
  list(prefix: string): Promise<StoredFileInfo[]>;
  delete(path: string): Promise<void>;
}

export type S3StorageConfig = {
  bucket: string;
  region: string;
  /** Custom endpoint for S3-compatible services (Cloudflare R2, MinIO, etc.). */
  endpoint?: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Optional key prefix inside the bucket, e.g. "digital-twin/". */
  prefix?: string;
  forcePathStyle?: boolean;
};

export type HttpStorageConfig = {
  /** e.g. https://files.acme.com/digital-twin — see /docs/storage-api for the contract. */
  baseUrl: string;
  token: string;
};

export type LocalStorageConfig = {
  /** Absolute path or ~/path on the machine that runs Digital Twin. */
  dir: string;
};

export class StorageError extends Error {}
