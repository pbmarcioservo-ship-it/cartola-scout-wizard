import { Time } from '@/types/cartola';
import { cn } from '@/lib/utils';

interface TeamShieldProps {
  team: Time;
  size?: 'sm' | 'md' | 'lg';
  showName?: boolean;
}

const sizeClasses = {
  sm: 'w-5 h-5',
  md: 'w-7 h-7',
  lg: 'w-10 h-10',
};

export function TeamShield({ team, size = 'md', showName = false }: TeamShieldProps) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          'rounded-full border-2 shadow-md',
          sizeClasses[size],
          team.shieldClass
        )}
        title={team.nome}
      />
      {showName && (
        <span className="font-bold text-sm">{team.abreviacao}</span>
      )}
    </div>
  );
}
