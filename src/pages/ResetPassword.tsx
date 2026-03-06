import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes('type=recovery')) {
      setReady(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Senha atualizada!', description: 'Você já pode entrar com a nova senha.' });
      navigate('/');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-sidebar p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3">
          <img src="/logo.png" alt="STATUS FC" className="w-16 h-16 object-contain drop-shadow-[0_0_16px_hsl(259,70%,48%,0.5)]" />
          <h1 className="text-xl font-extrabold tracking-widest text-primary">Nova Senha</h1>
        </div>
        <div className="bg-card/10 backdrop-blur-sm border border-sidebar-border rounded-lg p-6">
          {!ready ? (
            <p className="text-sidebar-foreground/60 text-sm text-center">Link inválido ou expirado.</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sidebar-foreground/70 text-xs">Nova Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-sidebar-foreground/40" />
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="••••••••"
                    className="pl-10 bg-sidebar-accent border-sidebar-border text-sidebar-foreground placeholder:text-sidebar-foreground/30"
                  />
                </div>
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? 'Aguarde...' : 'Redefinir Senha'}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
