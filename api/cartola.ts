import type { IncomingMessage, ServerResponse } from "http";

const CARTOLA_API_BASE = "https://api.cartola.globo.com";

const endpoints: Record<string, { path: string }> = {
  mercado: { path: "/atletas/mercado" },
  pontuados: { path: "/atletas/pontuados" },
  partidas: { path: "/partidas" },
  rodada: { path: "/mercado/status" },
  clubes: { path: "/clubes" },
  posicoes: { path: "/atletas/posicoes" },
  "pontuados-rodada": { path: "/atletas/pontuados" },
  destaques: { path: "/mercado/destaques" },
};

const ALLOWED_ORIGINS = new Set([
  "https://statusfcpro.com",
  "https://www.statusfcpro.com",
  "http://localhost:8080",
  "http://localhost:5173",
]);

function setCors(req: CartolaProxyRequest, res: CartolaProxyResponse) {
  const origin = (req.headers.origin || "").toString();
  const allowOrigin = ALLOWED_ORIGINS.has(origin) ? origin : "*";
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Origin", allowOrigin);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

type CartolaProxyRequest = IncomingMessage & {
  body?: unknown;
  query?: Record<string, string | string[] | undefined>;
};

type CartolaProxyResponse = ServerResponse & {
  setHeader(name: string, value: string): void;
};

async function readJsonBody(req: CartolaProxyRequest): Promise<Record<string, unknown>> {
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

export default async function handler(req: CartolaProxyRequest, res: CartolaProxyResponse) {
  setCors(req, res);

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  try {
    let endpoint = "mercado";
    let rodada: string | null = null;

    if (req.method === "POST") {
      const body = await readJsonBody(req);
      endpoint = typeof body.endpoint === "string" ? body.endpoint : "mercado";
      rodada = typeof body.rodada === "string" ? body.rodada : null;
    } else {
      endpoint = typeof req.query?.endpoint === "string" ? req.query.endpoint : "mercado";
      rodada = typeof req.query?.rodada === "string" ? req.query.rodada : null;
    }

    let apiPath = endpoints[String(endpoint)]?.path;
    if (!apiPath) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Endpoint não encontrado", availableEndpoints: Object.keys(endpoints) }));
      return;
    }

    if (rodada && (endpoint === "partidas" || endpoint === "pontuados-rodada")) {
      const rodadaNum = parseInt(String(rodada), 10);
      if (!Number.isInteger(rodadaNum) || rodadaNum < 1 || rodadaNum > 100) {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Parâmetro rodada inválido. Deve ser um número inteiro positivo." }));
        return;
      }
      apiPath = `${apiPath}/${rodadaNum}`;
    }

    const targetUrl = `${CARTOLA_API_BASE}${apiPath}`;
    const upstream = await fetch(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "application/json",
      },
    });

    const rawText = await upstream.text().catch(() => "");

    if (!upstream.ok) {
      res.statusCode = upstream.status;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: `Cartola API retornou ${upstream.status}`, detail: rawText.substring(0, 200) }));
      return;
    }

    if (!rawText || rawText.trim().length === 0) {
      const fallbacks: Record<string, unknown> = {
        pontuados: { atletas: {}, clubes: {}, rodada: 0 },
        destaques: { atletas_populares: [], capitaes: [], rodada_atual: 0 },
        mercado: { atletas: [], clubes: {}, posicoes: {}, status_mercado: 1, rodada_atual: 0 },
        partidas: { partidas: [], clubes: {} },
        clubes: {},
        rodada: null,
      };
      const fallback = fallbacks[String(endpoint)];
      if (fallback !== undefined) {
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(fallback));
        return;
      }

      res.statusCode = 502;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: `Resposta vazia da API do Cartola para ${endpoint}` }));
      return;
    }

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    res.end(rawText);
  } catch (e: unknown) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    const msg = e instanceof Error ? e.message : "Erro ao buscar dados do Cartola";
    res.end(JSON.stringify({ error: msg }));
  }
}
