import { useMemo, useState } from 'react';
import { ClubeEscudo } from '@/components/ClubeEscudo';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useMercado, useRodada, usePartidas, useHistoricoRodadas, POSICOES } from '@/hooks/useCartolaData';
import { AlertCircle } from 'lucide-react';
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

export function TopsView({ initialTab, mode }: { initialTab?: string; mode?: 'full' | 'artilheiros-only' | 'time-only' } = {}) {
  const [ultimas, setUltimas] = useState(5);
  const { data: mercadoData, isLoading: loadingMercado } = useMercado();
  const { data: rodadaData } = useRodada();
  const { data: partidasData, isLoading: loadingPartidas, error: errorPartidas } = usePartidas();
  const { data: historicoData, isLoading: loadingHistorico } = useHistoricoRodadas(rodadaData?.rodada_atual, ultimas);

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

  // TOP 5 SG (times) — SG absoluto com desempate por mando em caso de empate técnico/baixa amostra
  const topSGTimes = useMemo(() => {
    const LOW_DATA_THRESHOLD = 2;
    const entries: { timeId: number; score: number; isHome: boolean }[] = [];
    for (const p of partidas) {
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
    return Object.entries(bestByTeam)
      .map(([timeId, v]) => ({ timeId: Number(timeId), score: v.score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }, [partidas, crossovers]);

  const getOpponentForPlayer = (clubId: number) => {
    const partida = partidas.find(p => p.clube_casa_id === clubId || p.clube_visitante_id === clubId);
    if (!partida) return null;
    const isHome = partida.clube_casa_id === clubId;
    const opponentId = isHome ? partida.clube_visitante_id : partida.clube_casa_id;
    return { opponentId, isHome };
  };

  const atletasProvaveis = useMemo(() => (mercadoData?.atletas || []).filter(a => a.status_id === 7), [mercadoData]);

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

  const topPlayersForPos = (posId: number, limit: number) => {
    const candidatos = atletasProvaveis
      .filter(a => a.posicao_id === posId)
      .filter(a => {
        if (posId === POSICAO_ID_MAP.meia || posId === POSICAO_ID_MAP.atacante) {
          const acum = acumuladosPorAtleta?.[a.atleta_id];
          return (acum?.G || 0) > 0 || (acum?.A || 0) > 0;
        }
        return true;
      });
    const scored = candidatos.map(a => {
      const opp = getOpponentForPlayer(a.clube_id);
      if (!opp) return { atleta: a, score: -Infinity, guards: { sg: 0, base: 0 }, oppCedeG: 0, g: 0, aS: 0, fd: 0, ds: 0, de: 0, sg: 0 };
      const g = teamScoreForMatch(a.clube_id, opp.opponentId, opp.isHome, 'G');
      const aS = teamScoreForMatch(a.clube_id, opp.opponentId, opp.isHome, 'A');
      const fd = teamScoreForMatch(a.clube_id, opp.opponentId, opp.isHome, 'FD');
      const ds = teamScoreForMatch(a.clube_id, opp.opponentId, opp.isHome, 'DS');
      const de = teamScoreForMatch(a.clube_id, opp.opponentId, opp.isHome, 'DE');
      const sg = teamScoreForMatch(a.clube_id, opp.opponentId, opp.isHome, 'SG');
      let score = -Infinity;
      let base = 0;
      if (posId === POSICAO_ID_MAP.goleiro) {
        score = 1.0 * sg + 0.7 * de;
        base = Math.max(sg, de);
      } else if (posId === POSICAO_ID_MAP.zagueiro) {
        score = 1.0 * sg + 0.6 * ds;
        base = Math.max(sg, ds);
      } else if (posId === POSICAO_ID_MAP.lateral) {
        score = 1.0 * sg + 0.6 * ds;
        base = Math.max(sg, ds);
      } else if (posId === POSICAO_ID_MAP.meia || posId === POSICAO_ID_MAP.atacante) {
        score = 1.0 * g + 0.7 * aS + 0.3 * fd;
        base = Math.max(g, aS, fd);
      } else if (posId === POSICAO_ID_MAP.tecnico) {
        const oppIsHome = !opp.isHome;
        const theirs = teamScoreForMatch(opp.opponentId, a.clube_id, oppIsHome, 'G');
        const vit = Math.max(g - theirs, 0);
        score = (sg + vit) / 2;
        base = Math.max(sg, vit);
      }
      const oppCedeG = teamScoreForMatch(opp.opponentId, a.clube_id, !opp.isHome, 'G');
      return { atleta: a, score, guards: { sg, base }, oppCedeG, g, aS, fd, ds, de, sg };
    });
    const filtradosBase = scored.filter(s => isFinite(s.score));
    const filtradosQualidade = filtradosBase.filter(s => {
      const acum = acumuladosPorAtleta?.[s.atleta.atleta_id] || { G: 0, A: 0, FD: 0, FF: 0, FT: 0, DS: 0, SG: 0, DE: 0 };
      if (s.atleta.posicao_id === POSICAO_ID_MAP.goleiro) {
        return (acum.SG || 0) > 0 || (acum.DE || 0) > 0;
      }
      if (s.atleta.posicao_id === POSICAO_ID_MAP.tecnico) {
        return s.score > 0;
      }
      if (s.atleta.posicao_id === POSICAO_ID_MAP.meia || s.atleta.posicao_id === POSICAO_ID_MAP.atacante) {
        return (acum.G || 0) > 0 || (acum.A || 0) > 0;
      }
      return (acum.DS || 0) > 0 || (acum.SG || 0) > 0;
    });
    let ordenadosPrim = [...filtradosQualidade];
    if (posId === POSICAO_ID_MAP.meia || posId === POSICAO_ID_MAP.atacante) {
      ordenadosPrim.sort((a, b) => {
        if (b.g !== a.g) return b.g - a.g;
        if (b.aS !== a.aS) return b.aS - a.aS;
        if (b.fd !== a.fd) return b.fd - a.fd;
        return b.oppCedeG - a.oppCedeG;
      });
    } else if (posId === POSICAO_ID_MAP.lateral || posId === POSICAO_ID_MAP.zagueiro || posId === POSICAO_ID_MAP.goleiro) {
      ordenadosPrim.sort((a, b) => {
        if (b.sg !== a.sg) return b.sg - a.sg;
        const secA = posId === POSICAO_ID_MAP.goleiro ? a.de : a.ds;
        const secB = posId === POSICAO_ID_MAP.goleiro ? b.de : b.ds;
        if (secB !== secA) return secB - secA;
        return b.score - a.score;
      });
    } else {
      ordenadosPrim.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return b.oppCedeG - a.oppCedeG;
      });
    }
    const vistos = new Set<number>();
    const lista: any[] = [];
    for (const s of ordenadosPrim) {
      if (vistos.has(s.atleta.clube_id)) continue;
      lista.push(s.atleta);
      vistos.add(s.atleta.clube_id);
      if (lista.length >= limit) break;
    }
    if (lista.length < limit) {
      for (const s of ordenadosPrim) {
        if (lista.find(x => x.atleta_id === s.atleta.atleta_id)) continue;
        lista.push(s.atleta);
        if (lista.length >= limit) break;
      }
    }
    return lista.slice(0, limit);
  };

  const capitaesTop3 = useMemo(() => {
    const cand = atletasProvaveis.filter(a => [POSICAO_ID_MAP.meia, POSICAO_ID_MAP.atacante].includes(a.posicao_id));
    const scored = cand.map(a => {
      const opp = getOpponentForPlayer(a.clube_id);
      if (!opp) return { atleta: a, score: -Infinity, oppCedeG: 0, g: 0, aS: 0, fd: 0, estOk: false, prodOk: false };
      const g = teamScoreForMatch(a.clube_id, opp.opponentId, opp.isHome, 'G');
      const aS = teamScoreForMatch(a.clube_id, opp.opponentId, opp.isHome, 'A');
      const fd = teamScoreForMatch(a.clube_id, opp.opponentId, opp.isHome, 'FD');
      const score = 1.0 * g + 0.7 * aS + 0.3 * fd;
      const oppCedeG = teamScoreForMatch(opp.opponentId, a.clube_id, !opp.isHome, 'G');
      const maxG = Math.max(1, ...cand.map(x => {
        const o = getOpponentForPlayer(x.clube_id);
        if (!o) return 1;
        return teamScoreForMatch(x.clube_id, o.opponentId, o.isHome, 'G');
      }));
      const r = g / maxG;
      const estOk = r >= 0.5;
      const acum = acumuladosPorAtleta?.[a.atleta_id];
      const prodOk = (acum?.G || 0) > 0 || (acum?.A || 0) > 0;
      return { atleta: a, score, oppCedeG, g, aS, fd, estOk, prodOk };
    }).filter(s => isFinite(s.score) && s.estOk && s.prodOk);
    scored.sort((a, b) => {
      if (b.g !== a.g) return b.g - a.g;
      if (b.aS !== a.aS) return b.aS - a.aS;
      if (b.fd !== a.fd) return b.fd - a.fd;
      return b.oppCedeG - a.oppCedeG;
    });
    let ordered = scored;
    const vistos = new Set<number>();
    const lista: any[] = [];
    for (const s of ordered) {
      if (vistos.has(s.atleta.clube_id)) continue;
      lista.push(s.atleta);
      vistos.add(s.atleta.clube_id);
      if (lista.length >= 3) break;
    }
    return lista.slice(0, 3);
  }, [atletasProvaveis, partidas, crossovers]);

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
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-muted-foreground font-bold">Rodadas:</span>
            {[3,5,7].map(n => (
              <button
                key={n}
                className={cn('px-2 py-1 rounded text-xs font-bold', ultimas === n ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground')}
                onClick={() => setUltimas(n)}
              >
                {n}
              </button>
            ))}
          </div>
          {historicoData && historicoData.length > 0 && historicoData.length < 3 && (
            <div className="text-[11px] text-muted-foreground mb-2">
              * Baseado em apenas {historicoData.length} jogos
            </div>
          )}
        </>
      )}
      {mode === 'time-only' ? (
        <div className="w-full">
          <div className="bg-primary p-3 text-center font-bold uppercase text-primary-foreground mb-2">
            🟩 Time da Rodada
          </div>
          <TimeDaRodada
            getTop={(posId, n) => topPlayersForPos(posId, n)}
            capitao={capitaesTop3?.[0] || null}
            tecnico={(topPlayersForPos(6,1)[0] || null)}
            clubes={mercadoData?.clubes || {}}
          />
        </div>
      ) : mode === 'artilheiros-only' ? (
        <div className="w-full">
          <div className="text-xs text-muted-foreground mb-4">
            Legenda: (G) Gol • (ASS) Assistência • (FD) Finalização defendida • (FF) Finalização pra fora • (FS) Faltas sofridas
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
        <TabsList className="w-full max-w-4xl bg-primary/20 mb-2 flex flex-wrap">
          <TabsTrigger value="sg" className="flex-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-bold">
            🛡️ Top 5 SG (Times)
          </TabsTrigger>
          <TabsTrigger value="goleiros" className="flex-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-bold">
            🧤 Goleiros
          </TabsTrigger>
          <TabsTrigger value="zagueiros" className="flex-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-bold">
            🧱 Zagueiros
          </TabsTrigger>
          <TabsTrigger value="laterais" className="flex-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-bold">
            🏃 Laterais
          </TabsTrigger>
          <TabsTrigger value="meias" className="flex-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-bold">
            💡 Meias
          </TabsTrigger>
          <TabsTrigger value="atacantes" className="flex-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-bold">
            🏹 Atacantes
          </TabsTrigger>
          <TabsTrigger value="tecnicos" className="flex-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-bold">
            📋 Técnicos
          </TabsTrigger>
          <TabsTrigger value="capitaes" className="flex-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-bold">
            👑 Top 3 Capitães
          </TabsTrigger>
        </TabsList>
        <div className="text-xs text-muted-foreground mb-4">
          Legenda: (G) Gol • (DES) Desarme • (SG) Saldo de Gol • (ASS) Assistência
        </div>

        <TabsContent value="sg">
          <div className="bg-card rounded-xl overflow-hidden shadow-lg">
            <div className="bg-primary p-3 text-center font-bold uppercase text-primary-foreground">
              🛡️ Top 5 SG (Saldo de Gols) — Times
            </div>
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
            atletas={topPlayersForPos(4, 5)}
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
            atletas={topPlayersForPos(5, 5)}
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
            atletas={topPlayersForPos(6, 5)}
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
            atletas={capitaesTop3}
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
      return `${pctFor(a)}% de chance de marcar (Estimativa: ${range})`;
    }
    if (pos === 2 || pos === 3) {
      const key = 'DS';
      const raw = calcKeyScore(a, key as any);
      const max = maxByKey[key] || 1;
      const r = raw / max;
      const range = r >= 0.8 ? '5+ desarmes' : r >= 0.5 ? '3 a 5 desarmes' : '1 a 3 desarmes';
      return `${pctFor(a)}% de chance de scout (Estimativa: ${range})`;
    }
    if (pos === 1) {
      const key = 'DE';
      const raw = calcKeyScore(a, key as any);
      const max = maxByKey[key] || 1;
      const r = raw / max;
      const range = r >= 0.8 ? '5+ defesas' : r >= 0.5 ? '3 a 5 defesas' : '1 a 3 defesas';
      return `${pctFor(a)}% de chance de scout (Estimativa: ${range})`;
    }
    return '';
  };
  return (
    <div className="bg-card rounded-xl overflow-hidden shadow-lg">
      <div className="bg-primary p-3 text-center font-bold uppercase text-primary-foreground">
        {title}
      </div>
      <div>
        {(!atletas || atletas.length === 0) ? (
          <div className="p-6 text-center text-muted-foreground">Sem dados disponíveis</div>
        ) : (
          atletas.map((atleta, idx) => {
            const clube = clubes?.[String(atleta.clube_id)] || clubes?.[atleta.clube_id];
            const confronto = getConfronto(atleta);
            const acum = acumulados?.[atleta.atleta_id] || { G: 0, A: 0, FD: 0, FF: 0, FT: 0, DS: 0, SG: 0, DE: 0 };
            return (
              <div key={atleta.atleta_id} className={cn('flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors', idx < atletas.length - 1 && 'border-b border-border')}>
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

function PlayerCard({ atleta, clube, isCapitao }: { atleta: any; clube: any; isCapitao?: boolean }) {
  if (!atleta) return null;
  return (
    <div className="relative flex flex-col items-center">
      <div className="relative">
        <img
          src={atleta.foto?.replace('FORMATO', '80x80')}
          alt={atleta.apelido}
          className="w-16 h-16 rounded-full object-cover ring-2 ring-white shadow-lg"
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

function TimeDaRodada({ getTop, capitao, tecnico, clubes }: { getTop: (posId: number, n: number) => any[]; capitao: any; tecnico: any; clubes: Record<string, any> }) {
  const gk = getTop(1,1)[0] || null;
  const lats = getTop(2,2) || [];
  const zags = getTop(3,2) || [];
  const meis = getTop(4,3) || [];
  const atacs = getTop(5,3) || [];
  const isCap = (a: any) => capitao && a && a.atleta_id === capitao.atleta_id;
  const renderRow = (items: any[]) => (
    <div className="flex items-center justify-around py-3">
      {items.map((a, idx) => (
        <PlayerCard key={a?.atleta_id || idx} atleta={a} clube={a ? (clubes?.[String(a.clube_id)] || clubes?.[a.clube_id]) : null} isCapitao={isCap(a)} />
      ))}
    </div>
  );
  return (
    <div className="flex flex-col gap-3">
      <div className="w-full">
        <div className="relative bg-green-700 rounded-2xl p-4 shadow-inner mx-auto max-w-[520px] min-h-[720px]">
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
          <div className="relative flex flex-col justify-between min-h-[640px] py-4">
            <div>{renderRow([atacs[0] || null, atacs[1] || null, atacs[2] || null])}</div>
            <div>{renderRow([meis[0] || null, meis[1] || null, meis[2] || null])}</div>
            <div>{renderRow([lats[0] || null, zags[0] || null, zags[1] || null, lats[1] || null])}</div>
            <div>{renderRow([gk])}</div>
          </div>
        </div>
      </div>
      <div className="mx-auto w-full max-w-[520px] flex items-center gap-4 pl-1">
        <span className="inline-block bg-black text-white px-3 py-1.5 rounded-md text-xl font-extrabold tracking-wide">4-3-3</span>
        {tecnico ? (
          <div className="bg-card rounded-xl shadow px-3 py-2">
            <div className="scale-95">
              <PlayerCard atleta={tecnico} clube={tecnico ? (clubes?.[String(tecnico.clube_id)] || clubes?.[tecnico.clube_id]) : null} />
            </div>
          </div>
        ) : (
          <div className="text-muted-foreground text-sm">Sem técnico</div>
        )}
      </div>
    </div>
  );
}

function TopArtilheiros({ atletas, acumulados, clubes, title = '🎯 Top 10 Artilheiros' }: { atletas: any[]; acumulados: Record<number, { G: number }>; clubes: Record<string, any>; title?: string }) {
  const lista = [...(atletas || [])]
    .map(a => ({ atleta: a, g: acumulados?.[a.atleta_id]?.G || 0 }))
    .filter(x => x.g > 0)
    .sort((a, b) => b.g - a.g)
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
                <div className="text-sm font-black">G: {x.g}</div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
