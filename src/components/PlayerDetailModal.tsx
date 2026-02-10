import { useMemo } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ClubeEscudo } from '@/components/ClubeEscudo';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useRodada, useHistoricoRodadas, POSICOES } from '@/hooks/useCartolaData';
import { CartolaAtleta, CartolaClube, CartolaScout } from '@/lib/cartola-api';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus, Shield, Target, Award } from 'lucide-react';

interface PlayerDetailModalProps {
  atleta: CartolaAtleta | null;
  clube: CartolaClube | undefined;
  clubes: Record<string, CartolaClube>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SCOUT_LABELS: Record<string, { label: string; positive: boolean }> = {
  G: { label: 'Gols', positive: true },
  A: { label: 'Assistências', positive: true },
  FT: { label: 'Fin. Trave', positive: true },
  FD: { label: 'Fin. Defendida', positive: true },
  FF: { label: 'Fin. Fora', positive: true },
  FS: { label: 'Falta Sofrida', positive: true },
  RB: { label: 'Roubada', positive: true },
  PS: { label: 'Passe Certo', positive: true },
  DS: { label: 'Desarme', positive: true },
  SG: { label: 'Sem Gol', positive: true },
  DE: { label: 'Defesa', positive: true },
  DP: { label: 'Def. Pênalti', positive: true },
  CA: { label: 'C. Amarelo', positive: false },
  CV: { label: 'C. Vermelho', positive: false },
  FC: { label: 'Falta Cometida', positive: false },
  GC: { label: 'Gol Contra', positive: false },
  PP: { label: 'Pênalti Perdido', positive: false },
  I: { label: 'Impedimento', positive: false },
  PE: { label: 'Passe Errado', positive: false },
  GS: { label: 'Gol Sofrido', positive: false },
};

function ScoutBadge({ scout, value }: { scout: string; value: number }) {
  const info = SCOUT_LABELS[scout];
  if (!info || value === 0) return null;
  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold',
      info.positive ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'
    )}>
      {info.label}: {value}
    </span>
  );
}

function ScoutSummary({ scout }: { scout?: CartolaScout }) {
  if (!scout) return <span className="text-muted-foreground text-xs">—</span>;
  const entries = Object.entries(scout).filter(([, v]) => v && v > 0);
  if (entries.length === 0) return <span className="text-muted-foreground text-xs">Sem scouts</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {entries.map(([key, val]) => (
        <ScoutBadge key={key} scout={key} value={val as number} />
      ))}
    </div>
  );
}

