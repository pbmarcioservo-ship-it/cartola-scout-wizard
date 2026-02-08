import { cn } from '@/lib/utils';

interface TopCategory {
  title: string;
  icon: string;
  color: string;
  players: { name: string; value: number }[];
}

const categories: TopCategory[] = [
  { 
    title: 'TOP 5 SG', 
    icon: '🛡️', 
    color: 'hsl(174, 72%, 56%)',
    players: [
      { name: 'Atleta 1', value: 8.50 },
      { name: 'Atleta 2', value: 7.80 },
      { name: 'Atleta 3', value: 7.20 },
      { name: 'Atleta 4', value: 6.90 },
      { name: 'Atleta 5', value: 6.50 },
    ]
  },
  { 
    title: 'LATERAIS', 
    icon: '🏃', 
    color: 'hsl(322, 72%, 52%)',
    players: [
      { name: 'Atleta 1', value: 8.50 },
      { name: 'Atleta 2', value: 7.80 },
      { name: 'Atleta 3', value: 7.20 },
      { name: 'Atleta 4', value: 6.90 },
      { name: 'Atleta 5', value: 6.50 },
    ]
  },
  { 
    title: 'ZAGUEIROS', 
    icon: '🧱', 
    color: 'hsl(251, 69%, 63%)',
    players: [
      { name: 'Atleta 1', value: 8.50 },
      { name: 'Atleta 2', value: 7.80 },
      { name: 'Atleta 3', value: 7.20 },
      { name: 'Atleta 4', value: 6.90 },
      { name: 'Atleta 5', value: 6.50 },
    ]
  },
  { 
    title: 'MEIAS', 
    icon: '💡', 
    color: 'hsl(45, 97%, 64%)',
    players: [
      { name: 'Atleta 1', value: 8.50 },
      { name: 'Atleta 2', value: 7.80 },
      { name: 'Atleta 3', value: 7.20 },
      { name: 'Atleta 4', value: 6.90 },
      { name: 'Atleta 5', value: 6.50 },
    ]
  },
  { 
    title: 'ATACANTES', 
    icon: '🏹', 
    color: 'hsl(0, 100%, 73%)',
    players: [
      { name: 'Atleta 1', value: 8.50 },
      { name: 'Atleta 2', value: 7.80 },
      { name: 'Atleta 3', value: 7.20 },
      { name: 'Atleta 4', value: 6.90 },
      { name: 'Atleta 5', value: 6.50 },
    ]
  },
  { 
    title: 'TÉCNICOS', 
    icon: '📋', 
    color: 'hsl(151, 82%, 65%)',
    players: [
      { name: 'Atleta 1', value: 8.50 },
      { name: 'Atleta 2', value: 7.80 },
      { name: 'Atleta 3', value: 7.20 },
      { name: 'Atleta 4', value: 6.90 },
      { name: 'Atleta 5', value: 6.50 },
    ]
  },
  { 
    title: 'CAPITÃES', 
    icon: '🔥', 
    color: 'hsl(24, 72%, 41%)',
    players: [
      { name: 'Atleta 1', value: 8.50 },
      { name: 'Atleta 2', value: 7.80 },
      { name: 'Atleta 3', value: 7.20 },
      { name: 'Atleta 4', value: 6.90 },
      { name: 'Atleta 5', value: 6.50 },
    ]
  },
];

export function TopsView() {
  return (
    <div className="animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {categories.map((category, index) => (
          <div 
            key={category.title}
            className="bg-card rounded-xl overflow-hidden shadow-lg animate-slide-in"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div 
              className="p-3 text-center font-bold uppercase text-white"
              style={{ backgroundColor: category.color }}
            >
              {category.icon} {category.title}
            </div>
            <div>
              {category.players.map((player, idx) => (
                <div 
                  key={idx}
                  className={cn(
                    'flex justify-between items-center px-4 py-3',
                    idx < category.players.length - 1 && 'border-b border-border'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-sm font-bold">
                      {idx + 1}.
                    </span>
                    <span className="text-foreground font-medium">
                      {player.name}
                    </span>
                  </div>
                  <span className="font-black text-primary">
                    {player.value.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
