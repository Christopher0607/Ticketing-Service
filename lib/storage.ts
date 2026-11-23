import { randomUUID } from "node:crypto";

/**
 * Optional Supabase Storage backend. When SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set,
 * posters and QR codes go to the public "media" bucket (served by Supabase's CDN) and receipts and
 * proof documents to the private "private" bucket. Otherwise files are kept in PostgreSQL.
 */
const base = () => process.env.SUPABASE_URL?.replace(/\/+$/, "") ?? "";
// Supabase calls this the service_role key (legacy) or the secret key (sb_secret_...); either name works.
const key = () => process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";

export const remoteStorage = () => Boolean(base() && key());

function authHeaders(): Record<string, string> {
  const secret = key();
  // Legacy service_role keys are JWTs and go in Authorization; new sb_secret_ keys only in apikey.
  return secret.startsWith("eyJ") ? { apikey: secret, Authorization: `Bearer ${secret}` } : { apikey: secret };
}

const objectUrl = (bucket: string, path: string) =>
  `${base()}/storage/v1/object/${bucket}/${path.split("/").map(encodeURIComponent).join("/")}`;


export async function putObject(bucket: "media" | "private", path: string, data: Buffer, contentType: string, cacheSeconds = 3600) {
  const response = await fetch(objectUrl(bucket, path), {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": contentType, "cache-control": `max-age=${cacheSeconds}`, "x-upsert": "true" },
    body: new Uint8Array(data),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Storage upload failed with ${response.status}`);
}

export async function getObject(bucket: "media" | "private", path: string) {
  const response = await fetch(objectUrl(bucket, path), { headers: authHeaders(), signal: AbortSignal.timeout(15000) });
  if (response.status === 400 || response.status === 404) return null;
  if (!response.ok) throw new Error(`Storage download failed with ${response.status}`);
  return { data: Buffer.from(await response.arrayBuffer()), type: response.headers.get("content-type") ?? "application/octet-stream" };
}

export async function deleteObject(bucket: "media" | "private", path: string) {
  try {
    await fetch(objectUrl(bucket, path), { method: "DELETE", headers: authHeaders(), signal: AbortSignal.timeout(10000) });
  } catch (error) {
    console.error("Storage delete failed", error instanceof Error ? error.message : error);
  }
}

/** Stores a private file remotely and returns its path, or null when files belong in the database. */
export async function storePrivate(folder: "receipts" | "proofs", data: Buffer, extension: string, contentType: string) {
  if (!remoteStorage()) return null;
  const path = `${folder}/${randomUUID()}.${extension}`;
  await putObject("private", path, data, contentType);
  return path;
}
