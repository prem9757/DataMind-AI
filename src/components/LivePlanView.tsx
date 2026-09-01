import React from 'react';
import { InvestigationPlan, AgentTask } from '../types/agent';
import { CheckCircle2, Clock, PlayCircle, AlertCircle, ArrowRight, Layers } from 'lucide-react';

interface LivePlanViewProps {
  plan?: InvestigationPlan;
  currentTaskId?: string;
  onExecuteTask?: (task: AgentTask) => void;
  isAssistedMode?: boolean;
}

export const LivePlanView: React.FC<LivePlanViewProps> = ({
  plan,
  currentTaskId,
  onExecuteTask,
  isAssistedMode
}) => {
  if (!plan) {
    return (
      <div className="p-6 rounded-2xl bg-[#12161F] border border-[#252A36] text-center text-slate-400 text-sm">
        No active analysis plan generated yet.
      </div>
    );
  }

  const completedCount = plan.tasks.filter(t => t.status === 'completed').length;
  const progressPct = plan.tasks.length > 0 ? (completedCount / plan.tasks.length) * 100 : 0;

  return (
    <div className="rounded-2xl bg-[#12161F] border border-[#252A36] p-5">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#252A36]">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-md bg-amber-500/10 text-amber-400">
              <Layers className="w-4 h-4" />
            </span>
            <h3 className="text-sm font-semibold text-slate-100">Live Execution Plan</h3>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-xl truncate">{plan.rationale}</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-xs font-mono text-amber-400 font-semibold">{completedCount}/{plan.tasks.length} Tasks</span>
            <div className="w-24 h-1.5 bg-[#1B212D] rounded-full overflow-hidden mt-1">
              <div
                className="h-full bg-amber-500 transition-all duration-300 rounded-full"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Task List */}
      <div className="space-y-2.5">
        {plan.tasks.map((task, idx) => {
          const isCurrent = task.id === currentTaskId || task.status === 'running';
          const isDone = task.status === 'completed';
          const isFailed = task.status === 'failed';

          return (
            <div
              key={task.id}
              className={`p-3 rounded-xl border transition-all text-xs flex items-center justify-between ${
                isCurrent
                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-200'
                  : isDone
                  ? 'bg-[#181D26] border-[#252A36] text-slate-200'
                  : isFailed
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                  : 'bg-[#0E121A] border-[#1E232E] text-slate-400'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-5 h-5 flex items-center justify-center shrink-0">
                  {isDone ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : isCurrent ? (
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
                  ) : isFailed ? (
                    <AlertCircle className="w-4 h-4 text-rose-400" />
                  ) : (
                    <span className="w-4 h-4 rounded-full border border-slate-600 flex items-center justify-center text-[10px] text-slate-400 font-mono">
                      {idx + 1}
                    </span>
                  )}
                </span>

                <div className="min-w-0">
                  <div className="font-medium text-slate-200 truncate flex items-center gap-2">
                    <span>{task.title}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#202634] text-slate-400 border border-[#2D3444]">
                      {task.toolName}
                    </span>
                  </div>
                  {task.resultSummary && (
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">{task.resultSummary}</p>
                  )}
                  {task.error && (
                    <p className="text-[11px] text-rose-400 truncate mt-0.5">{task.error}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 ml-3">
                {task.durationMs !== undefined && (
                  <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {task.durationMs}ms
                  </span>
                )}

                {isAssistedMode && task.status === 'pending' && onExecuteTask && (
                  <button
                    onClick={() => onExecuteTask(task)}
                    className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-[11px] flex items-center gap-1 transition-colors"
                  >
                    <span>Run</span>
                    <PlayCircle className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
