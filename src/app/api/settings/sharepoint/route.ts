import { NextRequest, NextResponse } from "next/server";
import { requireTenantUser } from "@/lib/auth";

async function getMsToken(clientId: string, clientSecret: string, tenantId: string): Promise<string> {
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
    throw new Error(data.error_description ?? "Microsoft authentication failed. Check your Tenant ID, Client ID and Client Secret.");
  return data.access_token;
}

async function graphGet(token: string, url: string) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message ?? `Graph API error: ${res.status}`);
  return data;
}

// POST /api/settings/sharepoint
// action: "connect"  → validate credentials + fetch sites
// action: "drives"   → fetch drives for a site
// action: "folders"  → fetch child folders (root or inside a folder)
export async function POST(req: NextRequest) {
  try {
    await requireTenantUser();

    const { action, msClientId, msClientSecret, msTenantId, siteId, driveId, folderId } = await req.json();

    if (!msClientId || !msClientSecret || !msTenantId)
      return NextResponse.json({ error: "Tenant ID, Client ID and Client Secret are required" }, { status: 400 });

    const token = await getMsToken(msClientId, msClientSecret, msTenantId);

    if (action === "connect") {
      // List all accessible SharePoint sites
      const data = await graphGet(token, "https://graph.microsoft.com/v1.0/sites?search=*&$select=id,displayName,webUrl&$top=50");
      const sites = (data.value ?? []).map((s: { id: string; displayName: string; webUrl: string }) => ({
        id: s.id,
        name: s.displayName ?? s.webUrl,
        webUrl: s.webUrl,
      }));
      return NextResponse.json({ sites });
    }

    if (action === "drives") {
      if (!siteId) return NextResponse.json({ error: "siteId is required" }, { status: 400 });
      const data = await graphGet(token, `https://graph.microsoft.com/v1.0/sites/${siteId}/drives?$select=id,name,driveType`);
      const drives = (data.value ?? []).map((d: { id: string; name: string; driveType: string }) => ({
        id: d.id,
        name: d.name,
        driveType: d.driveType,
      }));
      return NextResponse.json({ drives });
    }

    if (action === "folders") {
      if (!driveId) return NextResponse.json({ error: "driveId is required" }, { status: 400 });
      const base = folderId
        ? `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${folderId}/children`
        : `https://graph.microsoft.com/v1.0/drives/${driveId}/root/children`;
      const url = `${base}?$select=id,name,folder,webUrl&$filter=folder ne null&$top=100`;
      const data = await graphGet(token, url);
      const folders = (data.value ?? []).map((f: { id: string; name: string; folder: { childCount: number }; webUrl: string }) => ({
        id: f.id,
        name: f.name,
        childCount: f.folder?.childCount ?? 0,
        webUrl: f.webUrl,
      }));
      return NextResponse.json({ folders });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
