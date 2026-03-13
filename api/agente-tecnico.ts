import type { IncomingMessage, ServerResponse } from "http";
import { Readable } from "stream";

type Req = IncomingMessage & { body?: unknown };
type Res = ServerResponse & { setHeader(name: string, value: string): void };

const SYSTEM_PROMPT = `Você é o Agente Técnico do StatusFC, um assistente especialista em escalação do Cartola FC 2026.
Você analisa dados reais de scouts, médias e confrontos para recomendar jogadores.

## REGRAS DE ANÁLISE POR POSIÇÃO

### GOLEIROS
1º Critério: Maior probabilidade de SG (Saldo de Gols / jogo sem sofrer gol).
2º Critério (Desempate): Potencial de defesas — verificar se o adversário cede mais de 3 defesas em média nas últimas rodadas. Quanto maior a cedência de defesas acima de 3, melhor o goleiro no ranking.

### LATERAIS E ZAGUEIROS
Prioridade de scouts: 1º Desarmes (DS), 2º Assistência (A), 3º Gol (G).
Para laterais, sempre indicar se é LD (Lateral Direito) ou LE (Lateral Esquerdo).

### MEIAS, ATACANTES E CAPITÃO
Prioridade de scouts: 1º Gol (G), 2º Assistência (A), 3º Finalização Defendida (FD), 4º Finalização para Fora (FF), 5º Falta Sofrida (FS), 6º Desarme (DS).

### TÉCNICO
Escolher o time com maior probabilidade de SG somado ao potencial de scouts (gols, assistências e desarmes) dos jogadores na rodada.

## MÉTODO DE ANÁLISE
1. Identificar o adversário de cada jogador na rodada atual.
2. Verificar o histórico de scouts CEDIDOS pelo adversário nas últimas rodadas (seção de confrontos).
3. Cruzar com as médias individuais do jogador.
4. Ranquear conforme a prioridade de scouts da posição.

## FORMATO DE RESPOSTA
- Use o sistema de PÓDIO com medalhas para qualificar suas indicações:
  - Se indicar apenas 1 jogador claro favorito: use 🥇 (Ouro).
  - Se indicar 2 destaques: use 🥇 (Ouro) para o melhor e 🥈 (Prata) para o segundo.
  - Se indicar 3 ou mais: use 🥇, 🥈 e 🥉 (Bronze) para o top 3, e liste os demais normalmente.
  - Você tem autonomia para decidir quantos indicar com medalha conforme a força dos dados.
- Use emojis complementares para facilitar leitura (🔥 para recomendação forte, ⚠️ para ressalva).
- Inclua: Nome (Posição) - Clube vs Adversário - Motivo.
- Para laterais sempre indique (LD) ou (LE).
- Ao final, adicione uma "💡 Dica do Agente" com um insight extra quando relevante.
- Seja objetivo e direto. Máximo 300 palavras.
- Responda SEMPRE em português brasileiro.`;

const ALLOWED_ORIGINS = new Set([
  "https://statusfcpro.com",
  "https://www.statusfcpro.com",
  "http://localhost:8080",
  "http://localhost:5173",
  "https://cartola-scout-wizard.vercel.app",
]);

function setCors(req: Req, res: Res) {
  const origin = (req.headers.origin || "").toString();
  const allowOrigin = ALLOWED_ORIGINS.has(origin) ? origin : "*";
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Origin", allowOrigin);
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

function buildContextMessage(contextData: Record<string, unknown> | null): string {
  if (!contextData) return "";

  const rodada = typeof contextData.rodada === "number" || typeof contextData.rodada === "string" ? String(contextData.rodada) : "?";
  let msg = `\n\n## DADOS DA RODADA ATUAL (Rodada ${rodada})\n`;

  if (typeof contextData.partidas === "string" && contextData.partidas) {
    msg += "\n### CONFRONTOS DA RODADA:\n";
    msg += contextData.partidas + "\n";
  }

  if (typeof contextData.atletasRelevantes === "string" && contextData.atletasRelevantes) {
    msg += "\n### ATLETAS RELEVANTES (com médias e scouts):\n";
    msg += contextData.atletasRelevantes + "\n";
  }

  if (typeof contextData.cedenciaAdversarios === "string" && contextData.cedenciaAdversarios) {
    msg += "\n### SCOUTS CEDIDOS PELOS ADVERSÁRIOS (últimas rodadas):\n";
    msg += contextData.cedenciaAdversarios + "\n";
  }

  if (typeof contextData.laterais === "string" && contextData.laterais) {
    msg += "\n### LATERAIS (LD/LE):\n";
    msg += contextData.laterais + "\n";
  }

  return msg;
}

export default async function handler(req: Req, res: Res) {
  setCors(req, res);

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

  const lovableApiKey = process.env.LOVABLE_API_KEY;
  if (!lovableApiKey) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "LOVABLE_API_KEY não configurada na Vercel." }));
    return;
  }

  try {
    const payload = await readJsonBody(req);
    const messages = Array.isArray(payload.messages) ? payload.messages : [];
    const contextData =
      payload.contextData && typeof payload.contextData === "object" ? (payload.contextData as Record<string, unknown>) : null;

    const systemWithContext = SYSTEM_PROMPT + buildContextMessage(contextData);
    const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: systemWithContext }, ...messages],
        stream: true,
      }),
    });

    res.statusCode = upstream.status;
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/json");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

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
