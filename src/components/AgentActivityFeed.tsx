import React from 'react';
import { AgentActionLog } from '../types/agent';
import { Activity, CheckCircle2, Clock, PlayCircle, AlertCircle } from 'lucide-react';

interface AgentActivityFeedProps {
  logs: AgentActionLog[];
}

export const AgentActivityFeed: React.FC<AgentActivityFeedProps> = ({ logs }) => {
  return (
    <div className="rounded-2xl bg-[#12161F] border border-[#252A36] p-5">
      <div className="flex items-center gap-2 pb-3 mb-3 border-b border-[#252A36]">
        <span className="p-1 rounded-md bg-amber-500/10 text-amber-400">
          <Activity className="w-4 h-4" />
        </span>
        <h3 className="text-sm font-semibold text-slate-100">Agent Activity Stream</h3>
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
        {logs.length === 0 ? (
          <p className="text-xs text-slate-400 py-3 text-center">No agent actions recorded yet.</p>
        ) : (
          logs.slice(-10).reverse().map((log) => {
            const isDone = log.status === 'COMPLETED';
            const isRunning = log.status === 'STARTED';

            return (
              <div
                key={log.id}
                className="p-2.5 rounded-xl bg-[#0E121A] border border-[#1E232E] flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {isDone ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  ) : isRunning ? (
                    <span className="w-3 h-3 rounded-full border-2 border-amber-400 border-t-transparent animate-spin shrink-0" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  )}
                  <span className="text-slate-300 font-medium truncate">{log.description}</span>
                </div>

                <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400 shrink-0 ml-2">
                  <span className="px-1.5 py-0.5 rounded bg-[#1B212D] text-slate-400 border border-[#252A36]">
                    v{log.datasetVersion}.0
                  </span>
                  <span>{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
