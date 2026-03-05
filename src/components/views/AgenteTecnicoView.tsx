import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Shield, Send, Bot, User } from 'lucide-react';

type PosicaoRapida = 'goleiros' | 'laterais' | 'zagueiros' | 'meias' | 'atacantes' | 'capitao-tecnico' | null;

const BOTOES_POSICAO: { id: PosicaoRapida; label: string }[] = [
  { id: 'goleiros', label: 'Melhores Goleiros' },
  { id: 'laterais', label: 'Laterais (LE/LD)' },
  { id: 'zagueiros', label: 'Zagueiros' },
  { id: 'meias', label: 'Meias' },
  { id: 'atacantes', label: 'Atacantes' },
  { id: 'capitao-tecnico', label: 'Capitão e Técnico' },
];

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export function AgenteTecnicoView() {
  const [selectedPos, setSelectedPos] = useState<PosicaoRapida>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handlePosicaoClick = (pos: PosicaoRapida) => {
    setSelectedPos(pos);
    const label = BOTOES_POSICAO.find(b => b.id === pos)?.label ?? pos;
    const userMsg: ChatMessage = { role: 'user', content: `Quais são os melhores ${label} para escalar nesta rodada?` };
    setMessages(prev => [...prev, userMsg]);
    // Placeholder: will be replaced by AI response
    setMessages(prev => [...prev, { role: 'assistant', content: `🔧 O Agente Técnico de IA será ativado em breve para responder sobre ${label}. Aguarde a integração com a API de IA.` }]);
  };

  const handleSend = () => {
    if (!input.trim()) return;
    const userMsg: ChatMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    // Placeholder response
    setMessages(prev => [...prev, { role: 'assistant', content: '🔧 O Agente Técnico de IA será ativado em breve. Aguarde a integração com a API de IA.' }]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-80px)]">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center gap-3 mb-4">
          <Bot className="w-7 h-7 text-primary" />
          <h2 className="text-xl font-bold text-foreground">Agente Técnico</h2>
          <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full font-semibold">IA</span>
        </div>

        {/* Botões de acesso rápido */}
        <div className="flex flex-wrap gap-2">
          {BOTOES_POSICAO.map((btn) => (
            <Button
              key={btn.id}
              variant={selectedPos === btn.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => handlePosicaoClick(btn.id)}
              className="text-xs"
            >
              {btn.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Chat area */}
      <Card className="flex-1 flex flex-col min-h-0 border-border">
        <ScrollArea className="flex-1 p-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-16 text-muted-foreground">
              <Bot className="w-12 h-12 mb-3 opacity-40" />
              <p className="text-sm text-center">
                Selecione uma posição acima ou faça uma pergunta livre<br />
                para receber recomendações do Agente Técnico.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'assistant' && (
                    <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Bot className="w-4 h-4 text-primary" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-foreground'
                    }`}
                  >
                    {msg.content}
                  </div>
                  {msg.role === 'user' && (
                    <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center flex-shrink-0 mt-0.5">
                      <User className="w-4 h-4 text-secondary-foreground" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Input */}
        <CardContent className="p-3 border-t border-border">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Pergunte ao Agente Técnico..."
              className="flex-1"
              disabled={isLoading}
            />
            <Button size="icon" onClick={handleSend} disabled={isLoading || !input.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
