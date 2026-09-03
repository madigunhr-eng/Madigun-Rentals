import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, MapPin, Tag, ArrowLeftRight, ChevronDown, ChevronUp, Boxes, ShieldAlert, Edit, CheckCircle2, Clipboard, ArrowRight, X, Printer, Plus, Trash2, Check, PackageOpen } from 'lucide-react';
import { localStore } from '../localStore';
import { InventoryItem, UserSession, Warehouse } from '../types';
import { jsPDF } from 'jspdf';
import { getSystemLogoBase64, drawBrandedHeader, applyCenterWatermarkToAllPages } from '../utils/pdfHelper';

interface RoomInventoriesProps {
  items: InventoryItem[];
  onUpdateItem: (id: string, updates: Partial<InventoryItem>) => Promise<void>;
  onDeleteItem?: (id: string) => Promise<void>;
  currentUser?: UserSession | null;
}

export default function RoomInventories({ items, onUpdateItem, onDeleteItem, currentUser }: RoomInventoriesProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [expandedWarehouses, setExpandedWarehouses] = useState<{ [warehouseId: string]: boolean }>({});
  
  // Create Warehouse Form State
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newWarehouseName, setNewWarehouseName] = useState('');

  // Assign Items Modal State
  const [assigningWarehouse, setAssigningWarehouse] = useState<Warehouse | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<{ [itemId: string]: boolean }>({});
  const [assignmentSearchQuery, setAssignmentSearchQuery] = useState('');

  // Delete Confirmation States
  const [deletingWarehouse, setDeletingWarehouse] = useState<Warehouse | null>(null);
  const [deletingItem, setDeletingItem] = useState<{ id: string; name: string } | null>(null);

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Real-time listener for Warehouses
  useEffect(() => {
    const unsubscribe = localStore.subscribe<Warehouse>('warehouses', (list) => {
      setWarehouses(list || []);
    });

    return () => unsubscribe();
  }, []);

  // Show a message and auto-clear
  const triggerNotification = (success: string, error: string = '') => {
    if (success) {
      setSuccessMsg(success);
      setTimeout(() => setSuccessMsg(''), 4000);
    }
    if (error) {
      setErrorMsg(error);
      setTimeout(() => setErrorMsg(''), 5000);
    }
  };

  // Create Warehouse Document
  const handleCreateWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWarehouseName.trim()) return;

    try {
      setIsSubmitting(true);
      setErrorMsg('');
      
      await localStore.addItem('warehouses', {
        name: newWarehouseName.trim(),
        createdAt: new Date().toISOString()
      });

      setNewWarehouseName('');
      setShowCreateForm(false);
      triggerNotification('Successfully created new warehouse');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create warehouse');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Warehouse and unassign items
  const handleDeleteWarehouse = async (warehouseId: string, warehouseName: string) => {
    if (!window.confirm(`Are you sure you want to delete warehouse "${warehouseName}"? All assigned items will be returned to the "Unassigned / General" pool.`)) {
      return;
    }

    try {
      setIsSubmitting(true);
      
      // 1. Unassign all items belonging to this warehouse
      const assignedItems = items.filter(item => item.warehouseId === warehouseId);
      if (assignedItems.length > 0) {
        const batch = localStore.batch();
        assignedItems.forEach(item => {
          batch.update('inventory', item.id, { warehouseId: '' });
        });
        await batch.commit();
      }

      // 2. Delete warehouse document
      await localStore.deleteItem('warehouses', warehouseId);
      triggerNotification(`Successfully deleted "${warehouseName}" and unassigned ${assignedItems.length} items.`);
    } catch (err: any) {
      triggerNotification('', err.message || 'Failed to delete warehouse');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Assignment Modal
  const handleOpenAssignModal = (warehouse: Warehouse) => {
    setAssigningWarehouse(warehouse);
    setSelectedItemIds({});
    setAssignmentSearchQuery('');
    setErrorMsg('');
  };

  // Handle Assignment Submission
  const handleAssignItemsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningWarehouse) return;

    const selectedIds = Object.keys(selectedItemIds).filter(id => selectedItemIds[id]);
    if (selectedIds.length === 0) {
      setErrorMsg('Please select at least one item to assign');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg('');

      const batch = localStore.batch();
      selectedIds.forEach(id => {
        batch.update('inventory', id, { warehouseId: assigningWarehouse.id });
      });

      await batch.commit();
      
      triggerNotification(`Successfully assigned ${selectedIds.length} items to "${assigningWarehouse.name}"`);
      setAssigningWarehouse(null);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to assign items');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Unassign single item
  const handleUnassignItem = async (itemId: string, itemName: string) => {
    try {
      await onUpdateItem(itemId, { warehouseId: '' });
      triggerNotification(`Removed "${itemName}" from warehouse`);
    } catch (err: any) {
      triggerNotification('', err.message || 'Failed to unassign item');
    }
  };

  // Toggle select all in assignment modal
  const handleSelectAllFiltered = (filteredAvailableItems: InventoryItem[]) => {
    const allSelected = filteredAvailableItems.every(item => selectedItemIds[item.id]);
    const updated = { ...selectedItemIds };
    filteredAvailableItems.forEach(item => {
      updated[item.id] = !allSelected;
    });
    setSelectedItemIds(updated);
  };

  // Export PDF Report for Warehouse
  const handleExportPDF = async (warehouseName: string, warehouseItems: InventoryItem[]) => {
    const logoBase64 = await getSystemLogoBase64();
    const docPdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const primaryColor = [24, 24, 27]; // zinc-900
    const secondaryColor = [113, 113, 122]; // zinc-500
    const lightBg = [244, 244, 245]; // zinc-100

    let y = 15;

    const drawHeader = (pageNum: number) => {
      drawBrandedHeader(docPdf, logoBase64, primaryColor, secondaryColor, pageNum);
    };

    drawHeader(1);
    y = 35;

    // Report Title
    docPdf.setFont('Helvetica', 'bold');
    docPdf.setFontSize(12);
    docPdf.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    const wrappedTitle = docPdf.splitTextToSize(`WAREHOUSE INVENTORY: ${warehouseName.toUpperCase()}`, 180);
    wrappedTitle.forEach((line: string) => {
      docPdf.text(line, 15, y);
      y += 5.5;
    });

    docPdf.setFont('Helvetica', 'normal');
    docPdf.setFontSize(9);
    docPdf.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    const totalUnits = warehouseItems.reduce((sum, item) => sum + (item.quantityTotal || 0), 0);
    const subtitleText = `Total Profiles: ${warehouseItems.length}    |    Total Assets: ${totalUnits} Units`;
    const wrappedSubtitle = docPdf.splitTextToSize(subtitleText, 180);
    wrappedSubtitle.forEach((line: string) => {
      docPdf.text(line, 15, y);
      y += 4.5;
    });
    y += 4;

    // Table Header
    const drawTableHeader = (currentY: number) => {
      docPdf.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
      docPdf.rect(15, currentY, 180, 8, 'F');

      docPdf.setFont('Helvetica', 'bold');
      docPdf.setFontSize(8);
      docPdf.setTextColor(63, 63, 70); // zinc-700

      docPdf.text('PROPERTY NAME / DESCRIPTION', 17, currentY + 5.5);
      docPdf.text('SKU / UID', 82, currentY + 5.5);
      docPdf.text('CLASS', 115, currentY + 5.5);
      docPdf.text('CATEGORY', 140, currentY + 5.5);
      docPdf.text('EST. LIFESPAN', 165, currentY + 5.5);
      docPdf.text('TOTAL', 193, currentY + 5.5, { align: 'right' });

      docPdf.setDrawColor(200, 200, 200);
      docPdf.line(15, currentY + 8, 195, currentY + 8);
    };

    drawTableHeader(y);
    y += 8;

    // Draw Items
    let currentPage = 1;
    warehouseItems.forEach((item, idx) => {
      const wrappedName = docPdf.splitTextToSize(item.name, 63);
      const wrappedSku = docPdf.splitTextToSize(item.sku || '-', 25);
      const wrappedClass = docPdf.splitTextToSize('Rental', 20);
      const wrappedCategory = docPdf.splitTextToSize(item.category || '-', 22);
      const wrappedLifespan = docPdf.splitTextToSize(item.estimatedLifespan || '-', 20);
      
      const maxLines = Math.max(
        wrappedName.length,
        wrappedSku.length,
        wrappedClass.length,
        wrappedCategory.length,
        wrappedLifespan.length
      );

      const itemRowsHeight = maxLines * 3.5 + 4;
      const rowHeight = Math.max(itemRowsHeight, 10);

      // Page limit check
      if (y + rowHeight > 255) {
        docPdf.addPage();
        currentPage++;
        drawHeader(currentPage);
        y = 32;
        drawTableHeader(y);
        y += 8;
      }

      if (idx % 2 === 1) {
        docPdf.setFillColor(250, 250, 250);
        docPdf.rect(15, y, 180, rowHeight, 'F');
      }

      docPdf.setFont('Helvetica', 'bold');
      docPdf.setTextColor(24, 24, 27); // zinc-900
      
      let textY = y + 4;
      wrappedName.forEach((line: string) => {
        let size = 8;
        docPdf.setFontSize(size);
        while (docPdf.getTextWidth(line) > 63 && size > 5.5) {
          size -= 0.5;
          docPdf.setFontSize(size);
        }
        docPdf.text(line, 17, textY);
        textY += 3.5;
      });

      docPdf.setFont('Helvetica', 'normal');
      docPdf.setTextColor(39, 39, 42); // zinc-800

      // SKU
      let skuY = y + 5.5;
      wrappedSku.forEach((line: string) => {
        let size = 8;
        docPdf.setFontSize(size);
        while (docPdf.getTextWidth(line) > 25 && size > 5) {
          size -= 0.5;
          docPdf.setFontSize(size);
        }
        docPdf.text(line, 82, skuY);
        skuY += 3.5;
      });

      // Class
      let classY = y + 5.5;
      wrappedClass.forEach((line: string) => {
        let size = 8;
        docPdf.setFontSize(size);
        while (docPdf.getTextWidth(line) > 20 && size > 5) {
          size -= 0.5;
          docPdf.setFontSize(size);
        }
        docPdf.text(line, 115, classY);
        classY += 3.5;
      });

      // Category
      let catY = y + 5.5;
      wrappedCategory.forEach((line: string) => {
        let size = 8;
        docPdf.setFontSize(size);
        while (docPdf.getTextWidth(line) > 22 && size > 5) {
          size -= 0.5;
          docPdf.setFontSize(size);
        }
        docPdf.text(line, 140, catY);
        catY += 3.5;
      });

      // Estimated Lifespan
      let lifeY = y + 5.5;
      wrappedLifespan.forEach((line: string) => {
        let size = 8;
        docPdf.setFontSize(size);
        while (docPdf.getTextWidth(line) > 20 && size > 5) {
          size -= 0.5;
          docPdf.setFontSize(size);
        }
        docPdf.text(line, 165, lifeY);
        lifeY += 3.5;
      });

      // Total quantity registered
      const colY = y + 5.5;
      docPdf.setFont('Helvetica', 'bold');
      docPdf.text((item.quantityTotal || 0).toString(), 193, colY, { align: 'right' });

      // Underline row
      docPdf.setDrawColor(244, 244, 245);
      docPdf.line(15, y + rowHeight, 195, y + rowHeight);

      y += rowHeight;
    });

    // Check if signatures block fits
    if (y + 45 > 275) {
      docPdf.addPage();
      currentPage++;
      drawHeader(currentPage);
      y = 35;
    } else {
      y += 10;
    }

    // Signatures Block
    docPdf.setDrawColor(228, 228, 231);
    docPdf.setFillColor(250, 250, 250);
    docPdf.rect(15, y, 180, 32, 'F');
    docPdf.rect(15, y, 180, 32, 'S');

    docPdf.setFont('Helvetica', 'bold');
    docPdf.setFontSize(8);
    docPdf.setTextColor(63, 63, 70);

    docPdf.text('PREPARED / CHECKED BY:', 20, y + 6);
    docPdf.line(20, y + 18, 68, y + 18);
    docPdf.setFont('Helvetica', 'normal');
    docPdf.setFontSize(7.5);
    docPdf.text('Warehouse Custodian (Signature Over Printed Name)', 20, y + 22);
    docPdf.text('Date: ________________________', 20, y + 26);

    docPdf.setFont('Helvetica', 'bold');
    docPdf.setFontSize(8);
    docPdf.text('VERIFIED BY:', 76, y + 6);
    docPdf.line(76, y + 18, 124, y + 18);
    docPdf.setFont('Helvetica', 'normal');
    docPdf.setFontSize(7.5);
    docPdf.text('Logistics Manager', 76, y + 22);
    docPdf.text('Date: ________________________', 76, y + 26);

    docPdf.setFont('Helvetica', 'bold');
    docPdf.setFontSize(8);
    docPdf.text('APPROVED BY:', 132, y + 6);
    docPdf.line(132, y + 18, 180, y + 18);
    docPdf.setFont('Helvetica', 'normal');
    docPdf.setFontSize(7.5);
    docPdf.text('Hotel General Director', 132, y + 22);
    docPdf.text('Date: ________________________', 132, y + 26);

    const totalPages = docPdf.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      docPdf.setPage(i);
      docPdf.setFont('Helvetica', 'normal');
      docPdf.setFontSize(7.5);
      docPdf.setTextColor(113, 113, 122);
      docPdf.text('Madigun Property, Asset & Warehouse Logistics System', 15, 288);
      docPdf.text(`Page ${i} of ${totalPages}`, 195, 288, { align: 'right' });
    }

    applyCenterWatermarkToAllPages(docPdf, logoBase64);

    const safeWHName = warehouseName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    docPdf.save(`madigun_warehouse_${safeWHName}_inventory.pdf`);
  };

  // Grouping items by warehouse mapping
  const unassignedItems = items.filter(item => !item.warehouseId);
  
  const getWarehouseItems = (warehouseId: string) => {
    return items.filter(item => item.warehouseId === warehouseId);
  };

  const toggleWarehouseExpand = (id: string) => {
    setExpandedWarehouses(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Filtering warehouses based on search
  const filteredWarehouses = warehouses.filter(wh => {
    const q = searchQuery.toLowerCase();
    const matchWhName = wh.name.toLowerCase().includes(q);
    
    // Check if any item in this warehouse matches search
    const whItems = getWarehouseItems(wh.id);
    const matchItem = whItems.some(item => 
      item.name.toLowerCase().includes(q) || 
      item.sku.toLowerCase().includes(q) || 
      item.category.toLowerCase().includes(q)
    );

    return matchWhName || matchItem;
  });

  // Calculate items available for assignment based on modal search and filter
  const availableItemsForAssignment = unassignedItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(assignmentSearchQuery.toLowerCase()) ||
                          item.sku.toLowerCase().includes(assignmentSearchQuery.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="space-y-8">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-200 pb-6">
        <div>
          <h1 className="text-xl font-black font-display text-zinc-900 uppercase tracking-wider">Warehouse Management</h1>
        </div>
        {currentUser?.role !== 'Front Desk' && (
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="inline-flex items-center justify-center px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-white bg-zinc-900 hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5 mr-2" />
            Create Warehouse
          </button>
        )}
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && !assigningWarehouse && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-red-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Create Warehouse Form overlay panel */}
      <AnimatePresence>
        {showCreateForm && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-zinc-50 border border-zinc-200 p-6 overflow-hidden"
          >
            <h3 className="text-xs font-black uppercase tracking-widest text-zinc-900 mb-4">Register New Warehouse Entity</h3>
            <form onSubmit={handleCreateWarehouse} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Warehouse Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Central Warehouse Terminal A"
                  value={newWarehouseName}
                  onChange={(e) => setNewWarehouseName(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-200 text-xs font-semibold focus:outline-none focus:border-zinc-900 bg-white text-zinc-850"
                />
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-zinc-600 bg-zinc-200 hover:bg-zinc-300 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-white bg-zinc-900 hover:bg-zinc-850 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Save Warehouse'}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Search Filter */}
      <div className="flex flex-col md:flex-row gap-4 items-center bg-white p-4 border border-zinc-200">
        <div className="relative w-full md:flex-1">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-zinc-400">
            <Search className="h-4 w-4" />
          </span>
          <input
            type="text"
            placeholder="Search warehouses, items, SKUs, or category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-zinc-200 text-xs font-semibold uppercase tracking-wider bg-zinc-50 focus:bg-white focus:outline-none focus:border-zinc-900 transition-all text-zinc-800 placeholder-zinc-400"
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 text-xs uppercase tracking-wider font-bold text-zinc-500 bg-zinc-50 px-4 py-2 border border-zinc-200 shrink-0 w-full md:w-auto">
          <div>
            Warehouses: <span className="text-zinc-900 font-mono font-black">{filteredWarehouses.length}</span>
          </div>
          <div>
            Unassigned Pool: <span className="text-zinc-900 font-mono font-black">{unassignedItems.length} items</span>
          </div>
        </div>
      </div>

      {/* Unassigned Pool Quick Overview Box */}
      {unassignedItems.length > 0 && !searchQuery && (
        <div className="bg-amber-50/40 border border-amber-200 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <PackageOpen className="h-4 w-4 text-amber-600 shrink-0" />
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-amber-800">Unassigned Rental Assets Detected ({unassignedItems.length} profiles)</p>
              <p className="text-[10px] text-amber-700 uppercase tracking-widest mt-0.5">These items have no central warehouse assignment and will not display under any warehouse location rental lists.</p>
            </div>
          </div>
          <span className="text-[10px] font-bold text-amber-800 bg-amber-100/50 px-2.5 py-1 uppercase border border-amber-200/50 shrink-0">
            Select "Assign Items" on any Warehouse to map them.
          </span>
        </div>
      )}

      {/* Warehouses breakdown list */}
      {filteredWarehouses.length === 0 ? (
        <div className="bg-white border border-zinc-200 p-12 text-center text-zinc-400">
          <Boxes className="h-8 w-8 text-zinc-300 mx-auto mb-3" />
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">No Warehouses Registered</p>
          <p className="text-[11px] text-zinc-400 mt-1 uppercase tracking-wider">
            {searchQuery ? 'Try adjusting your search filters.' : 'Admins can create a central warehouse using the "Create Warehouse" button above.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredWarehouses.map((wh) => {
            const whItems = getWarehouseItems(wh.id);
            const isExpanded = expandedWarehouses[wh.id] !== false; // Default expanded
            
            const rentableCount = whItems.length;

            return (
              <div 
                key={wh.id} 
                className="bg-white border border-zinc-200 overflow-hidden"
              >
                {/* Warehouse Header Bar */}
                <div 
                  onClick={() => toggleWarehouseExpand(wh.id)}
                  className="px-4 sm:px-6 py-4 bg-zinc-50 border-b border-zinc-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 cursor-pointer hover:bg-zinc-100/70 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <MapPin className="h-4 w-4 text-zinc-500 shrink-0" />
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-wider text-zinc-900 flex items-center gap-2">
                        {wh.name}
                      </h3>
                      <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-semibold mt-0.5 max-w-xl line-clamp-1">
                        {whItems.length} Profiles Assigned
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 self-stretch sm:self-auto justify-between border-t sm:border-t-0 border-zinc-200 pt-3 sm:pt-0">
                    <div className="flex gap-2">
                      {rentableCount > 0 && (
                        <span className="inline-flex items-center px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider border bg-white text-zinc-600 border-zinc-200">
                          📦 {rentableCount} Rentable
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      {currentUser?.role !== 'Front Desk' && (
                        <>
                          <button
                            onClick={() => handleOpenAssignModal(wh)}
                            className="inline-flex items-center px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider border border-zinc-200 bg-white hover:bg-zinc-900 hover:text-white hover:border-zinc-900 text-zinc-700 transition-colors cursor-pointer rounded-sm"
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Assign Items
                          </button>
                          
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingWarehouse(wh);
                            }}
                            className="inline-flex items-center p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors cursor-pointer rounded-sm"
                            title="Delete Warehouse Location"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                      
                      <button
                        onClick={() => handleExportPDF(wh.name, whItems)}
                        disabled={whItems.length === 0}
                        className="inline-flex items-center px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider border border-zinc-200 bg-white hover:bg-zinc-900 hover:text-white hover:border-zinc-900 text-zinc-700 transition-colors cursor-pointer rounded-sm shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Download PDF Rental List"
                      >
                        <Printer className="h-3 w-3 mr-1" />
                        Export PDF
                      </button>
                    </div>
                    
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-zinc-400 shrink-0" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-zinc-400 shrink-0" />
                    )}
                  </div>
                </div>

                {/* Warehouse Assigned Items Table */}
                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="p-6 overflow-x-auto">
                        {whItems.length === 0 ? (
                          <div className="text-center py-8 text-zinc-400 border border-dashed border-zinc-200">
                            <PackageOpen className="h-6 w-6 mx-auto text-zinc-300 mb-2" />
                            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">No items mapped to this warehouse</p>
                            {currentUser?.role !== 'Front Desk' && (
                              <button
                                onClick={() => handleOpenAssignModal(wh)}
                                className="mt-2 text-[9px] font-black uppercase text-zinc-900 hover:underline cursor-pointer"
                              >
                                Assign Items Now &rarr;
                              </button>
                            )}
                          </div>
                        ) : (
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="border-b border-zinc-200 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                                <th className="py-2.5 px-2">Property Name / Profile</th>
                                <th className="py-2.5 px-2">SKU / UID</th>
                                <th className="py-2.5 px-2">Category</th>
                                <th className="py-2.5 px-2 text-right">Value (₱)</th>
                                <th className="py-2.5 px-2 text-center">Est. Lifespan</th>
                                <th className="py-2.5 px-2 text-center">Total Registered</th>
                                {currentUser?.role !== 'Front Desk' && <th className="py-2.5 px-2 text-right">Actions</th>}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100">
                              {whItems.map((item) => (
                                <tr key={item.id} className="hover:bg-zinc-50/40 transition-colors">
                                  <td className="py-3 px-2">
                                    <div className="font-bold text-zinc-900 uppercase tracking-tight">{item.name}</div>
                                  </td>
                                  <td className="py-3 px-2 font-mono text-[11px] text-zinc-500 uppercase">
                                    {item.sku}
                                  </td>
                                  <td className="py-3 px-2 text-zinc-600 font-semibold uppercase text-[11px]">
                                    {item.category}
                                  </td>
                                  <td className="py-3 px-2 text-right font-mono font-bold text-zinc-900">
                                    {item.price ? `₱${Number(item.price).toLocaleString()}` : '₱0'}
                                  </td>
                                  <td className="py-3 px-2 text-center font-semibold text-zinc-600 uppercase text-[10px]">
                                    {item.estimatedLifespan || 'N/A'}
                                  </td>
                                  <td className="py-3 px-2 text-center font-mono text-zinc-800 font-bold">
                                    {item.quantityTotal} units
                                  </td>
                                  {currentUser?.role !== 'Front Desk' && (
                                    <td className="py-3 px-2 text-right">
                                      <div className="flex items-center justify-end gap-1.5">
                                        <button
                                          onClick={() => handleUnassignItem(item.id, item.name)}
                                          className="inline-flex items-center px-2 py-1 text-[9px] font-bold uppercase tracking-wider border border-zinc-200 hover:border-zinc-400 text-zinc-600 hover:text-zinc-900 transition-colors bg-white hover:bg-zinc-50 cursor-pointer rounded-sm"
                                          title="Remove item from warehouse and place in unassigned pool"
                                        >
                                          <X className="h-3 w-3 mr-1" />
                                          Unassign
                                        </button>

                                        <button
                                          onClick={() => setDeletingItem({ id: item.id, name: item.name })}
                                          className="inline-flex items-center p-1 text-red-500 hover:text-red-700 hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors cursor-pointer rounded-sm"
                                          title="Permanently delete asset profile"
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </button>
                                      </div>
                                    </td>
                                  )}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}

      {/* Assign Available Items Dialog Modal Overlay */}
      <AnimatePresence>
        {assigningWarehouse && (
          <div className="fixed inset-0 z-50 bg-zinc-900/30 backdrop-blur-[1px] flex items-center justify-center p-4">
            <div className="absolute inset-0 cursor-default" onClick={() => setAssigningWarehouse(null)}></div>
            
            <motion.div
              initial={{ scale: 0.98, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.98, opacity: 0 }}
              className="bg-white w-full max-w-2xl border border-zinc-200 overflow-hidden flex flex-col relative z-10 max-h-[85vh]"
            >
              <div className="px-6 py-4 border-b border-zinc-200 flex justify-between items-center bg-zinc-50">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-zinc-900">Map Items to Warehouse</h3>
                  <p className="text-[9px] text-zinc-400 uppercase tracking-wider font-semibold mt-0.5">Assigning assets to: <span className="text-zinc-800 font-bold">{assigningWarehouse.name}</span></p>
                </div>
                <button
                  onClick={() => setAssigningWarehouse(null)}
                  className="text-zinc-400 hover:text-zinc-900 p-1.5 transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleAssignItemsSubmit} className="flex flex-col overflow-hidden">
                {/* Search Inside Modal */}
                <div className="p-4 border-b border-zinc-150 bg-zinc-50/50 flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-zinc-400">
                      <Search className="h-3.5 w-3.5" />
                    </span>
                    <input
                      type="text"
                      placeholder="Filter by unassigned asset name or sku..."
                      value={assignmentSearchQuery}
                      onChange={(e) => setAssignmentSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 border border-zinc-200 text-xs font-semibold uppercase tracking-wider bg-white focus:outline-none focus:border-zinc-900 transition-all text-zinc-800 placeholder-zinc-400"
                    />
                  </div>
                </div>

                {errorMsg && (
                  <div className="bg-red-50 border-b border-red-200 text-red-800 p-3 text-[10px] font-bold uppercase tracking-wider">
                    {errorMsg}
                  </div>
                )}

                {/* Available Items List */}
                <div className="overflow-y-auto p-6 flex-1 min-h-[250px]">
                  {availableItemsForAssignment.length === 0 ? (
                    <div className="text-center py-12 text-zinc-400">
                      <PackageOpen className="h-8 w-8 text-zinc-300 mx-auto mb-2" />
                      <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">No matching unassigned items found</p>
                      <p className="text-[10px] text-zinc-400 mt-1 uppercase tracking-wider">All active assets may already be assigned, or adjust search criteria.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center pb-2 border-b border-zinc-150">
                        <button
                          type="button"
                          onClick={() => handleSelectAllFiltered(availableItemsForAssignment)}
                          className="text-[10px] font-black uppercase text-zinc-900 hover:underline cursor-pointer"
                        >
                          {availableItemsForAssignment.every(item => selectedItemIds[item.id]) ? 'Deselect All' : 'Select All Filtered'}
                        </button>
                        <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">
                          {Object.values(selectedItemIds).filter(Boolean).length} of {availableItemsForAssignment.length} Selected
                        </span>
                      </div>

                      <div className="divide-y divide-zinc-100 max-h-[300px] overflow-y-auto pr-2">
                        {availableItemsForAssignment.map((item) => {
                          const isChecked = !!selectedItemIds[item.id];
                          return (
                            <label
                              key={item.id}
                              className={`flex items-center gap-4 py-3 px-2 cursor-pointer transition-colors ${
                                isChecked ? 'bg-zinc-50/75' : 'hover:bg-zinc-50/40'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => setSelectedItemIds(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                                className="h-3.5 w-3.5 rounded-none border-zinc-300 text-zinc-900 focus:ring-zinc-900 cursor-pointer"
                              />
                              <div className="flex-1">
                                <div className="flex justify-between">
                                  <span className="text-xs font-bold text-zinc-900 uppercase tracking-tight">{item.name}</span>
                                  <span className="font-mono text-[10px] text-zinc-400 uppercase">{item.sku}</span>
                                </div>
                                <div className="flex items-center gap-2 mt-0.5 text-[9px] font-bold uppercase tracking-widest text-zinc-500">
                                  <span>{item.category}</span>
                                  <span>&bull;</span>
                                  <span className="font-mono">Qty: {item.quantityTotal} units</span>
                                  <span>&bull;</span>
                                  <span className="font-mono">Value: ₱{Number(item.price || 0).toLocaleString()}</span>
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Actions */}
                <div className="flex gap-3 p-4 border-t border-zinc-200 bg-zinc-50 justify-end">
                  <button
                    type="button"
                    onClick={() => setAssigningWarehouse(null)}
                    className="px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-zinc-600 bg-white hover:bg-zinc-100 border border-zinc-200 transition-colors cursor-pointer text-center"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || Object.values(selectedItemIds).filter(Boolean).length === 0}
                    className="px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-white bg-zinc-900 hover:bg-zinc-850 transition-colors cursor-pointer text-center inline-flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? 'Mapping Items...' : `Map Selected Assets`}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Warehouse Confirmation Modal */}
      <AnimatePresence>
        {deletingWarehouse && (
          <div className="fixed inset-0 bg-zinc-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-zinc-200 max-w-md w-full p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center gap-3 text-red-650">
                <div className="p-2 bg-red-50 border border-red-200">
                  <Trash2 className="h-5 w-5 text-red-650" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-zinc-900">
                    Delete Warehouse Location
                  </h3>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wide">
                    {deletingWarehouse.name}
                  </p>
                </div>
              </div>

              <p className="text-xs text-zinc-600 leading-relaxed">
                Are you sure you want to delete <strong className="text-zinc-900">{deletingWarehouse.name}</strong>? All assets currently assigned to this warehouse will be returned to the <strong className="text-zinc-900">Unassigned / General</strong> pool.
              </p>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDeletingWarehouse(null)}
                  className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-zinc-600 bg-white border border-zinc-200 hover:bg-zinc-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={async () => {
                    if (!deletingWarehouse) return;
                    try {
                      setIsSubmitting(true);
                      const warehouseId = deletingWarehouse.id;
                      const warehouseName = deletingWarehouse.name;
                      
                      // 1. Unassign all items belonging to this warehouse
                      const assignedItems = items.filter(item => item.warehouseId === warehouseId);
                      if (assignedItems.length > 0) {
                        const batch = localStore.batch();
                        assignedItems.forEach(item => {
                          batch.update('inventory', item.id, { warehouseId: '' });
                        });
                        await batch.commit();
                      }

                      // 2. Delete warehouse document
                      await localStore.deleteItem('warehouses', warehouseId);
                      triggerNotification(`Successfully deleted "${warehouseName}" and unassigned ${assignedItems.length} items.`);
                      setDeletingWarehouse(null);
                    } catch (err: any) {
                      triggerNotification('', err.message || 'Failed to delete warehouse');
                    } finally {
                      setIsSubmitting(false);
                    }
                  }}
                  className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-white bg-red-650 hover:bg-red-700 disabled:opacity-50 cursor-pointer flex items-center shadow-md"
                >
                  {isSubmitting ? 'Deleting...' : 'Confirm & Delete Warehouse'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Item Profile Confirmation Modal */}
      <AnimatePresence>
        {deletingItem && (
          <div className="fixed inset-0 bg-zinc-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-zinc-200 max-w-md w-full p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center gap-3 text-red-650">
                <div className="p-2 bg-red-50 border border-red-200">
                  <Trash2 className="h-5 w-5 text-red-650" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-zinc-900">
                    Delete Asset Profile
                  </h3>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wide">
                    {deletingItem.name}
                  </p>
                </div>
              </div>

              <p className="text-xs text-zinc-600 leading-relaxed">
                Are you sure you want to permanently delete <strong className="text-zinc-900">{deletingItem.name}</strong> from the inventory system?
              </p>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDeletingItem(null)}
                  className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-zinc-600 bg-white border border-zinc-200 hover:bg-zinc-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={async () => {
                    if (!deletingItem) return;
                    try {
                      setIsSubmitting(true);
                      if (onDeleteItem) {
                        await onDeleteItem(deletingItem.id);
                      } else {
                        await localStore.deleteItem('inventory', deletingItem.id);
                      }
                      triggerNotification(`Permanently deleted asset "${deletingItem.name}"`);
                      setDeletingItem(null);
                    } catch (err: any) {
                      triggerNotification('', err.message || 'Failed to delete asset profile');
                    } finally {
                      setIsSubmitting(false);
                    }
                  }}
                  className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-white bg-red-650 hover:bg-red-700 disabled:opacity-50 cursor-pointer flex items-center shadow-md"
                >
                  {isSubmitting ? 'Deleting...' : 'Confirm & Delete Asset'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
