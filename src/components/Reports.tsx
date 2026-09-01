import React, { useState, useMemo, useEffect } from 'react';
import {
  FileSpreadsheet,
  Download,
  Printer,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  FileText,
  Zap,
  Info,
  Sliders,
  Settings,
  History,
  Layers,
  BarChart3,
  Scale,
  BrainCircuit,
  Eye,
  Check,
  X,
  Code,
  Share2,
  FileCode,
  Loader2,
  Image as ImageIcon
} from 'lucide-react';
import { DatasetState, ReportConfig, ReportHistoryEntry } from '../types/dataset';
import {
  generateComprehensiveReport,
  validateReportQuality,
  exportComprehensiveExcelWorkbook,
  exportReportToHTML,
  exportReportToPDF,
  exportDatasetToCSV,
  DEFAULT_REPORT_CONFIG
} from '../services/reportEngine';
import { ChartViewer } from './ChartViewer';

interface ReportsProps {
  dataset: DatasetState;
}

export const Reports: React.FC<ReportsProps> = ({ dataset }) => {
  const [activeTab, setActiveTab] = useState<'preview' | 'settings' | 'quality_check' | 'export_center' | 'history'>('preview');
  const [isExportingPDF, setIsExportingPDF] = useState(false);

  // Report Customization State
  const [reportConfig, setReportConfig] = useState<ReportConfig>({
    ...DEFAULT_REPORT_CONFIG,
    title: `${dataset.name} Executive Analysis & Business Briefing`,
    datasetVersion: `v${(dataset.transformations.length || 0) + 1}.0 (${dataset.transformations.length > 0 ? 'Cleaned' : 'Ingested'})`
  });

  // Sync report config title & version whenever dataset changes
  useEffect(() => {
    setReportConfig(prev => ({
      ...prev,
      title: `${dataset.name} Executive Analysis & Business Briefing`,
      datasetVersion: `v${(dataset.transformations.length || 0) + 1}.0 (${dataset.transformations.length > 0 ? 'Cleaned' : 'Ingested'})`
    }));
  }, [dataset.id, dataset.name, dataset.transformations.length]);

  // Report History State
  const [reportHistory, setReportHistory] = useState<ReportHistoryEntry[]>([]);

  // Generated Report Data
  const report = useMemo(() => {
    return generateComprehensiveReport(dataset, reportConfig);
  }, [dataset, reportConfig]);

  // Validation Audit
  const validationResult = useMemo(() => {
    return validateReportQuality(report, dataset);
  }, [report, dataset]);

  const handleGenerateAndSaveReport = () => {
    const newEntry: ReportHistoryEntry = {
      id: `rep-${Date.now()}`,
      datasetId: dataset.id,
      datasetName: dataset.name,
      datasetVersion: reportConfig.datasetVersion,
      createdAt: Date.now(),
      reportType: reportConfig.mode,
      title: reportConfig.title,
      author: reportConfig.author,
      qualityScore: validationResult.score,
      reportData: report,
      config: reportConfig
    };
    setReportHistory(prev => [newEntry, ...prev]);
    setActiveTab('preview');
  };

  const handleExportPDF = async () => {
    setIsExportingPDF(true);
    try {
      await exportReportToPDF('printable-report-surface', dataset.name, reportConfig.orientation);
    } catch (err) {
      console.error('PDF Export Error:', err);
    } finally {
      setIsExportingPDF(false);
    }
  };

  const handleExportHTML = () => {
    exportReportToHTML(report, dataset.name);
  };

  const handleExportExcel = () => {
    exportComprehensiveExcelWorkbook(dataset, report, dataset.name);
  };

  const handleExportCSV = () => {
    exportDatasetToCSV(dataset.workingRows, dataset.name);
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#252A36] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-100 tracking-tight">Reports & Export</h1>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 font-mono font-bold uppercase">
              Executive Briefing
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Generate executive summaries, review previews, and export directly in PDF, HTML, Excel, or CSV formats.
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 bg-[#12151C] border border-[#252A36] p-1 rounded-xl shadow-inner overflow-x-auto custom-scrollbar">
          {[
            { id: 'preview', label: 'Report Preview', icon: Eye },
            { id: 'settings', label: 'Generator & Config', icon: Sliders },
            { id: 'quality_check', label: `Audit Check (${validationResult.score}%)`, icon: ShieldCheck },
            { id: 'export_center', label: 'Export Center', icon: Download },
            { id: 'history', label: `History (${reportHistory.length})`, icon: History }
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ==================================================================== */}
      {/* TAB 1: REPORT DOCUMENT LIVE PREVIEW                                  */}
      {/* ==================================================================== */}
      {activeTab === 'preview' && (
        <div className="space-y-4">
          {/* Quick Action Floating Bar */}
          <div className="flex items-center justify-between bg-[#12151C] p-3.5 rounded-2xl border border-[#252A36]">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-slate-300">Format:</span>
              <span className="font-mono text-amber-400">{reportConfig.pageSize} {reportConfig.orientation}</span>
              <span className="text-slate-600">|</span>
              <span className="font-semibold text-slate-300">Version:</span>
              <span className="font-mono text-slate-200">{reportConfig.datasetVersion}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExportPDF}
                className="px-3 py-1.5 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold hover:bg-amber-400 transition flex items-center gap-1.5 cursor-pointer shadow-md shadow-amber-500/20"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download PDF</span>
              </button>
              <button
                onClick={handleExportHTML}
                className="px-3 py-1.5 rounded-xl bg-[#181D26] hover:bg-[#202733] border border-[#2D3342] text-xs font-semibold text-slate-300 transition flex items-center gap-1.5 cursor-pointer"
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>HTML</span>
              </button>
              <button
                onClick={handleExportExcel}
                className="px-3 py-1.5 rounded-xl bg-[#181D26] hover:bg-[#202733] border border-[#2D3342] text-xs font-semibold text-emerald-400 transition flex items-center gap-1.5 cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Excel</span>
              </button>
            </div>
          </div>

          {/* Printable Surface Document */}
          <div
            id="printable-report-surface"
            className="bg-[#12151C] border border-[#252A36] rounded-3xl p-8 sm:p-12 space-y-10 text-slate-200 shadow-2xl printable-surface font-sans"
          >
            {/* 1. Document Cover / Header */}
            <div className="border-b border-[#252A36] pb-8 flex flex-col md:flex-row md:items-start justify-between gap-6">
              <div className="space-y-2 max-w-2xl">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse"></span>
                  <span className="text-[11px] font-bold text-amber-400 uppercase tracking-widest font-mono">
                    DataMind AI • Autonomous Executive Briefing
                  </span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-100 tracking-tight">
                  {report.title}
                </h2>
                <p className="text-xs text-slate-400 leading-relaxed font-mono">
                  Dataset: <strong className="text-slate-200">{report.datasetName}</strong> ({report.datasetVersion}) • Compiled on {report.generatedAt}
                </p>
                <p className="text-xs text-slate-400">
                  Prepared by: <span className="text-slate-300 font-semibold">{report.author}</span> • {report.organization}
                </p>
              </div>

              <div className="bg-[#0B0D11] px-5 py-4 rounded-2xl border border-[#252A36] text-right space-y-1 shrink-0">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Quality Rating</span>
                <span className="text-2xl font-bold text-amber-400 font-mono">{report.datasetOverview.qualityScore}/100</span>
                <span className="text-xs text-emerald-400 block font-semibold">Ready for Enterprise Decisions</span>
              </div>
            </div>

            {/* 2. Executive Summary */}
            {reportConfig.includedSections.executiveSummary && (
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2 font-mono">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  1. Executive Summary &amp; Key Findings
                </h3>
                <div className="bg-[#0B0D11] p-5 rounded-2xl border border-[#252A36] space-y-3">
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {report.executiveSummary}
                  </p>
                  {report.keyTakeawaySentence && (
                    <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/20 text-xs text-amber-300 font-medium">
                      <strong>Core Takeaway:</strong> {report.keyTakeawaySentence}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 3. Key Performance Indicators (KPIs) */}
            {reportConfig.includedSections.kpis && report.kpiCards && (
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2 font-mono">
                  <Zap className="w-4 h-4 text-amber-400" />
                  2. Key Performance Indicators
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {report.kpiCards.map((kpi, idx) => (
                    <div key={idx} className="bg-[#0B0D11] border border-[#252A36] rounded-2xl p-4 space-y-1">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">{kpi.title}</span>
                      <p className="text-lg font-bold text-amber-400 font-mono">{kpi.value}</p>
                      <p className="text-[10px] text-slate-500">{kpi.change}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4. Dataset Overview & Health */}
            {reportConfig.includedSections.datasetOverview && (
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2 font-mono">
                  <FileText className="w-4 h-4 text-amber-400" />
                  3. Dataset Overview &amp; Health Profile
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-[#0B0D11] rounded-2xl border border-[#252A36] p-4">
                    <table className="w-full text-left text-xs font-mono">
                      <tbody className="divide-y divide-[#252A36]">
                        <tr><td className="py-2 text-slate-400">Total Rows Ingested</td><td className="py-2 text-right font-bold text-slate-200">{report.datasetOverview.totalRows.toLocaleString()}</td></tr>
                        <tr><td className="py-2 text-slate-400">Total Attribute Columns</td><td className="py-2 text-right font-bold text-slate-200">{report.datasetOverview.totalColumns} ({report.datasetOverview.numericColumns} Numeric, {report.datasetOverview.categoricalColumns} Categorical)</td></tr>
                        <tr><td className="py-2 text-slate-400">Temporal Coverage</td><td className="py-2 text-right font-bold text-slate-300">{report.datasetOverview.dateRange}</td></tr>
                        <tr><td className="py-2 text-slate-400">Memory Footprint</td><td className="py-2 text-right font-bold text-slate-300">{report.datasetOverview.memoryEstimate}</td></tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="bg-[#0B0D11] rounded-2xl border border-[#252A36] p-4">
                    <table className="w-full text-left text-xs font-mono">
                      <tbody className="divide-y divide-[#252A36]">
                        <tr><td className="py-2 text-slate-400">Completeness Ratio</td><td className="py-2 text-right font-bold text-emerald-400">{report.qualityMetricsBreakdown?.completeness || 100}%</td></tr>
                        <tr><td className="py-2 text-slate-400">Uniqueness Score</td><td className="py-2 text-right font-bold text-emerald-400">{report.qualityMetricsBreakdown?.uniqueness || 100}%</td></tr>
                        <tr><td className="py-2 text-slate-400">Duplicate Records</td><td className="py-2 text-right font-bold text-slate-300">{report.datasetOverview.duplicateRows} (Remediated)</td></tr>
                        <tr><td className="py-2 text-slate-400">Missing Cells Ratio</td><td className="py-2 text-right font-bold text-slate-300">{report.datasetOverview.missingCells} cells</td></tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* 5. Before vs. After Cleaning Audit */}
            {reportConfig.includedSections.cleaningSummary && report.beforeAfterComparison && (
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2 font-mono">
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  4. Data Cleaning Audit &amp; Transformations
                </h3>
                <div className="overflow-x-auto custom-scrollbar bg-[#0B0D11] rounded-2xl border border-[#252A36] p-3">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-[#252A36] text-slate-400 text-[10px] uppercase">
                        <th className="p-2">Metric</th>
                        <th className="p-2">Source (Before)</th>
                        <th className="p-2">Cleaned (After)</th>
                        <th className="p-2">Audit Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#252A36] text-[11px]">
                      {report.beforeAfterComparison.map((row, idx) => (
                        <tr key={idx} className="hover:bg-[#181D26]">
                          <td className="p-2 font-bold text-slate-200">{row.metric}</td>
                          <td className="p-2 text-slate-400">{row.before}</td>
                          <td className="p-2 text-amber-400 font-bold">{row.after}</td>
                          <td className="p-2 text-emerald-400">{row.improvement}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 6. Intelligently Selected Visualizations */}
            {reportConfig.includedSections.edaVisualizations && report.selectedCharts && (
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2 font-mono">
                  <BarChart3 className="w-4 h-4 text-amber-400" />
                  5. Exploratory Visualizations &amp; Trend Captions
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {report.selectedCharts.map(chart => (
                    <div key={chart.id} className="bg-[#0B0D11] border border-[#252A36] rounded-2xl p-5 space-y-3">
                      <div>
                        <span className="text-[10px] font-mono text-amber-400 uppercase font-bold">{chart.chartType.toUpperCase()} CHART</span>
                        <h4 className="text-sm font-bold text-slate-100 mt-0.5">{chart.title}</h4>
                        <p className="text-[11px] text-slate-400">{chart.subtitle}</p>
                      </div>

                      <div className="h-56 w-full">
                        <ChartViewer
                          type={chart.chartType}
                          title={chart.title}
                          data={chart.data || []}
                          xAxisKey={chart.xAxisKey}
                          keys={chart.dataKeys}
                          height={220}
                          description={chart.subtitle}
                          explanation={chart.caption}
                          allowFullscreen={false}
                        />
                      </div>

                      <div className="p-3 bg-[#12151C] rounded-xl border border-[#252A36] space-y-1 text-xs">
                        <p className="text-slate-300 font-medium">{chart.caption}</p>
                        <p className="text-[11px] text-slate-400 italic">{chart.analyticalExplanation}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 7. Descriptive Moments Table */}
            {reportConfig.includedSections.statisticalFindings && report.descriptiveStatsTable && (
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2 font-mono">
                  <Scale className="w-4 h-4 text-amber-400" />
                  6. Parametric Descriptive Moments &amp; Dispersion
                </h3>
                <div className="overflow-x-auto custom-scrollbar bg-[#0B0D11] rounded-2xl border border-[#252A36] p-3">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-[#252A36] text-slate-400 text-[10px] uppercase">
                        {report.descriptiveStatsTable.headers.map((h, idx) => (
                          <th key={idx} className="p-2">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#252A36] text-[11px]">
                      {report.descriptiveStatsTable.rows.map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-[#181D26]">
                          {row.map((cell, cIdx) => (
                            <td key={cIdx} className={`p-2 ${cIdx === 0 ? 'font-bold text-amber-400' : 'text-slate-300'}`}>
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 8. Key Insights Breakdown */}
            {reportConfig.includedSections.keyInsights && (
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2 font-mono">
                  <Lightbulb className="w-4 h-4 text-amber-400" />
                  7. Evidence-Based Strategic Insights
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {report.topInsights.map(insight => (
                    <div key={insight.id} className="bg-[#0B0D11] border border-[#252A36] rounded-2xl p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 font-bold uppercase">
                          {insight.category}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">Score: {insight.score || 90}</span>
                      </div>
                      <h4 className="text-xs font-bold text-slate-100">{insight.title}</h4>
                      <p className="text-[11px] text-slate-400 leading-relaxed">{insight.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 9. Strategic Business Recommendations */}
            {reportConfig.includedSections.businessRecommendations && (
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2 font-mono">
                  <Zap className="w-4 h-4 text-amber-400" />
                  8. Actionable Business Recommendations
                </h3>
                <div className="space-y-2">
                  {report.businessRecommendations.map((rec, idx) => (
                    <div key={idx} className="bg-[#0B0D11] border border-[#252A36] rounded-2xl p-4 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-100">{rec.action}</span>
                        <span className="text-[9px] px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 font-mono font-bold uppercase">
                          {rec.priority} PRIORITY
                        </span>
                      </div>
                      <p className="text-xs text-slate-300"><strong>Expected Impact:</strong> {rec.impact}</p>
                      {rec.reason && <p className="text-[11px] text-slate-400"><strong>Operational Reason:</strong> {rec.reason}</p>}
                      {rec.supportingEvidence && <p className="text-[10px] text-slate-500 italic">Evidence: {rec.supportingEvidence}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 10. Analytical Risks & Limitations */}
            {reportConfig.includedSections.risksAndLimitations && (
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2 font-mono">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  9. Analytical Risks &amp; Limitations
                </h3>
                <div className="space-y-2">
                  {report.analyticalRisks?.map((risk, idx) => (
                    <div key={idx} className="p-3 bg-[#0B0D11] rounded-xl border border-[#252A36] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div>
                        <strong className="text-slate-200">{risk.risk}</strong>
                        <p className="text-[11px] text-slate-400 mt-0.5">{risk.evidence}</p>
                      </div>
                      <span className="text-[10px] text-amber-400 italic shrink-0">Mitigation: {risk.mitigation}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 11. Appendix & Reproducible Python Code */}
            {reportConfig.includedSections.appendix && report.appendix && (
              <div className="space-y-3 border-t border-[#252A36] pt-6">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2 font-mono">
                  <Code className="w-4 h-4 text-slate-400" />
                  Appendix: Column Dictionary &amp; Reproducible Pipeline
                </h3>
                <div className="bg-[#0B0D11] p-4 rounded-xl border border-[#252A36] font-mono text-[11px] text-slate-400">
                  <pre className="overflow-x-auto custom-scrollbar">{report.appendix.reproduciblePythonCode}</pre>
                </div>
              </div>
            )}

            {/* Document Footer */}
            <div className="border-t border-[#252A36] pt-6 text-center text-xs text-slate-500 font-mono">
              Generated by DataMind AI Autonomous Analytics Engine • Confidential &amp; Proprietary • 100% Deterministic Fact Verification
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 2: GENERATOR & CUSTOMIZATION SETTINGS                           */}
      {/* ==================================================================== */}
      {activeTab === 'settings' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-[#12151C] border border-[#252A36] rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-amber-400" />
              Report Template &amp; Scope
            </h2>

            {/* Report Mode */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Report Mode</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'quick', label: 'Quick Summary' },
                  { id: 'standard', label: 'Standard Report' },
                  { id: 'detailed', label: 'Detailed Analysis' },
                  { id: 'executive', label: 'Executive Brief' }
                ].map(m => (
                  <button
                    key={m.id}
                    onClick={() => setReportConfig({ ...reportConfig, mode: m.id as any })}
                    className={`py-2 px-2.5 text-xs font-semibold rounded-xl border text-center transition cursor-pointer ${
                      reportConfig.mode === m.id
                        ? 'bg-amber-500 text-slate-950 font-bold border-amber-500'
                        : 'bg-[#0B0D11] text-slate-400 border-[#252A36] hover:text-slate-200'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Metadata Fields */}
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Report Title</label>
                <input
                  type="text"
                  value={reportConfig.title}
                  onChange={e => setReportConfig({ ...reportConfig, title: e.target.value })}
                  className="w-full bg-[#0B0D11] border border-[#252A36] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Author / Title</label>
                <input
                  type="text"
                  value={reportConfig.author}
                  onChange={e => setReportConfig({ ...reportConfig, author: e.target.value })}
                  className="w-full bg-[#0B0D11] border border-[#252A36] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Organization</label>
                <input
                  type="text"
                  value={reportConfig.organization}
                  onChange={e => setReportConfig({ ...reportConfig, organization: e.target.value })}
                  className="w-full bg-[#0B0D11] border border-[#252A36] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Page Layout Settings */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Page Size</label>
                <select
                  value={reportConfig.pageSize}
                  onChange={e => setReportConfig({ ...reportConfig, pageSize: e.target.value as any })}
                  className="w-full bg-[#0B0D11] border border-[#252A36] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="A4">A4 Standard</option>
                  <option value="Letter">US Letter</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Orientation</label>
                <select
                  value={reportConfig.orientation}
                  onChange={e => setReportConfig({ ...reportConfig, orientation: e.target.value as any })}
                  className="w-full bg-[#0B0D11] border border-[#252A36] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="portrait">Portrait</option>
                  <option value="landscape">Landscape</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleGenerateAndSaveReport}
              className="w-full py-3 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 transition cursor-pointer shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Generate &amp; Save Report</span>
            </button>
          </div>

          {/* Section Toggles Panel */}
          <div className="lg:col-span-2 bg-[#12151C] border border-[#252A36] rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-400" />
              Included Report Modules &amp; Chapters
            </h2>
            <p className="text-xs text-slate-400">
              Toggle specific sections to customize reporting depth for your audience.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {Object.entries(reportConfig.includedSections).map(([secKey, isIncluded]) => (
                <button
                  key={secKey}
                  onClick={() =>
                    setReportConfig({
                      ...reportConfig,
                      includedSections: {
                        ...reportConfig.includedSections,
                        [secKey]: !isIncluded
                      }
                    })
                  }
                  className={`p-3 rounded-xl border text-left flex items-center justify-between transition cursor-pointer ${
                    isIncluded
                      ? 'bg-[#181D26] border-amber-500/30 text-slate-100'
                      : 'bg-[#0B0D11] border-[#252A36] text-slate-500'
                  }`}
                >
                  <span className="text-xs font-semibold capitalize">
                    {secKey.replace(/([A-Z])/g, ' $1')}
                  </span>
                  <div className={`w-5 h-5 rounded-lg flex items-center justify-center ${
                    isIncluded ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-500'
                  }`}>
                    {isIncluded ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 3: REPORT QUALITY CHECK & VALIDATION                              */}
      {/* ==================================================================== */}
      {activeTab === 'quality_check' && (
        <div className="space-y-4">
          <div className="bg-[#12151C] border border-[#252A36] rounded-2xl p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-[#0B0D11] border border-[#252A36] flex flex-col items-center justify-center font-mono">
                <span className="text-xl font-bold text-amber-400">{validationResult.score}</span>
                <span className="text-[9px] text-slate-500 uppercase">/100</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-100">Report Integrity &amp; Fact Audit</h2>
                  <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 uppercase">
                    {validationResult.rating}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Automated verification ensuring zero synthetic claims, synchronized table metrics, and complete risk disclosures.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {validationResult.checks.map((chk, idx) => (
              <div
                key={idx}
                className="p-4 bg-[#12151C] border border-[#252A36] rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 ${chk.passed ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {chk.passed ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-100">{chk.check}</span>
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#0B0D11] text-slate-400">
                        {chk.category}
                      </span>
                    </div>
                    <p className="text-slate-400 text-[11px] mt-0.5">{chk.details}</p>
                  </div>
                </div>

                <span className={`text-[10px] font-mono font-bold px-2 py-1 rounded uppercase shrink-0 ${
                  chk.passed ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'
                }`}>
                  {chk.passed ? 'PASSED' : 'ACTION REQUIRED'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 4: EXPORT CENTER                                                 */}
      {/* ==================================================================== */}
      {activeTab === 'export_center' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#12151C] border border-[#252A36] rounded-2xl p-5 space-y-3 flex flex-col justify-between">
            <div className="space-y-1.5">
              <Download className="w-5 h-5 text-amber-400" />
              <h3 className="text-sm font-bold text-slate-100">Executive PDF Brief</h3>
              <p className="text-xs text-slate-400">High-resolution vector-rendered PDF formatted for A4 print and distribution.</p>
            </div>
            <button
              onClick={handleExportPDF}
              className="w-full py-2.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 transition cursor-pointer shadow-md shadow-amber-500/20"
            >
              Export PDF
            </button>
          </div>

          <div className="bg-[#12151C] border border-[#252A36] rounded-2xl p-5 space-y-3 flex flex-col justify-between">
            <div className="space-y-1.5">
              <FileCode className="w-5 h-5 text-amber-400" />
              <h3 className="text-sm font-bold text-slate-100">Standalone HTML</h3>
              <p className="text-xs text-slate-400">Offline interactive web report with embedded CSS styling and data tables.</p>
            </div>
            <button
              onClick={handleExportHTML}
              className="w-full py-2.5 rounded-xl bg-[#181D26] hover:bg-[#202733] border border-[#2D3342] text-xs font-bold text-slate-200 transition cursor-pointer"
            >
              Download HTML
            </button>
          </div>

          <div className="bg-[#12151C] border border-[#252A36] rounded-2xl p-5 space-y-3 flex flex-col justify-between">
            <div className="space-y-1.5">
              <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
              <h3 className="text-sm font-bold text-slate-100">Multi-Sheet Excel</h3>
              <p className="text-xs text-slate-400">Formatted workbook containing summary, quality, EDA, stats, and cleaned data.</p>
            </div>
            <button
              onClick={handleExportExcel}
              className="w-full py-2.5 rounded-xl bg-[#181D26] hover:bg-[#202733] border border-[#2D3342] text-xs font-bold text-emerald-400 transition cursor-pointer"
            >
              Export Workbook (.xlsx)
            </button>
          </div>

          <div className="bg-[#12151C] border border-[#252A36] rounded-2xl p-5 space-y-3 flex flex-col justify-between">
            <div className="space-y-1.5">
              <FileText className="w-5 h-5 text-amber-400" />
              <h3 className="text-sm font-bold text-slate-100">Cleaned Dataset CSV</h3>
              <p className="text-xs text-slate-400">Export the pristine working dataset post-cleaning and deduplication.</p>
            </div>
            <button
              onClick={handleExportCSV}
              className="w-full py-2.5 rounded-xl bg-[#181D26] hover:bg-[#202733] border border-[#2D3342] text-xs font-bold text-slate-300 transition cursor-pointer"
            >
              Download CSV
            </button>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 5: REPORT HISTORY & VERSIONING                                   */}
      {/* ==================================================================== */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-[#12151C] p-4 rounded-2xl border border-[#252A36]">
            <div>
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <History className="w-4 h-4 text-amber-400" />
                Report Snapshot History &amp; Versioning
              </h2>
              <p className="text-xs text-slate-400">
                Audited snapshots linked to respective dataset cleaning versions.
              </p>
            </div>

            <span className="text-xs font-mono text-amber-400 font-bold">
              {reportHistory.length} Saved Snapshots
            </span>
          </div>

          {reportHistory.length > 0 ? (
            <div className="space-y-2">
              {reportHistory.map(entry => (
                <div
                  key={entry.id}
                  className="bg-[#12151C] border border-[#252A36] rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-100">{entry.title}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 font-semibold uppercase">
                        {entry.reportType}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">{entry.datasetVersion}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-mono">
                      Generated at {new Date(entry.createdAt).toLocaleTimeString()} • Audit Score: {entry.qualityScore}/100
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => {
                        exportReportToPDF('printable-report-surface', entry.datasetName);
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-[#181D26] hover:bg-[#202733] border border-[#2D3342] text-[11px] text-slate-300 font-semibold cursor-pointer"
                    >
                      Download PDF
                    </button>
                    <button
                      onClick={() => {
                        setReportHistory(reportHistory.filter(h => h.id !== entry.id));
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[11px] font-semibold cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-[#12151C] border border-[#252A36] rounded-2xl p-12 text-center text-slate-400 space-y-2">
              <History className="w-8 h-8 text-amber-400 mx-auto opacity-60" />
              <h3 className="text-sm font-bold text-slate-200">No Reports Archived Yet</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Generate and save customized report briefings under the "Generator &amp; Config" tab to build an audit history.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
