import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { env } from '../server/src/config/env.js';
import { getS3Client, ensureStorageDirectories } from '../server/src/services/storage.js';
import { emailConfigured, verifyEmailService } from '../server/src/services/mail.js';


function s3EncryptionOptions() {
  if (!env.S3_SSE) return {};
  if (env.S3_SSE === 'aws:kms') return { ServerSideEncryption: 'aws:kms', SSEKMSKeyId: env.S3_KMS_KEY_ID };
  return { ServerSideEncryption: env.S3_SSE };
}

async function checkStorage() {
  if (env.STORAGE_DRIVER === 's3') {
    const { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = await import('@aws-sdk/client-s3');
    const key = `_secureasset-health/${crypto.randomUUID()}.txt`;
    const client = await getS3Client();
    try {
      await client.send(new PutObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: key,
        Body: Buffer.from('secureasset-storage-preflight'),
        ContentType: 'text/plain',
        ...s3EncryptionOptions(),
      }));
      const readResult = await client.send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
      const payload = Buffer.from(await readResult.Body.transformToByteArray()).toString('utf8');
      if (payload !== 'secureasset-storage-preflight') throw new Error('S3 read-back verification returned unexpected content');
      await client.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
      console.log(`S3 read/write/delete preflight passed: s3://${env.S3_BUCKET} (${env.S3_REGION})`);
    } catch (error) {
      await client.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key })).catch(() => {});
      const message = error?.message || error?.name || String(error);
      throw new Error(
        `S3 preflight failed for bucket ${env.S3_BUCKET}: ${message}. ` +
        'Provide S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY, attach an IAM role, or set STORAGE_DRIVER=local.',
      );
    }
    return;
  }

  await ensureStorageDirectories();
  const probe = path.join(env.VAULT_STORAGE_DIR, `.secureasset-write-test-${crypto.randomUUID()}`);
  await fs.writeFile(probe, 'ok', { mode: 0o600 });
  await fs.unlink(probe);
  console.log(`Local vault preflight passed: ${env.VAULT_STORAGE_DIR}`);
}

async function checkEmail() {
  if (!emailConfigured()) {
    console.log('SMTP preflight skipped: SMTP_HOST is not configured');
    return;
  }
  await verifyEmailService();
  console.log(`SMTP connection preflight passed: ${env.SMTP_HOST}:${env.SMTP_PORT}`);
}

async function checkClamAv() {
  console.log('ClamAV preflight skipped: external malware scanning is disabled by application policy');
}


try {
  await checkStorage();
  await checkClamAv();
  await checkEmail();
  console.log('Production service preflight passed.');
} catch (error) {
  console.error(error.message || error);
  process.exit(1);
}
