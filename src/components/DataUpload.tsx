import React, { useState, useRef, useEffect } from 'react';
import {
  UploadCloud, FileSpreadsheet, FileText, FileType, CheckCircle2,
  AlertCircle, ArrowRight, Database, Sliders, ChevronDown, ChevronUp,
  Monitor, Cloud, Globe, Briefcase, Play
} from 'lucide-react';
import { parseFile } from '../services/dataParser';
import { profileDataset } from '../services/profiler';
import { auditDataQuality } from '../services/qualityEngine';
import { generateDatasetInsights } from '../services/insightEngine';
import { DatasetState } from '../types/dataset';
import { SAMPLE_DATASETS } from '../services/sampleData';
import { desktopBridge } from '../services/desktopBridge';

import { globalConnectorRegistry, ConnectorCategory, Connector } from '../connectors';

interface DataUploadProps {
  onDatasetLoaded: (dataset: DatasetState) => void;
  onNavigate?: (section: any) => void;
  onLoadSample?: (sampleId: string) => void;
}

type Step = 'category' | 'connector' | 'configure' | 'preview' | 'importing' | 'ready';

export const DataUpload: React.FC<DataUploadProps> = ({ onDatasetLoaded, onNavigate, onLoadSample }) => {
  const [step, setStep] = useState<Step>('category');
  const [selectedCategory, setSelectedCategory] = useState<ConnectorCategory | null>(null);
  const [selectedConnector, setSelectedConnector] = useState<Connector | null>(null);
  
  const [configValues, setConfigValues] = useState<Record<string, any>>({});
  const [testStatus, setTestStatus] = useState<{status: string, message?: string} | null>(null);
  const [previewData, setPreviewData] = useState<any | null>(null);
  
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<any | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSaveConnection = async () => {
    if (!selectedConnector) return;
    try {
      setSaveStatus('saving');
      const connId = `conn_${Date.now()}`;
      
      const connData = {
        id: connId,
        name: `${selectedConnector.name} Connection`,
        type: selectedConnector.id.replace('db-', ''),
        category: selectedConnector.category,
        provider: selectedConnector.category === 'cloud' ? selectedConnector.name : undefined,
        ...configValues
      };

      if (selectedConnector.category === 'cloud') {
        const result = await desktopBridge.auth.oauth(selectedConnector.name, configValues);
        if (result.status === 'success' && result.token) {
          await desktopBridge.credentials.save(`oauth_${connId}_token`, result.token);
          connData.authenticated = true;
        } else {
          setSaveStatus('error');
          setErrorMessage(result.message || 'OAuth Failed');
          return;
        }
      } else if (configValues.password) {
        await desktopBridge.credentials.save(`db_${connId}_pwd`, configValues.password);
        delete connData.password;
      }

      const existing = JSON.parse(localStorage.getItem('smart_data_saved_connections') || '[]');
      existing.push(connData);
      localStorage.setItem('smart_data_saved_connections', JSON.stringify(existing));
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (e: any) {
      setSaveStatus('error');
      setErrorMessage(e.message || 'Failed to save connection.');
    }
  };
  const isDesktop = desktopBridge.isElectron();

  // Reset flow when going back
  const goBack = (targetStep: Step) => {
    setStep(targetStep);
    setErrorMessage(null);
    if (targetStep === 'category') {
      setSelectedCategory(null);
      setSelectedConnector(null);
      setConfigValues({});
      setTestStatus(null);
      setPreviewData(null);
    }
  };

  const handleCategorySelect = (cat: ConnectorCategory) => {
    setSelectedCategory(cat);
    setStep('connector');
  };

  const handleConnectorSelect = (conn: Connector) => {
    setSelectedConnector(conn);
    setStep('configure');
    
    // Initialize config values
    const initialConfig: Record<string, any> = {};
    conn.configFields.forEach(f => {
      initialConfig[f.id] = f.defaultValue !== undefined ? f.defaultValue : '';
    });
    setConfigValues(initialConfig);
    setTestStatus(null);
    setPreviewData(null);
  };

  const handleTestConnection = async () => {
    if (!selectedConnector) return;
    setTestStatus({ status: 'testing', message: 'Testing connection...' });
    setErrorMessage(null);
    try {
      let finalConfig = { ...configValues };
      if (finalConfig.id && !finalConfig.password) {
        if (finalConfig.category === 'cloud') {
          const token = await desktopBridge.credentials.load(`oauth_${finalConfig.id}_token`);
          if (token) finalConfig.accessToken = token;
        } else {
          const pwd = await desktopBridge.credentials.load(`db_${finalConfig.id}_pwd`);
          if (pwd) finalConfig.password = pwd;
        }
      }

      const res = await selectedConnector.testConnection(finalConfig);
      setTestStatus(res);
      if (res.status === 'success') {
        const preview = await selectedConnector.preview(finalConfig);
        setPreviewData(preview);
        setStep('preview');
      } else if (res.status === 'unsupported' || res.status === 'error') {
        setErrorMessage(res.message || 'Connection failed.');
      }
    } catch (e: any) {
      setTestStatus({ status: 'error', message: e.message });
      setErrorMessage(e.message);
    }
  };

  const handleImport = async () => {
    if (!selectedConnector) return;
    setStep('importing');
    setErrorMessage(null);
    try {
      let finalConfig = { ...configValues };
      if (finalConfig.id && !finalConfig.password) {
        if (finalConfig.category === 'cloud') {
          const token = await desktopBridge.credentials.load(`oauth_${finalConfig.id}_token`);
          if (token) finalConfig.accessToken = token;
        } else {
          const pwd = await desktopBridge.credentials.load(`db_${finalConfig.id}_pwd`);
          if (pwd) finalConfig.password = pwd;
        }
      }

      const { columns, rows } = await selectedConnector.import(finalConfig);
      
      const name = configValues.file ? configValues.file.name.replace(/\.[^/.]+$/, '') : selectedConnector.name;
      const fileName = configValues.file ? configValues.file.name : `${selectedConnector.id}-import`;
      const fileSize = configValues.file ? configValues.file.size : 0;
      
      await processAndSetDataset(name, fileName, fileSize, selectedConnector.id, columns, rows);
    } catch (e: any) {
      setErrorMessage(e.message || 'Import failed.');
      setStep('preview');
    }
  };

  // Keep original drag and drop for backward compatibility / quick UX
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      handleQuickFile(file);
    }
  };

  const handleQuickFile = async (file: File) => {
    setErrorMessage(null);
    setSuccessData(null);
    setStep('importing');
    try {
      const parsed = await parseFile(file);
      await processAndSetDataset(
        file.name.replace(/\.[^/.]+$/, ''),
        file.name,
        file.size,
        parsed.fileType,
        parsed.columns,
        parsed.rows
      );
    } catch (err: any) {
      setErrorMessage(err.message || 'Upload failed.');
      setStep('category');
    }
  };

  const processAndSetDataset = async (
    name: string, fileName: string, fileSize: number, fileType: string,
    columns: string[], rows: Record<string, any>[]
  ) => {
    try {
      await new Promise(r => setTimeout(r, 150));
      if (!rows || rows.length === 0 || !columns || columns.length === 0) {
        throw new Error('Dataset is empty or contains no readable columns/rows.');
      }

      const profiles = profileDataset(rows, columns);
      const quality = auditDataQuality(rows, columns, profiles);
      const { insights, recommendations, suggestedQuestions } = generateDatasetInsights(rows, columns, profiles);

      const datasetState: DatasetState = {
        id: `ds-${Date.now()}`,
        name,
        fileName,
        fileSize,
        fileType,
        uploadedAt: Date.now(),
        originalRows: [...rows],
        workingRows: [...rows],
        columns,
        profiles,
        quality,
        transformations: [],
        insights,
        recommendations,
        suggestedQuestions
      };

      setStep('ready');
      setSuccessData({
        name, fileName, rows: rows.length, columns: columns.length,
        status: 'Ready for Analysis', qualityScore: quality.score
      });

      onDatasetLoaded(datasetState);

      setTimeout(() => {
        if (onNavigate) onNavigate('overview');
      }, 700);
    } catch (err: any) {
      setErrorMessage(err.message || 'Processing failed.');
      setStep('category');
    }
  };

  const renderCategoryIcon = (cat: ConnectorCategory) => {
    switch (cat) {
      case 'files': return <FileText className="w-6 h-6 text-blue-400" />;
      case 'databases': return <Database className="w-6 h-6 text-purple-400" />;
      case 'cloud': return <Cloud className="w-6 h-6 text-cyan-400" />;
      case 'web': return <Globe className="w-6 h-6 text-emerald-400" />;
      case 'microsoft': return <Briefcase className="w-6 h-6 text-blue-500" />;
      default: return <Database className="w-6 h-6" />;
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="border-b border-[#252A36] pb-4 flex justify-between items-end">
        <div>
          <h1 className="text-xl font-bold text-slate-100 tracking-tight">Get Data</h1>
          <p className="text-xs text-slate-400 mt-1">
            Connect to files, databases, and online services to import datasets.
          </p>
        </div>
        
        {step !== 'category' && step !== 'ready' && step !== 'importing' && (
          <button 
            onClick={() => goBack(step === 'connector' ? 'category' : step === 'configure' ? 'connector' : 'configure')}
            className="text-xs text-amber-400 hover:text-amber-300 transition"
          >
            ← Back
          </button>
        )}
      </div>

      {errorMessage && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 flex items-center gap-3 text-rose-300 text-xs">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Flow */}
      {step === 'category' && (
        <div className="space-y-6">
          <div 
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all relative overflow-hidden ${
              isDragging ? 'border-amber-400 bg-amber-500/10' : 'border-[#252A36] bg-[#12151C]'
            }`}
          >
            <div className="text-slate-400 mb-2">
              <UploadCloud className="w-8 h-8 mx-auto text-amber-500/60" />
            </div>
            <h3 className="text-sm font-bold text-slate-200">Quick Drop</h3>
            <p className="text-xs text-slate-400 mt-1">Drag and drop a CSV or JSON file here to instantly import.</p>
          </div>

          <h2 className="text-sm font-bold text-slate-300">Choose Source Category</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {(['files', 'databases', 'cloud', 'web', 'microsoft'] as ConnectorCategory[]).map(cat => (
              <button
                key={cat}
                onClick={() => handleCategorySelect(cat)}
                className="p-4 rounded-xl bg-[#12151C] hover:bg-[#181D26] border border-[#252A36] hover:border-amber-500/40 text-center transition flex flex-col items-center gap-3 cursor-pointer group"
              >
                <div className="p-3 rounded-xl bg-[#0B0D11] border border-[#252A36] group-hover:border-amber-500/30">
                  {renderCategoryIcon(cat)}
                </div>
                <span className="text-xs font-bold text-slate-200 capitalize">{cat}</span>
              </button>
            ))}
          </div>

          {/* Saved Connections */}
          {(() => {
            const savedStr = localStorage.getItem('smart_data_saved_connections');
            const saved = savedStr ? JSON.parse(savedStr) : [];
            if (saved.length === 0) return null;
            return (
              <div className="border-t border-[#252A36] pt-6 space-y-3">
                <h2 className="text-sm font-bold text-slate-300">Saved Connections</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {saved.map((conn: any) => (
                    <button
                      key={conn.id}
                      onClick={() => {
                        const baseConnector = globalConnectorRegistry.getConnectorsByCategory(conn.category).find(c => (c.id === `db-${conn.type}` || c.name === conn.provider || c.id === conn.connectorId));
                        if (baseConnector) {
                          setSelectedCategory(conn.category);
                          setSelectedConnector(baseConnector);
                          setConfigValues({ ...conn }); // preload config
                          setStep('configure');
                        }
                      }}
                      className="p-3.5 rounded-xl bg-[#12151C] hover:bg-[#181D26] border border-[#252A36] hover:border-amber-500/30 text-left transition flex items-start gap-3 group cursor-pointer"
                    >
                      <div className="p-2 rounded-lg bg-[#0B0D11] border border-[#252A36]">
                        {conn.category === 'cloud' ? <Cloud className="w-4 h-4 text-sky-400" /> : <Database className="w-4 h-4 text-amber-400" />}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-200 group-hover:text-amber-400 transition">
                          {conn.name}
                        </p>
                        <p className="text-[10px] text-slate-500 uppercase font-mono mt-0.5">
                          {conn.category === 'cloud' ? conn.provider : `${conn.type} - ${conn.host}`}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Sample Datasets */}
          <div className="border-t border-[#252A36] pt-6 space-y-3">
            <h2 className="text-sm font-bold text-slate-300">Or Select a Sample Dataset</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {SAMPLE_DATASETS.map(sample => (
                <button
                  key={sample.id}
                  onClick={() => onLoadSample && onLoadSample(sample.id)}
                  className="p-3.5 rounded-xl bg-[#12151C] hover:bg-[#181D26] border border-[#252A36] hover:border-amber-500/30 text-left transition flex items-start justify-between gap-3 group cursor-pointer"
                >
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-200 group-hover:text-amber-400 transition">
                      {sample.name}
                    </p>
                    <p className="text-[11px] text-slate-400 line-clamp-2">
                      {sample.description}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {step === 'connector' && selectedCategory && (
        <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
          <h2 className="text-sm font-bold text-slate-300 capitalize">{selectedCategory} Connectors</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {globalConnectorRegistry.getConnectorsByCategory(selectedCategory).map(conn => (
              <button
                key={conn.id}
                onClick={() => handleConnectorSelect(conn)}
                className="p-4 rounded-xl bg-[#12151C] hover:bg-[#181D26] border border-[#252A36] hover:border-amber-500/40 text-left transition flex flex-col gap-2 cursor-pointer group relative"
              >
                {conn.requiresDriver && (
                  <span className="absolute top-3 right-3 text-[9px] uppercase font-bold bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded">Driver Req</span>
                )}
                {conn.requiresAuthentication && (
                  <span className="absolute top-3 right-3 text-[9px] uppercase font-bold bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">Auth Req</span>
                )}
                <h3 className="text-sm font-bold text-slate-200 group-hover:text-amber-400 transition">{conn.name}</h3>
                <p className="text-xs text-slate-400">{conn.description}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 'configure' && selectedConnector && (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
          <div>
            <h2 className="text-sm font-bold text-slate-200">Configure {selectedConnector.name}</h2>
            <p className="text-xs text-slate-400 mt-1">Provide connection details.</p>
          </div>

          <div className="bg-[#12151C] border border-[#252A36] rounded-xl p-5 space-y-4">
            {selectedConnector.configFields.map(field => (
              <div key={field.id}>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">{field.label} {field.required && <span className="text-rose-400">*</span>}</label>
                {field.type === 'select' ? (
                  <select
                    className="w-full bg-[#0B0D11] border border-[#252A36] rounded-lg px-3 py-2 text-sm text-slate-200"
                    value={configValues[field.id] || ''}
                    onChange={e => setConfigValues({...configValues, [field.id]: e.target.value})}
                  >
                    {field.options?.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                ) : field.type === 'file' ? (
                  <input
                    type="file"
                    onChange={e => {
                      if (e.target.files && e.target.files.length > 0) {
                        setConfigValues({...configValues, [field.id]: e.target.files[0]});
                      }
                    }}
                    className="w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[#252A36] file:text-slate-200 hover:file:bg-[#2A3143]"
                  />
                ) : (
                  <input
                    type={field.type}
                    placeholder={field.placeholder}
                    value={configValues[field.id] || ''}
                    onChange={e => setConfigValues({...configValues, [field.id]: e.target.value})}
                    className="w-full bg-[#0B0D11] border border-[#252A36] rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500/50"
                  />
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-3 justify-end">
            <button
              onClick={handleTestConnection}
              disabled={testStatus?.status === 'testing'}
              className="px-5 py-2 rounded-xl bg-[#252A36] hover:bg-[#2A3143] text-slate-200 font-bold text-xs transition flex items-center gap-2"
            >
              {testStatus?.status === 'testing' ? (
                <span className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></span>
              ) : <Play className="w-3.5 h-3.5" />}
              Test Connection & Preview
            </button>
            {(selectedConnector.category === 'databases' || selectedConnector.category === 'cloud') && (
              <button
                onClick={handleSaveConnection}
                disabled={saveStatus === 'saving'}
                className="px-5 py-2 rounded-xl border border-[#252A36] hover:bg-[#181D26] text-amber-400 font-bold text-xs transition flex items-center gap-2"
              >
                {saveStatus === 'saving' ? (
                  <span className="w-3.5 h-3.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"></span>
                ) : saveStatus === 'saved' ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                ) : <Database className="w-3.5 h-3.5" />}
                {saveStatus === 'saved' ? 'Saved to Settings' : 'Save Connection'}
              </button>
            )}
          </div>
          
          {testStatus?.status === 'unsupported' && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-amber-400 text-xs font-mono">
              [SYSTEM WARNING] {testStatus.message}
            </div>
          )}
        </div>
      )}

      {step === 'preview' && previewData && (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
          <div className="flex justify-between items-end">
            <div>
              <h2 className="text-sm font-bold text-slate-200">Data Preview</h2>
              <p className="text-xs text-slate-400 mt-1">Showing sample of {previewData.rowCount} rows and {previewData.columnCount} columns.</p>
            </div>
            <button
              onClick={handleImport}
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 transition flex items-center gap-2"
            >
              <span>Import Dataset</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="bg-[#12151C] border border-[#252A36] rounded-xl overflow-hidden overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-[#0B0D11] text-slate-400 uppercase font-mono text-[10px]">
                <tr>
                  {previewData.columns.slice(0, 10).map((col: string) => (
                    <th key={col} className="px-4 py-2 border-b border-[#252A36] font-medium">{col}</th>
                  ))}
                  {previewData.columns.length > 10 && <th className="px-4 py-2 border-b border-[#252A36]">...</th>}
                </tr>
              </thead>
              <tbody className="text-slate-300 divide-y divide-[#252A36]">
                {previewData.rows.slice(0, 5).map((row: any, i: number) => (
                  <tr key={i} className="hover:bg-[#181D26] transition-colors">
                    {previewData.columns.slice(0, 10).map((col: string) => (
                      <td key={`${i}-${col}`} className="px-4 py-2 truncate max-w-[150px]">{String(row[col] ?? '')}</td>
                    ))}
                    {previewData.columns.length > 10 && <td className="px-4 py-2 text-slate-500">...</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {step === 'importing' && (
        <div className="py-20 flex flex-col items-center justify-center space-y-4">
          <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-bold text-amber-400">Importing and profiling dataset...</p>
        </div>
      )}

      {step === 'ready' && successData && (
        <div className="bg-[#12151C] border border-emerald-500/30 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center gap-2.5 border-b border-[#252A36] pb-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-emerald-300">Import Successful</h3>
              <p className="text-xs text-slate-400">{successData.name} is ready.</p>
            </div>
          </div>
          <div className="flex justify-end">
             {onNavigate && (
              <button
                onClick={() => onNavigate('overview')}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition flex items-center gap-2 cursor-pointer shadow-md shadow-amber-500/20"
              >
                <span>Explore Data</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
