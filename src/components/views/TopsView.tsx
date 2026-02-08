import { useMemo } from 'react';
import { ClubeEscudo } from '@/components/ClubeEscudo';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { usePontuados, useMercado, POSICOES } from '@/hooks/useCartolaData';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TopCategory {
  title: string;
  icon: string;
  color: string;
  posicaoId?: number;
  type?: 'sg' | 'capitao';
}

const categories: TopCategory[] = [
  { title: 'TOP 5 SG', icon: '🛡️', color: 'hsl(174, 72%, 56%)', type: 'sg' },
  { title: 'GOLEIROS', icon: '🧤', color: 'hsl(45, 97%, 50%)', posicaoId: 1 },
  { title: 'LATERAIS', icon: '🏃', color: 'hsl(322, 72%, 52%)', posicaoId: 2 },
  { title: 'ZAGUEIROS', icon: '🧱', color: 'hsl(251, 69%, 63%)', posicaoId: 3 },
  { title: 'MEIAS', icon: '💡', color: 'hsl(200, 72%, 50%)', posicaoId: 4 },
  { title: 'ATACANTES', icon: '🏹', color: 'hsl(0, 100%, 65%)', posicaoId: 5 },
  { title: 'TÉCNICOS', icon: '📋', color: 'hsl(151, 82%, 45%)', posicaoId: 6 },
];

export function TopsView() {
  const { data: pontuadosData, isLoading: loadingPontuados, error } = usePontuados();
  const { data: mercadoData, isLoading: loadingMercado } = useMercado();

  const isLoading = loadingPontuados || loadingMercado;

  const topsPorCategoria = useMemo(() => {
    if (!mercadoData?.atletas) return {};

    const tops: Record<string, typeof mercadoData.atletas> = {};

    categories.forEach(cat => {
      let filteredAtletas = [...mercadoData.atletas];

      if (cat.posicaoId) {
        filteredAtletas = filteredAtletas.filter(a => a.posicao_id === cat.posicaoId);
      }

      if (cat.type === 'sg') {
        // Filtra goleiros e zagueiros com SG
        filteredAtletas = filteredAtletas
          .filter(a => a.posicao_id === 1 || a.posicao_id === 3)
          .filter(a => a.scout?.SG && a.scout.SG > 0);
      }

      tops[cat.title] = filteredAtletas
        .sort((a, b) => b.media_num - a.media_num)
        .slice(0, 5);
    });

    return tops;
  }, [mercadoData]);

  const clubes = mercadoData?.clubes || {};

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" text="Carregando tops..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-destructive gap-3">
        <AlertCircle className="w-12 h-12" />
        <p className="font-bold">Erro ao carregar dados</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {categories.map((category, index) => {
          const atletas = topsPorCategoria[category.title] || [];
          
          return (
            <div 
              key={category.title}
              className="bg-card rounded-xl overflow-hidden shadow-lg animate-slide-in"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div 
                className="p-3 text-center font-bold uppercase text-white"
                style={{ backgroundColor: category.color }}
              >
                {category.icon} {category.title}
              </div>
              <div>
                {atletas.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground text-sm">
                    Sem dados disponíveis
                  </div>
                ) : (
                  atletas.map((atleta, idx) => {
                    const clube = clubes[atleta.clube_id];
                    
                    return (
                      <div 
                        key={atleta.atleta_id}
                        className={cn(
                          'flex items-center gap-3 px-4 py-3',
                          idx < atletas.length - 1 && 'border-b border-border'
                        )}
                      >
                        <span className="text-muted-foreground text-sm font-bold w-5">
                          {idx + 1}.
                        </span>
                        <img 
                          src={atleta.foto?.replace('FORMATO', '50x50')} 
                          alt={atleta.apelido}
                          className="w-8 h-8 rounded-full object-cover bg-muted"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '/placeholder.svg';
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground text-sm truncate">
                            {atleta.apelido}
                          </p>
                          {clube && (
                            <div className="flex items-center gap-1">
                              <ClubeEscudo clube={clube} size="sm" />
                            </div>
                          )}
                        </div>
                        <span className="font-black text-primary">
                          {atleta.media_num.toFixed(2)}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
