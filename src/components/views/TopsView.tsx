import { useMemo, useState, useEffect } from 'react';
import { ClubeEscudo } from '@/components/ClubeEscudo';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useMercado, useRodada, usePartidas, useHistoricoRodadas, POSICOES } from '@/hooks/useCartolaData';
import { CircleAlert as AlertCircle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
const LS_KEY_LATERAL = 'statusfc_lateral_side_by_id';
function getLateralSideFromStore(atletaId: number): 'LD' | 'LE' | null {
  try {
    const raw = localStorage.getItem(LS_KEY_LATERAL);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, 'LD' | 'LE'>;
    return map[String(atletaId)] || null;
  } catch {
    return null;
  }
}

const POSICAO_ID_MAP: Record<string, number> = {
  goleiro: 1, lateral: 2, zagueiro: 3, meia: 4, atacante: 5, tecnico: 6,
};
const LS_KEY_LINEUP = 'statusfc_lineup_time_rodada';

export function TopsView({ initialTab, mode }: { initialTab?: string; mode?: 'full' | 'artilheiros-only' | 'time-only' } = {}) {
  const [ultimas, setUltimas] = useState(5);
  const [selectedRound, setSelectedRound] = useState<number | null>(null);
  const [timeStatus] = useState<'provavel' | 'duvida'>('provavel');
  const [refreshKey, setRefreshKey] = useState(0);
  const { data: mercadoData, isLoading: loadingMercado } = useMercado();
  const { data: rodadaData } = useRodada();
  const { data: partidasData, isLoading: loadingPartidas, error: errorPartidas } = usePartidas(selectedRound ?? undefined);
  const { data: historicoData, isLoading: loadingHistorico } = useHistoricoRodadas(selectedRound !== null ? selectedRound : rodadaData?.rodada_atual, ultimas);
  const [lineup, setLineup] = useState<{
    gk: any | null;
    lats: any[];
    zags: any[];
    meis: any[];
    atacs: any[];
    tecnico: any | null;
  } | null>(null);
  const [highlightIds, setHighlightIds] = useState<number[]>([]);

  const isLoading = loadingMercado || loadingPartidas || loadingHistorico;

  const partidas = partidasData?.partidas || [];
  const clubes = partidasData?.clubes || {};

  type RecordType = {
    conquistaCasa: Record<number, number>;
    conquistaFora: Record<number, number>;
    cedeCasa: Record<number, number>;
    cedeFora: Record<number, number>;
  };
  const blankMaps = (): RecordType => ({ conquistaCasa: {}, conquistaFora: {}, cedeCasa: {}, cedeFora: {} });

  // Agrega scouts por clube (conquista/cede, casa/fora)
  const crossovers = useMemo(() => {
    const keys = ['SG', 'DE', 'DS', 'G', 'A', 'FD', 'FF', 'FT', 'FS'] as const;
    const agg: Record<typeof keys[number], RecordType> = {
      SG: blankMaps(), DE: blankMaps(), DS: blankMaps(), G: blankMaps(), A: blankMaps(),
      FD: blankMaps(), FF: blankMaps(), FT: blankMaps(), FS: blankMaps(),
    };
    if (!historicoData || historicoData.length === 0) return agg;

    for (const h of historicoData) {
      if (!h.data?.atletas || !h.partidas?.partidas) continue;
      for (const [, a] of Object.entries(h.data.atletas)) {
        const clubeId = a.clube_id;
        const partida = h.partidas.partidas.find(p => p.clube_casa_id === clubeId || p.clube_visitante_id === clubeId);
        if (!partida) continue;
        const isHome = partida.clube_casa_id === clubeId;
        const opponentId = isHome ? partida.clube_visitante_id : partida.clube_casa_id;
        for (const k of keys) {
          const val = Number(a.scout?.[k] || 0);
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

  const teamScoreForMatch = (teamId: number, opponentId: number, isHome: boolean, key: keyof typeof crossovers) => {
    const maps = crossovers[key];
    if (!maps) return 0;
    return isHome
      ? (maps.conquistaCasa[teamId] || 0) + (maps.cedeFora[opponentId] || 0)
      : (maps.conquistaFora[teamId] || 0) + (maps.cedeCasa[opponentId] || 0);
  };
  const validPartidas = useMemo(() => (partidas || []).filter(p => p.valida), [partidas]);

  // TOP 5 SG (times) — SG absoluto com desempate por mando em caso de empate técnico/baixa amostra
  const topSGTimes = useMemo(() => {
    const LOW_DATA_THRESHOLD = 2;
    const entries: { timeId: number; score: number; isHome: boolean }[] = [];
    for (const p of validPartidas) {
      entries.push({ timeId: p.clube_casa_id, score: teamScoreForMatch(p.clube_casa_id, p.clube_visitante_id, true, 'SG'), isHome: true });
      entries.push({ timeId: p.clube_visitante_id, score: teamScoreForMatch(p.clube_visitante_id, p.clube_casa_id, false, 'SG'), isHome: false });
    }
    const bestByTeam: Record<number, { score: number; isHome: boolean }> = {};
    for (const e of entries) {
      const prev = bestByTeam[e.timeId];
      if (!prev) {
        bestByTeam[e.timeId] = { score: e.score, isHome: e.isHome };
      } else if (e.score > prev.score) {
        bestByTeam[e.timeId] = { score: e.score, isHome: e.isHome };
      } else if (e.score === prev.score && (e.score <= LOW_DATA_THRESHOLD || prev.score <= LOW_DATA_THRESHOLD)) {
        // desempate por mando em baixa amostra/empate técnico
        if (e.isHome && !prev.isHome) bestByTeam[e.timeId] = { score: e.score, isHome: e.isHome };
      }
    }
    const hasProvavelByTeam: Record<number, boolean> = {};
    for (const a of (mercadoData?.atletas || [])) {
      if (a.status_id === 7) hasProvavelByTeam[a.clube_id] = true;
    }
    const validTeamSet = new Set<number>();
    for (const p of validPartidas) {
      validTeamSet.add(p.clube_casa_id);
      validTeamSet.add(p.clube_visitante_id);
    }
    return Object.entries(bestByTeam)
      .map(([timeId, v]) => ({ timeId: Number(timeId), score: v.score }))
      .filter(t => validTeamSet.has(t.timeId) && !!hasProvavelByTeam[t.timeId])
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }, [validPartidas, crossovers, mercadoData]);

  // IDs dos times Top 5 SG — usado para restringir posições defensivas
  const topSGTeamIds = useMemo(() => new Set(topSGTimes.map(t => t.timeId)), [topSGTimes]);

  // ESPELHAMENTO TOTAL: Técnicos mapeados diretamente dos Top 5 SG (mesma ordem, sem filtros)
  const topTecnicos = useMemo(() => {
    const allAtletas = mercadoData?.atletas || [];
    const clubesMap = mercadoData?.clubes || {};
    const tecnicosByClube = new Map<number, any>();

    for (const atleta of allAtletas) {
      if (atleta.posicao_id !== 6) continue;
      const clubeId = Number(atleta.clube_id);
      if (!tecnicosByClube.has(clubeId)) {
        tecnicosByClube.set(clubeId, atleta);
      }
    }

    return topSGTimes.slice(0, 5).map((sg, idx) => {
      const clubeId = Number(sg.timeId);
      const tecnico = tecnicosByClube.get(clubeId);
      if (tecnico) return tecnico;

      const clube = clubesMap[String(clubeId)] || clubesMap[clubeId];
      return {
        atleta_id: -1000 - idx,
        apelido: `Téc. ${clube?.abreviacao || clube?.nome || 'N/D'}`,
        nome: `Técnico ${clube?.nome || 'N/D'}`,
        foto: '/placeholder.svg',
        clube_id: clubeId,
        posicao_id: 6,
        status_id: 7,
        media_num: 0,
        preco_num: 0,
        variacao_num: 0,
        jogos_num: 0,
      };
    });
  }, [topSGTimes, mercadoData]);

  const getOpponentForPlayer = (clubId: number) => {
    const partida = validPartidas.find(p => p.clube_casa_id === clubId || p.clube_visitante_id === clubId);
    if (!partida) return null;
    const isHome = partida.clube_casa_id === clubId;
    const opponentId = isHome ? partida.clube_visitante_id : partida.clube_casa_id;
    return { opponentId, isHome };
  };

  const atletasProvaveis = useMemo(() => (mercadoData?.atletas || []).filter(a => a.status_id === 7), [mercadoData]);
  const atletasElegiveis = useMemo(
    () => (mercadoData?.atletas || []).filter(a => a.status_id === 7),
    [mercadoData],
  );

  const pickTopByMedia = (posId: number, count: number, used: Set<number>) => {
    const pool = (mercadoData?.atletas || [])
      .filter(a => a.posicao_id === posId && a.status_id === 7 && !used.has(a.atleta_id))
      .sort((a, b) => b.media_num - a.media_num);
    return pool.slice(0, count);
  };

  useEffect(() => {
    if (mode !== 'time-only') return;
    const raw = typeof window !== 'undefined' ? localStorage.getItem(LS_KEY_LINEUP) : null;
    const idx: Record<number, any> = {};
    for (const a of (mercadoData?.atletas || [])) idx[a.atleta_id] = a;
    if (raw) {
      try {
        const saved = JSON.parse(raw) as { gk?: number; lats?: number[]; zags?: number[]; meis?: number[]; atacs?: number[]; tecnico?: number };
        const next = {
          gk: saved.gk ? idx[saved.gk] || null : null,
          lats: (saved.lats || []).map(id => idx[id]).filter(Boolean),
          zags: (saved.zags || []).map(id => idx[id]).filter(Boolean),
          meis: (saved.meis || []).map(id => idx[id]).filter(Boolean),
          atacs: (saved.atacs || []).map(id => idx[id]).filter(Boolean),
          tecnico: saved.tecnico ? idx[saved.tecnico] || null : null,
        };
        const enough = next.gk && next.tecnico && next.lats.length === 2 && next.zags.length === 2 && next.meis.length === 3 && next.atacs.length === 3;
        if (enough) {
          setLineup(next);
          setHighlightIds([]);
          return;
        }
      } catch {}
    }
    const used = new Set<number>();
    const gk = pickTopByMedia(1, 1, used)[0] || null;
    if (gk) used.add(gk.atleta_id);
    const lats = pickTopByMedia(2, 2, used); lats.forEach(x => used.add(x.atleta_id));
    const zags = pickTopByMedia(3, 2, used); zags.forEach(x => used.add(x.atleta_id));
    const meis = pickTopByMedia(4, 3, used); meis.forEach(x => used.add(x.atleta_id));
    const atacs = pickTopByMedia(5, 3, used); atacs.forEach(x => used.add(x.atleta_id));
    const tecnico = pickTopByMedia(6, 1, used)[0] || null;
    const next = { gk, lats, zags, meis, atacs, tecnico };
    setLineup(next);
    const duvidas = [
      next.gk,
      ...next.lats,
      ...next.zags,
      ...next.meis,
      ...next.atacs,
      next.tecnico,
    ].filter(Boolean).filter((a: any) => a.status_id === 2).map((a: any) => a.atleta_id);
    setHighlightIds(timeStatus === 'duvida' ? duvidas : []);
  }, [mode, mercadoData]);

  useEffect(() => {
    if (mode !== 'time-only') return;
    if (!lineup) return;
    const payload = {
      gk: lineup.gk?.atleta_id || null,
      lats: lineup.lats?.map(a => a.atleta_id) || [],
      zags: lineup.zags?.map(a => a.atleta_id) || [],
      meis: lineup.meis?.map(a => a.atleta_id) || [],
      atacs: lineup.atacs?.map(a => a.atleta_id) || [],
      tecnico: lineup.tecnico?.atleta_id || null,
    };
    try { localStorage.setItem(LS_KEY_LINEUP, JSON.stringify(payload)); } catch {}
  }, [mode, lineup]);

  const acumuladosPorAtleta = useMemo(() => {
    const acc: Record<number, { G: number; A: number; FD: number; FF: number; FT: number; DS: number; SG: number; DE: number }> = {};
    if (!historicoData) return acc;
    for (const h of historicoData) {
      const atletas = h.data?.atletas;
      if (!atletas) continue;
      for (const [idStr, a] of Object.entries(atletas) as any) {
        const id = Number(idStr);
        if (!acc[id]) acc[id] = { G: 0, A: 0, FD: 0, FF: 0, FT: 0, DS: 0, SG: 0, DE: 0 };
        acc[id].G += Number(a.scout?.G || 0);
        acc[id].A += Number(a.scout?.A || 0);
        acc[id].FD += Number(a.scout?.FD || 0);
        acc[id].FF += Number(a.scout?.FF || 0);
        acc[id].FT += Number(a.scout?.FT || 0);
        acc[id].DS += Number(a.scout?.DS || 0);
        acc[id].SG += Number(a.scout?.SG || 0);
        acc[id].DE += Number(a.scout?.DE || 0);
      }
    }
    return acc;
  }, [historicoData]);

  const sanitizeNomeClube = (nome?: string) => {
    return nome || '';
  };

  const topPlayersForPos = (posId: number, limit: number, excludeTeams?: Set<number>) => {
    const isDefensive = [1, 2, 3, 6].includes(posId);

    let candidatos = atletasElegiveis.filter(a => a.posicao_id === posId);

    // CONCORDÂNCIA DEFENSIVA: GOL, LAT, ZAG, TEC somente dos Top 5 SG
    if (isDefensive && topSGTeamIds.size > 0) {
      candidatos = candidatos.filter(a => topSGTeamIds.has(a.clube_id));
    }

    // Excluir times já usados (para dedup cross-posição)
    if (excludeTeams && excludeTeams.size > 0) {
      candidatos = candidatos.filter(a => !excludeTeams.has(a.clube_id));
    }

    // Filtro de qualidade por acumulados
    if (posId === POSICAO_ID_MAP.meia || posId === POSICAO_ID_MAP.atacante) {
      candidatos = candidatos.filter(a => {
        const acum = acumuladosPorAtleta?.[a.atleta_id];
        return (acum?.G || 0) > 0 || (acum?.A || 0) > 0;
      });
    }

    const scored = candidatos.map(a => {
      const opp = getOpponentForPlayer(a.clube_id);
      if (!opp) return { atleta: a, score: -Infinity, perf: 0, g: 0, aS: 0, fd: 0, ds: 0, de: 0, sg: 0, oppCedeG: 0 };

      const g = teamScoreForMatch(a.clube_id, opp.opponentId, opp.isHome, 'G');
      const aS = teamScoreForMatch(a.clube_id, opp.opponentId, opp.isHome, 'A');
      const fd = teamScoreForMatch(a.clube_id, opp.opponentId, opp.isHome, 'FD');
      const ds = teamScoreForMatch(a.clube_id, opp.opponentId, opp.isHome, 'DS');
      const de = teamScoreForMatch(a.clube_id, opp.opponentId, opp.isHome, 'DE');
      const sg = teamScoreForMatch(a.clube_id, opp.opponentId, opp.isHome, 'SG');
      const oppCedeG = teamScoreForMatch(opp.opponentId, a.clube_id, !opp.isHome, 'G');

      // Bônus de 15% para mandante
      const homeBonus = opp.isHome ? 1.15 : 1.0;

      let score = -Infinity;
      if (isDefensive) {
        // Defensivos: crossing score (SG + scouts defensivos) + média como peso
        if (posId === POSICAO_ID_MAP.goleiro) {
          score = (1.0 * sg + 0.7 * de) * homeBonus;
        } else if (posId === POSICAO_ID_MAP.zagueiro || posId === POSICAO_ID_MAP.lateral) {
          score = (1.0 * sg + 0.6 * ds) * homeBonus;
        } else if (posId === POSICAO_ID_MAP.tecnico) {
          const oppIsHome = !opp.isHome;
          const theirs = teamScoreForMatch(opp.opponentId, a.clube_id, oppIsHome, 'G');
          const vit = Math.max(g - theirs, 0);
          score = ((sg + vit) / 2) * homeBonus;
        }
        // Peso da média geral como fator de desempate
        score += (a.media_num || 0) * 0.5;
      } else {
        // Ofensivos: gols/assistências do cruzamento + média geral
        score = (1.0 * g + 0.7 * aS + 0.3 * fd) * homeBonus;
      }

      const perf = (a.media_num || 0) * 2 + (1.0 * g + 0.7 * aS + 0.3 * fd) * homeBonus;
      return { atleta: a, score, perf, g, aS, fd, ds, de, sg, oppCedeG };
    });

    // Filtro de qualidade por scouts acumulados
    const filtrados = scored.filter(s => {
      if (!isFinite(s.score)) return false;
      const acum = acumuladosPorAtleta?.[s.atleta.atleta_id] || { G: 0, A: 0, FD: 0, FF: 0, FT: 0, DS: 0, SG: 0, DE: 0 };
      if (s.atleta.posicao_id === POSICAO_ID_MAP.goleiro) return (acum.SG || 0) > 0 || (acum.DE || 0) > 0;
      if (s.atleta.posicao_id === POSICAO_ID_MAP.tecnico) return true; // Sempre incluir técnicos dos Top 5 SG
      if (s.atleta.posicao_id === POSICAO_ID_MAP.meia || s.atleta.posicao_id === POSICAO_ID_MAP.atacante) return (acum.G || 0) > 0 || (acum.A || 0) > 0;
      return (acum.DS || 0) > 0 || (acum.SG || 0) > 0;
    });

    // Ordenação
    if (isDefensive) {
      // Defensivos: crossing score com média como desempate
      filtrados.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return (b.atleta.media_num || 0) - (a.atleta.media_num || 0);
      });
    } else {
      // Ofensivos: perf (média + cruzamento)
      filtrados.sort((a, b) => {
        if (b.perf !== a.perf) return b.perf - a.perf;
        if (b.g !== a.g) return b.g - a.g;
        if (b.aS !== a.aS) return b.aS - a.aS;
        return b.oppCedeG - a.oppCedeG;
      });
    }

    // Um jogador por time
    const vistos = new Set<number>();
    const lista: any[] = [];
    for (const s of filtrados) {
      if (vistos.has(s.atleta.clube_id)) continue;
      lista.push(s.atleta);
      vistos.add(s.atleta.clube_id);
      if (lista.length >= limit) break;
    }

    // Fallback: preencher com atletas por média se não atingiu o limite
    if (lista.length < limit) {
      const fallbackPool = isDefensive && topSGTeamIds.size > 0
        ? candidatos.filter(a => !vistos.has(a.clube_id))
        : scored.filter(x => isFinite(x.score)).map(x => x.atleta).filter(a => !vistos.has(a.clube_id));
      const sorted = (isDefensive ? fallbackPool : fallbackPool).sort((a, b) => (b.media_num || 0) - (a.media_num || 0));
      for (const a of sorted) {
        if (vistos.has(a.clube_id)) continue;
        if (lista.find(x => x.atleta_id === a.atleta_id)) continue;
        lista.push(a);
        vistos.add(a.clube_id);
        if (lista.length >= limit) break;
      }
    }
    return lista.slice(0, limit);
  };

  // PICKS OFENSIVOS UNIFICADOS — time não repete entre MEI, ATA e Capitães
  const unifiedOffensive = useMemo(() => {
    const usedTeams = new Set<number>();

    const meias = topPlayersForPos(4, 5, usedTeams);
    meias.forEach(a => usedTeams.add(a.clube_id));

    const atacantes = topPlayersForPos(5, 5, usedTeams);
    atacantes.forEach(a => usedTeams.add(a.clube_id));

    // Capitães: top 3 escolhidos DENTRO dos 5 meias + 5 atacantes já listados
    const capPool = [...meias, ...atacantes];

    const capScored = capPool.map(a => {
      const opp = getOpponentForPlayer(a.clube_id);
      if (!opp) return { atleta: a, capScore: -Infinity };
      const g = teamScoreForMatch(a.clube_id, opp.opponentId, opp.isHome, 'G');
      const aS = teamScoreForMatch(a.clube_id, opp.opponentId, opp.isHome, 'A');
      const homeBonus = opp.isHome ? 1.15 : 1.0;
      // Peso extra de 5% para atacantes na probabilidade de gol
      const atkBonus = a.posicao_id === POSICAO_ID_MAP.atacante ? 1.05 : 1.0;
      // Critério: Gol > Assistência > Média Geral (desempate)
      const capScore = (g * 1.0 * atkBonus + aS * 0.5) * homeBonus;
      return { atleta: a, capScore, g, aS, media: a.media_num || 0 };
    }).filter(s => isFinite(s.capScore));

    capScored.sort((a, b) => {
      if (b.capScore !== a.capScore) return b.capScore - a.capScore;
      if ((b.g || 0) !== (a.g || 0)) return (b.g || 0) - (a.g || 0);
      if ((b.aS || 0) !== (a.aS || 0)) return (b.aS || 0) - (a.aS || 0);
      return (b.media || 0) - (a.media || 0);
    });
    const capVistos = new Set<number>();
    const capitaes: any[] = [];
    for (const s of capScored) {
      if (capVistos.has(s.atleta.clube_id)) continue;
      capitaes.push(s.atleta);
      capVistos.add(s.atleta.clube_id);
      if (capitaes.length >= 3) break;
    }

    return { meias, atacantes, capitaes };
  }, [atletasProvaveis, atletasElegiveis, validPartidas, crossovers, acumuladosPorAtleta, topSGTeamIds]);

  useEffect(() => {
    if (mode !== 'time-only') return;
    const raw = typeof window !== 'undefined' ? localStorage.getItem(LS_KEY_LINEUP) : null;
    const idx: Record<number, any> = {};
    for (const a of (mercadoData?.atletas || [])) idx[a.atleta_id] = a;
    if (raw) {
      try {
        const saved = JSON.parse(raw) as { gk?: number; lats?: number[]; zags?: number[]; meis?: number[]; atacs?: number[]; tecnico?: number };
        const next = {
          gk: saved.gk ? idx[saved.gk] || null : null,
          lats: (saved.lats || []).map(id => idx[id]).filter(Boolean),
          zags: (saved.zags || []).map(id => idx[id]).filter(Boolean),
          meis: (saved.meis || []).map(id => idx[id]).filter(Boolean),
          atacs: (saved.atacs || []).map(id => idx[id]).filter(Boolean),
          tecnico: saved.tecnico ? idx[saved.tecnico] || null : null,
        };
        const enough = next.gk && next.tecnico && next.lats.length === 2 && next.zags.length === 2 && next.meis.length === 3 && next.atacs.length === 3;
        if (enough) {
          setLineup(next);
          setHighlightIds([]);
          return;
        }
      } catch {}
    }
    const used = new Set<number>();
    const gk = pickTopByMedia(1, 1, used)[0] || null;
    if (gk) used.add(gk.atleta_id);
    const lats = pickTopByMedia(2, 2, used); lats.forEach(x => used.add(x.atleta_id));
    const zags = pickTopByMedia(3, 2, used); zags.forEach(x => used.add(x.atleta_id));
    const meis = pickTopByMedia(4, 3, used); meis.forEach(x => used.add(x.atleta_id));
    const atacs = pickTopByMedia(5, 3, used); atacs.forEach(x => used.add(x.atleta_id));
    const tecnico = pickTopByMedia(6, 1, used)[0] || null;
    const next = { gk, lats, zags, meis, atacs, tecnico };
    setLineup(next);
    setHighlightIds([]);
  }, [mode, mercadoData]);

  useEffect(() => {
    if (mode !== 'time-only') return;
    if (!lineup) return;
    const payload = {
      gk: lineup.gk?.atleta_id || null,
      lats: lineup.lats?.map(a => a.atleta_id) || [],
      zags: lineup.zags?.map(a => a.atleta_id) || [],
      meis: lineup.meis?.map(a => a.atleta_id) || [],
      atacs: lineup.atacs?.map(a => a.atleta_id) || [],
      tecnico: lineup.tecnico?.atleta_id || null,
    };
    try { localStorage.setItem(LS_KEY_LINEUP, JSON.stringify(payload)); } catch {}
  }, [mode, lineup]);

  useEffect(() => {
    const next = {
      gk: (topPlayersForPos(1, 1)[0] || null),
      lats: (topPlayersForPos(2, 2) || []),
      zags: (topPlayersForPos(3, 2) || []),
      meis: (unifiedOffensive.meias.slice(0, 3) || []),
      atacs: (unifiedOffensive.atacantes.slice(0, 3) || []),
      tecnico: (topTecnicos[0] || null),
    };
    setLineup(next);
    setHighlightIds([]);
  }, [refreshKey, unifiedOffensive, topSGTeamIds]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" text="Carregando tops..." />
      </div>
    );
  }

  if (errorPartidas) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-destructive gap-3">
        <AlertCircle className="w-12 h-12" />
        <p className="font-bold">Erro ao carregar dados</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {mode !== 'time-only' && (
        <>
          <div className="flex items-center gap-3 mb-4 bg-muted/50 p-3 rounded-lg">
            <span className="text-xs text-muted-foreground font-bold whitespace-nowrap">📊 Rodada:</span>
            <Select
              value={selectedRound !== null ? String(selectedRound) : 'atual'}
              onValueChange={(val) => setSelectedRound(val === 'atual' ? null : Number(val))}
            >
              <SelectTrigger className="w-[180px] bg-primary text-primary-foreground border-none font-bold">
                <SelectValue placeholder="Rodada Atual" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border max-h-60">
                <SelectItem value="atual" className="font-bold">Rodada Atual</SelectItem>
                {Array.from({ length: 38 }, (_, i) => i + 1).map(round => (
                  <SelectItem key={round} value={String(round)} className="font-bold">
                    Rodada {round}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      )}
      {mode === 'time-only' ? (
        <div className="w-full min-h-[100vh] flex flex-col items-center justify-center">
          <div className="bg-primary text-primary-foreground px-3 py-2 mb-4 w-full max-w-[720px]">
            <div className="flex items-center justify-between">
              <div className="font-bold uppercase text-center">🟩 Time da Rodada</div>
              <button
                onClick={() => {
                  const empty = !lineup || !lineup.gk || !lineup.tecnico || lineup.lats.length !== 2 || lineup.zags.length !== 2 || lineup.meis.length !== 3 || lineup.atacs.length !== 3;
                  if (empty) {
                    const used = new Set<number>();
                    const gk = pickTopByMedia(1, 1, used)[0] || null; if (gk) used.add(gk.atleta_id);
                    const lats = pickTopByMedia(2, 2, used); lats.forEach(x => used.add(x.atleta_id));
                    const zags = pickTopByMedia(3, 2, used); zags.forEach(x => used.add(x.atleta_id));
                    const meis = pickTopByMedia(4, 3, used); meis.forEach(x => used.add(x.atleta_id));
                    const atacs = pickTopByMedia(5, 3, used); atacs.forEach(x => used.add(x.atleta_id));
                    const tecnico = pickTopByMedia(6, 1, used)[0] || null;
                    setLineup({ gk, lats, zags, meis, atacs, tecnico });
                    setHighlightIds([]);
                    return;
                  }
                  const current = [lineup.gk, ...lineup.lats, ...lineup.zags, ...lineup.meis, ...lineup.atacs].filter(Boolean) as any[];
                  const duvidas = current.filter(a => a.status_id === 2 || a.status_id === 6).map(a => a.atleta_id);
                  setHighlightIds(duvidas);
                  if (timeStatus === 'provavel') {
                    const used = new Set<number>(current.map(a => a.atleta_id));
                    const replaceIfNeeded = (a: any, posId: number) => {
                      if (!a) return a;
                      if (a.status_id === 2 || a.status_id === 6) {
                        const pool = (mercadoData?.atletas || [])
                          .filter(x => x.posicao_id === posId && x.status_id === 7 && !used.has(x.atleta_id))
                          .sort((x, y) => y.media_num - x.media_num);
                        const r = pool[0] || null;
                        if (r) {
                          used.add(r.atleta_id);
                          return r;
                        }
                      }
                      return a;
                    };
                    const newLineup = {
                      gk: replaceIfNeeded(lineup.gk, 1),
                      lats: lineup.lats.map(x => replaceIfNeeded(x, 2)),
                      zags: lineup.zags.map(x => replaceIfNeeded(x, 3)),
                      meis: lineup.meis.map(x => replaceIfNeeded(x, 4)),
                      atacs: lineup.atacs.map(x => replaceIfNeeded(x, 5)),
                      tecnico: lineup.tecnico,
                    };
                    const newCurr = [newLineup.gk, ...newLineup.lats, ...newLineup.zags, ...newLineup.meis, ...newLineup.atacs].filter(Boolean) as any[];
                    const newDuvidas = newCurr.filter(a => a.status_id === 2 || a.status_id === 6).map(a => a.atleta_id);
                    setHighlightIds(newDuvidas);
                    setLineup(newLineup);
                  }
                }}
                className="bg-primary-foreground text-primary font-black px-3 py-1 rounded"
              >
                Atualizar Time
              </button>
            </div>
            <div className="mt-2 flex flex-col items-center justify-center">
              <div className="text-sm font-black">PONTOS TOTAIS</div>
              <div className="mt-1 w-28 h-10 rounded-md border-2 border-primary-foreground"></div>
            </div>
          </div>
          <TimeDaRodada
            key={refreshKey}
            getTop={(posId, n) => topPlayersForPos(posId, n)}
            capitao={unifiedOffensive.capitaes?.[0] || null}
            tecnico={(lineup?.tecnico ?? (topPlayersForPos(6,1)[0] || null))}
            clubes={mercadoData?.clubes || {}}
            lineup={lineup ? { gk: lineup.gk, lats: lineup.lats, zags: lineup.zags, meis: lineup.meis, atacs: lineup.atacs } : undefined}
            highlightIds={highlightIds}
          />
        </div>
      ) : mode === 'artilheiros-only' ? (
        <div className="w-full">
          <div className="text-xs bg-primary/20 text-primary-foreground mb-4 px-3 py-2 rounded-md text-center font-bold">
            Legenda: (G) Gol • (ASS) Assistência
          </div>
          <TopArtilheiros
            atletas={atletasProvaveis}
            acumulados={acumuladosPorAtleta}
            clubes={mercadoData?.clubes || {}}
            title="Top Artilheiros"
          />
        </div>
      ) : (
      <Tabs defaultValue={initialTab ?? 'sg'} className="w-full">
        <TabsList className="w-full max-w-4xl bg-primary/20 mb-2 grid grid-cols-4 gap-1 h-auto max-md:grid-cols-4 max-md:gap-0.5">
          <TabsTrigger value="sg" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-bold text-xs px-2 max-md:text-[10px] max-md:px-1 max-md:py-1.5">
            🛡️ SG
          </TabsTrigger>
          <TabsTrigger value="goleiros" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-bold text-xs px-2 max-md:text-[10px] max-md:px-1 max-md:py-1.5">
            🧤 Goleiros
          </TabsTrigger>
          <TabsTrigger value="zagueiros" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-bold text-xs px-2 max-md:text-[10px] max-md:px-1 max-md:py-1.5">
            🧱 Zagueiros
          </TabsTrigger>
          <TabsTrigger value="laterais" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-bold text-xs px-2 max-md:text-[10px] max-md:px-1 max-md:py-1.5">
            🏃 Laterais
          </TabsTrigger>
          <TabsTrigger value="meias" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-bold text-xs px-2 max-md:text-[10px] max-md:px-1 max-md:py-1.5">
            💡 Meias
          </TabsTrigger>
          <TabsTrigger value="atacantes" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-bold text-xs px-2 max-md:text-[10px] max-md:px-1 max-md:py-1.5">
            🏹 Atacantes
          </TabsTrigger>
          <TabsTrigger value="tecnicos" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-bold text-xs px-2 max-md:text-[10px] max-md:px-1 max-md:py-1.5">
            📋 Técnicos
          </TabsTrigger>
          <TabsTrigger value="capitaes" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-bold text-xs px-2 max-md:text-[10px] max-md:px-1 max-md:py-1.5">
            👑 Capitães
          </TabsTrigger>
        </TabsList>
        <div className="text-xs text-muted-foreground mb-4 max-md:text-[10px] max-md:mb-3 max-md:mt-1">
          Legenda: (G) Gol • (DES) Desarme • (SG) Saldo de Gol • (ASS) Assistência
        </div>

        <TabsContent value="sg">
          <div className="bg-card rounded-xl overflow-hidden shadow-lg">
            <div className="bg-primary p-3 text-center font-bold uppercase text-primary-foreground">
              🛡️ Top 5 SG (Saldo de Gols) — Times
            </div>
            <div className="px-4 py-2 text-[11px] text-muted-foreground">Base: SG dos clubes com partidas válidas na rodada</div>
            <div>
              {topSGTimes.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">Sem dados disponíveis</div>
              ) : (
                topSGTimes.map((t, idx) => {
                  const clube = clubes[t.timeId];
                  if (!clube) return null;
                  const maxSG = topSGTimes[0]?.score || 1;
                  const pct = Math.round((t.score / maxSG) * 100);
                  return (
                    <div key={t.timeId} className={cn('flex items-center gap-3 px-4 py-3', idx < topSGTimes.length - 1 && 'border-b border-border')}>
                      <span className="text-muted-foreground font-bold w-6 text-center text-sm">{idx + 1}º</span>
                      <ClubeEscudo clube={clube} size="sm" showName />
                      <div className="ml-auto text-xs font-bold">
                        <ProbBadge label="SG" value={pct} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="goleiros">
          <ListAtletas
            title="🧤 Top 5 Goleiros (DEF/SG)"
            atletas={topPlayersForPos(1, 5)}
            clubes={mercadoData?.clubes || {}}
            getConfronto={(a) => {
              const partida = validPartidas.find(p => p.clube_casa_id === a.clube_id || p.clube_visitante_id === a.clube_id);
              if (!partida) return null;
              const casa = partidasData?.clubes?.[partida.clube_casa_id];
              const fora = partidasData?.clubes?.[partida.clube_visitante_id];
              return { casa, fora };
            }}
            calcKeyScore={(a, key) => {
              const opp = validPartidas.find(p => p.clube_casa_id === a.clube_id || p.clube_visitante_id === a.clube_id);
              if (!opp) return 0;
              const isHome = opp.clube_casa_id === a.clube_id;
              const opponentId = isHome ? opp.clube_visitante_id : opp.clube_casa_id;
              if (key === 'FIN') {
                return teamScoreForMatch(a.clube_id, opponentId, isHome, 'FD')
                  + teamScoreForMatch(a.clube_id, opponentId, isHome, 'FF')
                  + teamScoreForMatch(a.clube_id, opponentId, isHome, 'FT');
              }
              return teamScoreForMatch(a.clube_id, opponentId, isHome, key as any);
            }}
            keysToDisplay={['DE', 'SG']}
            acumulados={acumuladosPorAtleta}
            sanitizeNomeClube={sanitizeNomeClube}
            statBuilder={(a) => {
              const acum = acumuladosPorAtleta?.[a.atleta_id];
              const de = acum?.DE || 0;
              const sg = acum?.SG || 0;
              return `DEF: ${de} • SG: ${sg}`;
            }}
          />
        </TabsContent>
        <TabsContent value="zagueiros">
          <ListAtletas
            title="🧱 Top 5 Zagueiros (DES/SG)"
            atletas={topPlayersForPos(3, 5)}
            clubes={mercadoData?.clubes || {}}
            getConfronto={(a) => {
              const partida = validPartidas.find(p => p.clube_casa_id === a.clube_id || p.clube_visitante_id === a.clube_id);
              if (!partida) return null;
              const casa = partidasData?.clubes?.[partida.clube_casa_id];
              const fora = partidasData?.clubes?.[partida.clube_visitante_id];
              return { casa, fora };
            }}
            calcKeyScore={(a, key) => {
              const opp = validPartidas.find(p => p.clube_casa_id === a.clube_id || p.clube_visitante_id === a.clube_id);
              if (!opp) return 0;
              const isHome = opp.clube_casa_id === a.clube_id;
              const opponentId = isHome ? opp.clube_visitante_id : opp.clube_casa_id;
              if (key === 'FIN') {
                return teamScoreForMatch(a.clube_id, opponentId, isHome, 'FD')
                  + teamScoreForMatch(a.clube_id, opponentId, isHome, 'FF')
                  + teamScoreForMatch(a.clube_id, opponentId, isHome, 'FT');
              }
              return teamScoreForMatch(a.clube_id, opponentId, isHome, key as any);
            }}
            keysToDisplay={['DS', 'SG']}
            acumulados={acumuladosPorAtleta}
            sanitizeNomeClube={sanitizeNomeClube}
            statBuilder={(a) => {
              const acum = acumuladosPorAtleta?.[a.atleta_id];
              const ds = acum?.DS || 0;
              const sg = acum?.SG || 0;
              return `DES: ${ds} • SG: ${sg}`;
            }}
          />
        </TabsContent>
        <TabsContent value="laterais">
          <ListAtletas
            title="🏃 Top 5 Laterais (DES/SG)"
            atletas={topPlayersForPos(2, 5)}
            clubes={mercadoData?.clubes || {}}
            getConfronto={(a) => {
              const partida = validPartidas.find(p => p.clube_casa_id === a.clube_id || p.clube_visitante_id === a.clube_id);
              if (!partida) return null;
              const casa = partidasData?.clubes?.[partida.clube_casa_id];
              const fora = partidasData?.clubes?.[partida.clube_visitante_id];
              return { casa, fora };
            }}
            calcKeyScore={(a, key) => {
              const opp = validPartidas.find(p => p.clube_casa_id === a.clube_id || p.clube_visitante_id === a.clube_id);
              if (!opp) return 0;
              const isHome = opp.clube_casa_id === a.clube_id;
              const opponentId = isHome ? opp.clube_visitante_id : opp.clube_casa_id;
              if (key === 'FIN') {
                return teamScoreForMatch(a.clube_id, opponentId, isHome, 'FD')
                  + teamScoreForMatch(a.clube_id, opponentId, isHome, 'FF')
                  + teamScoreForMatch(a.clube_id, opponentId, isHome, 'FT');
              }
              return teamScoreForMatch(a.clube_id, opponentId, isHome, key as any);
            }}
            keysToDisplay={['DS', 'SG']}
            acumulados={acumuladosPorAtleta}
            sanitizeNomeClube={sanitizeNomeClube}
            statBuilder={(a) => {
              const acum = acumuladosPorAtleta?.[a.atleta_id];
              const ds = acum?.DS || 0;
              const sg = acum?.SG || 0;
              return `DES: ${ds} • SG: ${sg}`;
            }}
          />
        </TabsContent>
        <TabsContent value="meias">
          <ListAtletas
            title="💡 Top 5 Meias (G/ASS/FIN)"
            atletas={unifiedOffensive.meias}
            clubes={mercadoData?.clubes || {}}
            getConfronto={(a) => {
              const partida = validPartidas.find(p => p.clube_casa_id === a.clube_id || p.clube_visitante_id === a.clube_id);
              if (!partida) return null;
              const casa = partidasData?.clubes?.[partida.clube_casa_id];
              const fora = partidasData?.clubes?.[partida.clube_visitante_id];
              return { casa, fora };
            }}
            calcKeyScore={(a, key) => {
              const opp = validPartidas.find(p => p.clube_casa_id === a.clube_id || p.clube_visitante_id === a.clube_id);
              if (!opp) return 0;
              const isHome = opp.clube_casa_id === a.clube_id;
              const opponentId = isHome ? opp.clube_visitante_id : opp.clube_casa_id;
              if (key === 'FIN') {
                return teamScoreForMatch(a.clube_id, opponentId, isHome, 'FD')
                  + teamScoreForMatch(a.clube_id, opponentId, isHome, 'FF')
                  + teamScoreForMatch(a.clube_id, opponentId, isHome, 'FT');
              }
              return teamScoreForMatch(a.clube_id, opponentId, isHome, key as any);
            }}
            keysToDisplay={['G', 'A', 'FIN']}
            acumulados={acumuladosPorAtleta}
            sanitizeNomeClube={sanitizeNomeClube}
            statBuilder={(a) => {
              const acum = acumuladosPorAtleta?.[a.atleta_id];
              const g = acum?.G || 0;
              const as = acum?.A || 0;
              const fd = acum?.FD || 0;
              const ff = acum?.FF || 0;
              return `G: ${g} • ASS: ${as} • FD: ${fd} • FF: ${ff}`;
            }}
          />
        </TabsContent>
        <TabsContent value="atacantes">
          <ListAtletas
            title="🏹 Top 5 Atacantes (G/ASS/FIN)"
            atletas={unifiedOffensive.atacantes}
            clubes={mercadoData?.clubes || {}}
            getConfronto={(a) => {
              const partida = validPartidas.find(p => p.clube_casa_id === a.clube_id || p.clube_visitante_id === a.clube_id);
              if (!partida) return null;
              const casa = partidasData?.clubes?.[partida.clube_casa_id];
              const fora = partidasData?.clubes?.[partida.clube_visitante_id];
              return { casa, fora };
            }}
            calcKeyScore={(a, key) => {
              const opp = validPartidas.find(p => p.clube_casa_id === a.clube_id || p.clube_visitante_id === a.clube_id);
              if (!opp) return 0;
              const isHome = opp.clube_casa_id === a.clube_id;
              const opponentId = isHome ? opp.clube_visitante_id : opp.clube_casa_id;
              if (key === 'FIN') {
                return teamScoreForMatch(a.clube_id, opponentId, isHome, 'FD')
                  + teamScoreForMatch(a.clube_id, opponentId, isHome, 'FF')
                  + teamScoreForMatch(a.clube_id, opponentId, isHome, 'FT');
              }
              return teamScoreForMatch(a.clube_id, opponentId, isHome, key as any);
            }}
            keysToDisplay={['G', 'A', 'FIN']}
            acumulados={acumuladosPorAtleta}
            sanitizeNomeClube={sanitizeNomeClube}
            statBuilder={(a) => {
              const acum = acumuladosPorAtleta?.[a.atleta_id];
              const g = acum?.G || 0;
              const as = acum?.A || 0;
              const fd = acum?.FD || 0;
              const ff = acum?.FF || 0;
              return `G: ${g} • ASS: ${as} • FD: ${fd} • FF: ${ff}`;
            }}
          />
        </TabsContent>
        <TabsContent value="tecnicos">
          <ListAtletas
            title="📋 Top 5 Técnicos (SG/VIT)"
            atletas={topTecnicos}
            clubes={mercadoData?.clubes || {}}
            getConfronto={(a) => {
              const partida = partidas.find(p => p.clube_casa_id === a.clube_id || p.clube_visitante_id === a.clube_id);
              if (!partida) return null;
              const casa = partidasData?.clubes?.[partida.clube_casa_id];
              const fora = partidasData?.clubes?.[partida.clube_visitante_id];
              return { casa, fora };
            }}
            calcKeyScore={(a, key) => {
              const opp = partidas.find(p => p.clube_casa_id === a.clube_id || p.clube_visitante_id === a.clube_id);
              if (!opp) return 0;
              const isHome = opp.clube_casa_id === a.clube_id;
              const opponentId = isHome ? opp.clube_visitante_id : opp.clube_casa_id;
              if (key === 'VIT') {
                const our = teamScoreForMatch(a.clube_id, opponentId, isHome, 'G');
                const oppIsHome = !isHome;
                const theirs = teamScoreForMatch(opponentId, a.clube_id, oppIsHome, 'G');
                return Math.max(our - theirs, 0);
              }
              return teamScoreForMatch(a.clube_id, opponentId, isHome, key as any);
            }}
            keysToDisplay={['SG', 'VIT']}
            acumulados={acumuladosPorAtleta}
            sanitizeNomeClube={sanitizeNomeClube}
            statBuilder={(a) => {
              const media = Number(a.media_num || 0).toFixed(2);
              const clubId = a.clube_id;
              const sgTeam = (crossovers.SG.conquistaCasa[clubId] || 0) + (crossovers.SG.conquistaFora[clubId] || 0);
              return `SG: ${sgTeam} • Média: ${media}`;
            }}
          />
        </TabsContent>

        <TabsContent value="capitaes">
          <ListAtletas
            title="👑 Top 3 Capitães (G/ASS/FIN)"
            atletas={unifiedOffensive.capitaes}
            clubes={mercadoData?.clubes || {}}
            medals
            getConfronto={(a) => {
              const partida = partidas.find(p => p.clube_casa_id === a.clube_id || p.clube_visitante_id === a.clube_id);
              if (!partida) return null;
              const casa = partidasData?.clubes?.[partida.clube_casa_id];
              const fora = partidasData?.clubes?.[partida.clube_visitante_id];
              return { casa, fora };
            }}
            calcKeyScore={(a, key) => {
              const opp = partidas.find(p => p.clube_casa_id === a.clube_id || p.clube_visitante_id === a.clube_id);
              if (!opp) return 0;
              const isHome = opp.clube_casa_id === a.clube_id;
              const opponentId = isHome ? opp.clube_visitante_id : opp.clube_casa_id;
              if (key === 'FIN') {
                return teamScoreForMatch(a.clube_id, opponentId, isHome, 'FD')
                  + teamScoreForMatch(a.clube_id, opponentId, isHome, 'FF')
                  + teamScoreForMatch(a.clube_id, opponentId, isHome, 'FT');
              }
              return teamScoreForMatch(a.clube_id, opponentId, isHome, key as any);
            }}
            keysToDisplay={['G', 'A', 'FIN']}
            acumulados={acumuladosPorAtleta}
            sanitizeNomeClube={sanitizeNomeClube}
          />
        </TabsContent>

        {/* Removed 'time' and 'artilheiros' tabs in full Tops view */}
      </Tabs>
      )}
    </div>
  );
}

type ListProps = {
  title: string;
  atletas: any[];
  clubes: Record<string, any>;
  getConfronto: (a: any) => { casa: any; fora: any } | null;
  calcKeyScore: (a: any, key: 'G' | 'A' | 'DS' | 'SG' | 'DE' | 'FIN' | 'VIT') => number;
  keysToDisplay: Array<'G' | 'A' | 'DS' | 'SG' | 'DE' | 'FIN' | 'VIT'>;
  acumulados: Record<number, { G: number; A: number; FD: number; FF: number; FT: number; DS?: number; SG?: number; DE?: number }>;
  sanitizeNomeClube: (nome?: string) => string;
  statBuilder?: (a: any) => string;
  medals?: boolean;
};

function ListAtletas({ title, atletas, clubes, getConfronto, calcKeyScore, keysToDisplay, acumulados, sanitizeNomeClube, statBuilder, medals }: ListProps) {
  const maxByKey: Record<string, number> = {};
  for (const k of keysToDisplay) {
    let max = 1;
    for (const a of atletas) {
      const v = calcKeyScore(a, k);
      if (v > max) max = v;
    }
    maxByKey[k] = max;
  }
  const baseKeyFor = (posId: number) => posId === 5 || posId === 4 ? 'G' : posId === 2 || posId === 3 ? 'DS' : 'DE';
  const pctFor = (a: any) => {
    const key = baseKeyFor(a.posicao_id) as 'G'|'DS'|'DE';
    const raw = calcKeyScore(a, key as any);
    const max = maxByKey[key] || 1;
    const pct = Math.round((raw / max) * 100);
    return Math.min(pct, 98);
  };
  const estimateFor = (a: any) => {
    const pos = a.posicao_id;
    if (pos === 4 || pos === 5) {
      const key = 'G';
      const raw = calcKeyScore(a, key as any);
      const max = maxByKey[key] || 1;
      const r = raw / max;
      const range = r >= 0.8 ? '1 a 3 gols' : r >= 0.5 ? '1 a 2 gols' : '0 a 1 gol';
      return `${pctFor(a)}% de chance de marcar (Est: ${range})`;
    }
    if (pos === 2 || pos === 3) {
      const key = 'DS';
      const raw = calcKeyScore(a, key as any);
      const max = maxByKey[key] || 1;
      const r = raw / max;
      const range = r >= 0.8 ? '5+ desarmes' : r >= 0.5 ? '3-5 desarmes' : '1-3 desarmes';
      return `${pctFor(a)}% de scout (Est: ${range})`;
    }
    if (pos === 1) {
      const key = 'DE';
      const raw = calcKeyScore(a, key as any);
      const max = maxByKey[key] || 1;
      const r = raw / max;
      const range = r >= 0.8 ? '5+ defesas' : r >= 0.5 ? '3-5 defesas' : '1-3 defesas';
      return `${pctFor(a)}% de scout (Est: ${range})`;
    }
    return '';
  };
  return (
    <div className="bg-card rounded-xl overflow-hidden shadow-lg">
      <div className="bg-primary p-3 text-center font-bold uppercase text-primary-foreground max-md:p-2 max-md:text-sm">
        {title}
      </div>
      <div className="max-md:p-1.5 max-md:space-y-1.5">
        {(!atletas || atletas.length === 0) ? (
          <div className="p-6 text-center text-muted-foreground">Sem dados disponíveis</div>
        ) : (
          atletas.map((atleta, idx) => {
            const clube = clubes?.[String(atleta.clube_id)] || clubes?.[atleta.clube_id];
            const confronto = getConfronto(atleta);
            const acum = acumulados?.[atleta.atleta_id] || { G: 0, A: 0, FD: 0, FF: 0, FT: 0, DS: 0, SG: 0, DE: 0 };
            return (
              <div key={atleta.atleta_id}>
                {/* Desktop layout */}
                <div className={cn('hidden md:flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors', idx < atletas.length - 1 && 'border-b border-border')}>
                  <span className="text-muted-foreground text-sm font-bold w-6 text-center">{idx + 1}º</span>
                  {confronto && (
                    <div className="flex items-center gap-1 w-[120px]">
                      <ClubeEscudo clube={confronto.casa} size="xs" />
                      <span className="text-[10px] font-bold text-muted-foreground">{confronto.casa?.abreviacao?.toUpperCase() || 'CAS'}</span>
                      <span className="mx-1 text-[10px]">x</span>
                      <ClubeEscudo clube={confronto.fora} size="xs" />
                      <span className="text-[10px] font-bold text-muted-foreground">{confronto.fora?.abreviacao?.toUpperCase() || 'FOR'}</span>
                    </div>
                  )}
                  <img 
                    src={atleta.foto?.replace('FORMATO', '80x80')} 
                    alt={atleta.apelido}
                    className="w-10 h-10 rounded-full object-cover bg-muted"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/placeholder.svg';
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-foreground text-base truncate">
                        {medals && idx === 0 ? '🥇 ' : medals && idx === 1 ? '🥈 ' : medals && idx === 2 ? '🥉 ' : ''}
                        {atleta.apelido}
                        {atleta.posicao_id === 2 && (() => {
                          const side = getLateralSideFromStore(atleta.atleta_id);
                          return side ? <span className="ml-1 text-[11px] text-muted-foreground">({side})</span> : null;
                        })()}
                      </p>
                      {clube && <ClubeEscudo clube={clube} size="xs" />}
                    </div>
                    <div className="text-[11px] text-muted-foreground">{estimateFor(atleta)}</div>
                    {statBuilder ? (
                      <div className="text-[11px] text-muted-foreground">{statBuilder(atleta)}</div>
                    ) : (
                      <div className="text-[11px] text-muted-foreground">
                        G: {acum.G} • ASS: {acum.A} • FD: {acum.FD} • FF: {acum.FF}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-4 ml-2">
                    {keysToDisplay.map((k) => {
                      const raw = calcKeyScore(atleta, k);
                      const pct = Math.round((raw / (maxByKey[k] || 1)) * 100);
                      const lbl = k === 'DS' ? 'DES' : k === 'A' ? 'ASS' : k === 'DE' ? 'DEF' : k;
                      return <ProbBadge key={k} label={lbl} value={pct} />;
                    })}
                  </div>
                </div>

                {/* Mobile mini-card layout */}
                <div className={cn(
                  'md:hidden rounded-lg p-2.5 flex items-center gap-2',
                  idx % 2 === 0 ? 'bg-muted/20' : 'bg-muted/40'
                )}>
                  {/* Left: rank + shield */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-muted-foreground text-xs font-black w-5 text-center">
                      {medals && idx === 0 ? '🥇' : medals && idx === 1 ? '🥈' : medals && idx === 2 ? '🥉' : `${idx + 1}º`}
                    </span>
                    {clube && <ClubeEscudo clube={clube} size="xs" />}
                  </div>

                  {/* Center: name + price + estimate */}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-foreground text-xs truncate leading-tight">
                      {atleta.apelido}
                      {atleta.posicao_id === 2 && (() => {
                        const side = getLateralSideFromStore(atleta.atleta_id);
                        return side ? <span className="ml-0.5 text-[9px] text-muted-foreground">({side})</span> : null;
                      })()}
                    </p>
                    <p className="text-[9px] text-muted-foreground leading-tight truncate">
                      C$ {Number(atleta.preco_num || 0).toFixed(2)}
                      {confronto && (
                        <span className="ml-1">
                          • {confronto.casa?.abreviacao} x {confronto.fora?.abreviacao}
                        </span>
                      )}
                    </p>
                    <p className="text-[9px] text-muted-foreground leading-tight truncate">{estimateFor(atleta)}</p>
                  </div>

                  {/* Right: scout badges */}
                  <div className="flex items-center gap-1 shrink-0">
                    {keysToDisplay.map((k) => {
                      const raw = calcKeyScore(atleta, k);
                      const pct = Math.min(Math.round((raw / (maxByKey[k] || 1)) * 100), 98);
                      const lbl = k === 'DS' ? 'DES' : k === 'A' ? 'ASS' : k === 'DE' ? 'DEF' : k;
                      const badgeColor = pct >= 80 ? 'bg-green-500/20 text-green-400 border-green-500/30'
                        : pct >= 61 ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                        : 'bg-orange-500/20 text-orange-400 border-orange-500/30';
                      return (
                        <div key={k} className={cn('flex flex-col items-center rounded border px-1.5 py-0.5', badgeColor)}>
                          <span className="text-[8px] font-bold leading-none">{lbl}</span>
                          <span className="text-[10px] font-black leading-tight">{pct}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function ProbBadge({ label, value }: { label: string; value: number }) {
  const color =
    value >= 100 ? 'text-green-500 border-amber-400'
    : value >= 80 ? 'text-green-500'
    : value >= 61 ? 'text-yellow-500'
    : 'text-orange-500';
  return (
    <span className={`text-xs font-black ${color}`}>
      {label} {Math.min(value, 98)}%
    </span>
  );
}

function PlayerCard({ atleta, clube, isCapitao, highlighted }: { atleta: any; clube: any; isCapitao?: boolean; highlighted?: boolean }) {
  if (!atleta) return null;
  return (
    <div className="relative flex flex-col items-center">
      <div className="relative">
        <img
          src={atleta.foto?.replace('FORMATO', '80x80')}
          alt={atleta.apelido}
          className="w-16 h-16 rounded-full object-cover shadow-lg"
          style={{ border: '2px solid #FFFFFF' }}
          onError={(e) => {
            (e.target as HTMLImageElement).src = '/placeholder.svg';
          }}
        />
        {isCapitao && (
          <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-yellow-400 border-2 border-black flex items-center justify-center text-xs font-black text-black">
            C
          </div>
        )}
      </div>
      <div className="mt-1 px-2 py-0.5 bg-white/70 rounded">
        <div className="flex items-center gap-1">
          <span className="text-[11px] font-bold text-foreground">{atleta.apelido}</span>
          {clube && <ClubeEscudo clube={clube} size="xs" />}
        </div>
      </div>
      <div className="mt-1 px-2 py-0.5 bg-black rounded text-white">
        <span className="text-[11px] font-black">C$ {Number(atleta.preco_num || 0).toFixed(2)}</span>
      </div>
    </div>
  );
}

function TimeDaRodada({ getTop, capitao, tecnico, clubes, lineup, highlightIds }: { getTop: (posId: number, n: number) => any[]; capitao: any; tecnico: any; clubes: Record<string, any>; lineup?: { gk: any | null; lats: any[]; zags: any[]; meis: any[]; atacs: any[] }; highlightIds?: number[] }) {
  const gk = lineup?.gk ?? (getTop(1,1)[0] || null);
  const lats = lineup?.lats ?? (getTop(2,2) || []);
  const zags = lineup?.zags ?? (getTop(3,2) || []);
  const meis = lineup?.meis ?? (getTop(4,3) || []);
  const atacs = lineup?.atacs ?? (getTop(5,3) || []);
  const isCap = (a: any) => capitao && a && a.atleta_id === capitao.atleta_id;
  const renderRow = (items: any[]) => (
    <div className="flex items-center justify-around py-3">
      {items.map((a, idx) => (
        <PlayerCard key={a?.atleta_id || idx} atleta={a} clube={a ? (clubes?.[String(a.clube_id)] || clubes?.[a.clube_id]) : null} isCapitao={isCap(a)} highlighted={!!(a && highlightIds && highlightIds.includes(a.atleta_id))} />
      ))}
    </div>
  );
  return (
    <div className="flex justify-center">
      <div className="w-full">
        <div className="relative bg-green-700 rounded-2xl p-4 shadow-inner mx-auto w-[95vw] max-w-[520px] min-h-[60vh] md:min-h-[640px]">
          {tecnico && (
            <div className="absolute left-3 bottom-8 z-20">
              <div className="scale-95">
                <PlayerCard atleta={tecnico} clube={tecnico ? (clubes?.[String(tecnico.clube_id)] || clubes?.[tecnico.clube_id]) : null} />
              </div>
            </div>
          )}
          <div className="absolute inset-2 rounded-2xl border-4 border-white pointer-events-none"></div>
          <div className="absolute top-1/2 left-6 right-6 -translate-y-1/2 h-0 border-t-4 border-white pointer-events-none"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full border-4 border-white pointer-events-none"></div>
          <div className="absolute top-6 left-12 right-12 h-44 border-4 border-white pointer-events-none"></div>
          <div className="absolute bottom-6 left-12 right-12 h-44 border-4 border-white pointer-events-none"></div>
          <div className="absolute top-6 left-28 right-28 h-24 border-4 border-white pointer-events-none"></div>
          <div className="absolute bottom-6 left-28 right-28 h-24 border-4 border-white pointer-events-none"></div>
          <svg className="pointer-events-none absolute left-1 top-10" width="56" height="260" viewBox="0 0 24 260" fill="none">
            <path d="M12 240V20 M4 36 L12 20 L20 36" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <svg className="pointer-events-none absolute right-1 top-10" width="56" height="260" viewBox="0 0 24 260" fill="none">
            <path d="M12 240V20 M4 36 L12 20 L20 36" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <div className="pointer-events-none absolute bottom-3 right-3">
            <span className="inline-block bg-black text-white px-3 py-1.5 rounded-md text-xl font-extrabold tracking-wide">4-3-3</span>
          </div>
          <div className="relative flex flex-col justify-between min-h-[640px] py-4">
            <div>{renderRow([atacs[0] || null, atacs[1] || null, atacs[2] || null])}</div>
            <div>{renderRow([meis[0] || null, meis[1] || null, meis[2] || null])}</div>
            <div>{renderRow([lats[0] || null, zags[0] || null, zags[1] || null, lats[1] || null])}</div>
            <div>{renderRow([gk])}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TopArtilheiros({ atletas, acumulados, clubes, title = '🎯 Top 10 Artilheiros' }: { atletas: any[]; acumulados: Record<number, { G: number; A: number }>; clubes: Record<string, any>; title?: string }) {
  const lista = [...(atletas || [])]
    .map(a => ({ atleta: a, g: acumulados?.[a.atleta_id]?.G || 0, aS: acumulados?.[a.atleta_id]?.A || 0 }))
    .filter(x => x.g > 0 || x.aS > 0)
    .sort((a, b) => {
      if (b.g !== a.g) return b.g - a.g;
      if (b.aS !== a.aS) return b.aS - a.aS;
      const nameA = a.atleta.apelido?.toUpperCase() || '';
      const nameB = b.atleta.apelido?.toUpperCase() || '';
      return nameA.localeCompare(nameB);
    })
    .slice(0, 10);
  return (
    <div className="bg-card rounded-xl overflow-hidden shadow-lg">
      <div className="bg-primary p-3 text-center font-bold uppercase text-primary-foreground">
        {title}
      </div>
      <div>
        {lista.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground">Sem dados disponíveis</div>
        ) : (
          lista.map((x, idx) => {
            const a = x.atleta;
            const c = clubes?.[String(a.clube_id)] || clubes?.[a.clube_id];
            return (
              <div key={a.atleta_id} className={cn('flex items-center gap-3 px-4 py-3', idx < lista.length - 1 && 'border-b border-border')}>
                <span className="text-muted-foreground text-sm font-bold w-6 text-center">{idx + 1}º</span>
                <img
                  src={a.foto?.replace('FORMATO', '80x80')}
                  alt={a.apelido}
                  className="w-10 h-10 rounded-full object-cover bg-muted"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/placeholder.svg';
                  }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-foreground text-base truncate">{a.apelido}</p>
                    {c && <ClubeEscudo clube={c} size="xs" />}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="min-w-[64px] text-center">
                    <div className="text-[11px] text-muted-foreground font-bold">G</div>
                    <div className="text-sm font-black">{x.g}</div>
                  </div>
                  <div className="min-w-[64px] text-center">
                    <div className="text-[11px] text-muted-foreground font-bold">ASS</div>
                    <div className="text-sm font-black">{x.aS}</div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
