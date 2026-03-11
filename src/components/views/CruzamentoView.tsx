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

/* ── Reusable match row ── */
function MatchRow({
  clubeLeft,
  clubeRight,
  leftVal,
  rightVal,
  leftColor,
  rightColor,
  maxVal,
}: {
  clubeLeft: CartolaClube;
  clubeRight: CartolaClube;
  leftVal: number;
  rightVal: number;
  leftColor: 'success' | 'destructive';
  rightColor: 'success' | 'destructive';
  maxVal: number;
}) {
  return (
    <div className="flex items-center gap-1 md:gap-1.5 px-2 md:px-3 py-3 md:py-3.5 hover:bg-muted/30 transition-colors">
      {/* Left bar + value */}
      <div className="flex-1 flex items-center justify-end gap-1.5 md:gap-2 min-w-0">
        <div className="flex-1 h-5 md:h-5 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ml-auto ${leftColor === 'success' ? 'bg-success' : 'bg-destructive'}`}
            style={{ width: `${Math.min((leftVal / maxVal) * 100, 100)}%` }}
          />
        </div>
        <span className={`font-black text-xs md:text-sm min-w-[20px] text-right ${leftColor === 'success' ? 'text-success' : 'text-destructive'}`}>
          {Math.round(leftVal)}
        </span>
      </div>

      {/* Center: teams side by side */}
      <div className="flex items-center justify-center gap-1 md:gap-2 shrink-0 px-1 md:px-3 bg-muted/20 rounded-md py-1">
        <ClubeEscudo clube={clubeLeft} size="sm" />
        <span className="font-black text-[10px] md:text-xs whitespace-nowrap">
          {clubeLeft.abreviacao} x {clubeRight.abreviacao}
        </span>
        <ClubeEscudo clube={clubeRight} size="sm" />
      </div>

      {/* Right bar + value */}
      <div className="flex-1 flex items-center justify-start gap-1.5 md:gap-2 min-w-0">
        <span className={`font-black text-xs md:text-sm min-w-[20px] text-left ${rightColor === 'success' ? 'text-success' : 'text-destructive'}`}>
          {Math.round(rightVal)}
        </span>
        <div className="flex-1 h-5 md:h-4 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${rightColor === 'success' ? 'bg-success' : 'bg-destructive'}`}
            style={{ width: `${Math.min((rightVal / maxVal) * 100, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

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
        if (posicaoId && atletaData.posicao_id !== posicaoId) continue;

        const val = (atletaData.scout?.[scoutKey] as number) || 0;
        if (val <= 0) continue;

        const clubeId = atletaData.clube_id;
        const partida = h.partidas!.partidas.find(
          (p: CartolaPartida) => p.clube_casa_id === clubeId || p.clube_visitante_id === clubeId
        );
        if (!partida) continue;

        const isHome = partida.clube_casa_id === clubeId;
        if (mando === 'casa_fora') {
          // no mando filter
        }

        conquista[clubeId] = (conquista[clubeId] || 0) + val;

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
      <div className="mb-6 md:mb-8">
        <div className="bg-primary text-primary-foreground p-2 md:p-3 font-bold text-center rounded-t-lg text-[11px] md:text-sm">
          📊 MANDANTE CONQUISTA ({scoutLabel} - {posicaoLabel}) vs VISITANTE CEDE — Últimas {ultimas} rodadas
        </div>
        <div className="bg-card shadow-lg rounded-b-lg overflow-hidden divide-y divide-border">
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
              <MatchRow
                key={partida.partida_id}
                clubeLeft={clubeCasa}
                clubeRight={clubeVisitante}
                leftVal={conquistaVal}
                rightVal={cedeVal}
                leftColor="success"
                rightColor="destructive"
                maxVal={maxVal}
              />
            );
          })}
        </div>
      </div>

      {/* Tabela Visitantes */}
      <div>
        <div className="bg-secondary text-secondary-foreground p-2 md:p-3 font-bold text-center rounded-t-lg text-[11px] md:text-sm">
          📊 MANDANTE CEDE ({scoutLabel} - {posicaoLabel}) vs VISITANTE CONQUISTA — Últimas {ultimas} rodadas
        </div>
        <div className="bg-card shadow-lg rounded-b-lg overflow-hidden divide-y divide-border">
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
              <MatchRow
                key={partida.partida_id}
                clubeLeft={clubeCasa}
                clubeRight={clubeVisitante}
                leftVal={cedeVal}
                rightVal={conquistaVal}
                leftColor="destructive"
                rightColor="success"
                maxVal={maxVal}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
