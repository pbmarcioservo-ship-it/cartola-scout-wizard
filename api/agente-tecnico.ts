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

function sendJson(res: Res, status: number, data: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}

async function fetchJson(url: string, timeoutMs: number = 12_000): Promise<any> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "application/json",
      },
    });
    if (!resp.ok) {
      const t = await resp.text().catch(() => "");
      throw new Error(`HTTP ${resp.status} em ${url}: ${t.slice(0, 200)}`);
    }
    return await resp.json();
  } finally {
    clearTimeout(id);
  }
}

async function getCartolaMarketStatus(): Promise<null | { status_mercado?: number; rodada_atual?: number; times_escalados?: number }> {
  const resp = await fetch("https://api.cartola.globo.com/mercado/status", {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Accept: "application/json",
    },
  });
  if (!resp.ok) return null;
  const data = (await resp.json().catch(() => null)) as any;
  if (!data || typeof data !== "object") return null;
  return data as { status_mercado?: number; rodada_atual?: number; times_escalados?: number };
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

type ScoutMap = Record<string, number[]>;

function avg(vals: number[] | undefined): number {
  if (!vals || vals.length === 0) return 0;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function opponentIdForTeam(match: any, teamId: number): { opponentId: number; isHome: boolean } | null {
  if (!match) return null;
  const casa = match.clube_casa_id;
  const fora = match.clube_visitante_id;
  if (casa === teamId) return { opponentId: fora, isHome: true };
  if (fora === teamId) return { opponentId: casa, isHome: false };
  return null;
}

async function fetchMercado(): Promise<any> {
  return fetchJson("https://api.cartola.globo.com/atletas/mercado");
}

async function fetchPartidas(rodada: number): Promise<any> {
  return fetchJson(`https://api.cartola.globo.com/partidas/${rodada}`);
}

async function fetchPontuados(rodada: number): Promise<any> {
  return fetchJson(`https://api.cartola.globo.com/atletas/pontuados/${rodada}`);
}

async function buildCedenciaFromHistory(rodadaAtual: number, n: number): Promise<Record<number, ScoutMap>> {
  const cedencia: Record<number, ScoutMap> = {};
  const start = Math.max(1, rodadaAtual - n);
  const rounds: number[] = [];
  for (let r = rodadaAtual - 1; r >= start; r--) rounds.push(r);

  const payloads = await Promise.all(
    rounds.map(async (r) => {
      const [pontuados, partidas] = await Promise.all([fetchPontuados(r), fetchPartidas(r)]);
      return { r, pontuados, partidas };
    }),
  );

  for (const { pontuados, partidas } of payloads) {
    const partidasArr = partidas?.partidas || [];
    const atletas = pontuados?.atletas || {};

    for (const atleta of Object.values(atletas) as any[]) {
      const scout = atleta?.scout;
      const teamId = atleta?.clube_id;
      if (!scout || !teamId) continue;

      const match = partidasArr.find((p: any) => p.clube_casa_id === teamId || p.clube_visitante_id === teamId);
      const opp = opponentIdForTeam(match, teamId);
      if (!opp) continue;

      const opponentId = opp.opponentId;
      if (!cedencia[opponentId]) cedencia[opponentId] = {};

      for (const [k, v] of Object.entries(scout)) {
        const num = typeof v === "number" ? v : Number(v);
        if (!Number.isFinite(num) || num <= 0) continue;
        if (!cedencia[opponentId][k]) cedencia[opponentId][k] = [];
        cedencia[opponentId][k].push(num);
      }
    }
  }

  return cedencia;
}

function formatTeam(clubesById: Record<string, any>, id: number): string {
  const c = clubesById[String(id)] || clubesById[id as any];
  return c?.abreviacao || c?.nome || String(id);
}

function buildInternalInsights(params: {
  rodadaAtual: number;
  timesEscalados?: number;
  mercado: any;
  partidas: any;
  cedencia: Record<number, ScoutMap>;
}): string {
  const { rodadaAtual, timesEscalados, mercado, partidas, cedencia } = params;
  const clubesById = { ...(mercado?.clubes || {}), ...(partidas?.clubes || {}) } as Record<string, any>;
  const matches = partidas?.partidas || [];

  const teamScores = new Map<number, number>();
  for (const m of matches as any[]) {
    const casa = m.clube_casa_id;
    const fora = m.clube_visitante_id;
    const casaScore = avg(cedencia[fora]?.SG) + avg(cedencia[fora]?.G) * -0.2;
    const foraScore = avg(cedencia[casa]?.SG) + avg(cedencia[casa]?.G) * -0.2;
    teamScores.set(casa, (teamScores.get(casa) || 0) + casaScore);
    teamScores.set(fora, (teamScores.get(fora) || 0) + foraScore);
  }

  const topSG = [...teamScores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([teamId, score]) => `${formatTeam(clubesById, teamId)} (${score.toFixed(2)})`)
    .join(", ");

  const atletas = (mercado?.atletas || []) as any[];
  const atacantes = atletas
    .filter((a) => a?.posicao_id === 5 && a?.status_id === 7)
    .map((a) => {
      const match = matches.find((p: any) => p.clube_casa_id === a.clube_id || p.clube_visitante_id === a.clube_id);
      const opp = opponentIdForTeam(match, a.clube_id);
      const opponentId = opp?.opponentId;
      const g = opponentId ? avg(cedencia[opponentId]?.G) : 0;
      const as = opponentId ? avg(cedencia[opponentId]?.A) : 0;
      const fd = opponentId ? avg(cedencia[opponentId]?.FD) : 0;
      const ff = opponentId ? avg(cedencia[opponentId]?.FF) : 0;
      const score = (Number(a.media_num) || 0) * 1.6 + g * 1.2 + as * 0.7 + fd * 0.15 + ff * 0.1;
      const clube = formatTeam(clubesById, a.clube_id);
      const oppName = opponentId ? formatTeam(clubesById, opponentId) : "?";
      const mando = opp ? (opp.isHome ? "Casa" : "Fora") : "?";
      return { a, score, clube, oppName, mando, g, as };
    })
    .sort((x, y) => y.score - x.score)
    .slice(0, 5)
    .map((x) => `${x.a.apelido} (${x.clube} vs ${x.oppName} - ${x.mando}) Média ${Number(x.a.media_num || 0).toFixed(2)} • Adversário cede G ${x.g.toFixed(1)}/j, A ${x.as.toFixed(1)}/j`);

  const atacantesStr = atacantes.length ? atacantes.map((s, i) => `${i + 1}. ${s}`).join("\n") : "Sem dados suficientes para ranquear atacantes.";
  const timesEscaladosStr = typeof timesEscalados === "number" ? String(timesEscalados) : "?";

  return `\n\n## CONTEXTO TOTAL (STATUS FC PRO)\nBaseado nos nossos cálculos internos:\n- Rodada ativa: ${rodadaAtual}\n- Times escalados: ${timesEscaladosStr}\n- Tops de SG: ${topSG || "Sem dados suficientes"}\n- Melhores atacantes:\n${atacantesStr}\n`;
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
    sendJson(res, 500, { error: "GOOGLE_GEMINI_API_KEY não configurada na Vercel." });
    return;
  }

  try {
    const payload = await readJsonBody(req);
    const messages = Array.isArray(payload.messages) ? payload.messages : [];
    const contextData =
      payload.contextData && typeof payload.contextData === "object" ? (payload.contextData as Record<string, unknown>) : null;

    const market = await getCartolaMarketStatus();
    const statusMercado = market?.status_mercado;
    const rodadaAtual = Number(market?.rodada_atual || 0) || (typeof contextData?.rodada === "number" ? contextData.rodada : 0);

    const wantJson =
      typeof req.url === "string" && req.url.includes("format=json")
        ? true
        : (payload as any)?.format === "json";

    if (wantJson) {
      if (statusMercado !== 1) {
        sendJson(res, 200, {
          resposta:
            "O mercado está fechado no momento. Assim que o mercado abrir, estarei pronto para te dar as melhores dicas. Aguarde!",
        });
        return;
      }
    } else {
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.write(": ok\n\n");
    }

    if (statusMercado !== 1) {
      const msg =
        "O mercado está fechado no momento. Assim que o mercado abrir, estarei pronto para te dar as melhores dicas. Aguarde!";
      if (wantJson) sendJson(res, 200, { resposta: msg });
      else streamTextAsOpenAIEvents(res, msg);
      return;
    }

    const [mercado, partidas, cedencia] = await Promise.all([
      fetchMercado(),
      fetchPartidas(rodadaAtual),
      buildCedenciaFromHistory(rodadaAtual, 6),
    ]);

    const internalInsights = buildInternalInsights({
      rodadaAtual,
      timesEscalados: market?.times_escalados,
      mercado,
      partidas,
      cedencia,
    });

    const systemWithContext = SYSTEM_PROMPT + internalInsights + buildContextMessage(contextData);
    const userMessage = getLastUserMessage(messages);
    const combinedText = `${systemWithContext}\n\nPergunta: ${userMessage || "Sem pergunta."}`;

    const geminiResp = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash-latest:generateContent?key=${encodeURIComponent(
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
    const text = geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text;

    const finalText = typeof text === "string" && text.trim() ? text : "Erro ao processar resposta da IA (Gemini).";
    if (wantJson) {
      sendJson(res, 200, { resposta: finalText });
      return;
    }
    streamTextAsOpenAIEvents(res, finalText);
  } catch (e: unknown) {
    sendJson(res, 500, { error: e instanceof Error ? e.message : "Erro ao conectar com o Agente Técnico" });
  }
}
// Ativando Agente Porta-Voz da Inteligência Interna v8
