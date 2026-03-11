import { useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { CruzamentoView } from '@/components/views/CruzamentoView';
import { AtletasView } from '@/components/views/AtletasView';
import { MediasView } from '@/components/views/MediasView';
import { TopsView } from '@/components/views/TopsView';
import { ProvaveisView } from '@/components/views/ProvaveisView';
import { BatedoresView } from '@/components/views/BatedoresView';
import { MaisEscaladosView } from '@/components/views/MaisEscaladosView';
import { IntocaveisView } from '@/components/views/IntocaveisView';
import { ViewType } from '@/types/cartola';
import { TimeRodadaView } from '@/components/views/TimeRodadaView';
import { TopArtilheirosView } from '@/components/views/TopArtilheirosView';
import { AcompanhamentoView } from '@/components/views/AcompanhamentoView';
import { AgenteTecnicoView } from '@/components/views/AgenteTecnicoView';
import { useRodada } from '@/hooks/useCartolaData';
import { Calendar, Clock, Users } from 'lucide-react';

export default function Index() {
  const [activeView, setActiveView] = useState<ViewType>('cruzamento');
  const { data: rodadaData } = useRodada();

  const renderView = () => {
    switch (activeView) {
      case 'cruzamento': return <CruzamentoView />;
      case 'atletas': return <AtletasView />;
      case 'medias': return <MediasView />;
      case 'tops': return <TopsView />;
      case 'provaveis': return <ProvaveisView />;
      case 'batedores': return <BatedoresView />;
      case 'escalados': return <MaisEscaladosView />;
      case 'intocaveis': return <IntocaveisView />;
      case 'time-rodada': return <TimeRodadaView />;
      case 'artilheiros': return <TopArtilheirosView />;
      case 'acompanhamento': return <AcompanhamentoView />;
      case 'agente-tecnico': return <AgenteTecnicoView />;
      default: return <CruzamentoView />;
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
        {rodadaData && (
          <header className="bg-card/80 backdrop-blur-sm border-b border-border px-5 py-2.5 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-5">
              <div className="flex items-center gap-2 text-foreground">
                <Calendar className="w-4 h-4 text-primary/70" />
                <span className="font-bold text-sm">Rodada {rodadaData.rodada_atual}</span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                <Clock className="w-3.5 h-3.5" />
                <span>Fecha: {formatFechamento()}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold ${
                rodadaData.status_mercado === 1
                  ? 'bg-success/10 text-success'
                  : 'bg-destructive/10 text-destructive'
              }`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                {rodadaData.status_mercado === 1 ? 'Aberto' : 'Fechado'}
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                <Users className="w-3.5 h-3.5" />
                <span>{rodadaData.times_escalados?.toLocaleString()}</span>
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
