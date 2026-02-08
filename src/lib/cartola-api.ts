import { supabase } from '@/integrations/supabase/client';

export interface CartolaClube {
  id: number;
  nome: string;
  abreviacao: string;
  escudos: {
    '60x60': string;
    '45x45': string;
    '30x30': string;
  };
}

export interface CartolaAtleta {
  atleta_id: number;
  nome: string;
  apelido: string;
  foto: string;
  clube_id: number;
  posicao_id: number;
  status_id: number;
  pontos_num: number;
  preco_num: number;
  variacao_num: number;
  media_num: number;
  jogos_num: number;
  scout?: CartolaScout;
  gato_mestre?: {
    media_pontos: number;
    media_valorizacao: number;
    minutos_jogados: number;
  };
}

export interface CartolaScout {
  G?: number;   // Gols
  A?: number;   // Assistências
  FT?: number;  // Finalizações na trave
  FD?: number;  // Finalizações defendidas
  FF?: number;  // Finalizações para fora
  FS?: number;  // Faltas sofridas
  RB?: number;  // Roubadas de bola
  PS?: number;  // Passe certo
  DS?: number;  // Desarmes
  SG?: number;  // Saldo de gols (goleiro)
  DE?: number;  // Defesas
  DP?: number;  // Defesas de pênalti
  CA?: number;  // Cartão amarelo
  CV?: number;  // Cartão vermelho
  FC?: number;  // Faltas cometidas
  GC?: number;  // Gols contra
  PP?: number;  // Pênaltis perdidos
  I?: number;   // Impedimentos
  PE?: number;  // Passes errados
  GS?: number;  // Gols sofridos
}

export interface CartolaPartida {
  partida_id: number;
  clube_casa_id: number;
  clube_visitante_id: number;
  clube_casa_posicao: number;
  clube_visitante_posicao: number;
  aproveitamento_mandante: string[];
  aproveitamento_visitante: string[];
  partida_data: string;
  local: string;
  valida: boolean;
  placar_oficial_mandante: number | null;
  placar_oficial_visitante: number | null;
}

export interface CartolaRodada {
  rodada_atual: number;
  status_mercado: number; // 1 = aberto, 2 = fechado
  temporada: number;
  game_over: boolean;
  times_escalados: number;
  fechamento: {
    dia: number;
    mes: number;
    ano: number;
    hora: number;
    minuto: number;
  };
}

export interface CartolaMercado {
  atletas: CartolaAtleta[];
  clubes: Record<string, CartolaClube>;
  posicoes: Record<string, { id: number; nome: string; abreviacao: string }>;
  status_mercado: number;
  rodada_atual: number;
  fechamento: {
    dia: number;
    mes: number;
    ano: number;
    hora: number;
    minuto: number;
  };
}

export interface CartolaAtletasPontuados {
  atletas: Record<string, {
    apelido: string;
    pontuacao: number;
    scout: CartolaScout;
    foto: string;
    posicao_id: number;
    clube_id: number;
  }>;
  clubes: Record<string, CartolaClube>;
  rodada: number;
}

async function fetchCartolaEndpoint<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
  const queryParams = new URLSearchParams({ endpoint, ...params });
  
  const { data, error } = await supabase.functions.invoke('cartola-api', {
    body: null,
    method: 'GET',
  });

  // Workaround: using POST with query params in body
  const response = await supabase.functions.invoke('cartola-api', {
    body: { endpoint, ...params },
  });

  if (response.error) {
    throw new Error(response.error.message || 'Erro ao buscar dados do Cartola');
  }

  return response.data as T;
}

export const cartolaApi = {
  // Busca todos os atletas disponíveis no mercado
  async getMercado(): Promise<CartolaMercado> {
    const { data, error } = await supabase.functions.invoke('cartola-api', {
      body: { endpoint: 'mercado' },
    });
    if (error) throw error;
    return data;
  },

  // Busca atletas que já pontuaram na rodada
  async getPontuados(): Promise<CartolaAtletasPontuados> {
    const { data, error } = await supabase.functions.invoke('cartola-api', {
      body: { endpoint: 'pontuados' },
    });
    if (error) throw error;
    return data;
  },

  // Busca partidas da rodada
  async getPartidas(rodada?: number): Promise<{ partidas: CartolaPartida[]; clubes: Record<string, CartolaClube> }> {
    const { data, error } = await supabase.functions.invoke('cartola-api', {
      body: { endpoint: 'partidas', ...(rodada && { rodada: String(rodada) }) },
    });
    if (error) throw error;
    return data;
  },

  // Busca status da rodada atual
  async getRodada(): Promise<CartolaRodada> {
    const { data, error } = await supabase.functions.invoke('cartola-api', {
      body: { endpoint: 'rodada' },
    });
    if (error) throw error;
    return data;
  },

  // Busca lista de clubes
  async getClubes(): Promise<Record<string, CartolaClube>> {
    const { data, error } = await supabase.functions.invoke('cartola-api', {
      body: { endpoint: 'clubes' },
    });
    if (error) throw error;
    return data;
  },
};
