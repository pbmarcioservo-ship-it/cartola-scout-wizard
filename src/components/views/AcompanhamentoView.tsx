import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ClubeEscudo } from '@/components/ClubeEscudo';

type TimeInfo = {
  id: number;
  nome: string;
  abreviacao: string;
  escudo?: string;
};

type JogoInfo = {
  id: number;
  mandante: TimeInfo;
  visitante: TimeInfo;
  placarMandante: number;
  placarVisitante: number;
  minuto: number;
  pontuacaoMandante: number;
  pontuacaoVisitante: number;
  atletas: {
    id: number;
    nome: string;
    foto?: string;
    pts: number;
    g: number;
    a: number;
    ds: number;
  }[];
};

export function AcompanhamentoView() {
  const [rodada, setRodada] = useState<number>(1);
  const [jogoAbertoId, setJogoAbertoId] = useState<number | null>(null);

  const rodadas = useMemo(() => Array.from({ length: 38 }, (_, i) => i + 1), []);

  const jogos: JogoInfo[] = useMemo(() => {
    return [
      {
        id: 1001,
        mandante: { id: 1, nome: 'Mandante FC', abreviacao: 'MAN' },
        visitante: { id: 2, nome: 'Visitante FC', abreviacao: 'VIS' },
        placarMandante: 0,
        placarVisitante: 0,
        minuto: 12,
        pontuacaoMandante: 34.5,
        pontuacaoVisitante: 28.7,
        atletas: [
          { id: 201, nome: 'Jogador A', pts: 4.5, g: 0, a: 0, ds: 2 },
          { id: 202, nome: 'Jogador B', pts: 3.2, g: 0, a: 1, ds: 1 },
          { id: 203, nome: 'Jogador C', pts: 1.7, g: 0, a: 0, ds: 0 },
        ],
      },
      {
        id: 1002,
        mandante: { id: 3, nome: 'Atlético Azul', abreviacao: 'AZU' },
        visitante: { id: 4, nome: 'Esporte Verde', abreviacao: 'VER' },
        placarMandante: 1,
        placarVisitante: 0,
        minuto: 27,
        pontuacaoMandante: 41.2,
        pontuacaoVisitante: 22.1,
        atletas: [
          { id: 301, nome: 'Jogador D', pts: 6.8, g: 1, a: 0, ds: 1 },
          { id: 302, nome: 'Jogador E', pts: 2.4, g: 0, a: 0, ds: 2 },
          { id: 303, nome: 'Jogador F', pts: 0.9, g: 0, a: 0, ds: 0 },
        ],
      },
    ];
  }, [rodada]);

  const goPrev = () => setRodada(r => Math.max(1, r - 1));
  const goNext = () => setRodada(r => Math.min(38, r + 1));
  const toggleJogo = (id: number) => setJogoAbertoId(prev => (prev === id ? null : id));

  return (
    <div className="w-full">
      <div className="bg-primary text-primary-foreground px-3 py-2 mb-3">
        <div className="flex items-center justify-between">
          <button
            onClick={goPrev}
            className="px-2 py-1 rounded bg-primary-foreground text-primary font-black"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            {rodadas.map((r) => (
              <button
                key={r}
                onClick={() => setRodada(r)}
                className={cn(
                  'px-2 py-1 rounded text-xs font-bold',
                  r === rodada ? 'bg-primary-foreground text-primary' : 'bg-primary/30 text-primary-foreground'
                )}
              >
                {r}
              </button>
            ))}
          </div>
          <button
            onClick={goNext}
            className="px-2 py-1 rounded bg-primary-foreground text-primary font-black"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {jogos.map((jogo) => (
          <div key={jogo.id} className="bg-white rounded-xl border border-border shadow-sm">
            <button
              onClick={() => toggleJogo(jogo.id)}
              className="w-full px-4 py-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 w-40">
                  <ClubeEscudo clube={{ id: jogo.mandante.id, nome: jogo.mandante.nome, abreviacao: jogo.mandante.abreviacao } as any} size="sm" />
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-primary">{jogo.mandante.nome}</span>
                    <div className="mt-1 px-2 py-0.5 rounded bg-muted text-foreground">
                      <span className="text-[11px] font-black">{jogo.pontuacaoMandante.toFixed(1)} PTS</span>
                    </div>
                  </div>
                </div>

                <div className="text-center">
                  <div className="text-2xl font-extrabold text-primary">
                    {jogo.placarMandante} x {jogo.placarVisitante}
                  </div>
                  <div className="text-xs font-bold text-primary mt-1">{jogo.minuto}'</div>
                </div>

                <div className="flex items-center gap-2 w-40 justify-end">
                  <div className="flex flex-col items-end">
                    <span className="text-sm font-bold text-primary">{jogo.visitante.nome}</span>
                    <div className="mt-1 px-2 py-0.5 rounded bg-muted text-foreground">
                      <span className="text-[11px] font-black">{jogo.pontuacaoVisitante.toFixed(1)} PTS</span>
                    </div>
                  </div>
                  <ClubeEscudo clube={{ id: jogo.visitante.id, nome: jogo.visitante.nome, abreviacao: jogo.visitante.abreviacao } as any} size="sm" />
                </div>
              </div>
            </button>

            {jogoAbertoId === jogo.id && (
              <div className="border-t border-border px-4 py-3">
                <div className="w-full">
                  <div className="grid grid-cols-12 gap-2 px-1 py-2 bg-primary/10 rounded">
                    <div className="col-span-6 text-xs font-black text-primary">Jogador</div>
                    <div className="col-span-2 text-xs font-black text-primary text-right">PTS</div>
                    <div className="col-span-1 text-xs font-black text-primary text-center">G</div>
                    <div className="col-span-1 text-xs font-black text-primary text-center">A</div>
                    <div className="col-span-2 text-xs font-black text-primary text-center">DS</div>
                  </div>
                  <div>
                    {jogo.atletas.map((a) => (
                      <div key={a.id} className="grid grid-cols-12 gap-2 px-1 py-2 border-b border-border">
                        <div className="col-span-6 flex items-center gap-2">
                          <img
                            src={a.foto || '/placeholder.svg'}
                            alt={a.nome}
                            className="w-8 h-8 rounded-full object-cover bg-muted"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = '/placeholder.svg';
                            }}
                          />
                          <span className="text-sm font-bold text-foreground">{a.nome}</span>
                        </div>
                        <div className="col-span-2 text-sm font-black text-right">{a.pts.toFixed(1)}</div>
                        <div className="col-span-1 text-sm font-black text-center">{a.g}</div>
                        <div className="col-span-1 text-sm font-black text-center">{a.a}</div>
                        <div className="col-span-2 text-sm font-black text-center">{a.ds}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
