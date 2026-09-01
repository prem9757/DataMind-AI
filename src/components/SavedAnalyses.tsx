import React, { useState, useEffect } from 'react';
import {
  Bookmark,
  Sparkles,
  Play,
  Copy,
  Trash2,
  Tag,
  Search,
  Bot,
  BrainCircuit,
  BarChart3,
  Sigma,
  Calendar
} from 'lucide-react';
import { SavedAnalysis } from '../types/production';
import { SessionManager } from '../services/sessionManager';
import { DatasetState } from '../types/dataset';

interface SavedAnalysesProps {
  dataset: DatasetState | null;
  onOpenAIQuery?: (query: string) => void;
  onNavigateSection?: (section: string) => void;
}

export function SavedAnalyses({ dataset, onOpenAIQuery, onNavigateSection }: SavedAnalysesProps) {
  const [analyses, setAnalyses] = useState<SavedAnalysis[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('ALL');

  useEffect(() => {
    setAnalyses(SessionManager.loadAnalyses());
  }, []);

  const allTags = Array.from(new Set(analyses.flatMap(a => a.tags)));

  const filtered = analyses.filter(a => {
    const matchesSearch =
      a.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (a.description && a.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (a.resultSummary && a.resultSummary.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesTag = selectedTag === 'ALL' || a.tags.includes(selectedTag);
    return matchesSearch && matchesTag;
  });

  const handleDelete = (id: string) => {
    const updated = analyses.filter(a => a.id !== id);
    setAnalyses(updated);
    SessionManager.saveAnalyses(updated);
  };

  const handleDuplicate = (analysis: SavedAnalysis) => {
    const dup: SavedAnalysis = {
      ...analysis,
      id: `analysis-${Date.now()}`,
      title: `${analysis.title} (Copy)`,
      createdAt: Date.now()
    };
    const updated = [dup, ...analyses];
    setAnalyses(updated);
    SessionManager.saveAnalyses(updated);
  };

  const handleRun = (analysis: SavedAnalysis) => {
    if (analysis.query && onOpenAIQuery) {
      onOpenAIQuery(analysis.query);
    } else if (onNavigateSection) {
      if (analysis.type === 'ml_model') onNavigateSection('ml');
      else if (analysis.type === 'statistical_test') onNavigateSection('statistics');
      else onNavigateSection('eda');
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#252A36] pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Bookmark className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                Saved Analyses
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Access your saved queries, models, chart configurations, and reusable analytical playbooks
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Tag Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="flex-1 flex items-center gap-2 bg-[#0F1218] border border-[#252A36] rounded-xl px-3.5 py-2">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search saved analyses by title, metrics, or keywords..."
            className="bg-transparent text-xs text-slate-200 placeholder-slate-500 focus:outline-none flex-1"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar p-1 bg-[#131720] border border-[#252A36] rounded-xl text-xs font-medium">
          <button
            onClick={() => setSelectedTag('ALL')}
            className={`px-3 py-1 rounded-lg transition-colors whitespace-nowrap ${
              selectedTag === 'ALL' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All Tags
          </button>
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => setSelectedTag(tag)}
              className={`px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap ${
                selectedTag === tag ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Analyses Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map(a => {
          const isML = a.type === 'ml_model';
          const isStats = a.type === 'statistical_test';
          const isChart = a.type === 'chart';

          return (
            <div
              key={a.id}
              className="bg-[#0F1218] border border-[#252A36] rounded-2xl p-5 space-y-4 hover:border-[#333A4C] transition-colors flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-[#181D26] border border-[#252A36] text-amber-400">
                      {isML ? <BrainCircuit className="w-4 h-4" /> : isStats ? <Sigma className="w-4 h-4" /> : isChart ? <BarChart3 className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-100">{a.title}</h3>
                      <p className="text-[10px] font-mono text-slate-500 mt-0.5">
                        Dataset: {a.datasetName} ({a.datasetVersion})
                      </p>
                    </div>
                  </div>

                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold">
                    {a.type.replace('_', ' ')}
                  </span>
                </div>

                {a.description && (
                  <p className="text-xs text-slate-300 leading-relaxed">{a.description}</p>
                )}

                {a.resultSummary && (
                  <div className="bg-[#0B0D11] border border-[#202530] rounded-xl p-3 text-xs text-slate-300 font-mono">
                    <span className="text-[10px] text-amber-400 uppercase font-bold block mb-1">Key Empirical Finding:</span>
                    {a.resultSummary}
                  </div>
                )}

                {/* Tags */}
                <div className="flex flex-wrap gap-1.5">
                  {a.tags.map(t => (
                    <span key={t} className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#181D26] text-slate-400 border border-[#252A36]">
                      #{t}
                    </span>
                  ))}
                </div>
              </div>

              {/* Actions Footer */}
              <div className="pt-3 border-t border-[#202530] flex items-center justify-between">
                <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-500" />
                  {new Date(a.createdAt).toLocaleDateString()}
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleDuplicate(a)}
                    title="Duplicate Analysis"
                    className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-[#181D26] rounded-lg transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(a.id)}
                    title="Delete Analysis"
                    className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleRun(a)}
                    className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors"
                  >
                    <Play className="w-3.5 h-3.5" />
                    Run Analysis
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
