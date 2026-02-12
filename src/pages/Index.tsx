import { useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { CruzamentoView } from '@/components/views/CruzamentoView';
import { AtletasView } from '@/components/views/AtletasView';
import { MediasView } from '@/components/views/MediasView';
import { TopsView } from '@/components/views/TopsView';
import { ProvaveisView } from '@/components/views/ProvaveisView';
import { BatedoresView } from '@/components/views/BatedoresView';
import { MaisEscaladosView } from '@/components/views/MaisEscaladosView';
import { ViewType } from '@/types/cartola';
import { useRodada } from '@/hooks/useCartolaData';
import { Calendar, Clock, Users } from 'lucide-react';

export default function Index() {
  const [activeView, setActiveView] = useState<ViewType>('cruzamento');
  const { data: rodadaData } = useRodada();

  const renderView = () => {
    switch (activeView) {
      case 'cruzamento':
        return <CruzamentoView />;
      case 'atletas':
        return <AtletasView />;
      case 'medias':
        return <MediasView />;
      case 'tops':
        return <TopsView />;
      case 'provaveis':
        return <ProvaveisView />;
      case 'batedores':
        return <BatedoresView />;
      case 'escalados':
        return <MaisEscaladosView />;
      default:
        return <CruzamentoView />;
    }
  };

  const formatFechamento = () => {
    if (!rodadaData?.fechamento) return null;
    const { dia, mes, hora, minuto } = rodadaData.fechamento;
    return `${dia.toString().padStart(2, '0')}/${mes.toString().padStart(2, '0')} às ${hora.toString().padStart(2, '0')}:${minuto.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar activeView={activeView} onViewChange={setActiveView} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header com informações da rodada */}
        {rodadaData && (
          <header className="bg-card border-b border-border px-5 py-3 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 text-foreground">
                <Calendar className="w-4 h-4 text-primary" />
                <span className="font-bold">Rodada {rodadaData.rodada_atual}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Clock className="w-4 h-4" />
                <span>Fecha: {formatFechamento()}</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-bold ${
                rodadaData.status_mercado === 1 
                  ? 'bg-success/20 text-success' 
                  : 'bg-destructive/20 text-destructive'
              }`}>
                <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
                {rodadaData.status_mercado === 1 ? 'Mercado Aberto' : 'Mercado Fechado'}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Users className="w-4 h-4" />
                <span>{rodadaData.times_escalados?.toLocaleString()} times escalados</span>
              </div>
            </div>
          </header>
        )}
        
        <main className="flex-1 overflow-y-auto p-5 bg-background">
          {renderView()}
        </main>
      </div>
    </div>
  );
}
