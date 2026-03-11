import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ArrowUpCircle, ArrowDownCircle, Clock, ArrowLeft } from 'lucide-react';
import { usePartidas, useRodada, usePontuados, useMercado, POSICOES } from '@/hooks/useCartolaData';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ClubeEscudo } from '@/components/ClubeEscudo';
import { useQueryClient } from '@tanstack/react-query';
import { CartolaAtleta, CartolaClube, CartolaScout } from '@/lib/cartola-api';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

const SCOUT_LABELS: Record<string, { label: string; abrev: string; positive: boolean }> = {
  G: { label: 'Gols', abrev: 'G', positive: true },
  A: { label: 'Assist.', abrev: 'A', positive: true },
  FT: { label: 'Fin. Trave', abrev: 'FT', positive: true },
  FD: { label: 'Fin. Def.', abrev: 'FD', positive: true },
  FF: { label: 'Fin. Fora', abrev: 'FF', positive: true },
  FS: { label: 'Falta Sof.', abrev: 'FS', positive: true },
  RB: { label: 'Roubada', abrev: 'RB', positive: true },
  PS: { label: 'Passe', abrev: 'PS', positive: true },
  DS: { label: 'Desarme', abrev: 'DS', positive: true },
  SG: { label: 'Sem Gol', abrev: 'SG', positive: true },
  DE: { label: 'Defesa', abrev: 'DE', positive: true },
  DP: { label: 'Def. Pên.', abrev: 'DP', positive: true },
  CA: { label: 'C. Amar.', abrev: 'CA', positive: false },
  CV: { label: 'C. Verm.', abrev: 'CV', positive: false },
  FC: { label: 'Falta Com.', abrev: 'FC', positive: false },
  GC: { label: 'Gol Contra', abrev: 'GC', positive: false },
  PP: { label: 'Pên. Perd.', abrev: 'PP', positive: false },
  I: { label: 'Imped.', abrev: 'I', positive: false },
  PE: { label: 'Passe Err.', abrev: 'PE', positive: false },
  GS: { label: 'Gol Sof.', abrev: 'GS', positive: false },
};

