import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Plus, MapPin, Edit, PlusCircle, MinusCircle, CheckCircle, Info, X, Save, Trash2, Send } from 'lucide-react';
import { localStore } from '../localStore';
import { InventoryItem, UserSession, Warehouse } from '../types';
import { CATEGORIES } from '../utils';

interface InventoryListProps {
  items: InventoryItem[];
  onAddItem: (item: Omit<InventoryItem, 'id' | 'createdAt'>) => Promise<void>;
  onUpdateItem: (id: string, updates: Partial<InventoryItem>) => Promise<void>;
  onDeleteItem: (id: string) => Promise<void>;
  currentUser?: UserSession | null;
  onNewTransmittalClick?: () => void;
}

export default function InventoryList({ items, onAddItem, onUpdateItem, onDeleteItem, currentUser, onNewTransmittalClick }: InventoryListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  React.useEffect(() => {
    const unsubscribe = localStore.subscribe<Warehouse>('warehouses', (list) => {
      setWarehouses(list || []);
    });
    return () => unsubscribe();
  }, []);

  const getWarehouseName = (warehouseId?: string) => {
    if (!warehouseId) return 'Unassigned';
    const wh = warehouses.find(w => w.id === warehouseId);
    return wh ? wh.name : 'Unassigned';
  };
  
  // Modals/Pannels state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Reset states when selected item changes
  React.useEffect(() => {
    setShowDeleteConfirm(false);
    setErrorMsg('');
    setSuccessMsg('');
  }, [selectedItem, isEditMode]);
  
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    category: 'Corkage & Service Permits',
    quantityTotal: 1,
    location: '',
    isStationary: false,
    price: 0,
    rentalPrice: 0,
    isHourlyCharged: false,
    estimatedLifespan: '',
    isNoQuantity: false,
    chargeType: 'Flat Fee' as 'Daily' | 'Hourly' | 'Flat Fee'
  });

  const [quickQty, setQuickQty] = useState(1);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Handle item search & category filtering
  const filteredItems = items.filter(item => {
    const isRentable = item.status !== 'Retired';
    const isNotHall = item.category !== 'Rental Halls & Event Venues' && !item.sku?.toLowerCase().startsWith('hall-');
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.sku.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = 
      selectedCategory === 'All' || 
      item.category === selectedCategory ||
      (selectedCategory === 'Corkage & Service Permits' && (item.isNoQuantity || item.category === 'Corkage & Service Permits'));

    return isRentable && isNotHall && matchesSearch && matchesCategory;
  });

  // Open add modal
  const handleOpenAddModal = () => {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const parts = formatter.formatToParts(new Date());
    const year = parts.find(p => p.type === 'year')?.value || '';
    const month = parts.find(p => p.type === 'month')?.value || '';
    const day = parts.find(p => p.type === 'day')?.value || '';
    
    const prefix = `SKU-${year}-${month}-${day}-`;
    
    const matchingSkus = items
      .filter(item => item.sku && item.sku.toLowerCase().startsWith(prefix.toLowerCase()))
      .map(item => {
        const suffix = item.sku.slice(prefix.length);
        const num = parseInt(suffix, 10);
        return isNaN(num) ? 0 : num;
      });
      
    const nextNum = matchingSkus.length > 0 ? Math.max(...matchingSkus) + 1 : 1;
    const nextNumStr = nextNum.toString().padStart(2, '0');
    const generatedSku = `${prefix}${nextNumStr}`;

    setFormData({
      name: '',
      sku: generatedSku,
      category: 'Corkage & Service Permits',
      quantityTotal: 1,
      location: '',
      isStationary: false,
      price: 0,
      rentalPrice: 0,
      isHourlyCharged: false,
      estimatedLifespan: '',
      isNoQuantity: true,
      chargeType: 'Flat Fee'
    });
    setErrorMsg('');
    setIsAddModalOpen(true);
  };

  // Submit add item
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return setErrorMsg('Item Name is required');
    if (!formData.sku.trim()) return setErrorMsg('SKU is required');
    
    // Check if SKU is duplicate
    const isSkuExists = items.some(item => item.sku.toLowerCase() === formData.sku.trim().toLowerCase());
    if (isSkuExists) {
      return setErrorMsg('SKU already exists in the system');
    }

    const isNoQty = formData.isNoQuantity || formData.category === 'Corkage & Service Permits';
    const totalQty = isNoQty ? 9999 : Number(formData.quantityTotal);

    if (!isNoQty && totalQty < 1) {
      return setErrorMsg('Initial Total Quantity must be at least 1');
    }

    try {
      await onAddItem({
        name: formData.name,
        sku: formData.sku,
        category: formData.category,
        quantityTotal: totalQty,
        quantityAvailable: totalQty, // initially all are available
        status: 'In Stock',
        location: formData.location,
        isStationary: formData.isStationary || false,
        price: Number(formData.price || 0),
        rentalPrice: Number(formData.rentalPrice || 0),
        isHourlyCharged: formData.isHourlyCharged || false,
        estimatedLifespan: formData.estimatedLifespan || '',
        isNoQuantity: isNoQty,
        chargeType: formData.chargeType
      });
      setIsAddModalOpen(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to add item');
    }
  };

  // Save edits
  const handleSaveEdit = async () => {
    if (!selectedItem) return;
    if (!selectedItem.name.trim()) return setErrorMsg('Name is required');

    const isNoQty = selectedItem.isNoQuantity || selectedItem.category === 'Corkage & Service Permits';
    if (!isNoQty && Number(selectedItem.quantityTotal) < 1) return setErrorMsg('Total Stock must be at least 1');

    try {
      let finalAvailable = 9999;
      let finalStatus = selectedItem.status;

      if (isNoQty) {
        await onUpdateItem(selectedItem.id, {
          name: selectedItem.name,
          category: selectedItem.category,
          quantityTotal: 9999,
          quantityAvailable: 9999,
          location: selectedItem.location,
          status: selectedItem.status,
          price: Number(selectedItem.price || 0),
          rentalPrice: Number(selectedItem.rentalPrice || 0),
          isHourlyCharged: selectedItem.isHourlyCharged || false,
          isNoQuantity: true,
          chargeType: selectedItem.chargeType || 'Flat Fee'
        });
      } else {
        // Calculate new available quantity if total changed
        const originalTotal = items.find(i => i.id === selectedItem.id)?.quantityTotal || 0;
        const originalAvailable = items.find(i => i.id === selectedItem.id)?.quantityAvailable || 0;
        const diff = selectedItem.quantityTotal - originalTotal;
        let newAvailable = originalAvailable + diff;
        
        // Validation: Available cannot exceed total
        if (newAvailable < 0) newAvailable = 0;
        if (newAvailable > selectedItem.quantityTotal) newAvailable = selectedItem.quantityTotal;

        if (finalStatus !== 'Retired') {
          if (newAvailable === 0 && selectedItem.quantityTotal > 0) {
            finalStatus = 'Out of Stock';
          } else if (newAvailable < selectedItem.quantityTotal) {
            finalStatus = 'Partially Rented';
          } else {
            finalStatus = 'In Stock';
          }
        }
        finalAvailable = newAvailable;

        await onUpdateItem(selectedItem.id, {
          name: selectedItem.name,
          category: selectedItem.category,
          quantityTotal: Number(selectedItem.quantityTotal),
          quantityAvailable: Number(newAvailable),
          location: selectedItem.location,
          status: finalStatus,
          isStationary: selectedItem.isStationary || false,
          price: Number(selectedItem.price || 0),
          rentalPrice: Number(selectedItem.rentalPrice || 0),
          isHourlyCharged: selectedItem.isHourlyCharged || false,
          estimatedLifespan: selectedItem.estimatedLifespan || '',
          isNoQuantity: false,
          chargeType: selectedItem.chargeType
        });
      }

      // Update the active detail view with saved values
      setSelectedItem({
        ...selectedItem,
        quantityAvailable: finalAvailable,
        status: finalStatus,
        isStationary: selectedItem.isStationary || false,
        price: Number(selectedItem.price || 0),
        rentalPrice: Number(selectedItem.rentalPrice || 0),
        isHourlyCharged: selectedItem.isHourlyCharged || false,
        estimatedLifespan: selectedItem.estimatedLifespan || ''
      });
      setIsEditMode(false);
      setSuccessMsg('Item updated successfully');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to edit item');
    }
  };

  // Direct checkout/checkin logic
  const handleDirectCheckOut = async () => {
    if (!selectedItem || quickQty <= 0) return;
    
    if (selectedItem.quantityAvailable < quickQty) {
      setErrorMsg(`Cannot check out ${quickQty} units. Only ${selectedItem.quantityAvailable} units are available.`);
      setTimeout(() => setErrorMsg(''), 4000);
      return;
    }

    const newAvailable = selectedItem.quantityAvailable - quickQty;
    let status: 'In Stock' | 'Partially Rented' | 'Out of Stock' = 'In Stock';
    if (newAvailable === 0 && selectedItem.quantityTotal > 0) {
      status = 'Out of Stock';
    } else if (newAvailable < selectedItem.quantityTotal) {
      status = 'Partially Rented';
    }

    try {
      await onUpdateItem(selectedItem.id, {
        quantityAvailable: newAvailable,
        status
      });
      setSelectedItem({
        ...selectedItem,
        quantityAvailable: newAvailable,
        status
      });
      setSuccessMsg(`Successfully checked out ${quickQty} unit(s)`);
      setQuickQty(1);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setErrorMsg('Failed to process checkout');
    }
  };

  const handleDirectCheckIn = async () => {
    if (!selectedItem || quickQty <= 0) return;

    const maxCanReturn = selectedItem.quantityTotal - selectedItem.quantityAvailable;
    if (quickQty > maxCanReturn) {
      setErrorMsg(`Cannot check in ${quickQty} units. Only ${maxCanReturn} units are currently out/rented.`);
      setTimeout(() => setErrorMsg(''), 4000);
      return;
    }

    const newAvailable = selectedItem.quantityAvailable + quickQty;
    let status: 'In Stock' | 'Partially Rented' | 'Out of Stock' = 'In Stock';
    if (newAvailable === 0 && selectedItem.quantityTotal > 0) {
      status = 'Out of Stock';
    } else if (newAvailable < selectedItem.quantityTotal) {
      status = 'Partially Rented';
    }

    try {
      await onUpdateItem(selectedItem.id, {
        quantityAvailable: newAvailable,
        status
      });
      setSelectedItem({
        ...selectedItem,
        quantityAvailable: newAvailable,
        status
      });
      setSuccessMsg(`Successfully checked in ${quickQty} unit(s)`);
      setQuickQty(1);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setErrorMsg('Failed to process check-in');
    }
  };

  // Delete inventory asset completely
  const handleDeleteAsset = async () => {
    if (!selectedItem) return;
    
    const rentedQty = selectedItem.quantityTotal - selectedItem.quantityAvailable;
    if (rentedQty > 0) {
      setErrorMsg(`CANNOT DELETE: ${rentedQty} unit(s) of this asset are currently rented out under active transmittals. Please return them first before deleting.`);
      return;
    }

    setShowDeleteConfirm(true);
  };

  return (
    <div className="space-y-8">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-200 pb-6">
        <div>
          <h1 className="text-xl font-black font-display text-zinc-900 uppercase tracking-wider">Rental Items Register</h1>
          {currentUser?.role === 'Front Desk' && (
            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-1 uppercase tracking-widest mt-1.5 inline-block">
              ⚠️ {currentUser?.role || 'Staff'} Session (Read-Only Records)
            </span>
          )}
        </div>
        {currentUser?.role !== 'Front Desk' && (
          <button
            id="btn-add-item-list"
            onClick={handleOpenAddModal}
            className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-white bg-zinc-900 hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5 mr-2" />
            Add Rental Item Profile
          </button>
        )}
        {(currentUser?.role?.toLowerCase() === 'staff' || currentUser?.role?.toLowerCase() === 'front desk') && onNewTransmittalClick && (
          <button
            id="btn-create-transmittal-rental-items"
            onClick={onNewTransmittalClick}
            className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-white bg-zinc-900 hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <Send className="h-3.5 w-3.5 mr-2" />
            New Transmittal
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 border border-zinc-200 space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-center">
          <div className="relative w-full md:flex-1">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-zinc-400">
              <Search className="h-4 w-4" />
            </span>
            <input
              id="input-search-items"
              type="text"
              placeholder="Search assets or corkage fees by name, SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-zinc-200 text-xs font-semibold uppercase tracking-wider bg-zinc-50 focus:bg-white focus:outline-none focus:border-zinc-900 transition-all text-zinc-800 placeholder-zinc-400"
            />
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-1 pb-0.5 no-scrollbar">
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all border cursor-pointer ${
                  isSelected
                    ? 'bg-zinc-900 text-white border-zinc-900 shadow-xs'
                    : 'bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100'
                }`}
              >
                {cat === 'Corkage & Service Permits' ? 'Corkage & Permits (No Qty)' : cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid of items */}
      {filteredItems.length === 0 ? (
        <div className="bg-white border border-zinc-200 p-12 text-center text-zinc-400">
          <Search className="h-8 w-8 text-zinc-300 mx-auto mb-3" />
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">No matching assets found</p>
          <p className="text-[11px] text-zinc-400 mt-1 uppercase tracking-wider">Try adjusting your filters or search term.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => {
            const isNoQty = item.isNoQuantity || item.category === 'Corkage & Service Permits';
            const isOutOfStock = !isNoQty && item.quantityAvailable === 0;
            const isLowStock = !isNoQty && item.quantityAvailable < 2 && item.quantityAvailable > 0;
            
            return (
              <motion.div
                layout
                id={`item-card-${item.sku}`}
                key={item.id}
                onClick={() => {
                  setSelectedItem(item);
                  setIsEditMode(false);
                  setQuickQty(1);
                  setErrorMsg('');
                }}
                className={`bg-white border p-6 cursor-pointer flex flex-col justify-between hover:border-zinc-900 relative group transition-all ${
                  isNoQty ? 'border-amber-300 bg-amber-50/20' : 'border-zinc-200'
                }`}
              >
                <div>
                  <div className="flex justify-between items-start gap-2 flex-wrap">
                    {isNoQty ? (
                      <span className="inline-flex items-center px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider border bg-amber-100 text-amber-900 border-amber-300">
                        Corkage / Service Permit
                      </span>
                    ) : (
                      <span className={`inline-flex items-center px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider border ${
                        isOutOfStock
                          ? 'bg-red-50 text-red-700 border-red-200'
                          : isLowStock
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}>
                        {isOutOfStock ? 'Out of Stock' : isLowStock ? 'Low Stock' : 'In Stock'}
                      </span>
                    )}

                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest font-mono">
                        {item.category}
                      </span>
                      {currentUser?.role !== 'Front Desk' && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedItem(item);
                            setIsEditMode(false);
                            const rentedQty = item.quantityTotal - item.quantityAvailable;
                            if (rentedQty > 0) {
                              setErrorMsg(`CANNOT DELETE: ${rentedQty} unit(s) of this asset are currently rented out under active transmittals. Please return them first before deleting.`);
                            } else {
                              setShowDeleteConfirm(true);
                            }
                          }}
                          className="p-1 text-zinc-400 hover:text-red-650 hover:bg-red-50 rounded-sm transition-colors cursor-pointer"
                          title="Delete Asset"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <h3 className="mt-4 text-sm font-bold text-zinc-900 uppercase tracking-tight line-clamp-2 group-hover:text-zinc-600 transition-colors">
                    {item.name}
                  </h3>
                  <p className="text-[11px] font-mono text-zinc-400 mt-0.5 uppercase tracking-wide">{item.sku}</p>
                  
                  {/* Price and Rate Display */}
                  <div className="flex flex-col gap-1 mt-2.5 text-[10px] uppercase font-bold tracking-wider text-zinc-500 bg-zinc-50/50 p-2 border border-zinc-100">
                    <div className="flex justify-between">
                      <span>Rate Fee:</span>
                      <span className="text-emerald-700 font-mono font-bold">
                        ₱{Number(item.rentalPrice || 0).toLocaleString()} {item.isHourlyCharged ? '/ hour' : '/ flat fee'}
                      </span>
                    </div>
                    {!isNoQty && (
                      <div className="flex justify-between border-t border-zinc-100 pt-1">
                        <span>Asset Value:</span>
                        <span className="text-zinc-850 font-mono font-semibold">{item.price ? `₱${Number(item.price).toLocaleString()}` : '₱0'}</span>
                      </div>
                    )}
                  </div>


                </div>

                <div className="mt-5 pt-4 border-t border-zinc-100 flex justify-between items-center text-xs">
                  <div className="flex items-center text-zinc-500 font-medium">
                    <MapPin className="h-3.5 w-3.5 mr-1 text-zinc-400" />
                    <span className="truncate max-w-[120px] text-[11px] uppercase tracking-wider font-semibold">{getWarehouseName(item.warehouseId)}</span>
                  </div>
                  <div className="font-bold text-zinc-800 text-right">
                    {isNoQty ? (
                      <span className="text-amber-900 font-bold text-[10px] uppercase tracking-widest bg-amber-100 px-2 py-0.5 border border-amber-300">
                        No Qty Limits
                      </span>
                    ) : (
                      <>
                        <span className="text-zinc-950 font-mono text-sm">{item.quantityAvailable}</span>
                        <span className="text-zinc-400 font-normal text-[11px]"> / {item.quantityTotal} units</span>
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Item Detail / Quick Actions Slide-Over */}
      <AnimatePresence>
        {selectedItem && (
          <div className="fixed inset-0 z-50 bg-zinc-900/30 backdrop-blur-[1px] flex justify-end">
            {/* Click outside container to close */}
            <div className="absolute inset-0 cursor-default" onClick={() => setSelectedItem(null)}></div>
            
            <motion.div
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 100 }}
              className="bg-white w-full max-w-md h-full border-l border-zinc-200 shadow-none flex flex-col p-6 overflow-y-auto relative z-10"
            >
              {/* Detail Header */}
              <div className="flex justify-between items-center border-b border-zinc-200 pb-4">
                <h2 className="text-sm font-black uppercase tracking-widest text-zinc-900">
                  {isEditMode ? 'Modify Asset Profile' : 'Asset Ledger Detail'}
                </h2>
                <button
                  id="btn-close-item-detail"
                  onClick={() => setSelectedItem(null)}
                  className="text-zinc-400 hover:text-zinc-900 p-1.5 transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Detail Content */}
              <div className="flex-1 py-4 space-y-5">
                {errorMsg && (
                  <div className="bg-red-50 border border-red-200 text-red-700 p-3 text-[11px] font-bold uppercase tracking-wider">
                    {errorMsg}
                  </div>
                )}
                {successMsg && (
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-3 text-[11px] font-bold uppercase tracking-wider">
                    {successMsg}
                  </div>
                )}

                {isEditMode ? (
                  /* Edit Mode Form (Geometric Balance) */
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Item Name</label>
                      <input
                        id="edit-item-name"
                        type="text"
                        value={selectedItem.name}
                        onChange={(e) => setSelectedItem({ ...selectedItem, name: e.target.value })}
                        className="w-full px-3 py-2 border border-zinc-200 text-xs font-semibold focus:outline-none focus:border-zinc-900 bg-zinc-50 focus:bg-white text-zinc-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">SKU / SERIAL (Static)</label>
                      <input
                        type="text"
                        disabled
                        value={selectedItem.sku}
                        className="w-full px-3 py-2 border border-zinc-200 text-xs font-mono bg-zinc-100 text-zinc-400 cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Total Stock</label>
                      <input
                        id="edit-item-total"
                        type="number"
                        min="0"
                        value={selectedItem.quantityTotal === 0 ? '' : selectedItem.quantityTotal}
                        onChange={(e) => {
                          const val = e.target.value === '' ? 0 : Number(e.target.value);
                          setSelectedItem({ ...selectedItem, quantityTotal: val });
                        }}
                        className="w-full px-3 py-2 border border-zinc-200 text-xs font-semibold focus:outline-none focus:border-zinc-900 bg-zinc-50 focus:bg-white text-zinc-800"
                      />
                    </div>
                    {/* Location input removed as items are assigned in the Central Warehouse module */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Price Value (₱)</label>
                        <input
                          id="edit-item-price"
                          type="number"
                          min="0"
                          value={selectedItem.price === 0 ? '' : (selectedItem.price || 0)}
                          onChange={(e) => {
                            const val = e.target.value === '' ? 0 : Number(e.target.value);
                            setSelectedItem({ ...selectedItem, price: val });
                          }}
                          className="w-full px-3 py-2 border border-zinc-200 text-xs font-semibold focus:outline-none focus:border-zinc-900 bg-zinc-50 focus:bg-white text-zinc-800"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Est. Lifespan</label>
                        <input
                          id="edit-item-lifespan"
                          type="text"
                          placeholder="e.g. 5 Years"
                          value={selectedItem.estimatedLifespan || ''}
                          onChange={(e) => setSelectedItem({ ...selectedItem, estimatedLifespan: e.target.value })}
                          className="w-full px-3 py-2 border border-zinc-200 text-xs font-semibold focus:outline-none focus:border-zinc-900 bg-zinc-50 focus:bg-white text-zinc-800"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 border-t border-zinc-100 pt-3">
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Rental Price (₱)</label>
                        <input
                          id="edit-item-rental-price"
                          type="number"
                          min="0"
                          placeholder="e.g. 50"
                          value={selectedItem.rentalPrice === 0 ? '' : (selectedItem.rentalPrice || 0)}
                          onChange={(e) => {
                            const val = e.target.value === '' ? 0 : Number(e.target.value);
                            setSelectedItem({ ...selectedItem, rentalPrice: val });
                          }}
                          className="w-full px-3 py-2 border border-zinc-200 text-xs font-semibold focus:outline-none focus:border-zinc-900 bg-zinc-50 focus:bg-white text-zinc-800"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Billing Basis</label>
                        <select
                          id="edit-item-is-hourly"
                          value={selectedItem.isHourlyCharged ? 'hourly' : 'daily'}
                          onChange={(e) => setSelectedItem({ ...selectedItem, isHourlyCharged: e.target.value === 'hourly' })}
                          className="w-full px-3 py-2 border border-zinc-200 text-xs font-semibold focus:outline-none focus:border-zinc-900 bg-zinc-50 focus:bg-white text-zinc-800"
                        >
                          <option value="daily">Charged Per Day</option>
                          <option value="hourly">Charged Per Hour</option>
                        </select>
                      </div>
                    </div>


                    <div className="flex flex-col gap-2 py-1">
                      <div className="flex items-center gap-2">
                        <input
                          id="edit-item-is-retired"
                          type="checkbox"
                          checked={selectedItem.status === 'Retired'}
                          onChange={(e) => setSelectedItem({ ...selectedItem, status: e.target.checked ? 'Retired' : 'In Stock' })}
                          className="h-4 w-4 rounded-none border-zinc-300 text-zinc-900 focus:ring-zinc-900"
                        />
                        <label htmlFor="edit-item-is-retired" className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest cursor-pointer select-none">
                          Retire Asset (Stagnant / No longer in use)
                        </label>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-4">
                      <button
                        id="btn-cancel-edit"
                        onClick={() => setIsEditMode(false)}
                        className="flex-1 py-2.5 text-xs font-bold uppercase tracking-widest text-zinc-600 bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 transition-colors cursor-pointer text-center"
                      >
                        Cancel
                      </button>
                      <button
                        id="btn-save-edit"
                        onClick={handleSaveEdit}
                        className="flex-1 py-2.5 text-xs font-bold uppercase tracking-widest text-white bg-zinc-900 hover:bg-zinc-850 transition-colors cursor-pointer inline-flex items-center justify-center"
                      >
                        <Save className="h-3.5 w-3.5 mr-1.5" />
                        Save Changes
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Display Mode with Direct Check In / Check Out features */
                  <div className="space-y-6">
                    <div className="bg-zinc-50 p-4 border border-zinc-200 space-y-4">
                      <div>
                        <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest block">System SKU / UID</span>
                        <div className="text-xs font-mono font-bold text-zinc-900 mt-0.5">{selectedItem.sku}</div>
                      </div>
                      <div>
                        <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest block">Asset Profile Name</span>
                        <div className="text-sm font-bold text-zinc-900 uppercase tracking-tight mt-0.5">{selectedItem.name}</div>
                      </div>
                      <div className="border-t border-zinc-200/60 pt-3">
                        <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest block">Warehouse Assignment</span>
                        <div className="text-xs font-bold text-zinc-700 flex items-center mt-0.5">
                          <MapPin className="h-3.5 w-3.5 mr-1 text-zinc-400 shrink-0" />
                          <span className="truncate uppercase tracking-wider">{getWarehouseName(selectedItem.warehouseId)}</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 border-t border-zinc-200/60 pt-3">
                        <div>
                          <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest block">Unit Price / Value</span>
                          <div className="text-xs font-mono font-bold text-zinc-900 mt-0.5">
                            {selectedItem.price ? `₱${Number(selectedItem.price).toLocaleString()}` : '₱0'}
                          </div>
                        </div>
                        <div>
                          <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest block">Est. Lifespan</span>
                          <div className="text-xs font-bold text-zinc-900 mt-0.5">
                            {selectedItem.estimatedLifespan || 'Not specified'}
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 border-t border-zinc-200/60 pt-3">
                        <div>
                          <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest block">Rental Rate</span>
                          <div className="text-xs font-mono font-bold text-emerald-750 mt-0.5">
                            ₱{Number(selectedItem.rentalPrice || 0).toLocaleString()} {selectedItem.isHourlyCharged ? '/ hour' : '/ day'}
                          </div>
                        </div>
                        <div>
                          <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest block">Rate Basis</span>
                          <div className="text-xs font-bold text-zinc-900 mt-0.5">
                            {selectedItem.isHourlyCharged ? 'Per Hour basis' : 'Per Day basis'}
                          </div>
                        </div>
                      </div>

                    </div>

                    {/* Stock status indicator */}
                    <div className="flex justify-between items-center p-4 bg-zinc-50 border border-zinc-200">
                      <div>
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">Current Warehouse Stock</span>
                        <div className="flex items-baseline gap-1 mt-1">
                          <span className="text-2xl font-black font-mono text-zinc-900">{selectedItem.quantityAvailable}</span>
                          <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">of {selectedItem.quantityTotal} Units</span>
                        </div>
                      </div>
                      <span className={`inline-flex px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider border ${
                        selectedItem.quantityAvailable === 0
                          ? 'bg-red-50 text-red-700 border-red-200'
                          : selectedItem.quantityAvailable < selectedItem.quantityTotal
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}>
                        {selectedItem.quantityAvailable === 0 
                          ? 'Out of Stock' 
                          : selectedItem.quantityAvailable < selectedItem.quantityTotal 
                          ? 'Partially Rented' 
                          : 'In Stock'
                        }
                      </span>
                    </div>

                    {/* Quick Direct checkin/checkout form */}
                    {currentUser?.role !== 'Front Desk' && (
                      <div className="border-t border-zinc-200 pt-5 space-y-4">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-900 flex items-center">
                          <CheckCircle className="h-4 w-4 text-zinc-800 mr-2" />
                          Quick Ledger Adjust
                        </h3>
                        <p className="text-[11px] text-zinc-500 uppercase tracking-widest font-semibold">Perform instant stock changes directly on the floor level.</p>

                        <div className="flex items-center gap-3 bg-zinc-50 p-3 border border-zinc-200">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 whitespace-nowrap">Quantity:</span>
                          <div className="flex items-center border border-zinc-200 bg-white overflow-hidden max-w-[120px]">
                            <button
                              id="btn-qty-dec-detail"
                              type="button"
                              onClick={() => setQuickQty(Math.max(1, quickQty - 1))}
                              className="p-1.5 hover:bg-zinc-50 text-zinc-500 focus:outline-none cursor-pointer"
                            >
                              <MinusCircle className="h-4 w-4" />
                            </button>
                            <input
                              id="input-qty-detail"
                              type="number"
                              min="0"
                              value={quickQty === 0 ? '' : quickQty}
                              onChange={(e) => {
                                const val = e.target.value === '' ? 0 : Number(e.target.value);
                                setQuickQty(Math.max(0, val));
                              }}
                              className="w-12 text-center text-xs font-bold font-mono focus:outline-none border-x border-zinc-200 py-1"
                            />
                            <button
                              id="btn-qty-inc-detail"
                              type="button"
                              onClick={() => setQuickQty(quickQty + 1)}
                              className="p-1.5 hover:bg-zinc-50 text-zinc-500 focus:outline-none cursor-pointer"
                            >
                              <PlusCircle className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <button
                            id="btn-direct-checkout"
                            onClick={handleDirectCheckOut}
                            disabled={selectedItem.quantityAvailable === 0}
                            className="py-2 px-3 text-[10px] font-bold uppercase tracking-widest text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1 transition-colors cursor-pointer"
                          >
                            <MinusCircle className="h-3.5 w-3.5 shrink-0" />
                            Check Out Direct
                          </button>
                          <button
                            id="btn-direct-checkin"
                            onClick={handleDirectCheckIn}
                            disabled={selectedItem.quantityAvailable === selectedItem.quantityTotal}
                            className="py-2 px-3 text-[10px] font-bold uppercase tracking-widest text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1 transition-colors cursor-pointer"
                          >
                            <PlusCircle className="h-3.5 w-3.5 shrink-0" />
                            Check In Direct
                          </button>
                        </div>
                      </div>
                    )}

                    {currentUser?.role !== 'Front Desk' ? (
                      showDeleteConfirm ? (
                        <div className="bg-red-50 border border-red-200 p-4 space-y-3.5 mt-4">
                          <div className="text-[11px] font-bold text-red-850 uppercase tracking-wider leading-relaxed">
                            ⚠️ DELETE ASSET PROFILE?
                            <span className="block font-normal normal-case text-red-700 mt-1">
                              Are you absolutely sure you want to completely delete "{selectedItem.name}"? This action is irreversible.
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <button
                              id="btn-confirm-delete-asset-cancel"
                              onClick={() => setShowDeleteConfirm(false)}
                              className="flex-1 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold text-[10px] uppercase tracking-widest border border-zinc-200 cursor-pointer transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              id="btn-confirm-delete-asset-proceed"
                              onClick={async () => {
                                try {
                                  await onDeleteItem(selectedItem.id);
                                  setSelectedItem(null);
                                  setShowDeleteConfirm(false);
                                } catch (err: any) {
                                  setErrorMsg(err.message || 'Failed to delete asset');
                                }
                              }}
                              className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-[10px] uppercase tracking-widest cursor-pointer transition-colors"
                            >
                              Yes, Delete Asset
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2 border-t border-zinc-200 pt-4">
                          <button
                            id="btn-edit-item-trigger"
                            onClick={() => {
                              setIsEditMode(true);
                              setErrorMsg('');
                            }}
                            className="flex-1 py-2.5 border border-zinc-300 text-xs font-bold uppercase tracking-widest text-zinc-700 hover:bg-zinc-50 transition-colors flex items-center justify-center cursor-pointer"
                          >
                            <Edit className="h-3.5 w-3.5 mr-1.5 text-zinc-400" />
                            Edit Profile
                          </button>
                          <button
                            id="btn-delete-item-trigger"
                            onClick={handleDeleteAsset}
                            className="py-2.5 px-4 border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 transition-colors text-xs font-bold uppercase tracking-widest flex items-center justify-center cursor-pointer"
                            title="Delete Asset Completely"
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                            Delete Asset
                          </button>
                        </div>
                      )
                    ) : (
                      <div className="border-t border-zinc-200 pt-4 text-center">
                        <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">
                          🛡️ View-Only Mode Active for this Asset
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Item Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 bg-zinc-900/30 backdrop-blur-[1px] flex items-center justify-center p-4">
            {/* Click outside container to close */}
            <div className="absolute inset-0 cursor-default" onClick={() => setIsAddModalOpen(false)}></div>
            
            <motion.div
              initial={{ scale: 0.98, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.98, opacity: 0 }}
              className="bg-white w-full max-w-lg border border-zinc-200 overflow-hidden flex flex-col relative z-10"
            >
              <div className="px-6 py-4 border-b border-zinc-200 flex justify-between items-center bg-zinc-50">
                <h3 className="text-sm font-black uppercase tracking-widest text-zinc-900">Add Rental Item Profile</h3>
                <button
                  id="btn-close-add-modal"
                  onClick={() => setIsAddModalOpen(false)}
                  className="text-zinc-400 hover:text-zinc-900 p-1.5 transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
                {errorMsg && (
                  <div className="bg-red-50 border border-red-200 text-red-750 p-3 text-[11px] font-bold uppercase tracking-wider">
                    {errorMsg}
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Item Profile Name</label>
                  <input
                    id="add-item-name"
                    type="text"
                    required
                    placeholder="e.g. Outside Photographer Corkage Fee"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-zinc-200 text-xs font-semibold focus:outline-none focus:border-zinc-900 bg-zinc-50 focus:bg-white text-zinc-850"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Item Category</label>
                    <select
                      id="add-item-category"
                      value={formData.category}
                      onChange={(e) => {
                        const newCat = e.target.value;
                        const isNoQty = newCat === 'Corkage & Service Permits' || formData.isNoQuantity;
                        setFormData({ 
                          ...formData, 
                          category: newCat,
                          isNoQuantity: isNoQty
                        });
                      }}
                      className="w-full px-3 py-2 border border-zinc-200 text-xs font-semibold focus:outline-none focus:border-zinc-900 bg-zinc-50 focus:bg-white text-zinc-850"
                    >
                      {CATEGORIES.filter(c => c !== 'All').map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">SKU / Code</label>
                    <input
                      id="add-item-sku"
                      type="text"
                      required
                      placeholder="e.g. FEE-PHOTO-01"
                      value={formData.sku}
                      onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                      className="w-full px-3 py-2 border border-zinc-200 text-xs font-mono bg-zinc-50 focus:bg-white focus:outline-none focus:border-zinc-900 text-zinc-850"
                    />
                  </div>
                </div>

                {/* No Quantity Fee Checkbox */}
                <div className="bg-amber-50/70 p-3 border border-amber-300 flex items-start gap-2.5">
                  <input
                    id="add-item-is-no-qty"
                    type="checkbox"
                    checked={formData.isNoQuantity || formData.category === 'Corkage & Service Permits'}
                    onChange={(e) => setFormData({ ...formData, isNoQuantity: e.target.checked })}
                    className="mt-0.5 h-4 w-4 rounded-none border-amber-400 text-amber-600 focus:ring-amber-500"
                  />
                  <div>
                    <label htmlFor="add-item-is-no-qty" className="text-xs font-bold text-zinc-950 uppercase tracking-wider block cursor-pointer select-none">
                      Service / Corkage Fee Item (No Quantity Tracking)
                    </label>
                    <span className="text-[10px] font-medium text-amber-900 leading-tight block mt-0.5">
                      For guest-hired outside vendors (photographers, photobooths outside hall, outside food catering, etc.). Quantity physical stock limits will be bypassed.
                    </span>
                  </div>
                </div>

                {!formData.isNoQuantity && formData.category !== 'Corkage & Service Permits' && (
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Initial Total Quantity</label>
                      <input
                        id="add-item-total"
                        type="number"
                        min="0"
                        required
                        value={formData.quantityTotal === 0 ? '' : formData.quantityTotal}
                        onChange={(e) => {
                          const val = e.target.value === '' ? 0 : Number(e.target.value);
                          setFormData({ ...formData, quantityTotal: val });
                        }}
                        className="w-full px-3 py-2 border border-zinc-200 text-xs font-semibold focus:outline-none focus:border-zinc-900 bg-zinc-50 focus:bg-white text-zinc-855"
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Price Value (₱)</label>
                    <input
                      id="add-item-price"
                      type="number"
                      min="0"
                      placeholder="e.g. 1500"
                      value={formData.price === 0 ? '' : (formData.price || '')}
                      onChange={(e) => {
                        const val = e.target.value === '' ? 0 : Number(e.target.value);
                        setFormData({ ...formData, price: val });
                      }}
                      className="w-full px-3 py-2 border border-zinc-200 text-xs font-semibold focus:outline-none focus:border-zinc-900 bg-zinc-50 focus:bg-white text-zinc-850"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Est. Lifespan</label>
                    <input
                      id="add-item-lifespan"
                      type="text"
                      placeholder="e.g. 5 Years"
                      value={formData.estimatedLifespan}
                      onChange={(e) => setFormData({ ...formData, estimatedLifespan: e.target.value })}
                      className="w-full px-3 py-2 border border-zinc-200 text-xs font-semibold focus:outline-none focus:border-zinc-900 bg-zinc-50 focus:bg-white text-zinc-850"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 border-t border-zinc-100 pt-3">
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Rental Price (₱)</label>
                    <input
                      id="add-item-rental-price"
                      type="number"
                      min="0"
                      placeholder="e.g. 100"
                      value={formData.rentalPrice === 0 ? '' : (formData.rentalPrice || '')}
                      onChange={(e) => {
                        const val = e.target.value === '' ? 0 : Number(e.target.value);
                        setFormData({ ...formData, rentalPrice: val });
                      }}
                      className="w-full px-3 py-2 border border-zinc-200 text-xs font-semibold focus:outline-none focus:border-zinc-900 bg-zinc-50 focus:bg-white text-zinc-850"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Billing Basis</label>
                    <select
                      id="add-item-is-hourly"
                      value={formData.isHourlyCharged ? 'hourly' : 'daily'}
                      onChange={(e) => setFormData({ ...formData, isHourlyCharged: e.target.value === 'hourly' })}
                      className="w-full px-3 py-2 border border-zinc-200 text-xs font-semibold focus:outline-none focus:border-zinc-900 bg-zinc-50 focus:bg-white text-zinc-850"
                    >
                      <option value="daily">Charged Per Day</option>
                      <option value="hourly">Charged Per Hour</option>
                    </select>
                  </div>
                </div>



                <div className="flex gap-3 pt-4 border-t border-zinc-200">
                  <button
                    id="btn-cancel-add"
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="flex-1 py-2.5 text-xs font-bold uppercase tracking-widest text-zinc-600 bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 transition-colors cursor-pointer text-center"
                  >
                    Cancel
                  </button>
                  <button
                    id="btn-submit-add"
                    type="submit"
                    className="flex-1 py-2.5 text-xs font-bold uppercase tracking-widest text-white bg-zinc-900 hover:bg-zinc-850 transition-colors cursor-pointer text-center"
                  >
                    Register Asset
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
