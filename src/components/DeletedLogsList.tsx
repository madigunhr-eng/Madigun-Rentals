import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Search, History, Trash2, Calendar, User, Clipboard, AlertTriangle, RotateCcw, CheckCircle2, XCircle } from 'lucide-react';
import { DeletedLog } from '../types';

interface DeletedLogsListProps {
  logs: DeletedLog[];
  onRestoreTransmittal: (log: DeletedLog) => Promise<void>;
  onDeleteLog?: (logId: string) => Promise<void>;
}

export default function DeletedLogsList({ logs, onRestoreTransmittal, onDeleteLog }: DeletedLogsListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [purgingLogId, setPurgingLogId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filter logs based on search query
  const filteredLogs = logs.filter(log => {
    return (
      log.transmittalNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.rentee.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.handler.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const handleRestoreProceed = async (log: DeletedLog) => {
    setRestoringId(log.id);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await onRestoreTransmittal(log);
      setSuccessMsg(`Transmittal ${log.transmittalNo} has been restored successfully!`);
      setConfirmingId(null);
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to restore transmittal.');
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header section */}
      <div className="border-b border-zinc-200 pb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-xl font-black font-display text-zinc-900 uppercase tracking-wider flex items-center gap-2">
            <History className="h-5 w-5 text-red-600" />
            Deleted Logs & Audit Trail
          </h1>
        </div>
      </div>

      {/* Success / Error Messages */}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 p-4 text-emerald-800 text-xs font-bold uppercase tracking-wider flex items-center gap-2.5">
          <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 p-4 text-red-800 text-xs font-bold uppercase tracking-wider flex items-center gap-2.5">
          <XCircle className="h-4.5 w-4.5 text-red-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-center bg-white p-4 border border-zinc-200">
        <div className="relative w-full flex-1">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-zinc-400">
            <Search className="h-4 w-4" />
          </span>
          <input
            id="input-search-logs"
            type="text"
            placeholder="Search logs by TX No., Rentee, or Custodian Handler..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-zinc-200 text-xs font-semibold uppercase tracking-wider bg-zinc-50 focus:bg-white focus:outline-none focus:border-zinc-900 transition-all text-zinc-800 placeholder-zinc-400"
          />
        </div>
      </div>

      {/* Table view or empty state */}
      {filteredLogs.length === 0 ? (
        <div className="bg-white border border-zinc-200 p-12 text-center text-zinc-400">
          <Clipboard className="h-8 w-8 mx-auto mb-3 text-zinc-300" />
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">No logs found</p>
          <p className="text-[11px] text-zinc-400 mt-1 uppercase tracking-wider font-semibold">
            {logs.length === 0 
              ? "All transmittal records are currently active and intact." 
              : "Try refining your search queries."}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-zinc-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                  <th className="py-3 px-4">TX Code</th>
                  <th className="py-3 px-4">Deleted At</th>
                  <th className="py-3 px-4">Recipient</th>
                  <th className="py-3 px-4">Custodian</th>
                  <th className="py-3 px-4">Status on Delete</th>
                  <th className="py-3 px-4">Deleted Items Summary</th>
                  <th className="py-3 px-4 text-right">Items Count</th>
                  <th className="py-3 px-4 text-center">Restore Option</th>
                  {onDeleteLog && <th className="py-3 px-4 text-right">Purge Log</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-xs">
                {filteredLogs.map((log) => {
                  const deletedDateFormatted = new Date(log.deletedAt).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <tr key={log.id} className="hover:bg-zinc-50/50 transition-all group">
                      <td className="py-4 px-4 font-mono font-bold text-red-650 group-hover:text-red-700">
                        {log.transmittalNo}
                      </td>
                      <td className="py-4 px-4 text-zinc-500 font-mono text-[11px]">
                        {deletedDateFormatted}
                      </td>
                      <td className="py-4 px-4 font-bold text-zinc-800 uppercase tracking-wide">
                        {log.rentee}
                      </td>
                      <td className="py-4 px-4 font-semibold text-zinc-650 uppercase">
                        {log.handler}
                      </td>
                      <td className="py-4 px-4">
                        <span className={`inline-flex px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider border ${
                          log.statusAtDeletion === 'Returned'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : log.statusAtDeletion === 'Partially Returned'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-zinc-100 text-zinc-700 border-zinc-200'
                        }`}>
                          {log.statusAtDeletion}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-zinc-555 max-w-xs truncate font-medium text-zinc-600" title={log.itemsSummary}>
                        {log.itemsSummary}
                      </td>
                      <td className="py-4 px-4 text-right font-mono font-bold text-zinc-800">
                        {log.itemsCount}
                      </td>
                      <td className="py-4 px-4 text-center">
                        {log.originalData ? (
                          confirmingId === log.id ? (
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handleRestoreProceed(log)}
                                disabled={restoringId !== null}
                                className="py-1 px-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer border border-emerald-600 shrink-0"
                              >
                                {restoringId === log.id ? 'Restoring...' : 'Confirm'}
                              </button>
                              <button
                                onClick={() => setConfirmingId(null)}
                                disabled={restoringId !== null}
                                className="py-1 px-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer border border-zinc-200 shrink-0"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmingId(log.id)}
                              disabled={restoringId !== null}
                              className="py-1 px-2.5 bg-zinc-900 hover:bg-zinc-800 text-white disabled:opacity-40 text-[9px] font-bold uppercase tracking-widest transition-all cursor-pointer inline-flex items-center gap-1 border border-zinc-900"
                            >
                              <RotateCcw className="h-3 w-3" />
                              Restore
                            </button>
                          )
                        ) : (
                          <span 
                            className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 px-1.5 py-0.5 border border-dashed border-zinc-200 bg-zinc-50"
                            title="Legacy deletion log created before restore protocol was established. Cannot be automatically reconstructed."
                          >
                            N/A
                          </span>
                        )}
                      </td>
                      {onDeleteLog && (
                        <td className="py-4 px-4 text-right">
                          {purgingLogId === log.id ? (
                            <div className="inline-flex items-center gap-1">
                              <button
                                onClick={async () => {
                                  try {
                                    await onDeleteLog(log.id);
                                    setSuccessMsg(`Purged audit record ${log.transmittalNo}.`);
                                    setTimeout(() => setSuccessMsg(null), 3000);
                                    setPurgingLogId(null);
                                  } catch (err: any) {
                                    setErrorMsg(err.message || 'Failed to purge log entry.');
                                    setPurgingLogId(null);
                                  }
                                }}
                                className="py-1 px-2 bg-red-650 hover:bg-red-700 text-white text-[9px] font-bold uppercase tracking-wider cursor-pointer"
                              >
                                Purge
                              </button>
                              <button
                                onClick={() => setPurgingLogId(null)}
                                className="py-1 px-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 text-[9px] font-bold uppercase tracking-wider cursor-pointer border border-zinc-200"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setPurgingLogId(log.id)}
                              className="p-1.5 text-zinc-400 hover:text-red-650 hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors cursor-pointer inline-flex items-center gap-1 rounded-sm"
                              title="Permanently purge audit log entry"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="bg-zinc-50/50 p-4 border-t border-zinc-200 flex items-center gap-2.5 text-[10px] uppercase font-bold tracking-widest text-zinc-400">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
            <span>Note: This is an immutable audit log. Restoring a transmittal recreates it and removes the matching deletion entry from this list.</span>
          </div>
        </div>
      )}
    </div>
  );
}
