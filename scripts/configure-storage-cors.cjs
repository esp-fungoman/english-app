const {
  S3Client,
  GetBucketCorsCommand,
  PutBucketCorsCommand,
} = require('@aws-sdk/client-s3');

class ConfigurationError extends Error {}

async function configureStorageCors() {
  const env = (name) => process.env[name]?.trim() || '';
  for (const name of [
    'BUCKET_NAME',
    'BUCKET_ENDPOINT',
    'BUCKET_ACCESS_KEY_ID',
    'BUCKET_SECRET_ACCESS_KEY',
    'WEB_ORIGIN',
    'ADMIN_ORIGIN',
  ]) {
    if (!env(name)) throw new ConfigurationError(`Configure ${name}`);
  }
  const origins = [...new Set([env('WEB_ORIGIN'), env('ADMIN_ORIGIN')])];
  for (const origin of origins) {
    let url;
    try {
      url = new URL(origin);
    } catch {
      throw new ConfigurationError('Frontend origins must be valid URLs');
    }
    if (
      url.origin !== origin ||
      !['http:', 'https:'].includes(url.protocol) ||
      (env('NODE_ENV') === 'production' && url.protocol !== 'https:')
    )
      throw new ConfigurationError(
        'Frontend origins must use HTTPS in production, with no path or trailing slash',
      );
  }
  const client = new S3Client({
    endpoint: env('BUCKET_ENDPOINT'),
    region: env('BUCKET_REGION') || 'auto',
    credentials: {
      accessKeyId: env('BUCKET_ACCESS_KEY_ID'),
      secretAccessKey: env('BUCKET_SECRET_ACCESS_KEY'),
    },
    forcePathStyle: env('BUCKET_FORCE_PATH_STYLE') === 'true',
    requestChecksumCalculation: 'WHEN_REQUIRED',
  });
  try {
    const Bucket = env('BUCKET_NAME');
    let existing = [];
    try {
      existing =
        (await client.send(new GetBucketCorsCommand({ Bucket }))).CORSRules ||
        [];
    } catch (error) {
      if (!['NoSuchCORSConfiguration', 'NoSuchCORS'].includes(error.name))
        throw error;
    }
    const ID = 'english-app-browser-images';
    const previousOrigins = existing
      .filter((rule) => rule.ID === ID)
      .flatMap((rule) => rule.AllowedOrigins || []);
    const rule = {
      ID,
      AllowedOrigins: [...new Set([...previousOrigins, ...origins])],
      AllowedMethods: ['PUT', 'GET', 'HEAD'],
      AllowedHeaders: ['Content-Type'],
      ExposeHeaders: ['ETag'],
      MaxAgeSeconds: 3600,
    };
    await client.send(
      new PutBucketCorsCommand({
        Bucket,
        CORSConfiguration: {
          CORSRules: [...existing.filter((item) => item.ID !== ID), rule],
        },
      }),
    );
    console.log('Storage CORS configured for:', origins.join(', '));
  } finally {
    client.destroy();
  }
}

module.exports = { configureStorageCors };

if (require.main === module) {
  configureStorageCors().catch((error) => {
    console.error(
      error instanceof ConfigurationError
        ? error.message
        : `Storage CORS configuration failed (HTTP ${error.$metadata?.httpStatusCode || 'unknown'}). Check bucket permissions and connectivity.`,
    );
    process.exitCode = 1;
  });
}
