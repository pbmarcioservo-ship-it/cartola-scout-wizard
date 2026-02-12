import { PosicaoFilter, ScoutFilter } from '@/types/cartola';
import { times } from '@/data/times';
import { CartolaClube } from '@/lib/cartola-api';
import { CheckCircle, HelpCircle, XCircle, HeartPulse, Ban } from 'lucide-react';

interface FilterBarProps {
  showMandoFilter?: boolean;
  showUltimasFilter?: boolean;
  showPosicaoFilter?: boolean;
  showScoutFilter?: boolean;
  showTimeFilter?: boolean;
  showSearchFilter?: boolean;
  showStatusFilter?: boolean;
  
  mando?: string;
  onMandoChange?: (value: string) => void;
  
  ultimas?: number;
  onUltimasChange?: (value: number) => void;
  
  posicao?: PosicaoFilter;
  onPosicaoChange?: (value: PosicaoFilter) => void;
  
  scout?: ScoutFilter;
  onScoutChange?: (value: ScoutFilter) => void;
  
  time?: string;
  onTimeChange?: (value: string) => void;
  
  search?: string;
  onSearchChange?: (value: string) => void;

  status?: string;
  onStatusChange?: (value: string) => void;

  clubeOptions?: CartolaClube[];
}

export function FilterBar({
  showMandoFilter,
  showUltimasFilter,
  showPosicaoFilter,
  showScoutFilter,
  showTimeFilter,
  showSearchFilter,
  showStatusFilter,
  mando,
  onMandoChange,
  ultimas,
  onUltimasChange,
  posicao,
  onPosicaoChange,
  scout,
  onScoutChange,
  time,
  onTimeChange,
  search,
  onSearchChange,
  status,
  onStatusChange,
  clubeOptions,
}: FilterBarProps) {
  const clubeList = clubeOptions || [];

  return (
    <div className="flex flex-wrap gap-3 bg-card p-4 rounded-lg mb-5 shadow-md sticky top-0 z-50">
      {showSearchFilter && (
        <input
          type="text"
          placeholder="Buscar Atleta..."
          value={search}
          onChange={(e) => onSearchChange?.(e.target.value)}
          className="bg-primary text-primary-foreground border-none px-4 py-2.5 rounded-md font-bold min-w-[150px] placeholder:text-primary-foreground/70"
        />
      )}
      
      {showMandoFilter && (
        <select
          value={mando}
          onChange={(e) => onMandoChange?.(e.target.value)}
          className="bg-primary text-primary-foreground border-none px-4 py-2.5 rounded-md font-bold min-w-[120px] cursor-pointer"
        >
          <option value="casa_fora">Casa x Fora</option>
          <option value="todos">Todos</option>
        </select>
      )}
      
      {showUltimasFilter && (
        <select
          value={ultimas}
          onChange={(e) => onUltimasChange?.(Number(e.target.value))}
          className="bg-primary text-primary-foreground border-none px-4 py-2.5 rounded-md font-bold min-w-[120px] cursor-pointer"
        >
          <option value={3}>Últimas 3</option>
          <option value={5}>Últimas 5</option>
          <option value={7}>Últimas 7</option>
        </select>
      )}
      
      {showPosicaoFilter && (
        <select
          value={posicao}
          onChange={(e) => onPosicaoChange?.(e.target.value as PosicaoFilter)}
          className="bg-primary text-primary-foreground border-none px-4 py-2.5 rounded-md font-bold min-w-[120px] cursor-pointer"
        >
          <option value="todos">Todas Posições</option>
          <option value="goleiro">Goleiro</option>
          <option value="lateral">Lateral</option>
          <option value="zagueiro">Zagueiro</option>
          <option value="meia">Meia</option>
          <option value="atacante">Atacante</option>
          <option value="tecnico">Técnico</option>
        </select>
      )}
      
      {showScoutFilter && (
        <select
          value={scout}
          onChange={(e) => onScoutChange?.(e.target.value as ScoutFilter)}
          className="bg-primary text-primary-foreground border-none px-4 py-2.5 rounded-md font-bold min-w-[130px] cursor-pointer"
        >
          <option value="desarmes">Desarmes</option>
          <option value="gols">Gols</option>
          <option value="assistencias">Assistências</option>
          <option value="finalizacaoDefendida">Fin. Defendida</option>
          <option value="finalizacaoFora">Fin. para Fora</option>
          <option value="defesas">Defesas</option>
          <option value="semGol">SG</option>
        </select>
      )}
      
      {showTimeFilter && (
        <select
          value={time}
          onChange={(e) => onTimeChange?.(e.target.value)}
          className="bg-primary text-primary-foreground border-none px-4 py-2.5 rounded-md font-bold min-w-[120px] cursor-pointer"
        >
          <option value="todos">Todos os Times</option>
          {clubeList.length > 0
            ? clubeList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))
            : times.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.abreviacao}
                </option>
              ))
          }
        </select>
      )}

      {showStatusFilter && (
        <select
          value={status}
          onChange={(e) => onStatusChange?.(e.target.value)}
          className="bg-primary text-primary-foreground border-none px-4 py-2.5 rounded-md font-bold min-w-[130px] cursor-pointer"
        >
          <option value="todos">📋 Status</option>
          <option value="7">✅ Pro</option>
          <option value="6">⚫ Nul</option>
          <option value="3">🟥 Sus</option>
          <option value="5">🏥 Mac</option>
          <option value="2">❓ Duv</option>
        </select>
      )}
    </div>
  );
}
