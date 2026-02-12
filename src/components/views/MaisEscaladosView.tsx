import { useMemo, useState } from 'react';
import { ClubeEscudo } from '@/components/ClubeEscudo';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useDestaques, useMercado, POSICOES } from '@/hooks/useCartolaData';
import { AlertCircle, Crown } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

export function MaisEscaladosView() {
  const { data: destaquesData, isLoading: loadingDestaques, error } = useDestaques();
  const { data: mercadoData, isLoading: loadingMercado } = useMercado();

  const isLoading = loadingDestaques || loadingMercado;
  const clubes = mercadoData?.clubes || {};

  // The destaques API returns different structures - normalize
  const { populares, capitaes } = useMemo(() => {
    if (!destaquesData) return { populares: [], capitaes: [] };

    // The Cartola destaques endpoint returns arrays directly or nested
    const raw = destaquesData;
    
    // Try to extract populares
    let populares: any[] = [];
    let capitaes: any[] = [];

    if (Array.isArray(raw)) {
      // If the API returns a flat array, treat as populares
      populares = raw.slice(0, 15);
    } else if (raw.atletas_populares) {
      populares = raw.atletas_populares?.slice(0, 15) || [];
      capitaes = raw.capitaes?.slice(0, 5) || [];
    } else if (raw.Pilotos || raw.populares) {
      populares = (raw.populares || []).slice(0, 15);
      capitaes = (raw.capitaes || []).slice(0, 5);
    }

    // If no capitaes from API, derive from mercado (top by escalações)
    if (capitaes.length === 0 && mercadoData?.atletas) {
      // Use mercado atletas sorted by a heuristic
      const sorted = [...mercadoData.atletas].sort((a, b) => b.media_num - a.media_num);
      capitaes = sorted.slice(0, 5).map(a => ({
        atleta_id: a.atleta_id,
        apelido: a.apelido,
        foto: a.foto,
        posicao_id: a.posicao_id,
        clube_id: a.clube_id,
        escalacoes: 0,
      }));
    }

    return { populares, capitaes };
  }, [destaquesData, mercadoData]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" text="Carregando mais escalados..." />
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
      <Tabs defaultValue="populares" className="w-full">
        <TabsList className="w-full max-w-md bg-primary/20 mb-4">
          <TabsTrigger value="populares" className="flex-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-bold">
            🔥 Atletas Populares
          </TabsTrigger>
          <TabsTrigger value="capitaes" className="flex-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-bold">
            👑 Top Capitães
          </TabsTrigger>
        </TabsList>

        <TabsContent value="populares">
          <div className="bg-card rounded-xl overflow-hidden shadow-lg">
            <div className="bg-primary p-3 text-center font-bold uppercase text-primary-foreground">
              🔥 Top 15 Mais Escalados da Rodada
            </div>
            <div>
              {populares.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  Dados de escalação ainda não disponíveis para esta rodada
                </div>
              ) : (
                populares.map((atleta: any, idx: number) => {
                  const clube = clubes[atleta.clube_id];
                  const posicao = POSICOES[atleta.posicao_id];

                  return (
                    <div
                      key={atleta.atleta_id || idx}
                      className={cn(
                        'flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors',
                        idx < populares.length - 1 && 'border-b border-border'
                      )}
                    >
                      <span className="text-muted-foreground font-bold w-6 text-center text-sm">
                        {idx + 1}º
                      </span>
                      <div className="relative">
                        <img
                          src={atleta.foto?.replace('FORMATO', '50x50')}
                          alt={atleta.apelido}
                          className="w-10 h-10 rounded-full object-cover bg-muted"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '/placeholder.svg';
                          }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-foreground truncate">{atleta.apelido}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {posicao && (
                            <span className="bg-muted px-1.5 py-0.5 rounded font-bold">
                              {posicao.abreviacao}
                            </span>
                          )}
                          {clube && <ClubeEscudo clube={clube} size="xs" showName />}
                        </div>
                      </div>
                      <div className="text-right">
                        {atleta.escalacoes > 0 && (
                          <p className="font-black text-primary text-sm">
                            {atleta.escalacoes?.toLocaleString()}
                          </p>
                        )}
                        {atleta.porcentagem > 0 && (
                          <p className="text-xs text-muted-foreground">
                            {atleta.porcentagem?.toFixed(1)}%
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="capitaes">
          <div className="bg-card rounded-xl overflow-hidden shadow-lg">
            <div className="bg-primary p-3 text-center font-bold uppercase text-primary-foreground">
              👑 Top 5 Capitães Mais Escalados
            </div>
            <div>
              {capitaes.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  Dados de capitães ainda não disponíveis para esta rodada
                </div>
              ) : (
                capitaes.map((atleta: any, idx: number) => {
                  const clube = clubes[atleta.clube_id];
                  const posicao = POSICOES[atleta.posicao_id];

                  return (
                    <div
                      key={atleta.atleta_id || idx}
                      className={cn(
                        'flex items-center gap-3 px-4 py-4 hover:bg-muted/30 transition-colors',
                        idx < capitaes.length - 1 && 'border-b border-border'
                      )}
                    >
                      <span className="text-muted-foreground font-bold w-6 text-center text-sm">
                        {idx + 1}º
                      </span>
                      <div className="relative">
                        <img
                          src={atleta.foto?.replace('FORMATO', '50x50')}
                          alt={atleta.apelido}
                          className="w-10 h-10 rounded-full object-cover bg-muted"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '/placeholder.svg';
                          }}
                        />
                        {/* Captain badge */}
                        <div className="absolute -top-1 -right-1 bg-yellow-500 text-black rounded-full w-5 h-5 flex items-center justify-center text-xs font-black shadow-md">
                          C
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-foreground truncate">{atleta.apelido}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {posicao && (
                            <span className="bg-muted px-1.5 py-0.5 rounded font-bold">
                              {posicao.abreviacao}
                            </span>
                          )}
                          {clube && <ClubeEscudo clube={clube} size="xs" showName />}
                        </div>
                      </div>
                      <div className="text-right flex items-center gap-2">
                        <Crown className="w-4 h-4 text-yellow-500" />
                        {atleta.escalacoes > 0 && (
                          <div>
                            <p className="font-black text-primary text-sm">
                              {atleta.escalacoes?.toLocaleString()}
                            </p>
                            {atleta.porcentagem > 0 && (
                              <p className="text-xs text-muted-foreground">
                                {atleta.porcentagem?.toFixed(1)}%
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
