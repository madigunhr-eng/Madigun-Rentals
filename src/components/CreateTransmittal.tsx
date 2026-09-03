import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Trash2, Calendar, User, MapPin, ClipboardList, Send, X, AlertCircle } from 'lucide-react';
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

  // Selected items in this transmittal
  const [selectedItems, setSelectedItems] = useState<{
    itemId: string;
    quantity: number;
  }[]>([]);

  // Search/add helper state
  const [searchItemQuery, setSearchItemQuery] = useState('');
  const [showItemDropdown, setShowItemDropdown] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Available items in inventory that have quantityAvailable > 0 (or isNoQuantity/Corkage), are not stagnant, and aren't already selected
  const eligibleItems = inventory.filter(item => {
    const isNoQty = item.isNoQuantity || item.category === 'Corkage & Service Permits';
    const isAvailable = isNoQty || item.quantityAvailable > 0;
    const isNotStagnant = item.status !== 'Retired';
    const isNotSelected = !selectedItems.some(si => si.itemId === item.id);
    const matchesQuery = item.name.toLowerCase().includes(searchItemQuery.toLowerCase()) || 
                         item.sku.toLowerCase().includes(searchItemQuery.toLowerCase()) ||
                         item.category.toLowerCase().includes(searchItemQuery.toLowerCase());
    return isAvailable && isNotStagnant && isNotSelected && matchesQuery;
  });

  // Handle adding an item to the transmittal list
  const handleAddItem = (item: InventoryItem) => {
    setSelectedItems([...selectedItems, { itemId: item.id, quantity: 1 }]);
    setSearchItemQuery('');
    setShowItemDropdown(false);
    setErrorMsg('');
  };

  // Handle removing an item from the transmittal list
  const handleRemoveItem = (itemId: string) => {
    setSelectedItems(selectedItems.filter(si => si.itemId !== itemId));
  };

  // Handle quantity changes with validation
  const handleQuantityChange = (itemId: string, val: number) => {
    const item = inventory.find(i => i.id === itemId);
    if (!item) return;

    const isNoQty = item.isNoQuantity || item.category === 'Corkage & Service Permits';
    const maxVal = isNoQty ? 9999 : item.quantityAvailable;

    // Constrain quantity between 0 and maxVal (allowing 0 so they can clear/type)
    const validQty = Math.max(0, Math.min(maxVal, isNaN(val) ? 0 : val));
    
    setSelectedItems(selectedItems.map(si => 
      si.itemId === itemId ? { ...si, quantity: validQty } : si
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
    if (selectedItems.length === 0) return setErrorMsg('Please add at least 1 item to the transmittal');

    // Check for any items with quantity of 0
    const zeroItem = selectedItems.find(si => si.quantity <= 0);
    if (zeroItem) {
      const item = inventory.find(i => i.id === zeroItem.itemId);
      return setErrorMsg(`Please enter a quantity of 1 or more for "${item?.name || 'item'}"`);
    }

    // Check if any selected item is an event venue and is already booked on the selected date
    const allTransmittals = localStore.getCollection<any>('transmittals');
    for (const si of selectedItems) {
      const itm = inventory.find(i => i.id === si.itemId);
      if (itm && (itm.category === 'Rental Halls & Event Venues' || itm.isHourlyCharged)) {
        const ongoingConflict = allTransmittals.find(t => {
          if (t.status === 'Returned') return false;
          const matches = t.items.some((ti: any) => ti.itemId === itm.id || ti.sku === itm.sku);
          if (!matches) return false;
          const txStart = t.dateCheckout ? t.dateCheckout.split(' ')[0].split('T')[0] : '';
          const txEnd = t.dateCheckin ? t.dateCheckin.split(' ')[0].split('T')[0] : '';
          if (txEnd) {
            return dateCheckout >= txStart && dateCheckout <= txEnd;
          }
          return dateCheckout === txStart;
        });

        if (ongoingConflict) {
          return setErrorMsg(`Venue "${itm.name}" already has an ongoing booking (${ongoingConflict.transmittalNo} for ${ongoingConflict.rentee}) for ${dateCheckout}. Please select another date or venue.`);
        }
      }
    }

    // Build transmittal items array
    const transmittalItems: TransmittalItem[] = selectedItems.map(si => {
      const item = inventory.find(i => i.id === si.itemId)!;
      return {
        itemId: si.itemId,
        name: item.name,
        sku: item.sku,
        quantity: si.quantity,
        returnedQuantity: 0 // initially 0 returned
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
      setErrorMsg(err.message || 'Failed to create transmittal');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-zinc-200 pb-6">
        <div>
          <h1 className="text-xl font-black font-display text-zinc-900 uppercase tracking-wider">Create Transmittal</h1>
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
            Transmittal Logistics
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
                          return (
                            <div
                              key={item.id}
                              onClick={() => handleAddItem(item)}
                              className="p-3.5 hover:bg-zinc-50 cursor-pointer flex justify-between items-center text-xs"
                            >
                              <div>
                                <div className="font-bold text-zinc-900 uppercase tracking-tight">{item.name}</div>
                                <div className="text-[10px] text-zinc-450 font-mono mt-0.5 uppercase tracking-wide">
                                  {item.sku} • {item.category} • Rate: ₱{Number(item.rentalPrice || 0).toLocaleString()}
                                </div>
                              </div>
                              {isNoQty ? (
                                <span className="text-[9px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 uppercase tracking-wider">
                                  Service / Corkage Fee
                                </span>
                              ) : (
                                <span className="text-[9px] font-bold bg-zinc-100 text-zinc-800 border border-zinc-200 px-2 py-0.5 uppercase tracking-wider">
                                  {item.quantityAvailable} units left
                                </span>
                              )}
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
            <h3 className="text-xs font-black text-zinc-900 uppercase tracking-widest pb-3 border-b border-zinc-200 flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-zinc-850" />
              Manifest Batch List ({selectedItems.length} profile{selectedItems.length !== 1 ? 's' : ''})
            </h3>

            {selectedItems.length === 0 ? (
              <div className="flex-1 py-12 flex flex-col justify-center items-center text-center text-zinc-400">
                <ClipboardList className="h-8 w-8 text-zinc-300 mb-2" />
                <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Your transmittal is currently empty.</p>
                <p className="text-[11px] text-zinc-400 max-w-xs mt-1 uppercase tracking-wider font-semibold">Use the search box above to add high-quality assets to the transmittal manifest.</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[300px]">
                {selectedItems.map((si, index) => {
                  const item = inventory.find(i => i.id === si.itemId)!;
                  if (!item) return null;
                  const isNoQty = item.isNoQuantity || item.category === 'Corkage & Service Permits';

                  return (
                    <motion.div
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      key={si.itemId}
                      className={`p-4 border flex items-center justify-between gap-4 ${
                        isNoQty ? 'bg-amber-50/50 border-amber-200' : 'bg-zinc-50 border-zinc-200'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-zinc-900 uppercase tracking-tight text-xs flex items-center gap-2">
                          {item.name}
                          {isNoQty && (
                            <span className="text-[9px] font-extrabold text-amber-900 bg-amber-100 px-1.5 py-0.5 border border-amber-300 uppercase">
                              Corkage / Service Permit
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-zinc-400 font-mono mt-0.5 uppercase tracking-wide">
                          {item.sku} • {item.category} • Rate: <span className="text-emerald-700 font-bold">₱{Number(item.rentalPrice || 0).toLocaleString()}</span>
                          {!isNoQty && (
                            <> • <span className="text-zinc-900 font-bold">{item.quantityAvailable} units available</span></>
                          )}
                        </div>
                      </div>

                      {/* Quantity Selector and Delete */}
                      <div className="flex items-center gap-4 shrink-0">
                        <div className="flex flex-col items-end">
                          <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1">
                            {isNoQty ? 'Permit Count' : 'Quantity'}
                          </label>
                          <input
                            id={`qty-input-${item.sku}`}
                            type="number"
                            min="0"
                            max={isNoQty ? 9999 : item.quantityAvailable}
                            value={si.quantity === 0 ? '' : si.quantity}
                            onChange={(e) => {
                              const val = e.target.value === '' ? 0 : Number(e.target.value);
                              handleQuantityChange(si.itemId, val);
                            }}
                            className="w-16 px-2 py-1.5 text-center font-bold text-xs font-mono bg-white border border-zinc-200 focus:outline-none focus:border-zinc-900"
                          />
                        </div>

                        <button
                          id={`btn-remove-item-${item.sku}`}
                          type="button"
                          onClick={() => handleRemoveItem(si.itemId)}
                          className="p-1.5 text-zinc-400 hover:text-red-750 hover:bg-red-50 border border-transparent hover:border-red-200 transition-all cursor-pointer mt-4"
                          title="Remove item"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
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
