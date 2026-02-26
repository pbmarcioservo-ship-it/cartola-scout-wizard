import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { usePartidas, useRodada } from '@/hooks/useCartolaData';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ClubeEscudo } from '@/components/ClubeEscudo';

export function AcompanhamentoView() {
  const { data: rodadaData } = useRodada();
  const [rodada, setRodada] = useState<number>(rodadaData?.rodada_atual || 1);
  const { data: partidasData, isLoading, isError } = usePartidas(rodada);
  const rodadas = useMemo(() => Array.from({ length: 38 }, (_, i) => i + 1), []);

  const goPrev = () => setRodada(r => Math.max(1, r - 1));
  const goNext = () => setRodada(r => Math.min(38, r + 1));

  return (
    <div className="w-full">
      <div className="bg-primary text-primary-foreground px-3 py-2 mb-3 text-center font-black">
        ACOMPANHAMENTO DE PARCIAIS
      </div>
      <div className="bg-primary text-primary-foreground px-3 py-2 mb-3">
        <div className="flex items-center justify-between">
          <button onClick={goPrev} className="px-2 py-1 rounded bg-primary-foreground text-primary font-black">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            {rodadas.map((r) => (
              <button
                key={r}
                onClick={() => setRodada(r)}
                className={(r === rodada) ? 'px-2 py-1 rounded text-xs font-bold bg-primary-foreground text-primary' : 'px-2 py-1 rounded text-xs font-bold bg-primary/30 text-primary-foreground'}
              >
                {r}
              </button>
            ))}
          </div>
          <button onClick={goNext} className="px-2 py-1 rounded bg-primary-foreground text-primary font-black">
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

      {!isLoading && partidasData?.partidas && (
        <div className="grid grid-cols-1 gap-3">
          {partidasData.partidas.map((partida) => {
            const clubes = partidasData.clubes;
            const clubeCasa = clubes[String(partida.clube_casa_id)] || clubes[partida.clube_casa_id];
            const clubeVisitante = clubes[String(partida.clube_visitante_id)] || clubes[partida.clube_visitante_id];
            const rodadaPassada = rodada <= 3;
            const hasScore = rodadaPassada && partida.placar_oficial_mandante != null && partida.placar_oficial_visitante != null;
            const horario = new Date(partida.partida_data);
            const horarioStr = `${horario.getDate().toString().padStart(2, '0')}/${(horario.getMonth()+1).toString().padStart(2, '0')} ${horario.getHours().toString().padStart(2, '0')}:${horario.getMinutes().toString().padStart(2, '0')}`;
            return (
              <AcompanhamentoCard
                key={partida.partida_id}
                partidaId={partida.partida_id}
                clubeCasa={clubeCasa}
                clubeVisitante={clubeVisitante}
                placar={hasScore ? `${partida.placar_oficial_mandante} x ${partida.placar_oficial_visitante}` : 'x'}
                minuto={hasScore ? undefined : undefined}
                horario={!hasScore ? horarioStr : undefined}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function AcompanhamentoCard({
  partidaId,
  clubeCasa,
  clubeVisitante,
  placar,
  minuto,
  horario,
}: {
  partidaId: number;
  clubeCasa: any;
  clubeVisitante: any;
  placar: string;
  minuto?: number;
  horario?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white rounded-xl border border-border shadow-sm">
      <button onClick={() => setOpen(o => !o)} className="w-full px-4 py-3">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          <div className="flex items-center justify-end gap-2">
            {clubeCasa && <ClubeEscudo clube={clubeCasa} size="sm" />}
            <div className="flex flex-col items-end">
              <span className="text-sm font-bold text-primary">{clubeCasa?.nome}</span>
              <div className="mt-1 px-2 py-0.5 rounded bg-muted text-foreground">
                <span className="text-[11px] font-black">PTS</span>
              </div>
            </div>
          </div>
          <div className="text-center min-w-[140px]">
            <div className="text-2xl font-extrabold text-primary">{placar}</div>
            {minuto != null && <div className="text-xs font-bold text-primary mt-1">{minuto}'</div>}
            {horario && <div className="text-xs font-bold text-muted-foreground mt-1">{horario}</div>}
          </div>
          <div className="flex items-center justify-start gap-2">
            <div className="flex flex-col">
              <span className="text-sm font-bold text-primary">{clubeVisitante?.nome}</span>
              <div className="mt-1 px-2 py-0.5 rounded bg-muted text-foreground">
                <span className="text-[11px] font-black">PTS</span>
              </div>
            </div>
            {clubeVisitante && <ClubeEscudo clube={clubeVisitante} size="sm" />}
          </div>
        </div>
      </button>
      {open && (
        <div className="border-t border-border px-4 py-3">
          <div className="grid grid-cols-12 gap-2 px-1 py-2 bg-primary/10 rounded">
            <div className="col-span-6 text-xs font-black text-primary">Jogador</div>
            <div className="col-span-2 text-xs font-black text-primary text-right">PTS</div>
            <div className="col-span-1 text-xs font-black text-primary text-center">G</div>
            <div className="col-span-1 text-xs font-black text-primary text-center">A</div>
            <div className="col-span-2 text-xs font-black text-primary text-center">DS</div>
          </div>
          <div className="text-center text-muted-foreground text-xs py-3">
            Lista pronta para integração de atletas do confronto (API).
          </div>
        </div>
      )}
    </div>
  );
}
