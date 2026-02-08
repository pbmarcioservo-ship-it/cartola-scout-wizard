import { ViewType } from '@/types/cartola';
import { cn } from '@/lib/utils';
import { 
  BarChart3, 
  User, 
  TrendingUp, 
  Trophy, 
  Users, 
  Target,
  Zap
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
  { id: 'provaveis', label: 'Prováveis', icon: <Users className="w-5 h-5" /> },
  { id: 'batedores', label: 'Batedores', icon: <Target className="w-5 h-5" /> },
];

export function Sidebar({ activeView, onViewChange }: SidebarProps) {
  return (
    <aside className="w-60 bg-sidebar flex flex-col flex-shrink-0 h-screen">
      {/* Header */}
      <div className="p-6 bg-black/30 border-b-2 border-primary">
        <div className="flex items-center gap-3 justify-center">
          <Zap className="w-8 h-8 text-primary" />
          <h1 className="text-xl font-bold text-primary tracking-wide">STATUS FC</h1>
        </div>
      </div>

      {/* Menu */}
      <nav className="flex-1 py-4">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id)}
            className={cn(
              'w-full flex items-center gap-3 px-5 py-4 text-sm font-medium transition-all duration-200',
              'border-b border-sidebar-border text-sidebar-foreground',
              'hover:bg-primary hover:text-primary-foreground',
              activeView === item.id && 'bg-primary text-primary-foreground font-bold'
            )}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 text-center text-xs text-sidebar-foreground/60 border-t border-sidebar-border">
        <p>Dados: Cartola FC API</p>
        <p className="mt-1">© 2026 STATUS FC</p>
      </div>
    </aside>
  );
}
