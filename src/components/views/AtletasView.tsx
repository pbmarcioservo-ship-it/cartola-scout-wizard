import { useState, useMemo } from 'react';
import { FilterBar } from '@/components/FilterBar';
import { ClubeEscudo } from '@/components/ClubeEscudo';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { PlayerDetailModal } from '@/components/PlayerDetailModal';
import { useMercado, POSICOES, STATUS_ATLETA } from '@/hooks/useCartolaData';
import { PosicaoFilter } from '@/types/cartola';
import { AlertCircle, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CartolaAtleta } from '@/lib/cartola-api';

export function AtletasView() {
  const [search, setSearch] = useState('');
  const [time, setTime] = useState('todos');
  const [posicao, setPosicao] = useState<PosicaoFilter>('todos');

  const { data: mercadoData, isLoading, error } = useMercado();

  const atletasFiltrados = useMemo(() => {
    if (!mercadoData?.atletas) return [];

    return mercadoData.atletas
      .filter(atleta => {
        // Filtro de busca
        if (search && !atleta.apelido.toLowerCase().includes(search.toLowerCase())) {
          return false;
        }
        
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
        
        return true;
      })
      .sort((a, b) => b.media_num - a.media_num)
      .slice(0, 50); // Limita a 50 para performance
  }, [mercadoData, search, time, posicao]);

  const clubes = mercadoData?.clubes || {};

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" text="Carregando atletas..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-destructive gap-3">
        <AlertCircle className="w-12 h-12" />
        <p className="font-bold">Erro ao carregar atletas</p>
        <p className="text-sm text-muted-foreground">{(error as Error).message}</p>
      </div>
    );
  }

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

      <div className="bg-card rounded-lg shadow-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-primary text-primary-foreground text-sm">
              <th className="p-3 text-left">Atleta</th>
              <th className="p-3 text-center">Pos</th>
              <th className="p-3 text-center">Clube</th>
              <th className="p-3 text-center">Média</th>
              <th className="p-3 text-center">Pontos</th>
              <th className="p-3 text-center">Preço</th>
              <th className="p-3 text-center">Var</th>
              <th className="p-3 text-center">Jogos</th>
              <th className="p-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {atletasFiltrados.map((atleta, idx) => {
              const clube = clubes[atleta.clube_id];
              const posicaoInfo = POSICOES[atleta.posicao_id];
              const statusInfo = STATUS_ATLETA[atleta.status_id];
              
              return (
                <tr 
                  key={atleta.atleta_id} 
                  className={cn(
                    'border-b border-border hover:bg-muted/30 transition-colors',
                    idx % 2 === 0 ? 'bg-card' : 'bg-muted/10'
                  )}
                >
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <img 
                        src={atleta.foto?.replace('FORMATO', '80x80')} 
                        alt={atleta.apelido}
                        className="w-10 h-10 rounded-full object-cover bg-muted"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/placeholder.svg';
                        }}
                      />
                      <div>
                        <p className="font-bold text-foreground">{atleta.apelido}</p>
                        <p className="text-xs text-muted-foreground">{atleta.nome}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-3 text-center">
                    <span className="bg-primary/10 text-primary px-2 py-1 rounded text-xs font-bold">
                      {posicaoInfo?.abreviacao || '-'}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex justify-center">
                      {clube && <ClubeEscudo clube={clube} size="sm" />}
                    </div>
                  </td>
                  <td className="p-3 text-center font-black text-primary">
                    {atleta.media_num.toFixed(2)}
                  </td>
                  <td className="p-3 text-center font-bold">
                    {atleta.pontos_num.toFixed(1)}
                  </td>
                  <td className="p-3 text-center font-bold text-foreground">
                    C$ {atleta.preco_num.toFixed(2)}
                  </td>
                  <td className="p-3 text-center">
                    <div className={cn(
                      'flex items-center justify-center gap-1 font-bold text-sm',
                      atleta.variacao_num > 0 ? 'text-success' :
                      atleta.variacao_num < 0 ? 'text-destructive' :
                      'text-muted-foreground'
                    )}>
                      {atleta.variacao_num > 0 ? <TrendingUp className="w-4 h-4" /> :
                       atleta.variacao_num < 0 ? <TrendingDown className="w-4 h-4" /> :
                       <Minus className="w-4 h-4" />}
                      {atleta.variacao_num.toFixed(2)}
                    </div>
                  </td>
                  <td className="p-3 text-center font-bold">
                    {atleta.jogos_num}
                  </td>
                  <td className="p-3 text-center">
                    {statusInfo && (
                      <span 
                        className="px-2 py-1 rounded text-xs font-bold text-white"
                        style={{ backgroundColor: statusInfo.cor }}
                      >
                        {statusInfo.nome}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        
        {atletasFiltrados.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
            Nenhum atleta encontrado com os filtros selecionados.
          </div>
        )}
      </div>
    </div>
  );
}
