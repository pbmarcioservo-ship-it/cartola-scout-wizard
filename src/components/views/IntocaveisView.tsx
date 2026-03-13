import { useState, useMemo } from 'react';
import { ClubeEscudo } from '@/components/ClubeEscudo';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { PlayerDetailModal } from '@/components/PlayerDetailModal';
import { useMercado, useRodada, useHistoricoRodadas, POSICOES } from '@/hooks/useCartolaData';
import { AlertCircle, Shield } from 'lucide-react';
import { CartolaAtleta, CartolaClube } from '@/lib/cartola-api';
import { PosicaoFilter } from '@/types/cartola';
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

export function IntocaveisView() {
  const [selectedAtleta, setSelectedAtleta] = useState<CartolaAtleta | null>(null);
  const [time, setTime] = useState('todos');
  const [posicao, setPosicao] = useState<PosicaoFilter>('todos');
  const [search, setSearch] = useState('');
  const [rodadaInicio, setRodadaInicio] = useState(1);
  const [rodadaFim, setRodadaFim] = useState(38);

  const { data: mercadoData, isLoading: loadingMercado, error: errorMercado } = useMercado();
  const { data: rodadaData } = useRodada();
  const rodadaAtual = rodadaData?.rodada_atual;

  // Fetch historical data
  const { data: historicoData, isLoading: loadingHistorico } = useHistoricoRodadas(rodadaAtual, rodadaAtual ? rodadaAtual - 1 : 0);

  const clubes = useMemo(() => Object.values(mercadoData?.clubes || {}).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')), [mercadoData]);

  // Build per-athlete stats from historical rounds
  const atletaStats = useMemo(() => {
    if (!historicoData || !mercadoData) return {};

    const stats: Record<number, {
      jogos: number;
      totalPontos: number;
      jogosCasa: number;
      totalPontosCasa: number;
      jogosFora: number;
      totalPontosFora: number;
    }> = {};

    for (const rodadaInfo of historicoData) {
      if (!rodadaInfo.data?.atletas || !rodadaInfo.partidas?.partidas) continue;
      
      const rodadaNum = rodadaInfo.rodada;
      if (rodadaNum < rodadaInicio || rodadaNum > rodadaFim) continue;

      const partidas = rodadaInfo.partidas.partidas;

      for (const [atletaId, atletaData] of Object.entries(rodadaInfo.data.atletas)) {
        const id = Number(atletaId);
        const clubeId = atletaData.clube_id;

        // Determine if home or away
        const partida = partidas.find(
          p => p.clube_casa_id === clubeId || p.clube_visitante_id === clubeId
        );
        if (!partida) continue;

        const isHome = partida.clube_casa_id === clubeId;

        if (!stats[id]) {
          stats[id] = { jogos: 0, totalPontos: 0, jogosCasa: 0, totalPontosCasa: 0, jogosFora: 0, totalPontosFora: 0 };
        }

        stats[id].jogos++;
        stats[id].totalPontos += atletaData.pontuacao;
        if (isHome) {
          stats[id].jogosCasa++;
          stats[id].totalPontosCasa += atletaData.pontuacao;
        } else {
          stats[id].jogosFora++;
          stats[id].totalPontosFora += atletaData.pontuacao;
        }
      }
    }

    return stats;
  }, [historicoData, mercadoData, rodadaInicio, rodadaFim]);

  // Filter and group athletes
  const intocaveis = useMemo(() => {
    if (!mercadoData) return [];

    const atletas = mercadoData.atletas.filter(a => a.status_id === 7); // Prováveis only

    // Apply filters
    let filtered = atletas;

    if (time !== 'todos') {
      filtered = filtered.filter(a => a.clube_id === Number(time));
    }

    const posicaoMap: Record<string, number> = {
      goleiro: 1, lateral: 2, zagueiro: 3, meia: 4, atacante: 5, tecnico: 6
    };
    if (posicao !== 'todos') {
      filtered = filtered.filter(a => a.posicao_id === posicaoMap[posicao]);
    }

    if (search.trim()) {
      const s = search.toLowerCase();
      filtered = filtered.filter(a => a.apelido.toLowerCase().includes(s) || a.nome.toLowerCase().includes(s));
    }

    // Group by club + position, keep max per position (GK: 1, others: 3)
    const grouped: Record<string, CartolaAtleta[]> = {};
    for (const a of filtered) {
      const key = `${a.clube_id}-${a.posicao_id}`;
      if (!grouped[key]) grouped[key] = [];
      const maxPerPos = a.posicao_id === 1 ? 1 : 3;
      if (grouped[key].length < maxPerPos) {
        grouped[key].push(a);
      }
    }

    const result = Object.values(grouped).flat();

    // Sort by number of games (descending), then by average points (descending) as tiebreaker
    return result.sort((a, b) => {
      // Primary criterion: most games played in the season (jogos_num from API)
      if (b.jogos_num !== a.jogos_num) {
        return b.jogos_num - a.jogos_num;
      }

      // Tiebreaker: highest average points
      const statsA = atletaStats[a.atleta_id];
      const statsB = atletaStats[b.atleta_id];
      const mediaA = statsA && statsA.jogos > 0 ? statsA.totalPontos / statsA.jogos : a.media_num;
      const mediaB = statsB && statsB.jogos > 0 ? statsB.totalPontos / statsB.jogos : b.media_num;
      return mediaB - mediaA;
    });
  }, [mercadoData, time, posicao, search, atletaStats]);

  const getAtletaDisplayStats = (atleta: CartolaAtleta) => {
    const stats = atletaStats[atleta.atleta_id];
    if (!stats || stats.jogos === 0) {
      return {
        jogos: atleta.jogos_num,
        media: atleta.media_num,
        total: atleta.pontos_num * (atleta.jogos_num || 1),
        minutos: atleta.gato_mestre?.minutos_jogados || 0,
      };
    }

    return {
      jogos: stats.jogos,
      media: stats.totalPontos / stats.jogos,
      total: stats.totalPontos,
      minutos: atleta.gato_mestre?.minutos_jogados || 0,
    };
  };

  const isLoading = loadingMercado || loadingHistorico;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" text="Carregando intocáveis..." />
      </div>
    );
  }

  if (errorMercado) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-destructive gap-3">
        <AlertCircle className="w-12 h-12" />
        <p className="font-bold">Erro ao carregar dados</p>
      </div>
    );
  }

  const maxTotal = Math.max(...intocaveis.map(a => getAtletaDisplayStats(a).total), 1);

  return (
    <div className="animate-fade-in">
      <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-2">
        <Shield className="w-7 h-7 text-primary" />
        TOP INTOCÁVEIS
      </h2>

      {/* Filters - sticky + compact on mobile */}
      <div className="flex flex-wrap gap-3 bg-card p-4 rounded-lg mb-5 shadow-md sticky top-0 z-50 max-md:gap-1.5 max-md:p-2 max-md:mb-2 max-md:rounded-none max-md:shadow-sm">
        <select
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="bg-primary text-primary-foreground border-none px-4 py-2.5 rounded-md font-bold min-w-[120px] cursor-pointer max-md:px-2 max-md:py-1.5 max-md:text-[11px] max-md:min-w-0 max-md:flex-1 max-md:rounded-sm"
        >
          <option value="todos">Todos os Times</option>
          {clubes.map(c => (
            <option key={c.id} value={c.id}>{c.nome}</option>
          ))}
        </select>

        <select
          value={posicao}
          onChange={(e) => setPosicao(e.target.value as PosicaoFilter)}
          className="bg-primary text-primary-foreground border-none px-4 py-2.5 rounded-md font-bold min-w-[120px] cursor-pointer max-md:px-2 max-md:py-1.5 max-md:text-[11px] max-md:min-w-0 max-md:flex-1 max-md:rounded-sm"
        >
          <option value="todos">Todas Posições</option>
          <option value="goleiro">Goleiro</option>
          <option value="lateral">Lateral</option>
          <option value="zagueiro">Zagueiro</option>
          <option value="meia">Meia</option>
          <option value="atacante">Atacante</option>
          <option value="tecnico">Técnico</option>
        </select>

        <input
          type="text"
          placeholder="Buscar Atleta..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-primary text-primary-foreground border-none px-4 py-2.5 rounded-md font-bold min-w-[150px] placeholder:text-primary-foreground/70 max-md:px-2 max-md:py-1.5 max-md:text-[11px] max-md:min-w-0 max-md:flex-1 max-md:rounded-sm"
        />

        <div className="flex items-center gap-2 max-md:gap-1 max-md:w-full">
          <label className="text-sm text-muted-foreground font-bold max-md:text-[11px]">Rodadas:</label>
          <select
            value={rodadaInicio}
            onChange={(e) => setRodadaInicio(Number(e.target.value))}
            className="bg-primary text-primary-foreground border-none px-3 py-2.5 rounded-md font-bold cursor-pointer max-md:px-2 max-md:py-1.5 max-md:text-[11px] max-md:rounded-sm"
          >
            {Array.from({ length: 38 }, (_, i) => i + 1).map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <span className="text-muted-foreground font-bold max-md:text-[11px]">a</span>
          <select
            value={rodadaFim}
            onChange={(e) => setRodadaFim(Number(e.target.value))}
            className="bg-primary text-primary-foreground border-none px-3 py-2.5 rounded-md font-bold cursor-pointer max-md:px-2 max-md:py-1.5 max-md:text-[11px] max-md:rounded-sm"
          >
            {Array.from({ length: 38 }, (_, i) => i + 1).map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Results */}
      <div className="bg-card rounded-lg shadow-lg overflow-hidden">
        <div className="bg-primary/10 p-3 border-b border-border">
          <p className="text-sm text-muted-foreground">
            Máx. 3 por posição/time (1 goleiro) • Apenas Prováveis • 
            <span className="font-bold text-foreground ml-1">{intocaveis.length} atletas</span>
          </p>
        </div>

        <div className="divide-y divide-border">
          {intocaveis.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              Nenhum atleta encontrado com os filtros selecionados.
            </div>
          ) : (
            intocaveis.map((atleta, index) => {
              const clube = mercadoData?.clubes?.[String(atleta.clube_id)];
              const posInfo = POSICOES[atleta.posicao_id];
              const displayStats = getAtletaDisplayStats(atleta);
              const barWidth = maxTotal > 0 ? (displayStats.total / maxTotal) * 100 : 0;

              return (
                <div
                  key={atleta.atleta_id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors animate-slide-in cursor-pointer"
                  onClick={() => setSelectedAtleta(atleta)}
                  style={{ animationDelay: `${index * 20}ms` }}
                >
                  {/* Photo */}
                  <img
                    src={atleta.foto?.replace('FORMATO', '80x80')}
                    alt={atleta.apelido}
                    className="w-10 h-10 rounded-full object-cover bg-muted flex-shrink-0"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/placeholder.svg';
                    }}
                  />

                  {/* Name + Club shield */}
                  <div className="flex items-center gap-2 min-w-[160px] w-[160px]">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-foreground text-sm truncate">
                        {atleta.apelido}
                        {atleta.posicao_id === 2 && (() => {
                          const side = getLateralSideFromStore(atleta.atleta_id);
                          return side ? <span className="ml-1 text-[11px] text-muted-foreground">({side})</span> : null;
                        })()}
                      </p>
                      <span className="text-xs text-muted-foreground">{posInfo?.abreviacao}</span>
                    </div>
                    {clube && <ClubeEscudo clube={clube} size="xs" />}
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-4 text-xs flex-shrink-0">
                    <div className="text-center">
                      <p className="text-muted-foreground">Jogos</p>
                      <p className="font-black text-foreground">{displayStats.jogos}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-muted-foreground">Média Pontos</p>
                      <p className="font-black text-foreground">{displayStats.media.toFixed(1)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-muted-foreground">Pontos Totais</p>
                      <p className="font-black text-primary">{displayStats.total.toFixed(1)}</p>
                    </div>
                    {displayStats.minutos > 0 && (
                      <div className="text-center">
                        <p className="text-muted-foreground">Min</p>
                        <p className="font-black text-foreground">{Math.round(displayStats.minutos)}</p>
                      </div>
                    )}
                  </div>

                  {/* Bar */}
                  <div className="flex-1 ml-3">
                    <div className="h-3 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-500"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
      <PlayerDetailModal
        atleta={selectedAtleta}
        clube={selectedAtleta ? mercadoData?.clubes?.[String(selectedAtleta.clube_id)] : undefined}
        clubes={mercadoData?.clubes ? Object.fromEntries(Object.entries(mercadoData.clubes).map(([k, v]) => [Number(k), v])) : {}}
        open={!!selectedAtleta}
        onOpenChange={(open) => !open && setSelectedAtleta(null)}
      />
    </div>
  );
}
