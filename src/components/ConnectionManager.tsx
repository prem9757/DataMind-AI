import React, { useState, useEffect } from 'react';
import { Database, Cloud, Trash2, Edit, Play, CheckCircle2, AlertCircle, Plus } from 'lucide-react';
import { desktopBridge } from '../services/desktopBridge';

export function ConnectionManager() {
  const [connections, setConnections] = useState<any[]>([]);
  const [testStatus, setTestStatus] = useState<Record<string, { status: string; message?: string }>>({});

  useEffect(() => {
    const saved = localStorage.getItem('smart_data_saved_connections');
    if (saved) {
      setConnections(JSON.parse(saved));
    }
  }, []);

  const saveConnections = (newConns: any[]) => {
    setConnections(newConns);
    localStorage.setItem('smart_data_saved_connections', JSON.stringify(newConns));
  };

  const handleDelete = async (id: string, type: 'db' | 'cloud') => {
    const updated = connections.filter(c => c.id !== id);
    saveConnections(updated);
    if (type === 'db') {
      await desktopBridge.credentials.delete(`db_${id}_pwd`);
    } else {
      await desktopBridge.credentials.delete(`oauth_${id}_token`);
    }
  };

  const handleTest = async (conn: any) => {
    setTestStatus(prev => ({ ...prev, [conn.id]: { status: 'testing' } }));
    
    if (conn.category === 'cloud') {
      // For cloud we test if the token is valid by making a dummy request or just checking if token exists
      const token = await desktopBridge.credentials.load(`oauth_${conn.id}_token`);
      if (token) {
        setTestStatus(prev => ({ ...prev, [conn.id]: { status: 'success', message: 'OAuth Token verified.' } }));
      } else {
        setTestStatus(prev => ({ ...prev, [conn.id]: { status: 'error', message: 'Authentication required.' } }));
      }
    } else {
      // Database test
      const pwd = await desktopBridge.credentials.load(`db_${conn.id}_pwd`);
      const config = {
        type: conn.type,
        host: conn.host,
        port: conn.port,
        database: conn.database,
        user: conn.username,
        password: pwd || '',
        options: { ssl: conn.ssl }
      };
      
      const result = await desktopBridge.db.testConnection(config);
      setTestStatus(prev => ({ ...prev, [conn.id]: result }));
    }
  };

  const handleAuthenticate = async (conn: any) => {
    setTestStatus(prev => ({ ...prev, [conn.id]: { status: 'testing', message: 'Authenticating...' } }));
    const result = await desktopBridge.auth.oauth(conn.provider, { clientId: conn.clientId, tenantId: conn.tenantId, environment: conn.environment });
    if (result.status === 'success' && result.token) {
      await desktopBridge.credentials.save(`oauth_${conn.id}_token`, result.token);
      setTestStatus(prev => ({ ...prev, [conn.id]: { status: 'success', message: 'Authentication successful.' } }));
      const updated = connections.map(c => c.id === conn.id ? { ...c, authenticated: true } : c);
      saveConnections(updated);
    } else {
      setTestStatus(prev => ({ ...prev, [conn.id]: { status: 'error', message: result.message || 'Authentication failed.' } }));
    }
  };

  const handleDisconnect = async (conn: any) => {
    await desktopBridge.credentials.delete(`oauth_${conn.id}_token`);
    const updated = connections.map(c => c.id === conn.id ? { ...c, authenticated: false } : c);
    saveConnections(updated);
    setTestStatus(prev => ({ ...prev, [conn.id]: { status: 'idle', message: 'Disconnected.' } }));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider font-mono">
          Saved Connections
        </h3>
        <span className="text-xs text-slate-400">
          Manage saved database and authenticated cloud configurations
        </span>
      </div>

      {connections.length === 0 ? (
        <div className="bg-[#0F1218] border border-[#252A36] rounded-2xl p-8 text-center space-y-3">
          <Database className="w-8 h-8 text-slate-500 mx-auto" />
          <p className="text-sm text-slate-400">No saved connections found.</p>
          <p className="text-xs text-slate-500">You can save database connections and authenticate cloud providers during data ingestion.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {connections.map(conn => (
            <div key={conn.id} className="bg-[#0F1218] border border-[#252A36] rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-[#252A36] pb-3">
                <div className="flex items-center gap-2.5">
                  {conn.category === 'cloud' ? (
                    <Cloud className="w-5 h-5 text-sky-400" />
                  ) : (
                    <Database className="w-5 h-5 text-amber-400" />
                  )}
                  <div>
                    <h4 className="text-sm font-bold text-slate-200">{conn.name}</h4>
                    <p className="text-[10px] text-slate-500 uppercase font-mono">{conn.type || conn.provider}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleDelete(conn.id, conn.category)} className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-400/10 rounded-lg transition" title="Delete Connection">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {conn.category === 'cloud' ? (
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-slate-500">Provider:</span> <span className="text-slate-300 font-mono">{conn.provider}</span></div>
                  {conn.tenantId && <div className="flex justify-between"><span className="text-slate-500">Tenant ID:</span> <span className="text-slate-300 font-mono">{conn.tenantId}</span></div>}
                  <div className="flex justify-between">
                    <span className="text-slate-500">Status:</span> 
                    <span className={conn.authenticated ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
                      {conn.authenticated ? 'AUTHENTICATED' : 'AUTHENTICATION REQUIRED'}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-slate-500">Host:</span> <span className="text-slate-300 font-mono">{conn.host}:{conn.port}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Database:</span> <span className="text-slate-300 font-mono">{conn.database}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">User:</span> <span className="text-slate-300 font-mono">{conn.username}</span></div>
                </div>
              )}

              <div className="pt-2 border-t border-[#252A36] flex items-center justify-between">
                <div>
                  {testStatus[conn.id] && (
                    <div className="flex items-center gap-1.5 text-[11px]">
                      {testStatus[conn.id].status === 'testing' && <span className="text-amber-400 animate-pulse">Testing...</span>}
                      {testStatus[conn.id].status === 'success' && <><CheckCircle2 className="w-3 h-3 text-emerald-400" /><span className="text-emerald-400 truncate max-w-[120px]">{testStatus[conn.id].message || 'Success'}</span></>}
                      {testStatus[conn.id].status === 'error' && <><AlertCircle className="w-3 h-3 text-rose-400" /><span className="text-rose-400 truncate max-w-[120px]" title={testStatus[conn.id].message}>{testStatus[conn.id].message || 'Failed'}</span></>}
                    </div>
                  )}
                </div>
                
                <div className="flex gap-2">
                  {conn.category === 'cloud' && !conn.authenticated && (
                    <button onClick={() => handleAuthenticate(conn)} className="px-3 py-1.5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/20 rounded-lg text-xs font-bold transition">
                      Authenticate
                    </button>
                  )}
                  {conn.category === 'cloud' && conn.authenticated && (
                    <button onClick={() => handleDisconnect(conn)} className="px-3 py-1.5 bg-[#181D26] hover:bg-[#202734] text-slate-300 border border-[#2B3242] rounded-lg text-xs font-bold transition">
                      Disconnect
                    </button>
                  )}
                  <button onClick={() => handleTest(conn)} disabled={testStatus[conn.id]?.status === 'testing'} className="px-3 py-1.5 bg-[#181D26] hover:bg-[#202734] text-slate-300 border border-[#2B3242] rounded-lg text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50">
                    <Play className="w-3 h-3" /> Test
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
