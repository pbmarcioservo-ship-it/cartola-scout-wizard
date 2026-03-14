import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Bot, User, Loader2, Volume2, VolumeX, Mic, MicOff } from 'lucide-react';
import { useMercado, usePartidas, useRodada, useHistoricoRodadas } from '@/hooks/useCartolaData';
import { buildContextData } from '@/lib/agente-tecnico-context';
import { toast } from 'sonner';


type PosicaoRapida = 'goleiros' | 'laterais' | 'zagueiros' | 'meias' | 'atacantes' | 'capitao' | 'tecnico' | null;

const BOTOES_POSICAO: { id: PosicaoRapida; label: string }[] = [
  { id: 'goleiros', label: 'Melhores Goleiros' },
  { id: 'laterais', label: 'Laterais (LE/LD)' },
  { id: 'zagueiros', label: 'Zagueiros' },
  { id: 'meias', label: 'Meias' },
  { id: 'atacantes', label: 'Atacantes' },
  { id: 'capitao', label: 'Capitão' },
  { id: 'tecnico', label: 'Técnico' },
];

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const CHAT_URL = "/api/agente-tecnico";

async function streamChat({
  messages,
  contextData,
  onDelta,
  onDone,
  onError,
}: {
  messages: { role: string; content: string }[];
  contextData: any;
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (err: string) => void;
}) {
  const resp = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messages, contextData }),
  });

  if (!resp.ok) {
    if (resp.status === 429) { onError("Limite de requisições excedido. Tente novamente em instantes."); return; }
    if (resp.status === 402) { onError("Créditos de IA esgotados."); return; }
    if (resp.status === 403) { onError("Acesso negado. Você precisa de uma assinatura ativa para usar o Agente Técnico."); return; }
    const body = await resp.text().catch(() => "");
    onError(`Erro ${resp.status}: ${body.slice(0, 100)}`);
    return;
  }

  if (!resp.body) { onError("Sem resposta do servidor."); return; }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let textBuffer = "";
  let streamDone = false;

  while (!streamDone) {
    const { done, value } = await reader.read();
    if (done) break;
    textBuffer += decoder.decode(value, { stream: true });

    let newlineIndex: number;
    while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
      let line = textBuffer.slice(0, newlineIndex);
      textBuffer = textBuffer.slice(newlineIndex + 1);

      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line.startsWith(":") || line.trim() === "") continue;
      if (!line.startsWith("data: ")) continue;

      const jsonStr = line.slice(6).trim();
      if (jsonStr === "[DONE]") { streamDone = true; break; }

      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) onDelta(content);
      } catch {
        textBuffer = line + "\n" + textBuffer;
        break;
      }
    }
  }

  // Final flush
  if (textBuffer.trim()) {
    for (let raw of textBuffer.split("\n")) {
      if (!raw) continue;
      if (raw.endsWith("\r")) raw = raw.slice(0, -1);
      if (raw.startsWith(":") || raw.trim() === "") continue;
      if (!raw.startsWith("data: ")) continue;
      const jsonStr = raw.slice(6).trim();
      if (jsonStr === "[DONE]") continue;
      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) onDelta(content);
      } catch { /* ignore */ }
    }
  }

  onDone();
}

