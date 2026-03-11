import { useState, useMemo, useEffect, useCallback } from 'react';
import { ClubeEscudo } from '@/components/ClubeEscudo';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { PlayerDetailModal } from '@/components/PlayerDetailModal';
import { useMercado, useRodada, usePartidas, useHistoricoRodadas, usePontuados, POSICOES } from '@/hooks/useCartolaData';
import { CartolaAtleta, CartolaClube } from '@/lib/cartola-api';
import { AlertCircle, RefreshCw } from 'lucide-react';
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

type Estrategia = 'tiro-curto' | 'bom-e-barato' | 'liga-classica';
type StatusFilter = 'provavel' | 'duvida';

interface Lineup {
  gk: CartolaAtleta | null;
  lats: CartolaAtleta[];
  zags: CartolaAtleta[];
  meis: CartolaAtleta[];
  atacs: CartolaAtleta[];
  tecnico: CartolaAtleta | null;
  capitaoId: number | null;
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
  const [viewRodada, setViewRodada] = useState<number | null>(null); // null = current
  const [livePontos, setLivePontos] = useState(0);

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

  // ── Crossover data (scouts aggregated per club) ──
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

  // ── Accumulated scouts per athlete ──
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

  // ── Helper: get opponent for a club ──
  const getOpponent = useCallback((clubId: number) => {
    const p = partidas.find(p => p.clube_casa_id === clubId || p.clube_visitante_id === clubId);
    if (!p) return null;
    const isHome = p.clube_casa_id === clubId;
    return { opponentId: isHome ? p.clube_visitante_id : p.clube_casa_id, isHome };
  }, [partidas]);

  // ── TOP SG Teams ──
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

  // ── Filter athletes by status ──
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
    // Track ALL opponent club IDs from defensive players (GK, LAT, ZAG)
    const blockedOpponentIds = new Set<number>();

