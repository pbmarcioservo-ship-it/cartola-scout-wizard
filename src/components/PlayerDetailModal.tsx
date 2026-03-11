import { useMemo } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ClubeEscudo } from '@/components/ClubeEscudo';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useRodada, usePartidas, useHistoricoRodadas, POSICOES } from '@/hooks/useCartolaData';
import { CartolaAtleta, CartolaClube, CartolaScout, CartolaPartida } from '@/lib/cartola-api';
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
import { TrendingUp, Shield, Target, Award, Swords } from 'lucide-react';
import { getLateralSideByName } from '@/lib/laterais';

interface PlayerDetailModalProps {
  atleta: CartolaAtleta | null;
  clube: CartolaClube | undefined;
  clubes: Record<string, CartolaClube>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SCOUT_LABELS: Record<string, { label: string; abrev: string; positive: boolean }> = {
  G: { label: 'Gols', abrev: 'G', positive: true },
  A: { label: 'Assistências', abrev: 'A', positive: true },
  FT: { label: 'Fin. Trave', abrev: 'FT', positive: true },
  FD: { label: 'Fin. Defendida', abrev: 'FD', positive: true },
  FF: { label: 'Fin. Fora', abrev: 'FF', positive: true },
  FS: { label: 'Falta Sofrida', abrev: 'FS', positive: true },
  RB: { label: 'Roubada', abrev: 'RB', positive: true },
  PS: { label: 'Passe Certo', abrev: 'PS', positive: true },
  DS: { label: 'Desarme', abrev: 'DS', positive: true },
  SG: { label: 'Sem Gol', abrev: 'SG', positive: true },
  DE: { label: 'Defesa', abrev: 'DE', positive: true },
  DP: { label: 'Def. Pênalti', abrev: 'DP', positive: true },
  CA: { label: 'C. Amarelo', abrev: 'CA', positive: false },
  CV: { label: 'C. Vermelho', abrev: 'CV', positive: false },
  FC: { label: 'Falta Cometida', abrev: 'FC', positive: false },
  GC: { label: 'Gol Contra', abrev: 'GC', positive: false },
  PP: { label: 'Pênalti Perdido', abrev: 'PP', positive: false },
  I: { label: 'Impedimento', abrev: 'I', positive: false },
  PE: { label: 'Passe Errado', abrev: 'PE', positive: false },
  GS: { label: 'Gol Sofrido', abrev: 'GS', positive: false },
};

function ScoutBadge({ scout, value }: { scout: string; value: number }) {
  const info = SCOUT_LABELS[scout];
  if (!info || value === 0) return null;
  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold',
      info.positive ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'
    )}>
      {info.abrev}:{value}
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

function findMatchForClub(partidas: CartolaPartida[], clubeId: number): CartolaPartida | undefined {
  return partidas.find(p => p.clube_casa_id === clubeId || p.clube_visitante_id === clubeId);
}

function MatchDisplay({ partida, clubes, compact = false }: { partida: CartolaPartida; clubes: Record<string, CartolaClube>; compact?: boolean }) {
  const clubeCasa = clubes[partida.clube_casa_id];
  const clubeVisitante = clubes[partida.clube_visitante_id];
  if (!clubeCasa || !clubeVisitante) return null;

  const hasScore = partida.placar_oficial_mandante !== null;

  return (
    <div className={cn("flex items-center justify-center gap-2", compact ? "gap-1" : "gap-2")}>
      <ClubeEscudo clube={clubeCasa} size={compact ? "sm" : "md"} />
      <span className={cn("font-black", compact ? "text-xs" : "text-sm")}>
        {clubeCasa.abreviacao}
      </span>
      {hasScore ? (
        <span className={cn("font-black text-primary", compact ? "text-xs" : "text-lg")}>
          {partida.placar_oficial_mandante} x {partida.placar_oficial_visitante}
        </span>
      ) : (
        <span className={cn("font-bold text-muted-foreground", compact ? "text-xs" : "text-sm")}>x</span>
      )}
      <span className={cn("font-black", compact ? "text-xs" : "text-sm")}>
        {clubeVisitante.abreviacao}
      </span>
      <ClubeEscudo clube={clubeVisitante} size={compact ? "sm" : "md"} />
    </div>
  );
}

