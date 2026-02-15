import { useState, useMemo } from 'react';
import { FilterBar } from '@/components/FilterBar';
import { ClubeEscudo } from '@/components/ClubeEscudo';
import { ProgressBar } from '@/components/ProgressBar';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { usePartidas, useRodada, useHistoricoRodadas, POSICOES } from '@/hooks/useCartolaData';
import { PosicaoFilter, ScoutFilter } from '@/types/cartola';
import { AlertCircle } from 'lucide-react';
import { CartolaClube, CartolaPartida, CartolaScout } from '@/lib/cartola-api';

const SCOUT_KEY_MAP: Record<ScoutFilter, keyof CartolaScout> = {
  gols: 'G',
  assistencias: 'A',
  desarmes: 'DS',
  finalizacaoDefendida: 'FD',
  finalizacaoFora: 'FF',
  finalizacaoTrave: 'FT',
  defesas: 'DE',
  defesaPenalti: 'DP',
  semGol: 'SG',
  roubadaBola: 'RB',
  faltaSofrida: 'FS',
  passeCerto: 'PS',
  cartaoAmarelo: 'CA',
  cartaoVermelho: 'CV',
  faltaCometida: 'FC',
  golContra: 'GC',
  penaltiPerdido: 'PP',
  impedimento: 'I',
  passeErrado: 'PE',
  golSofrido: 'GS',
};

const POSICAO_ID_MAP: Record<string, number> = {
  goleiro: 1, lateral: 2, zagueiro: 3, meia: 4, atacante: 5, tecnico: 6,
};

