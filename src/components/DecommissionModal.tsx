import React, { useState, useEffect } from 'react';
import { InventoryItem, UserSession, Warehouse } from '../types';
import { X, AlertTriangle, Clock, Archive, ShieldAlert, FileText, CheckCircle2, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface DecommissionPayload {
  itemId: string;
  isPartial: boolean;
  decommissionQty: number;
  reason: string;
  severity: string;
  disposalMethod: string;
  notes: string;
  decommissionedBy: string;
  decommissionedAt: string;
}

interface DecommissionModalProps {
  item: InventoryItem | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (payload: DecommissionPayload) => Promise<void>;
  currentUser: UserSession | null;
  warehouses?: Warehouse[];
}

const COMMON_REASONS = [
  { 
    id: 'Damaged Beyond Repair', 
    label: 'Damaged Beyond Repair', 
    icon: AlertTriangle, 
    desc: 'Physical destruction, broken frame, burnt electronics, or water damage uneconomical to fix.' 
  },
  { 
    id: 'Too Old / Obsolete', 
    label: 'Too Old / Obsolete', 
    icon: Clock, 
    desc: 'Exceeded useful lifespan, legacy equipment, phased out, or discontinued standards.' 
  },
  { 
    id: 'Normal Wear & Tear', 
    label: 'Normal Wear & Tear', 
    icon: Archive, 
    desc: 'Extensive cosmetic or functional degradation below Madigun hospitality rental standards.' 
  },
  { 
    id: 'Failed Safety Inspection', 
    label: 'Failed Safety Inspection', 
    icon: ShieldAlert, 
    desc: 'Failed electrical isolation, structural load test, or safety hazard.' 
  },
  { 
    id: 'Lost / Missing', 
    label: 'Lost / Missing', 
    icon: FileText, 
    desc: 'Unrecoverable after events or missing from warehouse verification.' 
  },
  { 
    id: 'Other', 
    label: 'Other Specific Reason', 
    icon: FileText, 
    desc: 'Custom incident or administrative write-off.' 
  }
];

export default function DecommissionModal({
  item,
  isOpen,
  onClose,
  onConfirm,
  currentUser,
  warehouses = []
}: DecommissionModalProps) {
  const [selectedReason, setSelectedReason] = useState('Damaged Beyond Repair');
  const [customReason, setCustomReason] = useState('');
  const [severity, setSeverity] = useState('Total Loss / Scrap');
  const [disposalMethod, setDisposalMethod] = useState('Salvage Depot / Storage');
  const [notes, setNotes] = useState('');
  const [decommissionedBy, setDecommissionedBy] = useState('');
  const [decommissionDate, setDecommissionDate] = useState('');
  const [isPartial, setIsPartial] = useState(false);
  const [partialQty, setPartialQty] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen && item) {
      setSelectedReason('Damaged Beyond Repair');
      setCustomReason('');
      setSeverity('Total Loss / Scrap');
      setDisposalMethod('Salvage Depot / Storage');
      setNotes('');
      setErrorMsg('');
      setIsPartial(false);
      setPartialQty(1);

      // Default inspector
      const defaultUser = currentUser?.fullName || currentUser?.username || 'Property Custodian';
      setDecommissionedBy(defaultUser);

      // Manila today
      const today = new Date().toISOString().split('T')[0];
      setDecommissionDate(today);
    }
  }, [isOpen, item, currentUser]);

  if (!isOpen || !item) return null;

  const getWarehouseName = (id?: string) => {
    if (!id) return 'Unassigned / Floor Stock';
    const wh = warehouses.find(w => w.id === id);
    return wh ? wh.name : id;
  };

  const rentedCount = item.quantityTotal - item.quantityAvailable;
  const isCurrentlyRented = rentedCount > 0;
  const maxAvailableToDecommission = item.quantityAvailable;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const effectiveReason = selectedReason === 'Other' ? (customReason.trim() || 'Other Administrative Write-off') : selectedReason;
    
    if (!notes.trim()) {
      setErrorMsg('Please enter detailed inspection remarks / reason description.');
      return;
    }

    if (isPartial) {
      if (partialQty < 1 || partialQty >= item.quantityTotal) {
        setErrorMsg(`Partial quantity must be between 1 and ${item.quantityTotal - 1} units. (To decommission all units, select "Entire Asset").`);
        return;
      }
      if (partialQty > item.quantityAvailable) {
        setErrorMsg(`Cannot decommission ${partialQty} units right now because ${rentedCount} units are currently rented out. Maximum available on floor is ${item.quantityAvailable}.`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await onConfirm({
        itemId: item.id,
        isPartial,
        decommissionQty: isPartial ? partialQty : item.quantityTotal,
        reason: effectiveReason,
        severity,
        disposalMethod,
        notes: notes.trim(),
        decommissionedBy: decommissionedBy.trim() || 'Property Custodian',
        decommissionedAt: new Date().toISOString()
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to decommission item');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 bg-zinc-950/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          className="bg-white border border-zinc-300 w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl relative my-auto"
        >
          {/* Header */}
          <div className="flex justify-between items-center px-5 py-4 border-b border-zinc-200 bg-zinc-50">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-amber-500/10 border border-amber-300 text-amber-900 rounded-none">
                <Archive className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-black uppercase tracking-wider text-zinc-900">
                  Decommission Asset Profile
                </h2>
                <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mt-0.5">
                  Retire Damaged or Obsolete Item from Active Circulation
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="p-1.5 text-zinc-400 hover:text-zinc-900 transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-5">
            {errorMsg && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-bold uppercase tracking-wide">
                {errorMsg}
              </div>
            )}

            {/* Target Asset Summary Banner */}
            <div className="bg-zinc-100 p-3.5 border border-zinc-200">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                <div>
                  <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest font-mono block">
                    {item.category} • SKU: {item.sku}
                  </span>
                  <h3 className="text-sm font-black uppercase text-zinc-900 mt-0.5">
                    {item.name}
                  </h3>
                </div>
                <div className="text-left sm:text-right">
                  <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest block">
                    Current Stock Status
                  </span>
                  <span className="text-xs font-mono font-bold text-zinc-900">
                    {item.quantityAvailable} available of {item.quantityTotal} units
                  </span>
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-zinc-200 flex items-center justify-between text-[10px] text-zinc-600 uppercase font-semibold">
                <span>Location: {getWarehouseName(item.warehouseId)}</span>
                <span>Unit Value: {item.price ? `₱${Number(item.price).toLocaleString()}` : '₱0'}</span>
              </div>
            </div>

            {/* Active Rental Warning if units are checked out */}
            {isCurrentlyRented && (
              <div className="p-3.5 bg-amber-50 border border-amber-300 flex items-start gap-2.5">
                <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900">
                  <span className="font-bold uppercase tracking-wide block">Active Transmittal Notice</span>
                  <p className="mt-0.5 text-[11px] leading-relaxed">
                    {rentedCount} unit(s) of this asset are currently out on active transmittals. 
                    If you decommission the entire asset, returning those transmittals will record them directly to decommissioned records. 
                    Alternatively, choose partial decommissioning for floor stock only.
                  </p>
                </div>
              </div>
            )}

            {/* Scope / Quantity to Decommission */}
            {item.quantityTotal > 1 && (
              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                  Decommission Scope & Quantity
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <label className={`p-3 border flex items-center gap-3 cursor-pointer transition-colors ${
                    !isPartial ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-zinc-50 hover:bg-zinc-100 border-zinc-200 text-zinc-800'
                  }`}>
                    <input
                      type="radio"
                      name="decommissionScope"
                      checked={!isPartial}
                      onChange={() => setIsPartial(false)}
                      className="h-4 w-4 rounded-none text-zinc-900"
                    />
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider block">Entire Asset Profile</span>
                      <span className={`text-[10px] block mt-0.5 ${!isPartial ? 'text-zinc-300' : 'text-zinc-500'}`}>
                        All {item.quantityTotal} units retired permanently
                      </span>
                    </div>
                  </label>

                  <label className={`p-3 border flex items-center gap-3 cursor-pointer transition-colors ${
                    isPartial ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-zinc-50 hover:bg-zinc-100 border-zinc-200 text-zinc-800'
                  }`}>
                    <input
                      type="radio"
                      name="decommissionScope"
                      checked={isPartial}
                      onChange={() => setIsPartial(true)}
                      className="h-4 w-4 rounded-none text-zinc-900"
                    />
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider block">Partial Quantity (Split)</span>
                      <span className={`text-[10px] block mt-0.5 ${isPartial ? 'text-zinc-300' : 'text-zinc-500'}`}>
                        Decommission damaged units only
                      </span>
                    </div>
                  </label>
                </div>

                {isPartial && (
                  <div className="p-3 bg-zinc-50 border border-zinc-200 mt-2 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-zinc-700 uppercase tracking-wider block">
                        Units to Decommission:
                      </span>
                      <span className="text-[9px] text-zinc-400 block">
                        Max available: {maxAvailableToDecommission} units
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        max={item.quantityTotal - 1}
                        value={partialQty}
                        onChange={(e) => setPartialQty(Math.max(1, Math.min(item.quantityTotal - 1, Number(e.target.value))))}
                        className="w-20 px-2 py-1.5 border border-zinc-300 text-center font-mono font-bold text-sm bg-white focus:outline-none focus:border-zinc-900"
                      />
                      <span className="text-xs font-bold uppercase text-zinc-500">Units</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Primary Decommission Reason */}
            <div className="space-y-2">
              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                Primary Reason for Decommissioning <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {COMMON_REASONS.map((reason) => {
                  const Icon = reason.icon;
                  const isSelected = selectedReason === reason.id;
                  return (
                    <div
                      key={reason.id}
                      onClick={() => setSelectedReason(reason.id)}
                      className={`p-3 border cursor-pointer transition-all flex flex-col justify-between ${
                        isSelected
                          ? 'border-amber-500 bg-amber-50/50 ring-1 ring-amber-500'
                          : 'border-zinc-200 bg-white hover:border-zinc-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className={`h-4 w-4 ${isSelected ? 'text-amber-700' : 'text-zinc-400'}`} />
                        <span className={`text-xs font-bold uppercase tracking-wider ${isSelected ? 'text-zinc-900' : 'text-zinc-700'}`}>
                          {reason.label}
                        </span>
                      </div>
                      <p className="text-[10px] text-zinc-500 mt-1.5 leading-tight">
                        {reason.desc}
                      </p>
                    </div>
                  );
                })}
              </div>

              {selectedReason === 'Other' && (
                <div className="mt-2">
                  <input
                    type="text"
                    placeholder="Specify other decommission reason..."
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-300 text-xs font-semibold focus:outline-none focus:border-zinc-900 bg-white"
                  />
                </div>
              )}
            </div>

            {/* Severity & Disposal Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">
                  Damage / Obsolescence Severity
                </label>
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 text-xs font-semibold focus:outline-none focus:border-zinc-900 bg-white"
                >
                  <option value="Total Loss / Scrap">Total Loss / Scrap (Irreparable)</option>
                  <option value="Damaged / Uneconomical">Damaged / Uneconomical to Repair</option>
                  <option value="Aging / Obsolete">Aging / Obsolete Standard</option>
                  <option value="Salvageable for Parts">Salvageable for Spare Parts</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">
                  Storage / Disposal Plan
                </label>
                <select
                  value={disposalMethod}
                  onChange={(e) => setDisposalMethod(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 text-xs font-semibold focus:outline-none focus:border-zinc-900 bg-white"
                >
                  <option value="Salvage Depot / Storage">Salvage Depot / Storage</option>
                  <option value="Pending Disposal">Pending Disposal / Scrapping</option>
                  <option value="Scrapped / Recycled">Scrapped / Metal Recycling</option>
                  <option value="E-Waste Recycling">E-Waste Certified Recycling</option>
                  <option value="Donated / Sold as Scrap">Sold for Scrap / Donated</option>
                </select>
              </div>
            </div>

            {/* Detailed Notes / Remarks */}
            <div>
              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">
                Detailed Inspection Remarks & Damage Log <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={3}
                required
                placeholder="Explain specific physical damages (e.g. cracked casing, blown amplifier driver, liquid spill during banquet, or outdated specs exceeded 5-year useful life)..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 text-xs focus:outline-none focus:border-zinc-900 bg-white resize-none"
              />
            </div>

            {/* Sign-off Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-zinc-200">
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">
                  Inspecting Officer / Staff
                </label>
                <input
                  type="text"
                  value={decommissionedBy}
                  onChange={(e) => setDecommissionedBy(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 text-xs font-semibold bg-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">
                  Effective Decommission Date
                </label>
                <input
                  type="date"
                  value={decommissionDate}
                  onChange={(e) => setDecommissionDate(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 text-xs font-mono font-semibold bg-white"
                />
              </div>
            </div>
          </form>

          {/* Footer */}
          <div className="px-5 py-3.5 border-t border-zinc-200 bg-zinc-50 flex justify-end items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-zinc-600 bg-white hover:bg-zinc-100 border border-zinc-300 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-bold uppercase tracking-widest text-white bg-amber-600 hover:bg-amber-700 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Archive className="h-3.5 w-3.5" />
              {isSubmitting ? 'Decommissioning...' : 'Confirm Decommission'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
