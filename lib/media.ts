import { randomUUID } from "node:crypto";
import sharp from "sharp";
import type { PoolClient } from "pg";
import { ActionError } from "./orders";
import { deleteObject, putObject, remoteStorage } from "./storage";

const maxUpload = 8 * 1024 * 1024;

function imageSignature(buffer: Buffer) {
  if (buffer.subarray(0, 3).toString("hex") === "ffd8ff") return "jpeg";
  if (buffer.subarray(0, 8).toString("hex") === "89504e470d0a1a0a") return "png";
  if (buffer.subarray(0, 4).toString() === "RIFF" && buffer.subarray(8, 12).toString() === "WEBP") return "webp";
  return null;
}

/** Reads an optional uploaded image and re-encodes it to WebP (strips metadata, bounds dimensions). */
export async function readImage(value: FormDataEntryValue | null, options: { width: number; height: number; lossless?: boolean }) {
  if (!(value instanceof File) || value.size === 0) return null;
  if (value.size > maxUpload) throw new ActionError("err.imageSize");
  const input = Buffer.from(await value.arrayBuffer());
  if (!imageSignature(input)) throw new ActionError("err.imageType");
  try {
    return await sharp(input, { limitInputPixels: 50_000_000 })
      .rotate()
      .resize({ width: options.width, height: options.height, fit: "inside", withoutEnlargement: true })
      .webp(options.lossless ? { lossless: true } : { quality: 80 })
      .toBuffer();
  } catch {
    throw new ActionError("err.imageType");
  }
}

/** Saves a public image (poster, seat map, QR) to Supabase Storage or the database and returns its id. */
export async function storeMedia(client: PoolClient, data: Buffer) {
  if (remoteStorage()) {
    const id = randomUUID();
    await putObject("media", `${id}.webp`, data, "image/webp", 31536000);
    await client.query("INSERT INTO media (id,mime,remote) VALUES ($1,'image/webp',true)", [id]);
    return id;
  }
  const { rows: [row] } = await client.query<{ id: string }>("INSERT INTO media (data,mime) VALUES ($1,'image/webp') RETURNING id", [data]);
  return row.id;
}

export async function deleteMedia(client: PoolClient, id: string) {
  const { rows: [row] } = await client.query<{ remote: boolean }>("DELETE FROM media WHERE id=$1 RETURNING remote", [id]);
  if (row?.remote) await deleteObject("media", `${id}.webp`);
}
