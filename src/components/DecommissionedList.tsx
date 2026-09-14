import React, { useState, useMemo } from 'react';
import { InventoryItem, UserSession, Warehouse } from '../types';
import {
  Archive,
  AlertTriangle,
  Clock,
  RotateCcw,
  FileDown,
  Trash2,
  Search,
  Filter,
  ArrowUpDown,
  Building2,
  ShieldCheck,
  Calendar,
  User,
  Info,
  Layers,
  ArrowRight,
  ExternalLink,
  CheckCircle2,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { generateDecommissionSlipPDF } from '../utils/pdfHelper';

interface DecommissionedListProps {
  items: InventoryItem[];
  onUpdateItem: (id: string, updates: Partial<InventoryItem>) => Promise<void>;
  onDeleteItem: (id: string) => Promise<void>;
  currentUser: UserSession | null;
  warehouses: Warehouse[];
  onNavigateToInventory: () => void;
  onOpenDecommissionModal?: (item: InventoryItem) => void;
}

export default function DecommissionedList({
  items,
  onUpdateItem,
  onDeleteItem,
  currentUser,
  warehouses,
  onNavigateToInventory,
  onOpenDecommissionModal
}: DecommissionedListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReasonFilter, setSelectedReasonFilter] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'name' | 'value'>('newest');
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);

  // Restore Modal State
  const [itemToRestore, setItemToRestore] = useState<InventoryItem | null>(null);
  const [restoreWarehouseId, setRestoreWarehouseId] = useState('');
  const [restoreNotes, setRestoreNotes] = useState('');
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState('');

  // Delete Confirm State
  const [itemToDelete, setItemToDelete] = useState<InventoryItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Success notification
  const [successToast, setSuccessToast] = useState('');

  // 1. Filter out all decommissioned or retired items
  const decommissionedItems = useMemo(() => {
    return items.filter(i => i.status === 'Retired' || i.status === 'Decommissioned');
  }, [items]);

  // Categories present in decommissioned items
  const categories = useMemo(() => {
    const set = new Set<string>();
    decommissionedItems.forEach(i => {
      if (i.category) set.add(i.category);
    });
    return Array.from(set).sort();
  }, [decommissionedItems]);

  // Summary Metrics
  const stats = useMemo(() => {
    let totalDamagedCount = 0;
    let totalDamagedValue = 0;
    let totalObsoleteCount = 0;
    let totalObsoleteValue = 0;
    let totalOtherCount = 0;
    let totalWrittenOffValue = 0;

    decommissionedItems.forEach(item => {
      const val = (item.price || 0) * (item.quantityTotal || 1);
      totalWrittenOffValue += val;

      const reason = item.decommissionReason || (item.status === 'Retired' ? 'Too Old / Obsolete' : 'Damaged Beyond Repair');

      if (reason.toLowerCase().includes('damag') || reason.toLowerCase().includes('fail') || reason.toLowerCase().includes('tear')) {
        totalDamagedCount++;
        totalDamagedValue += val;
      } else if (reason.toLowerCase().includes('old') || reason.toLowerCase().includes('obsolete')) {
        totalObsoleteCount++;
        totalObsoleteValue += val;
      } else {
        totalOtherCount++;
      }
    });

    return {
      totalProfiles: decommissionedItems.length,
      totalDamagedCount,
      totalDamagedValue,
      totalObsoleteCount,
      totalObsoleteValue,
      totalOtherCount,
      totalWrittenOffValue
    };
  }, [decommissionedItems]);

  // Filtered & Sorted Items
  const filteredItems = useMemo(() => {
    return decommissionedItems
      .filter(item => {
        const q = searchQuery.toLowerCase();
        const matchesSearch =
          !q ||
          item.name.toLowerCase().includes(q) ||
          item.sku.toLowerCase().includes(q) ||
          (item.serialNumber && item.serialNumber.toLowerCase().includes(q)) ||
          (item.decommissionNotes && item.decommissionNotes.toLowerCase().includes(q)) ||
          (item.decommissionedBy && item.decommissionedBy.toLowerCase().includes(q));

        if (!matchesSearch) return false;

        // Reason filter
        if (selectedReasonFilter !== 'All') {
          const r = (item.decommissionReason || (item.status === 'Retired' ? 'Too Old / Obsolete' : 'Damaged Beyond Repair')).toLowerCase();
          if (selectedReasonFilter === 'Damaged') {
            if (!r.includes('damag')) return false;
          } else if (selectedReasonFilter === 'Obsolete') {
            if (!r.includes('old') && !r.includes('obsolete')) return false;
          } else if (selectedReasonFilter === 'WearTear') {
            if (!r.includes('tear') && !r.includes('wear')) return false;
          } else if (selectedReasonFilter === 'Safety') {
            if (!r.includes('safety') && !r.includes('inspect')) return false;
          }
        }

        // Category filter
        if (selectedCategory !== 'All' && item.category !== selectedCategory) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'newest') {
          const dateA = a.decommissionedAt || a.createdAt || '';
          const dateB = b.decommissionedAt || b.createdAt || '';
          return dateB.localeCompare(dateA);
        }
        if (sortBy === 'oldest') {
          const dateA = a.decommissionedAt || a.createdAt || '';
          const dateB = b.decommissionedAt || b.createdAt || '';
          return dateA.localeCompare(dateB);
        }
        if (sortBy === 'name') {
          return a.name.localeCompare(b.name);
        }
        if (sortBy === 'value') {
          const valA = (a.price || 0) * (a.quantityTotal || 1);
          const valB = (b.price || 0) * (b.quantityTotal || 1);
          return valB - valA;
        }
        return 0;
      });
  }, [decommissionedItems, searchQuery, selectedReasonFilter, selectedCategory, sortBy]);

  const getWarehouseName = (id?: string) => {
    if (!id) return 'Unassigned Storage';
    const wh = warehouses.find(w => w.id === id);
    return wh ? wh.name : id;
  };

  // Re-commission / Restore asset
  const handleConfirmRestore = async () => {
    if (!itemToRestore) return;
    setIsRestoring(true);
    setRestoreError('');

    try {
      const restorerName = currentUser?.fullName || currentUser?.username || 'Admin';
      const updatedItem: Partial<InventoryItem> = {
        status: 'In Stock',
        quantityAvailable: itemToRestore.quantityTotal,
        warehouseId: restoreWarehouseId || itemToRestore.warehouseId || '',
        decommissionRestoredAt: new Date().toISOString(),
        decommissionRestoredBy: restorerName,
        description: itemToRestore.description
          ? `${itemToRestore.description}\n[RESTORED on ${new Date().toLocaleDateString()} by ${restorerName}: ${restoreNotes || 'Recommissioned back into service'}]`
          : `[RESTORED on ${new Date().toLocaleDateString()} by ${restorerName}: ${restoreNotes || 'Recommissioned back into service'}]`
      };

      await onUpdateItem(itemToRestore.id, updatedItem);

      setSuccessToast(`Asset "${itemToRestore.name}" successfully re-commissioned into active stock.`);
      setTimeout(() => setSuccessToast(''), 4000);
      setItemToRestore(null);
      if (selectedItem?.id === itemToRestore.id) {
        setSelectedItem(null);
      }
    } catch (err: any) {
      setRestoreError(err.message || 'Failed to restore asset.');
    } finally {
      setIsRestoring(false);
    }
  };

  // Permanently delete decommissioned record
  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);

    try {
      await onDeleteItem(itemToDelete.id);
      setSuccessToast(`Record for "${itemToDelete.name}" permanently purged.`);
      setTimeout(() => setSuccessToast(''), 4000);
      setItemToDelete(null);
      if (selectedItem?.id === itemToDelete.id) {
        setSelectedItem(null);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to purge record.');
    } finally {
      setIsDeleting(false);
    }
  };

  const getReasonBadge = (reason?: string) => {
    const r = reason || 'Damaged Beyond Repair';
    if (r.toLowerCase().includes('damag')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-red-50 text-red-700 border border-red-200">
          <AlertTriangle className="h-3 w-3" />
          Damaged Beyond Repair
        </span>
      );
    }
    if (r.toLowerCase().includes('old') || r.toLowerCase().includes('obsolete')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-300">
          <Clock className="h-3 w-3" />
          Too Old / Obsolete
        </span>
      );
    }
    if (r.toLowerCase().includes('tear') || r.toLowerCase().includes('wear')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-zinc-100 text-zinc-700 border border-zinc-300">
          <Archive className="h-3 w-3" />
          Normal Wear & Tear
        </span>
      );
    }
    if (r.toLowerCase().includes('safety') || r.toLowerCase().includes('inspect')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-orange-50 text-orange-800 border border-orange-300">
          <ShieldCheck className="h-3 w-3" />
          Safety Hazard / Failed
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-zinc-100 text-zinc-700 border border-zinc-200">
        <Archive className="h-3 w-3" />
        {r}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      <AnimatePresence>
        {successToast && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold uppercase tracking-wider flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>{successToast}</span>
            </div>
            <button onClick={() => setSuccessToast('')} className="text-emerald-500 hover:text-emerald-800 cursor-pointer">
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-amber-500/10 text-amber-900 border border-amber-300">
              <Archive className="h-4 w-4" />
            </span>
            <h1 className="text-xl font-black font-display text-zinc-900 uppercase tracking-wider">
              Decommissioned Assets Registry
            </h1>
          </div>
          <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest mt-1">
            Official Log of Retired, Damaged Beyond Repair, and Obsolete Hotel Property
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            id="btn-nav-to-active-inventory"
            onClick={onNavigateToInventory}
            className="flex-1 sm:flex-none inline-flex items-center justify-center px-4 py-2 text-xs font-bold uppercase tracking-widest text-zinc-700 bg-white border border-zinc-300 hover:bg-zinc-50 transition-colors cursor-pointer"
          >
            <Layers className="h-3.5 w-3.5 mr-2 text-zinc-400" />
            Active Rental Items
          </button>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-zinc-200 p-3.5">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">
            Decommissioned Profiles
          </span>
          <span className="text-2xl font-black text-zinc-900 font-display mt-0.5 block">
            {stats.totalProfiles}
          </span>
          <span className="text-[10px] text-zinc-500 font-mono mt-0.5 block">
            Archived from active pool
          </span>
        </div>

        <div className="bg-white border border-red-200 p-3.5 bg-red-50/20">
          <span className="text-[10px] font-bold text-red-600 uppercase tracking-widest flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 text-red-500" />
            Damaged Beyond Repair
          </span>
          <span className="text-2xl font-black text-red-700 font-display mt-0.5 block">
            {stats.totalDamagedCount}
          </span>
          <span className="text-[10px] text-red-600/80 font-mono mt-0.5 block">
            Est. loss: ₱{stats.totalDamagedValue.toLocaleString()}
          </span>
        </div>

        <div className="bg-white border border-amber-300 p-3.5 bg-amber-50/20">
          <span className="text-[10px] font-bold text-amber-700 uppercase tracking-widest flex items-center gap-1">
            <Clock className="h-3 w-3 text-amber-600" />
            Too Old / Obsolete
          </span>
          <span className="text-2xl font-black text-amber-800 font-display mt-0.5 block">
            {stats.totalObsoleteCount}
          </span>
          <span className="text-[10px] text-amber-700/80 font-mono mt-0.5 block">
            Est. loss: ₱{stats.totalObsoleteValue.toLocaleString()}
          </span>
        </div>

        <div className="bg-white border border-zinc-200 p-3.5">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">
            Total Written-Off Capital
          </span>
          <span className="text-xl font-black text-zinc-900 font-display mt-0.5 block font-mono">
            ₱{stats.totalWrittenOffValue.toLocaleString()}
          </span>
          <span className="text-[10px] text-zinc-500 font-mono mt-0.5 block">
            Salvage & Scrap valuation
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-zinc-200 p-3.5 space-y-3">
        <div className="flex flex-col md:flex-row gap-2.5">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Search decommissioned assets by name, SKU, serial number, notes, inspector..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-zinc-300 focus:outline-none focus:border-zinc-900 bg-white"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-zinc-400 hover:text-zinc-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Category Selector */}
          <div className="w-full md:w-56">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full py-2 px-3 text-xs border border-zinc-300 bg-white font-semibold focus:outline-none focus:border-zinc-900"
            >
              <option value="All">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Sort Selector */}
          <div className="w-full md:w-48">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full py-2 px-3 text-xs border border-zinc-300 bg-white font-semibold focus:outline-none focus:border-zinc-900"
            >
              <option value="newest">Decommission: Newest First</option>
              <option value="oldest">Decommission: Oldest First</option>
              <option value="name">Asset Name (A-Z)</option>
              <option value="value">Asset Value (High-Low)</option>
            </select>
          </div>
        </div>

        {/* Reason Quick Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-zinc-100">
          <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mr-1">
            Filter Reason:
          </span>
          {[
            { id: 'All', label: 'All Reasons' },
            { id: 'Damaged', label: '💥 Damaged Beyond Repair' },
            { id: 'Obsolete', label: '⏳ Too Old / Obsolete' },
            { id: 'WearTear', label: '⚙️ Normal Wear & Tear' },
            { id: 'Safety', label: '⚠️ Safety Inspection Failure' }
          ].map(pill => (
            <button
              key={pill.id}
              onClick={() => setSelectedReasonFilter(pill.id)}
              className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer border ${
                selectedReasonFilter === pill.id
                  ? 'bg-zinc-900 text-white border-zinc-900'
                  : 'bg-zinc-50 text-zinc-600 hover:bg-zinc-100 border-zinc-200'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </div>

      {/* Asset Cards Listing */}
      {filteredItems.length === 0 ? (
        <div className="bg-white border border-zinc-200 p-12 text-center">
          <div className="inline-flex p-3 bg-zinc-100 border border-zinc-200 text-zinc-400 mb-3">
            <Archive className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-black uppercase tracking-wider text-zinc-800">
            No Decommissioned Assets Found
          </h3>
          <p className="text-xs text-zinc-500 max-w-md mx-auto mt-1">
            {searchQuery || selectedReasonFilter !== 'All' || selectedCategory !== 'All'
              ? 'No retired items match the specified search query or category filters.'
              : 'All registered hotel items are currently in active service. To decommission an asset due to damage or obsolescence, select the item from the Rental Items tab and click "Decommission".'}
          </p>
          <div className="mt-4">
            <button
              onClick={onNavigateToInventory}
              className="inline-flex items-center px-4 py-2 text-xs font-bold uppercase tracking-widest text-zinc-900 bg-zinc-100 hover:bg-zinc-200 border border-zinc-300 transition-colors cursor-pointer"
            >
              Go to Active Rental Items
              <ArrowRight className="h-3.5 w-3.5 ml-2" />
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map(item => {
            const decommDate = item.decommissionedAt
              ? new Date(item.decommissionedAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                })
              : 'Historical Record';

            const reason = item.decommissionReason || (item.status === 'Retired' ? 'Too Old / Obsolete' : 'Damaged Beyond Repair');

            return (
              <div
                key={item.id}
                className="bg-white border border-zinc-200 hover:border-zinc-400 transition-all flex flex-col justify-between relative shadow-xs"
              >
                {/* Card Top Stamp */}
                <div className="p-4 space-y-2.5 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[9px] font-mono font-bold text-zinc-400 uppercase tracking-widest block">
                        {item.category} • {item.sku}
                      </span>
                      <h3 className="text-sm font-black uppercase text-zinc-900 mt-0.5 leading-tight">
                        {item.name}
                      </h3>
                    </div>
                    <div>
                      {getReasonBadge(reason)}
                    </div>
                  </div>

                  {/* Quantity & Warehouse info */}
                  <div className="grid grid-cols-2 gap-2 text-[10px] bg-zinc-50 p-2 border border-zinc-100">
                    <div>
                      <span className="text-zinc-400 uppercase block font-semibold">Retired Units:</span>
                      <span className="font-bold text-zinc-800 font-mono">{item.quantityTotal} unit(s)</span>
                    </div>
                    <div>
                      <span className="text-zinc-400 uppercase block font-semibold">Location / Depot:</span>
                      <span className="font-bold text-zinc-800 truncate block">
                        {item.decommissionDisposalMethod || getWarehouseName(item.warehouseId)}
                      </span>
                    </div>
                  </div>

                  {/* Damage / Obsolescence remarks */}
                  <div className="text-[11px] text-zinc-600 bg-zinc-50/50 p-2 border border-zinc-100 italic line-clamp-3">
                    "{item.decommissionNotes || 'Asset retired from active circulation due to equipment damage or obsolescence.'}"
                  </div>

                  {/* Inspector and Date metadata */}
                  <div className="pt-2 border-t border-zinc-100 flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                    <span className="flex items-center gap-1 truncate">
                      <User className="h-3 w-3 text-zinc-400 shrink-0" />
                      {item.decommissionedBy || 'Authorized Staff'}
                    </span>
                    <span className="flex items-center gap-1 shrink-0">
                      <Calendar className="h-3 w-3 text-zinc-400 shrink-0" />
                      {decommDate}
                    </span>
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="px-4 py-2.5 bg-zinc-50 border-t border-zinc-200 flex items-center justify-between gap-2">
                  <button
                    id={`btn-print-slip-${item.sku}`}
                    onClick={() => generateDecommissionSlipPDF({
                      ...item,
                      warehouseName: getWarehouseName(item.warehouseId)
                    })}
                    className="py-1.5 px-2.5 text-[10px] font-bold uppercase tracking-widest text-zinc-700 hover:text-zinc-900 bg-white hover:bg-zinc-100 border border-zinc-300 transition-colors flex items-center gap-1 cursor-pointer"
                    title="Generate and download official decommission slip"
                  >
                    <FileDown className="h-3.5 w-3.5 text-zinc-500" />
                    Slip
                  </button>

                  <div className="flex items-center gap-1.5">
                    {/* Re-commission Button */}
                    <button
                      id={`btn-restore-${item.sku}`}
                      onClick={() => {
                        setItemToRestore(item);
                        setRestoreWarehouseId(item.warehouseId || (warehouses[0]?.id || ''));
                        setRestoreNotes('');
                        setRestoreError('');
                      }}
                      className="py-1.5 px-3 text-[10px] font-bold uppercase tracking-widest text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 transition-colors flex items-center gap-1 cursor-pointer"
                      title="Recommission item back to active stock"
                    >
                      <RotateCcw className="h-3.5 w-3.5 text-emerald-600" />
                      Re-commission
                    </button>

                    {/* Purge Record (Admin Only) */}
                    {currentUser?.role === 'Admin' && (
                      <button
                        id={`btn-delete-record-${item.sku}`}
                        onClick={() => setItemToDelete(item)}
                        className="p-1.5 text-zinc-400 hover:text-red-700 hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors cursor-pointer"
                        title="Purge record permanently"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Re-commission Modal */}
      <AnimatePresence>
        {itemToRestore && (
          <div className="fixed inset-0 z-50 bg-zinc-950/40 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-zinc-300 w-full max-w-lg shadow-2xl p-5 space-y-4"
            >
              <div className="flex justify-between items-center border-b border-zinc-200 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-emerald-50 text-emerald-700 border border-emerald-300">
                    <RotateCcw className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-zinc-900">
                      Re-commission Asset to Active Service
                    </h3>
                    <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
                      Restore "{itemToRestore.name}"
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setItemToRestore(null)}
                  className="text-zinc-400 hover:text-zinc-700 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {restoreError && (
                <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs font-bold uppercase">
                  {restoreError}
                </div>
              )}

              <div className="bg-zinc-50 p-3 border border-zinc-200 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-zinc-500 font-semibold uppercase">Total Units to Re-activate:</span>
                  <span className="font-bold text-zinc-900 font-mono">{itemToRestore.quantityTotal} units</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500 font-semibold uppercase">Restored Status:</span>
                  <span className="font-bold text-emerald-700 uppercase">In Stock (Available)</span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">
                  Assign Warehouse Location
                </label>
                <select
                  value={restoreWarehouseId}
                  onChange={(e) => setRestoreWarehouseId(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 text-xs font-semibold focus:outline-none focus:border-zinc-900 bg-white"
                >
                  <option value="">Unassigned Floor Storage</option>
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">
                  Re-commissioning Justification / Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Repaired by certified technician, new spare parts fitted, tested operational..."
                  value={restoreNotes}
                  onChange={(e) => setRestoreNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 text-xs focus:outline-none focus:border-zinc-900 bg-white resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-200">
                <button
                  type="button"
                  disabled={isRestoring}
                  onClick={() => setItemToRestore(null)}
                  className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-zinc-600 bg-white border border-zinc-300 hover:bg-zinc-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isRestoring}
                  onClick={handleConfirmRestore}
                  className="px-5 py-2 text-xs font-bold uppercase tracking-widest text-white bg-emerald-700 hover:bg-emerald-800 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  {isRestoring ? 'Restoring...' : 'Confirm Re-commission'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Purge Delete Confirm Modal */}
      <AnimatePresence>
        {itemToDelete && (
          <div className="fixed inset-0 z-50 bg-zinc-950/40 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-red-300 w-full max-w-md shadow-2xl p-5 space-y-4"
            >
              <div className="flex items-center gap-2 text-red-700">
                <AlertTriangle className="h-5 w-5" />
                <h3 className="text-xs font-black uppercase tracking-wider">
                  Permanently Purge Record?
                </h3>
              </div>
              <p className="text-xs text-zinc-600 leading-relaxed">
                Are you sure you want to permanently delete the decommissioned record for{' '}
                <strong className="text-zinc-900">{itemToDelete.name}</strong> ({itemToDelete.sku})? 
                This action is irreversible.
              </p>
              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-200">
                <button
                  disabled={isDeleting}
                  onClick={() => setItemToDelete(null)}
                  className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-zinc-600 bg-white border border-zinc-300 hover:bg-zinc-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  disabled={isDeleting}
                  onClick={handleConfirmDelete}
                  className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-white bg-red-600 hover:bg-red-700 transition-colors cursor-pointer"
                >
                  {isDeleting ? 'Purging...' : 'Yes, Purge Record'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
