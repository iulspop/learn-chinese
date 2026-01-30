import fs from "node:fs";
import path from "node:path";
import type { Route } from "./+types/media.$";

const MEDIA_DIR = path.join(process.cwd(), "app", "data", "media");

const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
};

export function loader({ params }: Route.LoaderArgs) {
  const filename = params["*"];
  if (!filename) throw new Response("Not found", { status: 404 });

  // Prevent path traversal
  const resolved = path.resolve(MEDIA_DIR, filename);
  if (!resolved.startsWith(MEDIA_DIR)) {
    throw new Response("Forbidden", { status: 403 });
  }

  if (!fs.existsSync(resolved)) {
    throw new Response("Not found", { status: 404 });
  }

  const ext = path.extname(filename).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  return new Response(fs.readFileSync(resolved), {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400",
    },
  });
}
