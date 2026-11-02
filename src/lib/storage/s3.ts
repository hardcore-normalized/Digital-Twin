import "server-only";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from "@aws-sdk/client-s3";
import { StorageError, type S3StorageConfig, type TwinStorage } from "./types";

/** Customer's own bucket on AWS S3 or any S3-compatible service (R2, MinIO, GCS interop). */
export function s3Storage(config: S3StorageConfig): TwinStorage {
  const client = new S3Client({
    region: config.region || "us-east-1",
    endpoint: config.endpoint || undefined,
    forcePathStyle: config.forcePathStyle ?? Boolean(config.endpoint),
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  });
  const prefix = config.prefix ? config.prefix.replace(/^\/+/, "").replace(/\/?$/, "/") : "";
  const key = (path: string) => `${prefix}${path}`;

  const wrap = async <T>(op: string, fn: () => Promise<T>): Promise<T> => {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof S3ServiceException) throw new StorageError(`S3 ${op} failed: ${err.name} — ${err.message}`);
      throw new StorageError(`S3 ${op} failed: ${(err as Error).message}`);
    }
  };

  return {
    kind: "s3",
    async read(path) {
      try {
        const res = await client.send(new GetObjectCommand({ Bucket: config.bucket, Key: key(path) }));
        return (await res.Body?.transformToString("utf-8")) ?? "";
      } catch (err) {
        if (err instanceof NoSuchKey) return null;
        if (err instanceof S3ServiceException && err.$metadata.httpStatusCode === 404) return null;
        throw new StorageError(`S3 read failed: ${(err as Error).message}`);
      }
    },
    write: (path, content) =>
      wrap("write", async () => {
        await client.send(
          new PutObjectCommand({
            Bucket: config.bucket,
            Key: key(path),
            Body: content,
            ContentType: "text/markdown; charset=utf-8",
          }),
        );
      }),
    list: (listPrefix) =>
      wrap("list", async () => {
        const out: { path: string; updatedAt?: string; size?: number }[] = [];
        let token: string | undefined;
        do {
          const res = await client.send(
            new ListObjectsV2Command({ Bucket: config.bucket, Prefix: key(listPrefix), ContinuationToken: token }),
          );
          for (const obj of res.Contents ?? []) {
            if (!obj.Key) continue;
            out.push({ path: obj.Key.slice(prefix.length), updatedAt: obj.LastModified?.toISOString(), size: obj.Size });
          }
          token = res.IsTruncated ? res.NextContinuationToken : undefined;
        } while (token);
        return out;
      }),
    delete: (path) =>
      wrap("delete", async () => {
        await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key(path) }));
      }),
  };
}
