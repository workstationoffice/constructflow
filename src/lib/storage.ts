import { createSign } from "node:crypto";

// ─── Types ────────────────────────────────────────────────────────────────────

interface StorageConfigLike {
  provider: string;
  msClientId?: string | null;
  msClientSecret?: string | null;
  msTenantId?: string | null;
  sharepointSiteId?: string | null;
  sharepointDriveId?: string | null;
  sharepointFolderId?: string | null;
  onedriveFolder?: string | null;
  onedriveFolderId?: string | null;
  googleDriveFolderId?: string | null;
  googleServiceAccountEmail?: string | null;
  googleServiceAccountKey?: string | null;
}

export interface UploadResult {
  url: string;
  externalId?: string;
}

// ─── Token cache ──────────────────────────────────────────────────────────────

const msTokenCache = new Map<string, { token: string; expiresAt: number }>();
const googleTokenCache = new Map<string, { token: string; expiresAt: number }>();

// ─── Microsoft Graph helpers ──────────────────────────────────────────────────

async function getMsToken(clientId: string, clientSecret: string, tenantId: string): Promise<string> {
  const cacheKey = `${clientId}:${tenantId}`;
  const cached = msTokenCache.get(cacheKey);
  if (cached && cached.expiresAt - Date.now() > 60_000) return cached.token;

  const res = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        scope: "https://graph.microsoft.com/.default",
        grant_type: "client_credentials",
      }),
    }
  );
  const data = await res.json();
  if (!res.ok || !data.access_token)
    throw new Error(`Microsoft auth failed: ${data.error_description ?? JSON.stringify(data)}`);

  msTokenCache.set(cacheKey, {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  });
  return data.access_token;
}

// ─── SharePoint upload ────────────────────────────────────────────────────────

export async function uploadToSharePoint(
  filename: string,
  buffer: Buffer,
  contentType: string,
  config: StorageConfigLike
): Promise<UploadResult> {
  const { msClientId, msClientSecret, msTenantId, sharepointSiteId, sharepointDriveId, sharepointFolderId } = config;
  if (!msClientId || !msClientSecret || !msTenantId || !sharepointSiteId)
    throw new Error("SharePoint is not fully configured (Tenant ID, Client ID, Client Secret, Site ID are required).");

  if (buffer.length > 4 * 1024 * 1024)
    throw new Error("File exceeds 4 MB limit for SharePoint direct upload.");

  const token = await getMsToken(msClientId, msClientSecret, msTenantId);
  const safeName = `${Date.now()}-${filename}`;

  let uploadUrl: string;
  if (sharepointDriveId && sharepointFolderId && sharepointFolderId !== "root") {
    // Upload into the specific folder the user picked
    uploadUrl = `https://graph.microsoft.com/v1.0/drives/${sharepointDriveId}/items/${sharepointFolderId}:/${encodeURIComponent(safeName)}:/content`;
  } else {
    const driveSegment = sharepointDriveId ? `drives/${sharepointDriveId}` : "drive";
    const path = encodeURIComponent(`BuildFlow/${safeName}`);
    uploadUrl = `https://graph.microsoft.com/v1.0/sites/${sharepointSiteId}/${driveSegment}/root:/${path}:/content`;
  }

  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": contentType },
    body: new Uint8Array(buffer),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`SharePoint upload failed: ${data.error?.message ?? JSON.stringify(data)}`);

  return { url: data.webUrl ?? uploadUrl, externalId: data.id };
}

// ─── OneDrive upload ──────────────────────────────────────────────────────────

