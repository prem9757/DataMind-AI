import React, { useState, useEffect } from 'react';
import {
  Activity,
  Zap,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Clock,
  HardDrive,
  Cpu,
  Layers,
  Sparkles,
  Play,
  RotateCcw
} from 'lucide-react';
import { ObservabilityMetrics, SystemHealthStatus, BenchmarkResult, TestSuiteResult } from '../types/production';
import { globalObservability } from '../services/observability';
import { runDatasetBenchmark } from '../services/benchmarkSuite';
import { runAutomatedTestSuite } from '../services/testSuite';
import { desktopBridge } from '../services/desktopBridge';
import { SystemInfo } from '../types/electron';

export function PerformanceMonitor() {
  const [metrics, setMetrics] = useState<ObservabilityMetrics | null>(null);
  const [health, setHealth] = useState<SystemHealthStatus | null>(null);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [benchResults, setBenchResults] = useState<BenchmarkResult[]>([]);
  const [benchLoading, setBenchLoading] = useState(false);
  const [benchStep, setBenchStep] = useState('');
  const [benchProgress, setBenchProgress] = useState(0);

  const [testResult, setTestResult] = useState<TestSuiteResult | null>(null);
  const [testingLoading, setTestingLoading] = useState(false);
  const isDesktop = desktopBridge.isElectron();

  useEffect(() => {
    refreshDiagnostics();
    const interval = setInterval(refreshDiagnostics, 4000);
    return () => clearInterval(interval);
  }, []);

  const refreshDiagnostics = async () => {
    setMetrics(globalObservability.getMetrics());
    const h = await globalObservability.runSystemHealthCheck();
    setHealth(h);
    const sys = await desktopBridge.getSystemInfo();
    setSystemInfo(sys);
  };

  const handleRunBenchmark = async (size: '100K' | '500K' | '1M') => {
    setBenchLoading(true);
    setBenchProgress(0);
    try {
      const res = await runDatasetBenchmark(size, (step, pct) => {
        setBenchStep(step);
        setBenchProgress(pct);
      });
      setBenchResults(prev => [res, ...prev]);
    } catch (e) {
      console.error('Benchmark error:', e);
    } finally {
      setBenchLoading(false);
      refreshDiagnostics();
    }
  };

  const handleRunTests = async () => {
    setTestingLoading(true);
    try {
      const res = await runAutomatedTestSuite();
      setTestResult(res);
    } catch (e) {
      console.error('Test suite error:', e);
    } finally {
      setTestingLoading(false);
      refreshDiagnostics();
    }
  };

  if (!metrics || !health) {
    return (
      <div className="p-8 text-center text-slate-400 font-mono text-xs animate-pulse">
        Initializing system health diagnostics...
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#252A36] pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                System Health
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Engine diagnostics, memory utilization, performance benchmarks, and self-tests
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRunTests}
            disabled={testingLoading}
            className="px-3.5 py-1.5 bg-[#181D26] hover:bg-[#202734] border border-[#2B3242] text-slate-200 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            {testingLoading ? 'Running Tests...' : 'Run Automated Test Suite'}
          </button>
          <button
            onClick={refreshDiagnostics}
            className="p-2 bg-[#181D26] hover:bg-[#202734] border border-[#2B3242] text-slate-400 hover:text-slate-200 rounded-xl transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Health Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-[#0F1218] border border-[#252A36] rounded-2xl p-4 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-mono font-bold text-slate-400">System Status</span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          </div>
          <p className="text-xl font-bold text-emerald-400 font-mono">{health.overall}</p>
          <p className="text-[11px] text-slate-500">All core submodules operating</p>
        </div>

        <div className="bg-[#0F1218] border border-[#252A36] rounded-2xl p-4 space-y-1">
          <span className="text-[10px] uppercase font-mono font-bold text-slate-400">Avg Latency</span>
          <p className="text-xl font-bold text-amber-400 font-mono">{metrics.averageLatencyMs} ms</p>
          <p className="text-[11px] text-slate-500">Across {metrics.totalRequests} operations</p>
        </div>

        <div className="bg-[#0F1218] border border-[#252A36] rounded-2xl p-4 space-y-1">
          <span className="text-[10px] uppercase font-mono font-bold text-slate-400">Cache Hit Rate</span>
          <p className="text-xl font-bold text-slate-100 font-mono">{metrics.cacheHitRate}%</p>
          <p className="text-[11px] text-slate-500">{metrics.cacheHitCount} hits / {metrics.cacheMissCount} misses</p>
        </div>

        <div className="bg-[#0F1218] border border-[#252A36] rounded-2xl p-4 space-y-1">
          <span className="text-[10px] uppercase font-mono font-bold text-slate-400">Memory Estimate</span>
          <p className="text-xl font-bold text-slate-100 font-mono">{metrics.memoryEstimateMB} MB</p>
          <p className="text-[11px] text-slate-500">In-process heap buffers</p>
        </div>
      </div>

      {/* Host Environment Card */}
      <div className="bg-[#0F1218] border border-[#252A36] rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <HardDrive className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-200">
                {isDesktop ? 'Electron Desktop Environment' : 'Browser Web Environment'}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold uppercase bg-amber-500/20 text-amber-400 border border-amber-500/30">
                {isDesktop ? 'Desktop Host' : 'Web Runtime'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {systemInfo ? `${systemInfo.platform} • ${systemInfo.arch} • ${systemInfo.cpuModel} (${systemInfo.cpuCores} CPU Cores)` : 'Host metrics initializing...'}
            </p>
          </div>
        </div>

        {systemInfo && (
          <div className="flex items-center gap-4 text-xs font-mono text-slate-300">
            <div>
              <span className="text-slate-500 text-[10px] uppercase block">Host Memory</span>
              <span className="font-bold text-slate-200">{systemInfo.totalMemoryGB} GB Total</span>
            </div>
            <div className="h-6 w-px bg-[#252A36]" />
            <div>
              <span className="text-slate-500 text-[10px] uppercase block">Available RAM</span>
              <span className="font-bold text-emerald-400">{systemInfo.freeMemoryGB} GB Free</span>
            </div>
          </div>
        )}
      </div>

      {/* Subsystem Health Checklist */}
      <div className="bg-[#0F1218] border border-[#252A36] rounded-2xl p-5 space-y-4">
        <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider font-mono flex items-center gap-2">
          <Activity className="w-4 h-4" />
          Subsystem Health Verification
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {health.checks.map((chk, idx) => (
            <div key={idx} className="bg-[#0B0D11] border border-[#202530] rounded-xl p-3.5 flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-200">{chk.name}</span>
                  <span className="text-[10px] font-mono text-slate-500">({chk.component})</span>
                </div>
                <p className="text-[11px] text-slate-400">{chk.details}</p>
              </div>

              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold uppercase border border-emerald-500/30">
                  {chk.status}
                </span>
                <span className="text-[10px] font-mono text-slate-500">{chk.latencyMs}ms</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Automated Test Suite Results */}
      {testResult && (
        <div className="bg-[#0F1218] border border-emerald-500/40 rounded-2xl p-5 space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-[#252A36] pb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <h3 className="text-xs font-bold text-emerald-300 uppercase tracking-wider font-mono">
                Automated Test Suite (Phases 1–7): {testResult.passed}/{testResult.totalTests} Passed ({testResult.durationMs}ms)
              </h3>
            </div>
          </div>

          <div className="space-y-3">
            {testResult.suites.map(s => (
              <div key={s.name} className="bg-[#0B0D11] border border-[#202530] rounded-xl p-3 space-y-2">
                <span className="text-xs font-bold text-slate-200">{s.name}</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {s.tests.map(t => (
                    <div key={t.name} className="flex items-center justify-between text-xs font-mono bg-[#131720] px-3 py-1.5 rounded-lg border border-[#202530]">
                      <span className="text-slate-300 truncate max-w-xs">{t.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">
                        {t.status} ({t.durationMs}ms)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Large Dataset Synthetic Benchmarks */}
      <div className="bg-[#0F1218] border border-[#252A36] rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#252A36] pb-3">
          <div>
            <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider font-mono flex items-center gap-2">
              <Zap className="w-4 h-4" />
              High-Scale Dataset Performance Benchmarks
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Execute stress tests measuring in-browser throughput across 100K, 500K, and 1M record sizes
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleRunBenchmark('100K')}
              disabled={benchLoading}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition-colors disabled:opacity-50"
            >
              Benchmark 100K
            </button>
            <button
              onClick={() => handleRunBenchmark('500K')}
              disabled={benchLoading}
              className="px-3 py-1.5 bg-[#181D26] hover:bg-[#202734] border border-[#2B3242] text-slate-200 font-bold text-xs rounded-xl transition-colors disabled:opacity-50"
            >
              Benchmark 500K
            </button>
            <button
              onClick={() => handleRunBenchmark('1M')}
              disabled={benchLoading}
              className="px-3 py-1.5 bg-[#181D26] hover:bg-[#202734] border border-[#2B3242] text-slate-200 font-bold text-xs rounded-xl transition-colors disabled:opacity-50"
            >
              Benchmark 1M
            </button>
          </div>
        </div>

        {benchLoading && (
          <div className="bg-[#0B0D11] border border-amber-500/30 rounded-xl p-4 space-y-2 animate-pulse">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-amber-300 font-semibold">{benchStep}</span>
              <span className="text-amber-400 font-bold">{benchProgress}%</span>
            </div>
            <div className="w-full bg-[#181D26] rounded-full h-2 overflow-hidden">
              <div className="bg-amber-500 h-full transition-all duration-200" style={{ width: `${benchProgress}%` }} />
            </div>
          </div>
        )}

        {benchResults.length > 0 && (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-[#252A36] text-slate-400 text-[10px] uppercase">
                  <th className="p-2">Dataset Scale</th>
                  <th className="p-2">Ingestion</th>
                  <th className="p-2">Profiler</th>
                  <th className="p-2">Quality Scan</th>
                  <th className="p-2">EDA Engine</th>
                  <th className="p-2">Aggregation</th>
                  <th className="p-2">Total Time</th>
                  <th className="p-2">Memory Heap</th>
                  <th className="p-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#202530]">
                {benchResults.map((r, idx) => (
                  <tr key={idx} className="hover:bg-[#131720]">
                    <td className="p-2 font-bold text-amber-400">{r.datasetSize}</td>
                    <td className="p-2 text-slate-300">{r.uploadTimeMs}ms</td>
                    <td className="p-2 text-slate-300">{r.profilingTimeMs}ms</td>
                    <td className="p-2 text-slate-300">{r.qualityScanTimeMs}ms</td>
                    <td className="p-2 text-slate-300">{r.edaTimeMs}ms</td>
                    <td className="p-2 text-slate-300">{r.aggregationTimeMs}ms</td>
                    <td className="p-2 font-bold text-slate-100">{r.totalTimeMs}ms</td>
                    <td className="p-2 text-slate-300">~{r.memoryMB}MB</td>
                    <td className="p-2">
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold text-[10px]">
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