export function AcompanhamentoView() {
  const { data: rodadaData } = useRodada();
  const [rodada, setRodada] = useState<number>(rodadaData?.rodada_atual || 1);
  const { data: partidasData, isLoading, isError } = usePartidas(rodada);
  const { data: pontuadosData } = usePontuados();
  const { data: mercadoData } = useMercado();
  const rodadas = useMemo(() => Array.from({ length: 38 }, (_, i) => i + 1), []);
  const queryClient = useQueryClient();
  const [selectedAtleta, setSelectedAtleta] = useState<CartolaAtleta | null>(null);

  useEffect(() => {
    if (rodadaData?.rodada_atual) {
      setRodada(rodadaData.rodada_atual);
    }
  }, [rodadaData]);

  useEffect(() => {
    const key = `statusfc_partidas_rodada_${rodada}`;
    if (partidasData?.partidas && partidasData.partidas.length > 0) {
      try { localStorage.setItem(key, JSON.stringify(partidasData)); } catch {}
    }
  }, [rodada, partidasData]);

  useEffect(() => {
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['cartola', 'partidas', rodada] });
      queryClient.invalidateQueries({ queryKey: ['cartola', 'pontuados'] });
    }, 60000);
    return () => clearInterval(interval);
  }, [queryClient, rodada]);

  const goPrev = () => setRodada(r => Math.max(1, r - 1));
  const goNext = () => setRodada(r => Math.min(38, r + 1));

  // Build athlete map from pontuados (for current round) or mercado
  const atletasMap = useMemo(() => {
    const map: Record<number, { apelido: string; foto: string; posicao_id: number; clube_id: number; pontuacao: number; scout: CartolaScout; entrou_em_campo?: boolean }> = {};
    if (pontuadosData?.atletas) {
      for (const [id, a] of Object.entries(pontuadosData.atletas)) {
        map[Number(id)] = {
          apelido: a.apelido,
          foto: a.foto,
          posicao_id: a.posicao_id,
          clube_id: a.clube_id,
          pontuacao: a.pontuacao,
          scout: a.scout,
          entrou_em_campo: true,
        };
      }
    }
    return map;
  }, [pontuadosData]);

  // Group athletes by club
  const atletasByClub = useMemo(() => {
    const grouped: Record<number, typeof atletasMap[number][]> = {};
    for (const [id, a] of Object.entries(atletasMap)) {
      if (!grouped[a.clube_id]) grouped[a.clube_id] = [];
      grouped[a.clube_id].push({ ...a, atleta_id: Number(id) } as any);
    }
    // Sort each club's athletes by position then score
    for (const clubId of Object.keys(grouped)) {
      grouped[Number(clubId)].sort((a, b) => {
        if (a.posicao_id !== b.posicao_id) return a.posicao_id - b.posicao_id;
        return b.pontuacao - a.pontuacao;
      });
    }
    return grouped;
  }, [atletasMap]);

  const allClubes = useMemo(() => {
    return { ...partidasData?.clubes, ...mercadoData?.clubes, ...pontuadosData?.clubes } as Record<string, CartolaClube>;
  }, [partidasData, mercadoData, pontuadosData]);

  const handleAtletaClick = (atletaId: number) => {
    if (!mercadoData?.atletas) return;
    const atleta = mercadoData.atletas.find(a => a.atleta_id === atletaId);
    if (atleta) setSelectedAtleta(atleta);
  };

  return (
    <div className="w-full animate-fade-in">
      <div className="bg-primary text-primary-foreground px-3 py-2 mb-3 text-center font-black rounded-lg">
        ACOMPANHAMENTO DE PARCIAIS
      </div>
      <div className="bg-primary text-primary-foreground px-3 py-2 mb-3 rounded-lg">
        <div className="flex items-center justify-between">
          <button onClick={goPrev} className="px-2 py-1 rounded bg-primary-foreground text-primary font-black transition-all duration-300 hover:scale-105">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            {rodadas.map((r) => (
              <button
                key={r}
                onClick={() => setRodada(r)}
                className={cn(
                  'px-2 py-1 rounded text-xs font-bold transition-all duration-300 hover:scale-105',
                  r === rodada ? 'bg-primary-foreground text-primary' : 'bg-primary/30 text-primary-foreground'
                )}
              >
                {r}
              </button>
            ))}
          </div>
          <button onClick={goNext} className="px-2 py-1 rounded bg-primary-foreground text-primary font-black transition-all duration-300 hover:scale-105">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center h-48">
          <LoadingSpinner size="lg" text="Carregando jogos da rodada..." />
        </div>
      )}

      {isError && (
        <div className="p-6 text-center text-destructive font-bold">
          Erro ao carregar partidas da rodada {rodada}.
        </div>
      )}

      {!isLoading && (
        <div className="grid grid-cols-1 gap-4">
          {(
            (partidasData?.partidas && partidasData.partidas.length > 0)
              ? partidasData.partidas
              : (() => {
                  try {
                    const raw = localStorage.getItem(`statusfc_partidas_rodada_${rodada}`);
                    const cached = raw ? JSON.parse(raw) : null;
                    return cached?.partidas || [];
                  } catch { return []; }
                })()
          ).map((partida: any) => {
            const clubes = allClubes;
            const clubeCasa = clubes[String(partida.clube_casa_id)] || clubes[partida.clube_casa_id];
            const clubeVisitante = clubes[String(partida.clube_visitante_id)] || clubes[partida.clube_visitante_id];
            const hasScore = partida.placar_oficial_mandante != null && partida.placar_oficial_visitante != null;
            const horario = new Date(partida.partida_data);
            const horarioStr = `${horario.getDate().toString().padStart(2, '0')}/${(horario.getMonth() + 1).toString().padStart(2, '0')} ${horario.getHours().toString().padStart(2, '0')}:${horario.getMinutes().toString().padStart(2, '0')}`;

            const atletasCasa = atletasByClub[partida.clube_casa_id] || [];
            const atletasVisitante = atletasByClub[partida.clube_visitante_id] || [];

            const totalCasa = atletasCasa.reduce((s: number, a: any) => s + (a.pontuacao || 0), 0);
            const totalVisitante = atletasVisitante.reduce((s: number, a: any) => s + (a.pontuacao || 0), 0);

            return (
              <MatchCard
                key={partida.partida_id}
                clubeCasa={clubeCasa}
                clubeVisitante={clubeVisitante}
                placar={hasScore ? `${partida.placar_oficial_mandante} x ${partida.placar_oficial_visitante}` : 'x'}
                horario={!hasScore ? horarioStr : undefined}
                atletasCasa={atletasCasa}
                atletasVisitante={atletasVisitante}
                totalCasa={totalCasa}
                totalVisitante={totalVisitante}
                clubes={clubes}
                onAtletaClick={handleAtletaClick}
              />
            );
          })}
        </div>
      )}

      <PlayerDetailModal
        atleta={selectedAtleta}
        clube={selectedAtleta ? allClubes[String(selectedAtleta.clube_id)] : undefined}
        clubes={allClubes as any}
        open={!!selectedAtleta}
        onOpenChange={(open) => !open && setSelectedAtleta(null)}
      />
    </div>
  );
}

