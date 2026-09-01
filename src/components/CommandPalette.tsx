import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  LayoutDashboard,
  Database,
  ShieldCheck,
  Wand2,
  Sparkles,
  BarChart3,
  Bot,
  Sigma,
  BrainCircuit,
  FileText,
  Activity,
  Settings,
  Upload,
  Zap,
  ArrowRight,
  X,
  Compass
} from 'lucide-react';
import { NavSection } from './Sidebar';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (section: NavSection) => void;
  onSelectQuery?: (query: string) => void;
}

export function CommandPalette({
  isOpen,
  onClose,
  onNavigate,
  onSelectQuery
}: CommandPaletteProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commandGroups = [
    {
      group: 'Workspace Navigation',
      items: [
        { id: 'nav-upload', title: 'Data Ingestion', icon: Upload, section: 'upload' as NavSection, shortcut: 'G U' },
        { id: 'nav-overview', title: 'Data Exploration', icon: Wand2, section: 'overview' as NavSection, shortcut: 'G X' },
        { id: 'nav-quality', title: 'Data Quality Assessment', icon: ShieldCheck, section: 'quality' as NavSection, shortcut: 'G Q' },
        { id: 'nav-clean', title: 'Data Preparation', icon: Sparkles, section: 'cleaning' as NavSection, shortcut: 'G C' },
        { id: 'nav-eda', title: 'Automated Exploratory Data Analysis', icon: BarChart3, section: 'eda' as NavSection, shortcut: 'G E' },
        { id: 'nav-vis', title: 'Data Visualization', icon: BarChart3, section: 'visualizations' as NavSection, shortcut: 'G V' },
        { id: 'nav-dash', title: 'Executive Dashboard', icon: LayoutDashboard, section: 'dashboard' as NavSection, shortcut: 'G D' },
        { id: 'nav-ai', title: 'AI-Powered Analytics', icon: Bot, section: 'ai_analyst' as NavSection, shortcut: 'Ctrl+/' },
        { id: 'nav-stats', title: 'Statistical Analysis', icon: Sigma, section: 'statistics' as NavSection, shortcut: 'G S' },
        { id: 'nav-ml', title: 'Machine Learning', icon: BrainCircuit, section: 'ml' as NavSection, shortcut: 'G M' },
        { id: 'nav-agent', title: 'Autonomous Analytics Agent', icon: Compass, section: 'investigations' as NavSection, shortcut: 'G A' },
        { id: 'nav-rep', title: 'Reports & Export', icon: FileText, section: 'reports' as NavSection, shortcut: 'G R' }
      ]
    },
    {
      group: 'Quick Actions',
      items: [
        { id: 'act-upload', title: 'Upload New CSV or Excel File', icon: Upload, section: 'upload' as NavSection }
      ]
    },
    {
      group: 'Natural Language Questions',
      items: [
        { id: 'q-1', title: 'Which category generated the highest total volume and margin?', icon: Bot, query: 'Which category generated the highest total volume and margin?' },
        { id: 'q-2', title: 'What is the correlation between price and demand?', icon: Bot, query: 'What is the correlation between price and demand?' },
        { id: 'q-3', title: 'Generate an executive analytics summary report', icon: FileText, query: 'Generate an executive analytics summary report' }
      ]
    }
  ];

  // Flatten for keyboard arrow navigation
  const allItems = commandGroups.flatMap(g => g.items.filter(item =>
    item.title.toLowerCase().includes(searchTerm.toLowerCase())
  ));

  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev < allItems.length - 1 ? prev + 1 : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : allItems.length - 1));
      } else if (e.key === 'Enter' && allItems[selectedIndex]) {
        e.preventDefault();
        handleExecute(allItems[selectedIndex]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, allItems]);

  const handleExecute = (item: any) => {
    onClose();
    if (item.query && onSelectQuery) {
      onSelectQuery(item.query);
      onNavigate('ai_analyst');
    } else if (item.section) {
      onNavigate(item.section);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-xl bg-[#0F1218] border border-[#252A36] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[75vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Search Header */}
        <div className="flex items-center px-4 py-3.5 border-b border-[#252A36] gap-3 bg-[#131720]">
          <Search className="w-5 h-5 text-amber-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={e => {
              setSearchTerm(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Type a command, page name, or analytical query..."
            className="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
          />
          <kbd className="text-[10px] font-mono px-2 py-1 bg-[#1A1F2B] border border-[#2B3242] text-slate-400 rounded">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-2 custom-scrollbar space-y-4">
          {allItems.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              No matching commands or pages found for "{searchTerm}"
            </div>
          ) : (
            commandGroups.map(group => {
              const groupItems = group.items.filter(item =>
                item.title.toLowerCase().includes(searchTerm.toLowerCase())
              );
              if (groupItems.length === 0) return null;

              return (
                <div key={group.group} className="space-y-1">
                  <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 px-3 pt-2">
                    {group.group}
                  </p>
                  {groupItems.map(item => {
                    const globalIdx = allItems.indexOf(item);
                    const isSelected = globalIdx === selectedIndex;
                    const Icon = item.icon;

                    return (
                      <button
                        key={item.id}
                        onClick={() => handleExecute(item)}
                        onMouseEnter={() => setSelectedIndex(globalIdx)}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left text-xs transition-colors ${
                          isSelected
                            ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                            : 'text-slate-300 hover:bg-[#181D26] border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className={`w-4 h-4 ${isSelected ? 'text-amber-400' : 'text-slate-400'}`} />
                          <span className="font-medium">{item.title}</span>
                        </div>
                        {'shortcut' in item && item.shortcut ? (
                          <span className="text-[10px] font-mono text-slate-500">{item.shortcut}</span>
                        ) : (
                          <ArrowRight className={`w-3.5 h-3.5 opacity-0 ${isSelected ? 'opacity-100 text-amber-400' : ''}`} />
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts hint */}
        <div className="px-4 py-2 bg-[#0B0D11] border-t border-[#252A36] flex items-center justify-between text-[11px] text-slate-500 font-mono">
          <div className="flex items-center gap-3">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>Esc Close</span>
          </div>
          <span className="text-amber-400">Ctrl + K to toggle anytime</span>
        </div>
      </div>
    </div>
  );
}
