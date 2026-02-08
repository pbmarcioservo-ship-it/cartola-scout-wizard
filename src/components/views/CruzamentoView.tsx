import { useState, useMemo } from 'react';
import { FilterBar } from '@/components/FilterBar';
import { ClubeEscudo } from '@/components/ClubeEscudo';
import { ProgressBar } from '@/components/ProgressBar';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { usePartidas, useMercado, POSICOES } from '@/hooks/useCartolaData';
import { PosicaoFilter, ScoutFilter } from '@/types/cartola';
import { AlertCircle } from 'lucide-react';

export function CruzamentoView() {
  const [mando, setMando] = useState('casa_fora');
  const [ultimas, setUltimas] = useState(3);
  const [posicao, setPosicao] = useState<PosicaoFilter>('todos');
  const [scout, setScout] = useState<ScoutFilter>('desarmes');

  const { data: partidasData, isLoading: loadingPartidas, error: errorPartidas } = usePartidas();
  const { data: mercadoData, isLoading: loadingMercado } = useMercado();

  const isLoading = loadingPartidas || loadingMercado;

  // Calcula estatísticas dos atletas por clube
  const estatisticasPorClube = useMemo(() => {
    if (!mercadoData?.atletas || !mercadoData?.clubes) return {};
    
    const stats: Record<number, { conquista: number; cede: number; total: number }> = {};
    
    mercadoData.atletas.forEach(atleta => {
      if (!stats[atleta.clube_id]) {
        stats[atleta.clube_id] = { conquista: 0, cede: 0, total: 0 };
      }
      
      // Calcula baseado no scout selecionado
      const scoutValue = atleta.scout?.[scout.toUpperCase() === 'GOLS' ? 'G' : 
                                        scout.toUpperCase() === 'ASSISTENCIAS' ? 'A' :
                                        scout.toUpperCase() === 'DESARMES' ? 'DS' :
                                        scout.toUpperCase() === 'FINALIZACAODEFENDIDA' ? 'FD' :
                                        scout.toUpperCase() === 'FINALIZACAOFORA' ? 'FF' :
                                        scout.toUpperCase() === 'DEFESAS' ? 'DE' : 'SG'] || 0;
      
      stats[atleta.clube_id].conquista += scoutValue;
      stats[atleta.clube_id].total += 1;
    });

    // Normaliza os valores
    Object.keys(stats).forEach(clubeId => {
      const id = Number(clubeId);
      if (stats[id].total > 0) {
        stats[id].conquista = stats[id].conquista / stats[id].total * 10;
        stats[id].cede = Math.random() * 15 + 5; // Mock para cede até ter dados históricos
      }
    });

    return stats;
  }, [mercadoData, scout]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" text="Carregando dados do Cartola..." />
      </div>
    );
  }

  if (errorPartidas) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-destructive gap-3">
        <AlertCircle className="w-12 h-12" />
        <p className="font-bold">Erro ao carregar dados</p>
        <p className="text-sm text-muted-foreground">{(errorPartidas as Error).message}</p>
      </div>
    );
  }

  const partidas = partidasData?.partidas || [];
  const clubes = partidasData?.clubes || mercadoData?.clubes || {};

  return (
    <div className="animate-fade-in">
      <FilterBar
        showMandoFilter
        showUltimasFilter
        showPosicaoFilter
        showScoutFilter
        mando={mando}
        onMandoChange={setMando}
        ultimas={ultimas}
        onUltimasChange={setUltimas}
        posicao={posicao}
        onPosicaoChange={setPosicao}
        scout={scout}
        onScoutChange={setScout}
      />

      {/* Tabela Mandantes */}
      <div className="mb-8">
        <div className="bg-primary text-primary-foreground p-3 font-bold text-center rounded-t-lg">
          📊 ANÁLISE MANDANTES: CONQUISTA (VERDE) vs VISITANTE CEDE (VERMELHO)
        </div>
        <table className="w-full bg-card shadow-lg rounded-b-lg overflow-hidden">
          <tbody>
            {partidas.map((partida) => {
              const clubeCasa = clubes[partida.clube_casa_id];
              const clubeVisitante = clubes[partida.clube_visitante_id];
              const statsCasa = estatisticasPorClube[partida.clube_casa_id] || { conquista: 0, cede: 0 };
              const statsVisitante = estatisticasPorClube[partida.clube_visitante_id] || { conquista: 0, cede: 0 };

              if (!clubeCasa || !clubeVisitante) return null;

              return (
                <tr key={partida.partida_id} className="border-b border-border hover:bg-muted/30 transition-colors">
                  <td className="w-[40%]">
                    <ProgressBar 
                      value={statsCasa.conquista} 
                      maxValue={25} 
                      color="success" 
                      reverse 
                    />
                  </td>
                  <td className="w-[20%] text-center py-3 bg-muted/20 border-x border-border">
                    <div className="flex items-center justify-center gap-2">
                      <ClubeEscudo clube={clubeCasa} size="sm" />
                      <span className="font-black text-xs">
                        {clubeCasa.abreviacao} x {clubeVisitante.abreviacao}
                      </span>
                      <ClubeEscudo clube={clubeVisitante} size="sm" />
                    </div>
                  </td>
                  <td className="w-[40%]">
                    <ProgressBar 
                      value={statsVisitante.cede} 
                      maxValue={25} 
                      color="destructive" 
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Tabela Visitantes */}
      <div>
        <div className="bg-secondary text-secondary-foreground p-3 font-bold text-center rounded-t-lg">
          📊 ANÁLISE VISITANTES: CONQUISTA (VERDE) vs MANDANTE CEDE (VERMELHO)
        </div>
        <table className="w-full bg-card shadow-lg rounded-b-lg overflow-hidden">
          <tbody>
            {partidas.map((partida) => {
              const clubeCasa = clubes[partida.clube_casa_id];
              const clubeVisitante = clubes[partida.clube_visitante_id];
              const statsCasa = estatisticasPorClube[partida.clube_casa_id] || { conquista: 0, cede: 0 };
              const statsVisitante = estatisticasPorClube[partida.clube_visitante_id] || { conquista: 0, cede: 0 };

              if (!clubeCasa || !clubeVisitante) return null;

              return (
                <tr key={partida.partida_id} className="border-b border-border hover:bg-muted/30 transition-colors">
                  <td className="w-[40%]">
                    <ProgressBar 
                      value={statsCasa.cede} 
                      maxValue={25} 
                      color="destructive" 
                      reverse 
                    />
                  </td>
                  <td className="w-[20%] text-center py-3 bg-muted/20 border-x border-border">
                    <div className="flex items-center justify-center gap-2">
                      <ClubeEscudo clube={clubeVisitante} size="sm" />
                      <span className="font-black text-xs">
                        {clubeVisitante.abreviacao} x {clubeCasa.abreviacao}
                      </span>
                      <ClubeEscudo clube={clubeCasa} size="sm" />
                    </div>
                  </td>
                  <td className="w-[40%]">
                    <ProgressBar 
                      value={statsVisitante.conquista} 
                      maxValue={25} 
                      color="success" 
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
