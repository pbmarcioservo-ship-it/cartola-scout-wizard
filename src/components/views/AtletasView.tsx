import { useState, useMemo } from 'react';
import { FilterBar } from '@/components/FilterBar';
import { ClubeEscudo } from '@/components/ClubeEscudo';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { PlayerDetailModal } from '@/components/PlayerDetailModal';
import { CompareModal } from '@/components/CompareModal';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { useMercado, POSICOES, STATUS_ATLETA } from '@/hooks/useCartolaData';
import { PosicaoFilter } from '@/types/cartola';
import { AlertCircle, TrendingUp, TrendingDown, Minus, GitCompare, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CartolaAtleta } from '@/lib/cartola-api';

export function AtletasView() {
  const [search, setSearch] = useState('');
  const [time, setTime] = useState('todos');
  const [posicao, setPosicao] = useState<PosicaoFilter>('todos');
  const [status, setStatus] = useState('todos');
  const [selectedAtleta, setSelectedAtleta] = useState<CartolaAtleta | null>(null);

  // Compare mode state
  const [compareMode, setCompareMode] = useState(false);
  const [compareSelection, setCompareSelection] = useState<CartolaAtleta[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);

  const { data: mercadoData, isLoading, error } = useMercado();

  const clubeOptions = useMemo(() => {
    if (!mercadoData?.clubes) return [];
    return Object.values(mercadoData.clubes)
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [mercadoData]);

  const atletasFiltrados = useMemo(() => {
    if (!mercadoData?.atletas) return [];

    return mercadoData.atletas
      .filter(atleta => {
        if (search && !atleta.apelido.toLowerCase().includes(search.toLowerCase())) return false;
        if (time !== 'todos' && atleta.clube_id !== Number(time)) return false;
        if (posicao !== 'todos') {
          const posicaoId = posicao === 'goleiro' ? 1 : posicao === 'lateral' ? 2 : posicao === 'zagueiro' ? 3 : posicao === 'meia' ? 4 : posicao === 'atacante' ? 5 : 6;
          if (atleta.posicao_id !== posicaoId) return false;
        }
        if (status !== 'todos' && atleta.status_id !== Number(status)) return false;
        return true;
      })
      .sort((a, b) => b.media_num - a.media_num)
      .slice(0, 50);
  }, [mercadoData, search, time, posicao, status]);

  const clubes = mercadoData?.clubes || {};

  const toggleCompareMode = () => {
    if (compareMode) {
      setCompareMode(false);
      setCompareSelection([]);
    } else {
      setCompareMode(true);
      setCompareSelection([]);
    }
  };

  const toggleAtletaSelection = (atleta: CartolaAtleta) => {
    setCompareSelection(prev => {
      const exists = prev.find(a => a.atleta_id === atleta.atleta_id);
      if (exists) return prev.filter(a => a.atleta_id !== atleta.atleta_id);
      if (prev.length >= 2) return prev;
      return [...prev, atleta];
    });
  };

  const isSelected = (id: number) => compareSelection.some(a => a.atleta_id === id);

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
        showStatusFilter
        search={search}
        onSearchChange={setSearch}
        time={time}
        onTimeChange={setTime}
        posicao={posicao}
        onPosicaoChange={setPosicao}
        status={status}
        onStatusChange={setStatus}
        clubeOptions={clubeOptions}
      >
        <Button
          variant={compareMode ? 'destructive' : 'outline'}
          size="sm"
          onClick={toggleCompareMode}
          className="font-bold gap-1.5"
        >
          {compareMode ? <X className="w-4 h-4" /> : <GitCompare className="w-4 h-4" />}
          {compareMode ? 'Cancelar' : 'Comparar'}
        </Button>
      </FilterBar>

      {/* Compare action bar */}
      {compareMode && (
        <div className="bg-primary/10 border border-primary/30 rounded-lg px-4 py-3 mb-4 flex items-center justify-between animate-fade-in">
          <p className="text-sm text-foreground font-bold">
            {compareSelection.length === 0 && 'Selecione 2 atletas para comparar'}
            {compareSelection.length === 1 && `1 atleta selecionado — selecione mais 1`}
            {compareSelection.length === 2 && '2 atletas selecionados!'}
          </p>
          {compareSelection.length === 2 && (
            <Button size="sm" onClick={() => setCompareOpen(true)} className="font-bold gap-1.5">
              <GitCompare className="w-4 h-4" />
              Comparar Agora
            </Button>
          )}
        </div>
      )}

      <div className="bg-card rounded-lg shadow-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-primary text-primary-foreground text-sm">
              {compareMode && <th className="p-3 w-10"></th>}
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
              const checked = isSelected(atleta.atleta_id);
              
              return (
                <tr 
                  key={atleta.atleta_id} 
                  className={cn(
                    'border-b border-border hover:bg-muted/30 transition-colors cursor-pointer',
                    idx % 2 === 0 ? 'bg-card' : 'bg-muted/10',
                    checked && 'bg-primary/10 hover:bg-primary/15'
                  )}
                  onClick={() => {
                    if (compareMode) {
                      toggleAtletaSelection(atleta);
                    } else {
                      setSelectedAtleta(atleta);
                    }
                  }}
                >
                  {compareMode && (
                    <td className="p-3 text-center">
                      <Checkbox
                        checked={checked}
                        disabled={!checked && compareSelection.length >= 2}
                        onCheckedChange={() => toggleAtletaSelection(atleta)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                  )}
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

      <PlayerDetailModal
        atleta={selectedAtleta}
        clube={selectedAtleta ? clubes[selectedAtleta.clube_id] : undefined}
        clubes={clubes}
        open={!!selectedAtleta}
        onOpenChange={(open) => !open && setSelectedAtleta(null)}
      />

      <CompareModal
        atletas={compareSelection.length === 2 ? [compareSelection[0], compareSelection[1]] : null}
        clubes={clubes}
        open={compareOpen}
        onOpenChange={setCompareOpen}
      />
    </div>
  );
}
