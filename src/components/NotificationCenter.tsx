import React from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { AppNotification } from '../types/production';

interface NotificationCenterProps {
  notifications: AppNotification[];
  onDismiss: (id: string) => void;
  onNavigateSection?: (section: any) => void;
}

export function NotificationCenter({
  notifications,
  onDismiss,
  onNavigateSection
}: NotificationCenterProps) {
  if (notifications.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {notifications.slice(0, 4).map(n => {
        const isSuccess = n.type === 'success';
        const isError = n.type === 'error';
        const isWarning = n.type === 'warning';

        return (
          <div
            key={n.id}
            className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border shadow-2xl backdrop-blur-md transition-all duration-200 animate-in slide-in-from-bottom-2 ${
              isSuccess
                ? 'bg-[#0B0D11]/95 border-emerald-500/40 text-emerald-300'
                : isError
                ? 'bg-[#0B0D11]/95 border-rose-500/40 text-rose-300'
                : isWarning
                ? 'bg-[#0B0D11]/95 border-amber-500/40 text-amber-300'
                : 'bg-[#0B0D11]/95 border-blue-500/40 text-blue-300'
            }`}
          >
            <div className="mt-0.5 shrink-0">
              {isSuccess && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
              {isError && <AlertCircle className="w-4 h-4 text-rose-400" />}
              {isWarning && <AlertTriangle className="w-4 h-4 text-amber-400" />}
              {!isSuccess && !isError && !isWarning && <Info className="w-4 h-4 text-blue-400" />}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-100">{n.title}</p>
              <p className="text-[11px] text-slate-300 mt-0.5 leading-snug">{n.message}</p>
              {n.linkSection && onNavigateSection && (
                <button
                  onClick={() => {
                    onNavigateSection(n.linkSection);
                    onDismiss(n.id);
                  }}
                  className="mt-1.5 text-[10px] font-mono font-bold text-amber-400 hover:text-amber-300 underline"
                >
                  View Details →
                </button>
              )}
            </div>

            <button
              onClick={() => onDismiss(n.id)}
              className="text-slate-400 hover:text-slate-200 p-0.5 rounded transition-colors shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
