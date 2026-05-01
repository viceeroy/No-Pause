import type { IncomingMessage, ServerResponse } from "http";
import { supabaseServer } from "../src/services/supabaseServer.js";
import { transcribeAudioVerbose } from "../src/services/groq.js";

const MAX_AUDIO_BYTES = 15 * 1024 * 1024;

type UploadedAudio = {
  data: Buffer;
  mimeType: string;
};

async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

function sendJson(res: ServerResponse, statusCode: number, body: unknown) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function getBoundary(contentType: string | undefined): string | null {
  const match = /(?:^|;\s*)boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType ?? "");
  return match?.[1] ?? match?.[2] ?? null;
}

function toHttpHeaderValue(value: string): string {
  return value.trim().replace(/[^\x00-\xff]/g, "");
}

async function requireAuthenticatedUser(req: IncomingMessage): Promise<boolean> {
  const internalToken = process.env.NOPAUSE_INTERNAL_API_TOKEN ?? process.env.TELEGRAM_BOT_TOKEN;
  const expectedInternalToken = internalToken ? toHttpHeaderValue(internalToken) : "";
  const internalHeader = req.headers["x-nopause-internal-token"];
  if (
    expectedInternalToken &&
    typeof internalHeader === "string" &&
    internalHeader === expectedInternalToken
  ) {
    return true;
  }

  const authHeader = req.headers.authorization;
  const accessToken = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";
  if (!accessToken) return false;

  const { data, error } = await supabaseServer.auth.getUser(accessToken);
  return !error && Boolean(data.user);
}

function parseMultipartAudio(body: Buffer, boundary: string): UploadedAudio | null {
  const delimiter = Buffer.from(`--${boundary}`);
  let searchStart = 0;

  while (searchStart < body.length) {
    const delimiterStart = body.indexOf(delimiter, searchStart);
    if (delimiterStart === -1) break;

    let partStart = delimiterStart + delimiter.length;
    if (body.subarray(partStart, partStart + 2).toString("utf8") === "--") break;
    if (body.subarray(partStart, partStart + 2).toString("utf8") === "\r\n") partStart += 2;

    const nextDelimiterStart = body.indexOf(delimiter, partStart);
    if (nextDelimiterStart === -1) break;

    let part = body.subarray(partStart, nextDelimiterStart);
    if (part.subarray(part.length - 2).toString("utf8") === "\r\n") {
      part = part.subarray(0, part.length - 2);
    }

    const headerEnd = part.indexOf(Buffer.from("\r\n\r\n"));
    if (headerEnd !== -1) {
      const rawHeaders = part.subarray(0, headerEnd).toString("utf8");
      const data = part.subarray(headerEnd + 4);
      const disposition = /content-disposition:\s*([^\r\n]+)/i.exec(rawHeaders)?.[1] ?? "";
      const isFileField = /name="audio"/i.test(disposition) || /name="file"/i.test(disposition);
      const mimeType = /content-type:\s*([^\r\n]+)/i.exec(rawHeaders)?.[1]?.trim() || "audio/webm";

      if (isFileField && data.length > 0) {
        return { data, mimeType };
      }
    }

    searchStart = nextDelimiterStart + delimiter.length;
  }

  return null;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.setHeader("Allow", "POST");
      res.end("Method Not Allowed");
      return;
    }

    if (!process.env.GROQ_API_KEY) {
      sendJson(res, 500, { error: "GROQ_API_KEY is not set" });
      return;
    }

    if (!(await requireAuthenticatedUser(req))) {
      sendJson(res, 401, { error: "Authorization token is required" });
      return;
    }

    const boundary = getBoundary(req.headers["content-type"]);
    if (!boundary) {
      sendJson(res, 400, { error: "Expected multipart/form-data audio upload" });
      return;
    }

    const body = await readBody(req);
    if (body.length > MAX_AUDIO_BYTES + 2048) {
      sendJson(res, 413, { error: "Audio upload is too large" });
      return;
    }

    const audio = parseMultipartAudio(body, boundary);
    if (!audio) {
      sendJson(res, 400, { error: "Audio file field is required" });
      return;
    }

    if (audio.data.length > MAX_AUDIO_BYTES) {
      sendJson(res, 413, { error: "Audio upload is too large" });
      return;
    }

    const audioFile = new Blob([new Uint8Array(audio.data)], { type: audio.mimeType });
    const transcription = await transcribeAudioVerbose(audioFile);

    sendJson(res, 200, { transcript: transcription.text, words: transcription.words });
  } catch (error) {
    console.error("transcription endpoint error:", error);
    const message = error instanceof Error ? error.message : String(error);
    sendJson(res, 500, { error: message });
  }
}