export function PlayerDetailModal({ atleta, clube, clubes, open, onOpenChange }: PlayerDetailModalProps) {
  const { data: rodadaData } = useRodada();
  const { data: historico, isLoading: loadingHistorico } = useHistoricoRodadas(rodadaData?.rodada_atual, 7);

  // Get this athlete's per-round data
  const atletaHistorico = useMemo(() => {
    if (!atleta || !historico) return [];
    return historico
      .filter(h => h.data)
      .map(h => {
        const atletaData = h.data?.atletas?.[String(atleta.atleta_id)];
        return atletaData ? { rodada: h.rodada, ...atletaData } : null;
      })
      .filter(Boolean) as Array<{
        rodada: number;
        apelido: string;
        pontuacao: number;
        scout: CartolaScout;
        foto: string;
        posicao_id: number;
        clube_id: number;
      }>;
  }, [atleta, historico]);

  // Get same-position players across the last 7 rounds
  const mesmaPosicao = useMemo(() => {
    if (!atleta || !historico) return [];

    const playerMap: Record<string, {
      apelido: string;
      foto: string;
      clube_id: number;
      rounds: Array<{ rodada: number; pontuacao: number; scout: CartolaScout }>;
      totalPontos: number;
    }> = {};

    for (const h of historico) {
      if (!h.data?.atletas) continue;
      for (const [id, data] of Object.entries(h.data.atletas)) {
        if (data.posicao_id !== atleta.posicao_id) continue;
        if (id === String(atleta.atleta_id)) continue;
        if (!playerMap[id]) {
          playerMap[id] = {
            apelido: data.apelido,
            foto: data.foto,
            clube_id: data.clube_id,
            rounds: [],
            totalPontos: 0,
          };
        }
        playerMap[id].rounds.push({ rodada: h.rodada, pontuacao: data.pontuacao, scout: data.scout });
        playerMap[id].totalPontos += data.pontuacao;
      }
    }

    return Object.entries(playerMap)
      .map(([id, data]) => ({ id, ...data, media: data.totalPontos / data.rounds.length }))
      .sort((a, b) => b.media - a.media)
      .slice(0, 20);
  }, [atleta, historico]);

  const posicaoInfo = atleta ? POSICOES[atleta.posicao_id] : null;

  // Aggregate athlete's total scouts
  const totalScouts = useMemo(() => {
    const totals: Record<string, number> = {};
    if (atleta?.scout) {
      for (const [k, v] of Object.entries(atleta.scout)) {
        if (v) totals[k] = (totals[k] || 0) + v;
      }
    }
    return totals;
  }, [atleta]);

  if (!atleta) return null;

  const positiveScouts = Object.entries(totalScouts).filter(([k]) => SCOUT_LABELS[k]?.positive);
  const negativeScouts = Object.entries(totalScouts).filter(([k]) => !SCOUT_LABELS[k]?.positive);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden bg-card">
        <ScrollArea className="h-[85vh]">
          <div className="p-6">
            <DialogHeader>
              <DialogTitle className="sr-only">{atleta.apelido}</DialogTitle>
            </DialogHeader>

            {/* Player Header */}
            <div className="flex gap-6 items-start mb-6">
              <img
                src={atleta.foto?.replace('FORMATO', '220x220')}
                alt={atleta.apelido}
                className="w-28 h-28 rounded-xl object-cover bg-muted border-2 border-primary"
                onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }}
              />
              <div className="flex-1">
                <h2 className="text-2xl font-black text-foreground">{atleta.apelido}</h2>
                <p className="text-sm text-muted-foreground">{atleta.nome}</p>
                <div className="flex items-center gap-3 mt-2">
                  <span className="bg-primary/10 text-primary px-2 py-1 rounded text-xs font-bold">
                    {posicaoInfo?.nome}
                  </span>
                  {clube && (
                    <div className="flex items-center gap-1.5">
                      <ClubeEscudo clube={clube} size="sm" />
                      <span className="text-sm font-bold text-foreground">{clube.nome}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Preço', value: `C$ ${atleta.preco_num.toFixed(2)}` },
                  { label: 'Média', value: atleta.media_num.toFixed(2) },
                  { label: 'Pontos', value: atleta.pontos_num.toFixed(1) },
                  { label: 'Jogos', value: String(atleta.jogos_num) },
                  { label: 'Variação', value: atleta.variacao_num.toFixed(2), color: atleta.variacao_num > 0 ? 'text-success' : atleta.variacao_num < 0 ? 'text-destructive' : undefined },
                ].map(stat => (
                  <div key={stat.label} className="bg-muted/50 rounded-lg p-3 text-center border border-border">
                    <p className="text-xs text-muted-foreground font-bold uppercase">{stat.label}</p>
                    <p className={cn('text-lg font-black', stat.color || 'text-primary')}>{stat.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Scouts Totais */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-muted/30 rounded-lg p-4 border border-border">
                <h3 className="font-bold text-foreground flex items-center gap-2 mb-3">
                  <Target className="w-4 h-4 text-success" /> Scouts Positivos
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {positiveScouts.map(([k, v]) => (
                    <div key={k} className="flex justify-between bg-success/10 rounded px-3 py-1.5">
                      <span className="text-xs font-bold text-foreground">{SCOUT_LABELS[k]?.label}</span>
                      <span className="text-sm font-black text-success">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-muted/30 rounded-lg p-4 border border-border">
                <h3 className="font-bold text-foreground flex items-center gap-2 mb-3">
                  <Shield className="w-4 h-4 text-destructive" /> Scouts Negativos
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {negativeScouts.map(([k, v]) => (
                    <div key={k} className="flex justify-between bg-destructive/10 rounded px-3 py-1.5">
                      <span className="text-xs font-bold text-foreground">{SCOUT_LABELS[k]?.label}</span>
                      <span className="text-sm font-black text-destructive">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Pontuação por Rodada */}
            <div className="mb-6">
              <h3 className="font-bold text-foreground text-lg border-b-2 border-primary pb-2 mb-4 uppercase flex items-center gap-2">
                <Award className="w-5 h-5 text-primary" /> Pontuação por Rodada
              </h3>
              {loadingHistorico ? (
                <LoadingSpinner size="md" text="Carregando histórico..." />
              ) : atletaHistorico.length === 0 ? (
                <p className="text-muted-foreground text-sm py-4 text-center">Nenhum dado de rodadas anteriores disponível.</p>
              ) : (
                <div className="space-y-3">
                  {atletaHistorico.sort((a, b) => b.rodada - a.rodada).map(round => (
                    <div key={round.rodada} className="bg-muted/20 rounded-lg p-3 border border-border">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-bold text-muted-foreground">Rodada #{round.rodada}</span>
                        <span className={cn(
                          'text-xl font-black',
                          round.pontuacao > 0 ? 'text-success' : round.pontuacao < 0 ? 'text-destructive' : 'text-muted-foreground'
                        )}>
                          {round.pontuacao.toFixed(1)}
                        </span>
                      </div>
                      <ScoutSummary scout={round.scout} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Comparação com mesma posição */}
            <div>
              <h3 className="font-bold text-foreground text-lg border-b-2 border-primary pb-2 mb-4 uppercase flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" /> 
                Jogadores da mesma posição ({posicaoInfo?.nome}) — Últimas 7 rodadas
              </h3>
              {loadingHistorico ? (
                <LoadingSpinner size="md" text="Carregando comparação..." />
              ) : mesmaPosicao.length === 0 ? (
                <p className="text-muted-foreground text-sm py-4 text-center">Sem dados de comparação.</p>
              ) : (
                <div className="space-y-2">
                  {mesmaPosicao.map((player) => {
                    const playerClube = clubes[player.clube_id];
                    return (
                      <div key={player.id} className="bg-muted/20 rounded-lg p-3 border border-border">
                        <div className="flex items-center gap-3 mb-2">
                          <img
                            src={player.foto?.replace('FORMATO', '80x80')}
                            alt={player.apelido}
                            className="w-8 h-8 rounded-full object-cover bg-muted"
                            onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }}
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-foreground">{player.apelido}</span>
                              {playerClube && <ClubeEscudo clube={playerClube} size="sm" />}
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-xs text-muted-foreground">Média</span>
                            <p className="font-black text-primary">{player.media.toFixed(2)}</p>
                          </div>
                        </div>
                        <div className="flex gap-2 overflow-x-auto pb-1">
                          {player.rounds.sort((a, b) => a.rodada - b.rodada).map(r => (
                            <div key={r.rodada} className="flex-shrink-0 text-center bg-card rounded px-3 py-1 border border-border min-w-[70px]">
                              <p className="text-[10px] text-muted-foreground">R{r.rodada}</p>
                              <p className={cn(
                                'text-sm font-black',
                                r.pontuacao > 0 ? 'text-success' : r.pontuacao < 0 ? 'text-destructive' : 'text-muted-foreground'
                              )}>
                                {r.pontuacao.toFixed(1)}
                              </p>
                            </div>
                          ))}
                        </div>
                        {/* Show aggregated scouts for this player */}
                        <div className="mt-2">
                          {(() => {
                            const aggScouts: Record<string, number> = {};
                            player.rounds.forEach(r => {
                              if (r.scout) {
                                Object.entries(r.scout).forEach(([k, v]) => {
                                  if (v) aggScouts[k] = (aggScouts[k] || 0) + (v as number);
                                });
                              }
                            });
                            const entries = Object.entries(aggScouts).filter(([, v]) => v > 0);
                            if (entries.length === 0) return null;
                            return (
                              <div className="flex flex-wrap gap-1">
                                {entries.map(([k, v]) => (
                                  <ScoutBadge key={k} scout={k} value={v} />
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
