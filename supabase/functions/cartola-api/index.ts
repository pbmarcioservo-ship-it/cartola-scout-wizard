import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
const CARTOLA_API_BASE = 'https://api.cartola.globo.com';

interface CartolaEndpoint {
  path: string;
  description: string;
}

const endpoints: Record<string, CartolaEndpoint> = {
  'mercado': { path: '/atletas/mercado', description: 'Mercado de atletas' },
  'pontuados': { path: '/atletas/pontuados', description: 'Atletas pontuados da rodada' },
  'partidas': { path: '/partidas', description: 'Partidas da rodada' },
  'rodada': { path: '/mercado/status', description: 'Status do mercado/rodada' },
  'clubes': { path: '/clubes', description: 'Lista de clubes' },
  'posicoes': { path: '/atletas/posicoes', description: 'Posições dos atletas' },
  'pontuados-rodada': { path: '/atletas/pontuados', description: 'Pontuados de uma rodada específica' },
  'destaques': { path: '/mercado/destaques', description: 'Mais escalados da rodada' },
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let endpoint = 'mercado';
    let rodada: string | null = null;

    // Handle both GET query params and POST body
    if (req.method === 'POST') {
      try {
        const body = await req.json();
        endpoint = body.endpoint || 'mercado';
        rodada = body.rodada || null;
      } catch {
        // If body parsing fails, use defaults
      }
    } else {
      const url = new URL(req.url);
      endpoint = url.searchParams.get('endpoint') || 'mercado';
      rodada = url.searchParams.get('rodada');
    }

    console.log(`Fetching Cartola API: ${endpoint}`);

    let apiPath = endpoints[endpoint]?.path;
    
    if (!apiPath) {
      return new Response(
        JSON.stringify({ error: 'Endpoint não encontrado', availableEndpoints: Object.keys(endpoints) }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Add rodada param if provided (sanitized to positive integer)
    if (rodada && (endpoint === 'partidas' || endpoint === 'pontuados-rodada')) {
      const rodadaNum = parseInt(rodada, 10);
      if (!Number.isInteger(rodadaNum) || rodadaNum < 1 || rodadaNum > 100) {
        return new Response(
          JSON.stringify({ error: 'Parâmetro rodada inválido. Deve ser um número inteiro positivo.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      apiPath = `${apiPath}/${rodadaNum}`;
    }

    const targetUrl = `${CARTOLA_API_BASE}${apiPath}`;
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`Cartola API error: ${response.status}`);
      const errText = await response.text().catch(() => '');
      return new Response(
        JSON.stringify({ error: `Cartola API retornou ${response.status}`, detail: errText.substring(0, 200) }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const rawText = await response.text();
    if (!rawText || rawText.trim().length === 0) {
      console.error(`Empty response from Cartola API for ${endpoint}`);
      return new Response(
        JSON.stringify({ error: `Resposta vazia da API do Cartola para ${endpoint}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let data: unknown;
    try {
      data = JSON.parse(rawText);
    } catch {
      // Try to recover truncated JSON
      const lastBrace = rawText.lastIndexOf('}');
      if (lastBrace > 0) {
        try {
          data = JSON.parse(rawText.substring(0, lastBrace + 1) + (rawText.trimStart().startsWith('[') ? ']' : ''));
          console.warn(`Recovered truncated JSON for ${endpoint}`);
        } catch {
          console.error(`Cannot parse response for ${endpoint}: ${rawText.substring(0, 100)}`);
          return new Response(
            JSON.stringify({ error: 'Resposta inválida da API do Cartola' }),
            { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else {
        return new Response(
          JSON.stringify({ error: 'Resposta inválida da API do Cartola' }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    console.log(`Successfully fetched ${endpoint} data`);

    return new Response(
      JSON.stringify(data),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error fetching Cartola API:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message || 'Erro ao buscar dados do Cartola' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
