import { useState } from 'react';
import { ClubeEscudo } from '@/components/ClubeEscudo';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useMercado, POSICOES } from '@/hooks/useCartolaData';
import { AlertCircle, X, ChevronRight, Target } from 'lucide-react';
import { CartolaClube } from '@/lib/cartola-api';

export function BatedoresView() {
  const [selectedClube, setSelectedClube] = useState<CartolaClube | null>(null);
  const { data: mercadoData, isLoading, error } = useMercado();

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
  const atletas = mercadoData?.atletas || [];

  // Batedores potenciais do clube (atacantes e meias com boa média)
  const batedoresPotenciais = selectedClube 
    ? atletas
        .filter(a => a.clube_id === selectedClube.id && (a.posicao_id === 4 || a.posicao_id === 5))
        .sort((a, b) => b.media_num - a.media_num)
        .slice(0, 5)
    : [];

  return (
    <div className="animate-fade-in">
      <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-2">
        🎯 Batedores por Clube
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
              Clique em um time para ver os batedores de falta e pênalti
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
              <span className="font-bold text-xl">{selectedClube.nome} - Batedores</span>
            </div>

            {batedoresPotenciais.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                Nenhum batedor encontrado para este time.
              </div>
            ) : (
              <>
                <div className="p-4 bg-muted/30 border-b border-border">
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Target className="w-4 h-4" />
                    Principais cobradores (baseado em média e posição)
                  </p>
                </div>
                <div className="divide-y divide-border">
                  {batedoresPotenciais.map((atleta, idx) => {
                    const posicaoInfo = POSICOES[atleta.posicao_id];
                    
                    return (
                      <div key={atleta.atleta_id} className="flex items-center gap-4 p-4 hover:bg-muted/30">
                        <span className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                          {idx + 1}º
                        </span>
                        <img 
                          src={atleta.foto?.replace('FORMATO', '80x80')} 
                          alt={atleta.apelido}
                          className="w-12 h-12 rounded-full object-cover bg-muted"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '/placeholder.svg';
                          }}
                        />
                        <div className="flex-1">
                          <p className="font-bold text-foreground">{atleta.apelido}</p>
                          <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs font-bold">
                            {posicaoInfo?.nome}
                          </span>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-primary text-lg">{atleta.media_num.toFixed(2)}</p>
                          <p className="text-sm text-muted-foreground">média</p>
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
