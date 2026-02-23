import { useState } from 'react';
import { ClubeEscudo } from '@/components/ClubeEscudo';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useMercado, STATUS_ATLETA, POSICOES } from '@/hooks/useCartolaData';
import { AlertCircle, X, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
const LS_KEY_LATERAL = 'statusfc_lateral_side_by_id';
function getLateralSideFromStore(atletaId: number): 'LD' | 'LE' | null {
  try {
    const raw = localStorage.getItem(LS_KEY_LATERAL);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, 'LD' | 'LE'>;
    return map[String(atletaId)] || null;
  } catch {
    return null;
  }
}
import { CartolaClube, CartolaAtleta } from '@/lib/cartola-api';

export function ProvaveisView() {
  const [selectedClube, setSelectedClube] = useState<CartolaClube | null>(null);
  const { data: mercadoData, isLoading, error } = useMercado();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" text="Carregando prováveis..." />
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
  const atletas = mercadoData?.atletas || [];

  // Atletas prováveis do clube selecionado
  const atletasProvaveis = selectedClube 
    ? atletas
        .filter(a => a.clube_id === selectedClube.id && a.status_id === 7)
        .sort((a, b) => a.posicao_id - b.posicao_id)
    : [];

  return (
    <div className="animate-fade-in">
      <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-2">
        🏃 Prováveis da Rodada
      </h2>
      
      {!selectedClube ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {clubes.map((clube, index) => (
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
                <ChevronRight className="w-4 h-4 mx-auto mt-1 text-muted-foreground group-hover:text-primary transition-colors" />
              </button>
            ))}
          </div>
          
          <div className="mt-8 bg-card p-6 rounded-lg shadow-lg text-center">
            <p className="text-muted-foreground">
              Clique em um time para ver a escalação provável
            </p>
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
              <span className="font-bold text-xl">{selectedClube.nome} - Prováveis</span>
            </div>

            {atletasProvaveis.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                Nenhum atleta com status "Provável" encontrado para este time.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {atletasProvaveis.map((atleta) => {
                  const posicaoInfo = POSICOES[atleta.posicao_id];
                  
                  return (
                    <div key={atleta.atleta_id} className="flex items-center gap-4 p-4 hover:bg-muted/30">
                      <img 
                        src={atleta.foto?.replace('FORMATO', '80x80')} 
                        alt={atleta.apelido}
                        className="w-12 h-12 rounded-full object-cover bg-muted"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/placeholder.svg';
                        }}
                      />
                      <div className="flex-1">
                        <p className="font-bold text-foreground">
                          {atleta.apelido}
                          {atleta.posicao_id === 2 && (() => {
                            const side = getLateralSideFromStore(atleta.atleta_id);
                            return side ? <span className="ml-1 text-[11px] text-muted-foreground">({side})</span> : null;
                          })()}
                        </p>
                        <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs font-bold">
                          {posicaoInfo?.nome}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-foreground">C$ {atleta.preco_num.toFixed(2)}</p>
                        <p className="text-sm text-muted-foreground">Média: {atleta.media_num.toFixed(2)}</p>
                      </div>
                      <span 
                        className="px-3 py-1 rounded text-xs font-bold text-white"
                        style={{ backgroundColor: '#27ae60' }}
                      >
                        Provável
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