export function CruzamentoView() {
  const [mando, setMando] = useState('casa_fora');
  const [ultimas, setUltimas] = useState(3);
  const [posicao, setPosicao] = useState<PosicaoFilter>('todos');
  const [scout, setScout] = useState<ScoutFilter>('desarmes');

  const { data: rodadaData } = useRodada();
  const { data: partidasData, isLoading: loadingPartidas, error: errorPartidas } = usePartidas();
  const { data: historico, isLoading: loadingHistorico } = useHistoricoRodadas(rodadaData?.rodada_atual, ultimas);

  const isLoading = loadingPartidas || loadingHistorico;
  const scoutKey = SCOUT_KEY_MAP[scout];
  const posicaoId = posicao !== 'todos' ? POSICAO_ID_MAP[posicao] : undefined;

  // Calculate absolute scout stats per club from historical data
  const statsPerClub = useMemo(() => {
    if (!historico || historico.length === 0) return { conquista: {} as Record<number, number>, cede: {} as Record<number, number> };

    const conquista: Record<number, number> = {};
    const cede: Record<number, number> = {};

    for (const h of historico) {
      if (!h.data?.atletas || !h.partidas?.partidas) continue;

      for (const [, atletaData] of Object.entries(h.data.atletas)) {
        // Filter by position if set
        if (posicaoId && atletaData.posicao_id !== posicaoId) continue;

        const val = (atletaData.scout?.[scoutKey] as number) || 0;
        if (val <= 0) continue;

        const clubeId = atletaData.clube_id;
        // Find this player's match
        const partida = h.partidas!.partidas.find(
          (p: CartolaPartida) => p.clube_casa_id === clubeId || p.clube_visitante_id === clubeId
        );
        if (!partida) continue;

        // Filter by mando
        const isHome = partida.clube_casa_id === clubeId;
        if (mando === 'casa_fora') {
          // no mando filter in casa_fora mode for conquista — will be split in the table
        }

        // Conquista: this club's players earned this scout
        conquista[clubeId] = (conquista[clubeId] || 0) + val;

        // Cede: the opponent allowed this scout
        const opponentId = isHome ? partida.clube_visitante_id : partida.clube_casa_id;
        cede[opponentId] = (cede[opponentId] || 0) + val;
      }
    }

    return { conquista, cede };
  }, [historico, scoutKey, posicaoId, mando]);

  // Calculate home/away specific stats
  const statsPerClubByMando = useMemo(() => {
    if (!historico || historico.length === 0 || mando === 'todos') return null;

    const conquistaCasa: Record<number, number> = {};
    const cedeFora: Record<number, number> = {};
    const conquistaFora: Record<number, number> = {};
    const cedeCasa: Record<number, number> = {};

    for (const h of historico) {
      if (!h.data?.atletas || !h.partidas?.partidas) continue;

      for (const [, atletaData] of Object.entries(h.data.atletas)) {
        if (posicaoId && atletaData.posicao_id !== posicaoId) continue;

        const val = (atletaData.scout?.[scoutKey] as number) || 0;
        if (val <= 0) continue;

        const clubeId = atletaData.clube_id;
        const partida = h.partidas!.partidas.find(
          (p: CartolaPartida) => p.clube_casa_id === clubeId || p.clube_visitante_id === clubeId
        );
        if (!partida) continue;

        const isHome = partida.clube_casa_id === clubeId;
        const opponentId = isHome ? partida.clube_visitante_id : partida.clube_casa_id;

        if (isHome) {
          conquistaCasa[clubeId] = (conquistaCasa[clubeId] || 0) + val;
          cedeFora[opponentId] = (cedeFora[opponentId] || 0) + val;
        } else {
          conquistaFora[clubeId] = (conquistaFora[clubeId] || 0) + val;
          cedeCasa[opponentId] = (cedeCasa[opponentId] || 0) + val;
        }
      }
    }

    return { conquistaCasa, cedeFora, conquistaFora, cedeCasa };
  }, [historico, scoutKey, posicaoId, mando]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" text="Carregando dados do Cartola..." />
      </div>
    );
  }

  if (errorPartidas) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-destructive gap-3">
        <AlertCircle className="w-12 h-12" />
        <p className="font-bold">Erro ao carregar dados</p>
        <p className="text-sm text-muted-foreground">{(errorPartidas as Error).message}</p>
      </div>
    );
  }

  const partidas = partidasData?.partidas || [];
  const clubes = partidasData?.clubes || {};
  const posicaoLabel = posicao !== 'todos' ? POSICOES[POSICAO_ID_MAP[posicao]]?.nome : 'Todas posições';
  const scoutLabel = scout.charAt(0).toUpperCase() + scout.slice(1);

  // Find max values for bar scaling
  const allConquista = mando === 'casa_fora' && statsPerClubByMando
    ? Object.values(statsPerClubByMando.conquistaCasa).concat(Object.values(statsPerClubByMando.conquistaFora))
    : Object.values(statsPerClub.conquista);
  const allCede = mando === 'casa_fora' && statsPerClubByMando
    ? Object.values(statsPerClubByMando.cedeFora).concat(Object.values(statsPerClubByMando.cedeCasa))
    : Object.values(statsPerClub.cede);
  const maxVal = Math.max(...allConquista, ...allCede, 1);

  return (
    <div className="animate-fade-in">
      <FilterBar
        showMandoFilter
        showUltimasFilter
        showPosicaoFilter
        showScoutFilter
        mando={mando}
        onMandoChange={setMando}
        ultimas={ultimas}
        onUltimasChange={setUltimas}
        posicao={posicao}
        onPosicaoChange={setPosicao}
        scout={scout}
        onScoutChange={setScout}
      />

      {/* Tabela Mandantes */}
      <div className="mb-8">
        <div className="bg-primary text-primary-foreground p-3 font-bold text-center rounded-t-lg text-sm">
          📊 MANDANTE CONQUISTA ({scoutLabel} - {posicaoLabel}) vs VISITANTE CEDE — Últimas {ultimas} rodadas
        </div>
        <table className="w-full bg-card shadow-lg rounded-b-lg overflow-hidden">
          <tbody>
            {partidas.map((partida) => {
              const clubeCasa = clubes[partida.clube_casa_id];
              const clubeVisitante = clubes[partida.clube_visitante_id];
              if (!clubeCasa || !clubeVisitante) return null;

              const conquistaVal = mando === 'casa_fora' && statsPerClubByMando
                ? (statsPerClubByMando.conquistaCasa[partida.clube_casa_id] || 0)
                : (statsPerClub.conquista[partida.clube_casa_id] || 0);
              const cedeVal = mando === 'casa_fora' && statsPerClubByMando
                ? (statsPerClubByMando.cedeFora[partida.clube_visitante_id] || 0)
                : (statsPerClub.cede[partida.clube_visitante_id] || 0);

              return (
                <tr key={partida.partida_id} className="border-b border-border hover:bg-muted/30 transition-colors">
                  <td className="w-[15%] text-right pr-2 font-black text-success text-sm py-3">
                    {conquistaVal}
                  </td>
                  <td className="w-[25%]">
                    <ProgressBar value={conquistaVal} maxValue={maxVal} color="success" reverse />
                  </td>
                  <td className="w-[20%] text-center py-3 bg-muted/20 border-x border-border">
                    <div className="flex items-center justify-center gap-2">
                      <ClubeEscudo clube={clubeCasa} size="sm" />
                      <span className="font-black text-xs">
                        {clubeCasa.abreviacao} x {clubeVisitante.abreviacao}
                      </span>
                      <ClubeEscudo clube={clubeVisitante} size="sm" />
                    </div>
                  </td>
                  <td className="w-[25%]">
                    <ProgressBar value={cedeVal} maxValue={maxVal} color="destructive" />
                  </td>
                  <td className="w-[15%] text-left pl-2 font-black text-destructive text-sm py-3">
                    {cedeVal}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Tabela Visitantes - Mandante CEDE (vermelho esquerda) vs Visitante CONQUISTA (verde direita) */}
      <div>
        <div className="bg-secondary text-secondary-foreground p-3 font-bold text-center rounded-t-lg text-sm">
          📊 MANDANTE CEDE ({scoutLabel} - {posicaoLabel}) vs VISITANTE CONQUISTA — Últimas {ultimas} rodadas
        </div>
        <table className="w-full bg-card shadow-lg rounded-b-lg overflow-hidden">
          <tbody>
            {partidas.map((partida) => {
              const clubeCasa = clubes[partida.clube_casa_id];
              const clubeVisitante = clubes[partida.clube_visitante_id];
              if (!clubeCasa || !clubeVisitante) return null;

              const cedeVal = mando === 'casa_fora' && statsPerClubByMando
                ? (statsPerClubByMando.cedeCasa[partida.clube_casa_id] || 0)
                : (statsPerClub.cede[partida.clube_casa_id] || 0);
              const conquistaVal = mando === 'casa_fora' && statsPerClubByMando
                ? (statsPerClubByMando.conquistaFora[partida.clube_visitante_id] || 0)
                : (statsPerClub.conquista[partida.clube_visitante_id] || 0);

              return (
                <tr key={partida.partida_id} className="border-b border-border hover:bg-muted/30 transition-colors">
                  <td className="w-[15%] text-right pr-2 font-black text-destructive text-sm py-3">
                    {cedeVal}
                  </td>
                  <td className="w-[25%]">
                    <ProgressBar value={cedeVal} maxValue={maxVal} color="destructive" reverse />
                  </td>
                  <td className="w-[20%] text-center py-3 bg-muted/20 border-x border-border">
                    <div className="flex items-center justify-center gap-2">
                      <ClubeEscudo clube={clubeCasa} size="sm" />
                      <span className="font-black text-xs">
                        {clubeCasa.abreviacao} x {clubeVisitante.abreviacao}
                      </span>
                      <ClubeEscudo clube={clubeVisitante} size="sm" />
                    </div>
                  </td>
                  <td className="w-[25%]">
                    <ProgressBar value={conquistaVal} maxValue={maxVal} color="success" />
                  </td>
                  <td className="w-[15%] text-left pl-2 font-black text-success text-sm py-3">
                    {conquistaVal}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