    const pool = [...eligibleAtletas];
    // Fallback pool: ALL athletes (including Dúvida) for filling empty slots
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
        // Anti-conflict: block mid/attack players whose club faces our defense
        if ((posId === 4 || posId === 5) && !opts?.allowSameClubDefense) {
          if (blockedOpponentIds.has(a.clube_id)) return false;
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

    // ── Fallback: fill missing slots by relaxing constraints ──
    const fillGap = (posId: number, needed: number, existing: CartolaAtleta[]): CartolaAtleta[] => {
      if (existing.length >= needed) return existing;
      const missing = needed - existing.length;
      // Try from eligible pool first (relaxed club constraints)
      let extras = getForPos(posId, missing, { allowSameClubDefense: true, maxPerClub: 99 });
      if (extras.length < missing) {
        // Last resort: use full athlete pool (any status with a match)
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

    // ── Captain selection ──
    const pickCaptain = (lineup: Omit<Lineup, 'capitaoId'>): number | null => {
      const candidates = [...lineup.meis, ...lineup.atacs].filter(Boolean);
      if (candidates.length === 0) return null;
      
      const scored = candidates.map(a => {
        const opp = getOpponent(a.clube_id);
        let goalProb = 0;
        if (opp) {
          goalProb = teamScoreForMatch(a.clube_id, opp.opponentId, opp.isHome, 'G');
        }
        // Base: media, tiebreak: goal probability, +10% bonus for attackers
        let score = a.media_num * 2 + goalProb;
        if (a.posicao_id === 5) score *= 1.10;
        return { a, score };
      });
      scored.sort((x, y) => y.score - x.score);
      return scored[0]?.a.atleta_id || null;
    };

    // Helper: collect all opponent club IDs from defensive players
    const collectBlockedOpponents = (defenders: (CartolaAtleta | null)[]) => {
      blockedOpponentIds.clear();
      for (const d of defenders) {
        if (!d) continue;
        const opp = getOpponent(d.clube_id);
        if (opp) blockedOpponentIds.add(opp.opponentId);
      }
    };

    let raw: Omit<Lineup, 'capitaoId'>;

    if (strat === 'tiro-curto') {
      const sgTeam = topSGTeams[0];
      if (sgTeam) {
        defenseTeamId = sgTeam.teamId;
      }
      const forceClub = defenseTeamId || undefined;
      const gkArr = getForPos(1, 1, { forceClub, allowSameClubDefense: true, maxPerClub: 1 });
      let gk = gkArr[0] || null;
      if (!gk) { gk = getForPos(1, 1, { allowSameClubDefense: true })[0] || null; if (gk) used.add(gk.atleta_id); }

      let lats = getForPos(2, 2, { forceClub, allowSameClubDefense: true, maxPerClub: 2 });
      if (lats.length < 2) lats.push(...getForPos(2, 2 - lats.length, {}));
      let zags = getForPos(3, 2, { forceClub, allowSameClubDefense: true, maxPerClub: 2 });
      if (zags.length < 2) zags.push(...getForPos(3, 2 - zags.length, {}));

      // Collect ALL defensive opponents BEFORE picking mid/attack
      gk = fillSingle(1, gk);
      lats = fillGap(2, 2, lats);
      zags = fillGap(3, 2, zags);
      collectBlockedOpponents([gk, ...lats, ...zags]);

      let tecnico = getForPos(6, 1, { forceClub, allowSameClubDefense: true })[0]
        || getForPos(6, 1, {})[0] || null;
      let meis = getForPos(4, 3, {});
      let atacs = getForPos(5, 3, {});

      // Guarantee all slots filled
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
      const maxPrice = 10;

      let gk = getForPos(1, 1, { maxPrice, scoreFn: costBenefitScore })[0] || null;
      let zags = getForPos(3, 2, { maxPrice, scoreFn: costBenefitScore, maxPerClub: 2 });
      let lats = getForPos(2, 2, { maxPrice, scoreFn: costBenefitScore, maxPerClub: 2 });

      // Fill defense first, then collect blocked opponents
      gk = fillSingle(1, gk);
      zags = fillGap(3, 2, zags);
      lats = fillGap(2, 2, lats);
      collectBlockedOpponents([gk, ...zags, ...lats]);

      let meis = getForPos(4, 3, { maxPrice, scoreFn: costBenefitScore });
      let atacs = getForPos(5, 3, { maxPrice, scoreFn: costBenefitScore });
      let tecnico = getForPos(6, 1, { maxPrice, scoreFn: costBenefitScore })[0] || null;

      // Guarantee remaining slots filled (relax price if needed)
      meis = fillGap(4, 3, meis);
      atacs = fillGap(5, 3, atacs);
      tecnico = fillSingle(6, tecnico);

      raw = { gk, lats, zags, meis, atacs, tecnico };

    } else {
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

      let gk = getForPos(1, 1, { scoreFn: volumeScore })[0] || null;
      let zags = getForPos(3, 2, { scoreFn: volumeScore, maxPerClub: 2 });
      let lats = getForPos(2, 2, { scoreFn: volumeScore, maxPerClub: 2 });

      // Fill defense first, then collect blocked opponents
      gk = fillSingle(1, gk);
      zags = fillGap(3, 2, zags);
      lats = fillGap(2, 2, lats);
      collectBlockedOpponents([gk, ...zags, ...lats]);

      let meis = getForPos(4, 3, { scoreFn: volumeScore });
      let atacs = getForPos(5, 3, { scoreFn: volumeScore });
      let tecnico = getForPos(6, 1, { scoreFn: volumeScore })[0] || null;

      // Guarantee remaining slots filled
      meis = fillGap(4, 3, meis);
      atacs = fillGap(5, 3, atacs);
      tecnico = fillSingle(6, tecnico);

      raw = { gk, lats, zags, meis, atacs, tecnico };
    }

    return { ...raw, capitaoId: pickCaptain(raw) };
  }, [eligibleAtletas, mercadoData?.atletas, topSGTeams, getOpponent, teamScoreForMatch, acumulados]);

  // Generate lineup on mount + when strategy/status/seed changes
  const eligibleCount = eligibleAtletas.length;
  useEffect(() => {
    if (eligibleCount === 0) return;
    const newLineup = generateLineup(estrategia, seed);
    setLineup(newLineup);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estrategia, statusFilter, seed, eligibleCount]);

  // ── Calculate total cost / live points ──
  const allLineupPlayers = useMemo(() => {
    if (!lineup) return [];
    return [lineup.gk, ...lineup.lats, ...lineup.zags, ...lineup.meis, ...lineup.atacs, lineup.tecnico].filter(Boolean) as CartolaAtleta[];
  }, [lineup]);

  const totalCost = useMemo(() => {
    return allLineupPlayers.reduce((s, a) => s + a.preco_num, 0);
  }, [allLineupPlayers]);

  // Live points from pontuados (when market closed)
  useEffect(() => {
    if (mercadoAberto) return;
    const calcPoints = () => {
      if (!pontuadosData?.atletas || !lineup) return 0;
      let total = 0;
      for (const a of allLineupPlayers) {
        const p = pontuadosData.atletas[String(a.atleta_id)];
        if (p) {
          const mult = lineup.capitaoId === a.atleta_id ? 1.5 : 1;
          total += p.pontuacao * mult;
        }
      }
      return total;
    };
    setLivePontos(calcPoints());
    const interval = setInterval(() => setLivePontos(calcPoints()), 60000);
    return () => clearInterval(interval);
  }, [mercadoAberto, pontuadosData, allLineupPlayers]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><LoadingSpinner size="lg" text="Carregando Time da Rodada..." /></div>;
  }

  const estrategiaLabel: Record<Estrategia, string> = {
    'tiro-curto': '🛡️ TIRO CURTO',
    'bom-e-barato': '💰 BOM E BARATO',
    'liga-classica': '🏆 LIGA CLÁSSICA',
  };

  return (
    <div className="animate-fade-in w-full flex flex-col items-center">
      {/* ── Compact Controls Bar ── */}
      <div className="bg-primary text-primary-foreground px-3 py-2 md:px-4 md:py-2.5 mb-2 w-full max-w-[720px] rounded-lg">
        {/* Row 1: Strategy select + Cost/Points + Refresh */}
        <div className="flex items-center justify-between gap-2">
          <select
            value={estrategia}
            onChange={(e) => setEstrategia(e.target.value as Estrategia)}
            className="bg-primary text-primary-foreground border border-primary-foreground/40 px-2 py-1 rounded text-[11px] md:text-xs font-bold cursor-pointer shrink-0"
          >
            <option value="tiro-curto">🛡️ Tiro Curto</option>
            <option value="bom-e-barato">💰 Bom e Barato</option>
            <option value="liga-classica">🏆 Liga Clássica</option>
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

        {/* Row 2: Rodada selector inline */}
        <div className="flex items-center gap-1 mt-1.5 overflow-x-auto scrollbar-none">
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
            height: 'clamp(400px, calc(100vh - 140px), 720px)',
          }}
        >
          {/* Pitch markings */}
          <div className="absolute inset-1 md:inset-1.5 rounded-2xl border-2 border-white/60 pointer-events-none" />
          <div className="absolute top-1/2 left-3 right-3 md:left-4 md:right-4 -translate-y-1/2 h-0 border-t-2 border-white/60 pointer-events-none" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 md:w-24 md:h-24 rounded-full border-2 border-white/60 pointer-events-none" />
          <div className="absolute top-3 md:top-4 left-6 right-6 md:left-10 md:right-10 h-[18%] border-2 border-white/60 pointer-events-none" />
          <div className="absolute bottom-3 md:bottom-4 left-6 right-6 md:left-10 md:right-10 h-[18%] border-2 border-white/60 pointer-events-none" />
          <div className="absolute top-3 md:top-4 left-16 right-16 md:left-24 md:right-24 h-[10%] border-2 border-white/60 pointer-events-none" />
          <div className="absolute bottom-3 md:bottom-4 left-16 right-16 md:left-24 md:right-24 h-[10%] border-2 border-white/60 pointer-events-none" />

