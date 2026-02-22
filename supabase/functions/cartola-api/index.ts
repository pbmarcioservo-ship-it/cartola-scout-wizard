import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // Add rodada param if provided
    if (rodada && (endpoint === 'partidas' || endpoint === 'pontuados-rodada')) {
      apiPath = `${apiPath}/${rodada}`;
    }

    const targetUrl = `${CARTOLA_API_BASE}${apiPath}`;
    const tryFetch = async (url: string) => {
      return await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
        },
      });
    };
    let response = await tryFetch(targetUrl);
    if (!response.ok) {
      const allOrigins = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
      response = await tryFetch(allOrigins);
    }
    if (!response.ok) {
      const corsAnywhere = `https://cors-anywhere.herokuapp.com/${targetUrl}`;
      response = await tryFetch(corsAnywhere);
    }

    if (!response.ok) {
      console.error(`Cartola API error: ${response.status}`);
      return new Response(
        JSON.stringify({ error: `Cartola API retornou ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log(`Successfully fetched ${endpoint} data`);

    return new Response(
      JSON.stringify(data),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error fetching Cartola API:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erro ao buscar dados do Cartola' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
