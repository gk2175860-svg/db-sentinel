import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { AIMessage, SuggestedCommand } from '@/types';
import { mockAIMessages, mockSuggestedCommands } from '@/data/mockData';
import * as Icons from 'lucide-react';

interface AIAssistantPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AIAssistantPanel({ isOpen, onClose }: AIAssistantPanelProps) {
  const [messages, setMessages] = useState<AIMessage[]>(mockAIMessages);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showSuggestions, setShowSuggestions] = useState(true);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || isTyping) return;

    const userMessage: AIMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: input,
      timestamp: new Date().toISOString(),
      type: 'command',
    };

    setMessages((prev) => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setShowSuggestions(false);
    setIsTyping(true);

    setTimeout(() => {
      const response = generateMockResponse(currentInput);
      setMessages((prev) => [...prev, response]);
      setIsTyping(false);
    }, 1500);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestionClick = (command: SuggestedCommand) => {
    setInput(command.command);
    handleSend();
  };

  const generateMockResponse = (userInput: string): AIMessage => {
    const lowerInput = userInput.toLowerCase();
    
    if (lowerInput.includes('health') || lowerInput.includes('check')) {
      return {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: 'Running health checks on all 12 connected databases...\n\n• prod-primary: 98% healthy\n• analytics-replica: 94% healthy\n• legacy-sqlserver: 72% ⚠️ (high latency, connection pool near limit)\n• cache-cluster: 96% healthy\n• doc-store: 91% healthy\n\nWould you like me to investigate the legacy-sqlserver issues?',
        timestamp: new Date().toISOString(),
        type: 'result',
        metadata: { database: 'all', confidence: 100 },
      };
    }

    if (lowerInput.includes('incident') || lowerInput.includes('investigate')) {
      return {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: 'Investigating high CPU incident on prod-primary (INC-001)...\n\n**Evidence Collected:**\n• CPU spiked to 94% at 14:32\n• Top query: `SELECT * FROM orders WHERE user_id = ? AND created_at > ?` (avg 2.8s)\n• Missing index on orders(user_id, created_at)\n• Connection pool at 87/100\n\n**Root Cause:** Missing composite index causing sequential scans on orders table (5.4M rows)\n\n**Recommendation:** Create index `CREATE INDEX idx_orders_user_created ON orders(user_id, created_at)`\nEstimated improvement: 95% latency reduction\n\nShall I generate the migration script?',
        timestamp: new Date().toISOString(),
        type: 'result',
        metadata: { database: 'prod-primary', confidence: 94 },
      };
    }

    if (lowerInput.includes('slow') || lowerInput.includes('optimize')) {
      return {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: 'Analyzing top 10 slowest queries across all databases...\n\n**Top Slow Queries:**\n1. `SELECT * FROM orders WHERE user_id = ?` - 2,847ms avg (prod-primary)\n2. `JOIN users u ON o.user_id = u.id` - 1,923ms avg (prod-primary)\n3. `UPDATE users SET last_login = NOW()` - 1,245ms avg (analytics-replica)\n\n**Optimization Opportunities:**\n• Missing index on orders(user_id, created_at) - 95% improvement\n• Partition orders table by created_at (monthly) - 60% improvement\n• Add connection pooling (PgBouncer) for analytics-replica\n\nWould you like me to create the index migration for the orders table?',
        timestamp: new Date().toISOString(),
        type: 'result',
        metadata: { database: 'all', confidence: 91 },
      };
    }

    if (lowerInput.includes('activity') || lowerInput.includes('recent')) {
      return {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: 'Recent agent activity (last 24 hours):\n\n• **Query Optimizer** - Completed: Index recommendation for orders table (94% confidence)\n• **SQL Generator** - Completed: Optimized user order history query (91% confidence)\n• **Schema Manager** - Running: Schema drift detection prod vs staging (88% confidence)\n• **Monitor** - Completed: Connection pool analysis for analytics-replica (96% confidence)\n• **Query Optimizer** - Completed: Slow query analysis on users table (89% confidence)\n\n5 agent runs completed, 1 currently running. All critical incidents addressed.',
        timestamp: new Date().toISOString(),
        type: 'result',
        metadata: { confidence: 100 },
      };
    }

    return {
      id: `msg-${Date.now()}`,
      role: 'assistant',
      content: `I can help you with:\n\n• **Database Health** - Check status of all connected databases\n• **Incident Investigation** - Deep dive into active incidents\n• **Query Optimization** - Find and fix slow queries\n• **Recent Activity** - View agent runs and investigations\n\nTry asking: "Check database health" or "Investigate the CPU incident on prod-primary"`,
      timestamp: new Date().toISOString(),
      type: 'text',
    };
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: 400 }}
            animate={{ x: 0 }}
            exit={{ x: 400 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-y-0 right-0 z-50 w-96 lg:w-80 bg-db-sidebar border-l border-db-secondary flex flex-col"
          >
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between p-4 border-b border-db-secondary">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-db-purple/20 flex items-center justify-center">
                    <Icons.Bot className="w-5 h-5 text-db-purple" />
                  </div>
                  <div>
                    <h3 className="font-medium text-db-text">AI Assistant</h3>
                    <p className="text-xs text-db-text-secondary flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-db-success" />
                      Online
                    </p>
                  </div>
                </div>
                <button
                  className="p-1 text-db-text-secondary hover:text-db-text"
                  onClick={onClose}
                >
                  <Icons.X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {showSuggestions && messages.length <= 1 && (
                  <div className="space-y-3">
                    <p className="text-sm text-db-text-secondary">Suggested commands:</p>
                    <div className="grid gap-2">
                      {mockSuggestedCommands.map((cmd) => {
                        const Icon = (Icons[cmd.icon as keyof typeof Icons] || Icons.Search) as React.ComponentType<{ className?: string }>;
                        return (
                          <button
                            key={cmd.id}
                            onClick={() => handleSuggestionClick(cmd)}
                            className="text-left p-3 rounded-lg bg-db-secondary border border-db-secondary hover:border-db-primary/50 hover:bg-db-primary/5 transition-all text-sm"
                          >
                            <div className="flex items-center gap-2">
                              <Icon className="w-4 h-4 text-db-primary" />
                              <span className="font-medium text-db-text">{cmd.label}</span>
                            </div>
                            <p className="text-xs text-db-text-secondary mt-1">{cmd.description}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="space-y-3" ref={messagesEndRef}>
                  {messages.map((message) => (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        'flex gap-3',
                        message.role === 'user' && 'flex-row-reverse'
                      )}
                    >
                      <div
                        className={cn(
                          'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                          message.role === 'assistant' ? 'bg-db-purple/20' : 'bg-db-primary/20'
                        )}
                      >
                        {message.role === 'assistant' ? (
                          <Icons.Bot className="w-4 h-4 text-db-purple" />
                        ) : (
                          <Icons.User className="w-4 h-4 text-db-primary" />
                        )}
                      </div>
                      <div
                        className={cn(
                          'max-w-[80%] rounded-2xl px-4 py-2',
                          message.role === 'assistant'
                            ? 'bg-db-secondary text-db-text rounded-tr-none'
                            : 'bg-db-primary text-db-text rounded-tl-none'
                        )}
                      >
                        {message.type === 'thinking' && (
                          <div className="flex items-center gap-2 text-db-text-secondary">
                            <Icons.Loader2 className="w-4 h-4 animate-spin text-db-primary" />
                            <span>Thinking...</span>
                          </div>
                        )}
                        {message.type !== 'thinking' && (
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        )}
                        {message.metadata?.confidence && (
                          <p className="text-xs text-db-text-secondary mt-1 flex items-center gap-1">
                            <Icons.Shield className="w-3 h-3" />
                            Confidence: {message.metadata.confidence}%
                          </p>
                        )}
                        <p className="text-xs text-db-text-secondary/50 mt-1 text-right">
                          {new Date(message.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                  {isTyping && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex gap-3"
                    >
                      <div className="w-8 h-8 rounded-full bg-db-purple/20 flex items-center justify-center flex-shrink-0">
                        <Icons.Bot className="w-4 h-4 text-db-purple" />
                      </div>
                      <div className="bg-db-secondary text-db-text rounded-2xl px-4 py-2 rounded-tr-none">
                        <div className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-db-primary animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-2 h-2 rounded-full bg-db-primary animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-2 h-2 rounded-full bg-db-primary animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>

              <div className="p-4 border-t border-db-secondary">
                <div className="flex items-end gap-2">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask me anything..."
                    className="flex-1 bg-db-secondary border border-db-secondary rounded-lg px-3 py-2 text-sm text-db-text placeholder-db-text-secondary focus:border-db-primary focus:outline-none resize-none min-h-[44px] max-h-32"
                    rows={1}
                  />
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() || isTyping}
                    className="p-2 rounded-lg bg-db-primary text-db-text hover:bg-db-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Icons.Send className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-xs text-db-text-secondary text-center mt-2">
                  DEMO DATA - Simulated AI responses
                </p>
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}