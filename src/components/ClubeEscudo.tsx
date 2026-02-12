import { CartolaClube } from '@/lib/cartola-api';
import { cn } from '@/lib/utils';

interface ClubeEscudoProps {
  clube: CartolaClube;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showName?: boolean;
}

const sizeClasses = {
  xs: 'w-4 h-4',
  sm: 'w-5 h-5',
  md: 'w-8 h-8',
  lg: 'w-12 h-12',
};

export function ClubeEscudo({ clube, size = 'md', showName = false }: ClubeEscudoProps) {
  const escudoUrl = size === 'xs' ? clube.escudos['30x30'] :
                    size === 'sm' ? clube.escudos['30x30'] : 
                    size === 'md' ? clube.escudos['45x45'] : 
                    clube.escudos['60x60'];

  return (
    <div className="flex items-center gap-2">
      <img
        src={escudoUrl}
        alt={clube.nome}
        className={cn(sizeClasses[size], 'object-contain')}
        onError={(e) => {
          // Fallback se a imagem não carregar
          (e.target as HTMLImageElement).style.display = 'none';
        }}
      />
      {showName && (
        <span className="font-bold text-sm">{clube.abreviacao}</span>
      )}
    </div>
  );
}
