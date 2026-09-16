import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { Readable, PassThrough } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { env } from '../config/env.js';

const MAGIC = Buffer.from('SAV1');
const HEADER_BYTES = 16;
const TAG_BYTES = 16;
let cachedS3Client;

function safeSegment(value = '') {
  return String(value).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
}

function localPath(key) {
  const resolved = path.resolve(env.VAULT_STORAGE_DIR, key);
  const root = `${path.resolve(env.VAULT_STORAGE_DIR)}${path.sep}`;
  if (!resolved.startsWith(root)) throw new Error('Invalid storage key');
  return resolved;
}

function encryptionKey() {
  if (!env.VAULT_ENCRYPTION_KEY) return null;
  return crypto.createHash('sha256').update(env.VAULT_ENCRYPTION_KEY).digest();
}

export async function getS3Client() {
  if (cachedS3Client) return cachedS3Client;
  const { S3Client } = await import('@aws-sdk/client-s3');
  const credentials = env.S3_ACCESS_KEY_ID
    ? {
        accessKeyId: env.S3_ACCESS_KEY_ID,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY,
        ...(env.S3_SESSION_TOKEN ? { sessionToken: env.S3_SESSION_TOKEN } : {}),
      }
    : undefined;
  cachedS3Client = new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT || undefined,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    credentials,
    maxAttempts: 3,
  });
  return cachedS3Client;
}

function s3EncryptionOptions() {
  if (!env.S3_SSE) return {};
  if (env.S3_SSE === 'aws:kms') {
    return { ServerSideEncryption: 'aws:kms', SSEKMSKeyId: env.S3_KMS_KEY_ID };
  }
  return { ServerSideEncryption: env.S3_SSE };
}

export function buildStorageKey(ownerId, originalName, namespace = 'files') {
  const date = new Date();
  const ext = path.extname(originalName).toLowerCase();
  return `${safeSegment(namespace)}/${safeSegment(ownerId)}/${date.getUTCFullYear()}/${String(date.getUTCMonth() + 1).padStart(2, '0')}/${crypto.randomUUID()}${ext}`;
}

async function encryptBuffer(buffer) {
  const key = encryptionKey();
  if (!key) return buffer;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  return Buffer.concat([MAGIC, iv, cipher.update(buffer), cipher.final(), cipher.getAuthTag()]);
}

async function decryptBuffer(buffer) {
  if (!buffer.subarray(0, 4).equals(MAGIC)) return buffer;
  const key = encryptionKey();
  if (!key) throw new Error('VAULT_ENCRYPTION_KEY is required to read encrypted local files');
  const iv = buffer.subarray(4, HEADER_BYTES);
  const tag = buffer.subarray(buffer.length - TAG_BYTES);
  const ciphertext = buffer.subarray(HEADER_BYTES, buffer.length - TAG_BYTES);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

export async function saveBuffer(buffer, key, contentType = 'application/octet-stream') {
  if (env.STORAGE_DRIVER === 's3') {
    const { PutObjectCommand } = await import('@aws-sdk/client-s3');
    await (await getS3Client()).send(new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ...s3EncryptionOptions(),
    }));
    return { driver: 's3', key };
  }

  const filePath = localPath(key);
  await fsp.mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  await fsp.writeFile(filePath, await encryptBuffer(buffer), { mode: 0o600 });
  return { driver: 'local', key };
}

export async function saveFile(sourcePath, key, contentType = 'application/octet-stream') {
  if (env.STORAGE_DRIVER === 's3') {
    const { Upload } = await import('@aws-sdk/lib-storage');
    const upload = new Upload({
      client: await getS3Client(),
      params: {
        Bucket: env.S3_BUCKET,
        Key: key,
        Body: fs.createReadStream(sourcePath),
        ContentType: contentType,
        ...s3EncryptionOptions(),
      },
      queueSize: 4,
      partSize: Math.max(5 * 1024 * 1024, Math.floor(env.VAULT_CHUNK_MB * 1024 * 1024)),
      leavePartsOnError: false,
    });
    await upload.done();
    await fsp.unlink(sourcePath).catch(() => {});
    return { driver: 's3', key };
  }

  const destination = localPath(key);
  await fsp.mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
  const keyBytes = encryptionKey();
  if (!keyBytes) {
    await fsp.rename(sourcePath, destination).catch(async () => {
      await fsp.copyFile(sourcePath, destination);
      await fsp.unlink(sourcePath);
    });
  } else {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', keyBytes, iv);
    const output = fs.createWriteStream(destination, { mode: 0o600 });
    output.write(Buffer.concat([MAGIC, iv]));
    await pipeline(fs.createReadStream(sourcePath), cipher, output);
    await fsp.appendFile(destination, cipher.getAuthTag());
    await fsp.unlink(sourcePath).catch(() => {});
  }
  await fsp.chmod(destination, 0o600).catch(() => {});
  return { driver: 'local', key };
}

