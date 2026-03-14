import type { IncomingMessage, ServerResponse } from "http";

type Req = IncomingMessage & { body?: unknown };
type Res = ServerResponse & { setHeader(name: string, value: string): void };

const SYSTEM_PROMPT = `Você é o Super Agente Técnico do STATUS FC PRO (Cartola FC 2026), um analista profissional e pragmático de escalação.
Você cruza dados de scouts, médias e comportamento do adversário para justificar recomendações de forma objetiva.

## REGRA DO MERCADO
Antes de qualquer análise, verifique o status do mercado do Cartola.
Se o mercado estiver FECHADO, responda apenas: "O mercado está fechado no momento. Assim que o mercado abrir, estarei pronto para te dar as melhores dicas. Aguarde!"

## COMO ANALISAR (OBRIGATÓRIO)
- Use os dados fornecidos em "DADOS DA RODADA ATUAL" (confrontos, atletas relevantes e cedência de scouts).
- Para cada indicação, cite números quando existirem: Média, scouts recentes (G, A, FD, FF, DS, SG, DE), e a cedência média do adversário (ex: "cede G: 1.2/jogo").
- Compare "média básica" com "média com gols/assistências" quando possível: se o jogador depende muito de G/A para pontuar, sinalize risco; se pontua com scouts (FD/FF/DS/RB/SG/DE), sinalize consistência.
- Considere mando (Casa/Fora) do confronto na justificativa.
- Se houver inconsistência ou falta de dados, declare a limitação e sugira alternativa.

## REGRAS POR POSIÇÃO
### GOLEIROS
Prioridade: SG e defesas (DE/DP). Explique probabilidade de SG e volume de finalizações cedidas pelo adversário.

### LATERAIS E ZAGUEIROS
Prioridade: DS e SG, depois participação ofensiva (A/G). Para laterais, sempre indique LD/LE.

### MEIAS, ATACANTES E CAPITÃO
Prioridade: G e A, depois volume (FD/FF/FS) e consistência (DS).

### TÉCNICO
Escolher o time com maior probabilidade de SG somado ao potencial de scouts (gols, assistências e desarmes) dos jogadores na rodada.

## FORMATO DE RESPOSTA
- Use 🥇🥈🥉 para o top 3 e liste os demais sem medalha.
- Para cada jogador: Nome (Posição) - Clube vs Adversário (Casa/Fora) - justificativa com números.
- No final: "💡 Dica do Agente" com 1 insight prático.
- Seja direto. Máximo 300 palavras. Português do Brasil.`;

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

function writeSse(res: Res, dataLine: string) {
  res.write(`data: ${dataLine}\n\n`);
}

function streamTextAsOpenAIEvents(res: Res, fullText: string) {
  const chunkSize = 80;
  for (let i = 0; i < fullText.length; i += chunkSize) {
    const chunk = fullText.slice(i, i + chunkSize);
    writeSse(res, JSON.stringify({ choices: [{ delta: { content: chunk } }] }));
  }
  writeSse(res, "[DONE]");
  res.end();
}

async function getCartolaMarketStatus(): Promise<null | { status_mercado?: number; rodada_atual?: number }> {
  const resp = await fetch("https://api.cartola.globo.com/mercado/status", {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Accept: "application/json",
    },
  });
  if (!resp.ok) return null;
  const data = (await resp.json().catch(() => null)) as any;
  if (!data || typeof data !== "object") return null;
  return data as { status_mercado?: number; rodada_atual?: number };
}

function getLastUserMessage(messages: unknown[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (!m || typeof m !== "object") continue;
    const role = (m as any).role;
    const content = (m as any).content;
    if (role === "user" && typeof content === "string" && content.trim()) return content;
  }
  return "";
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

  const geminiApiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!geminiApiKey) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "GOOGLE_GEMINI_API_KEY não configurada na Vercel." }));
    return;
  }

  try {
    const payload = await readJsonBody(req);
    const messages = Array.isArray(payload.messages) ? payload.messages : [];
    const contextData =
      payload.contextData && typeof payload.contextData === "object" ? (payload.contextData as Record<string, unknown>) : null;

    res.statusCode = 200;
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.write(": ok\n\n");

    const market = await getCartolaMarketStatus();
    const statusMercado = market?.status_mercado;
    console.log("agente-tecnico: mercado", { status_mercado: statusMercado, rodada_atual: market?.rodada_atual });

    if (statusMercado !== 1) {
      const msg =
        "O mercado está fechado no momento. Assim que o mercado abrir, estarei pronto para te dar as melhores dicas. Aguarde!";
      streamTextAsOpenAIEvents(res, msg);
      return;
    }

    const systemWithContext = SYSTEM_PROMPT + buildContextMessage(contextData);
    const userMessage = getLastUserMessage(messages);
    const combinedText = `${systemWithContext}\n\nPergunta: ${userMessage || "Sem pergunta."}`;

    const geminiResp = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(
        geminiApiKey,
      )}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: combinedText }] }],
        }),
      },
    );
    console.log("agente-tecnico: gemini status", geminiResp.status);

    if (!geminiResp.ok) {
      const errText = await geminiResp.text().catch(() => "");
      streamTextAsOpenAIEvents(res, `Erro ao conectar com a IA (Gemini): ${errText.slice(0, 200)}`);
      return;
    }

    const geminiJson = (await geminiResp.json().catch(() => null)) as any;
    const parts = geminiJson?.candidates?.[0]?.content?.parts;
    const text =
      Array.isArray(parts) && typeof parts?.[0]?.text === "string"
        ? String(parts[0].text)
        : "";

    streamTextAsOpenAIEvents(res, text || "Erro ao processar resposta da IA (Gemini).");
  } catch (e: unknown) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: e instanceof Error ? e.message : "Erro ao conectar com o Agente Técnico" }));
  }
}
// versao chatgpt ok
// Ativando Super Agente v1.0 Profissional
