import { ViewType } from '@/types/cartola';
import { cn } from '@/lib/utils';
import { 
  BarChart3, 
  User, 
  TrendingUp, 
  Trophy, 
  Users, 
  Zap,
  Shield,
  Activity
} from 'lucide-react';

interface SidebarProps {
  activeView: ViewType;
  onViewChange: (view: ViewType) => void;
}

const menuItems: { id: ViewType; label: string; icon: React.ReactNode }[] = [
  { id: 'cruzamento', label: 'Cruzamento Geral', icon: <BarChart3 className="w-5 h-5" /> },
  { id: 'atletas', label: 'Atletas', icon: <User className="w-5 h-5" /> },
  { id: 'medias', label: 'Top Médias', icon: <TrendingUp className="w-5 h-5" /> },
  { id: 'tops', label: 'Tops da Rodada', icon: <Trophy className="w-5 h-5" /> },
  { id: 'time-rodada', label: 'Time da Rodada', icon: <Users className="w-5 h-5" /> },
  { id: 'artilheiros', label: 'Top Artilheiros', icon: <TrendingUp className="w-5 h-5" /> },
  { id: 'provaveis', label: 'Prováveis', icon: <Users className="w-5 h-5" /> },
  { id: 'intocaveis', label: 'Top Intocáveis', icon: <Shield className="w-5 h-5" /> },
  { id: 'acompanhamento', label: 'Acompanhamento', icon: <Activity className="w-5 h-5" /> },
  { id: 'agente-tecnico', label: 'Agente Técnico', icon: <Zap className="w-5 h-5" /> },
];

export function Sidebar({ activeView, onViewChange }: SidebarProps) {
  return (
    <aside className="w-60 bg-sidebar flex flex-col flex-shrink-0 h-screen">
      {/* Header - Branding */}
      <div className="px-3 py-2.5 border-b border-sidebar-border bg-black/20">
        <div className="flex items-center gap-2.5">
          <img 
            src="/logo.png" 
            alt="STATUS FC Logo" 
            className="w-9 h-9 object-contain drop-shadow-[0_0_8px_hsl(259,70%,48%,0.4)]"
          />
          <div>
            <h1 className="text-sm font-extrabold tracking-widest text-primary leading-none">
              STATUS FC
            </h1>
            <p className="text-[7px] font-medium tracking-[0.2em] text-sidebar-foreground/50 mt-0.5 uppercase">
              Estatísticas & Probabilidades
            </p>
          </div>
        </div>
      </div>

      {/* Menu */}
      <nav className="flex-1 py-1 overflow-y-auto">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id)}
            className={cn(
              'w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-medium transition-all duration-200',
              'border-b border-sidebar-border/30 text-sidebar-foreground',
              'hover:bg-primary/8 hover:text-primary',
              activeView === item.id && 'bg-primary/10 text-primary font-bold border-l-2 border-l-primary'
            )}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-3 py-1.5 text-center text-[9px] text-sidebar-foreground/40 border-t border-sidebar-border">
        <p>Dados: Cartola FC API · © 2026 STATUS FC</p>
      </div>
    </aside>
  );
}
