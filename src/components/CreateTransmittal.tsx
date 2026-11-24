import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Trash2, Calendar, User, MapPin, ClipboardList, Send, X, AlertCircle, Gift, Tag, Check } from 'lucide-react';
import { InventoryItem, TransmittalItem } from '../types';
import { localStore } from '../localStore';

interface CreateTransmittalProps {
  inventory: InventoryItem[];
  onSubmit: (transmittalData: {
    handler: string;
    rentee: string;
    address: string;
    dateCheckout: string;
    dateCheckin: string;
    items: TransmittalItem[];
    notes: string;
  }) => Promise<void>;
  onCancel: () => void;
}

export default function CreateTransmittal({ inventory, onSubmit, onCancel }: CreateTransmittalProps) {
  // Form Details
  const [handler, setHandler] = useState('');
  const [rentee, setRentee] = useState('');
  const [address, setAddress] = useState('');
  const [dateCheckout, setDateCheckout] = useState(new Date().toISOString().split('T')[0]);
  const [dateCheckin, setDateCheckin] = useState('');
  const [notes, setNotes] = useState('');

  // Selected items in this transmittal with unique lineId and complimentary allocation flag
  const [selectedItems, setSelectedItems] = useState<{
    lineId: string;
    itemId: string;
    quantity: number;
    isComplimentary: boolean;
  }[]>([]);

  // Search/add helper state
  const [searchItemQuery, setSearchItemQuery] = useState('');
  const [showItemDropdown, setShowItemDropdown] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createLineId = () => `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const getAllocatedQtyForItem = (itemId: string, excludeLineId?: string) =>
    selectedItems
      .filter(si => si.itemId === itemId && si.lineId !== excludeLineId)
      .reduce((sum, si) => sum + si.quantity, 0);

  // Available items in inventory that have quantityAvailable > 0 (or isNoQuantity/Corkage) and are not retired
  // Same item can be added multiple times (e.g. once as Rented and once as Complimentary) as long as stock remains
  const eligibleItems = inventory.filter(item => {
    const isNoQty = item.isNoQuantity || item.category === 'Corkage & Service Permits';
    const isAvailable = isNoQty || item.quantityAvailable > 0;
    const isNotStagnant = item.status !== 'Retired' && item.status !== 'Decommissioned';
    const matchesQuery = item.name.toLowerCase().includes(searchItemQuery.toLowerCase()) || 
                         item.sku.toLowerCase().includes(searchItemQuery.toLowerCase()) ||
                         item.category.toLowerCase().includes(searchItemQuery.toLowerCase());
    return isAvailable && isNotStagnant && matchesQuery;
  });

  // Handle adding an item to the transmittal list
  const handleAddItem = (item: InventoryItem, isComplimentary = false) => {
    const isNoQty = item.isNoQuantity || item.category === 'Corkage & Service Permits';
    const allocatedQty = getAllocatedQtyForItem(item.id);
    const remainingAvail = isNoQty ? 9999 : Math.max(0, item.quantityAvailable - allocatedQty);

    if (!isNoQty && remainingAvail <= 0) {
      setErrorMsg(`All ${item.quantityAvailable} available units of "${item.name}" are already allocated in the manifest. Reduce an existing line quantity to split.`);
      setShowItemDropdown(false);
      return;
    }

    setSelectedItems([
      ...selectedItems,
      {
        lineId: createLineId(),
        itemId: item.id,
        quantity: 1,
        isComplimentary
      }
    ]);
    setSearchItemQuery('');
    setShowItemDropdown(false);
    setErrorMsg('');
  };

  // Toggle complimentary status for a specific manifest line
  const handleToggleComplimentary = (lineId: string, isComplimentary: boolean) => {
    setSelectedItems(selectedItems.map(si => 
      si.lineId === lineId ? { ...si, isComplimentary } : si
    ));
  };

  // Batch toggle all items
  const handleSetAllComplimentary = (complimentary: boolean) => {
    setSelectedItems(selectedItems.map(si => ({ ...si, isComplimentary: complimentary })));
  };

  // Handle removing a specific manifest line
  const handleRemoveItem = (lineId: string) => {
    setSelectedItems(selectedItems.filter(si => si.lineId !== lineId));
  };

  // Handle quantity changes with pooled stock validation across all lines sharing the same itemId
  const handleQuantityChange = (lineId: string, val: number) => {
    const targetLine = selectedItems.find(si => si.lineId === lineId);
    if (!targetLine) return;

    const item = inventory.find(i => i.id === targetLine.itemId);
    if (!item) return;

    const isNoQty = item.isNoQuantity || item.category === 'Corkage & Service Permits';
    const otherLinesQty = getAllocatedQtyForItem(item.id, lineId);
    const maxVal = isNoQty ? 9999 : Math.max(0, item.quantityAvailable - otherLinesQty);

    // Constrain quantity between 0 and remaining available stock (allowing 0 so they can clear/type)
    const validQty = Math.max(0, Math.min(maxVal, isNaN(val) ? 0 : val));
    
    setSelectedItems(selectedItems.map(si => 
      si.lineId === lineId ? { ...si, quantity: validQty } : si
    ));
  };

  // Submit Form Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    // Field Validations
    if (!handler.trim()) return setErrorMsg('Handler name is required');
    if (!rentee.trim()) return setErrorMsg('Rentee name is required');
    if (!address.trim()) return setErrorMsg('Destination Address is required');
    if (!dateCheckout) return setErrorMsg('Date Checkout is required');
    if (!dateCheckin) return setErrorMsg('Target Date Check-in is required');
    if (dateCheckin < dateCheckout) return setErrorMsg('Check-in (Return) date cannot be earlier than Checkout date');
    if (selectedItems.length === 0) return setErrorMsg('Please add at least 1 item to the acknowledgement receipt');

    // Check for any items with quantity of 0
    const zeroItem = selectedItems.find(si => si.quantity <= 0);
    if (zeroItem) {
      const item = inventory.find(i => i.id === zeroItem.itemId);
      return setErrorMsg(`Please enter a quantity of 1 or more for "${item?.name || 'item'}"`);
    }

    // Validate combined quantities per itemId across all manifest lines (e.g. Rented + Complimentary)
    const totalByItemId: Record<string, number> = {};
    for (const si of selectedItems) {
      totalByItemId[si.itemId] = (totalByItemId[si.itemId] || 0) + si.quantity;
    }
    for (const [itemId, totalQty] of Object.entries(totalByItemId)) {
      const itm = inventory.find(i => i.id === itemId);
      if (!itm) continue;
      const isNoQty = itm.isNoQuantity || itm.category === 'Corkage & Service Permits';
      if (!isNoQty && totalQty > itm.quantityAvailable) {
        return setErrorMsg(`Combined quantity (${totalQty}) for "${itm.name}" exceeds available stock (${itm.quantityAvailable}).`);
      }
    }

    // Check if any selected item is an event venue and is already booked on the selected date range
    const allTransmittals = localStore.getCollection<any>('transmittals');
    const reqStart = dateCheckout ? dateCheckout.split(' ')[0].split('T')[0] : '';
    const reqEnd = dateCheckin ? dateCheckin.split(' ')[0].split('T')[0] : reqStart;

    for (const si of selectedItems) {
      const itm = inventory.find(i => i.id === si.itemId);
      if (itm && (itm.category === 'Rental Halls & Event Venues' || itm.isHourlyCharged)) {
        const ongoingConflict = allTransmittals.find(t => {
          if (t.status === 'Returned') return false;
          const matches = t.items.some((ti: any) => ti.itemId === itm.id || ti.sku === itm.sku);
          if (!matches) return false;
          const txStart = t.dateCheckout ? t.dateCheckout.split(' ')[0].split('T')[0] : '';
          const txEnd = t.dateCheckin ? t.dateCheckin.split(' ')[0].split('T')[0] : txStart;
          if (!txStart || !reqStart) return true;
          // Date interval overlap condition: [reqStart, reqEnd] overlaps with [txStart, txEnd]
          return reqStart <= txEnd && reqEnd >= txStart;
        });

        if (ongoingConflict) {
          return setErrorMsg(`Venue "${itm.name}" already has an ongoing booking (${ongoingConflict.transmittalNo} for ${ongoingConflict.rentee}) during ${dateCheckout} to ${dateCheckin}. Please select another date or venue.`);
        }
      }
    }

    // Build transmittal items array with unique lineId and complimentary flag
    const transmittalItems: TransmittalItem[] = selectedItems.map(si => {
      const item = inventory.find(i => i.id === si.itemId)!;
      const isComp = !!si.isComplimentary;
      return {
        lineId: si.lineId,
        itemId: si.itemId,
        name: item.name,
        sku: item.sku,
        quantity: si.quantity,
        returnedQuantity: 0, // initially 0 returned
        isComplimentary: isComp,
        allocationType: isComp ? 'Complimentary' : 'Rented'
      };
    });

    try {
      setIsSubmitting(true);
      await onSubmit({
        handler,
        rentee,
        address,
        dateCheckout,
        dateCheckin,
        items: transmittalItems,
        notes
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create acknowledgement receipt');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-zinc-200 pb-6">
        <div>
          <h1 className="text-xl font-black font-display text-zinc-900 uppercase tracking-wider">Create Acknowledgement Receipt</h1>
        </div>
        <button
          id="btn-cancel-tx-top"
          onClick={onCancel}
          className="text-zinc-600 hover:text-zinc-900 font-bold text-[10px] uppercase tracking-widest px-4 py-2 border border-zinc-200 hover:border-zinc-400 bg-white transition-all cursor-pointer"
        >
          Cancel
        </button>
      </div>

      {errorMsg && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 border border-red-200 text-red-750 p-4 flex items-start gap-2.5 text-xs font-bold uppercase tracking-wider"
        >
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
          <span>{errorMsg}</span>
        </motion.div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        
        {/* Left column: Recipient and checkout details */}
        <div className="lg:col-span-1 space-y-5 bg-white p-4 sm:p-6 border border-zinc-200">
          <h3 className="text-xs font-black text-zinc-900 uppercase tracking-widest pb-3 border-b border-zinc-200">
            Acknowledgement Receipt Logistics
          </h3>

          {/* Handler (Issuer) */}
          <div className="space-y-1.5">
            <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest flex items-center">
              <User className="h-3.5 w-3.5 mr-1.5 text-zinc-400" />
              Handler (Requester)
            </label>
            <input
              id="tx-handler"
              type="text"
              required
              placeholder="YOUR NAME / EMPLOYEE ID"
              value={handler}
              onChange={(e) => setHandler(e.target.value)}
              className="w-full px-3 py-2.5 border border-zinc-200 text-xs font-semibold uppercase tracking-wider bg-zinc-50 focus:bg-white focus:outline-none focus:border-zinc-900 transition-all text-zinc-800 placeholder-zinc-300"
            />
          </div>

          {/* Rentee (Recipient) */}
          <div className="space-y-1.5">
            <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest flex items-center">
              <User className="h-3.5 w-3.5 mr-1.5 text-zinc-400" />
              Rentee (Recipient)
            </label>
            <input
              id="tx-rentee"
              type="text"
              required
              placeholder="CLIENT / DEPARTMENT NAME"
              value={rentee}
              onChange={(e) => setRentee(e.target.value)}
              className="w-full px-3 py-2.5 border border-zinc-200 text-xs font-semibold uppercase tracking-wider bg-zinc-50 focus:bg-white focus:outline-none focus:border-zinc-900 transition-all text-zinc-800 placeholder-zinc-300"
            />
          </div>

          {/* Destination Address */}
          <div className="space-y-1.5">
            <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest flex items-center">
              <MapPin className="h-3.5 w-3.5 mr-1.5 text-zinc-400" />
              Destination Grid / Location
            </label>
            <input
              id="tx-address"
              type="text"
              required
              placeholder="EVENT VENUE / JOBSITE"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3 py-2.5 border border-zinc-200 text-xs font-semibold uppercase tracking-wider bg-zinc-50 focus:bg-white focus:outline-none focus:border-zinc-900 transition-all text-zinc-800 placeholder-zinc-300"
            />
          </div>

          {/* Date Checkout */}
          <div className="space-y-1.5">
            <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest flex items-center">
              <Calendar className="h-3.5 w-3.5 mr-1.5 text-zinc-400" />
              Date Checkout
            </label>
            <input
              id="tx-checkout-date"
              type="date"
              required
              value={dateCheckout}
              onChange={(e) => setDateCheckout(e.target.value)}
              className="w-full px-3 py-2.5 border border-zinc-200 text-xs font-semibold uppercase tracking-wider bg-zinc-50 focus:bg-white focus:outline-none focus:border-zinc-900 transition-all text-zinc-800"
            />
          </div>

          {/* Date Checkin */}
          <div className="space-y-1.5">
            <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest flex items-center">
              <Calendar className="h-3.5 w-3.5 mr-1.5 text-zinc-400" />
              Date Check-In (Due Back)
            </label>
            <input
              id="tx-checkin-date"
              type="date"
              required
              value={dateCheckin}
              onChange={(e) => setDateCheckin(e.target.value)}
              className="w-full px-3 py-2.5 border border-zinc-200 text-xs font-semibold uppercase tracking-wider bg-zinc-50 focus:bg-white focus:outline-none focus:border-zinc-900 transition-all text-zinc-800"
            />
          </div>

          {/* Additional Notes */}
          <div className="space-y-1.5">
            <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest">
              Logistics protocol Notes
            </label>
            <textarea
              id="tx-notes"
              rows={3}
              placeholder="E.G. CHASSIS CODE, COMPARTMENT SECURED..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2.5 border border-zinc-200 text-xs font-semibold uppercase tracking-wider bg-zinc-50 focus:bg-white focus:outline-none focus:border-zinc-900 transition-all text-zinc-800 placeholder-zinc-300"
            />
          </div>
        </div>

        {/* Right column: Multi-Item selection and quantities */}
        <div className="lg:col-span-2 space-y-6 flex flex-col h-full">
          
          {/* Item Selector box */}
          <div className="bg-white p-4 sm:p-6 border border-zinc-200 space-y-4">
            <h3 className="text-xs font-black text-zinc-900 uppercase tracking-widest pb-3 border-b border-zinc-200">
              Select Assets to Issue
            </h3>
            
            {/* Search/Selection bar */}
            <div className="relative">
              <label className="block text-[9px] font-bold text-zinc-450 uppercase tracking-wider mb-1.5">Search Available Stock</label>
              <input
                id="search-eligible-assets"
                type="text"
                placeholder="TYPE STOCK NAME OR SKU CODE..."
                value={searchItemQuery}
                onFocus={() => setShowItemDropdown(true)}
                onChange={(e) => {
                  setSearchItemQuery(e.target.value);
                  setShowItemDropdown(true);
                }}
                className="w-full px-3 py-2.5 border border-zinc-200 text-xs font-semibold uppercase tracking-wider bg-zinc-50 focus:bg-white focus:outline-none focus:border-zinc-900 transition-all text-zinc-850 placeholder-zinc-300"
              />

              {/* Suggestions Dropdown */}
              <AnimatePresence>
                {showItemDropdown && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowItemDropdown(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 5 }}
                      className="absolute z-20 left-0 right-0 mt-1 bg-white border border-zinc-200 rounded-none shadow-none max-h-[220px] overflow-y-auto divide-y divide-zinc-100"
                    >
                      {eligibleItems.length === 0 ? (
                        <div className="p-4 text-[10px] font-bold text-zinc-400 text-center uppercase tracking-wider">
                          {searchItemQuery ? 'No matching available stock found' : 'Click here and start typing to search stock'}
                        </div>
                      ) : (
                        eligibleItems.map(item => {
                          const isNoQty = item.isNoQuantity || item.category === 'Corkage & Service Permits';
                          const allocatedQty = getAllocatedQtyForItem(item.id);
                          const remainingAvail = isNoQty ? 9999 : Math.max(0, item.quantityAvailable - allocatedQty);
                          const isExhausted = !isNoQty && remainingAvail <= 0;

                          return (
                            <div
                              key={item.id}
                              className="p-3 hover:bg-zinc-50 flex flex-wrap justify-between items-center text-xs gap-2 transition-colors border-b border-zinc-100 last:border-0"
                            >
                              <div
                                className={`flex-1 min-w-[200px] ${isExhausted ? 'opacity-60' : 'cursor-pointer'}`}
                                onClick={() => !isExhausted && handleAddItem(item, false)}
                              >
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="font-bold text-zinc-900 uppercase tracking-tight">{item.name}</span>
                                  {allocatedQty > 0 && (
                                    <span className="text-[9px] font-bold bg-blue-50 text-blue-800 border border-blue-200 px-1.5 py-0.5 uppercase tracking-wider">
                                      {allocatedQty} in manifest
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-zinc-500 font-mono mt-0.5 uppercase tracking-wide">
                                  {item.sku} • {item.category} • Rate: ₱{Number(item.rentalPrice || 0).toLocaleString()}
                                  {!isNoQty && (
                                    <span className="ml-2 font-bold text-zinc-800">
                                      ({remainingAvail} of {item.quantityAvailable} left)
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {isNoQty ? (
                                  <span className="text-[9px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 uppercase tracking-wider">
                                    Service Fee
                                  </span>
                                ) : (
                                  <span className={`text-[9px] font-bold px-2 py-0.5 uppercase tracking-wider border ${
                                    isExhausted
                                      ? 'bg-red-50 text-red-700 border-red-200'
                                      : 'bg-zinc-100 text-zinc-700 border-zinc-200'
                                  }`}>
                                    {remainingAvail} left
                                  </span>
                                )}
                                <button
                                  type="button"
                                  disabled={isExhausted}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAddItem(item, false);
                                  }}
                                  className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-[9px] uppercase tracking-wider cursor-pointer"
                                  title={isExhausted ? 'All available units already allocated in manifest' : 'Add as standard rented asset line'}
                                >
                                  + Rented
                                </button>
                                <button
                                  type="button"
                                  disabled={isExhausted}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAddItem(item, true);
                                  }}
                                  className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-[9px] uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                                  title={isExhausted ? 'All available units already allocated in manifest' : 'Add as free complimentary courtesy asset line'}
                                >
                                  <Gift className="h-3 w-3" />
                                  + Complimentary
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Selected items grid table */}
          <div className="bg-white border border-zinc-200 flex-1 p-6 flex flex-col">
            {/* Manifest Header with Counts & Batch Toggles */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-zinc-200">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-zinc-850" />
                <h3 className="text-xs font-black text-zinc-900 uppercase tracking-widest">
                  Manifest Batch List ({selectedItems.length} line{selectedItems.length !== 1 ? 's' : ''})
                </h3>
              </div>

              {selectedItems.length > 0 && (
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="text-zinc-600 font-mono font-bold bg-zinc-100 px-2 py-0.5 border border-zinc-200">
                    {selectedItems.filter(s => !s.isComplimentary).length} Rented • {selectedItems.filter(s => s.isComplimentary).length} Complimentary
                  </span>
                  <div className="h-3 w-[1px] bg-zinc-300 mx-0.5" />
                  <button
                    type="button"
                    onClick={() => handleSetAllComplimentary(false)}
                    className="text-zinc-700 hover:text-zinc-950 font-bold uppercase tracking-wider px-1.5 py-0.5 hover:bg-zinc-100 transition-colors cursor-pointer"
                  >
                    Mark All Rented
                  </button>
                  <span className="text-zinc-300">|</span>
                  <button
                    type="button"
                    onClick={() => handleSetAllComplimentary(true)}
                    className="text-emerald-750 hover:text-emerald-900 font-bold uppercase tracking-wider px-1.5 py-0.5 hover:bg-emerald-50 transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <Gift className="h-3 w-3" />
                    Mark All Complimentary
                  </button>
                </div>
              )}
            </div>

            {selectedItems.length === 0 ? (
              <div className="flex-1 py-12 flex flex-col justify-center items-center text-center text-zinc-400">
                <ClipboardList className="h-8 w-8 text-zinc-300 mb-2" />
                <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Your acknowledgement receipt is currently empty.</p>
                <p className="text-[11px] text-zinc-400 max-w-xs mt-1 uppercase tracking-wider font-semibold">Use the search box above to add assets to the acknowledgement receipt manifest as rented or complimentary items.</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[340px]">
                {selectedItems.map((si, index) => {
                  const item = inventory.find(i => i.id === si.itemId)!;
                  if (!item) return null;
                  const isNoQty = item.isNoQuantity || item.category === 'Corkage & Service Permits';
                  const otherLinesQty = getAllocatedQtyForItem(item.id, si.lineId);
                  const maxForLine = isNoQty ? 9999 : Math.max(0, item.quantityAvailable - otherLinesQty);
                  const remainingUnallocated = isNoQty ? 9999 : Math.max(0, item.quantityAvailable - (otherLinesQty + si.quantity));
                  const hasOppositeLine = selectedItems.some(
                    other => other.itemId === si.itemId && other.isComplimentary !== si.isComplimentary
                  );

                  return (
                    <motion.div
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      key={si.lineId}
                      className={`p-4 border transition-all ${
                        si.isComplimentary
                          ? 'bg-emerald-50/60 border-emerald-300 shadow-xs'
                          : isNoQty
                          ? 'bg-amber-50/50 border-amber-200'
                          : 'bg-zinc-50 border-zinc-200'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-zinc-900 uppercase tracking-tight text-xs">
                              {item.name}
                            </span>
                            {si.isComplimentary ? (
                              <span className="text-[9px] font-black text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 uppercase tracking-wider flex items-center gap-1">
                                <Gift className="h-2.5 w-2.5" />
                                Complimentary / Courtesy
                              </span>
                            ) : (
                              <span className="text-[9px] font-black text-zinc-700 bg-zinc-200/70 border border-zinc-300 px-2 py-0.5 uppercase tracking-wider">
                                Rented
                              </span>
                            )}
                            {isNoQty && (
                              <span className="text-[9px] font-extrabold text-amber-900 bg-amber-100 px-1.5 py-0.5 border border-amber-300 uppercase">
                                Corkage / Service Permit
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-zinc-500 font-mono mt-1 uppercase tracking-wide flex flex-wrap items-center gap-x-2">
                            <span>{item.sku}</span>
                            <span>•</span>
                            <span>{item.category}</span>
                            <span>•</span>
                            <span>
                              Rate:{' '}
                              {si.isComplimentary ? (
                                <>
                                  <span className="line-through text-zinc-400">₱{Number(item.rentalPrice || 0).toLocaleString()}</span>
                                  <span className="text-emerald-800 font-extrabold ml-1.5">₱0 (Free Courtesy)</span>
                                </>
                              ) : (
                                <span className="text-zinc-900 font-bold">₱{Number(item.rentalPrice || 0).toLocaleString()}</span>
                              )}
                            </span>
                            {!isNoQty && (
                              <>
                                <span>•</span>
                                <span className="text-zinc-800 font-semibold">
                                  {otherLinesQty > 0
                                    ? `${otherLinesQty + si.quantity} / ${item.quantityAvailable} allocated (${remainingUnallocated} left)`
                                    : `${item.quantityAvailable} units available`}
                                </span>
                              </>
                            )}
                          </div>
                          {!hasOppositeLine && (isNoQty || remainingUnallocated > 0) && (
                            <div className="mt-2">
                              <button
                                type="button"
                                onClick={() => handleAddItem(item, !si.isComplimentary)}
                                className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 border transition-colors cursor-pointer inline-flex items-center gap-1 ${
                                  si.isComplimentary
                                    ? 'text-zinc-700 bg-white border-zinc-300 hover:bg-zinc-100'
                                    : 'text-emerald-800 bg-emerald-50 border-emerald-300 hover:bg-emerald-100'
                                }`}
                              >
                                <Plus className="h-2.5 w-2.5" />
                                {si.isComplimentary
                                  ? 'Also Add Same Item as Rented'
                                  : 'Also Add Same Item as Complimentary'}
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Allocation Mode Segmented Switch, Qty Input, and Remove */}
                        <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                          {/* Rented vs Complimentary Toggle */}
                          <div className="flex flex-col items-center">
                            <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1">
                              Allocation
                            </label>
                            <div className="flex items-center bg-zinc-200/80 p-0.5 border border-zinc-300 text-[10px] font-bold">
                              <button
                                type="button"
                                onClick={() => handleToggleComplimentary(si.lineId, false)}
                                className={`px-2.5 py-1 uppercase tracking-wider transition-all cursor-pointer ${
                                  !si.isComplimentary
                                    ? 'bg-zinc-900 text-white font-extrabold shadow-xs'
                                    : 'text-zinc-600 hover:text-zinc-900'
                                }`}
                              >
                                Rented
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleComplimentary(si.lineId, true)}
                                className={`px-2.5 py-1 uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1 ${
                                  si.isComplimentary
                                    ? 'bg-emerald-700 text-white font-extrabold shadow-xs'
                                    : 'text-zinc-600 hover:text-emerald-800'
                                }`}
                              >
                                <Gift className="h-3 w-3" />
                                Comp
                              </button>
                            </div>
                          </div>

                          {/* Quantity Selector */}
                          <div className="flex flex-col items-end">
                            <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1">
                              {isNoQty ? 'Permit Count' : 'Quantity'}
                            </label>
                            <input
                              id={`qty-input-${item.sku}-${index}`}
                              type="number"
                              min="0"
                              max={maxForLine}
                              value={si.quantity === 0 ? '' : si.quantity}
                              onChange={(e) => {
                                const val = e.target.value === '' ? 0 : Number(e.target.value);
                                handleQuantityChange(si.lineId, val);
                              }}
                              className="w-16 px-2 py-1 text-center font-bold text-xs font-mono bg-white border border-zinc-200 focus:outline-none focus:border-zinc-900"
                            />
                          </div>

                          {/* Remove Button */}
                          <button
                            id={`btn-remove-item-${item.sku}-${index}`}
                            type="button"
                            onClick={() => handleRemoveItem(si.lineId)}
                            className="p-1.5 text-zinc-400 hover:text-red-750 hover:bg-red-50 border border-transparent hover:border-red-200 transition-all cursor-pointer mt-4"
                            title="Remove item from manifest"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* Bottom Allocation Stats Card */}
            {selectedItems.length > 0 && (
              <div className="mt-4 p-3 bg-zinc-50 border border-zinc-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-[9px] uppercase font-bold text-zinc-400 block tracking-widest">Total Outbound</span>
                  <span className="font-mono font-bold text-zinc-900">
                    {selectedItems.reduce((sum, s) => sum + s.quantity, 0)} units
                  </span>
                </div>
                <div>
                  <span className="text-[9px] uppercase font-bold text-zinc-400 block tracking-widest">Rented Assets</span>
                  <span className="font-mono font-bold text-zinc-800">
                    {selectedItems.filter(s => !s.isComplimentary).reduce((sum, s) => sum + s.quantity, 0)} units
                  </span>
                </div>
                <div>
                  <span className="text-[9px] uppercase font-bold text-emerald-700 block tracking-widest flex items-center gap-1">
                    <Gift className="h-2.5 w-2.5" />
                    Complimentary
                  </span>
                  <span className="font-mono font-bold text-emerald-800">
                    {selectedItems.filter(s => s.isComplimentary).reduce((sum, s) => sum + s.quantity, 0)} units
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[9px] uppercase font-bold text-zinc-400 block tracking-widest">Courtesy Waived</span>
                  <span className="font-mono font-bold text-emerald-750">
                    ₱{selectedItems.reduce((acc, si) => {
                      if (!si.isComplimentary) return acc;
                      const it = inventory.find(i => i.id === si.itemId);
                      return acc + (Number(it?.rentalPrice || 0) * si.quantity);
                    }, 0).toLocaleString()}
                  </span>
                </div>
              </div>
            )}

            {/* Bottom Actions */}
            <div className="border-t border-zinc-200 pt-6 mt-6 flex gap-4">
              <button
                id="btn-cancel-tx-bottom"
                type="button"
                onClick={onCancel}
                className="flex-1 py-3 text-xs font-bold uppercase tracking-widest text-zinc-700 bg-white hover:bg-zinc-50 border border-zinc-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="btn-submit-tx"
                type="submit"
                disabled={isSubmitting || selectedItems.length === 0}
                className="flex-1 py-3 text-xs font-bold uppercase tracking-widest text-white bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center transition-colors cursor-pointer"
              >
                <Send className="h-4 w-4 mr-2" />
                {isSubmitting ? 'Creating Batch...' : 'Confirm & Issue'}
              </button>
            </div>
          </div>
        </div>

      </form>
    </div>
  );
}
