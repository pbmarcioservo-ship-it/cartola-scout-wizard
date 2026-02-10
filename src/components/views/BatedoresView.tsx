import { useState, useMemo } from 'react';
import { ClubeEscudo } from '@/components/ClubeEscudo';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useRodada, useHistoricoRodadas, useMercado, POSICOES } from '@/hooks/useCartolaData';
import { AlertCircle, X, ChevronRight, Target } from 'lucide-react';
import { CartolaClube } from '@/lib/cartola-api';

export function BatedoresView() {
  const [selectedClube, setSelectedClube] = useState<CartolaClube | null>(null);
  const { data: mercadoData, isLoading: loadingMercado, error } = useMercado();
  const { data: rodadaData } = useRodada();
  const { data: historico, isLoading: loadingHistorico } = useHistoricoRodadas(rodadaData?.rodada_atual, 7);

  const isLoading = loadingMercado || loadingHistorico;

  // Find players who actually took penalties (have PP or G from penalty context)
  // We look for players with DP (defended penalty as goalkeeper) or who scored penalties
  // The most reliable: look for PP (penalty missed) or check historical scouts
  const batedoresPorClube = useMemo(() => {
    if (!historico) return {} as Record<number, Array<{ id: string; apelido: string; foto: string; clube_id: number; posicao_id: number; penaltis: number; gols: number; perdidos: number }>>;

    const map: Record<number, Record<string, { id: string; apelido: string; foto: string; clube_id: number; posicao_id: number; penaltis: number; gols: number; perdidos: number }>> = {};

    for (const h of historico) {
      if (!h.data?.atletas) continue;
      for (const [id, data] of Object.entries(h.data.atletas)) {
        // A player who took a penalty either scored (hard to distinguish from regular goals)
        // or missed (PP scout). We can also check DP from goalkeeper perspective.
        // Best indicator: PP (penalty missed) means they took one
        // For scored penalties, we don't have a specific scout, but PP > 0 means they take penalties
        const pp = (data.scout?.PP as number) || 0;
        // Also check if they're known penalty takers from mercado data
        if (pp > 0) {
          if (!map[data.clube_id]) map[data.clube_id] = {};
          if (!map[data.clube_id][id]) {
            map[data.clube_id][id] = {
              id, apelido: data.apelido, foto: data.foto,
              clube_id: data.clube_id, posicao_id: data.posicao_id,
              penaltis: 0, gols: 0, perdidos: 0,
            };
          }
          map[data.clube_id][id].perdidos += pp;
          map[data.clube_id][id].penaltis += pp;
        }
      }
    }

    // Also check mercado data for PP scouts
    if (mercadoData?.atletas) {
      for (const atleta of mercadoData.atletas) {
        const pp = (atleta.scout?.PP as number) || 0;
        if (pp > 0) {
          if (!map[atleta.clube_id]) map[atleta.clube_id] = {};
          if (!map[atleta.clube_id][String(atleta.atleta_id)]) {
            map[atleta.clube_id][String(atleta.atleta_id)] = {
              id: String(atleta.atleta_id), apelido: atleta.apelido, foto: atleta.foto,
              clube_id: atleta.clube_id, posicao_id: atleta.posicao_id,
              penaltis: pp, gols: 0, perdidos: pp,
            };
          }
        }
      }
    }

    const result: Record<number, typeof map[number][string][]> = {};
    for (const [clubeId, players] of Object.entries(map)) {
      result[Number(clubeId)] = Object.values(players).sort((a, b) => b.penaltis - a.penaltis);
    }
    return result;
  }, [historico, mercadoData]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" text="Carregando batedores..." />
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

  const clubes = Object.values(mercadoData?.clubes || {});
  const batedores = selectedClube ? (batedoresPorClube[selectedClube.id] || []) : [];

  return (
    <div className="animate-fade-in">
      <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-2">
        🎯 Batedores de Pênalti
      </h2>

      {!selectedClube ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {clubes.map((clube, index) => {
              const count = batedoresPorClube[clube.id]?.length || 0;
              return (
                <button
                  key={clube.id}
                  onClick={() => setSelectedClube(clube)}
                  className="bg-card border border-border p-4 rounded-xl text-center hover:border-primary hover:bg-primary/5 transition-all duration-200 cursor-pointer group animate-slide-in"
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  <div className="flex justify-center mb-2">
                    <ClubeEscudo clube={clube} size="lg" />
                  </div>
                  <span className="font-bold text-foreground group-hover:text-primary transition-colors text-sm">
                    {clube.abreviacao}
                  </span>
                  {count > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">{count} batedor(es)</p>
                  )}
                  <ChevronRight className="w-4 h-4 mx-auto mt-1 text-muted-foreground group-hover:text-primary transition-colors" />
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <div className="animate-fade-in">
          <button
            onClick={() => setSelectedClube(null)}
            className="flex items-center gap-2 text-primary hover:underline mb-6"
          >
            <X className="w-4 h-4" />
            Voltar para todos os times
          </button>

          <div className="bg-card rounded-lg shadow-lg overflow-hidden">
            <div className="bg-primary text-primary-foreground p-4 flex items-center justify-center gap-3">
              <ClubeEscudo clube={selectedClube} size="lg" />
              <span className="font-bold text-xl">{selectedClube.nome} - Batedores de Pênalti</span>
            </div>

            {batedores.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                Nenhum jogador deste time bateu pênalti até o momento nesta temporada.
              </div>
            ) : (
              <>
                <div className="p-4 bg-muted/30 border-b border-border">
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Target className="w-4 h-4" />
                    Jogadores que bateram pênalti (dados reais do Cartola)
                  </p>
                </div>
                <div className="divide-y divide-border">
                  {batedores.map((atleta, idx) => {
                    const posicaoInfo = POSICOES[atleta.posicao_id];
                    return (
                      <div key={atleta.id} className="flex items-center gap-4 p-4 hover:bg-muted/30">
                        <span className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                          {idx + 1}º
                        </span>
                        <img
                          src={atleta.foto?.replace('FORMATO', '80x80')}
                          alt={atleta.apelido}
                          className="w-12 h-12 rounded-full object-cover bg-muted"
                          onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }}
                        />
                        <div className="flex-1">
                          <p className="font-bold text-foreground">{atleta.apelido}</p>
                          <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs font-bold">
                            {posicaoInfo?.nome}
                          </span>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-destructive text-lg">{atleta.perdidos} PP</p>
                          <p className="text-sm text-muted-foreground">pênaltis perdidos</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