// ── Scout Mini-Card ──
function ScoutMiniCard({ scout, value }: { scout: string; value: number }) {
  const info = SCOUT_LABELS[scout];
  if (!info || !value) return null;
  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-bold',
      info.positive ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'
    )}>
      {info.abrev}:{value}
    </span>
  );
}

// ── Athlete Row ──
function AtletaRow({ atleta, clube, onAtletaClick }: {
  atleta: any;
  clube?: CartolaClube;
  onAtletaClick: (id: number) => void;
}) {
  const pontuacao = atleta.pontuacao || 0;
  const scout = atleta.scout || {};
  const scoutEntries = Object.entries(scout).filter(([, v]) => v && (v as number) !== 0);
  const posInfo = POSICOES[atleta.posicao_id];

  // Simple heuristic: if a player has very few scouts, they might be a sub
  const isSubstitute = atleta.is_substitute;

  return (
    <div
      className="flex items-center gap-1.5 py-0.5 px-1.5 border-b border-border/30 last:border-b-0 cursor-pointer transition-all duration-200 hover:bg-muted/30"
      onClick={() => onAtletaClick(atleta.atleta_id)}
    >
      {/* Substitution indicator */}
      <div className="w-3 flex-shrink-0">
        {isSubstitute === 'in' && <ArrowUpCircle className="w-3 h-3 text-success" />}
        {isSubstitute === 'out' && <ArrowDownCircle className="w-3 h-3 text-destructive" />}
      </div>

      {/* Player photo */}
      <img
        src={atleta.foto?.replace('FORMATO', '50x50')}
        alt={atleta.apelido}
        className="w-6 h-6 rounded-full object-cover ring-1 ring-border flex-shrink-0"
        onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }}
      />

      {/* Player info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-0.5">
          <span className="text-[11px] font-bold text-foreground truncate">{atleta.apelido}</span>
          {clube && <ClubeEscudo clube={clube} size="xs" />}
          <span className="text-[8px] text-muted-foreground font-bold ml-0.5">{posInfo?.abreviacao}</span>
        </div>
        {/* Scout mini-cards */}
        <div className="flex flex-wrap gap-0.5">
          {scoutEntries.map(([k, v]) => (
            <ScoutMiniCard key={k} scout={k} value={v as number} />
          ))}
        </div>
      </div>

      {/* Score */}
      <div className={cn(
        'px-1.5 py-0.5 rounded text-xs font-black min-w-[44px] text-center flex-shrink-0',
        pontuacao > 0 ? 'bg-success/15 text-success' : pontuacao < 0 ? 'bg-destructive/15 text-destructive' : 'bg-muted text-muted-foreground'
      )}>
        {pontuacao.toFixed(1)}
      </div>
    </div>
  );
}

