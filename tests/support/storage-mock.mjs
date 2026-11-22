// Minimal stand-in for the Supabase Storage REST API, used by the browser tests.
// Usage: STORAGE_MOCK_KEY=test-service-key node tests/support/storage-mock.mjs [port]
import { createServer } from "node:http";

const port = Number(process.argv[2] ?? 54321);
const key = process.env.STORAGE_MOCK_KEY ?? "test-service-key";
const objects = new Map();
const publicBuckets = new Set(["media"]);

createServer(async (request, response) => {
  const url = new URL(request.url, "http://localhost");
  const send = (status, body, headers = {}) => { response.writeHead(status, headers); response.end(body); };
  if (url.pathname === "/health") return send(200, "ok");
  const publicMatch = url.pathname.match(/^\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
  if (publicMatch && request.method === "GET") {
    const [, bucket, path] = publicMatch;
    const object = publicBuckets.has(bucket) && objects.get(`${bucket}/${decodeURIComponent(path)}`);
    return object ? send(200, object.data, { "Content-Type": object.type, "Cache-Control": object.cache }) : send(404, "not found");
  }
  const match = url.pathname.match(/^\/storage\/v1\/object\/([^/]+)\/(.+)$/);
  if (!match) return send(404, "not found");
  if (request.headers.apikey !== key) return send(401, "unauthorized");
  const id = `${match[1]}/${decodeURIComponent(match[2])}`;
  if (request.method === "POST" || request.method === "PUT") {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    objects.set(id, { data: Buffer.concat(chunks), type: request.headers["content-type"] ?? "application/octet-stream", cache: request.headers["cache-control"] ?? "" });
    return send(200, JSON.stringify({ Key: id }), { "Content-Type": "application/json" });
  }
  if (request.method === "GET") {
    const object = objects.get(id);
    return object ? send(200, object.data, { "Content-Type": object.type }) : send(400, JSON.stringify({ error: "not_found" }));
  }
  if (request.method === "DELETE") { objects.delete(id); return send(200, "{}"); }
  send(405, "method not allowed");
}).listen(port, "127.0.0.1", () => console.log(`Storage mock on ${port}`));
