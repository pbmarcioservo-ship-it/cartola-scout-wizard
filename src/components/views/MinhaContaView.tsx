import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { User, Mail, Crown, Calendar, LogOut, KeyRound, Loader2, MessageCircle, CheckCircle2, XCircle, CalendarPlus } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const OWNER_EMAIL = 'pb.marcioservo@gmail.com';

const PLAN_LABELS: Record<string, string> = {
  owner: 'Pro / Dono',
  free: 'Gratuito',
  mensal_avulso: 'Mensal Avulso',
  mensal_recorrente: 'Mensal Recorrente',
  anual_vip: 'Anual VIP',
};

const planColors: Record<string, string> = {
  owner: 'bg-primary/20 text-primary border-primary/30',
  free: 'bg-muted text-muted-foreground border-border',
  mensal_avulso: 'bg-primary/20 text-primary border-primary/30',
  mensal_recorrente: 'bg-success/20 text-success border-success/30',
  anual_vip: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
};

export function MinhaContaView() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [subscription, setSubscription] = useState<{
    plan: string;
    validUntil: string | null;
    createdAt: string | null;
    isActive: boolean;
  } | null>(null);
  const [subLoading, setSubLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const userEmail = user.email?.toLowerCase();
    if (userEmail === OWNER_EMAIL) {
      setSubscription({ plan: 'owner', validUntil: null, createdAt: null, isActive: true });
      setSubLoading(false);
      return;
    }

    const fetchSub = async () => {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('plan, valid_until, created_at')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching subscription:', error);
        setSubscription({ plan: 'free', validUntil: null, createdAt: null, isActive: false });
      } else if (data) {
        const isPaid = ['mensal_avulso', 'mensal_recorrente', 'anual_vip'].includes(data.plan);
        const notExpired = !data.valid_until || new Date(data.valid_until) > new Date();
        setSubscription({
          plan: data.plan,
          validUntil: data.valid_until
            ? new Date(data.valid_until).toLocaleDateString('pt-BR')
            : null,
          createdAt: data.created_at
            ? new Date(data.created_at).toLocaleDateString('pt-BR')
            : null,
          isActive: isPaid && notExpired,
        });
      } else {
        setSubscription({ plan: 'free', validUntil: null, createdAt: null, isActive: false });
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

  const handleSupport = () => {
    window.open('https://wa.me/5581999999999?text=Olá! Preciso de suporte com minha conta STATUS FC.', '_blank');
  };

  return (
    <div className="max-w-xl mx-auto space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shadow-[0_0_15px_hsl(259,70%,48%,0.2)]">
          <User className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground">Minha Conta</h2>
          <p className="text-xs text-muted-foreground">{user?.email}</p>
        </div>
      </div>

      {/* User Info Card */}
      <div className="bg-card border border-border rounded-lg p-5">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/20 flex items-center justify-center">
            <span className="text-2xl font-bold text-primary">
              {(user?.user_metadata?.full_name || user?.email || 'U')[0].toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-foreground text-base truncate">
              {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Usuário'}
            </p>
            <p className="text-sm text-muted-foreground flex items-center gap-1.5 truncate">
              <Mail className="w-3.5 h-3.5 flex-shrink-0" />
              {user?.email}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Membro desde {user?.created_at ? new Date(user.created_at).toLocaleDateString('pt-BR') : '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Subscription Card */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-5 py-3 bg-sidebar/50 border-b border-border">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Crown className="w-3.5 h-3.5" /> Assinatura
          </h3>
        </div>

        {subLoading ? (
          <div className="p-5 flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
          </div>
        ) : subscription ? (
          <div className="p-5 space-y-4">
            {/* Plan & Status Row */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Plano</p>
                <Badge className={`text-xs px-3 py-1 ${planColors[subscription.plan] || 'bg-muted text-muted-foreground'}`}>
                  {PLAN_LABELS[subscription.plan] || subscription.plan}
                </Badge>
              </div>
              <div className="text-right space-y-1">
                <p className="text-xs text-muted-foreground">Status</p>
                {subscription.plan === 'owner' ? (
                  <div className="flex items-center gap-1.5 text-primary font-semibold text-sm">
                    <CheckCircle2 className="w-4 h-4" /> Dono
                  </div>
                ) : subscription.isActive ? (
                  <div className="flex items-center gap-1.5 text-success font-semibold text-sm">
                    <CheckCircle2 className="w-4 h-4" /> Ativo
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-destructive font-semibold text-sm">
                    <XCircle className="w-4 h-4" /> Inativo
                  </div>
                )}
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-sidebar/30 rounded-md p-3 border border-border">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <CalendarPlus className="w-3 h-3" /> Início
                </p>
                <p className="text-sm font-semibold text-foreground mt-1">
                  {subscription.createdAt || '—'}
                </p>
              </div>
              <div className="bg-sidebar/30 rounded-md p-3 border border-border">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Vencimento
                </p>
                <p className="text-sm font-semibold text-foreground mt-1">
                  {subscription.validUntil || (subscription.plan === 'owner' ? '∞' : '—')}
                </p>
              </div>
            </div>
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
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          className="justify-start gap-2 border-border text-sm"
          onClick={() => setShowChangePassword(!showChangePassword)}
        >
          <KeyRound className="w-4 h-4" /> Alterar Senha
        </Button>
        <Button
          variant="outline"
          className="justify-start gap-2 border-success/30 text-success hover:bg-success/10 text-sm"
          onClick={handleSupport}
        >
          <MessageCircle className="w-4 h-4" /> Suporte
        </Button>
      </div>

      <Button
        variant="ghost"
        className="w-full justify-start gap-2 text-destructive hover:text-destructive hover:bg-destructive/10 text-sm"
        onClick={signOut}
      >
        <LogOut className="w-4 h-4" /> Sair da conta
      </Button>

      {/* Disclaimer jurídico */}
      <div className="mt-6 rounded-lg border border-border bg-muted/50 p-3">
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          O STATUS FC PRO utiliza APIs oficiais e IA de terceiros. O serviço pode apresentar oscilações momentâneas de estabilidade em períodos de alta demanda ou manutenção dos sistemas integrados (Cartola FC/Google Cloud).
        </p>
      </div>
    </div>
  );
}
