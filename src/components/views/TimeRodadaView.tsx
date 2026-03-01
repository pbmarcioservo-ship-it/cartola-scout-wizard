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
    const usedClubes: Record<string, number> = {}; // track clubs used for mid/atk
    let defenseTeamId: number | null = null;
    let defenseOpponentId: number | null = null;

    const pool = [...eligibleAtletas];

    const getForPos = (posId: number, count: number, opts?: {
      maxPrice?: number;
      scoreFn?: (a: CartolaAtleta) => number;
      allowSameClubDefense?: boolean;
      forceClub?: number;
      maxPerClub?: number;
    }) => {
      const maxPerClub = opts?.maxPerClub ?? (posId === 4 || posId === 5 ? 1 : 3);
      let candidates = pool.filter(a => {
        if (a.posicao_id !== posId) return false;
        if (used.has(a.atleta_id)) return false;
        if (opts?.maxPrice && a.preco_num > opts.maxPrice) return false;
        if (opts?.forceClub && a.clube_id !== opts.forceClub) return false;
        // Anti-conflict: don't pick mid/atk players from the defense's opponent
        if ((posId === 4 || posId === 5 || posId === 2 || posId === 3) && !opts?.allowSameClubDefense) {
          if (defenseOpponentId && a.clube_id === defenseOpponentId) return false;
        }
        return true;
      });

      // Score function
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

      // Sort with randomization within top tier
      const scored = candidates.map(a => ({ a, s: scoreFn(a) }));
      scored.sort((x, y) => y.s - x.s);

      // Add slight randomness using seed to shuffle among top candidates
      const topN = Math.min(scored.length, count * 3);
      const topSlice = scored.slice(0, topN);
      // Shuffle top slice with seeded pseudo-random
      for (let i = topSlice.length - 1; i > 0; i--) {
        const j = Math.abs(((seedVal * 9301 + 49297 + i * 233) % 233280)) % (i + 1);
        [topSlice[i], topSlice[j]] = [topSlice[j], topSlice[i]];
      }
      // Re-sort but with a weighted random factor
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
        // For mid/atk enforce max 1 per club across both positions
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

    if (strat === 'tiro-curto') {
      // TIRO CURTO: full defense from best SG team
      const sgTeam = topSGTeams[0];
      if (sgTeam) {
        defenseTeamId = sgTeam.teamId;
        const opp = getOpponent(sgTeam.teamId);
        defenseOpponentId = opp?.opponentId || null;
      }
      const forceClub = defenseTeamId || undefined;
      const gkArr = getForPos(1, 1, { forceClub, allowSameClubDefense: true, maxPerClub: 1 });
      const gk = gkArr[0] || null;
      // If no GK from that team, pick best available
      const finalGk = gk || getForPos(1, 1, { allowSameClubDefense: true })[0] || null;
      if (finalGk && !gk) used.add(finalGk.atleta_id);

      const lats = getForPos(2, 2, { forceClub, allowSameClubDefense: true, maxPerClub: 2 });
      // Fill remaining laterals from other teams if needed
      if (lats.length < 2) {
        const extra = getForPos(2, 2 - lats.length, {});
        lats.push(...extra);
      }
      const zags = getForPos(3, 2, { forceClub, allowSameClubDefense: true, maxPerClub: 2 });
      if (zags.length < 2) {
        const extra = getForPos(3, 2 - zags.length, {});
        zags.push(...extra);
      }
      const tecnico = getForPos(6, 1, { forceClub, allowSameClubDefense: true })[0]
        || getForPos(6, 1, {})[0] || null;

      // Mid/Atk: based on finalization/assists, no conflict
      const meis = getForPos(4, 3, {});
      const atacs = getForPos(5, 3, {});
      return { gk: finalGk || gkArr[0] || null, lats, zags, meis, atacs, tecnico };

    } else if (strat === 'bom-e-barato') {
      // BOM E BARATO: max C$ 10 per player, best media/price ratio
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

      // Pick defense first for anti-conflict
      const gk = getForPos(1, 1, { maxPrice, scoreFn: costBenefitScore })[0] || null;
      // Determine defense team for anti-conflict
      if (gk) {
        const opp = getOpponent(gk.clube_id);
        defenseOpponentId = opp?.opponentId || null;
      }
      const zags = getForPos(3, 2, { maxPrice, scoreFn: costBenefitScore, maxPerClub: 2 });
      const lats = getForPos(2, 2, { maxPrice, scoreFn: costBenefitScore, maxPerClub: 2 });
      // Update anti-conflict: include all defense clubs' opponents
      const defClubes = [gk, ...zags, ...lats].filter(Boolean).map(a => a!.clube_id);
      const defOpponents = new Set<number>();
      for (const c of defClubes) {
        const o = getOpponent(c);
        if (o) defOpponents.add(o.opponentId);
      }
      // Override defenseOpponentId isn't enough, we handle via club filtering in getForPos
      const meis = getForPos(4, 3, { maxPrice, scoreFn: costBenefitScore });
      const atacs = getForPos(5, 3, { maxPrice, scoreFn: costBenefitScore });
      const tecnico = getForPos(6, 1, { maxPrice, scoreFn: costBenefitScore })[0] || null;
      return { gk, lats, zags, meis, atacs, tecnico };

    } else {
      // LIGA CLÁSSICA: unanimities, scout volume, regularity
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

      // Pick defense first
      const gk = getForPos(1, 1, { scoreFn: volumeScore })[0] || null;
      if (gk) {
        const opp = getOpponent(gk.clube_id);
        defenseOpponentId = opp?.opponentId || null;
      }
      const zags = getForPos(3, 2, { scoreFn: volumeScore, maxPerClub: 2 });
      const lats = getForPos(2, 2, { scoreFn: volumeScore, maxPerClub: 2 });
      // Update defense opponent blacklist
      const defClubes = [gk, ...zags, ...lats].filter(Boolean).map(a => a!.clube_id);
      const allDefOpps = new Set<number>();
      for (const c of defClubes) {
        const o = getOpponent(c);
        if (o) allDefOpps.add(o.opponentId);
      }
      const meis = getForPos(4, 3, { scoreFn: volumeScore });
      const atacs = getForPos(5, 3, { scoreFn: volumeScore });
      const tecnico = getForPos(6, 1, { scoreFn: volumeScore })[0] || null;
      return { gk, lats, zags, meis, atacs, tecnico };
    }
  }, [eligibleAtletas, topSGTeams, getOpponent, teamScoreForMatch, acumulados]);

  // Generate lineup on mount + when strategy/status/seed changes
  useEffect(() => {
    if (eligibleAtletas.length === 0) return;
    const newLineup = generateLineup(estrategia, seed);
    setLineup(newLineup);
  }, [estrategia, statusFilter, seed, generateLineup, eligibleAtletas]);

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
      if (!pontuadosData?.atletas) return 0;
      let total = 0;
      for (const a of allLineupPlayers) {
        const p = pontuadosData.atletas[String(a.atleta_id)];
        if (p) total += p.pontuacao;
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
      {/* ── Controls Bar ── */}
      <div className="bg-primary text-primary-foreground px-4 py-3 mb-4 w-full max-w-[720px] rounded-lg">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold">Estratégia</span>
            <select
              value={estrategia}
              onChange={(e) => setEstrategia(e.target.value as Estrategia)}
              className="bg-primary text-primary-foreground border border-primary-foreground/40 px-2 py-1 rounded text-xs font-bold cursor-pointer transition-all duration-300 hover:scale-105 hover:bg-[hsl(259,70%,60%)]"
            >
              <option value="tiro-curto">🛡️ Tiro Curto</option>
              <option value="bom-e-barato">💰 Bom e Barato</option>
              <option value="liga-classica">🏆 Liga Clássica</option>
            </select>
          </div>
          <div className="font-bold uppercase text-center text-sm">
            {estrategiaLabel[estrategia]}
          </div>
          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="bg-primary text-primary-foreground border border-primary-foreground/40 px-2 py-1 rounded text-xs font-bold cursor-pointer transition-all duration-300 hover:scale-105 hover:bg-[hsl(259,70%,60%)]"
            >
              <option value="provavel">Provável</option>
              <option value="duvida">Dúvida</option>
            </select>
            <button
              onClick={() => setSeed(s => s + 1)}
              className="bg-primary-foreground text-primary font-black px-3 py-1 rounded flex items-center gap-1.5 transition-all duration-300 hover:scale-105 hover:bg-[hsl(259,70%,80%)]"
              title="Gerar novo time com a mesma estratégia"
            >
              <RefreshCw className="w-4 h-4" />
              Atualizar
            </button>
          </div>
        </div>

        {/* Points / Cost Panel */}
        <div className="mt-3 flex flex-col items-center justify-center">
          <div className="text-sm font-black uppercase">
            {mercadoAberto ? 'CUSTO TOTAL DO TIME' : 'PONTOS TOTAIS / PONTUAÇÃO'}
          </div>
          <div
            className="mt-1 min-w-[160px] h-11 rounded-md border-2 border-primary-foreground flex items-center justify-center transition-all duration-300 hover:scale-105 hover:border-[hsl(259,70%,80%)]"
          >
            <span className="text-lg font-black">
              {mercadoAberto
                ? `C$ ${totalCost.toFixed(2)}`
                : `${livePontos.toFixed(2)} pts`
              }
            </span>
          </div>
        </div>

        {/* Strategy description */}
        <div className="mt-2 text-[10px] text-primary-foreground/70 text-center">
          {estrategia === 'tiro-curto' && 'Defesa completa do time com maior probabilidade de SG. Meio/Ataque baseados em scouts de finalização.'}
          {estrategia === 'bom-e-barato' && 'Nenhum jogador acima de C$ 10. Foco em custo-benefício com alta chance de pontuar.'}
          {estrategia === 'liga-classica' && 'Unanimidades da rodada. Regularidade e volume de scouts acumulados.'}
        </div>
      </div>

      {/* ── Round history selector ── */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="text-xs text-muted-foreground font-bold">Rodada:</span>
        <button
          onClick={() => setViewRodada(null)}
          className={cn(
            'px-2 py-1 rounded text-xs font-bold transition-all duration-300 hover:scale-105',
            viewRodada === null ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground hover:bg-[hsl(259,70%,80%)]'
          )}
        >
          Atual ({rodadaAtual})
        </button>
        {rodadaAtual && Array.from({ length: Math.min(rodadaAtual - 1, 10) }, (_, i) => rodadaAtual - 1 - i).filter(r => r > 0).map(r => (
          <button
            key={r}
            onClick={() => setViewRodada(r)}
            className={cn(
              'px-2 py-1 rounded text-xs font-bold transition-all duration-300 hover:scale-105',
              viewRodada === r ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground hover:bg-[hsl(259,70%,80%)]'
            )}
          >
            R{r}
          </button>
        ))}
      </div>

      {/* ── Football Pitch ── */}
      <div className="w-full flex justify-center">
        <div className="relative rounded-2xl p-4 shadow-inner mx-auto w-[95vw] max-w-[520px] min-h-[60vh] md:min-h-[640px]" style={{ backgroundColor: 'hsl(145, 63%, 30%)' }}>
          {/* Pitch markings */}
          <div className="absolute inset-2 rounded-2xl border-4 border-white pointer-events-none" />
          <div className="absolute top-1/2 left-6 right-6 -translate-y-1/2 h-0 border-t-4 border-white pointer-events-none" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full border-4 border-white pointer-events-none" />
          <div className="absolute top-6 left-12 right-12 h-44 border-4 border-white pointer-events-none" />
          <div className="absolute bottom-6 left-12 right-12 h-44 border-4 border-white pointer-events-none" />
          <div className="absolute top-6 left-28 right-28 h-24 border-4 border-white pointer-events-none" />
          <div className="absolute bottom-6 left-28 right-28 h-24 border-4 border-white pointer-events-none" />

          {/* Técnico */}
          {lineup?.tecnico && (
            <div className="absolute left-3 bottom-8 z-20">
              <div className="scale-90">
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
          <div className="pointer-events-none absolute bottom-3 right-3">
            <span className="inline-block bg-black text-white px-3 py-1.5 rounded-md text-xl font-extrabold tracking-wide">4-3-3</span>
          </div>

          {/* Players */}
          <div className="relative flex flex-col justify-between min-h-[640px] py-4">
            {/* Atacantes */}
            <div className="flex items-center justify-around py-3">
              {(lineup?.atacs || [null, null, null]).map((a, i) => (
                <PlayerCardPitch
                  key={a?.atleta_id || `atk-${i}`}
                  atleta={a}
                  clube={a ? clubes[String(a.clube_id)] : undefined}
                  showPrice={mercadoAberto}
                  pontuacao={!mercadoAberto && a ? pontuadosData?.atletas?.[String(a.atleta_id)]?.pontuacao : undefined}
                  onClick={() => a && setSelectedAtleta(a)}
                />
              ))}
            </div>
            {/* Meias */}
            <div className="flex items-center justify-around py-3">
              {(lineup?.meis || [null, null, null]).map((a, i) => (
                <PlayerCardPitch
                  key={a?.atleta_id || `mei-${i}`}
                  atleta={a}
                  clube={a ? clubes[String(a.clube_id)] : undefined}
                  showPrice={mercadoAberto}
                  pontuacao={!mercadoAberto && a ? pontuadosData?.atletas?.[String(a.atleta_id)]?.pontuacao : undefined}
                  onClick={() => a && setSelectedAtleta(a)}
                />
              ))}
            </div>
            {/* Defesa */}
            <div className="flex items-center justify-around py-3">
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
                  onClick={() => a && setSelectedAtleta(a)}
                />
              ))}
            </div>
            {/* Goleiro */}
            <div className="flex items-center justify-around py-3">
              <PlayerCardPitch
                atleta={lineup?.gk || null}
                clube={lineup?.gk ? clubes[String(lineup.gk.clube_id)] : undefined}
                showPrice={mercadoAberto}
                pontuacao={!mercadoAberto && lineup?.gk ? pontuadosData?.atletas?.[String(lineup.gk.atleta_id)]?.pontuacao : undefined}
                onClick={() => lineup?.gk && setSelectedAtleta(lineup.gk)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Strategy info ── */}
      <div className="mt-4 w-full max-w-[720px] bg-card rounded-lg p-4 shadow-md">
        <h3 className="font-bold text-foreground text-sm mb-2">📋 Regras da Estratégia</h3>
        <ul className="text-xs text-muted-foreground space-y-1">
          <li>🛡️ <strong>Filtro Anti-Conflito:</strong> Jogadores de meio/ataque nunca são adversários da defesa escalada.</li>
          <li>📊 <strong>Máx. 1 jogador por clube</strong> para meias e atacantes. Defesa pode ter até 3 do mesmo clube.</li>
          <li>✅ <strong>Status:</strong> {statusFilter === 'provavel' ? 'Apenas jogadores prováveis' : 'Prováveis + Dúvida'}</li>
          {estrategia === 'tiro-curto' && <li>🎯 <strong>Tiro Curto:</strong> Defesa fechada do time com maior probabilidade de SG.</li>}
          {estrategia === 'bom-e-barato' && <li>💰 <strong>Bom e Barato:</strong> Nenhum jogador acima de C$ 10,00.</li>}
          {estrategia === 'liga-classica' && <li>🏆 <strong>Liga Clássica:</strong> Foco em regularidade e volume de scouts acumulados.</li>}
        </ul>
      </div>

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
  onClick,
}: {
  atleta: CartolaAtleta | null;
  clube?: CartolaClube;
  showPrice?: boolean;
  pontuacao?: number;
  onClick?: () => void;
}) {
  if (!atleta) return <div className="w-16 h-16" />;
  return (
    <div
      className="relative flex flex-col items-center cursor-pointer transition-transform duration-300 hover:scale-110"
      onClick={onClick}
    >
      <img
        src={atleta.foto?.replace('FORMATO', '80x80')}
        alt={atleta.apelido}
        className="w-16 h-16 rounded-full object-cover shadow-lg ring-2 ring-white"
        onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }}
      />
      <div className="mt-1 px-2 py-0.5 bg-white/80 rounded">
        <div className="flex items-center gap-1">
          <span className="text-[11px] font-bold text-foreground">{atleta.apelido}</span>
          {clube && <ClubeEscudo clube={clube} size="xs" />}
        </div>
      </div>
      {showPrice && (
        <div className="mt-0.5 px-2 py-0.5 bg-black rounded text-white">
          <span className="text-[10px] font-black">C$ {atleta.preco_num.toFixed(2)}</span>
        </div>
      )}
      {!showPrice && pontuacao !== undefined && (
        <div className="mt-0.5 px-2 py-0.5 bg-black rounded text-white">
          <span className="text-[10px] font-black">{pontuacao.toFixed(1)} pts</span>
        </div>
      )}
    </div>
  );
}
