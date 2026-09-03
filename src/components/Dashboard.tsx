import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Package, Send, ArrowUpRight, ArrowDownRight, AlertTriangle, Clock, RefreshCw, HardDrive, Zap, Cloud, Upload } from 'lucide-react';
import { InventoryItem, Transmittal, UserSession } from '../types';
import { isDriveConnected, getCachedDriveUser, backupDatabaseToDrive, getLastDriveBackupTime } from '../googleDrive';
import { isFirestoreOnline } from '../firebaseSync';

interface DashboardProps {
  inventory: InventoryItem[];
  transmittals: Transmittal[];
  onCreateTransmittalClick: () => void;
  onAddInventoryClick: () => void;
  setView: (view: any) => void;
  currentUser?: UserSession | null;
  onOpenCloudSync?: () => void;
}

// Stats Card Component (Geometric Balance) - Defined outside to prevent unmounting & blinking on parent state changes
const StatCard = ({ title, value, icon: Icon, color }: any) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="bg-white border border-zinc-200 p-4 sm:p-6 relative overflow-hidden"
  >
    <div className="flex justify-between items-start">
      <div>
        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-1">{title}</span>
        <h3 className="text-2xl sm:text-3xl font-extrabold font-display text-zinc-900 tracking-tight">{value}</h3>
      </div>
      <div className={`p-2 sm:p-2.5 bg-zinc-50 border border-zinc-200 text-zinc-800`}>
        <Icon className="h-4 w-4" />
      </div>
    </div>
  </motion.div>
);