export async function readBuffer(driver, key) {
  if (driver === 's3') {
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');
    const response = await (await getS3Client()).send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
    return Buffer.from(await response.Body.transformToByteArray());
  }
  return decryptBuffer(await fsp.readFile(localPath(key)));
}

export async function storedObjectSupportsRange(driver, key) {
  if (driver === 's3') return true;
  const handle = await fsp.open(localPath(key), 'r');
  try {
    const head = Buffer.alloc(MAGIC.length);
    await handle.read(head, 0, MAGIC.length, 0);
    return !head.equals(MAGIC);
  } finally {
    await handle.close();
  }
}

export async function createReadStream(driver, key, range = null) {
  if (driver === 's3') {
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');
    const request = { Bucket: env.S3_BUCKET, Key: key };
    if (range && Number.isInteger(range.start) && Number.isInteger(range.end)) request.Range = `bytes=${range.start}-${range.end}`;
    const response = await (await getS3Client()).send(new GetObjectCommand(request));
    return response.Body instanceof Readable ? response.Body : Readable.fromWeb(response.Body);
  }

  const filePath = localPath(key);
  const handle = await fsp.open(filePath, 'r');
  const head = Buffer.alloc(HEADER_BYTES);
  await handle.read(head, 0, HEADER_BYTES, 0);
  const stat = await handle.stat();
  await handle.close();
  if (!head.subarray(0, 4).equals(MAGIC)) return fs.createReadStream(filePath, range && Number.isInteger(range.start) && Number.isInteger(range.end) ? { start: range.start, end: range.end } : undefined);
  if (range) {
    const error = new Error('Byte ranges are unavailable for encrypted local vault objects');
    error.code = 'RANGE_NOT_SUPPORTED';
    throw error;
  }

  const keyBytes = encryptionKey();
  if (!keyBytes) throw new Error('VAULT_ENCRYPTION_KEY is required to read encrypted local files');
  const tagHandle = await fsp.open(filePath, 'r');
  const tag = Buffer.alloc(TAG_BYTES);
  await tagHandle.read(tag, 0, TAG_BYTES, stat.size - TAG_BYTES);
  await tagHandle.close();
  const decipher = crypto.createDecipheriv('aes-256-gcm', keyBytes, head.subarray(4, HEADER_BYTES));
  decipher.setAuthTag(tag);
  const output = new PassThrough();
  pipeline(fs.createReadStream(filePath, { start: HEADER_BYTES, end: stat.size - TAG_BYTES - 1 }), decipher, output)
    .catch((error) => output.destroy(error));
  return output;
}

export async function deleteObject(driver, key) {
  if (!key) return;
  if (driver === 's3') {
    const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
    await (await getS3Client()).send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
    return;
  }
  await fsp.unlink(localPath(key)).catch((error) => {
    if (error?.code !== 'ENOENT') throw error;
  });
}

export async function objectExists(driver, key) {
  if (driver === 's3') {
    const { HeadObjectCommand } = await import('@aws-sdk/client-s3');
    try {
      await (await getS3Client()).send(new HeadObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
      return true;
    } catch (error) {
      if (error?.$metadata?.httpStatusCode === 404 || ['NotFound', 'NoSuchKey'].includes(error?.name)) return false;
      throw error;
    }
  }
  try {
    await fsp.access(localPath(key));
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

export function tempUploadPath(sessionId, chunkIndex) {
  return path.resolve(env.VAULT_TEMP_DIR, safeSegment(sessionId), `${Number(chunkIndex)}.part`);
}

export async function ensureStorageDirectories() {
  await fsp.mkdir(env.VAULT_TEMP_DIR, { recursive: true, mode: 0o700 });
  if (env.STORAGE_DRIVER === 'local') await fsp.mkdir(env.VAULT_STORAGE_DIR, { recursive: true, mode: 0o700 });
}
