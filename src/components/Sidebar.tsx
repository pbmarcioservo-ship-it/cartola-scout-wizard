import { useState } from 'react';
import { ViewType } from '@/types/cartola';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { 
  BarChart3, 
  Target,
  Gauge,
  Trophy, 
  LayoutDashboard,
  Circle,
  UserSearch,
  Shield,
  Activity,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  X,
  UserCog
} from 'lucide-react';

interface SidebarProps {
  activeView: ViewType;
  onViewChange: (view: ViewType) => void;
}

const menuItems: { id: ViewType; label: string; icon: React.ElementType }[] = [
  { id: 'cruzamento', label: 'Cruzamento Geral', icon: BarChart3 },
  { id: 'atletas', label: 'Atletas', icon: User },
  { id: 'medias', label: 'Top Médias', icon: TrendingUp },
  { id: 'tops', label: 'Tops da Rodada', icon: Trophy },
  { id: 'time-rodada', label: 'Time da Rodada', icon: Users },
  { id: 'artilheiros', label: 'Top Artilheiros', icon: TrendingUp },
  { id: 'provaveis', label: 'Prováveis', icon: Users },
  { id: 'intocaveis', label: 'Top Intocáveis', icon: Shield },
  { id: 'acompanhamento', label: 'Acompanhamento', icon: Activity },
  { id: 'agente-tecnico', label: 'Agente Técnico', icon: Zap },
];

// First 4 items shown in mobile bottom tab bar
const mobileMainItems = menuItems.slice(0, 4);
const mobileMoreItems = menuItems.slice(4);

export function Sidebar({ activeView, onViewChange }: SidebarProps) {
  const [expanded, setExpanded] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const isMobile = useIsMobile();

  // ─── MOBILE: bottom tab bar + fullscreen "more" ───
  if (isMobile) {
    return (
      <>
        {/* Fullscreen "More" overlay */}
        {moreOpen && (
          <div className="fixed inset-0 z-50 bg-background flex flex-col animate-fade-in">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h2 className="text-base font-bold text-foreground">Menu</h2>
              <button onClick={() => setMoreOpen(false)} className="p-2 rounded-lg hover:bg-muted">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-3 space-y-1">
              {menuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => { onViewChange(item.id); setMoreOpen(false); }}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3.5 rounded-lg text-sm font-semibold transition-colors',
                      'text-foreground/70 hover:bg-muted',
                      activeView === item.id && 'bg-primary/10 text-primary'
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </div>
        )}

        {/* Bottom tab bar */}
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border flex items-center justify-around px-1 py-1.5 safe-area-bottom">
          {mobileMainItems.map((item) => {
            const Icon = item.icon;
            const active = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                className={cn(
                  'flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg text-[10px] font-medium transition-colors min-w-[56px]',
                  active ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="truncate max-w-[56px]">{item.label.split(' ')[0]}</span>
              </button>
            );
          })}
          <button
            onClick={() => setMoreOpen(true)}
            className={cn(
              'flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg text-[10px] font-medium transition-colors min-w-[56px]',
              mobileMoreItems.some(i => i.id === activeView) ? 'text-primary' : 'text-muted-foreground'
            )}
          >
            <MoreHorizontal className="w-5 h-5" />
            <span>Mais</span>
          </button>
        </div>
      </>
    );
  }

  // ─── DESKTOP / TABLET: collapsible sidebar ───
  return (
    <aside
      className={cn(
        'bg-sidebar flex flex-col flex-shrink-0 h-screen transition-all duration-300 ease-in-out relative',
        expanded ? 'w-60' : 'w-[60px]'
      )}
    >
      {/* Header */}
      <div className={cn(
        'border-b border-sidebar-border bg-black/20 flex items-center',
        expanded ? 'px-3 py-2.5 gap-2.5' : 'px-0 py-2.5 justify-center'
      )}>
        <img 
          src="/logo.png" 
          alt="STATUS FC Logo" 
          className="w-9 h-9 object-contain drop-shadow-[0_0_8px_hsl(259,70%,48%,0.4)]"
        />
        {expanded && (
          <div className="animate-fade-in">
            <h1 className="text-sm font-extrabold tracking-widest text-primary leading-none">
              STATUS FC
            </h1>
            <p className="text-[7px] font-medium tracking-[0.2em] text-sidebar-foreground/50 mt-0.5 uppercase">
              Estatísticas & Probabilidades
            </p>
          </div>
        )}
      </div>

      {/* Toggle button */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="absolute -right-3 top-[52px] z-10 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg hover:bg-primary/90 transition-colors"
      >
        {expanded ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
      </button>

      <div className="h-2" />

      {/* Menu */}
      <nav className="flex-1 flex flex-col py-1 overflow-y-auto overflow-x-hidden">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              title={!expanded ? item.label : undefined}
              className={cn(
                'w-full flex items-center gap-3 py-3 transition-colors duration-200 whitespace-nowrap',
                expanded ? 'px-5' : 'px-0 justify-center',
                'text-sidebar-foreground/65 hover:text-primary text-[15px] font-semibold',
                activeView === item.id && 'text-primary font-bold'
              )}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {expanded && <span className="animate-fade-in">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      {expanded && (
        <div className="px-3 py-1.5 text-center text-[9px] text-sidebar-foreground/40 border-t border-sidebar-border animate-fade-in">
          <p>Dados: Cartola FC API · © 2026 STATUS FC</p>
        </div>
      )}
    </aside>
  );
}
