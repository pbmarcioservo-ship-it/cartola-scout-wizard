import { useState } from 'react';
import { FilterBar } from '@/components/FilterBar';
import { PosicaoFilter } from '@/types/cartola';
import { Search } from 'lucide-react';

export function AtletasView() {
  const [search, setSearch] = useState('');
  const [time, setTime] = useState('todos');
  const [posicao, setPosicao] = useState<PosicaoFilter>('todos');

  return (
    <div className="animate-fade-in">
      <FilterBar
        showSearchFilter
        showTimeFilter
        showPosicaoFilter
        search={search}
        onSearchChange={setSearch}
        time={time}
        onTimeChange={setTime}
        posicao={posicao}
        onPosicaoChange={setPosicao}
      />

      <div className="bg-card p-8 rounded-lg shadow-lg text-center">
        <Search className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-xl font-bold text-foreground mb-2">Aguardando Dados da Rodada</h3>
        <p className="text-muted-foreground">
          Os dados dos atletas serão carregados quando a integração com a API do Cartola for ativada.
        </p>
      </div>
    </div>
  );
}
