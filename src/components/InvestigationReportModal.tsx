import React from 'react';
import { AgentInvestigation } from '../types/agent';
import { FileText, Download, Check, X, ShieldCheck, Layers, Target, BrainCircuit } from 'lucide-react';
import { desktopBridge } from '../services/desktopBridge';

interface InvestigationReportModalProps {
  investigation: AgentInvestigation;
  onClose: () => void;
}

export const InvestigationReportModal: React.FC<InvestigationReportModalProps> = ({
  investigation,
  onClose
}) => {
  const answer = investigation.finalAnswer;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadMarkdown = () => {
    let md = `# Autonomous AI Investigation Briefing\n\n`;
    md += `**Objective:** ${investigation.goal}\n`;
    md += `**Dataset:** ${investigation.datasetName} (v${investigation.datasetVersion}.0)\n`;
    md += `**Status:** ${investigation.status}\n`;
    md += `**Confidence:** ${answer?.overallConfidence || 'MEDIUM'}\n\n`;
    md += `## Executive Answer\n${answer?.executiveAnswer || ''}\n\n`;
    md += `## Key Empirical Findings\n`;
    answer?.keyFindings.forEach((f, i) => {
      md += `${i + 1}. ${f}\n`;
    });
    md += `\n## Strategic Recommendations\n`;
    answer?.recommendations.forEach(r => {
      md += `- **[${r.priority}] ${r.action}**: ${r.rationale} (Expected Impact: ${r.expectedImpact})\n`;
    });
    md += `\n## Analytical Limitations\n`;
    answer?.limitations.forEach(l => {
      md += `- ${l}\n`;
    });

    const cleanFilename = `investigation-report-${investigation.id}.md`;
    desktopBridge.exportFile({
      defaultPath: cleanFilename,
      title: 'Save Investigation Briefing Markdown',
      filters: [{ name: 'Markdown Document (*.md)', extensions: ['md'] }],
      content: md,
      mimeType: 'text/markdown;charset=utf-8;'
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#12161F] border border-[#252A36] rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Modal Header */}
        <div className="p-5 border-b border-[#252A36] flex items-center justify-between bg-[#0E121A]">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <FileText className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-slate-100">Executive Investigation Briefing</h3>
              <p className="text-xs text-slate-400 font-mono">ID: {investigation.id}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadMarkdown}
              className="px-3 py-1.5 rounded-xl bg-[#1B212D] hover:bg-[#252C3C] text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-amber-400" />
              <span>Export .MD</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-[#1B212D] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-slate-300 text-xs leading-relaxed">
          {/* Overview Block */}
          <div className="p-4 rounded-xl bg-[#090B0E] border border-[#1A1F2B] space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>Goal / Investigation Hypothesis</span>
              <span className="font-mono text-amber-400">Confidence: {answer?.overallConfidence || 'HIGH'}</span>
            </div>
            <h4 className="text-sm font-bold text-slate-100">{investigation.goal}</h4>
            <div className="flex items-center gap-3 text-[11px] text-slate-400 pt-1">
              <span>Dataset: <strong className="text-slate-200">{investigation.datasetName}</strong></span>
              <span>Version: <strong className="text-slate-200">v{investigation.datasetVersion}.0</strong></span>
              <span>Tasks Executed: <strong className="text-slate-200">{investigation.completedTaskIds.length}</strong></span>
            </div>
          </div>

          {/* Executive Answer */}
          <div className="space-y-2">
            <h5 className="text-xs font-bold text-amber-400 uppercase tracking-wider">Executive Synthesis</h5>
            <p className="p-4 rounded-xl bg-[#161B24] border border-[#252A36] text-slate-200 leading-relaxed">
              {answer?.executiveAnswer}
            </p>
          </div>

          {/* Key Empirical Findings */}
          <div className="space-y-2">
            <h5 className="text-xs font-bold text-amber-400 uppercase tracking-wider">Key Empirical Findings</h5>
            <div className="space-y-1.5">
              {answer?.keyFindings.map((finding, idx) => (
                <div key={idx} className="p-2.5 rounded-lg bg-[#0E121A] border border-[#1E232E] flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{finding}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recommendations */}
          <div className="space-y-2">
            <h5 className="text-xs font-bold text-amber-400 uppercase tracking-wider">Strategic Recommendations</h5>
            <div className="space-y-2">
              {answer?.recommendations.map((rec, rIdx) => (
                <div key={rIdx} className="p-3 rounded-xl bg-[#0E121A] border border-[#1E232E] space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                      {rec.priority} PRIORITY
                    </span>
                    <span className="font-semibold text-slate-100">{rec.action}</span>
                  </div>
                  <p className="text-slate-400 text-[11px]">{rec.rationale}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Methodological Limitations */}
          <div className="space-y-2">
            <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Analytical Guardrails & Limitations</h5>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-400">
              {answer?.limitations.map((l, lIdx) => (
                <li key={lIdx}>{l}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
