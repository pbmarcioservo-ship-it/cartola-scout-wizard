import { useQuery, useQueries } from '@tanstack/react-query';
import { cartolaApi, CartolaMercado, CartolaAtletasPontuados, CartolaRodada, CartolaClube, CartolaPartida, CartolaDestaques } from '@/lib/cartola-api';

const LS_KEY_LATERAL = 'statusfc_lateral_side_by_id';
function normName(s?: string) {
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
}
function seedLateralSides(data: CartolaMercado) {
  try {
    const raw = localStorage.getItem(LS_KEY_LATERAL);
    const store = raw ? (JSON.parse(raw) as Record<string, 'LD' | 'LE'>) : {};
    const nameSide: Record<string, 'LD' | 'LE'> = {
      // BAHIA
      'ROMAN GOMEZ': 'LD', 'LUCIANO JUBA': 'LE', 'GILBERTO': 'LD', 'IAGO': 'LE',
      // BOTAFOGO
      'MARCAL': 'LE', 'VITINHO': 'LD', 'ALEX TELLES': 'LE', 'MATEO PONTE': 'LD',
      // ATLETICO MINEIRO
      'RENAN LODI': 'LE', 'PRECIADO': 'LD', 'KAUA PASCINI': 'LE', 'NATANAEL': 'LD',
      // ATLETICO PARANAENSE
      'BENAVIDEZ': 'LD', 'LEO DERIK': 'LE', 'ESQUIVEL': 'LE',
      // CORITIBA
      'TINGA': 'LD', 'BRUNO MELO': 'LE', 'FELIPE JONATAN': 'LE', 'JP CHERMONT': 'LD',
      // CHAPECOENSE
      'WALTER CLAR': 'LE', 'EVERTON': 'LD', 'MARCOS VINICIUS': 'LD', 'BRUNO PACHECO': 'LE',
      // CORINTHIANS
      'MATHEUS BIDU': 'LE', 'MATHEUZINHO': 'LD', 'MILANS': 'LD', 'ANGILERI': 'LE', 'HUGO': 'LE',
      // CRUZEIRO
      'KAIKI BRUNO': 'LE', 'WILLIAM': 'LD', 'FAGNER': 'LD', 'KAUA MORAES': 'LD',
      // FLAMENGO
      'VARELA': 'LE', 'ALEX SANDRO': 'LE', 'EMERSON ROYAL': 'LD', 'AYRTON LUCAS': 'LE',
      // FLUMINENSE
      'RENE': 'LE', 'SAMUEL XAVIER': 'LD', 'GUILHERME ARANA': 'LE', 'GUGA': 'LD',
      // GREMIO
      'MARLON': 'LE', 'JOAO PEDRO': 'LD', 'MARCOS ROCHA': 'LD', 'CAIO PAULISTA': 'LE',
      // INTERNACIONAL
      'BERNABEI': 'LE', 'AGUIRRE': 'LD', 'MATHEUS BAHIA': 'LE', 'ALISSON': 'LE',
      // MIRASSOL
      'IGOR FORMIGA': 'LD', 'IGOR CARIUS': 'LD', 'REINALDO': 'LE', 'DANIEL BORGES': 'LD', 'VICTOR LUIS': 'LE',
      // PALMEIRAS
      'PIQUEREZ': 'LE', 'KHELLVEN': 'LD', 'GIAY': 'LD', 'JEFTE': 'LE',
      // RB BRAGANTINO
      'JUNINHO CAPIXABA': 'LE', 'SANT ANNA': 'LD', 'ANDRES HURTADO': 'LD', 'CAUE': 'LE', 'VANDERLAN': 'LE',
      // REMO
      'SAVIO': 'LE', 'JOAO LUCAS': 'LD', 'MARCELINHO': 'LD', 'CUFRE': 'LE',
      // SANTOS
      'IGOR VINICIUS': 'LD', 'ESCOBAR': 'LE', 'VINICIUS LIRA': 'LE', 'MAYKE': 'LD', 'SOUZA': 'LE',
      // SAO PAULO
      'LUCAS RAMON': 'LD', 'ENZO DIAZ': 'LE', 'WENDELL': 'LE', 'MAIK': 'LD', 'CEDRIC SOARES': 'LD',
      // VASCO
      'PUMA RODRIGUEZ': 'LD', 'PAULO HENRIQUE': 'LD', 'CUIABANO': 'LE', 'LUCAS PITON': 'LE',
      // VITORIA
      'JAMERSON': 'LE', 'RAMON': 'LE', 'MATEUS SILVA': 'LD', 'NATHAN MENDES': 'LD', 'LUAN CANDIDO': 'LE',
    };
    const laterais = data.atletas.filter(a => a.posicao_id === 2);
    const byClub: Record<number, typeof laterais> = {};
    for (const a of laterais) {
      if (!byClub[a.clube_id]) byClub[a.clube_id] = [];
      byClub[a.clube_id].push(a);
    }
    for (const [clubIdStr, arr] of Object.entries(byClub)) {
      const arrSorted = [...arr].sort((a, b) => b.jogos_num - a.jogos_num);
      const assigned: Record<number, 'LD' | 'LE'> = {};
      for (const a of arrSorted) {
        if (store[String(a.atleta_id)]) continue;
        const s = nameSide[normName(a.apelido)];
        if (s) assigned[a.atleta_id] = s;
      }
      const needAssign = arrSorted.filter(a => !assigned[a.atleta_id]);
      if (needAssign.length === 1) {
        const otherSide = Object.values(assigned).includes('LE') ? 'LD' : Object.values(assigned).includes('LD') ? 'LE' : 'LD';
        assigned[needAssign[0].atleta_id] = otherSide as 'LD' | 'LE';
      } else if (needAssign.length >= 2) {
        let toggle: 'LD' | 'LE' = Object.values(assigned).includes('LD') ? 'LE' : 'LD';
        for (const a of needAssign) {
          assigned[a.atleta_id] = toggle;
          toggle = toggle === 'LD' ? 'LE' : 'LD';
        }
      }
      for (const [aidStr, side] of Object.entries(assigned)) {
        store[aidStr] = side;
      }
    }
    localStorage.setItem(LS_KEY_LATERAL, JSON.stringify(store));
  } catch {}
}
export function useMercado() {
  const q = useQuery<CartolaMercado>({
    queryKey: ['cartola', 'mercado'],
    queryFn: () => cartolaApi.getMercado(),
    staleTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 5,
  });
  if (q.data) {
    seedLateralSides(q.data);
  }
  return q;
}

