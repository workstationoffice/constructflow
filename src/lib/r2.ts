import AWS from "aws-sdk";

interface R2Credentials {
  accountId:       string;
  accessKeyId:     string;
  secretAccessKey: string;
  bucketName:      string;
  publicUrl:       string;
  prefix?:         string; // optional bucket prefix, e.g. "uploads/"
}

function makeS3(creds: R2Credentials) {
  return new AWS.S3({
    endpoint: `https://${creds.accountId}.r2.cloudflarestorage.com`,
    accessKeyId: creds.accessKeyId,
    secretAccessKey: creds.secretAccessKey,
    region: "auto",
    signatureVersion: "v4",
  });
}

export async function uploadToR2(
  key: string,
  buffer: Buffer,
  contentType: string,
  creds: R2Credentials
): Promise<string> {
  await makeS3(creds).putObject({
    Bucket: creds.bucketName,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }).promise();

  return `${creds.publicUrl}/${key}`;
}

export async function deleteFromR2(key: string, creds: R2Credentials): Promise<void> {
  await makeS3(creds).deleteObject({ Bucket: creds.bucketName, Key: key }).promise();
}

export function getR2Key(tenantId: string, folder: string, filename: string, prefix?: string): string {
  const base = `${tenantId}/${folder}/${Date.now()}-${filename}`;
  return prefix ? `${prefix.replace(/\/+$/, "")}/${base}` : base;
}

export function getR2CredsFromConfig(config: {
  r2AccountId?: string | null;
  r2AccessKeyId?: string | null;
  r2SecretAccessKey?: string | null;
  r2BucketName?: string | null;
  r2PublicUrl?: string | null;
  r2Prefix?: string | null;
}): R2Credentials | null {
  if (
    config.r2AccountId &&
    config.r2AccessKeyId &&
    config.r2SecretAccessKey &&
    config.r2BucketName &&
    config.r2PublicUrl
  ) {
    return {
      accountId:       config.r2AccountId,
      accessKeyId:     config.r2AccessKeyId,
      secretAccessKey: config.r2SecretAccessKey,
      bucketName:      config.r2BucketName,
      publicUrl:       config.r2PublicUrl,
      prefix:          config.r2Prefix ?? undefined,
    };
  }
  return null;
}