          {/* Técnico */}
          {lineup?.tecnico && (
            <div className="absolute left-1 md:left-2 bottom-3 md:bottom-5 z-20">
              <div className="scale-[0.6] md:scale-[0.7] origin-bottom-left">
                <PlayerCardPitch
                  atleta={lineup.tecnico}
                  clube={clubes[String(lineup.tecnico.clube_id)]}
                  showPrice={mercadoAberto}
                  pontuacao={!mercadoAberto ? pontuadosData?.atletas?.[String(lineup.tecnico.atleta_id)]?.pontuacao : undefined}
                  onClick={() => setSelectedAtleta(lineup.tecnico)}
                />
              </div>
            </div>
          )}

          {/* Formation badge */}
          <div className="pointer-events-none absolute bottom-1.5 right-1.5 md:bottom-2 md:right-2">
            <span className="inline-block bg-black text-white px-1.5 py-0.5 md:px-2 md:py-1 rounded-md text-[10px] md:text-sm font-extrabold tracking-wide">4-3-3</span>
          </div>

          {/* Players */}
          <div className="relative flex flex-col justify-between h-full py-1 md:py-2">
            {/* Atacantes */}
            <div className="flex items-center justify-around py-0.5 md:py-1">
              {(lineup?.atacs || [null, null, null]).map((a, i) => (
                <PlayerCardPitch
                  key={a?.atleta_id || `atk-${i}`}
                  atleta={a}
                  clube={a ? clubes[String(a.clube_id)] : undefined}
                  showPrice={mercadoAberto}
                  pontuacao={!mercadoAberto && a ? pontuadosData?.atletas?.[String(a.atleta_id)]?.pontuacao : undefined}
                  isCaptain={!!a && lineup?.capitaoId === a.atleta_id}
                  onClick={() => a && setSelectedAtleta(a)}
                />
              ))}
            </div>
            {/* Meias */}
            <div className="flex items-center justify-around py-0.5 md:py-1">
              {(lineup?.meis || [null, null, null]).map((a, i) => (
                <PlayerCardPitch
                  key={a?.atleta_id || `mei-${i}`}
                  atleta={a}
                  clube={a ? clubes[String(a.clube_id)] : undefined}
                  showPrice={mercadoAberto}
                  pontuacao={!mercadoAberto && a ? pontuadosData?.atletas?.[String(a.atleta_id)]?.pontuacao : undefined}
                  isCaptain={!!a && lineup?.capitaoId === a.atleta_id}
                  onClick={() => a && setSelectedAtleta(a)}
                />
              ))}
            </div>
            {/* Defesa */}
            <div className="flex items-center justify-around py-0.5 md:py-1">
              {[
                lineup?.lats?.[0] || null,
                lineup?.zags?.[0] || null,
                lineup?.zags?.[1] || null,
                lineup?.lats?.[1] || null,
              ].map((a, i) => (
                <PlayerCardPitch
                  key={a?.atleta_id || `def-${i}`}
                  atleta={a}
                  clube={a ? clubes[String(a.clube_id)] : undefined}
                  showPrice={mercadoAberto}
                  pontuacao={!mercadoAberto && a ? pontuadosData?.atletas?.[String(a.atleta_id)]?.pontuacao : undefined}
                  isCaptain={!!a && lineup?.capitaoId === a.atleta_id}
                  onClick={() => a && setSelectedAtleta(a)}
                />
              ))}
            </div>
            {/* Goleiro */}
            <div className="flex items-center justify-around py-0.5 md:py-1">
              <PlayerCardPitch
                atleta={lineup?.gk || null}
                clube={lineup?.gk ? clubes[String(lineup.gk.clube_id)] : undefined}
                showPrice={mercadoAberto}
                pontuacao={!mercadoAberto && lineup?.gk ? pontuadosData?.atletas?.[String(lineup.gk.atleta_id)]?.pontuacao : undefined}
                isCaptain={!!lineup?.gk && lineup?.capitaoId === lineup.gk.atleta_id}
                onClick={() => lineup?.gk && setSelectedAtleta(lineup.gk)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Strategy rules card hidden - logic preserved */}

      {/* Player Detail Modal */}
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
  onClick,
}: {
  atleta: CartolaAtleta | null;
  clube?: CartolaClube;
  showPrice?: boolean;
  pontuacao?: number;
  isCaptain?: boolean;
  onClick?: () => void;
}) {
  if (!atleta) return <div className="w-10 h-10 md:w-12 md:h-12" />;
  return (
    <div
      className="relative flex flex-col items-center cursor-pointer transition-transform duration-300 hover:scale-110"
      onClick={onClick}
    >
      {isCaptain && (
        <div className="absolute -top-1 -right-1 md:-top-1.5 md:-right-1.5 z-10 w-4 h-4 md:w-5 md:h-5 bg-yellow-400 rounded-full flex items-center justify-center ring-1 ring-yellow-600 shadow">
          <span className="text-[8px] md:text-[10px] font-black text-yellow-900">C</span>
        </div>
      )}
      <img
        src={atleta.foto?.replace('FORMATO', '80x80')}
        alt={atleta.apelido}
        className={cn(
          "w-10 h-10 md:w-12 md:h-12 rounded-full object-cover shadow-lg ring-1 ring-white",
          isCaptain && "ring-2 ring-yellow-400"
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
