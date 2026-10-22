import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export const UPLOAD_URL_SECONDS = 600;
export const MEDIA_URL_SECONDS = 3600;

type BucketConfig = {
  bucket: string;
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
};

function env(name: string) {
  return process.env[name]?.trim() ?? '';
}

function bucketConfig(): BucketConfig | null {
  const accountId = env('R2_ACCOUNT_ID');
  const bucket = env('R2_BUCKET_NAME');
  const accessKeyId = env('R2_ACCESS_KEY_ID');
  const secretAccessKey = env('R2_SECRET_ACCESS_KEY');
  const explicitEndpoint = env('R2_ENDPOINT');
  // Select an entire provider configuration; never mix R2 and legacy secrets.
  if (
    [accountId, bucket, accessKeyId, secretAccessKey, explicitEndpoint].some(
      Boolean,
    )
  ) {
    if (
      !bucket ||
      !accessKeyId ||
      !secretAccessKey ||
      (!explicitEndpoint && !/^[a-f0-9]{32}$/i.test(accountId))
    )
      return null;
    let endpoint: URL;
    try {
      endpoint = new URL(
        explicitEndpoint || `https://${accountId}.r2.cloudflarestorage.com`,
      );
    } catch {
      return null;
    }
    // Signing uses the R2 S3 API endpoint, never a public/custom media domain.
    if (
      endpoint.protocol !== 'https:' ||
      !endpoint.hostname.endsWith('.r2.cloudflarestorage.com') ||
      endpoint.pathname !== '/' ||
      endpoint.search ||
      endpoint.hash ||
      endpoint.username ||
      endpoint.password ||
      endpoint.port
    )
      return null;
    return {
      bucket,
      endpoint: endpoint.origin,
      region: 'auto',
      accessKeyId,
      secretAccessKey,
      forcePathStyle: true,
    };
  }
  const legacy = {
    bucket: env('BUCKET_NAME'),
    endpoint: env('BUCKET_ENDPOINT'),
    accessKeyId: env('BUCKET_ACCESS_KEY_ID'),
    secretAccessKey: env('BUCKET_SECRET_ACCESS_KEY'),
    region: env('BUCKET_REGION') || 'auto',
    forcePathStyle: env('BUCKET_FORCE_PATH_STYLE') === 'true',
  };
  return legacy.bucket &&
    legacy.endpoint &&
    legacy.accessKeyId &&
    legacy.secretAccessKey
    ? legacy
    : null;
}

export function isBucketConfigured(): boolean {
  return bucketConfig() !== null;
}

function client(config: BucketConfig): S3Client {
  return new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    forcePathStyle: config.forcePathStyle,
    // The browser supplies the actual body after signing. Do not sign an SDK
    // checksum for an absent/empty body instead of the selected image bytes.
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
}

export async function signPutUrl(key: string, contentType: string) {
  const config = bucketConfig();
  if (!config) throw new Error('Image storage is not configured');
  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(client(config), command, {
    expiresIn: UPLOAD_URL_SECONDS,
    signableHeaders: new Set(['content-type']),
  });
}

export async function signGetUrl(key: string) {
  const config = bucketConfig();
  if (!config) throw new Error('Image storage is not configured');
  const command = new GetObjectCommand({
    Bucket: config.bucket,
    Key: key,
  });
  return getSignedUrl(client(config), command, {
    expiresIn: MEDIA_URL_SECONDS,
  });
}