export async function uploadToOneDrive(
  filename: string,
  buffer: Buffer,
  contentType: string,
  config: StorageConfigLike
): Promise<UploadResult> {
  const { msClientId, msClientSecret, msTenantId, onedriveFolder, onedriveFolderId } = config;
  if (!msClientId || !msClientSecret || !msTenantId)
    throw new Error("OneDrive is not fully configured (Tenant ID, Client ID, Client Secret are required).");

  if (buffer.length > 4 * 1024 * 1024)
    throw new Error("File exceeds 4 MB limit for OneDrive direct upload.");

  const token = await getMsToken(msClientId, msClientSecret, msTenantId);
  const safeName = `${Date.now()}-${filename}`;

  let uploadUrl: string;
  if (onedriveFolderId && onedriveFolderId !== "root") {
    // Upload into the specific folder the user picked
    uploadUrl = `https://graph.microsoft.com/v1.0/sites/root/drive/items/${onedriveFolderId}:/${encodeURIComponent(safeName)}:/content`;
  } else {
    const folder = onedriveFolder?.replace(/^\/|\/$/g, "") || "BuildFlow";
    const path = encodeURIComponent(`${folder}/${safeName}`);
    uploadUrl = `https://graph.microsoft.com/v1.0/sites/root/drive/root:/${path}:/content`;
  }

  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": contentType },
    body: new Uint8Array(buffer),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`OneDrive upload failed: ${data.error?.message ?? JSON.stringify(data)}`);

  return { url: data.webUrl ?? uploadUrl, externalId: data.id };
}

// ─── Google Drive upload ──────────────────────────────────────────────────────

function buildGoogleJwt(serviceAccountEmail: string, privateKeyPem: string): string {
  const now = Math.floor(Date.now() / 1000);
  const encode = (obj: object) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  const header  = encode({ alg: "RS256", typ: "JWT" });
  const payload = encode({
    iss: serviceAccountEmail,
    scope: "https://www.googleapis.com/auth/drive.file",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  });
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${payload}`);
  const sig = signer.sign(privateKeyPem, "base64url");
  return `${header}.${payload}.${sig}`;
}

async function getGoogleToken(serviceAccountEmail: string, privateKeyPem: string): Promise<string> {
  const cached = googleTokenCache.get(serviceAccountEmail);
  if (cached && cached.expiresAt - Date.now() > 60_000) return cached.token;

  // Normalise PEM: JSON key files store newlines as literal \n
  const pem = privateKeyPem.replace(/\\n/g, "\n");
  const jwt = buildGoogleJwt(serviceAccountEmail, pem);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token)
    throw new Error(`Google auth failed: ${data.error_description ?? JSON.stringify(data)}`);

  googleTokenCache.set(serviceAccountEmail, {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  });
  return data.access_token;
}

export async function uploadToGoogleDrive(
  filename: string,
  buffer: Buffer,
  contentType: string,
  config: StorageConfigLike
): Promise<UploadResult> {
  const { googleServiceAccountEmail, googleServiceAccountKey, googleDriveFolderId } = config;
  if (!googleServiceAccountEmail || !googleServiceAccountKey)
    throw new Error("Google Drive is not fully configured (Service Account Email and Private Key are required).");

  const token = await getGoogleToken(googleServiceAccountEmail, googleServiceAccountKey);

  const name = `${Date.now()}-${filename}`;
  const metadata = JSON.stringify({
    name,
    ...(googleDriveFolderId ? { parents: [googleDriveFolderId] } : {}),
  });

  const boundary = "cfupload";
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json\r\n\r\n${metadata}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Type: ${contentType}\r\n\r\n`),
    buffer,
    Buffer.from(`\r\n--${boundary}--`),
  ]);

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(`Google Drive upload failed: ${data.error?.message ?? JSON.stringify(data)}`);

  return {
    url: data.webViewLink ?? `https://drive.google.com/file/d/${data.id}/view`,
    externalId: data.id,
  };
}

// ─── Unified dispatcher ───────────────────────────────────────────────────────

export async function uploadToCloudStorage(
  filename: string,
  buffer: Buffer,
  contentType: string,
  config: StorageConfigLike
): Promise<UploadResult> {
  switch (config.provider) {
    case "SHAREPOINT":  return uploadToSharePoint(filename, buffer, contentType, config);
    case "ONEDRIVE":    return uploadToOneDrive(filename, buffer, contentType, config);
    case "GOOGLE_DRIVE": return uploadToGoogleDrive(filename, buffer, contentType, config);
    default: throw new Error(`Unsupported provider: ${config.provider}`);
  }
}
