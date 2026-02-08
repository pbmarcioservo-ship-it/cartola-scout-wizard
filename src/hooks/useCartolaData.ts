import { useQuery } from '@tanstack/react-query';
import { cartolaApi, CartolaMercado, CartolaAtletasPontuados, CartolaRodada, CartolaClube, CartolaPartida } from '@/lib/cartola-api';

export function useMercado() {
  return useQuery<CartolaMercado>({
    queryKey: ['cartola', 'mercado'],
    queryFn: () => cartolaApi.getMercado(),
    staleTime: 1000 * 60 * 5, // 5 minutos
    refetchInterval: 1000 * 60 * 5,
  });
}

export function usePontuados() {
  return useQuery<CartolaAtletasPontuados>({
    queryKey: ['cartola', 'pontuados'],
    queryFn: () => cartolaApi.getPontuados(),
    staleTime: 1000 * 60 * 2, // 2 minutos
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
    staleTime: 1000 * 60 * 60, // 1 hora
  });
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
