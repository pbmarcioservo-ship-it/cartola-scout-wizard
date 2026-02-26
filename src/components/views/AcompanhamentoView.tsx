import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function AcompanhamentoView() {
  const [rodada, setRodada] = useState<number>(1);
  const rodadas = useMemo(() => Array.from({ length: 38 }, (_, i) => i + 1), []);
  const jogos = useMemo(() => [
    { id: 1, mandante: 'Mandante FC', visitante: 'Visitante FC', placarMandante: 0, placarVisitante: 0, minuto: 12, ptsMandante: 34.5, ptsVisitante: 28.7 },
    { id: 2, mandante: 'Atlético Azul', visitante: 'Esporte Verde', placarMandante: 1, placarVisitante: 0, minuto: 27, ptsMandante: 41.2, ptsVisitante: 22.1 },
  ], [rodada]);

  const goPrev = () => setRodada(r => Math.max(1, r - 1));
  const goNext = () => setRodada(r => Math.min(38, r + 1));

  return (
    <div className="w-full">
      <div className="bg-primary text-primary-foreground px-3 py-2 mb-3 text-center font-black">
        TELA DE PARCIAIS OK
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

      <div className="grid grid-cols-1 gap-3">
        {jogos.map((j) => (
          <div key={j.id} className="bg-white rounded-xl border border-border shadow-sm">
            <div className="w-full px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 w-40">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-primary">{j.mandante}</span>
                    <div className="mt-1 px-2 py-0.5 rounded bg-muted text-foreground">
                      <span className="text-[11px] font-black">{j.ptsMandante.toFixed(1)} PTS</span>
                    </div>
                  </div>
                </div>

                <div className="text-center">
                  <div className="text-2xl font-extrabold text-primary">
                    {j.placarMandante} x {j.placarVisitante}
                  </div>
                  <div className="text-xs font-bold text-primary mt-1">{j.minuto}'</div>
                </div>

                <div className="flex items-center gap-2 w-40 justify-end">
                  <div className="flex flex-col items-end">
                    <span className="text-sm font-bold text-primary">{j.visitante}</span>
                    <div className="mt-1 px-2 py-0.5 rounded bg-muted text-foreground">
                      <span className="text-[11px] font-black">{j.ptsVisitante.toFixed(1)} PTS</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