export function usePontuados() {
  return useQuery<CartolaAtletasPontuados>({
    queryKey: ['cartola', 'pontuados'],
    queryFn: () => cartolaApi.getPontuados(),
    staleTime: 1000 * 60 * 2,
    refetchInterval: 1000 * 60 * 2,
  });
}

export function useRodada() {
  return useQuery<CartolaRodada>({
    queryKey: ['cartola', 'rodada'],
    queryFn: () => cartolaApi.getRodada(),
    staleTime: 1000 * 60 * 5,
  });
}

export function usePartidas(rodada?: number) {
  return useQuery<{ partidas: CartolaPartida[]; clubes: Record<string, CartolaClube> }>({
    queryKey: ['cartola', 'partidas', rodada],
    queryFn: () => cartolaApi.getPartidas(rodada),
    staleTime: 1000 * 60 * 5,
  });
}

export function useClubes() {
  return useQuery<Record<string, CartolaClube>>({
    queryKey: ['cartola', 'clubes'],
    queryFn: () => cartolaApi.getClubes(),
    staleTime: 1000 * 60 * 60,
  });
}

export function useDestaques() {
  const { data: rodada } = useRodada();
  return useQuery({
    queryKey: ['cartola', 'destaques', rodada?.status_mercado, rodada?.rodada_atual],
    queryFn: () => cartolaApi.getDestaques(),
    staleTime: 1000 * 60,
    refetchOnWindowFocus: true,
    refetchInterval: 1000 * 60 * 2,
  });
}

// Busca pontuados das últimas N rodadas
export function useHistoricoRodadas(rodadaAtual: number | undefined, numRodadas: number = 7) {
  const rodadas = rodadaAtual
    ? Array.from({ length: numRodadas }, (_, i) => rodadaAtual - 1 - i).filter(r => r > 0)
    : [];

  const pontuadosQueries = useQueries({
    queries: rodadas.map(rodada => ({
      queryKey: ['cartola', 'pontuados-rodada', rodada],
      queryFn: () => cartolaApi.getPontuadosRodada(rodada),
      staleTime: 1000 * 60 * 30,
      enabled: !!rodadaAtual,
    })),
  });

  const partidasQueries = useQueries({
    queries: rodadas.map(rodada => ({
      queryKey: ['cartola', 'partidas', rodada],
      queryFn: () => cartolaApi.getPartidas(rodada),
      staleTime: 1000 * 60 * 30,
      enabled: !!rodadaAtual,
    })),
  });

  return {
    data: rodadas.map((rodada, i) => ({
      rodada,
      data: pontuadosQueries[i].data,
      partidas: partidasQueries[i].data,
    })),
    isLoading: pontuadosQueries.some(q => q.isLoading) || partidasQueries.some(q => q.isLoading),
    isError: pontuadosQueries.some(q => q.isError) || partidasQueries.some(q => q.isError),
  };
}

// Posições do Cartola
export const POSICOES: Record<number, { nome: string; abreviacao: string }> = {
  1: { nome: 'Goleiro', abreviacao: 'GOL' },
  2: { nome: 'Lateral', abreviacao: 'LAT' },
  3: { nome: 'Zagueiro', abreviacao: 'ZAG' },
  4: { nome: 'Meia', abreviacao: 'MEI' },
  5: { nome: 'Atacante', abreviacao: 'ATA' },
  6: { nome: 'Técnico', abreviacao: 'TEC' },
};

// Status dos atletas
export const STATUS_ATLETA: Record<number, { nome: string; cor: string }> = {
  2: { nome: 'Dúvida', cor: '#f39c12' },
  3: { nome: 'Suspenso', cor: '#e74c3c' },
  5: { nome: 'Contundido', cor: '#e74c3c' },
  6: { nome: 'Nulo', cor: '#95a5a6' },
  7: { nome: 'Provável', cor: '#27ae60' },
};
