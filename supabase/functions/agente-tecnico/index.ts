import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Authenticate the caller
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, contextData } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Build context message from data
    let contextMessage = "";
    if (contextData) {
      contextMessage = `\n\n## DADOS DA RODADA ATUAL (Rodada ${contextData.rodada || "?"})\n`;
      
      if (contextData.partidas) {
        contextMessage += "\n### CONFRONTOS DA RODADA:\n";
        contextMessage += contextData.partidas + "\n";
      }
      
      if (contextData.atletasRelevantes) {
        contextMessage += "\n### ATLETAS RELEVANTES (com médias e scouts):\n";
        contextMessage += contextData.atletasRelevantes + "\n";
      }

      if (contextData.cedenciaAdversarios) {
        contextMessage += "\n### SCOUTS CEDIDOS PELOS ADVERSÁRIOS (últimas rodadas):\n";
        contextMessage += contextData.cedenciaAdversarios + "\n";
      }

      if (contextData.laterais) {
        contextMessage += "\n### LATERAIS (LD/LE):\n";
        contextMessage += contextData.laterais + "\n";
      }
    }

    const systemWithContext = SYSTEM_PROMPT + contextMessage;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemWithContext },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos no workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro no gateway de IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("agente-tecnico error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
