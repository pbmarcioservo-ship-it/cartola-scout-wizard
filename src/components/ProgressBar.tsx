import { cn } from '@/lib/utils';

interface ProgressBarProps {
  value: number;
  maxValue?: number;
  color: 'success' | 'destructive';
  showValue?: boolean;
  reverse?: boolean;
  valueInside?: boolean;
}

export function ProgressBar({ 
  value, 
  maxValue = 100, 
  color, 
  showValue = true,
  reverse = false,
  valueInside = false
}: ProgressBarProps) {
  const percentage = Math.min((value / maxValue) * 100, 100);
  
  const colorClass = color === 'success' 
    ? 'bg-success' 
    : 'bg-destructive';

  return (
    <div className={cn(
      'flex items-center gap-3 p-2',
      reverse ? 'flex-row-reverse' : 'flex-row'
    )}>
      {showValue && !valueInside && (
        <span className="font-black text-sm min-w-[45px] text-foreground">
          {value.toFixed(1)}
        </span>
      )}
      <div className="flex-1 bg-muted h-4 rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full progress-bar-animated flex items-center',
            colorClass,
            reverse ? 'ml-auto' : ''
          )}
          style={{ width: `${percentage}%` }}
        >
          {showValue && valueInside && (
            <span className={cn(
              'text-white text-xs font-black',
              reverse ? 'pl-2 justify-start' : 'pr-2 justify-end'
            )}>
              {value.toFixed(1)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
