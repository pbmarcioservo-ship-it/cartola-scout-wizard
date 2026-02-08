import { useState } from 'react';
import { FilterBar } from '@/components/FilterBar';
import { TeamShield } from '@/components/TeamShield';
import { ProgressBar } from '@/components/ProgressBar';
import { partidasRodada } from '@/data/times';
import { PosicaoFilter, ScoutFilter } from '@/types/cartola';

// Mock data - será substituído pela API
const generateMockStats = () => ({
  conquista: Math.random() * 25 + 5,
  cede: Math.random() * 25 + 5,
});

export function CruzamentoView() {
  const [mando, setMando] = useState('casa_fora');
  const [ultimas, setUltimas] = useState(3);
  const [posicao, setPosicao] = useState<PosicaoFilter>('todos');
  const [scout, setScout] = useState<ScoutFilter>('desarmes');

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
            {partidasRodada.map((partida) => {
              const stats = generateMockStats();
              return (
                <tr key={partida.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                  <td className="w-[40%]">
                    <ProgressBar 
                      value={stats.conquista} 
                      maxValue={30} 
                      color="success" 
                      reverse 
                    />
                  </td>
                  <td className="w-[20%] text-center py-3 bg-muted/20 border-x border-border">
                    <div className="flex items-center justify-center gap-2">
                      <TeamShield team={partida.mandante} size="sm" />
                      <span className="font-black text-xs">
                        {partida.mandante.abreviacao} x {partida.visitante.abreviacao}
                      </span>
                      <TeamShield team={partida.visitante} size="sm" />
                    </div>
                  </td>
                  <td className="w-[40%]">
                    <ProgressBar 
                      value={stats.cede} 
                      maxValue={30} 
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
            {partidasRodada.map((partida) => {
              const stats = generateMockStats();
              return (
                <tr key={partida.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                  <td className="w-[40%]">
                    <ProgressBar 
                      value={stats.cede} 
                      maxValue={30} 
                      color="destructive" 
                      reverse 
                    />
                  </td>
                  <td className="w-[20%] text-center py-3 bg-muted/20 border-x border-border">
                    <div className="flex items-center justify-center gap-2">
                      <TeamShield team={partida.visitante} size="sm" />
                      <span className="font-black text-xs">
                        {partida.visitante.abreviacao} x {partida.mandante.abreviacao}
                      </span>
                      <TeamShield team={partida.mandante} size="sm" />
                    </div>
                  </td>
                  <td className="w-[40%]">
                    <ProgressBar 
                      value={stats.conquista} 
                      maxValue={30} 
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