export function AgenteTecnicoView() {
  const [selectedPos, setSelectedPos] = useState<PosicaoRapida>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: mercadoData } = useMercado();
  const { data: rodadaData } = useRodada();
  const { data: partidasData } = usePartidas();
  const { data: historico } = useHistoricoRodadas(rodadaData?.rodada_atual, 7);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      const el = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (el) el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  // Cleanup speech on unmount
  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
      recognitionRef.current?.abort();
    };
  }, []);

  const toggleListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error('Seu navegador não suporta reconhecimento de voz.');
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognitionRef.current = recognition;

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((r: any) => r[0].transcript)
        .join('');
      setInput(transcript);
    };

    recognition.onend = () => setIsListening(false);
    recognition.onerror = (e: any) => {
      if (e.error !== 'aborted') toast.error('Erro no reconhecimento de voz.');
      setIsListening(false);
    };

    setIsListening(true);
    recognition.start();
  }, [isListening]);

  const cleanTextForSpeech = (text: string): string => {
    return text
      .replace(/#{1,6}\s?/g, '')        // remove markdown headings
      .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1') // remove bold/italic markers
      .replace(/_{1,3}([^_]+)_{1,3}/g, '$1')
      .replace(/~~([^~]+)~~/g, '$1')    // remove strikethrough
      .replace(/`([^`]+)`/g, '$1')       // remove inline code
      .replace(/```[\s\S]*?```/g, '')    // remove code blocks
      .replace(/^[-*+]\s/gm, '')         // remove list markers
      .replace(/^\d+\.\s/gm, '')         // remove numbered list markers
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links → text only
      .replace(/[*#_~`>|]/g, '')         // remove remaining symbols
      // Remove ALL emojis (medals, fire, warning, etc.)
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2702}-\u{27B0}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu, '')
      .replace(/\n{2,}/g, '. ')          // double newlines → pause
      .replace(/\n/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  };

  const toggleSpeak = useCallback((text: string, idx: number) => {
    const synth = window.speechSynthesis;
    if (!synth) { toast.error('Seu navegador não suporta leitura em voz alta.'); return; }

    if (speakingIdx === idx) {
      synth.cancel();
      setSpeakingIdx(null);
      return;
    }

    synth.cancel();
    const cleanText = cleanTextForSpeech(text);
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'pt-BR';
    utterance.rate = 1;
    utterance.onend = () => setSpeakingIdx(null);
    utterance.onerror = () => setSpeakingIdx(null);
    setSpeakingIdx(idx);
    synth.speak(utterance);
  }, [speakingIdx]);

  const sendMessage = async (userContent: string, pos: PosicaoRapida) => {
    const userMsg: ChatMessage = { role: 'user', content: userContent };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    const contextData = buildContextData(pos, mercadoData, partidasData, historico);

    let assistantSoFar = "";
    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant') {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        }
        return [...prev, { role: 'assistant', content: assistantSoFar }];
      });
    };

    try {
      const allMessages = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));
      await streamChat({
        messages: allMessages,
        contextData,
        onDelta: upsertAssistant,
        onDone: () => setIsLoading(false),
        onError: (err) => {
          toast.error(err);
          setMessages(prev => [...prev, { role: 'assistant', content: `❌ ${err}` }]);
          setIsLoading(false);
        },
      });
    } catch (e) {
      console.error(e);
      toast.error('Erro ao conectar com o Agente Técnico.');
      setIsLoading(false);
    }
  };

  const handlePosicaoClick = (pos: PosicaoRapida) => {
    if (isLoading) return;
    setSelectedPos(pos);
    const label = BOTOES_POSICAO.find(b => b.id === pos)?.label ?? pos;
    const prompt = pos === 'capitao'
      ? 'Analise e me recomende o melhor Capitão para escalar nesta rodada, focando nos critérios de meias e atacantes com maior potencial de pontuação.'
      : pos === 'tecnico'
      ? 'Analise e me recomende o melhor Técnico para escalar nesta rodada, focando no time com maior probabilidade de SG somado ao potencial de scouts dos jogadores.'
      : `Analise e me recomende os melhores ${label} para escalar nesta rodada, seguindo os critérios de prioridade da posição.`;
    sendMessage(prompt, pos);
  };

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    const text = input;
    setInput('');
    sendMessage(text, selectedPos);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const dataReady = !!mercadoData && !!partidasData;

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-80px)]">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center gap-3 mb-4">
          <Bot className="w-7 h-7 text-primary" />
          <h2 className="text-xl font-bold text-foreground">Agente Técnico</h2>
          <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full font-semibold">IA</span>
          {!dataReady && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" /> Carregando dados...
            </span>
          )}
        </div>

        {/* Botões de acesso rápido */}
        <div className="flex flex-wrap gap-2 mb-3">
          {BOTOES_POSICAO.map((btn) => (
            <Button
              key={btn.id}
              variant={selectedPos === btn.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => handlePosicaoClick(btn.id)}
              className="text-xs"
              disabled={isLoading || !dataReady}
            >
              {btn.label}
            </Button>
          ))}
        </div>

        {/* Input no topo, abaixo dos botões */}
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isListening ? "🎙️ Ouvindo..." : "Pergunte ao Agente Técnico..."}
            className={`flex-1 ${isListening ? 'border-primary ring-2 ring-primary/30' : ''}`}
            disabled={isLoading || !dataReady}
          />
          {input.trim() ? (
            <Button size="icon" onClick={handleSend} disabled={isLoading || !dataReady}>
              <Send className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              size="icon"
              variant={isListening ? 'default' : 'outline'}
              onClick={toggleListening}
              disabled={isLoading || !dataReady}
              className={isListening ? 'animate-pulse' : ''}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </Button>
          )}
        </div>
      </div>

      {/* Chat area */}
      <Card className="flex-1 flex flex-col min-h-0 border-border">
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
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
                  <div className="flex flex-col max-w-[80%]">
                    <div
                      className={`rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                        msg.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-foreground'
                      }`}
                    >
                      {msg.content}
                      {msg.role === 'assistant' && i === messages.length - 1 && isLoading && (
                        <span className="inline-block w-2 h-4 bg-primary/60 animate-pulse ml-0.5 rounded-sm" />
                      )}
                    </div>
                    {/* Botão de ouvir resposta */}
                    {msg.role === 'assistant' && msg.content && !isLoading && (
                      <button
                        onClick={() => toggleSpeak(msg.content, i)}
                        className="flex items-center gap-1 mt-1 text-xs text-muted-foreground hover:text-primary transition-colors self-start"
                        title={speakingIdx === i ? 'Parar leitura' : 'Ouvir resposta'}
                        aria-label={speakingIdx === i ? 'Parar leitura em voz alta' : 'Ouvir resposta em voz alta'}
                      >
                        {speakingIdx === i ? (
                          <><VolumeX className="w-3.5 h-3.5" /> Parar</>
                        ) : (
                          <><Volume2 className="w-3.5 h-3.5" /> Ouvir</>
                        )}
                      </button>
                    )}
                  </div>
                  {msg.role === 'user' && (
                    <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center flex-shrink-0 mt-0.5">
                      <User className="w-4 h-4 text-secondary-foreground" />
                    </div>
                  )}
                </div>
              ))}
              {isLoading && messages[messages.length - 1]?.role === 'user' && (
                <div className="flex gap-2 justify-start">
                  <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                  <div className="bg-muted rounded-lg px-3 py-2 text-sm text-muted-foreground flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Analisando dados...
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </Card>

      {/* Disclaimer jurídico */}
      <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground text-center px-2">
        O STATUS FC PRO utiliza APIs oficiais e IA de terceiros. O serviço pode apresentar oscilações momentâneas de estabilidade em períodos de alta demanda ou manutenção dos sistemas integrados (Cartola FC/Google Cloud).
      </p>
    </div>
  );
}
