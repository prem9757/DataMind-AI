import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  Send,
  Sparkles,
  Code2,
  ChevronDown,
  ChevronUp,
  User,
  ArrowRight,
  Lightbulb,
  CheckCircle2,
  Copy,
  Check,
  TrendingUp,
  AlertCircle,
  Table,
  Trash2,
  Compass,
  FileSpreadsheet,
  Zap,
  Info
} from 'lucide-react';
import { DatasetState, ChatMessage } from '../types/dataset';
import { askDataAnalyst } from '../services/aiAnalyst';
import { ChartViewer } from './ChartViewer';
import { Sigma, BrainCircuit } from 'lucide-react';

interface AIAnalystProps {
  dataset: DatasetState;
  initialQuery?: string;
  onClearInitialQuery?: () => void;
  onNavigate?: (section: any) => void;
}

export const AIAnalyst: React.FC<AIAnalystProps> = ({
  dataset,
  initialQuery,
  onClearInitialQuery,
  onNavigate
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [expandedCodeId, setExpandedCodeId] = useState<string | null>(null);
  const [expandedTableId, setExpandedTableId] = useState<string | null>(null);
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize with senior analyst welcome and contextual starter queries
  useEffect(() => {
    if (messages.length === 0) {
      const welcomeMessage: ChatMessage = {
        id: 'msg-welcome',
        sender: 'assistant',
        timestamp: Date.now(),
        text: `Hello! I am your Senior Data Analyst. I have profiled and indexed **"${dataset.name}"** (${dataset.workingRows.length.toLocaleString()} records, ${dataset.columns.length} columns). You can ask me any analytical, ranking, trend, outlier, or cross-tabulation question using natural language.`,
        directAnswer: `Dataset **"${dataset.name}"** is fully loaded in working memory. Every answer is deterministically verified with Python/Pandas logic and accompanied by supporting evidence, visualizations, and strategic business takeaways.`,
        supportingMetrics: [
          { label: 'Working Rows', value: dataset.workingRows.length.toLocaleString() },
          { label: 'Total Columns', value: dataset.columns.length },
          { label: 'Quality Score', value: `${dataset.quality.score}/100` },
          { label: 'Analyst Engine', value: 'Active' }
        ],
        suggestedFollowUps: dataset.suggestedQuestions.slice(0, 4)
      };
      setMessages([welcomeMessage]);
    }
  }, [dataset.id]);

  // Handle external query triggers
  useEffect(() => {
    if (initialQuery && initialQuery.trim()) {
      handleSendMessage(initialQuery);
      if (onClearInitialQuery) onClearInitialQuery();
    }
  }, [initialQuery]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSendMessage = async (queryText?: string) => {
    const textToSend = queryText || inputQuery;
    if (!textToSend.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      timestamp: Date.now(),
      text: textToSend
    };

    setMessages(prev => [...prev, userMessage]);
    setInputQuery('');
    setIsLoading(true);

    try {
      const response = await askDataAnalyst(textToSend, {
        datasetName: dataset.name,
        rows: dataset.workingRows,
        columns: dataset.columns,
        profiles: dataset.profiles,
        conversationHistory: messages
      });

      setMessages(prev => [...prev, response]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: 'assistant',
        timestamp: Date.now(),
        text: `I encountered an issue executing this analytical query: ${err.message || 'Processing error'}. Please try rephrasing with specific column terms.`
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCodeId(id);
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  const handleClearChat = () => {
    const welcomeMessage: ChatMessage = {
      id: `msg-welcome-${Date.now()}`,
      sender: 'assistant',
      timestamp: Date.now(),
      text: `Chat session refreshed. Ask any question about **"${dataset.name}"**...`,
      directAnswer: `Session cleared. Ready for new analytical queries against **"${dataset.name}"**.`,
      suggestedFollowUps: dataset.suggestedQuestions.slice(0, 4)
    };
    setMessages([welcomeMessage]);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto flex flex-col h-[calc(100vh-80px)]">
      {/* Header Bar */}
      <div className="flex items-center justify-between pb-4 border-b border-[#252A36] shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-md shadow-amber-500/10">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-slate-100">
                AI-Powered Analytics
              </h1>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-mono font-bold uppercase">
                Ready
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Ask questions about your data in natural language and receive grounded insights.
            </p>
          </div>
        </div>

        <button
          onClick={handleClearChat}
          className="px-3 py-1.5 rounded-xl bg-[#12151C] border border-[#252A36] hover:bg-[#181D26] text-xs font-semibold text-slate-400 hover:text-rose-300 transition flex items-center gap-1.5 cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Clear Chat</span>
        </button>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto py-4 space-y-6 custom-scrollbar pr-2">
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.sender === 'assistant' && (
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
                <Bot className="w-4 h-4" />
              </div>
            )}

            <div
              className={`max-w-3xl rounded-2xl p-5 space-y-4 shadow-xl ${
                msg.sender === 'user'
                  ? 'bg-amber-500 text-slate-950 font-medium rounded-br-none'
                  : 'bg-[#12151C] border border-[#252A36] text-slate-200 rounded-bl-none'
              }`}
            >
              {/* Intent / Execution Header (for Assistant messages) */}
              {msg.sender === 'assistant' && msg.intent && (
                <div className="flex items-center justify-between border-b border-[#252A36] pb-2 text-[10px] font-mono text-slate-400">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 font-bold uppercase">
                      {msg.intent} INTENT
                    </span>
                    {msg.executionTimeMs && (
                      <span className="text-slate-500">
                        Executed in {msg.executionTimeMs}ms
                      </span>
                    )}
                  </div>

                  {msg.plan && (
                    <button
                      onClick={() =>
                        setExpandedPlanId(expandedPlanId === msg.id ? null : msg.id)
                      }
                      className="text-slate-400 hover:text-amber-400 transition flex items-center gap-1 cursor-pointer"
                    >
                      <Compass className="w-3 h-3" />
                      <span>{expandedPlanId === msg.id ? 'Hide Plan' : 'View Analysis Plan'}</span>
                    </button>
                  )}
                </div>
              )}

              {/* Analysis Plan Expandable */}
              {expandedPlanId === msg.id && msg.plan && (
                <div className="p-3 bg-[#0B0D11] rounded-xl border border-[#252A36] text-[11px] font-mono space-y-1 text-slate-300">
                  <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">
                    Structured Analysis Plan:
                  </span>
                  <p><strong className="text-slate-400">Intent:</strong> {msg.plan.intent}</p>
                  {msg.plan.primaryDimension && <p><strong className="text-slate-400">Dimension:</strong> {msg.plan.primaryDimension}</p>}
                  {msg.plan.metricColumn && <p><strong className="text-slate-400">Metric:</strong> {msg.plan.metricColumn}</p>}
                  <p><strong className="text-slate-400">Aggregation:</strong> {msg.plan.aggregation}</p>
                  <p><strong className="text-slate-400">Reasoning:</strong> {msg.plan.reasoning}</p>
                </div>
              )}

              {/* Direct Answer (ANSWER) */}
              {msg.directAnswer ? (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-amber-400 text-xs font-mono font-bold uppercase tracking-wider">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Analytical Finding</span>
                  </div>
                  <p className="text-sm font-semibold text-slate-100 leading-relaxed">
                    {msg.directAnswer}
                  </p>
                </div>
              ) : (
                <p className="text-xs leading-relaxed whitespace-pre-wrap">{msg.text}</p>
              )}

              {/* Supporting KPI Metrics Cards (EVIDENCE) */}
              {msg.supportingMetrics && msg.supportingMetrics.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  {msg.supportingMetrics.map((kpi, idx) => (
                    <div
                      key={idx}
                      className="bg-[#0B0D11] border border-[#252A36] rounded-xl p-2.5 space-y-0.5"
                    >
                      <span className="text-[10px] text-slate-500 uppercase font-mono font-semibold">{kpi.label}</span>
                      <p className="text-xs font-bold text-amber-400 font-mono mt-0.5">{kpi.value}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Automatic Visualization Chart */}
              {msg.chartData && (
                <div className="pt-2">
                  <ChartViewer
                    type={msg.chartData.type}
                    title={msg.chartData.title}
                    data={msg.chartData.data}
                    xAxisKey={msg.chartData.xAxisLabel || Object.keys(msg.chartData.data[0] || {})[0]}
                    yAxisKey={msg.chartData.yAxisLabel || Object.keys(msg.chartData.data[0] || {})[1]}
                    keys={msg.chartData.keys}
                    height={260}
                    allowFullscreen={false}
                  />
                </div>
              )}

              {/* Supporting Data Table Drawer Toggle */}
              {msg.tableData && (
                <div className="pt-1">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() =>
                        setExpandedTableId(expandedTableId === msg.id ? null : msg.id)
                      }
                      className="text-[11px] font-mono font-medium text-slate-400 hover:text-amber-400 transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-amber-400" />
                      <span>{expandedTableId === msg.id ? 'Hide Supporting Data' : 'View Supporting Data Table'}</span>
                      {expandedTableId === msg.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                  </div>

                  {expandedTableId === msg.id && (
                    <div className="mt-2 overflow-x-auto custom-scrollbar bg-[#0B0D11] rounded-xl border border-[#252A36] p-3">
                      <table className="w-full text-left text-xs font-mono">
                        <thead>
                          <tr className="border-b border-[#252A36] text-slate-400 text-[10px] uppercase">
                            {msg.tableData.headers.map((h, i) => (
                              <th key={i} className="p-2 font-semibold">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#252A36] text-[11px]">
                          {msg.tableData.rows.map((row, rIdx) => (
                            <tr key={rIdx} className="hover:bg-[#181D26] transition">
                              {row.map((cell, cIdx) => (
                                <td key={cIdx} className="p-2 text-slate-300">
                                  {typeof cell === 'number' ? cell.toLocaleString() : String(cell)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Step-by-Step Logic Explanation */}
              {msg.explanation && (
                <div className="bg-[#0B0D11] rounded-xl p-3 border border-[#252A36] text-xs text-slate-400 space-y-1">
                  <span className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-wider block">
                    Mathematical Validation
                  </span>
                  <p className="text-[11px] leading-relaxed">{msg.explanation}</p>
                </div>
              )}

              {/* Strategic Business Takeaway (BUSINESS INTERPRETATION) */}
              {msg.businessImplication && (
                <div className="bg-amber-500/10 rounded-xl p-3 border border-amber-500/20 text-xs text-amber-300 space-y-1">
                  <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                    <Zap className="w-3.5 h-3.5" /> Business Interpretation &amp; Takeaway
                  </span>
                  <p className="text-[11px] text-slate-200 leading-relaxed">{msg.businessImplication}</p>
                </div>
              )}

              {/* Expandable Python / Pandas Code Verification */}
              {msg.pythonCode && (
                <div className="pt-1">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() =>
                        setExpandedCodeId(expandedCodeId === msg.id ? null : msg.id)
                      }
                      className="text-[11px] font-mono font-medium text-slate-400 hover:text-amber-400 transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <Code2 className="w-3.5 h-3.5" />
                      <span>{expandedCodeId === msg.id ? 'Hide Analysis Code' : 'View Analysis Code (Python / Pandas)'}</span>
                      {expandedCodeId === msg.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>

                    {expandedCodeId === msg.id && (
                      <button
                        onClick={() => handleCopyCode(msg.pythonCode!, msg.id)}
                        className="text-[10px] text-slate-400 hover:text-slate-200 flex items-center gap-1 bg-[#181D26] px-2 py-0.5 rounded cursor-pointer"
                      >
                        {copiedCodeId === msg.id ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" /> Copied
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" /> Copy Code
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {expandedCodeId === msg.id && (
                    <pre className="mt-2 p-3 bg-[#0B0D11] rounded-xl border border-[#252A36] text-[11px] font-mono text-amber-300/90 overflow-x-auto custom-scrollbar">
                      {msg.pythonCode}
                    </pre>
                  )}
                </div>
              )}

              {/* Suggested Follow-up Questions */}
              {msg.suggestedFollowUps && msg.suggestedFollowUps.length > 0 && (
                <div className="pt-2 space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block font-mono">
                    Suggested Next Questions:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {msg.suggestedFollowUps.map((q, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSendMessage(q)}
                        className="px-2.5 py-1 rounded-lg bg-[#181D26] hover:bg-[#202733] border border-[#2D3342] text-[11px] text-slate-300 hover:text-amber-300 transition flex items-center gap-1 text-left cursor-pointer"
                      >
                        <span>{q}</span>
                        <ArrowRight className="w-3 h-3 shrink-0 text-amber-400" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Next Analytical Actions (Guided Workflow) */}
              {onNavigate && msg.sender === 'assistant' && (
                <div className="pt-2 border-t border-[#202634] flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-mono font-bold text-slate-500 uppercase">Workflow:</span>
                  <button
                    onClick={() => onNavigate('statistics')}
                    className="px-2.5 py-1 rounded-lg bg-[#12151C] hover:bg-[#181D26] border border-[#2B3242] text-[11px] text-slate-300 hover:text-amber-300 transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Sigma className="w-3 h-3 text-amber-400" />
                    <span>Run Statistical Test</span>
                  </button>
                  <button
                    onClick={() => onNavigate('ml')}
                    className="px-2.5 py-1 rounded-lg bg-[#12151C] hover:bg-[#181D26] border border-[#2B3242] text-[11px] text-slate-300 hover:text-amber-300 transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <BrainCircuit className="w-3 h-3 text-amber-400" />
                    <span>Try Machine Learning</span>
                  </button>
                </div>
              )}
            </div>

            {msg.sender === 'user' && (
              <div className="w-8 h-8 rounded-xl bg-[#181D26] border border-[#2D3342] flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
                <User className="w-4 h-4" />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-3 items-center text-slate-400 text-xs font-medium pl-11">
            <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
            <span>Analyzing dataset dimensions, executing plan, and validating results...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Starters (if conversation is fresh) */}
      {messages.length <= 1 && dataset.suggestedQuestions.length > 0 && (
        <div className="py-2 flex items-center gap-1.5 overflow-x-auto custom-scrollbar shrink-0">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider shrink-0 mr-1 font-mono">
            Try:
          </span>
          {dataset.suggestedQuestions.map((q, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(q)}
              className="px-2.5 py-1 rounded-full bg-[#12151C] border border-[#252A36] hover:border-amber-500/40 text-[11px] text-slate-300 hover:text-white transition whitespace-nowrap shrink-0 cursor-pointer"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input Box */}
      <div className="pt-3 border-t border-[#252A36] shrink-0">
        <form
          onSubmit={e => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={inputQuery}
            onChange={e => setInputQuery(e.target.value)}
            placeholder={`Ask anything about your dataset... (e.g., Which region has highest revenue? Show monthly trend)`}
            className="flex-1 bg-[#12151C] border border-[#252A36] rounded-xl px-4 py-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 shadow-inner"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!inputQuery.trim() || isLoading}
            className="px-5 py-3 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1.5 cursor-pointer"
          >
            <span>Ask</span>
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
};
