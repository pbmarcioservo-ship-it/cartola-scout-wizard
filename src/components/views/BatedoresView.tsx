import { useState, useMemo } from 'react';
import { ClubeEscudo } from '@/components/ClubeEscudo';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useRodada, useHistoricoRodadas, useMercado, usePartidas, POSICOES } from '@/hooks/useCartolaData';
import { AlertCircle, X, ChevronRight, Target } from 'lucide-react';
import { CartolaClube } from '@/lib/cartola-api';

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

interface BatedorInfo {
  id: string;
  apelido: string;
  foto: string;
  clube_id: number;
  posicao_id: number;
  penaltis_cobrados: number;
  penaltis_convertidos: number;
  penaltis_perdidos: number;
  rodadas: Array<{
    rodada: number;
    convertido: boolean;
    // match info
    adversario_id?: number;
    placar_mandante?: number | null;
    placar_visitante?: number | null;
    casa?: boolean;
  }>;
}

export function BatedoresView() {
  const [selectedClube, setSelectedClube] = useState<CartolaClube | null>(null);
  const { data: mercadoData, isLoading: loadingMercado, error } = useMercado();
  const { data: rodadaData } = useRodada();
  const { data: historico, isLoading: loadingHistorico } = useHistoricoRodadas(rodadaData?.rodada_atual, 10);
  const { data: partidasAtual } = usePartidas();

  const isLoading = loadingMercado || loadingHistorico;

  const batedoresPorClube = useMemo(() => {
    if (!historico) return {} as Record<number, BatedorInfo[]>;

    const map: Record<number, Record<string, BatedorInfo>> = {};

    for (const h of historico) {
      if (!h.data?.atletas) continue;

      for (const [id, data] of Object.entries(h.data.atletas)) {
        const pp = (data.scout?.PP as number) || 0; // penaltis perdidos

        // Check for penalty-related scouts in this round
        // We detect penalty takers by: PP > 0 (missed) 
        // For converted penalties we need to look at game context
        // A more reliable approach: check if the player's team had a penalty in this match
        // For now, PP > 0 means they took and missed
        if (pp > 0) {
          if (!map[data.clube_id]) map[data.clube_id] = {};
          if (!map[data.clube_id][id]) {
            map[data.clube_id][id] = {
              id, apelido: data.apelido, foto: data.foto,
              clube_id: data.clube_id, posicao_id: data.posicao_id,
              penaltis_cobrados: 0, penaltis_convertidos: 0, penaltis_perdidos: 0,
              rodadas: [],
            };
          }
          const batedor = map[data.clube_id][id];
          batedor.penaltis_cobrados += pp;
          batedor.penaltis_perdidos += pp;

          // Find match info
          const partida = h.partidas?.partidas?.find(
            p => p.clube_casa_id === data.clube_id || p.clube_visitante_id === data.clube_id
          );
          const isCasa = partida?.clube_casa_id === data.clube_id;

          for (let i = 0; i < pp; i++) {
            batedor.rodadas.push({
              rodada: h.rodada,
              convertido: false,
              adversario_id: partida ? (isCasa ? partida.clube_visitante_id : partida.clube_casa_id) : undefined,
              placar_mandante: partida?.placar_oficial_mandante,
              placar_visitante: partida?.placar_oficial_visitante,
              casa: isCasa,
            });
          }
        }
      }
    }

    // Also check from mercado cumulative scouts
    if (mercadoData?.atletas) {
      for (const atleta of mercadoData.atletas) {
        const pp = (atleta.scout?.PP as number) || 0;
        if (pp > 0 && !map[atleta.clube_id]?.[String(atleta.atleta_id)]) {
          if (!map[atleta.clube_id]) map[atleta.clube_id] = {};
          map[atleta.clube_id][String(atleta.atleta_id)] = {
            id: String(atleta.atleta_id), apelido: atleta.apelido, foto: atleta.foto,
            clube_id: atleta.clube_id, posicao_id: atleta.posicao_id,
            penaltis_cobrados: pp, penaltis_convertidos: 0, penaltis_perdidos: pp,
            rodadas: [],
          };
        }
      }
    }

    const result: Record<number, BatedorInfo[]> = {};
    for (const [clubeId, players] of Object.entries(map)) {
      result[Number(clubeId)] = Object.values(players).sort((a, b) => b.penaltis_cobrados - a.penaltis_cobrados);
    }
    return result;
  }, [historico, mercadoData]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" text="Carregando batedores..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-destructive gap-3">
        <AlertCircle className="w-12 h-12" />
        <p className="font-bold">Erro ao carregar dados</p>
      </div>
    );
  }

  const allClubes = Object.values(mercadoData?.clubes || {});
  const clubesMap = mercadoData?.clubes || {};
  const batedores = selectedClube ? (batedoresPorClube[selectedClube.id] || []) : [];

  return (
    <div className="animate-fade-in">
      <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-2">
        🎯 Batedores de Pênalti
      </h2>

      {!selectedClube ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {allClubes.map((clube, index) => {
            const count = batedoresPorClube[clube.id]?.length || 0;
            return (
              <button
                key={clube.id}
                onClick={() => setSelectedClube(clube)}
                className="bg-card border border-border p-4 rounded-xl text-center hover:border-primary hover:bg-primary/5 transition-all duration-200 cursor-pointer group animate-slide-in"
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <div className="flex justify-center mb-2">
                  <ClubeEscudo clube={clube} size="lg" />
                </div>
                <span className="font-bold text-foreground group-hover:text-primary transition-colors text-sm">
                  {clube.abreviacao}
                </span>
                {count > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">{count} batedor(es)</p>
                )}
                <ChevronRight className="w-4 h-4 mx-auto mt-1 text-muted-foreground group-hover:text-primary transition-colors" />
              </button>
            );
          })}
        </div>
      ) : (
        <div className="animate-fade-in">
          <button
            onClick={() => setSelectedClube(null)}
            className="flex items-center gap-2 text-primary hover:underline mb-6"
          >
            <X className="w-4 h-4" />
            Voltar para todos os times
          </button>

          <div className="bg-card rounded-lg shadow-lg overflow-hidden">
            <div className="bg-primary text-primary-foreground p-4 flex items-center justify-center gap-3">
              <ClubeEscudo clube={selectedClube} size="lg" />
              <span className="font-bold text-xl">{selectedClube.nome} - Batedores de Pênalti</span>
            </div>

            {batedores.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                Nenhum jogador deste time bateu pênalti até o momento nesta temporada.
              </div>
            ) : (
              <>
                <div className="p-4 bg-muted/30 border-b border-border">
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Target className="w-4 h-4" />
                    Jogadores que bateram pênalti (dados reais do Cartola — últimas 10 rodadas)
                  </p>
                </div>
                <div className="divide-y divide-border">
                  {batedores.map((atleta, idx) => {
                    const posicaoInfo = POSICOES[atleta.posicao_id];
                    return (
                      <div key={atleta.id} className="p-4 hover:bg-muted/30">
                        <div className="flex items-center gap-4">
                          <span className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
                            {idx + 1}º
                          </span>
                          <img
                            src={atleta.foto?.replace('FORMATO', '80x80')}
                            alt={atleta.apelido}
                            className="w-12 h-12 rounded-full object-cover bg-muted"
                            onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }}
                          />
                          <div className="flex-1">
                            <p className="font-bold text-foreground">
                              {atleta.apelido}
                              {atleta.posicao_id === 2 && (() => {
                                const side = getLateralSideFromStore(Number(atleta.id));
                                return side ? <span className="ml-1 text-[11px] text-muted-foreground">({side})</span> : null;
                              })()}
                            </p>
                            <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs font-bold">
                              {posicaoInfo?.nome}
                            </span>
                          </div>
                          <div className="text-right">
                            <p className="font-black text-destructive text-lg">{atleta.penaltis_perdidos} PP</p>
                            <p className="text-sm text-muted-foreground">pênaltis perdidos</p>
                          </div>
                        </div>
                        
                        {/* Show match details for each penalty */}
                        {atleta.rodadas.length > 0 && (
                          <div className="mt-3 ml-12 space-y-1">
                            {atleta.rodadas.map((r, i) => {
                              const advClube = r.adversario_id ? clubesMap[r.adversario_id] : null;
                              return (
                                <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <span className="font-bold">R{r.rodada}</span>
                                  {advClube && <ClubeEscudo clube={advClube} size="xs" />}
                                  {advClube && <span>vs {advClube.abreviacao}</span>}
                                  {r.placar_mandante != null && (
                                    <span className="font-bold text-foreground">
                                      ({r.placar_mandante} x {r.placar_visitante})
                                    </span>
                                  )}
                                  <span className={r.convertido ? 'text-success font-bold' : 'text-destructive font-bold'}>
                                    {r.convertido ? '⚽ Convertido' : '❌ Perdido'}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
