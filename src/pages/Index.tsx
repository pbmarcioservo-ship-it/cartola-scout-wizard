import { useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { CruzamentoView } from '@/components/views/CruzamentoView';
import { AtletasView } from '@/components/views/AtletasView';
import { MediasView } from '@/components/views/MediasView';
import { TopsView } from '@/components/views/TopsView';
import { ProvaveisView } from '@/components/views/ProvaveisView';
import { BatedoresView } from '@/components/views/BatedoresView';
import { ViewType } from '@/types/cartola';

export default function Index() {
  const [activeView, setActiveView] = useState<ViewType>('cruzamento');

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
      default:
        return <CruzamentoView />;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar activeView={activeView} onViewChange={setActiveView} />
      
      <main className="flex-1 overflow-y-auto p-5 bg-background">
        {renderView()}
      </main>
    </div>
  );
}
