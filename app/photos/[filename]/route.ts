import { readFile } from "fs/promises";
import path from "path";

const ALLOWED = /^[\w.-]+\.(jpg|jpeg|png|webp)$/i;

function contentType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
}

/** Serve player images from repo root `photos/` (same files as manifest). */
export async function GET(_request: Request, context: { params: Promise<{ filename: string }> }) {
  const { filename } = await context.params;
  if (!ALLOWED.test(filename)) {
    return new Response("Not found", { status: 404 });
  }

  const filePath = path.join(process.cwd(), "photos", filename);
  try {
    const buf = await readFile(filePath);
    return new Response(buf, {
      headers: {
        "Content-Type": contentType(filename),
        "Cache-Control": "public, max-age=604800, immutable",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
