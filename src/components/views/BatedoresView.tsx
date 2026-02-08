import { times } from '@/data/times';
import { TeamShield } from '@/components/TeamShield';

export function BatedoresView() {
  return (
    <div className="animate-fade-in">
      <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-2">
        🎯 Batedores por Clube
      </h2>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {times.map((team, index) => (
          <button
            key={team.id}
            className="bg-card border border-border p-4 rounded-xl text-center hover:border-primary hover:bg-primary/5 transition-all duration-200 cursor-pointer group animate-slide-in"
            style={{ animationDelay: `${index * 30}ms` }}
          >
            <div className="flex justify-center mb-2">
              <TeamShield team={team} size="lg" />
            </div>
            <span className="font-bold text-foreground group-hover:text-primary transition-colors">
              {team.abreviacao}
            </span>
          </button>
        ))}
      </div>
      
      <div className="mt-8 bg-card p-6 rounded-lg shadow-lg text-center">
        <p className="text-muted-foreground">
          Clique em um time para ver os batedores de falta e pênalti
        </p>
      </div>
    </div>
  );
}
