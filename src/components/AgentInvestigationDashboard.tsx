import React, { useState, useEffect } from 'react';
import { DatasetState } from '../types/dataset';
import { AgentInvestigation, AgentMode, SavedInvestigationSummary } from '../types/agent';
import { globalAgentOrchestrator } from '../services/agentOrchestrator';
import { LivePlanView } from './LivePlanView';
import { AgentActivityFeed } from './AgentActivityFeed';
import { EvidencePanel } from './EvidencePanel';
import { HypothesisBoard } from './HypothesisBoard';
import { DriverAnalysisView } from './DriverAnalysisView';
import { InvestigationReportModal } from './InvestigationReportModal';
import {
  Compass,
  Sparkles,
  Play,
  Pause,
  RotateCcw,
  FileText,
  Bookmark,
  ShieldCheck,
  Zap,
  Target,
  BrainCircuit,
  Layers,
  ArrowRight,
  TrendingUp,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface AgentInvestigationDashboardProps {
  dataset: DatasetState | null;
  onNavigateToUpload: () => void;
  onNavigateToReports: () => void;
}

const PRESET_GOALS = [
  'Why did revenue decrease in Q3?',
  'What drives profit across categories?',
  'Analyze this dataset for critical business problems',
  'Find the biggest growth opportunities and drivers',
  'Identify high-impact anomalous patterns and segments'
];

export const AgentInvestigationDashboard: React.FC<AgentInvestigationDashboardProps> = ({
  dataset,
  onNavigateToUpload,
  onNavigateToReports
}) => {
  const [investigation, setInvestigation] = useState<AgentInvestigation | null>(null);
  const [goalInput, setGoalInput] = useState('');
  const [mode, setMode] = useState<AgentMode>('AUTONOMOUS');
  const [activeTab, setActiveTab] = useState<'investigation' | 'saved'>('investigation');
  const [savedList, setSavedList] = useState<SavedInvestigationSummary[]>([]);
  const [reportModalOpen, setReportModalOpen] = useState(false);

  useEffect(() => {
    const unsub = globalAgentOrchestrator.subscribe((inv) => {
      setInvestigation(inv);
    });
    setSavedList(globalAgentOrchestrator.getSavedInvestigations());
    return () => unsub();
  }, []);

  const handleStartInvestigation = (customGoal?: string) => {
    if (!dataset) return;
    const targetGoal = customGoal || goalInput.trim();
    if (!targetGoal) return;

    globalAgentOrchestrator.startInvestigation(targetGoal, dataset, mode);
    setGoalInput('');
  };

  const handleStop = () => {
    globalAgentOrchestrator.stopInvestigation();
  };

  const handleResume = () => {
    if (dataset && investigation) {
      globalAgentOrchestrator.runExecutionLoop(dataset);
    }
  };

  if (!dataset) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
        <div className="w-16 h-16 rounded-3xl bg-[#141822] border border-[#252A36] flex items-center justify-center mb-4">
          <Compass className="w-8 h-8 text-amber-400" />
        </div>
        <h2 className="text-lg font-semibold text-slate-100 mb-2">No Active Dataset Loaded</h2>
        <p className="text-xs text-slate-400 max-w-md mb-6">
          Load or upload a dataset to deploy the Autonomous AI Data Analyst Agent for multi-step reasoning, hypothesis testing, and driver decomposition.
        </p>
        <button
          onClick={onNavigateToUpload}
          className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition-colors flex items-center gap-2"
        >
          <span>Upload Dataset</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  const isRunning = investigation?.status === 'EXECUTING' || investigation?.status === 'PLANNING' || investigation?.status === 'EVALUATING';
  const isDone = investigation?.status === 'COMPLETED';

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Banner / Goal Input Area */}
      <div className="rounded-3xl bg-[#10141D] border border-[#202634] p-6 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 font-mono text-[11px] font-semibold border border-amber-500/20">
                Autonomous Analytics Agent
              </span>
              <span className="text-xs text-slate-400">Goal-driven hypothesis testing &amp; driver analysis</span>
            </div>
            <h1 className="text-xl font-bold text-slate-100 tracking-tight">Autonomous Analytics Agent</h1>
          </div>

          {/* Mode & Navigation Tabs */}
          <div className="flex items-center gap-3">
            {/* Mode Switcher */}
            <div className="flex items-center bg-[#090B0E] p-1 rounded-xl border border-[#1E232E] text-xs">
              <button
                onClick={() => setMode('AUTONOMOUS')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  mode === 'AUTONOMOUS'
                    ? 'bg-amber-500 text-slate-950 font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Autonomous
              </button>
              <button
                onClick={() => setMode('ASSISTED')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  mode === 'ASSISTED'
                    ? 'bg-amber-500 text-slate-950 font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Assisted
              </button>
            </div>

            {/* Tab switch */}
            <div className="flex items-center bg-[#090B0E] p-1 rounded-xl border border-[#1E232E] text-xs">
              <button
                onClick={() => setActiveTab('investigation')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  activeTab === 'investigation' ? 'bg-[#1D2330] text-amber-300' : 'text-slate-400'
                }`}
              >
                Active
              </button>
              <button
                onClick={() => {
                  setActiveTab('saved');
                  setSavedList(globalAgentOrchestrator.getSavedInvestigations());
                }}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                  activeTab === 'saved' ? 'bg-[#1D2330] text-amber-300' : 'text-slate-400'
                }`}
              >
                <Bookmark className="w-3.5 h-3.5" />
                <span>History ({savedList.length})</span>
              </button>
            </div>
          </div>
        </div>

        {/* Input Bar */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={goalInput}
              onChange={(e) => setGoalInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleStartInvestigation()}
              placeholder="E.g., Why did revenue decrease? What drives product profit? Analyze this dataset..."
              className="w-full pl-4 pr-10 py-3 rounded-xl bg-[#090B0E] border border-[#202735] text-slate-100 text-xs placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60 transition-colors"
            />
            <Sparkles className="w-4 h-4 text-amber-400 absolute right-3.5 top-3.5 pointer-events-none" />
          </div>

          <button
            onClick={() => handleStartInvestigation()}
            disabled={!goalInput.trim() && !investigation}
            className="px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:pointer-events-none text-slate-950 font-bold text-xs flex items-center gap-2 transition-colors shrink-0 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Start Investigation</span>
          </button>
        </div>

        {/* Quick Goal Chips */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-[11px] text-slate-400 mr-1">Suggested inquiries:</span>
          {PRESET_GOALS.map((preset, idx) => (
            <button
              key={idx}
              onClick={() => {
                setGoalInput(preset);
                handleStartInvestigation(preset);
              }}
              className="px-2.5 py-1 rounded-lg bg-[#141822] hover:bg-[#1C2230] border border-[#222836] text-slate-300 hover:text-amber-300 text-[11px] transition-colors"
            >
              {preset}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Areas */}
      {activeTab === 'saved' ? (
        /* Saved History Tab */
        <div className="rounded-2xl bg-[#12161F] border border-[#252A36] p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#252A36]">
            <h3 className="text-sm font-semibold text-slate-100">Saved Autonomous Investigations</h3>
            <span className="text-xs text-slate-400 font-mono">{savedList.length} Sessions</span>
          </div>

          {savedList.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              No saved investigations found in session memory.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {savedList.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-xl bg-[#0E121A] border border-[#1E232E] hover:border-[#2D3546] transition-all space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-xs font-semibold text-slate-200">{item.goal}</h4>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {item.status}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 line-clamp-2">{item.executiveSummaryExcerpt}</p>

                  <div className="flex items-center justify-between pt-2 border-t border-[#1A1F2B] text-[11px] text-slate-400">
                    <span>{new Date(item.startedAt).toLocaleDateString()}</span>
                    <span>{item.taskCount} tasks completed</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Active Investigation Tab */
        investigation ? (
          <div className="space-y-6">
            {/* Active Header & Control Bar */}
            <div className="p-4 rounded-2xl bg-[#12161F] border border-[#252A36] flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className={`w-3 h-3 rounded-full ${
                  isRunning ? 'bg-amber-400 animate-ping' : isDone ? 'bg-emerald-400' : 'bg-slate-500'
                }`} />
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">{investigation.goal}</h3>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                    <span>Status: <strong className="text-slate-200">{investigation.status}</strong></span>
                    <span>•</span>
                    <span>Dataset: <strong className="text-slate-200">{investigation.datasetName} (v{investigation.datasetVersion}.0)</strong></span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {isRunning ? (
                  <button
                    onClick={handleStop}
                    className="px-3 py-1.5 rounded-xl bg-[#1B212D] hover:bg-[#252C3C] text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <Pause className="w-3.5 h-3.5 text-amber-400" />
                    <span>Pause</span>
                  </button>
                ) : (
                  <button
                    onClick={handleResume}
                    className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Re-Run</span>
                  </button>
                )}

                {isDone && (
                  <button
                    onClick={() => setReportModalOpen(true)}
                    className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5 text-amber-400" />
                    <span>Executive Brief</span>
                  </button>
                )}
              </div>
            </div>

            {/* Executive Synthesis Card if completed */}
            {isDone && investigation.finalAnswer && (
              <div className="rounded-3xl bg-linear-to-br from-[#151923] to-[#0F1219] border border-amber-500/30 p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-[#252A36] pb-3">
                  <div className="flex items-center gap-2">
                    <span className="p-1 rounded-md bg-amber-500/20 text-amber-400">
                      <Sparkles className="w-4 h-4" />
                    </span>
                    <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider">Executive Synthesis</h2>
                  </div>
                  <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 font-semibold border border-amber-500/20">
                    {investigation.finalAnswer.overallConfidence} CONFIDENCE
                  </span>
                </div>

                <p className="text-sm text-slate-200 leading-relaxed">
                  {investigation.finalAnswer.executiveAnswer}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="p-4 rounded-xl bg-[#090B0E] border border-[#1E232E] space-y-2">
                    <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Top Empirical Insights</h4>
                    <ul className="space-y-1.5 text-xs text-slate-300">
                      {investigation.finalAnswer.keyFindings.map((kf, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          <span>{kf}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-4 rounded-xl bg-[#090B0E] border border-[#1E232E] space-y-2">
                    <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Strategic Recommendations</h4>
                    <div className="space-y-2 text-xs">
                      {investigation.finalAnswer.recommendations.map((rec, ri) => (
                        <div key={ri} className="space-y-0.5">
                          <span className="text-[10px] font-bold text-amber-400 mr-2">[{rec.priority}]</span>
                          <strong className="text-slate-200">{rec.action}</strong>
                          <p className="text-slate-400 text-[11px]">{rec.rationale}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Live Plan and Activity Feed Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <LivePlanView
                  plan={investigation.currentPlan}
                  currentTaskId={investigation.currentTaskId}
                  onExecuteTask={(task) => dataset && globalAgentOrchestrator.executeTask(task, dataset)}
                  isAssistedMode={mode === 'ASSISTED'}
                />
              </div>

              <div className="lg:col-span-1">
                <AgentActivityFeed logs={investigation.actionLogs} />
              </div>
            </div>

            {/* Driver Analysis & Dimensional Decomposition */}
            {investigation.driverAnalysis && (
              <DriverAnalysisView
                targetMetric={investigation.driverAnalysis.targetMetric}
                totalDelta={investigation.driverAnalysis.totalDelta}
                totalPercentDelta={investigation.driverAnalysis.totalPercentDelta}
                drivers={investigation.driverAnalysis.drivers}
                decomposition={investigation.driverAnalysis.decomposition}
              />
            )}

            {/* Hypothesis Evaluation & Evidence Store */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <HypothesisBoard hypotheses={investigation.hypotheses} />
              <EvidencePanel observations={investigation.observations} />
            </div>

            {/* Validation Checklist */}
            {investigation.validations.length > 0 && (
              <div className="rounded-2xl bg-[#12161F] border border-[#252A36] p-5 space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-[#252A36]">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <h4 className="text-xs font-semibold text-slate-200">Investigation Validation & Provenance Checks</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {investigation.validations.map((val, vIdx) => (
                    <div key={vIdx} className="p-2.5 rounded-lg bg-[#0E121A] border border-[#1E232E] flex items-center justify-between text-xs">
                      <span className="text-slate-300 font-medium">{val.checkName}</span>
                      <span className="text-[10px] font-semibold text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Passed</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-2xl bg-[#12161F] border border-[#252A36] p-12 text-center space-y-3">
            <Compass className="w-10 h-10 text-amber-400/80 mx-auto" />
            <h3 className="text-sm font-semibold text-slate-100">Ready to Investigate</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Type an analytical objective or select a preset inquiry above to launch the autonomous agent loop.
            </p>
          </div>
        )
      )}

      {/* Investigation Report Modal */}
      {reportModalOpen && investigation && (
        <InvestigationReportModal
          investigation={investigation}
          onClose={() => setReportModalOpen(false)}
        />
      )}
    </div>
  );
};
