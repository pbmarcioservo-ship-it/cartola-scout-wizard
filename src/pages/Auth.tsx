import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable/index';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';

type AuthMode = 'login' | 'signup' | 'reset';

export default function Auth() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleGoogleLogin = async () => {
    setLoading(true);
    const { error } = await lovable.auth.signInWithOAuth('google', {
      redirect_uri: window.location.origin,
    });
    if (error) {
      toast({ title: 'Erro ao entrar com Google', description: String(error), variant: 'destructive' });
    }
    setLoading(false);
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (mode === 'reset') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'E-mail enviado', description: 'Verifique sua caixa de entrada para redefinir a senha.' });
        setMode('login');
      }
      setLoading(false);
      return;
    }

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) {
        toast({ title: 'Erro ao criar conta', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Conta criada!', description: 'Verifique seu e-mail para confirmar o cadastro.' });
        setMode('login');
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast({ title: 'Erro ao entrar', description: error.message, variant: 'destructive' });
      }
    }
    setLoading(false);
  };

  const titles: Record<AuthMode, string> = {
    login: 'Entrar',
    signup: 'Criar Conta',
    reset: 'Recuperar Senha',
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-sidebar p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <img
            src="/logo.png"
            alt="STATUS FC"
            className="w-20 h-20 object-contain drop-shadow-[0_0_20px_hsl(259,70%,48%,0.5)]"
          />
          <h1 className="text-xl font-extrabold tracking-widest text-primary">STATUS FC</h1>
          <p className="text-xs tracking-[0.2em] text-sidebar-foreground/50 uppercase">
            Estatísticas & Probabilidades
          </p>
        </div>

        {/* Card */}
        <div className="bg-card/10 backdrop-blur-sm border border-primary/30 rounded-lg p-6 space-y-5 shadow-[0_0_30px_hsl(259,70%,48%,0.15)]">
          <h2 className="text-lg font-bold text-sidebar-foreground text-center">{titles[mode]}</h2>

          {/* Google */}
          {mode !== 'reset' && (
            <Button
              onClick={handleGoogleLogin}
              disabled={loading}
              variant="outline"
              className="w-full border-sidebar-border text-sidebar-foreground hover:bg-primary/10 hover:text-primary"
            >
              <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Entrar com Google
            </Button>
          )}

          {mode !== 'reset' && (
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-sidebar-border" />
              <span className="text-xs text-sidebar-foreground/40">ou</span>
              <div className="flex-1 h-px bg-sidebar-border" />
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sidebar-foreground/70 text-xs">E-mail</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-sidebar-foreground/40" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="seu@email.com"
                  className="pl-10 bg-sidebar-accent border-sidebar-border text-sidebar-foreground placeholder:text-sidebar-foreground/30"
                />
              </div>
            </div>

            {mode !== 'reset' && (
              <div className="space-y-2">
                <Label className="text-sidebar-foreground/70 text-xs">Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-sidebar-foreground/40" />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="••••••••"
                    className="pl-10 pr-10 bg-sidebar-accent border-sidebar-border text-sidebar-foreground placeholder:text-sidebar-foreground/30"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-sidebar-foreground/40 hover:text-sidebar-foreground/70"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Aguarde...' : titles[mode]}
            </Button>
          </form>

          {/* Links */}
          <div className="flex flex-col items-center gap-3 text-xs">
            {mode === 'login' && (
              <>
                <button onClick={() => setMode('reset')} className="text-primary hover:text-primary/80 font-medium transition-colors">
                  Esqueceu a senha?
                </button>
                <button
                  onClick={() => setMode('signup')}
                  className="w-full border border-primary/60 text-primary font-semibold rounded-md py-2 hover:bg-primary/10 transition-colors"
                >
                  Criar conta
                </button>
              </>
            )}
            {mode === 'signup' && (
              <button onClick={() => setMode('login')} className="text-white hover:text-primary font-medium transition-colors">
                Já tem conta? <span className="text-primary font-semibold">Entrar</span>
              </button>
            )}
            {mode === 'reset' && (
              <button onClick={() => setMode('login')} className="text-primary hover:text-primary/80 font-medium transition-colors">
                Voltar ao login
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
