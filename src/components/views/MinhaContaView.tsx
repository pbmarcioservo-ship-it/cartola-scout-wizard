import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { User, Mail, Crown, Calendar, LogOut, KeyRound, ArrowUpCircle, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const OWNER_EMAIL = 'pb.marcioservo@gmail.com';

const PLAN_LABELS: Record<string, string> = {
  owner: 'Plano Pro/Dono',
  free: 'Plano Gratuito',
  mensal_avulso: 'Plano Mensal Avulso',
  mensal_recorrente: 'Assinatura Mensal (Recorrente)',
  anual_vip: 'Plano Anual (VIP)',
};

const planColors: Record<string, string> = {
  owner: 'bg-primary/20 text-primary',
  free: 'bg-muted text-muted-foreground',
  mensal_avulso: 'bg-primary/20 text-primary',
  mensal_recorrente: 'bg-green-500/20 text-green-400',
  anual_vip: 'bg-amber-500/20 text-amber-400',
};

export function MinhaContaView() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [subscription, setSubscription] = useState<{ plan: string; validUntil: string | null } | null>(null);
  const [subLoading, setSubLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const userEmail = user.email?.toLowerCase();
    if (userEmail === OWNER_EMAIL) {
      setSubscription({ plan: 'owner', validUntil: null });
      setSubLoading(false);
      return;
    }

    const fetchSub = async () => {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('plan, valid_until')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching subscription:', error);
        setSubscription({ plan: 'free', validUntil: null });
      } else if (data) {
        const validDate = data.valid_until
          ? new Date(data.valid_until).toLocaleDateString('pt-BR')
          : null;
        setSubscription({ plan: data.plan, validUntil: validDate });
      } else {
        setSubscription({ plan: 'free', validUntil: null });
      }
      setSubLoading(false);
    };
    fetchSub();
  }, [user]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Senha alterada com sucesso!' });
      setNewPassword('');
      setShowChangePassword(false);
    }
    setLoading(false);
  };

  return (
    <div className="max-w-lg mx-auto space-y-6 animate-fade-in">
      <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
        <User className="w-5 h-5 text-primary" />
        Minha Conta
      </h2>

      {/* User Info */}
      <div className="bg-card border border-border rounded-lg p-5 space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center">
            <User className="w-7 h-7 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground truncate">
              {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Usuário'}
            </p>
            <p className="text-sm text-muted-foreground flex items-center gap-1.5 truncate">
              <Mail className="w-3.5 h-3.5 flex-shrink-0" />
              {user?.email}
            </p>
          </div>
        </div>
      </div>

      {/* Subscription */}
      <div className="bg-card border border-border rounded-lg p-5 space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Assinatura</h3>
        {subLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
          </div>
        ) : subscription ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Crown className="w-4 h-4" /> Status
              </span>
              <Badge className={planColors[subscription.plan] || 'bg-muted text-muted-foreground'}>
                {PLAN_LABELS[subscription.plan] || subscription.plan}
              </Badge>
            </div>
            {subscription.validUntil && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" /> Válido até
                </span>
                <span className="text-sm font-medium text-foreground">{subscription.validUntil}</span>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Change Password */}
      {showChangePassword && (
        <div className="bg-card border border-border rounded-lg p-5 animate-fade-in">
          <form onSubmit={handleChangePassword} className="space-y-3">
            <Label className="text-xs text-muted-foreground">Nova Senha</Label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
              placeholder="Mínimo 6 caracteres"
            />
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={loading}>
                {loading ? 'Salvando...' : 'Salvar'}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setShowChangePassword(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Actions */}
      <div className="space-y-2">
        <Button
          variant="outline"
          className="w-full justify-start gap-2 border-border"
          onClick={() => setShowChangePassword(!showChangePassword)}
        >
          <KeyRound className="w-4 h-4" /> Alterar Senha
        </Button>
        <Button
          className="w-full justify-start gap-2 bg-primary/20 text-primary hover:bg-primary/30 border-0"
        >
          <ArrowUpCircle className="w-4 h-4" /> Fazer Upgrade / Renovar
        </Button>
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={signOut}
        >
          <LogOut className="w-4 h-4" /> Sair
        </Button>
      </div>
    </div>
  );
}
