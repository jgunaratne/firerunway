'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { useUserData } from '@/lib/UserDataContext';
import { useBrokerageData } from '@/lib/BrokerageDataContext';
import { usePageContext as usePageLocalContext } from '@/lib/PageContextProvider';
import { formatCurrency } from '@/lib/calculations';
import { MessageSquare, Sparkles } from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────

interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

// ─── Page Context Builder ───────────────────────────────────────────

function usePageContextString(): string {
  const pathname = usePathname();
  const { profile, rsuGrants, realEstate, accounts, netWorthHistory, incomeTaxRecords } = useUserData();
  const { positions, totalInvestment, accounts: brokerageAccounts, plaidAccounts } = useBrokerageData();
  const { pageContext: localPageContext } = usePageLocalContext();

  const pageName = pathname?.replace('/', '') || 'dashboard';

  const parts: string[] = [`Active Page: ${pageName}`];

  // ── Global Financial Snapshot (always included) ──

  if (profile) {
    parts.push('');
    parts.push('--- Profile ---');
    parts.push(`Income: ${formatCurrency(profile.annual_income)}`);
    parts.push(`Annual Spend: ${formatCurrency(profile.annual_spend)}`);
    parts.push(`Retirement Spend: ${formatCurrency(profile.retirement_spend)}`);
    parts.push(`FIRE Number: ${formatCurrency(profile.fire_number)}`);
    parts.push(`SWR: ${profile.swr}%`);
    parts.push(`State: ${profile.state_of_residence}, Filing: ${profile.filing_status}`);
    if (profile.fire_target_year) parts.push(`FIRE Target Year: ${profile.fire_target_year}`);
    const savingsRate = profile.annual_income > 0
      ? Math.round(((profile.annual_income - profile.annual_spend) / profile.annual_income) * 100)
      : 0;
    parts.push(`Savings Rate: ${savingsRate}%`);
  }

  if (totalInvestment > 0 || positions.length > 0) {
    parts.push('');
    parts.push('--- Portfolio ---');
    parts.push(`Total Investment: ${formatCurrency(totalInvestment)}`);
    if (positions.length > 0) {
      parts.push(`Positions (${positions.length}):`);
      const sorted = [...positions].sort((a, b) => b.value - a.value);
      sorted.slice(0, 15).forEach(p => {
        parts.push(`  - ${p.ticker}: ${p.shares} shares @ $${p.price.toFixed(2)} = ${formatCurrency(p.value)} (${p.accountName}${p.institutionName ? ', ' + p.institutionName : ''})`);
      });
      if (sorted.length > 15) parts.push(`  ... and ${sorted.length - 15} more positions`);
    }
    if (brokerageAccounts.length > 0) {
      parts.push(`Brokerage Accounts (${brokerageAccounts.length}):`);
      brokerageAccounts.forEach(a => {
        parts.push(`  - ${a.institution_name}: ${a.name} (${a.type}) = ${formatCurrency(a.balance)}`);
      });
    }
  }

  if (netWorthHistory.length > 0) {
    parts.push('');
    parts.push('--- Net Worth ---');
    const latest = netWorthHistory[netWorthHistory.length - 1];
    parts.push(`Latest: ${formatCurrency(latest.total_net_worth)} (${latest.recorded_date})`);
    parts.push(`  Investment: ${formatCurrency(latest.investment_value)}, Retirement: ${formatCurrency(latest.retirement_value)}, RSU: ${formatCurrency(latest.rsu_value)}, Real Estate Equity: ${formatCurrency(latest.real_estate_equity)}`);
    if (netWorthHistory.length >= 2) {
      const first = netWorthHistory[0];
      parts.push(`Earliest: ${formatCurrency(first.total_net_worth)} (${first.recorded_date})`);
      parts.push(`Data points: ${netWorthHistory.length}`);
    }
  }

  if (realEstate.length > 0) {
    parts.push('');
    parts.push('--- Real Estate ---');
    realEstate.forEach(p => {
      const equity = p.current_value - p.mortgage_balance;
      parts.push(`  - ${p.address}: Value=${formatCurrency(p.current_value)}, Mortgage=${formatCurrency(p.mortgage_balance)}, Equity=${formatCurrency(equity)}, Rate=${p.mortgage_rate}%, Payment=${formatCurrency(p.monthly_payment)}/mo${p.monthly_rent ? `, Rent=${formatCurrency(p.monthly_rent)}/mo` : ''}`);
    });
  }

  if (rsuGrants.length > 0) {
    parts.push('');
    parts.push('--- RSU Grants ---');
    rsuGrants.forEach(g => {
      parts.push(`  - ${g.company_ticker}: ${g.total_shares} total, ${g.vested_shares} vested, granted ${g.grant_date}, ${g.vest_frequency} vesting over ${g.vest_period_months}mo`);
    });
  }

  if (incomeTaxRecords.length > 0) {
    parts.push('');
    parts.push('--- Income & Tax ---');
    incomeTaxRecords.forEach(r => {
      parts.push(`  - ${r.tax_year} (${r.document_type}): Income=${formatCurrency(r.total_income)}, Tax=${formatCurrency(r.total_tax)}, Effective Rate=${r.effective_tax_rate}%, Employer=${r.employer}`);
    });
  }

  if (accounts.length > 0) {
    parts.push('');
    parts.push('--- Statement Snapshots ---');
    accounts.forEach(a => {
      parts.push(`  - ${a.account_type}: ${formatCurrency(a.total_value)}, ${a.holdings?.length || 0} holdings`);
    });
  }

  if (plaidAccounts.length > 0) {
    parts.push('');
    parts.push('--- Banking & Credit Cards (Plaid) ---');
    const bankTotal = plaidAccounts.filter(a => a.type === 'depository').reduce((sum, a) => sum + (a.currentBalance || 0), 0);
    const creditTotal = plaidAccounts.filter(a => a.type === 'credit').reduce((sum, a) => sum + (a.currentBalance || 0), 0);
    if (bankTotal > 0) parts.push(`Total Cash (checking/savings): ${formatCurrency(bankTotal)}`);
    if (creditTotal > 0) parts.push(`Total Credit Card Debt: ${formatCurrency(creditTotal)}`);
    plaidAccounts.forEach(a => {
      const balance = a.currentBalance !== null ? formatCurrency(Math.abs(a.currentBalance)) : 'N/A';
      parts.push(`  - ${a.institutionName}: ${a.officialName || a.name} (${a.subtype || a.type}) = ${a.type === 'credit' ? '-' : ''}${balance}`);
    });
  }

  // ── Page-local context (e.g., Monte Carlo sim results) ──

  if (localPageContext) {
    parts.push('');
    parts.push('--- Page-Specific Data ---');
    parts.push(localPageContext);
  }

  return parts.join('\n');
}

