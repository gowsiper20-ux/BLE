import { Hono } from "hono";
import {
  DirectoryFeedError,
  getDirectoryFeedConfiguration,
} from "../services/directory-feed";
import { directoryFeedService } from "../services/directory-feed.service";

export const directoryFeedRoutes = new Hono();

async function readBoundedBody(request: Request, maximumBytes: number, timeoutMs: number): Promise<Buffer> {
  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    if (!/^\d+$/.test(contentLength)) {
      throw new DirectoryFeedError("Content-Length must be a valid non-negative integer.", "INVALID_CONTENT_LENGTH", 400);
    }
    if (Number(contentLength) > maximumBytes) {
      throw new DirectoryFeedError("Snapshot exceeds the configured request-size limit.", "PAYLOAD_TOO_LARGE", 413);
    }
  }
  if (!request.body) {
    throw new DirectoryFeedError("A JSON snapshot body is required.", "INVALID_JSON", 400);
  }
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    void reader.cancel();
  }, timeoutMs);
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (timedOut) {
        throw new DirectoryFeedError("Directory feed request exceeded the processing time limit.", "PROCESSING_TIMEOUT", 503);
      }
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maximumBytes) {
        await reader.cancel();
        throw new DirectoryFeedError("Snapshot exceeds the configured request-size limit.", "PAYLOAD_TOO_LARGE", 413);
      }
      chunks.push(value);
    }
  } finally {
    clearTimeout(timeout);
    reader.releaseLock();
  }
  return Buffer.concat(chunks, totalBytes);
}

directoryFeedRoutes.post("/snapshots", async (c) => {
  try {
    if (process.env.NODE_ENV === "production" && c.req.header("x-forwarded-proto")?.split(",")[0].trim().toLowerCase() !== "https") {
      return c.json({ success: false, error: { code: "HTTPS_REQUIRED", message: "Directory feed ingestion requires HTTPS." } }, 403);
    }
    const contentType = c.req.header("content-type")?.split(";")[0].trim().toLowerCase();
    if (contentType !== "application/json") {
      return c.json({ success: false, error: { code: "UNSUPPORTED_MEDIA_TYPE", message: "Content-Type must be application/json." } }, 415);
    }
    let configuration;
    try {
      configuration = getDirectoryFeedConfiguration();
    } catch {
      return c.json({ success: false, error: { code: "FEED_NOT_CONFIGURED", message: "Directory feed receiver configuration is invalid." } }, 503);
    }
    const rawBody = await readBoundedBody(
      c.req.raw,
      configuration.maxBodyBytes,
      configuration.maxProcessingTimeMs,
    );
    const result = await directoryFeedService.ingestSnapshot(
      rawBody,
      c.req.header("x-directory-timestamp"),
      c.req.header("x-directory-signature"),
    );
    return c.json({ success: true, data: result }, 200);
  } catch (error) {
    if (error instanceof DirectoryFeedError) {
      return c.json({ success: false, error: { code: error.code, message: error.message } }, error.statusCode);
    }
    console.error("Directory snapshot ingestion failed.", {
      errorType: error instanceof Error ? error.name : "UnknownError",
    });
    return c.json({
      success: false,
      error: { code: "DIRECTORY_INGESTION_FAILED", message: "Directory snapshot ingestion failed." },
    }, 503);
  }
});
