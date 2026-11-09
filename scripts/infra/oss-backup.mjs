#!/usr/bin/env node
/**
 * 轻量 OSS（S3 兼容）上传 / 按保留天数清理。
 * 由 backup-postgres-to-oss.sh 调用，复用仓库里的 @aws-sdk/client-s3。
 *
 * 用法：
 *   node scripts/infra/oss-backup.mjs put <localFile> <objectKey>
 *   node scripts/infra/oss-backup.mjs prune <prefix> <keepDays>
 */
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function loadSdk() {
  try {
    return require(resolve(root, 'node_modules/@aws-sdk/client-s3'));
  } catch {
    return require('@aws-sdk/client-s3');
  }
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`缺少环境变量 ${name}`);
    process.exit(1);
  }
  return value;
}

function client() {
  const { S3Client } = loadSdk();
  // 与 apps/upload 一致：OSS_REGION 形如 oss-cn-hangzhou
  const region = process.env.OSS_REGION?.trim() || 'oss-cn-hangzhou';
  const endpoint =
    process.env.OSS_ENDPOINT?.trim() || `https://${region}.aliyuncs.com`;
  return new S3Client({
    region,
    endpoint,
    forcePathStyle: false,
    credentials: {
      accessKeyId: required('OSS_ACCESS_KEY_ID'),
      secretAccessKey: required('OSS_ACCESS_KEY_SECRET'),
    },
  });
}

async function putObject(localFile, key) {
  const { PutObjectCommand } = loadSdk();
  const bucket = required('OSS_BUCKET');
  const body = readFileSync(localFile);
  await client().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: 'application/gzip',
    }),
  );
  console.log(`uploaded s3://${bucket}/${key} (${body.length} bytes)`);
}

async function prune(prefix, keepDays) {
  const {
    ListObjectsV2Command,
    DeleteObjectsCommand,
  } = loadSdk();
  const bucket = required('OSS_BUCKET');
  const s3 = client();
  const cutoff = Date.now() - keepDays * 24 * 60 * 60 * 1000;
  const stale = [];
  let token;

  do {
    const page = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: token,
      }),
    );
    for (const obj of page.Contents ?? []) {
      const modified = obj.LastModified?.getTime() ?? 0;
      if (obj.Key && modified < cutoff) {
        stale.push({ Key: obj.Key });
      }
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);

  if (!stale.length) {
    console.log(`prune: nothing older than ${keepDays}d under ${prefix}`);
    return;
  }

  for (let i = 0; i < stale.length; i += 1000) {
    const chunk = stale.slice(i, i + 1000);
    await s3.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: chunk, Quiet: true },
      }),
    );
  }
  console.log(`prune: deleted ${stale.length} object(s) older than ${keepDays}d`);
}

const [cmd, a, b] = process.argv.slice(2);
if (cmd === 'put' && a && b) {
  await putObject(a, b);
} else if (cmd === 'prune' && a && b) {
  await prune(a, Number(b) || 3);
} else {
  console.error(
    'usage: oss-backup.mjs put <file> <key> | oss-backup.mjs prune <prefix> <keepDays>',
  );
  process.exit(1);
}
