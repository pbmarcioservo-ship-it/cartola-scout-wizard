import type { IncomingMessage, ServerResponse } from "http";
import { Readable } from "stream";

type Req = IncomingMessage & { body?: unknown };
type Res = ServerResponse & { setHeader(name: string, value: string): void };

function setCors(res: Res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

async function readJsonBody(req: Req): Promise<Record<string, unknown>> {
  if (req.body && typeof req.body === "object") return req.body as Record<string, unknown>;
  const chunks: Uint8Array[] = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return {};
  const raw = Buffer.concat(chunks).toString("utf8");
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export default async function handler(req: Req, res: Res) {
  setCors(res);

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Método não permitido" }));
    return;
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        error: "Supabase não configurado no servidor (Vercel env vars ausentes).",
        required: ["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY"],
      }),
    );
    return;
  }

  try {
    const payload = await readJsonBody(req);
    const upstreamUrl = `${supabaseUrl.replace(/\/+$/, "")}/functions/v1/agente-tecnico`;

    const upstream = await fetch(upstreamUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseKey,
      } as Record<string, string>,
      body: JSON.stringify(payload),
    });

    res.statusCode = upstream.status;
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/json");

    const cacheControl = upstream.headers.get("cache-control");
    if (cacheControl) res.setHeader("Cache-Control", cacheControl);

    if (!upstream.ok) {
      const txt = await upstream.text().catch(() => "");
      res.end(txt || JSON.stringify({ error: `Upstream error ${upstream.status}` }));
      return;
    }

    if (!upstream.body) {
      const txt = await upstream.text().catch(() => "");
      res.end(txt || "");
      return;
    }

    const nodeStream = Readable.fromWeb(upstream.body as unknown as ReadableStream);
    nodeStream.pipe(res);
  } catch (e: unknown) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: e instanceof Error ? e.message : "Erro ao conectar com o Agente Técnico" }));
  }
}