// ─── Component ──────────────────────────────────────────────────────

export default function ChatRail() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [persona, setPersona] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pageContext = usePageContextString();

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  // Clear chat on page nav
  const pathname = usePathname();
  useEffect(() => {
    setMessages([]);
  }, [pathname]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = { role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          pageContext,
          persona,
        }),
      });

      const data = await res.json();
      if (data.reply) {
        setMessages(prev => [...prev, { role: 'model', content: data.reply }]);
      } else if (data.error) {
        setMessages(prev => [...prev, { role: 'model', content: `⚠️ ${data.error}` }]);
      }
    } catch {
      setMessages(prev => [...prev, { role: 'model', content: '⚠️ Failed to connect. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, pageContext, persona]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const pageName = pathname?.replace(/^\//, '').replace(/-/g, ' ') || 'Dashboard';
  const pageLabel = pageName.charAt(0).toUpperCase() + pageName.slice(1);

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed right-4 bottom-20 lg:bottom-6 z-[60] w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg ${isOpen
          ? 'bg-accent/20 border border-accent/40 text-accent rotate-0'
          : 'bg-bg-elevated border border-border text-text-secondary hover:text-accent hover:border-accent/40'
          }`}
        title="Chat with AI"
      >
        {isOpen ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
      </button>

      {/* Backdrop (mobile) */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-[55] lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Chat Panel */}
      <div
        className={`fixed top-14 right-0 bottom-0 w-full sm:w-[380px] z-[56] flex flex-col transition-transform duration-300 ease-out ${isOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        style={{
          background: 'rgba(17, 17, 24, 0.97)',
          borderLeft: '1px solid var(--border)',
          backdropFilter: 'blur(20px)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className={persona ? (persona === 'ramsey' ? 'text-blue-400' : 'text-amber-400') : 'text-accent'} />
            <div>
              <h3 className="text-sm font-semibold text-text-primary">
                {persona === 'ramit' ? 'Ramit Mode' : persona === 'ramsey' ? 'Ramsey Mode' : 'AI Assistant'}
              </h3>
              <p className="text-sm text-text-secondary">
                Viewing: {pageLabel}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setPersona(persona === 'ramit' ? null : 'ramit');
                setMessages([]);
              }}
              className={`text-sm font-medium px-2.5 py-1 rounded-lg transition-all ${persona === 'ramit'
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : 'text-text-secondary hover:text-amber-400 hover:bg-amber-500/10 border border-transparent'
                }`}
              title={persona === 'ramit' ? 'Switch to standard AI' : 'Switch to Ramit mode'}
            >
              Ramit
            </button>
            <button
              onClick={() => {
                setPersona(persona === 'ramsey' ? null : 'ramsey');
                setMessages([]);
              }}
              className={`text-sm font-medium px-2.5 py-1 rounded-lg transition-all ${persona === 'ramsey'
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                : 'text-text-secondary hover:text-blue-400 hover:bg-blue-500/10 border border-transparent'
                }`}
              title={persona === 'ramsey' ? 'Switch to standard AI' : 'Switch to Ramsey mode'}
            >
              Ramsey
            </button>
            <button
              onClick={() => {
                setMessages([]);
              }}
              className="text-sm text-text-secondary hover:text-text-primary transition-colors px-2 py-1 rounded hover:bg-white/5"
              title="Clear chat"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {messages.length === 0 && (
            <div className="text-center py-8">
              <MessageSquare size={32} className="text-text-secondary/40 mx-auto mb-3" />
              <p className="text-sm text-text-secondary mb-1">
                Ask me anything about your finances.
              </p>
              <p className="text-sm text-text-secondary/60">
                {persona === 'ramit'
                  ? 'I\'ll respond using Ramit Sethi\'s financial philosophy and style.'
                  : persona === 'ramsey'
                    ? 'I\'ll respond using Dave Ramsey\'s Baby Steps and debt-free philosophy.'
                    : 'I have access to all your financial data across every page.'
                }
              </p>
              {/* Suggested prompts */}
              <div className="mt-4 space-y-2">
                {getSuggestions(pathname || '').map((s, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setInput(s);
                      setTimeout(() => inputRef.current?.focus(), 50);
                    }}
                    className="block w-full text-left text-sm text-text-secondary hover:text-text-primary px-3 py-2 rounded-lg border border-border/50 hover:border-accent/30 hover:bg-accent/5 transition-all"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${msg.role === 'user'
                  ? 'bg-accent/20 text-text-primary rounded-br-md'
                  : 'bg-bg-elevated border border-border/50 text-text-primary rounded-bl-md'
                  }`}
              >
                <MessageContent content={msg.content} />
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-bg-elevated border border-border/50 rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex gap-1.5">
                  <span className="w-2 h-2 bg-text-secondary/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-text-secondary/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-text-secondary/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="flex-shrink-0 border-t border-border p-3">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your finances..."
              rows={1}
              className="flex-1 bg-bg-elevated border border-border rounded-xl px-3 py-2.5 text-sm text-text-primary placeholder:text-text-secondary/50 resize-none focus:outline-none focus:border-accent/50 transition-colors"
              style={{ maxHeight: '120px' }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
              }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              className="flex-shrink-0 w-10 h-10 rounded-xl bg-accent/20 text-accent border border-accent/30 flex items-center justify-center transition-all hover:bg-accent/30 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
          <p className="text-[9px] text-text-secondary/40 mt-1.5 text-center">
            AI responses are for educational purposes only. Not financial advice.
          </p>
        </div>
      </div>
    </>
  );
}

// ─── Message Renderer ───────────────────────────────────────────────

function MessageContent({ content }: { content: string }) {
  // Simple markdown-like rendering: bold, bullets, line breaks
  const lines = content.split('\n');

  return (
    <div className="space-y-1.5">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} className="h-1" />;

        // Bullet points
        const isBullet = /^[•\-\*]\s/.test(trimmed);
        const text = isBullet ? trimmed.replace(/^[•\-\*]\s*/, '') : trimmed;

        // Bold text
        const rendered = text.split(/(\*\*[^*]+\*\*)/).map((part, j) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={j} className="font-semibold text-text-primary">{part.slice(2, -2)}</strong>;
          }
          return <span key={j}>{part}</span>;
        });

        if (isBullet) {
          return (
            <div key={i} className="flex gap-1.5 pl-1">
              <span className="text-text-secondary/60 flex-shrink-0">•</span>
              <span>{rendered}</span>
            </div>
          );
        }

        return <p key={i}>{rendered}</p>;
      })}
    </div>
  );
}

// ─── Suggested Prompts ──────────────────────────────────────────────

function getSuggestions(pathname: string): string[] {
  if (pathname === '/' || pathname === '/dashboard') {
    return [
      'How am I tracking toward FIRE?',
      'Summarize my financial snapshot',
      'What should I focus on this month?',
    ];
  }
  if (pathname.startsWith('/portfolio')) {
    return [
      'Is my portfolio well diversified?',
      'What are my top concentration risks?',
      'How does my allocation compare to a target-date fund?',
    ];
  }
  if (pathname === '/net-worth') {
    return [
      'What is my net worth trend?',
      'Which asset category grew the most?',
      'How does my net worth compare to benchmarks?',
    ];
  }
  if (pathname === '/real-estate') {
    return [
      'What is my total real estate equity?',
      'Should I consider refinancing any property?',
      'How do my rental yields compare?',
    ];
  }
  if (pathname === '/equity') {
    return [
      'When is my next vesting event?',
      'How much have my RSUs vested to date?',
      'Should I diversify out of company stock?',
    ];
  }
  if (pathname === '/fire-score') {
    return [
      'How can I improve my FIRE score?',
      'What savings rate do I need to retire by 2028?',
      'Break down my FIRE score factors',
    ];
  }
  if (pathname === '/monte-carlo') {
    return [
      'What does my success rate mean?',
      'What would happen if I retired 2 years earlier?',
      'How sensitive is my plan to market downturns?',
    ];
  }
  if (pathname === '/income-tax') {
    return [
      'Summarize my tax situation',
      'How can I reduce my tax burden?',
      'What is my effective vs marginal tax rate?',
    ];
  }
  if (pathname === '/statements') {
    return [
      'Summarize my account balances',
      'Which accounts have changed the most?',
      'What trends do you see in my statements?',
    ];
  }
  return [
    'Summarize my financial data',
    'What should I be thinking about?',
    'Any red flags in my finances?',
  ];
}