// ── Match Card ──
function MatchCard({
  clubeCasa,
  clubeVisitante,
  placar,
  horario,
  atletasCasa,
  atletasVisitante,
  totalCasa,
  totalVisitante,
  clubes,
  onAtletaClick,
}: {
  clubeCasa: CartolaClube;
  clubeVisitante: CartolaClube;
  placar: string;
  horario?: string;
  atletasCasa: any[];
  atletasVisitante: any[];
  totalCasa: number;
  totalVisitante: number;
  clubes: Record<string, CartolaClube>;
  onAtletaClick: (id: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const hasAtletas = atletasCasa.length > 0 || atletasVisitante.length > 0;

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      {/* Header: Scoreboard - Sticky */}
      <button onClick={() => setOpen(o => !o)} className="w-full px-3 py-2 transition-all duration-200 hover:bg-muted/20 sticky top-0 z-10 bg-card">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="flex items-center justify-end gap-2">
            {clubeCasa && <ClubeEscudo clube={clubeCasa} size="sm" />}
            <span className="text-sm font-bold text-foreground">{clubeCasa?.nome || clubeCasa?.abreviacao}</span>
          </div>
          <div className="text-center min-w-[100px]">
            <div className="text-xl font-extrabold text-primary">{placar}</div>
            {horario && (
              <div className="flex items-center justify-center gap-1 mt-0.5">
                <Clock className="w-3 h-3 text-primary/60" />
                <span className="text-[10px] font-bold text-primary/60">{horario}</span>
              </div>
            )}
          </div>
          <div className="flex items-center justify-start gap-2">
            <span className="text-sm font-bold text-foreground">{clubeVisitante?.nome || clubeVisitante?.abreviacao}</span>
            {clubeVisitante && <ClubeEscudo clube={clubeVisitante} size="sm" />}
          </div>
        </div>
      </button>

      {/* Expanded: Athletes list - NO internal scroll */}
      {open && (
        <div className="border-t border-border">
          {!hasAtletas ? (
            <div className="text-center text-muted-foreground text-xs py-4">
              Aguardando dados dos atletas para este confronto...
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
              {/* Casa */}
              <div>
                <div className="flex items-center gap-1.5 px-2 py-1 bg-primary/10">
                  {clubeCasa && <ClubeEscudo clube={clubeCasa} size="xs" />}
                  <span className="text-[11px] font-black text-primary uppercase">{clubeCasa?.abreviacao}</span>
                  <span className="text-[9px] text-muted-foreground ml-auto">{atletasCasa.length} jog.</span>
                </div>
                <div>
                  {atletasCasa.map((a: any) => (
                    <AtletaRow key={a.atleta_id} atleta={a} clube={clubes[String(a.clube_id)]} onAtletaClick={onAtletaClick} />
                  ))}
                </div>
                <div className="flex items-center justify-between px-2 py-1 bg-primary/5 border-t border-border">
                  <span className="text-[10px] font-black text-primary uppercase">Total</span>
                  <span className={cn(
                    'text-xs font-black px-2 py-0.5 rounded',
                    totalCasa > 0 ? 'bg-success/15 text-success' : totalCasa < 0 ? 'bg-destructive/15 text-destructive' : 'bg-muted text-muted-foreground'
                  )}>{totalCasa.toFixed(1)} pts</span>
                </div>
              </div>
              {/* Visitante */}
              <div>
                <div className="flex items-center gap-1.5 px-2 py-1 bg-primary/10">
                  {clubeVisitante && <ClubeEscudo clube={clubeVisitante} size="xs" />}
                  <span className="text-[11px] font-black text-primary uppercase">{clubeVisitante?.abreviacao}</span>
                  <span className="text-[9px] text-muted-foreground ml-auto">{atletasVisitante.length} jog.</span>
                </div>
                <div>
                  {atletasVisitante.map((a: any) => (
                    <AtletaRow key={a.atleta_id} atleta={a} clube={clubes[String(a.clube_id)]} onAtletaClick={onAtletaClick} />
                  ))}
                </div>
                <div className="flex items-center justify-between px-2 py-1 bg-primary/5 border-t border-border">
                  <span className="text-[10px] font-black text-primary uppercase">Total</span>
                  <span className={cn(
                    'text-xs font-black px-2 py-0.5 rounded',
                    totalVisitante > 0 ? 'bg-success/15 text-success' : totalVisitante < 0 ? 'bg-destructive/15 text-destructive' : 'bg-muted text-muted-foreground'
                  )}>{totalVisitante.toFixed(1)} pts</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
