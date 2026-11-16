import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { AIMessage } from '@/types';
import { mockAIMessages, mockSuggestedCommands } from '@/data/mockData';
import * as Icons from 'lucide-react';

export function InvestigationPage() {
  const [messages, setMessages] = useState<AIMessage[]>(mockAIMessages);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'evidence' | 'hypotheses'>('chat');
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setIsTyping(true);

    setTimeout(() => {
      const response = generateMockResponse(currentInput);
      setMessages(prev => [...prev, response]);
      setIsTyping(false);
    }, 1500);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestionClick = (command: typeof mockSuggestedCommands[0]) => {
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

  const evidenceItems = [
    { id: 'e1', type: 'supporting', source: 'pg_stat_statements', content: 'Query `SELECT * FROM orders WHERE user_id = ?` avg 2,847ms, 45 exec/s', confidence: 95 },
    { id: 'e2', type: 'supporting', source: 'EXPLAIN ANALYZE', content: 'Sequential scan on orders table (5.4M rows), no index on user_id', confidence: 100 },
    { id: 'e3', type: 'supporting', source: 'pg_stat_activity', content: 'Connection pool at 87/100, 12 waiting', confidence: 90 },
    { id: 'e4', type: 'contradictory', source: 'System metrics', content: 'CPU usage normal on other databases', confidence: 80 },
    { id: 'e5', type: 'supporting', source: 'Index Advisor', content: 'Missing index on orders(user_id, created_at) estimated 95% improvement', confidence: 94 },
  ];

  const hypotheses = [
    { id: 'h1', title: 'Missing Composite Index', description: 'No index on orders(user_id, created_at) causing sequential scans', confidence: 94, status: 'confirmed' },
    { id: 'h2', title: 'Connection Pool Exhaustion', description: 'High concurrent connections overwhelming pool', confidence: 65, status: 'unlikely' },
    { id: 'h3', title: 'Table Bloat', description: 'Orders table has significant bloat from updates/deletes', confidence: 40, status: 'unlikely' },
    { id: 'h4', title: 'Lock Contention', description: 'Row-level locks on orders table causing delays', confidence: 30, status: 'ruled_out' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-db-text">AI Investigation</h1>
          <p className="text-db-text-secondary mt-1">Collaborate with AI to diagnose and resolve database issues</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 bg-db-secondary rounded text-sm text-db-text-secondary">DEMO DATA</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-db-card border border-db-secondary rounded-xl overflow-hidden flex flex-col h-[calc(100vh-300px)]">
            <div className="border-b border-db-secondary">
              <nav className="flex gap-1 p-1" aria-label="Investigation tabs">
                {[
                  { id: 'chat', label: 'Chat', icon: Icons.MessageSquare },
                  { id: 'evidence', label: 'Evidence Ledger', icon: Icons.FileText },
                  { id: 'hypotheses', label: 'Hypotheses', icon: Icons.Lightbulb },
                ].map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as typeof activeTab)}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                        activeTab === tab.id
                          ? 'bg-db-primary/10 text-db-primary border border-db-primary/30'
                          : 'text-db-text-secondary hover:text-db-text hover:bg-db-secondary'
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      {tab.label}
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {activeTab === 'chat' && (
                <div className="space-y-4" ref={messagesEndRef}>
                  {messages.map((message) => (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn('flex gap-3', message.role === 'user' && 'flex-row-reverse')}
                    >
                      <div className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                        message.role === 'assistant' ? 'bg-db-purple/20' : 'bg-db-primary/20'
                      )}>
                        {message.role === 'assistant' ? (
                          <Icons.Bot className="w-4 h-4 text-db-purple" />
                        ) : (
                          <Icons.User className="w-4 h-4 text-db-primary" />
                        )}
                      </div>
                      <div className={cn(
                        'max-w-[80%] rounded-2xl px-4 py-2',
                        message.role === 'assistant'
                          ? 'bg-db-secondary text-db-text rounded-tr-none'
                          : 'bg-db-primary text-db-text rounded-tl-none'
                      )}>
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
                          <p className="text-xs text-db-text-secondary/70 mt-1 flex items-center gap-1">
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
              )}

              {activeTab === 'evidence' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-medium text-db-text">Evidence Ledger</h3>
                    <span className="text-xs text-db-text-secondary">5 pieces of evidence collected</span>
                  </div>
                  {evidenceItems.map((evidence) => (
                    <motion.div
                      key={evidence.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={cn(
                        'p-4 rounded-lg border transition-all',
                        evidence.type === 'supporting' 
                          ? 'bg-db-success/10 border-db-success/30' 
                          : 'bg-db-critical/10 border-db-critical/30'
                      )}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className={cn(
                              'px-2 py-0.5 text-xs font-medium rounded-full',
                              evidence.type === 'supporting' 
                                ? 'bg-db-success/20 text-db-success border border-db-success/30'
                                : 'bg-db-critical/20 text-db-critical border border-db-critical/30'
                            )}>
                              {evidence.type.charAt(0).toUpperCase() + evidence.type.slice(1)}
                            </span>
                            <span className="text-xs text-db-text-secondary bg-db-secondary px-2 py-0.5 rounded">{evidence.source}</span>
                            <span className={cn(
                              'ml-auto px-2 py-0.5 text-xs font-medium rounded-full',
                              evidence.confidence > 90 ? 'bg-db-success/20 text-db-success' : 
                              evidence.confidence > 70 ? 'bg-db-warning/20 text-db-warning' : 'bg-db-critical/20 text-db-critical'
                            )}>
                              {evidence.confidence}% confidence
                            </span>
                          </div>
                          <p className="text-sm text-db-text font-mono text-xs">{evidence.content}</p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}

              {activeTab === 'hypotheses' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-medium text-db-text">Hypotheses</h3>
                    <span className="text-xs text-db-text-secondary">4 hypotheses evaluated</span>
                  </div>
                  {hypotheses.map((hypothesis) => (
                    <motion.div
                      key={hypothesis.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="p-4 rounded-lg border border-db-secondary bg-db-secondary/30"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-medium text-db-text">{hypothesis.title}</h4>
                            <span className={cn(
                              'px-2 py-0.5 text-xs font-medium rounded-full',
                              hypothesis.status === 'confirmed' ? 'bg-db-success/20 text-db-success border border-db-success/30' :
                              hypothesis.status === 'unlikely' ? 'bg-db-warning/20 text-db-warning border border-db-warning/30' :
                              'bg-db-critical/20 text-db-critical border border-db-critical/30'
                            )}>
                              {hypothesis.status.charAt(0).toUpperCase() + hypothesis.status.slice(1).replace('_', ' ')}
                            </span>
                            <span className={cn(
                              'ml-auto px-2 py-0.5 text-xs font-medium rounded-full',
                              hypothesis.confidence > 80 ? 'bg-db-success/20 text-db-success' :
                              hypothesis.confidence > 50 ? 'bg-db-warning/20 text-db-warning' : 'bg-db-critical/20 text-db-critical'
                            )}>
                              {hypothesis.confidence}% confidence
                            </span>
                          </div>
                          <p className="text-sm text-db-text-secondary">{hypothesis.description}</p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-db-secondary">
              <div className="flex items-end gap-2">
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask me to investigate an incident, check health, optimize queries..."
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
        </div>

        <div className="space-y-4">
          <div className="bg-db-card border border-db-secondary rounded-xl p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-db-purple/20 flex items-center justify-center">
                <Icons.Bot className="w-6 h-6 text-db-purple" />
              </div>
              <div>
                <h3 className="font-medium text-db-text">AI Assistant</h3>
                <p className="text-xs text-db-text-secondary flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-db-success" />
                  Online
                </p>
              </div>
            </div>
            <div className="space-y-2">
              {mockSuggestedCommands.map((cmd) => {
                const Icon = (Icons[cmd.icon as keyof typeof Icons] || Icons.Search) as React.ComponentType<{ className?: string }>;
                return (
                  <button
                    key={cmd.id}
                    onClick={() => handleSuggestionClick(cmd)}
                    className="w-full text-left p-3 rounded-lg bg-db-secondary border border-db-secondary hover:border-db-primary/50 hover:bg-db-primary/5 transition-all"
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4 text-db-primary" />
                      <span className="font-medium text-db-text text-sm">{cmd.label}</span>
                    </div>
                    <p className="text-xs text-db-text-secondary mt-1">{cmd.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-db-card border border-db-secondary rounded-xl p-4">
            <h3 className="font-medium text-db-text mb-3 flex items-center gap-2">
              <Icons.Clock className="w-4 h-4 text-db-primary" />
              Recent Investigations
            </h3>
            <div className="space-y-3">
              {[
                { title: 'High CPU on prod-primary', time: '15 min ago', status: 'active' },
                { title: 'Slow query: orders table', time: '1 hour ago', status: 'completed' },
                { title: 'Connection pool exhaustion', time: '3 hours ago', status: 'completed' },
                { title: 'Schema drift detection', time: '5 hours ago', status: 'completed' },
              ].map((inv, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-db-secondary/50 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-db-text">{inv.title}</p>
                    <p className="text-xs text-db-text-secondary">{inv.time}</p>
                  </div>
                  <span className={cn(
                    'px-2 py-0.5 text-xs font-medium rounded-full',
                    inv.status === 'active' ? 'bg-db-primary/20 text-db-primary border border-db-primary/30' :
                    'bg-db-success/20 text-db-success border border-db-success/30'
                  )}>
                    {inv.status}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}