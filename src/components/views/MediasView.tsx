import { useState, useMemo } from 'react';
import { FilterBar } from '@/components/FilterBar';
import { ClubeEscudo } from '@/components/ClubeEscudo';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { PlayerDetailModal } from '@/components/PlayerDetailModal';
import { useMercado, POSICOES } from '@/hooks/useCartolaData';
import { PosicaoFilter } from '@/types/cartola';
import { AlertCircle, Medal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CartolaAtleta } from '@/lib/cartola-api';

export function MediasView() {
  const [posicao, setPosicao] = useState<PosicaoFilter>('todos');
  const [time, setTime] = useState('todos');
  const [selectedAtleta, setSelectedAtleta] = useState<CartolaAtleta | null>(null);

  const { data: mercadoData, isLoading, error } = useMercado();

  const topAtletas = useMemo(() => {
    if (!mercadoData?.atletas) return [];

    return mercadoData.atletas
      .filter(atleta => {
        // Filtro de time
        if (time !== 'todos' && atleta.clube_id !== Number(time)) {
          return false;
        }
        
        // Filtro de posição
        if (posicao !== 'todos') {
          const posicaoId = posicao === 'goleiro' ? 1 :
                           posicao === 'lateral' ? 2 :
                           posicao === 'zagueiro' ? 3 :
                           posicao === 'meia' ? 4 :
                           posicao === 'atacante' ? 5 : 6;
          if (atleta.posicao_id !== posicaoId) return false;
        }
        
        // Apenas atletas com jogos
        if (atleta.jogos_num < 1) return false;
        
        return true;
      })
      .sort((a, b) => b.media_num - a.media_num)
      .slice(0, 30);
  }, [mercadoData, time, posicao]);

  const clubes = mercadoData?.clubes || {};

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" text="Carregando médias..." />
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

  const getMedalColor = (rank: number) => {
    if (rank === 0) return 'text-yellow-500';
    if (rank === 1) return 'text-gray-400';
    if (rank === 2) return 'text-amber-600';
    return 'text-muted-foreground';
  };

  return (
    <div className="animate-fade-in">
      <FilterBar
        showPosicaoFilter
        showTimeFilter
        posicao={posicao}
        onPosicaoChange={setPosicao}
        time={time}
        onTimeChange={setTime}
      />

      <div className="bg-card rounded-lg shadow-lg overflow-hidden">
        <div className="bg-primary text-primary-foreground p-4 font-bold text-center text-lg">
          🏆 TOP MÉDIAS DO CAMPEONATO
        </div>
        
        <div className="divide-y divide-border">
          {topAtletas.map((atleta, idx) => {
            const clube = clubes[atleta.clube_id];
            const posicaoInfo = POSICOES[atleta.posicao_id];
            
            return (
              <div 
                key={atleta.atleta_id}
                className={cn(
                  'flex items-center gap-4 p-4 hover:bg-muted/30 transition-colors cursor-pointer',
                  idx < 3 && 'bg-primary/5'
                )}
                onClick={() => setSelectedAtleta(atleta)}
              >
                <div className="w-10 text-center">
                  {idx < 3 ? (
                    <Medal className={cn('w-6 h-6 mx-auto', getMedalColor(idx))} />
                  ) : (
                    <span className="font-bold text-muted-foreground">{idx + 1}º</span>
                  )}
                </div>
                
                <img 
                  src={atleta.foto?.replace('FORMATO', '80x80')} 
                  alt={atleta.apelido}
                  className="w-12 h-12 rounded-full object-cover bg-muted"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/placeholder.svg';
                  }}
                />
                
                <div className="flex-1">
                  <p className="font-bold text-foreground">{atleta.apelido}</p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-xs font-bold">
                      {posicaoInfo?.abreviacao}
                    </span>
                    {clube && (
                      <div className="flex items-center gap-1">
                        <ClubeEscudo clube={clube} size="sm" />
                        <span>{clube.abreviacao}</span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="text-right">
                  <p className="font-black text-2xl text-primary">{atleta.media_num.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">{atleta.jogos_num} jogos</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <PlayerDetailModal
        atleta={selectedAtleta}
        clube={selectedAtleta ? clubes[selectedAtleta.clube_id] : undefined}
        clubes={clubes}
        open={!!selectedAtleta}
        onOpenChange={(open) => !open && setSelectedAtleta(null)}
      />
    </div>
  );
}