export function PlayerDetailModal({ atleta, clube, clubes, open, onOpenChange }: PlayerDetailModalProps) {
  const { data: rodadaData } = useRodada();
  const { data: partidasAtual } = usePartidas();
  const { data: historico, isLoading: loadingHistorico } = useHistoricoRodadas(rodadaData?.rodada_atual, 7);

  // Find upcoming match
  const upcomingMatch = useMemo(() => {
    if (!atleta || !partidasAtual?.partidas) return null;
    return findMatchForClub(partidasAtual.partidas, atleta.clube_id);
  }, [atleta, partidasAtual]);

  const upcomingOpponentId = useMemo(() => {
    if (!upcomingMatch || !atleta) return null;
    return upcomingMatch.clube_casa_id === atleta.clube_id
      ? upcomingMatch.clube_visitante_id
      : upcomingMatch.clube_casa_id;
  }, [upcomingMatch, atleta]);

  const isPlayingAway = useMemo(() => {
    if (!upcomingMatch || !atleta) return false;
    return upcomingMatch.clube_visitante_id === atleta.clube_id;
  }, [upcomingMatch, atleta]);

  // Get this athlete's per-round data with match info
  const atletaHistorico = useMemo(() => {
    if (!atleta || !historico) return [];
    return historico
      .filter(h => h.data)
      .map(h => {
        const atletaData = h.data?.atletas?.[String(atleta.atleta_id)];
        if (!atletaData) return null;
        const partida = h.partidas?.partidas
          ? findMatchForClub(h.partidas.partidas, atletaData.clube_id)
          : undefined;
        return {
          rodada: h.rodada,
          ...atletaData,
          partida,
          partidaClubes: { ...h.partidas?.clubes, ...h.data?.clubes },
        };
      })
      .filter(Boolean) as Array<{
        rodada: number;
        apelido: string;
        pontuacao: number;
        scout: CartolaScout;
        foto: string;
        posicao_id: number;
        clube_id: number;
        partida?: CartolaPartida;
        partidaClubes: Record<string, CartolaClube>;
      }>;
  }, [atleta, historico]);

  // Same position players who played AGAINST the upcoming opponent (same mando)
  const mesmaPosicaoVsOponente = useMemo(() => {
    if (!atleta || !historico || !upcomingOpponentId) return [];

    const playerMap: Record<string, {
      apelido: string;
      foto: string;
      clube_id: number;
      rounds: Array<{ rodada: number; pontuacao: number; scout: CartolaScout; partida?: CartolaPartida; partidaClubes: Record<string, CartolaClube> }>;
      totalPontos: number;
    }> = {};

    for (const h of historico) {
      if (!h.data?.atletas || !h.partidas?.partidas) continue;

      for (const [id, data] of Object.entries(h.data.atletas)) {
        if (data.posicao_id !== atleta.posicao_id) continue;
        if (id === String(atleta.atleta_id)) continue;
        // Exclude players from the opponent team itself
        if (data.clube_id === upcomingOpponentId) continue;

        // Find match this player was in
        const partida = findMatchForClub(h.partidas.partidas, data.clube_id);
        if (!partida) continue;

        // Check if this player faced the upcoming opponent
        const facedOpponent = partida.clube_casa_id === upcomingOpponentId || partida.clube_visitante_id === upcomingOpponentId;
        if (!facedOpponent) continue;

        // Check mando: if our player plays away, show players who also played away against this opponent
        const playerWasAway = partida.clube_visitante_id === data.clube_id;
        if (isPlayingAway !== playerWasAway) continue;

        if (!playerMap[id]) {
          playerMap[id] = {
            apelido: data.apelido,
            foto: data.foto,
            clube_id: data.clube_id,
            rounds: [],
            totalPontos: 0,
          };
        }
        playerMap[id].rounds.push({
          rodada: h.rodada,
          pontuacao: data.pontuacao,
          scout: data.scout,
          partida,
          partidaClubes: { ...h.partidas.clubes, ...h.data.clubes },
        });
        playerMap[id].totalPontos += data.pontuacao;
      }
    }

    return Object.entries(playerMap)
      .map(([id, data]) => ({ id, ...data, media: data.totalPontos / data.rounds.length }))
      .sort((a, b) => b.media - a.media);
  }, [atleta, historico, upcomingOpponentId, isPlayingAway]);

  const posicaoInfo = atleta ? POSICOES[atleta.posicao_id] : null;
  const opponentClube = upcomingOpponentId ? clubes[upcomingOpponentId] : undefined;

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
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden bg-card max-md:max-w-[100vw] max-md:max-h-[95vh] max-md:rounded-none">
        <ScrollArea className="h-[85vh] max-md:h-[92vh]">
          <div className="p-6 max-md:p-3">
            <DialogHeader>
              <DialogTitle className="sr-only">{atleta.apelido}</DialogTitle>
            </DialogHeader>

            {/* Próximo Confronto */}
            {upcomingMatch && (
              <div className="bg-primary/10 border-2 border-primary rounded-xl p-4 mb-6 max-md:p-2.5 max-md:mb-3 max-md:rounded-lg">
                <p className="text-xs font-bold text-primary uppercase text-center mb-2 max-md:text-[10px] max-md:mb-1">
                  <Swords className="w-4 h-4 inline mr-1 max-md:w-3 max-md:h-3" />
                  Próximo Confronto — Rodada {rodadaData?.rodada_atual}
                </p>
                <MatchDisplay
                  partida={upcomingMatch}
                  clubes={partidasAtual?.clubes || clubes}
                />
                <p className="text-center text-xs text-muted-foreground mt-1 max-md:text-[10px]">
                  {isPlayingAway ? 'Jogando FORA' : 'Jogando em CASA'}
                </p>
              </div>
            )}

            {/* Player Header - Mobile */}
            <div className="hidden max-md:block mb-3">
              <div className="flex items-center gap-3 mb-3">
                <img
                  src={atleta.foto?.replace('FORMATO', '220x220')}
                  alt={atleta.apelido}
                  className="w-16 h-16 rounded-lg object-cover bg-muted border-2 border-primary shrink-0"
                  onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    {clube && <ClubeEscudo clube={clube} size="sm" />}
                    <h2 className="text-lg font-black text-foreground truncate">
                      {atleta.apelido}
                      {atleta.posicao_id === 2 && (() => {
                        const side = getLateralSideFromStore(atleta.atleta_id) ?? getLateralSideByName(atleta.apelido, atleta.nome);
                        return side ? <span className="ml-1 text-sm text-muted-foreground">({side})</span> : null;
                      })()}
                    </h2>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-[10px] font-bold">
                      {posicaoInfo?.nome}
                    </span>
                    {clube && <span className="text-xs text-muted-foreground truncate">{clube.nome}</span>}
                  </div>
                </div>
              </div>
              {/* Stats grid - mobile full width */}
              <div className="grid grid-cols-3 gap-1.5">
                {(() => {
                  let totalCasa = 0, jogosCasa = 0, totalFora = 0, jogosFora = 0;
                  for (const r of atletaHistorico) {
                    if (r.partida) {
                      const isHome = r.partida.clube_casa_id === atleta.clube_id;
                      if (isHome) { totalCasa += r.pontuacao; jogosCasa++; }
                      else { totalFora += r.pontuacao; jogosFora++; }
                    }
                  }
                  const mediaCasa = jogosCasa > 0 ? (totalCasa / jogosCasa) : 0;
                  const mediaFora = jogosFora > 0 ? (totalFora / jogosFora) : 0;
                  const minValorizar = atleta.jogos_num === 0
                    ? atleta.preco_num * 0.29
                    : atleta.jogos_num === 1
                      ? atleta.preco_num * 0.50
                      : (atleta.preco_num * 0.55) + (atleta.pontos_num * 0.30);
                  return [
                    { label: 'Preço', value: `C$ ${atleta.preco_num.toFixed(2)}` },
                    { label: 'Média', value: atleta.media_num.toFixed(2) },
                    { label: 'Min. Valor.', value: `C$ ${minValorizar.toFixed(2)}` },
                    { label: 'Jogos', value: String(atleta.jogos_num) },
                    { label: 'M. Casa', value: mediaCasa.toFixed(2), color: 'text-success' },
                    { label: 'M. Fora', value: mediaFora.toFixed(2), color: 'text-amber-500' },
                  ].map(stat => (
                    <div key={stat.label} className="bg-muted/50 rounded-md p-2 text-center border border-border">
                      <p className="text-[9px] text-muted-foreground font-bold uppercase leading-tight">{stat.label}</p>
                      <p className={cn('text-sm font-black', stat.color || 'text-primary')}>{stat.value}</p>
                    </div>
                  ));
                })()}
              </div>
            </div>

            {/* Player Header - Desktop */}
            <div className="flex gap-6 items-start mb-6 max-md:hidden">
              <img
                src={atleta.foto?.replace('FORMATO', '220x220')}
                alt={atleta.apelido}
                className="w-28 h-28 rounded-xl object-cover bg-muted border-2 border-primary"
                onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }}
              />
              <div className="flex-1">
                <h2 className="text-2xl font-black text-foreground">
                  {atleta.apelido}
                  {atleta.posicao_id === 2 && (() => {
                    const side = getLateralSideFromStore(atleta.atleta_id) ?? getLateralSideByName(atleta.apelido, atleta.nome);
                    return side ? <span className="ml-1 text-base text-muted-foreground">({side})</span> : null;
                  })()}
                </h2>
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
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {(() => {
                  let totalCasa = 0, jogosCasa = 0, totalFora = 0, jogosFora = 0;
                  for (const r of atletaHistorico) {
                    if (r.partida) {
                      const isHome = r.partida.clube_casa_id === atleta.clube_id;
                      if (isHome) { totalCasa += r.pontuacao; jogosCasa++; }
                      else { totalFora += r.pontuacao; jogosFora++; }
                    }
                  }
                  const mediaCasa = jogosCasa > 0 ? (totalCasa / jogosCasa) : 0;
                  const mediaFora = jogosFora > 0 ? (totalFora / jogosFora) : 0;
                  const minValorizar = atleta.jogos_num === 0
                    ? atleta.preco_num * 0.29
                    : atleta.jogos_num === 1
                      ? atleta.preco_num * 0.50
                      : (atleta.preco_num * 0.55) + (atleta.pontos_num * 0.30);
                  return [
                    { label: 'Preço', value: `C$ ${atleta.preco_num.toFixed(2)}` },
                    { label: 'Média', value: atleta.media_num.toFixed(2) },
                    { label: 'Min. Valorizar', value: `C$ ${minValorizar.toFixed(2)}` },
                    { label: 'Jogos', value: String(atleta.jogos_num) },
                    { label: 'Méd. Casa', value: mediaCasa.toFixed(2), color: 'text-success' },
                    { label: 'Méd. Fora', value: mediaFora.toFixed(2), color: 'text-amber-500' },
                  ].map(stat => (
                    <div key={stat.label} className="bg-muted/50 rounded-lg p-3 text-center border border-border">
                      <p className="text-xs text-muted-foreground font-bold uppercase">{stat.label}</p>
                      <p className={cn('text-lg font-black', stat.color || 'text-primary')}>{stat.value}</p>
                      {stat.label === 'Min. Valorizar' && (
                        <p className="text-[9px] text-muted-foreground/70 mt-0.5 leading-tight">*Valores aproximados baseados em tendências.</p>
                      )}
                    </div>
                  ));
                })()}
              </div>
            </div>

            {/* Scouts Totais */}
            <div className="grid grid-cols-2 gap-4 mb-6 max-md:grid-cols-1 max-md:gap-2 max-md:mb-4">
              <div className="bg-muted/30 rounded-lg p-4 border border-border max-md:p-3">
                <h3 className="font-bold text-foreground flex items-center gap-2 mb-3 max-md:text-sm max-md:mb-2">
                  <Target className="w-4 h-4 text-success" /> Scouts Positivos
                </h3>
                <div className="grid grid-cols-2 gap-2 max-md:gap-1.5">
                  {positiveScouts.map(([k, v]) => (
                    <div key={k} className="flex justify-between bg-success/10 rounded px-3 py-1.5 max-md:px-2 max-md:py-1">
                      <span className="text-xs font-bold text-foreground max-md:text-[11px]">{SCOUT_LABELS[k]?.label}</span>
                      <span className="text-sm font-black text-success max-md:text-xs">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-muted/30 rounded-lg p-4 border border-border max-md:p-3">
                <h3 className="font-bold text-foreground flex items-center gap-2 mb-3 max-md:text-sm max-md:mb-2">
                  <Shield className="w-4 h-4 text-destructive" /> Scouts Negativos
                </h3>
                <div className="grid grid-cols-2 gap-2 max-md:gap-1.5">
                  {negativeScouts.map(([k, v]) => (
                    <div key={k} className="flex justify-between bg-destructive/10 rounded px-3 py-1.5 max-md:px-2 max-md:py-1">
                      <span className="text-xs font-bold text-foreground max-md:text-[11px]">{SCOUT_LABELS[k]?.label}</span>
                      <span className="text-sm font-black text-destructive max-md:text-xs">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Pontuação por Rodada com Confronto */}
            <div className="mb-6">
              <h3 className="font-bold text-foreground text-lg border-b-2 border-primary pb-2 mb-4 uppercase flex items-center gap-2">
                <Award className="w-5 h-5 text-primary" /> Histórico por Rodada
              </h3>
              {loadingHistorico ? (
                <LoadingSpinner size="md" text="Carregando histórico..." />
              ) : atletaHistorico.length === 0 ? (
                <p className="text-muted-foreground text-sm py-4 text-center">Nenhum dado de rodadas anteriores disponível.</p>
              ) : (() => {
                const sorted = [...atletaHistorico].sort((a, b) => b.rodada - a.rodada);
                const casaRounds = sorted.filter(r => r.partida && r.partida.clube_casa_id === atleta!.clube_id);
                const foraRounds = sorted.filter(r => r.partida && r.partida.clube_visitante_id === atleta!.clube_id);

                const renderRound = (round: typeof sorted[0]) => {
                  const allClubes = { ...clubes, ...round.partidaClubes };
                  return (
                    <div key={round.rodada} className="bg-muted/20 rounded-lg p-3 border border-border">
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-bold text-muted-foreground bg-muted px-2 py-1 rounded">
                            R{round.rodada}
                          </span>
                          {round.partida && (
                            <MatchDisplay partida={round.partida} clubes={allClubes} compact />
                          )}
                        </div>
                        <span className={cn(
                          'text-xl font-black',
                          round.pontuacao > 0 ? 'text-success' : round.pontuacao < 0 ? 'text-destructive' : 'text-muted-foreground'
                        )}>
                          {round.pontuacao.toFixed(1)} pts
                        </span>
                      </div>
                      <ScoutSummary scout={round.scout} />
                    </div>
                  );
                };

                return (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-xs font-bold text-success uppercase mb-2 text-center">🏠 Em Casa</h4>
                      {casaRounds.length === 0 ? (
                        <p className="text-muted-foreground text-xs text-center py-3">Nenhum jogo em casa.</p>
                      ) : (
                        <div className="space-y-3">{casaRounds.map(renderRound)}</div>
                      )}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-amber-500 uppercase mb-2 text-center">✈️ Fora</h4>
                      {foraRounds.length === 0 ? (
                        <p className="text-muted-foreground text-xs text-center py-3">Nenhum jogo fora.</p>
                      ) : (
                        <div className="space-y-3">{foraRounds.map(renderRound)}</div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Jogadores da mesma posição que enfrentaram o mesmo oponente */}
            <div>
              <h3 className="font-bold text-foreground text-lg border-b-2 border-primary pb-2 mb-4 uppercase flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                {posicaoInfo?.nome}s vs {opponentClube?.abreviacao || 'Oponente'} ({isPlayingAway ? 'Fora' : 'Casa'})
              </h3>
              {loadingHistorico ? (
                <LoadingSpinner size="md" text="Carregando comparação..." />
              ) : mesmaPosicaoVsOponente.length === 0 ? (
                <p className="text-muted-foreground text-sm py-4 text-center">
                  Nenhum {posicaoInfo?.nome?.toLowerCase()} enfrentou {opponentClube?.abreviacao || 'o oponente'} {isPlayingAway ? 'fora' : 'em casa'} nas últimas 7 rodadas.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {mesmaPosicaoVsOponente.slice(0, 7).map((player) => {
                    const playerClube = clubes[player.clube_id];
                    // Show the most recent round for this player
                    const latestRound = player.rounds.sort((a, b) => b.rodada - a.rodada)[0];
                    const allClubes = latestRound ? { ...clubes, ...latestRound.partidaClubes } : clubes;
                    return (
                      <div key={player.id} className="bg-muted/20 rounded-md px-2.5 py-1.5 border border-border">
                        <div className="flex items-center gap-2">
                          {playerClube && <ClubeEscudo clube={playerClube} size="xs" />}
                          <span className="font-bold text-xs text-foreground min-w-[80px]">
                            {player.apelido}
                            {atleta.posicao_id === 2 && (() => {
                              const side = getLateralSideFromStore(Number(player.id)) ?? getLateralSideByName(player.apelido);
                              return side ? <span className="ml-1 text-[11px] text-muted-foreground">({side})</span> : null;
                            })()}
                          </span>
                          <div className="flex-1 flex flex-wrap gap-0.5">
                            <ScoutSummary scout={latestRound?.scout} />
                          </div>
                          {latestRound?.partida && (
                            <div className="flex items-center gap-1.5 ml-auto shrink-0">
                              <MatchDisplay partida={latestRound.partida} clubes={allClubes} compact />
                              <span className="text-[10px] text-muted-foreground">R{latestRound.rodada}</span>
                            </div>
                          )}
                          <span className={cn(
                            'text-sm font-black shrink-0 ml-1',
                            (latestRound?.pontuacao ?? 0) > 0 ? 'text-success' : (latestRound?.pontuacao ?? 0) < 0 ? 'text-destructive' : 'text-muted-foreground'
                          )}>
                            {latestRound?.pontuacao.toFixed(1)}
                          </span>
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