export default function Dashboard({
  inventory,
  transmittals,
  onCreateTransmittalClick,
  onAddInventoryClick,
  setView,
  currentUser,
  onOpenCloudSync
}: DashboardProps) {
  // Compute Stats
  const totalItemsCount = inventory.reduce((acc, item) => acc + item.quantityTotal, 0);
  const availableItemsCount = inventory.reduce((acc, item) => acc + item.quantityAvailable, 0);
  const checkedOutCount = totalItemsCount - availableItemsCount;
  
  const activeTransmittals = transmittals.filter(t => t.status !== 'Returned');
  const pendingReturnCount = activeTransmittals.length;

  // Check for overdue transmittals (dateCheckin < today and status !== 'Returned')
  const todayStr = new Date().toISOString().split('T')[0];
  const overdueTransmittals = activeTransmittals.filter(t => {
    return t.dateCheckin < todayStr;
  });

  // Low stock items (alert if available < 5 or less than 20% of total stock remains)
  const lowStockItems = inventory.filter(item => {
    const isLow = item.quantityAvailable < 5 || (item.quantityAvailable / item.quantityTotal) <= 0.20;
    return isLow && item.quantityTotal > 0;
  });

  const isAdmin = currentUser?.role === 'Admin';

  return (
    <div className="space-y-8">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-200 pb-6">
        <div>
          <h1 className="text-xl font-black font-display text-zinc-900 uppercase tracking-wider">System Overview</h1>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          {isAdmin && (
            <button
              id="btn-add-item-dash"
              onClick={onAddInventoryClick}
              className="flex-1 sm:flex-none inline-flex items-center justify-center px-4 py-2 text-xs font-bold uppercase tracking-widest text-zinc-700 bg-white border border-zinc-300 hover:bg-zinc-50 transition-colors focus:outline-none cursor-pointer"
            >
              <Package className="h-3.5 w-3.5 mr-2 text-zinc-500" />
              Add Profile
            </button>
          )}
          {currentUser?.role !== 'Managing Director' && (
            <button
              id="btn-new-tx-dash"
              onClick={onCreateTransmittalClick}
              className="flex-1 sm:flex-none inline-flex items-center justify-center px-4 py-2 text-xs font-bold uppercase tracking-widest text-white bg-zinc-900 hover:bg-zinc-800 transition-colors focus:outline-none cursor-pointer animate-pulse"
            >
              <Send className="h-3.5 w-3.5 mr-2" />
              New Transmittal
            </button>
          )}
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          title="Total Registered Assets"
          value={totalItemsCount}
          icon={Package}
        />
        <StatCard
          title="Currently Rented / Checked-Out"
          value={checkedOutCount}
          icon={ArrowUpRight}
        />
        <StatCard
          title="Active Transmittals"
          value={pendingReturnCount}
          icon={Send}
        />
        <StatCard
          title="Overdue Transmittals"
          value={overdueTransmittals.length}
          icon={Clock}
        />
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Recent Transmittals Column */}
        <div className="lg:col-span-2 bg-white border border-zinc-200 p-4 sm:p-6 flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-900">Recent Transmittal Logs</h2>
            </div>
            <button
              id="link-view-all-tx"
              onClick={() => setView('transmittals')}
              className="text-xs font-bold uppercase tracking-widest text-zinc-900 hover:underline cursor-pointer"
            >
              View All
            </button>
          </div>

          <div className="flex-1 overflow-x-auto">
            {transmittals.length === 0 ? (
              <div className="py-12 text-center text-zinc-400">
                <Send className="h-8 w-8 mx-auto mb-2 text-zinc-300" />
                <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">No transmittal history</p>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                    <th className="py-3 px-2">TX ID</th>
                    <th className="py-3 px-2">Rentee Name</th>
                    <th className="py-3 px-2">Units Included</th>
                    <th className="py-3 px-2">Due Date</th>
                    <th className="py-3 px-2 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {transmittals.slice(0, 5).map((tx) => {
                    const isOverdue = tx.status !== 'Returned' && tx.dateCheckin < todayStr;
                    return (
                      <tr key={tx.id} className="hover:bg-zinc-50/50 transition-colors">
                        <td className="py-3.5 px-2 font-mono text-xs font-bold text-zinc-900">{tx.transmittalNo}</td>
                        <td className="py-3.5 px-2">
                          <div className="font-bold text-zinc-900">{tx.rentee}</div>
                          <div className="text-[10px] text-zinc-400 uppercase tracking-wide">Issued by {tx.handler}</div>
                        </td>
                        <td className="py-3.5 px-2 text-zinc-600 font-mono text-xs">
                          {tx.items.length} {tx.items.length === 1 ? 'item' : 'items'}
                          <span className="block text-[10px] text-zinc-400 truncate max-w-[150px]">
                            {tx.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}
                          </span>
                        </td>
                        <td className="py-3.5 px-2 text-zinc-600">
                          <span className={`font-mono text-xs ${isOverdue ? 'text-red-600 font-bold' : ''}`}>
                            {tx.dateCheckin}
                          </span>
                        </td>
                        <td className="py-3.5 px-2 text-right">
                          <span className={`inline-flex items-center px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider border ${
                            tx.status === 'Returned' 
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : tx.status === 'Partially Returned'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : isOverdue
                              ? 'bg-red-50 text-red-700 border-red-200'
                              : 'bg-zinc-100 text-zinc-800 border-zinc-200'
                          }`}>
                            {isOverdue ? 'Overdue' : tx.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Alerts & Quick Actions Column */}
        <div className="space-y-4 sm:space-y-6">
          {/* Low stock alerts */}
          <div className="bg-white border border-zinc-200 p-4 sm:p-6">
            <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-900 mb-4 flex items-center">
              <AlertTriangle className="h-4 w-4 text-zinc-800 mr-2" />
              Low Stock Alert
            </h2>
            
            {lowStockItems.length === 0 ? (
              <p className="text-xs text-zinc-400 py-4 text-center uppercase tracking-widest font-semibold">All rental item levels stable</p>
            ) : (
              <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                {lowStockItems.map(item => (
                  <div key={item.id} className="flex justify-between items-center p-3 bg-zinc-50 border border-zinc-200">
                    <div className="min-w-0 pr-2">
                      <p className="text-xs font-bold text-zinc-900 truncate uppercase tracking-tight">{item.name}</p>
                      <p className="text-[10px] text-zinc-400 font-mono mt-0.5">{item.sku}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`inline-block px-2 py-0.5 font-mono text-[10px] font-bold border ${
                        item.quantityAvailable === 0 
                          ? 'bg-red-50 text-red-800 border-red-200' 
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}>
                        {item.quantityAvailable} / {item.quantityTotal} Left
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cloud Database & Google Drive Live Sync Card */}
          <div className="bg-white border border-zinc-200 p-4 sm:p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-900 flex items-center">
                <Cloud className="h-4 w-4 text-zinc-800 mr-2" />
                Cloud & Storage Sync
              </h2>
              <span className="inline-flex items-center gap-1 text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Active
              </span>
            </div>

            <div className="space-y-3">
              {/* Firestore Item */}
              <div className="p-3 bg-zinc-50 border border-zinc-200 flex justify-between items-center">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-amber-100 text-amber-800">
                    <Zap className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-zinc-900 block uppercase tracking-wider">Firestore Live Feed</span>
                    <span className="text-[9px] text-zinc-500 font-mono">Real-time bi-directional sync</span>
                  </div>
                </div>
                <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5">
                  Synced
                </span>
              </div>

              {/* Google Drive Item */}
              <div className="p-3 bg-zinc-50 border border-zinc-200 flex justify-between items-center">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-blue-100 text-blue-800">
                    <HardDrive className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-zinc-900 block uppercase tracking-wider">Google Drive Storage</span>
                    <span className="text-[9px] text-zinc-500 font-mono">
                      {isDriveConnected() ? 'Connected • Backups enabled' : 'Ready to connect'}
                    </span>
                  </div>
                </div>
                <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 border ${
                  isDriveConnected() 
                    ? 'text-blue-700 bg-blue-50 border-blue-200' 
                    : 'text-zinc-600 bg-zinc-100 border-zinc-200'
                }`}>
                  {isDriveConnected() ? 'Connected' : 'Offline'}
                </span>
              </div>

              <div className="pt-2 flex gap-2">
                {onOpenCloudSync && (
                  <button
                    id="btn-open-cloud-sync-dash"
                    onClick={onOpenCloudSync}
                    className="w-full inline-flex items-center justify-center gap-2 py-2 px-3 bg-zinc-900 hover:bg-zinc-800 text-white text-[10px] font-bold uppercase tracking-widest transition-colors cursor-pointer"
                  >
                    <HardDrive className="h-3.5 w-3.5" /> Open Storage Center
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
