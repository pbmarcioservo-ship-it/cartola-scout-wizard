import { useState } from 'react';
import { FilterBar } from '@/components/FilterBar';
import { PosicaoFilter } from '@/types/cartola';
import { TrendingUp } from 'lucide-react';

export function MediasView() {
  const [posicao, setPosicao] = useState<PosicaoFilter>('todos');
  const [time, setTime] = useState('todos');

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

      <div className="bg-card p-8 rounded-lg shadow-lg text-center">
        <TrendingUp className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-xl font-bold text-foreground mb-2">Top Médias</h3>
        <p className="text-muted-foreground">
          Os rankings de médias serão carregados quando a integração com a API do Cartola for ativada.
        </p>
      </div>
    </div>
  );
}
