import React, { useState, useEffect } from 'react';
import { Database } from 'lucide-react';
import { DatasetState } from '../types/dataset';
import { globalDatasetEngine } from '../services/datasetEngine';

interface TopNavProps {
  dataset: DatasetState | null;
  onOpenReport?: () => void;
  onOpenAIAnalyst?: () => void;
  onOpenCommandPalette?: () => void;
  onOpenProcessingCenter?: () => void;
}

export const TopNav: React.FC<TopNavProps> = ({
  dataset
}) => {
  const [currentVersion, setCurrentVersion] = useState(1);

  useEffect(() => {
    const unsubDS = globalDatasetEngine.subscribe((list, activeId) => {
      const active = list.find(d => d.id === activeId);
      if (active) {
        setCurrentVersion(active.currentVersion);
      }
    });

    return () => {
      unsubDS();
    };
  }, []);

  return (
    <header className="h-16 bg-[#0B0D11]/90 backdrop-blur-md border-b border-[#252A36] px-6 flex items-center justify-between shrink-0 sticky top-0 z-30">
      {/* Left: Dataset metadata & Version Badge */}
      <div className="flex items-center gap-4 min-w-0">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-amber-400 shrink-0" />
          <h2 className="text-sm font-semibold text-slate-100 truncate max-w-xs" title={dataset?.name || 'No Dataset'}>
            {dataset ? dataset.name : 'Smart Data Analysis Assistant'}
          </h2>
          {dataset && (
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#181D26] border border-[#2B3242] text-amber-400">
              v{currentVersion}.0
            </span>
          )}
        </div>
      </div>
    </header>
  );
};
