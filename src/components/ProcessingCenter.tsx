import React, { useState, useEffect } from 'react';
import {
  Activity,
  Play,
  RotateCcw,
  XCircle,
  CheckCircle2,
  AlertCircle,
  Clock,
  Trash2,
  Zap,
  Filter,
  Sparkles
} from 'lucide-react';
import { BackgroundJob, JobStatus, JobTaskType } from '../types/production';
import { DatasetState } from '../types/dataset';
import { globalJobEngine } from '../services/jobEngine';
import { globalObservability } from '../services/observability';

interface ProcessingCenterProps {
  dataset: DatasetState | null;
  onNavigateToSection?: (section: string) => void;
}

export function ProcessingCenter({ dataset, onNavigateToSection }: ProcessingCenterProps) {
  const [jobs, setJobs] = useState<BackgroundJob[]>([]);
  const [statusFilter, setStatusFilter] = useState<'ALL' | JobStatus>('ALL');

  useEffect(() => {
    const unsubscribe = globalJobEngine.subscribe(updatedJobs => {
      setJobs(updatedJobs);
    });
    return () => unsubscribe();
  }, []);

  const filteredJobs = jobs.filter(j => (statusFilter === 'ALL' ? true : j.status === statusFilter));

  const activeCount = jobs.filter(j => j.status === 'RUNNING' || j.status === 'QUEUED').length;
  const completedCount = jobs.filter(j => j.status === 'COMPLETED').length;
  const failedCount = jobs.filter(j => j.status === 'FAILED').length;

  const handleCancel = (id: string) => {
    globalJobEngine.cancelJob(id);
    globalObservability.logEvent('INFO', 'JobEngine', `User cancelled job ${id}`);
  };

  const handleRetry = (id: string) => {
    globalJobEngine.retryJob(id);
    globalObservability.logEvent('INFO', 'JobEngine', `User retried job ${id}`);
  };

  const handleClearFinished = () => {
    globalJobEngine.clearFinishedJobs();
  };

  const triggerSampleJob = (taskType: JobTaskType, title: string) => {
    const dsId = dataset?.id || 'ds-default';
    const dsName = dataset?.name || 'Customer Dataset';
    const job = globalJobEngine.createJob(title, taskType, dsId, dsName, 1);

    globalJobEngine.executeJob(job.id, [
      {
        stepName: 'Ingesting and validating tabular memory buffers',
        weightPercent: 20,
        action: async () => {
          await new Promise(r => setTimeout(r, 450));
          return true;
        }
      },
      {
        stepName: 'Computing statistical moments and bivariate matrices',
        weightPercent: 30,
        action: async () => {
          await new Promise(r => setTimeout(r, 600));
          return true;
        }
      },
      {
        stepName: 'Fitting cross-validated parameters and estimators',
        weightPercent: 30,
        action: async () => {
          await new Promise(r => setTimeout(r, 550));
          return true;
        }
      },
      {
        stepName: 'Synthesizing output artifacts and caches',
        weightPercent: 18,
        action: async () => {
          await new Promise(r => setTimeout(r, 400));
          return { status: 'OK', recordsProcessed: dataset?.workingRows?.length || 1000 };
        }
      }
    ]);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#252A36] pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                Processing Center
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Monitor background tasks, model training jobs, and report exports
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => triggerSampleJob('ML_TRAINING', 'Random Forest Model Training')}
            className="px-3 py-1.5 bg-[#181D26] hover:bg-[#202734] border border-[#2B3242] text-slate-200 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors"
          >
            <Play className="w-3.5 h-3.5 text-amber-400" />
            Simulate ML Job
          </button>
          <button
            onClick={() => triggerSampleJob('REPORT_GENERATION', 'Enterprise Report Compilation')}
            className="px-3 py-1.5 bg-[#181D26] hover:bg-[#202734] border border-[#2B3242] text-slate-200 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Simulate Report Job
          </button>
          {completedCount > 0 && (
            <button
              onClick={handleClearFinished}
              className="px-3 py-1.5 bg-[#181D26] hover:bg-rose-500/20 border border-[#2B3242] hover:border-rose-500/40 text-slate-300 hover:text-rose-300 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear Finished
            </button>
          )}
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-[#0F1218] border border-[#252A36] rounded-2xl p-4">
          <span className="text-[10px] uppercase font-mono font-bold text-slate-400">Active Jobs</span>
          <p className="text-2xl font-bold text-amber-400 font-mono mt-1">{activeCount}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Currently processing in pipeline</p>
        </div>

        <div className="bg-[#0F1218] border border-[#252A36] rounded-2xl p-4">
          <span className="text-[10px] uppercase font-mono font-bold text-slate-400">Completed Jobs</span>
          <p className="text-2xl font-bold text-emerald-400 font-mono mt-1">{completedCount}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Successfully executed</p>
        </div>

        <div className="bg-[#0F1218] border border-[#252A36] rounded-2xl p-4">
          <span className="text-[10px] uppercase font-mono font-bold text-slate-400">Failed / Retrying</span>
          <p className="text-2xl font-bold text-rose-400 font-mono mt-1">{failedCount}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Safely isolated with retry support</p>
        </div>

        <div className="bg-[#0F1218] border border-[#252A36] rounded-2xl p-4">
          <span className="text-[10px] uppercase font-mono font-bold text-slate-400">Total Processed</span>
          <p className="text-2xl font-bold text-slate-200 font-mono mt-1">{jobs.length}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Since session initialization</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 p-1 bg-[#131720] border border-[#252A36] rounded-xl text-xs font-medium">
          {(['ALL', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1 rounded-lg transition-colors ${
                statusFilter === tab
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Job List */}
      <div className="space-y-3">
        {filteredJobs.length === 0 ? (
          <div className="bg-[#0F1218] border border-[#252A36] rounded-2xl p-12 text-center space-y-3">
            <Activity className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-sm font-semibold text-slate-300">No background tasks found</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Asynchronous operations like large-scale ML training, exploratory profiling, and report exports will automatically register here.
            </p>
          </div>
        ) : (
          filteredJobs.map(job => {
            const isRunning = job.status === 'RUNNING';
            const isQueued = job.status === 'QUEUED';
            const isCompleted = job.status === 'COMPLETED';
            const isFailed = job.status === 'FAILED';
            const isCancelled = job.status === 'CANCELLED';

            return (
              <div
                key={job.id}
                className="bg-[#0F1218] border border-[#252A36] rounded-2xl p-4.5 space-y-3 hover:border-[#32394A] transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-[#181D26] border border-[#252A36]">
                      {isRunning && <Activity className="w-4 h-4 text-amber-400 animate-pulse" />}
                      {isQueued && <Clock className="w-4 h-4 text-blue-400" />}
                      {isCompleted && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                      {isFailed && <AlertCircle className="w-4 h-4 text-rose-400" />}
                      {isCancelled && <XCircle className="w-4 h-4 text-slate-400" />}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs font-bold text-slate-100">{job.title}</h3>
                        <span
                          className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full ${
                            isRunning
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : isCompleted
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : isFailed
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : 'bg-slate-700/30 text-slate-400'
                          }`}
                        >
                          {job.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Dataset: <span className="text-slate-300 font-semibold">{job.datasetName}</span> (v{job.datasetVersion}) • ID: <span className="font-mono text-slate-500">{job.id}</span>
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    {(isRunning || isQueued) && (
                      <button
                        onClick={() => handleCancel(job.id)}
                        className="px-2.5 py-1 text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg transition-colors flex items-center gap-1"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Cancel
                      </button>
                    )}

                    {(isFailed || isCancelled) && job.retryCount < job.maxRetries && (
                      <button
                        onClick={() => handleRetry(job.id)}
                        className="px-2.5 py-1 text-xs font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg transition-colors flex items-center gap-1"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Retry ({job.retryCount}/{job.maxRetries})
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress Bar and Step */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-slate-400 truncate max-w-md">{job.currentStep}</span>
                    <span className="font-bold text-amber-400">{job.progress}%</span>
                  </div>
                  <div className="w-full bg-[#181D26] rounded-full h-2 overflow-hidden border border-[#252A36]">
                    <div
                      className={`h-full transition-all duration-300 ${
                        isCompleted
                          ? 'bg-emerald-500'
                          : isFailed
                          ? 'bg-rose-500'
                          : isCancelled
                          ? 'bg-slate-600'
                          : 'bg-amber-500'
                      }`}
                      style={{ width: `${job.progress}%` }}
                    />
                  </div>
                </div>

                {/* Timings */}
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 pt-1 border-t border-[#202530]">
                  <span>Started: {new Date(job.startTime).toLocaleTimeString()}</span>
                  {job.durationMs && <span>Duration: {(job.durationMs / 1000).toFixed(2)}s</span>}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
