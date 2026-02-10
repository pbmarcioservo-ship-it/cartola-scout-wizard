import { useQuery, useQueries } from '@tanstack/react-query';
import { cartolaApi, CartolaMercado, CartolaAtletasPontuados, CartolaRodada, CartolaClube, CartolaPartida } from '@/lib/cartola-api';

export function useMercado() {
  return useQuery<CartolaMercado>({
    queryKey: ['cartola', 'mercado'],
    queryFn: () => cartolaApi.getMercado(),
    staleTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 5,
  });
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

// Busca pontuados das últimas N rodadas
export function useHistoricoRodadas(rodadaAtual: number | undefined, numRodadas: number = 7) {
  const rodadas = rodadaAtual
    ? Array.from({ length: numRodadas }, (_, i) => rodadaAtual - 1 - i).filter(r => r > 0)
    : [];

  const queries = useQueries({
    queries: rodadas.map(rodada => ({
      queryKey: ['cartola', 'pontuados-rodada', rodada],
      queryFn: () => cartolaApi.getPontuadosRodada(rodada),
      staleTime: 1000 * 60 * 30, // 30 min cache for historical data
      enabled: !!rodadaAtual,
    })),
  });

  return {
    data: queries.map((q, i) => ({ rodada: rodadas[i], data: q.data })),
    isLoading: queries.some(q => q.isLoading),
    isError: queries.some(q => q.isError),
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
