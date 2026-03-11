import { useState, useMemo, useEffect, useCallback } from 'react';
import { ClubeEscudo } from '@/components/ClubeEscudo';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { PlayerDetailModal } from '@/components/PlayerDetailModal';
import { useMercado, useRodada, usePartidas, useHistoricoRodadas, usePontuados, POSICOES } from '@/hooks/useCartolaData';
import { CartolaAtleta, CartolaClube } from '@/lib/cartola-api';
import { AlertCircle, RefreshCw, ArrowUp, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

const LS_KEY_LATERAL = 'statusfc_lateral_side_by_id';
function getLateralSideFromStore(atletaId: number): 'LD' | 'LE' | null {
  try {
    const raw = localStorage.getItem(LS_KEY_LATERAL);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, 'LD' | 'LE'>;
    return map[String(atletaId)] || null;
  } catch { return null; }
}

type Estrategia = 'tiro-curto' | 'bom-e-barato' | 'liga-classica' | 'valorizacao';
type StatusFilter = 'provavel' | 'duvida';

interface BenchSlot {
  atleta: CartolaAtleta;
  posicaoId: number;
  isLuxo: boolean; // Reserva de Luxo (atacante)
}

interface Lineup {
  gk: CartolaAtleta | null;
  lats: CartolaAtleta[];
  zags: CartolaAtleta[];
  meis: CartolaAtleta[];
  atacs: CartolaAtleta[];
  tecnico: CartolaAtleta | null;
  capitaoId: number | null;
  bench: BenchSlot[];
}

interface SubstitutionInfo {
  outId: number;
  inId: number;
  reason: 'ausencia' | 'luxo';
}

const POSICAO_ID_MAP: Record<string, number> = {
  goleiro: 1, lateral: 2, zagueiro: 3, meia: 4, atacante: 5, tecnico: 6,
};

export function TimeRodadaView() {
  const [estrategia, setEstrategia] = useState<Estrategia>('liga-classica');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('provavel');
  const [lineup, setLineup] = useState<Lineup | null>(null);
  const [seed, setSeed] = useState(0);
  const [selectedAtleta, setSelectedAtleta] = useState<CartolaAtleta | null>(null);
  const [viewRodada, setViewRodada] = useState<number | null>(null);
  const [livePontos, setLivePontos] = useState(0);
  const [substitutions, setSubstitutions] = useState<SubstitutionInfo[]>([]);

  const { data: mercadoData, isLoading: loadingMercado } = useMercado();
  const { data: rodadaData } = useRodada();
  const { data: partidasData, isLoading: loadingPartidas } = usePartidas();
  const { data: pontuadosData } = usePontuados();
  const rodadaAtual = rodadaData?.rodada_atual;
  const mercadoAberto = rodadaData?.status_mercado === 1;
  const { data: historicoData, isLoading: loadingHistorico } = useHistoricoRodadas(rodadaAtual, 7);

  const isLoading = loadingMercado || loadingPartidas || loadingHistorico;
  const partidas = partidasData?.partidas || [];
  const clubes = mercadoData?.clubes || {};

  // ── Crossover data ──
  const crossovers = useMemo(() => {
    const keys = ['SG', 'DE', 'DS', 'G', 'A', 'FD', 'FF', 'FT', 'FS', 'RB'] as const;
    type RecordType = { conquistaCasa: Record<number, number>; conquistaFora: Record<number, number>; cedeCasa: Record<number, number>; cedeFora: Record<number, number> };
    const blank = (): RecordType => ({ conquistaCasa: {}, conquistaFora: {}, cedeCasa: {}, cedeFora: {} });
    const agg: Record<string, RecordType> = {};
    for (const k of keys) agg[k] = blank();
    if (!historicoData) return agg;
    for (const h of historicoData) {
      if (!h.data?.atletas || !h.partidas?.partidas) continue;
      for (const [, a] of Object.entries(h.data.atletas)) {
        const clubeId = a.clube_id;
        const partida = h.partidas.partidas.find(p => p.clube_casa_id === clubeId || p.clube_visitante_id === clubeId);
        if (!partida) continue;
        const isHome = partida.clube_casa_id === clubeId;
        const opponentId = isHome ? partida.clube_visitante_id : partida.clube_casa_id;
        for (const k of keys) {
          const val = Number((a.scout as any)?.[k] || 0);
          if (val <= 0) continue;
          if (isHome) {
            agg[k].conquistaCasa[clubeId] = (agg[k].conquistaCasa[clubeId] || 0) + val;
            agg[k].cedeFora[opponentId] = (agg[k].cedeFora[opponentId] || 0) + val;
          } else {
            agg[k].conquistaFora[clubeId] = (agg[k].conquistaFora[clubeId] || 0) + val;
            agg[k].cedeCasa[opponentId] = (agg[k].cedeCasa[opponentId] || 0) + val;
          }
        }
      }
    }
    return agg;
  }, [historicoData]);

  const teamScoreForMatch = useCallback((teamId: number, opponentId: number, isHome: boolean, key: string) => {
    const maps = crossovers[key];
    if (!maps) return 0;
    return isHome
      ? (maps.conquistaCasa[teamId] || 0) + (maps.cedeFora[opponentId] || 0)
      : (maps.conquistaFora[teamId] || 0) + (maps.cedeCasa[opponentId] || 0);
  }, [crossovers]);

  const acumulados = useMemo(() => {
    const acc: Record<number, Record<string, number>> = {};
    if (!historicoData) return acc;
    for (const h of historicoData) {
      if (!h.data?.atletas) continue;
      for (const [idStr, a] of Object.entries(h.data.atletas)) {
        const id = Number(idStr);
        if (!acc[id]) acc[id] = {};
        for (const [k, v] of Object.entries(a.scout || {})) {
          acc[id][k] = (acc[id][k] || 0) + Number(v || 0);
        }
      }
    }
    return acc;
  }, [historicoData]);

  const getOpponent = useCallback((clubId: number) => {
    const p = partidas.find(p => p.clube_casa_id === clubId || p.clube_visitante_id === clubId);
    if (!p) return null;
    const isHome = p.clube_casa_id === clubId;
    return { opponentId: isHome ? p.clube_visitante_id : p.clube_casa_id, isHome };
  }, [partidas]);

  const topSGTeams = useMemo(() => {
    const entries: { teamId: number; score: number }[] = [];
    for (const p of partidas) {
      entries.push({ teamId: p.clube_casa_id, score: teamScoreForMatch(p.clube_casa_id, p.clube_visitante_id, true, 'SG') });
      entries.push({ teamId: p.clube_visitante_id, score: teamScoreForMatch(p.clube_visitante_id, p.clube_casa_id, false, 'SG') });
    }
    const best: Record<number, number> = {};
    for (const e of entries) {
      if (!best[e.teamId] || e.score > best[e.teamId]) best[e.teamId] = e.score;
    }
    return Object.entries(best).map(([id, s]) => ({ teamId: Number(id), score: s })).sort((a, b) => b.score - a.score);
  }, [partidas, teamScoreForMatch]);

  const eligibleAtletas = useMemo(() => {
    if (!mercadoData?.atletas) return [];
    if (statusFilter === 'provavel') return mercadoData.atletas.filter(a => a.status_id === 7);
    return mercadoData.atletas.filter(a => a.status_id === 7 || a.status_id === 2);
  }, [mercadoData, statusFilter]);

  // ── STRATEGY ENGINE ──
  const generateLineup = useCallback((strat: Estrategia, seedVal: number): Lineup => {
    const used = new Set<number>();
    const usedClubes: Record<string, number> = {};
    let defenseTeamId: number | null = null;
    let defenseOpponentId: number | null = null;

    const pool = [...eligibleAtletas];
    const allAtletas = mercadoData?.atletas || [];

    const getForPos = (posId: number, count: number, opts?: {
      maxPrice?: number;
      scoreFn?: (a: CartolaAtleta) => number;
      allowSameClubDefense?: boolean;
      forceClub?: number;
      maxPerClub?: number;
      useFullPool?: boolean;
    }) => {
      const maxPerClub = opts?.maxPerClub ?? (posId === 4 || posId === 5 ? 1 : 3);
      const sourcePool = opts?.useFullPool ? allAtletas : pool;
      let candidates = sourcePool.filter(a => {
        if (a.posicao_id !== posId) return false;
        if (used.has(a.atleta_id)) return false;
        if (opts?.maxPrice && a.preco_num > opts.maxPrice) return false;
        if (opts?.forceClub && a.clube_id !== opts.forceClub) return false;
        if ((posId === 4 || posId === 5 || posId === 2 || posId === 3) && !opts?.allowSameClubDefense) {
          if (defenseOpponentId && a.clube_id === defenseOpponentId) return false;
        }
        return true;
      });

      const scoreFn = opts?.scoreFn || ((a: CartolaAtleta) => {
        const opp = getOpponent(a.clube_id);
        if (!opp) return a.media_num;
        if (posId === 1) return teamScoreForMatch(a.clube_id, opp.opponentId, opp.isHome, 'SG') * 1.0 + teamScoreForMatch(a.clube_id, opp.opponentId, opp.isHome, 'DE') * 0.7;
        if (posId === 2 || posId === 3) return teamScoreForMatch(a.clube_id, opp.opponentId, opp.isHome, 'SG') * 1.0 + teamScoreForMatch(a.clube_id, opp.opponentId, opp.isHome, 'DS') * 0.6;
        if (posId === 4 || posId === 5) return teamScoreForMatch(a.clube_id, opp.opponentId, opp.isHome, 'G') * 1.0 + teamScoreForMatch(a.clube_id, opp.opponentId, opp.isHome, 'A') * 0.7 + teamScoreForMatch(a.clube_id, opp.opponentId, opp.isHome, 'FD') * 0.3;
        if (posId === 6) {
          const sg = teamScoreForMatch(a.clube_id, opp.opponentId, opp.isHome, 'SG');
          const g = teamScoreForMatch(a.clube_id, opp.opponentId, opp.isHome, 'G');
          const oppG = teamScoreForMatch(opp.opponentId, a.clube_id, !opp.isHome, 'G');
          return (sg + Math.max(g - oppG, 0)) / 2;
        }
        return a.media_num;
      });

      const scored = candidates.map(a => ({ a, s: scoreFn(a) }));
      scored.sort((x, y) => y.s - x.s);

      const topN = Math.min(scored.length, count * 3);
      const topSlice = scored.slice(0, topN);
      for (let i = topSlice.length - 1; i > 0; i--) {
        const j = Math.abs(((seedVal * 9301 + 49297 + i * 233) % 233280)) % (i + 1);
        [topSlice[i], topSlice[j]] = [topSlice[j], topSlice[i]];
      }
      topSlice.sort((x, y) => {
        const diff = y.s - x.s;
        const noise = ((seedVal * 7 + x.a.atleta_id * 3) % 10) - 5;
        return diff + noise * 0.1;
      });

      const result: CartolaAtleta[] = [];
      const clubCount: Record<number, number> = {};
      for (const { a } of topSlice) {
        if (result.length >= count) break;
        const cc = clubCount[a.clube_id] || 0;
        if (cc >= maxPerClub) continue;
        if (posId === 4 || posId === 5) {
          const globalClubCount = (usedClubes[String(a.clube_id)] || 0);
          if (globalClubCount >= 1) continue;
        }
        result.push(a);
        clubCount[a.clube_id] = cc + 1;
        used.add(a.atleta_id);
        if (posId === 4 || posId === 5) {
          usedClubes[String(a.clube_id)] = (usedClubes[String(a.clube_id)] || 0) + 1;
        }
      }
      return result;
    };

    const fillGap = (posId: number, needed: number, existing: CartolaAtleta[]): CartolaAtleta[] => {
      if (existing.length >= needed) return existing;
      const missing = needed - existing.length;
      let extras = getForPos(posId, missing, { allowSameClubDefense: true, maxPerClub: 99 });
      if (extras.length < missing) {
        const stillNeeded = missing - extras.length;
        const fallback = getForPos(posId, stillNeeded, { allowSameClubDefense: true, maxPerClub: 99, useFullPool: true });
        extras = [...extras, ...fallback];
      }
      return [...existing, ...extras];
    };

    const fillSingle = (posId: number, current: CartolaAtleta | null): CartolaAtleta | null => {
      if (current) return current;
      const arr = fillGap(posId, 1, []);
      return arr[0] || null;
    };

    const pickCaptain = (lineup: Omit<Lineup, 'capitaoId' | 'bench'>): number | null => {
      const candidates = [...lineup.meis, ...lineup.atacs].filter(Boolean);
      if (candidates.length === 0) return null;
      const scored = candidates.map(a => {
        const opp = getOpponent(a.clube_id);
        let goalProb = 0;
        if (opp) goalProb = teamScoreForMatch(a.clube_id, opp.opponentId, opp.isHome, 'G');
        let score = a.media_num * 2 + goalProb;
        if (a.posicao_id === 5) score *= 1.10;
        return { a, score };
      });
      scored.sort((x, y) => y.score - x.score);
      return scored[0]?.a.atleta_id || null;
    };

    // ── Pick bench reserve for a position (must be cheaper than cheapest starter) ──
    const pickBenchForPos = (posId: number, starters: CartolaAtleta[], scoreFn?: (a: CartolaAtleta) => number): CartolaAtleta | null => {
      const cheapestStarter = starters.length > 0
        ? Math.min(...starters.map(a => a.preco_num))
        : Infinity;

      const sourcePool = pool.length > 0 ? pool : allAtletas;
      let candidates = sourcePool.filter(a => {
        if (a.posicao_id !== posId) return false;
        if (used.has(a.atleta_id)) return false;
        if (a.preco_num >= cheapestStarter) return false;
        return true;
      });

      // If no cheaper option, relax price constraint
      if (candidates.length === 0) {
        candidates = sourcePool.filter(a => {
          if (a.posicao_id !== posId) return false;
          if (used.has(a.atleta_id)) return false;
          return true;
        });
      }

      if (candidates.length === 0) return null;

      const defaultScore = (a: CartolaAtleta) => a.media_num;
      const fn = scoreFn || defaultScore;
      candidates.sort((a, b) => fn(b) - fn(a));
      const pick = candidates[0];
      used.add(pick.atleta_id);
      return pick;
    };

    let raw: Omit<Lineup, 'capitaoId' | 'bench'>;
    let stratScoreFn: ((a: CartolaAtleta) => number) | undefined;

    if (strat === 'tiro-curto') {
      const sgTeam = topSGTeams[0];
      if (sgTeam) {
        defenseTeamId = sgTeam.teamId;
        const opp = getOpponent(sgTeam.teamId);
        defenseOpponentId = opp?.opponentId || null;
      }
      const forceClub = defenseTeamId || undefined;
      const gkArr = getForPos(1, 1, { forceClub, allowSameClubDefense: true, maxPerClub: 1 });
      let gk = gkArr[0] || null;
      if (!gk) { gk = getForPos(1, 1, { allowSameClubDefense: true })[0] || null; if (gk) used.add(gk.atleta_id); }
      let lats = getForPos(2, 2, { forceClub, allowSameClubDefense: true, maxPerClub: 2 });
      if (lats.length < 2) lats.push(...getForPos(2, 2 - lats.length, {}));
      let zags = getForPos(3, 2, { forceClub, allowSameClubDefense: true, maxPerClub: 2 });
      if (zags.length < 2) zags.push(...getForPos(3, 2 - zags.length, {}));
      let tecnico = getForPos(6, 1, { forceClub, allowSameClubDefense: true })[0]
        || getForPos(6, 1, {})[0] || null;
      let meis = getForPos(4, 3, {});
      let atacs = getForPos(5, 3, {});
      gk = fillSingle(1, gk);
      lats = fillGap(2, 2, lats);
      zags = fillGap(3, 2, zags);
      meis = fillGap(4, 3, meis);
      atacs = fillGap(5, 3, atacs);
      tecnico = fillSingle(6, tecnico);
      raw = { gk, lats, zags, meis, atacs, tecnico };

    } else if (strat === 'bom-e-barato') {
      const costBenefitScore = (a: CartolaAtleta) => {
        const price = Math.max(a.preco_num, 0.1);
        const opp = getOpponent(a.clube_id);
        let scoutBonus = 0;
        if (opp) {
          const g = teamScoreForMatch(a.clube_id, opp.opponentId, opp.isHome, 'G');
          const as = teamScoreForMatch(a.clube_id, opp.opponentId, opp.isHome, 'A');
          const sg = teamScoreForMatch(a.clube_id, opp.opponentId, opp.isHome, 'SG');
          scoutBonus = (g + as + sg) * 0.2;
        }
        return (a.media_num + scoutBonus) / price;
      };
      stratScoreFn = costBenefitScore;
      const maxPrice = 10;
      let gk = getForPos(1, 1, { maxPrice, scoreFn: costBenefitScore })[0] || null;
      if (gk) { const opp = getOpponent(gk.clube_id); defenseOpponentId = opp?.opponentId || null; }
      let zags = getForPos(3, 2, { maxPrice, scoreFn: costBenefitScore, maxPerClub: 2 });
      let lats = getForPos(2, 2, { maxPrice, scoreFn: costBenefitScore, maxPerClub: 2 });
      let meis = getForPos(4, 3, { maxPrice, scoreFn: costBenefitScore });
      let atacs = getForPos(5, 3, { maxPrice, scoreFn: costBenefitScore });
      let tecnico = getForPos(6, 1, { maxPrice, scoreFn: costBenefitScore })[0] || null;
      gk = fillSingle(1, gk);
      lats = fillGap(2, 2, lats);
      zags = fillGap(3, 2, zags);
      meis = fillGap(4, 3, meis);
      atacs = fillGap(5, 3, atacs);
      tecnico = fillSingle(6, tecnico);
      raw = { gk, lats, zags, meis, atacs, tecnico };

    } else if (strat === 'valorizacao') {
      const calcMinValorizar = (a: CartolaAtleta) => {
        if (a.jogos_num === 0) return a.preco_num * 0.29;
        if (a.jogos_num === 1) return a.preco_num * 0.50;
        return (a.preco_num * 0.55) + (a.pontos_num * 0.30);
      };
      const valorizacaoScore = (a: CartolaAtleta) => {
        const minVal = Math.max(calcMinValorizar(a), 0.1);
        const opp = getOpponent(a.clube_id);
        let crossScore = 0;
        if (opp) {
          if (a.posicao_id === 1 || a.posicao_id === 3) {
            crossScore = teamScoreForMatch(a.clube_id, opp.opponentId, opp.isHome, 'SG') * 1.0
              + teamScoreForMatch(a.clube_id, opp.opponentId, opp.isHome, 'DE') * 0.5;
          } else if (a.posicao_id === 2) {
            crossScore = teamScoreForMatch(a.clube_id, opp.opponentId, opp.isHome, 'SG') * 0.8
              + teamScoreForMatch(a.clube_id, opp.opponentId, opp.isHome, 'DS') * 0.5
              + teamScoreForMatch(a.clube_id, opp.opponentId, opp.isHome, 'A') * 0.4;
          } else if (a.posicao_id === 4) {
            crossScore = teamScoreForMatch(a.clube_id, opp.opponentId, opp.isHome, 'G') * 1.0
              + teamScoreForMatch(a.clube_id, opp.opponentId, opp.isHome, 'A') * 0.8
              + teamScoreForMatch(a.clube_id, opp.opponentId, opp.isHome, 'DS') * 0.4;
          } else if (a.posicao_id === 5) {
            crossScore = teamScoreForMatch(a.clube_id, opp.opponentId, opp.isHome, 'G') * 1.2
              + teamScoreForMatch(a.clube_id, opp.opponentId, opp.isHome, 'A') * 0.6
              + teamScoreForMatch(a.clube_id, opp.opponentId, opp.isHome, 'FD') * 0.3;
          } else if (a.posicao_id === 6) {
            const sg = teamScoreForMatch(a.clube_id, opp.opponentId, opp.isHome, 'SG');
            const g = teamScoreForMatch(a.clube_id, opp.opponentId, opp.isHome, 'G');
            crossScore = (sg + g) / 2;
          }
        }
        return (a.media_num * 3 + crossScore * 0.8) / minVal;
      };
      stratScoreFn = valorizacaoScore;
      let gk = getForPos(1, 1, { scoreFn: valorizacaoScore })[0] || null;
      if (gk) { const opp = getOpponent(gk.clube_id); defenseOpponentId = opp?.opponentId || null; }
      let zags = getForPos(3, 2, { scoreFn: valorizacaoScore, maxPerClub: 2 });
      let lats = getForPos(2, 2, { scoreFn: valorizacaoScore, maxPerClub: 2 });
      let meis = getForPos(4, 3, { scoreFn: valorizacaoScore });
      let atacs = getForPos(5, 3, { scoreFn: valorizacaoScore });
      let tecnico = getForPos(6, 1, { scoreFn: valorizacaoScore })[0] || null;
      gk = fillSingle(1, gk);
      lats = fillGap(2, 2, lats);
      zags = fillGap(3, 2, zags);
      meis = fillGap(4, 3, meis);
      atacs = fillGap(5, 3, atacs);
      tecnico = fillSingle(6, tecnico);
      raw = { gk, lats, zags, meis, atacs, tecnico };

    } else {
      // Liga Clássica
      const volumeScore = (a: CartolaAtleta) => {
        const ac = acumulados[a.atleta_id] || {};
        const opp = getOpponent(a.clube_id);
        let crossScore = 0;
        if (opp) {
          crossScore = teamScoreForMatch(a.clube_id, opp.opponentId, opp.isHome, 'G') * 1.0
            + teamScoreForMatch(a.clube_id, opp.opponentId, opp.isHome, 'A') * 0.7
            + teamScoreForMatch(a.clube_id, opp.opponentId, opp.isHome, 'DS') * 0.4
            + teamScoreForMatch(a.clube_id, opp.opponentId, opp.isHome, 'SG') * 0.8
            + teamScoreForMatch(a.clube_id, opp.opponentId, opp.isHome, 'FD') * 0.3;
        }
        const totalScouts = Object.values(ac).reduce((s, v) => s + Math.abs(v), 0);
        return a.media_num * 2 + crossScore * 0.5 + totalScouts * 0.1;
      };
      stratScoreFn = volumeScore;
      let gk = getForPos(1, 1, { scoreFn: volumeScore })[0] || null;
      if (gk) { const opp = getOpponent(gk.clube_id); defenseOpponentId = opp?.opponentId || null; }
      let zags = getForPos(3, 2, { scoreFn: volumeScore, maxPerClub: 2 });
      let lats = getForPos(2, 2, { scoreFn: volumeScore, maxPerClub: 2 });
      let meis = getForPos(4, 3, { scoreFn: volumeScore });
      let atacs = getForPos(5, 3, { scoreFn: volumeScore });
      let tecnico = getForPos(6, 1, { scoreFn: volumeScore })[0] || null;
      gk = fillSingle(1, gk);
      lats = fillGap(2, 2, lats);
      zags = fillGap(3, 2, zags);
      meis = fillGap(4, 3, meis);
      atacs = fillGap(5, 3, atacs);
      tecnico = fillSingle(6, tecnico);
      raw = { gk, lats, zags, meis, atacs, tecnico };
    }

    // ── Pick 5 bench reserves ──
    const bench: BenchSlot[] = [];
    const benchPositions: { posId: number; starters: CartolaAtleta[] }[] = [
      { posId: 1, starters: raw.gk ? [raw.gk] : [] },
      { posId: 2, starters: raw.lats },
      { posId: 3, starters: raw.zags },
      { posId: 4, starters: raw.meis },
      { posId: 5, starters: raw.atacs },
    ];
    for (const { posId, starters } of benchPositions) {
      const reserve = pickBenchForPos(posId, starters, stratScoreFn);
      if (reserve) {
        bench.push({ atleta: reserve, posicaoId: posId, isLuxo: posId === 5 });
      }
    }

    return { ...raw, capitaoId: pickCaptain(raw), bench };
  }, [eligibleAtletas, mercadoData?.atletas, topSGTeams, getOpponent, teamScoreForMatch, acumulados]);

  // Generate lineup
  const eligibleCount = eligibleAtletas.length;
  useEffect(() => {
    if (eligibleCount === 0) return;
    const newLineup = generateLineup(estrategia, seed);
    setLineup(newLineup);
    setSubstitutions([]);
  }, [estrategia, statusFilter, seed, eligibleCount]);

  // ── Live substitution logic ──
  const activeLineup = useMemo(() => {
    if (!lineup || mercadoAberto || !pontuadosData?.atletas) return lineup;

    const pont = pontuadosData.atletas;
    const subs: SubstitutionInfo[] = [];

    // Clone lineup
    let gk = lineup.gk;
    let lats = [...lineup.lats];
    let zags = [...lineup.zags];
    let meis = [...lineup.meis];
    let atacs = [...lineup.atacs];
    let capitaoId = lineup.capitaoId;
    const benchLeft = [...lineup.bench];

    const getPos = (posId: number) => {
      if (posId === 1) return { arr: gk ? [gk] : [], setArr: (a: CartolaAtleta[]) => { gk = a[0] || null; } };
      if (posId === 2) return { arr: lats, setArr: (a: CartolaAtleta[]) => { lats = a; } };
      if (posId === 3) return { arr: zags, setArr: (a: CartolaAtleta[]) => { zags = a; } };
      if (posId === 4) return { arr: meis, setArr: (a: CartolaAtleta[]) => { meis = a; } };
      if (posId === 5) return { arr: atacs, setArr: (a: CartolaAtleta[]) => { atacs = a; } };
      return null;
    };

    // 1. Absence substitutions: if starter has no pontuacao entry, reserve enters
    for (let bi = benchLeft.length - 1; bi >= 0; bi--) {
      const benchSlot = benchLeft[bi];
      const pos = getPos(benchSlot.posicaoId);
      if (!pos) continue;

      // Check if any starter at this position didn't play
      const absentIdx = pos.arr.findIndex(a => !pont[String(a.atleta_id)]);
      if (absentIdx !== -1) {
        const absentPlayer = pos.arr[absentIdx];
        subs.push({ outId: absentPlayer.atleta_id, inId: benchSlot.atleta.atleta_id, reason: 'ausencia' });
        // If absent was captain, transfer to reserve
        if (capitaoId === absentPlayer.atleta_id) capitaoId = benchSlot.atleta.atleta_id;
        const newArr = [...pos.arr];
        newArr[absentIdx] = benchSlot.atleta;
        pos.setArr(newArr);
        benchLeft.splice(bi, 1);
      }
    }

    // 2. Reserva de Luxo: if all attackers played, replace worst-scoring attacker if reserve scored more
    const luxoIdx = benchLeft.findIndex(b => b.isLuxo);
    if (luxoIdx !== -1) {
      const luxo = benchLeft[luxoIdx];
      const luxoPont = pont[String(luxo.atleta.atleta_id)];
      if (luxoPont) {
        const allAtacsPlayed = atacs.every(a => !!pont[String(a.atleta_id)]);
        if (allAtacsPlayed && atacs.length > 0) {
          // Find worst scoring attacker
          let worstIdx = 0;
          let worstScore = Infinity;
          for (let i = 0; i < atacs.length; i++) {
            const p = pont[String(atacs[i].atleta_id)];
            const score = p ? p.pontuacao : 0;
            if (score < worstScore) { worstScore = score; worstIdx = i; }
          }
          if (luxoPont.pontuacao > worstScore) {
            subs.push({ outId: atacs[worstIdx].atleta_id, inId: luxo.atleta.atleta_id, reason: 'luxo' });
            if (capitaoId === atacs[worstIdx].atleta_id) capitaoId = luxo.atleta.atleta_id;
            atacs[worstIdx] = luxo.atleta;
            benchLeft.splice(luxoIdx, 1);
          }
        }
      }
    }

    setSubstitutions(subs);
    return { gk, lats, zags, meis, atacs, tecnico: lineup.tecnico, capitaoId, bench: benchLeft };
  }, [lineup, mercadoAberto, pontuadosData]);

  const displayLineup = activeLineup || lineup;

  // ── Calculate total cost / live points ──
  const allLineupPlayers = useMemo(() => {
    if (!displayLineup) return [];
    return [displayLineup.gk, ...displayLineup.lats, ...displayLineup.zags, ...displayLineup.meis, ...displayLineup.atacs, displayLineup.tecnico].filter(Boolean) as CartolaAtleta[];
  }, [displayLineup]);

  const totalCost = useMemo(() => {
    if (!lineup) return 0;
    const starters = [lineup.gk, ...lineup.lats, ...lineup.zags, ...lineup.meis, ...lineup.atacs, lineup.tecnico].filter(Boolean) as CartolaAtleta[];
    const benchCost = (lineup.bench || []).reduce((s, b) => s + b.atleta.preco_num, 0);
    return starters.reduce((s, a) => s + a.preco_num, 0) + benchCost;
  }, [lineup]);

  // Live points
  useEffect(() => {
    if (mercadoAberto) return;
    const calcPoints = () => {
      if (!pontuadosData?.atletas || !displayLineup) return 0;
      let total = 0;
      for (const a of allLineupPlayers) {
        const p = pontuadosData.atletas[String(a.atleta_id)];
        if (p) {
          const mult = displayLineup.capitaoId === a.atleta_id ? 1.5 : 1;
          total += p.pontuacao * mult;
        }
      }
      return total;
    };
    setLivePontos(calcPoints());
    const interval = setInterval(() => setLivePontos(calcPoints()), 60000);
    return () => clearInterval(interval);
  }, [mercadoAberto, pontuadosData, allLineupPlayers, displayLineup]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><LoadingSpinner size="lg" text="Carregando Time da Rodada..." /></div>;
  }

  const estrategiaLabel: Record<Estrategia, string> = {
    'tiro-curto': '🛡️ TIRO CURTO',
    'bom-e-barato': '💰 BOM E BARATO',
    'liga-classica': '🏆 LIGA CLÁSSICA',
    'valorizacao': '📈 VALORIZAÇÃO',
  };

  // Check if a player was substituted in
  const subInIds = new Set(substitutions.map(s => s.inId));
  const subOutIds = new Set(substitutions.map(s => s.outId));

  return (
    <div className="animate-fade-in w-full flex flex-col items-center">
      {/* ── Compact Controls Bar ── */}
      <div className="bg-primary text-primary-foreground px-3 py-1.5 md:px-4 md:py-2 mb-1 w-full max-w-[720px] rounded-lg">
        <div className="flex items-center justify-between gap-2">
          <select
            value={estrategia}
            onChange={(e) => setEstrategia(e.target.value as Estrategia)}
            className="bg-primary text-primary-foreground border border-primary-foreground/40 px-2 py-1 rounded text-[11px] md:text-xs font-bold cursor-pointer shrink-0"
          >
            <option value="tiro-curto">🛡️ Tiro Curto</option>
            <option value="bom-e-barato">💰 Bom e Barato</option>
            <option value="liga-classica">🏆 Liga Clássica</option>
            <option value="valorizacao">📈 Valorização</option>
          </select>

          <div className="flex items-center gap-1.5 border border-primary-foreground/40 rounded px-2.5 py-1">
            <span className="text-[9px] md:text-[10px] font-bold uppercase opacity-80">
              {mercadoAberto ? 'Custo' : 'Pts'}
            </span>
            <span className="text-sm md:text-base font-black">
              {mercadoAberto ? `C$ ${totalCost.toFixed(2)}` : `${livePontos.toFixed(2)}`}
            </span>
          </div>

          <button
            onClick={() => setSeed(s => s + 1)}
            className="bg-primary-foreground text-primary font-black px-2.5 py-1 rounded flex items-center gap-1 text-[11px] md:text-xs shrink-0"
            title="Gerar novo time com a mesma estratégia"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Atualizar</span>
          </button>
        </div>

        <div className="flex items-center gap-1 mt-1 overflow-x-auto scrollbar-none">
          <span className="text-[9px] md:text-[10px] font-bold opacity-70 shrink-0">Rodada:</span>
          <button
            onClick={() => setViewRodada(null)}
            className={cn(
              'px-1.5 py-0.5 rounded text-[10px] md:text-xs font-bold shrink-0',
              viewRodada === null ? 'bg-primary-foreground text-primary' : 'bg-primary-foreground/20 text-primary-foreground'
            )}
          >
            Atual
          </button>
          {rodadaAtual && Array.from({ length: Math.min(rodadaAtual - 1, 10) }, (_, i) => rodadaAtual - 1 - i).filter(r => r > 0).map(r => (
            <button
              key={r}
              onClick={() => setViewRodada(r)}
              className={cn(
                'px-1.5 py-0.5 rounded text-[10px] md:text-xs font-bold shrink-0',
                viewRodada === r ? 'bg-primary-foreground text-primary' : 'bg-primary-foreground/20 text-primary-foreground'
              )}
            >
              R{r}
            </button>
          ))}
        </div>
      </div>

      {/* ── Football Pitch ── */}
      <div className="w-full flex justify-center">
        <div
          className="relative rounded-2xl p-1.5 md:p-2 lg:p-3 shadow-inner mx-auto w-[95vw] max-w-[520px] md:max-w-[480px] lg:max-w-[520px]"
          style={{
            backgroundColor: 'hsl(145, 63%, 30%)',
            height: 'clamp(340px, calc(100vh - 240px), 580px)',
          }}
        >
          {/* Pitch markings */}
          <div className="absolute inset-1 md:inset-1.5 rounded-2xl border-2 border-white/60 pointer-events-none" />
          <div className="absolute top-1/2 left-3 right-3 md:left-4 md:right-4 -translate-y-1/2 h-0 border-t-2 border-white/60 pointer-events-none" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 md:w-20 md:h-20 rounded-full border-2 border-white/60 pointer-events-none" />
          <div className="absolute top-2 md:top-3 left-6 right-6 md:left-10 md:right-10 h-[16%] border-2 border-white/60 pointer-events-none" />
          <div className="absolute bottom-2 md:bottom-3 left-6 right-6 md:left-10 md:right-10 h-[16%] border-2 border-white/60 pointer-events-none" />
          <div className="absolute top-2 md:top-3 left-14 right-14 md:left-20 md:right-20 h-[9%] border-2 border-white/60 pointer-events-none" />
          <div className="absolute bottom-2 md:bottom-3 left-14 right-14 md:left-20 md:right-20 h-[9%] border-2 border-white/60 pointer-events-none" />

          {/* Técnico */}
          {displayLineup?.tecnico && (
            <div className="absolute left-1 md:left-2 bottom-2 md:bottom-4 z-20">
              <div className="scale-[0.55] md:scale-[0.65] origin-bottom-left">
                <PlayerCardPitch
                  atleta={displayLineup.tecnico}
                  clube={clubes[String(displayLineup.tecnico.clube_id)]}
                  showPrice={mercadoAberto}
                  pontuacao={!mercadoAberto ? pontuadosData?.atletas?.[String(displayLineup.tecnico.atleta_id)]?.pontuacao : undefined}
                  onClick={() => setSelectedAtleta(displayLineup.tecnico)}
                />
              </div>
            </div>
          )}

          {/* Formation badge */}
          <div className="pointer-events-none absolute bottom-1 right-1 md:bottom-2 md:right-2">
            <span className="inline-block bg-black text-white px-1.5 py-0.5 md:px-2 md:py-1 rounded-md text-[9px] md:text-sm font-extrabold tracking-wide">4-3-3</span>
          </div>

          {/* Players */}
          <div className="relative flex flex-col justify-between h-full py-0.5 md:py-1">
            {/* Atacantes */}
            <div className="flex items-center justify-around py-0.5">
              {(displayLineup?.atacs || [null, null, null]).map((a, i) => (
                <PlayerCardPitch
                  key={a?.atleta_id || `atk-${i}`}
                  atleta={a}
                  clube={a ? clubes[String(a.clube_id)] : undefined}
                  showPrice={mercadoAberto}
                  pontuacao={!mercadoAberto && a ? pontuadosData?.atletas?.[String(a.atleta_id)]?.pontuacao : undefined}
                  isCaptain={!!a && displayLineup?.capitaoId === a.atleta_id}
                  isSubIn={!!a && subInIds.has(a.atleta_id)}
                  onClick={() => a && setSelectedAtleta(a)}
                />
              ))}
            </div>
            {/* Meias */}
            <div className="flex items-center justify-around py-0.5">
              {(displayLineup?.meis || [null, null, null]).map((a, i) => (
                <PlayerCardPitch
                  key={a?.atleta_id || `mei-${i}`}
                  atleta={a}
                  clube={a ? clubes[String(a.clube_id)] : undefined}
                  showPrice={mercadoAberto}
                  pontuacao={!mercadoAberto && a ? pontuadosData?.atletas?.[String(a.atleta_id)]?.pontuacao : undefined}
                  isCaptain={!!a && displayLineup?.capitaoId === a.atleta_id}
                  isSubIn={!!a && subInIds.has(a.atleta_id)}
                  onClick={() => a && setSelectedAtleta(a)}
                />
              ))}
            </div>
            {/* Defesa */}
            <div className="flex items-center justify-around py-0.5">
              {[
                displayLineup?.lats?.[0] || null,
                displayLineup?.zags?.[0] || null,
                displayLineup?.zags?.[1] || null,
                displayLineup?.lats?.[1] || null,
              ].map((a, i) => (
                <PlayerCardPitch
                  key={a?.atleta_id || `def-${i}`}
                  atleta={a}
                  clube={a ? clubes[String(a.clube_id)] : undefined}
                  showPrice={mercadoAberto}
                  pontuacao={!mercadoAberto && a ? pontuadosData?.atletas?.[String(a.atleta_id)]?.pontuacao : undefined}
                  isCaptain={!!a && displayLineup?.capitaoId === a.atleta_id}
                  isSubIn={!!a && subInIds.has(a.atleta_id)}
                  onClick={() => a && setSelectedAtleta(a)}
                />
              ))}
            </div>
            {/* Goleiro */}
            <div className="flex items-center justify-around py-0.5">
              <PlayerCardPitch
                atleta={displayLineup?.gk || null}
                clube={displayLineup?.gk ? clubes[String(displayLineup.gk.clube_id)] : undefined}
                showPrice={mercadoAberto}
                pontuacao={!mercadoAberto && displayLineup?.gk ? pontuadosData?.atletas?.[String(displayLineup.gk.atleta_id)]?.pontuacao : undefined}
                isCaptain={!!displayLineup?.gk && displayLineup?.capitaoId === displayLineup.gk.atleta_id}
                isSubIn={!!displayLineup?.gk && subInIds.has(displayLineup.gk.atleta_id)}
                onClick={() => displayLineup?.gk && setSelectedAtleta(displayLineup.gk)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Bench / Banco de Reservas ── */}
      {displayLineup && displayLineup.bench && displayLineup.bench.length > 0 && (
        <div className="w-[95vw] max-w-[520px] md:max-w-[480px] lg:max-w-[520px] mt-1.5 rounded-xl overflow-hidden"
          style={{ background: 'linear-gradient(135deg, hsl(280, 40%, 94%), hsl(330, 35%, 93%))' }}
        >
          <div className="px-3 py-1.5 flex items-center gap-2">
            <span className="text-[10px] md:text-xs font-black text-foreground/80 uppercase tracking-wider">🪑 Banco de Reservas</span>
            {substitutions.length > 0 && (
              <span className="text-[9px] md:text-[10px] font-bold text-green-700 bg-green-100 px-1.5 py-0.5 rounded-full animate-fade-in">
                {substitutions.length} sub{substitutions.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="flex items-center justify-around px-2 pb-2.5 pt-0.5 gap-1">
            {/* Show all 5 bench positions, even if some were subbed in */}
            {lineup?.bench.map((slot) => {
              const wasSubbedIn = subInIds.has(slot.atleta.atleta_id);
              return (
                <BenchCard
                  key={slot.atleta.atleta_id}
                  atleta={slot.atleta}
                  clube={clubes[String(slot.atleta.clube_id)]}
                  posicaoId={slot.posicaoId}
                  isLuxo={slot.isLuxo}
                  showPrice={mercadoAberto}
                  pontuacao={!mercadoAberto ? pontuadosData?.atletas?.[String(slot.atleta.atleta_id)]?.pontuacao : undefined}
                  wasSubbedIn={wasSubbedIn}
                  onClick={() => setSelectedAtleta(slot.atleta)}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Substitution log */}
      {substitutions.length > 0 && (
        <div className="w-[95vw] max-w-[520px] md:max-w-[480px] lg:max-w-[520px] mt-1 px-3 py-1.5 rounded-lg bg-muted/50">
          {substitutions.map((sub, i) => {
            const inPlayer = [...(lineup?.bench || [])].find(b => b.atleta.atleta_id === sub.inId);
            const outPlayer = allLineupPlayers.find(a => a.atleta_id === sub.outId) ||
              [lineup?.gk, ...(lineup?.lats || []), ...(lineup?.zags || []), ...(lineup?.meis || []), ...(lineup?.atacs || [])].find(a => a?.atleta_id === sub.outId);
            return (
              <div key={i} className="flex items-center gap-1.5 text-[9px] md:text-[10px] py-0.5 animate-fade-in">
                <ArrowUp className="w-3 h-3 text-green-600" />
                <span className="font-bold text-green-700">{inPlayer?.atleta.apelido || '?'}</span>
                <span className="text-muted-foreground">entrou no lugar de</span>
                <span className="font-bold text-red-600">{(outPlayer as any)?.apelido || '?'}</span>
                <span className="text-muted-foreground/60">
                  ({sub.reason === 'luxo' ? '⭐ Luxo' : 'Ausência'})
                </span>
              </div>
            );
          })}
        </div>
      )}

      <PlayerDetailModal
        atleta={selectedAtleta}
        clube={selectedAtleta ? clubes[String(selectedAtleta.clube_id)] : undefined}
        clubes={clubes as any}
        open={!!selectedAtleta}
        onOpenChange={(open) => !open && setSelectedAtleta(null)}
      />
    </div>
  );
}

// ── Player Card on Pitch ──
function PlayerCardPitch({
  atleta,
  clube,
  showPrice,
  pontuacao,
  isCaptain,
  isSubIn,
  onClick,
}: {
  atleta: CartolaAtleta | null;
  clube?: CartolaClube;
  showPrice?: boolean;
  pontuacao?: number;
  isCaptain?: boolean;
  isSubIn?: boolean;
  onClick?: () => void;
}) {
  if (!atleta) return <div className="w-10 h-10 md:w-12 md:h-12" />;
  return (
    <div
      className={cn(
        "relative flex flex-col items-center cursor-pointer transition-transform duration-300 hover:scale-110",
        isSubIn && "animate-fade-in"
      )}
      onClick={onClick}
    >
      {isCaptain && (
        <div className="absolute -top-1 -right-1 md:-top-1.5 md:-right-1.5 z-10 w-4 h-4 md:w-5 md:h-5 bg-yellow-400 rounded-full flex items-center justify-center ring-1 ring-yellow-600 shadow">
          <span className="text-[8px] md:text-[10px] font-black text-yellow-900">C</span>
        </div>
      )}
      {isSubIn && (
        <div className="absolute -top-1 -left-1 md:-top-1.5 md:-left-1.5 z-10 w-4 h-4 md:w-5 md:h-5 bg-green-500 rounded-full flex items-center justify-center ring-1 ring-green-700 shadow">
          <ArrowUp className="w-2.5 h-2.5 text-white" />
        </div>
      )}
      <img
        src={atleta.foto?.replace('FORMATO', '80x80')}
        alt={atleta.apelido}
        className={cn(
          "w-10 h-10 md:w-12 md:h-12 rounded-full object-cover shadow-lg ring-1 ring-white",
          isCaptain && "ring-2 ring-yellow-400",
          isSubIn && "ring-2 ring-green-400"
        )}
        onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }}
      />
      <div className="mt-0.5 px-1 md:px-1.5 py-px bg-white/85 rounded">
        <div className="flex items-center gap-0.5">
          <span className="text-[8px] md:text-[10px] font-bold text-foreground truncate max-w-[60px] md:max-w-[70px]">{atleta.apelido}</span>
          {clube && <ClubeEscudo clube={clube} size="xs" />}
        </div>
      </div>
      {showPrice && (
        <div className="mt-px px-1 md:px-1.5 py-px bg-black rounded text-white">
          <span className="text-[7px] md:text-[9px] font-black">C$ {atleta.preco_num.toFixed(2)}</span>
        </div>
      )}
      {!showPrice && pontuacao !== undefined && (
        <div className="mt-px px-1 md:px-1.5 py-px bg-black rounded text-white">
          <span className="text-[7px] md:text-[9px] font-black">{(isCaptain ? pontuacao * 1.5 : pontuacao).toFixed(1)} pts</span>
        </div>
      )}
    </div>
  );
}

// ── Bench Card ──
function BenchCard({
  atleta,
  clube,
  posicaoId,
  isLuxo,
  showPrice,
  pontuacao,
  wasSubbedIn,
  onClick,
}: {
  atleta: CartolaAtleta;
  clube?: CartolaClube;
  posicaoId: number;
  isLuxo: boolean;
  showPrice?: boolean;
  pontuacao?: number;
  wasSubbedIn?: boolean;
  onClick?: () => void;
}) {
  const posLabel = POSICOES[posicaoId]?.abreviacao || '?';

  return (
    <div
      className={cn(
        "relative flex flex-col items-center cursor-pointer transition-all duration-300 hover:scale-105",
        wasSubbedIn && "opacity-40 scale-95"
      )}
      onClick={onClick}
    >
      {/* Luxo badge */}
      {isLuxo && (
        <div className="absolute -top-1.5 -right-0.5 z-10 flex items-center gap-0.5 bg-gradient-to-r from-yellow-400 to-amber-500 px-1 py-0.5 rounded-full shadow ring-1 ring-yellow-600">
          <Star className="w-2.5 h-2.5 text-yellow-900 fill-yellow-900" />
          <span className="text-[6px] md:text-[7px] font-black text-yellow-900 uppercase">Luxo</span>
        </div>
      )}
      {/* Subbed-in indicator */}
      {wasSubbedIn && (
        <div className="absolute -top-1 left-1/2 -translate-x-1/2 z-10 bg-green-500 text-white px-1.5 py-0.5 rounded-full text-[6px] font-black shadow">
          EM CAMPO ↑
        </div>
      )}
      <img
        src={atleta.foto?.replace('FORMATO', '80x80')}
        alt={atleta.apelido}
        className={cn(
          "w-9 h-9 md:w-11 md:h-11 rounded-full object-cover shadow ring-1 ring-foreground/20",
          isLuxo && "ring-2 ring-yellow-400"
        )}
        onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }}
      />
      <div className="mt-0.5 px-1 py-px bg-white rounded shadow-sm">
        <div className="flex items-center gap-0.5">
          <span className="text-[7px] md:text-[9px] font-bold text-foreground truncate max-w-[48px] md:max-w-[56px]">{atleta.apelido}</span>
          {clube && <ClubeEscudo clube={clube} size="xs" />}
        </div>
      </div>
      <div className={cn(
        "mt-px px-1 py-px rounded text-[6px] md:text-[8px] font-black",
        isLuxo ? "bg-gradient-to-r from-yellow-400 to-amber-500 text-yellow-900" : "bg-foreground/80 text-background"
      )}>
        {posLabel} • {showPrice ? `C$ ${atleta.preco_num.toFixed(2)}` : (pontuacao !== undefined ? `${pontuacao.toFixed(1)} pts` : '-')}
      </div>
    </div>
  );
}
