import { useEffect, useState } from 'react';
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
import { MinhaContaView } from '@/components/views/MinhaContaView';
import { useRodada } from '@/hooks/useCartolaData';
import { Calendar, Clock, Crown, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { LoadingSpinner } from '@/components/LoadingSpinner';

const OWNER_EMAIL = 'pb.marcioservo@gmail.com';

export default function Index() {
  const [activeView, setActiveView] = useState<ViewType>('cruzamento');
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [hasProAccess, setHasProAccess] = useState(false);
  const { data: rodadaData } = useRodada();
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      setHasProAccess(false);
      setCheckingAccess(false);
      return;
    }

    const checkAccess = async () => {
      const email = user.email?.toLowerCase();
      if (email === OWNER_EMAIL) {
        setHasProAccess(true);
        setCheckingAccess(false);
        return;
      }

      const { data, error } = await supabase.rpc('has_active_subscription', {
        _user_id: user.id,
      });

      setHasProAccess(!error && Boolean(data));
      setCheckingAccess(false);
    };

    void checkAccess();
  }, [user]);

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
      case 'minha-conta': return <MinhaContaView />;
      default: return <CruzamentoView />;
    }
  };

  const formatFechamento = () => {
    if (!rodadaData?.fechamento) return null;
    const { dia, mes, hora, minuto } = rodadaData.fechamento;
    return `${dia.toString().padStart(2, '0')}/${mes.toString().padStart(2, '0')} às ${hora.toString().padStart(2, '0')}:${minuto.toString().padStart(2, '0')}`;
  };

  if (checkingAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sidebar">
        <LoadingSpinner />
      </div>
    );
  }

  if (!hasProAccess) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-sidebar p-6">
        <section className="w-full max-w-md rounded-lg border border-primary/30 bg-card/10 backdrop-blur-sm p-8 text-center space-y-5 shadow-[0_0_40px_hsl(259,70%,48%,0.15)]">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/20 border border-primary/30 text-primary flex items-center justify-center shadow-[0_0_20px_hsl(259,70%,48%,0.3)]">
            <Crown className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-extrabold text-sidebar-foreground tracking-wide">Acesso Exclusivo</h1>
          <p className="text-sm text-sidebar-foreground/70 leading-relaxed">
            O <span className="text-primary font-bold">STATUS FC PRO</span> é uma plataforma exclusiva para assinantes.
            Tenha acesso a todas as ferramentas, estatísticas avançadas e o Agente Técnico com IA.
          </p>
          <div className="space-y-2 text-left text-xs text-sidebar-foreground/60">
            <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-primary" /> Cruzamento de dados em tempo real</div>
            <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-primary" /> Agente Técnico com Inteligência Artificial</div>
            <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-primary" /> Prováveis escalações e top artilheiros</div>
            <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-primary" /> Acompanhamento e análises exclusivas</div>
          </div>
          <a
            href="https://wa.me/5511963268954?text=Olá,%20quero%20saber%20mais%20sobre%20o%20plano%20pro%20do%20Status%20FC."
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block w-full py-3 rounded-md bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-colors shadow-[0_0_15px_hsl(259,70%,48%,0.3)]"
          >
            Quero ser PRO →
          </a>
          <p className="text-[10px] text-sidebar-foreground/40">
            Já assinou? Faça logout e login novamente para atualizar seu acesso.
          </p>
          <button
            onClick={() => { void supabase.auth.signOut(); }}
            className="text-xs text-primary/70 hover:text-primary transition-colors"
          >
            Sair e trocar de conta
          </button>
        </section>
      </main>
    );
  }

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
