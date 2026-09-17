import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  BarChart3, 
  Download, 
  FileSpreadsheet, 
  Printer, 
  Search, 
  Layers, 
  Warehouse as WarehouseIcon, 
  ShieldCheck, 
  TrendingUp, 
  AlertCircle, 
  Package, 
  CheckCircle2, 
  ArrowUpDown,
  Filter
} from 'lucide-react';
import { InventoryItem, UserSession, Warehouse, ItemCategory } from '../types';
import { generateOwnedPropertiesSummaryPDF } from '../utils/pdfHelper';
import { getItemValuationAndUnits, isVehicleItemOrCategory } from '../utils';

interface OwnedPropertiesSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: InventoryItem[];
  warehouses: Warehouse[];
  categories: ItemCategory[];
  currentUser?: UserSession | null;
}

export default function OwnedPropertiesSummaryModal({
  isOpen,
  onClose,
  items,
  warehouses,
  categories,
  currentUser
}: OwnedPropertiesSummaryModalProps) {
  const [activeTab, setActiveTab] = useState<'categories' | 'register' | 'insights'>('categories');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedWarehouse, setSelectedWarehouse] = useState('All');
  const [selectedCondition, setSelectedCondition] = useState('All');
  const [sortBy, setSortBy] = useState<'value_desc' | 'value_asc' | 'qty_desc' | 'name_asc'>('value_desc');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Filter out retired and decommissioned items and halls (focus purely on active rental properties)
  const activeRentalProperties = useMemo(() => {
    return items.filter(
      item => item.status !== 'Retired' &&
              item.status !== 'Decommissioned' &&
              item.category !== 'Rental Halls & Event Venues' &&
              !item.sku?.toLowerCase().startsWith('hall-')
    );
  }, [items]);

  // Physical properties with measurable physical quantities or vehicles (exclude corkage & service permits)
  const physicalProperties = useMemo(() => {
    return activeRentalProperties.filter(
      item => isVehicleItemOrCategory(item) || (!item.isNoQuantity && item.category !== 'Corkage & Service Permits')
    );
  }, [activeRentalProperties]);

  const permitCount = useMemo(() => {
    return activeRentalProperties.filter(
      item => !isVehicleItemOrCategory(item) && (item.isNoQuantity || item.category === 'Corkage & Service Permits')
    ).length;
  }, [activeRentalProperties]);

  const getWarehouseName = (warehouseId?: string) => {
    if (!warehouseId) return 'Unassigned Depot';
    const wh = warehouses.find(w => w.id === warehouseId);
    return wh ? wh.name : 'Unassigned Depot';
  };

  // KPI Calculations across all owned physical properties and vehicles
  const summaryMetrics = useMemo(() => {
    const totalProfiles = activeRentalProperties.length;
    const physicalProfiles = physicalProperties.length;
    let totalPhysicalUnits = 0;
    let totalAvailableUnits = 0;
    let totalRentedUnits = 0;
    let totalValuation = 0;
    let inStockValuation = 0;
    let rentedExposureValuation = 0;
    let potentialRentalYield = 0;

    physicalProperties.forEach(i => {
      const stats = getItemValuationAndUnits(i);
      totalPhysicalUnits += stats.totalUnits;
      totalAvailableUnits += stats.availableUnits;
      totalRentedUnits += stats.rentedUnits;
      totalValuation += stats.totalValuation;
      inStockValuation += stats.inStockValuation;
      rentedExposureValuation += stats.rentedValuation;
      potentialRentalYield += stats.rentalYield;
    });

    const deploymentRate = totalPhysicalUnits > 0 
      ? Math.round((totalRentedUnits / totalPhysicalUnits) * 100) 
      : 0;

    return {
      totalProfiles,
      physicalProfiles,
      totalPhysicalUnits,
      totalAvailableUnits,
      totalRentedUnits,
      totalValuation,
      inStockValuation,
      rentedExposureValuation,
      potentialRentalYield,
      deploymentRate
    };
  }, [activeRentalProperties, physicalProperties]);

  // Breakdown by Category
  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, {
      category: string;
      profiles: number;
      totalUnits: number;
      availableUnits: number;
      rentedUnits: number;
      totalValue: number;
      rentalYield: number;
    }>();

    physicalProperties.forEach(item => {
      const cat = item.category || 'Uncategorized';
      const curr = map.get(cat) || {
        category: cat,
        profiles: 0,
        totalUnits: 0,
        availableUnits: 0,
        rentedUnits: 0,
        totalValue: 0,
        rentalYield: 0
      };

      const stats = getItemValuationAndUnits(item);

      map.set(cat, {
        category: cat,
        profiles: curr.profiles + 1,
        totalUnits: curr.totalUnits + stats.totalUnits,
        availableUnits: curr.availableUnits + stats.availableUnits,
        rentedUnits: curr.rentedUnits + stats.rentedUnits,
        totalValue: curr.totalValue + stats.totalValuation,
        rentalYield: curr.rentalYield + stats.rentalYield
      });
    });

    return Array.from(map.values()).sort((a, b) => b.totalValue - a.totalValue);
  }, [physicalProperties]);

  // Breakdown by Warehouse Location
  const warehouseBreakdown = useMemo(() => {
    const map = new Map<string, {
      warehouseId: string;
      name: string;
      profiles: number;
      totalUnits: number;
      availableUnits: number;
      rentedUnits: number;
      totalValue: number;
    }>();

    physicalProperties.forEach(item => {
      const whId = item.warehouseId || 'unassigned';
      const whName = getWarehouseName(item.warehouseId);
      const curr = map.get(whId) || {
        warehouseId: whId,
        name: whName,
        profiles: 0,
        totalUnits: 0,
        availableUnits: 0,
        rentedUnits: 0,
        totalValue: 0
      };

      const stats = getItemValuationAndUnits(item);

      map.set(whId, {
        warehouseId: whId,
        name: whName,
        profiles: curr.profiles + 1,
        totalUnits: curr.totalUnits + stats.totalUnits,
        availableUnits: curr.availableUnits + stats.availableUnits,
        rentedUnits: curr.rentedUnits + stats.rentedUnits,
        totalValue: curr.totalValue + stats.totalValuation
      });
    });

    return Array.from(map.values()).sort((a, b) => b.totalValue - a.totalValue);
  }, [physicalProperties, warehouses]);

  // Breakdown by Asset Condition
  const conditionBreakdown = useMemo(() => {
    const conditions = ['Excellent', 'Good', 'Fair', 'Poor', 'Under Repair'];
    return conditions.map(cond => {
      const matched = physicalProperties.filter(i => (i.assetCondition || 'Good') === cond);
      let count = 0;
      let value = 0;
      matched.forEach(i => {
        const stats = getItemValuationAndUnits(i);
        count += stats.totalUnits;
        value += stats.totalValuation;
      });
      return {
        condition: cond,
        itemsCount: matched.length,
        unitCount: count,
        totalValue: value
      };
    });
  }, [physicalProperties]);

  // Filtered & Sorted Itemized Registry
  const filteredItems = useMemo(() => {
    return activeRentalProperties.filter(item => {
      if (selectedCategory !== 'All' && item.category !== selectedCategory) return false;
      if (selectedWarehouse !== 'All') {
        const whId = item.warehouseId || 'unassigned';
        if (whId !== selectedWarehouse) return false;
      }
      if (selectedCondition !== 'All') {
        const cond = item.assetCondition || 'Good';
        if (cond !== selectedCondition) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = item.name.toLowerCase().includes(q);
        const matchSku = item.sku?.toLowerCase().includes(q);
        const matchCat = item.category?.toLowerCase().includes(q);
        const matchWh = getWarehouseName(item.warehouseId).toLowerCase().includes(q);
        if (!matchName && !matchSku && !matchCat && !matchWh) return false;
      }
      return true;
    }).sort((a, b) => {
      const statsA = getItemValuationAndUnits(a);
      const statsB = getItemValuationAndUnits(b);
      if (sortBy === 'value_desc') return statsB.totalValuation - statsA.totalValuation;
      if (sortBy === 'value_asc') return statsA.totalValuation - statsB.totalValuation;
      if (sortBy === 'qty_desc') return statsB.totalUnits - statsA.totalUnits;
      if (sortBy === 'name_asc') return a.name.localeCompare(b.name);
      return 0;
    });
  }, [activeRentalProperties, selectedCategory, selectedWarehouse, selectedCondition, searchQuery, sortBy]);

  // Filtered totals
  const filteredTotals = useMemo(() => {
    const physical = filteredItems.filter(i => isVehicleItemOrCategory(i) || (!i.isNoQuantity && i.category !== 'Corkage & Service Permits'));
    let units = 0;
    let avail = 0;
    let rent = 0;
    let val = 0;
    let yld = 0;
    physical.forEach(i => {
      const stats = getItemValuationAndUnits(i);
      units += stats.totalUnits;
      avail += stats.availableUnits;
      rent += stats.rentedUnits;
      val += stats.totalValuation;
      yld += stats.rentalYield;
    });
    return { count: filteredItems.length, units, avail, rent, val, yld };
  }, [filteredItems]);

  // Export CSV Action
  const handleExportCSV = () => {
    const headers = [
      'SKU',
      'Property Name',
      'Category',
      'Warehouse Location',
      'Asset Condition',
      'Unit Replacement Price (PHP)',
      'Total Owned Units',
      'Available In Stock',
      'Currently Rented',
      'Total Property Valuation (PHP)',
      'Rental Fee (PHP)',
      'Gross Rental Yield (PHP)',
      'Status'
    ];

    const rows = activeRentalProperties.map(item => {
      const isVeh = isVehicleItemOrCategory(item);
      const isPermit = !isVeh && (item.isNoQuantity || item.category === 'Corkage & Service Permits');
      const stats = getItemValuationAndUnits(item);

      const qTot = isPermit ? 'No Qty Limit' : stats.totalUnits;
      const qAvail = isPermit ? 'Unlimited' : stats.availableUnits;
      const qRent = isPermit ? '-' : stats.rentedUnits;
      const unitVal = stats.unitPrice;
      const totalVal = isPermit ? 0 : stats.totalValuation;
      const rentPrice = Number(item.rentalPrice) || 0;
      const rentYield = stats.rentalYield;

      return [
        `"${item.sku || ''}"`,
        `"${(item.name || '').replace(/"/g, '""')}"`,
        `"${(item.category || '').replace(/"/g, '""')}"`,
        `"${getWarehouseName(item.warehouseId).replace(/"/g, '""')}"`,
        `"${item.assetCondition || 'Good'}"`,
        unitVal,
        qTot,
        qAvail,
        qRent,
        totalVal,
        rentPrice,
        rentYield,
        `"${item.status}"`
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const dateStamp = new Date().toISOString().split('T')[0];
    link.setAttribute('download', `Madigun_Owned_Rental_Properties_Summary_${dateStamp}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Generate PDF Report Action
  const handleGeneratePDF = async () => {
    try {
      setIsGeneratingPdf(true);
      const actor = currentUser?.fullName || currentUser?.username || 'Property Custodian';
      await generateOwnedPropertiesSummaryPDF(activeRentalProperties, warehouses, actor);
    } catch (err) {
      console.error('Failed to generate summary PDF:', err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-zinc-950/60 backdrop-blur-xs overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ duration: 0.2 }}
          className="bg-white border border-zinc-300 w-full max-w-6xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
        >
          {/* Top Bar Header */}
          <div className="p-4 sm:p-5 border-b border-zinc-200 bg-zinc-50/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shrink-0">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-widest bg-zinc-900 text-white">
                  Asset Valuation Register
                </span>
                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wide">
                  Madigun Property & Inventory Logistics
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-black font-display text-zinc-900 uppercase tracking-wide mt-1">
                Overall Owned Properties Summary
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                Consolidated count, replacement asset valuation, and live rental status across all registered hotel-owned items.
              </p>
            </div>

            {/* Quick Actions Header */}
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <button
                id="btn-export-properties-csv"
                type="button"
                onClick={handleExportCSV}
                className="inline-flex items-center px-3 py-2 text-xs font-bold uppercase tracking-wider text-zinc-700 bg-white hover:bg-zinc-100 border border-zinc-300 transition-colors cursor-pointer"
                title="Download CSV spreadsheet"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5 text-emerald-600" />
                <span>Export CSV</span>
              </button>

              <button
                id="btn-export-properties-pdf"
                type="button"
                onClick={handleGeneratePDF}
                disabled={isGeneratingPdf}
                className="inline-flex items-center px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-white bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 transition-colors cursor-pointer shadow-2xs"
                title="Generate official printable PDF audit report"
              >
                <Download className="h-3.5 w-3.5 mr-1.5 text-amber-400" />
                <span>{isGeneratingPdf ? 'Generating PDF...' : 'Download PDF Audit'}</span>
              </button>

              <button
                id="btn-close-properties-summary"
                type="button"
                onClick={onClose}
                className="p-2 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200 transition-colors cursor-pointer ml-1"
                aria-label="Close modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Primary High-Contrast Executive Metrics Strip */}
          <div className="p-4 sm:p-5 bg-white border-b border-zinc-200 grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
            {/* Metric 1: Total Physical Units Count */}
            <div className="p-3 bg-zinc-50 border border-zinc-200 flex flex-col justify-between">
              <div className="flex items-center justify-between text-zinc-500">
                <span className="text-[10px] font-black uppercase tracking-wider">Total Owned Units</span>
                <Package className="h-4 w-4 text-zinc-600" />
              </div>
              <div className="mt-2">
                <div className="text-xl sm:text-2xl font-black font-mono text-zinc-900">
                  {summaryMetrics.totalPhysicalUnits.toLocaleString()}
                </div>
                <div className="text-[10px] text-zinc-500 uppercase tracking-wide mt-0.5">
                  Across {summaryMetrics.physicalProfiles} Physical Profiles {permitCount > 0 && `(+${permitCount} Permits)`}
                </div>
              </div>
            </div>

            {/* Metric 2: Total Owned Asset Valuation */}
            <div className="p-3 bg-amber-50/50 border border-amber-200 flex flex-col justify-between">
              <div className="flex items-center justify-between text-amber-800">
                <span className="text-[10px] font-black uppercase tracking-wider">Total Asset Valuation</span>
                <TrendingUp className="h-4 w-4 text-amber-700" />
              </div>
              <div className="mt-2">
                <div className="text-xl sm:text-2xl font-black font-mono text-amber-900">
                  ₱{summaryMetrics.totalValuation.toLocaleString()}
                </div>
                <div className="text-[10px] text-amber-700 uppercase tracking-wide mt-0.5">
                  Full Replacement Worth of Portfolio
                </div>
              </div>
            </div>

            {/* Metric 3: In-Stock vs Out on Rent */}
            <div className="p-3 bg-zinc-50 border border-zinc-200 flex flex-col justify-between">
              <div className="flex items-center justify-between text-zinc-500">
                <span className="text-[10px] font-black uppercase tracking-wider">Storage vs Active Field</span>
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              </div>
              <div className="mt-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-base sm:text-lg font-black font-mono text-emerald-700">
                    {summaryMetrics.totalAvailableUnits.toLocaleString()}
                  </span>
                  <span className="text-xs text-zinc-400">/</span>
                  <span className="text-base sm:text-lg font-black font-mono text-orange-700">
                    {summaryMetrics.totalRentedUnits.toLocaleString()}
                  </span>
                </div>
                <div className="text-[10px] text-zinc-500 uppercase tracking-wide mt-0.5 flex justify-between">
                  <span className="text-emerald-700 font-semibold">Available</span>
                  <span className="text-orange-700 font-semibold">Rented ({summaryMetrics.deploymentRate}%)</span>
                </div>
              </div>
            </div>

            {/* Metric 4: Active Exposure & Gross Rental Cap */}
            <div className="p-3 bg-zinc-50 border border-zinc-200 flex flex-col justify-between">
              <div className="flex items-center justify-between text-zinc-500">
                <span className="text-[10px] font-black uppercase tracking-wider">Active Field Exposure</span>
                <ShieldCheck className="h-4 w-4 text-zinc-600" />
              </div>
              <div className="mt-2">
                <div className="text-xl sm:text-2xl font-black font-mono text-zinc-900">
                  ₱{summaryMetrics.rentedExposureValuation.toLocaleString()}
                </div>
                <div className="text-[10px] text-zinc-500 uppercase tracking-wide mt-0.5">
                  Yield Cap: ₱{summaryMetrics.potentialRentalYield.toLocaleString()}/turn
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Tabs Bar */}
          <div className="px-4 sm:px-5 border-b border-zinc-200 bg-zinc-50/50 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              <button
                id="tab-summary-categories"
                type="button"
                onClick={() => setActiveTab('categories')}
                className={`py-3 px-3.5 text-xs font-bold uppercase tracking-wider border-b-2 whitespace-nowrap cursor-pointer transition-colors flex items-center gap-1.5 ${
                  activeTab === 'categories'
                    ? 'border-zinc-900 text-zinc-900 bg-white'
                    : 'border-transparent text-zinc-500 hover:text-zinc-800'
                }`}
              >
                <Layers className="h-3.5 w-3.5" />
                <span>Categories & Logistics</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 bg-zinc-100 text-zinc-600">
                  {categoryBreakdown.length}
                </span>
              </button>

              <button
                id="tab-summary-register"
                type="button"
                onClick={() => setActiveTab('register')}
                className={`py-3 px-3.5 text-xs font-bold uppercase tracking-wider border-b-2 whitespace-nowrap cursor-pointer transition-colors flex items-center gap-1.5 ${
                  activeTab === 'register'
                    ? 'border-zinc-900 text-zinc-900 bg-white'
                    : 'border-transparent text-zinc-500 hover:text-zinc-800'
                }`}
              >
                <Package className="h-3.5 w-3.5" />
                <span>Itemized Property Register</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 bg-zinc-100 text-zinc-600">
                  {activeRentalProperties.length}
                </span>
              </button>

              <button
                id="tab-summary-insights"
                type="button"
                onClick={() => setActiveTab('insights')}
                className={`py-3 px-3.5 text-xs font-bold uppercase tracking-wider border-b-2 whitespace-nowrap cursor-pointer transition-colors flex items-center gap-1.5 ${
                  activeTab === 'insights'
                    ? 'border-zinc-900 text-zinc-900 bg-white'
                    : 'border-transparent text-zinc-500 hover:text-zinc-800'
                }`}
              >
                <BarChart3 className="h-3.5 w-3.5" />
                <span>Financial & Custody Audit</span>
              </button>
            </div>

            <div className="text-[11px] text-zinc-400 font-mono hidden md:block uppercase tracking-wider">
              {activeRentalProperties.length} Total Registered Asset Records
            </div>
          </div>

          {/* Modal Body / Scrollable Content */}
          <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-6">
            {/* TAB 1: CATEGORIES & LOGISTICS BREAKDOWN */}
            {activeTab === 'categories' && (
              <div className="space-y-6">
                {/* Category Summary Table */}
                <div className="border border-zinc-200 bg-white">
                  <div className="p-3.5 bg-zinc-50 border-b border-zinc-200 flex justify-between items-center">
                    <h3 className="text-xs font-black uppercase tracking-wider text-zinc-800 flex items-center gap-2">
                      <Layers className="h-4 w-4 text-zinc-600" />
                      <span>Categorical Valuation & Owned Counts Breakdown</span>
                    </h3>
                    <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase">
                      Sorted by Valuation (Highest to Lowest)
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-zinc-100/70 border-b border-zinc-200 text-[10px] font-black uppercase tracking-wider text-zinc-600">
                          <th className="py-2.5 px-3">Item Category</th>
                          <th className="py-2.5 px-3 text-center">Profiles</th>
                          <th className="py-2.5 px-3 text-right">Owned Units</th>
                          <th className="py-2.5 px-3 text-right">Available</th>
                          <th className="py-2.5 px-3 text-right">On Rent</th>
                          <th className="py-2.5 px-3 text-right">Asset Valuation</th>
                          <th className="py-2.5 px-3 text-right">Max Yield / Turn</th>
                          <th className="py-2.5 px-3 text-right">% Portfolio</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 font-medium text-zinc-700">
                        {categoryBreakdown.map((cat, idx) => {
                          const percentShare = summaryMetrics.totalValuation > 0
                            ? ((cat.totalValue / summaryMetrics.totalValuation) * 100).toFixed(1)
                            : '0.0';

                          return (
                            <tr key={cat.category} className={idx % 2 === 1 ? 'bg-zinc-50/50' : 'bg-white hover:bg-zinc-50'}>
                              <td className="py-2.5 px-3 font-bold text-zinc-900 uppercase">
                                {cat.category}
                              </td>
                              <td className="py-2.5 px-3 text-center font-mono">
                                {cat.profiles}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-zinc-900">
                                {cat.totalUnits.toLocaleString()}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-emerald-700 font-semibold">
                                {cat.availableUnits.toLocaleString()}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-orange-700 font-semibold">
                                {cat.rentedUnits.toLocaleString()}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-zinc-900">
                                ₱{cat.totalValue.toLocaleString()}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-zinc-600">
                                ₱{cat.rentalYield.toLocaleString()}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-800">
                                {percentShare}%
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-zinc-100 border-t-2 border-zinc-300 font-bold text-zinc-900 text-xs">
                          <td className="py-3 px-3 uppercase tracking-wider font-black">
                            Total Physical Properties
                          </td>
                          <td className="py-3 px-3 text-center font-mono font-black">
                            {summaryMetrics.physicalProfiles}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-black">
                            {summaryMetrics.totalPhysicalUnits.toLocaleString()}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-emerald-800 font-black">
                            {summaryMetrics.totalAvailableUnits.toLocaleString()}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-orange-800 font-black">
                            {summaryMetrics.totalRentedUnits.toLocaleString()}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-black text-amber-900">
                            ₱{summaryMetrics.totalValuation.toLocaleString()}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-black">
                            ₱{summaryMetrics.potentialRentalYield.toLocaleString()}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-black">
                            100.0%
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* Logistics Warehouse & Condition Distribution Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Warehouse Distribution */}
                  <div className="border border-zinc-200 bg-white">
                    <div className="p-3.5 bg-zinc-50 border-b border-zinc-200 flex justify-between items-center">
                      <h3 className="text-xs font-black uppercase tracking-wider text-zinc-800 flex items-center gap-2">
                        <WarehouseIcon className="h-4 w-4 text-zinc-600" />
                        <span>Storage Depots & Warehouse Locations</span>
                      </h3>
                      <span className="text-[10px] font-mono text-zinc-500 font-bold">
                        {warehouseBreakdown.length} Depots
                      </span>
                    </div>

                    <div className="divide-y divide-zinc-100">
                      {warehouseBreakdown.map((wh) => {
                        const whPercent = summaryMetrics.totalValuation > 0
                          ? ((wh.totalValue / summaryMetrics.totalValuation) * 100).toFixed(1)
                          : '0.0';

                        return (
                          <div key={wh.warehouseId} className="p-3 hover:bg-zinc-50 transition-colors">
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="text-xs font-bold text-zinc-900 uppercase">
                                  {wh.name}
                                </h4>
                                <div className="text-[10px] text-zinc-500 mt-0.5">
                                  {wh.profiles} items • {wh.totalUnits.toLocaleString()} units ({wh.availableUnits} avail / {wh.rentedUnits} out)
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-xs font-mono font-bold text-zinc-900">
                                  ₱{wh.totalValue.toLocaleString()}
                                </div>
                                <div className="text-[10px] font-mono text-amber-700 font-bold">
                                  {whPercent}% of portfolio
                                </div>
                              </div>
                            </div>
                            {/* Distribution bar */}
                            <div className="w-full bg-zinc-100 h-1.5 mt-2 rounded-full overflow-hidden">
                              <div 
                                className="bg-zinc-900 h-full rounded-full"
                                style={{ width: `${Math.min(100, Math.max(2, Number(whPercent)))}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Asset Operational Condition */}
                  <div className="border border-zinc-200 bg-white">
                    <div className="p-3.5 bg-zinc-50 border-b border-zinc-200 flex justify-between items-center">
                      <h3 className="text-xs font-black uppercase tracking-wider text-zinc-800 flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-zinc-600" />
                        <span>Asset Operational Condition Rating</span>
                      </h3>
                      <span className="text-[10px] font-mono text-zinc-500 font-bold">
                        Audit Health
                      </span>
                    </div>

                    <div className="divide-y divide-zinc-100">
                      {conditionBreakdown.map((cond) => {
                        const condPercent = summaryMetrics.totalPhysicalUnits > 0
                          ? ((cond.unitCount / summaryMetrics.totalPhysicalUnits) * 100).toFixed(1)
                          : '0.0';

                        let badgeColor = 'bg-zinc-100 text-zinc-700 border-zinc-200';
                        if (cond.condition === 'Excellent') badgeColor = 'bg-emerald-50 text-emerald-800 border-emerald-200';
                        if (cond.condition === 'Good') badgeColor = 'bg-blue-50 text-blue-800 border-blue-200';
                        if (cond.condition === 'Fair') badgeColor = 'bg-amber-50 text-amber-800 border-amber-200';
                        if (cond.condition === 'Poor' || cond.condition === 'Under Repair') badgeColor = 'bg-red-50 text-red-800 border-red-200';

                        return (
                          <div key={cond.condition} className="p-3 hover:bg-zinc-50 transition-colors">
                            <div className="flex justify-between items-center">
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${badgeColor}`}>
                                  {cond.condition}
                                </span>
                                <span className="text-xs text-zinc-600">
                                  {cond.itemsCount} profiles
                                </span>
                              </div>
                              <div className="text-right">
                                <span className="text-xs font-mono font-bold text-zinc-900">
                                  {cond.unitCount.toLocaleString()} units
                                </span>
                                <span className="text-[10px] font-mono text-zinc-400 ml-1.5">
                                  ({condPercent}%)
                                </span>
                              </div>
                            </div>
                            <div className="flex justify-between items-center text-[10px] text-zinc-500 mt-1.5 font-mono">
                              <span>Asset Worth:</span>
                              <span className="font-semibold text-zinc-800">₱{cond.totalValue.toLocaleString()}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: ITEMIZED PROPERTY REGISTER */}
            {activeTab === 'register' && (
              <div className="space-y-4">
                {/* Search & Filter Toolbar */}
                <div className="p-3 bg-zinc-50 border border-zinc-200 flex flex-col md:flex-row gap-2.5 items-center justify-between">
                  <div className="relative w-full md:w-80">
                    <Search className="h-4 w-4 absolute left-3 top-2.5 text-zinc-400 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Filter properties by SKU, name, depot..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-zinc-300 focus:outline-none focus:border-zinc-900 uppercase tracking-wider font-semibold placeholder:normal-case placeholder:text-zinc-400"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                    {/* Category Filter */}
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="px-2.5 py-1.5 text-xs font-semibold uppercase bg-white border border-zinc-300 focus:outline-none focus:border-zinc-900"
                    >
                      <option value="All">All Categories ({activeRentalProperties.length})</option>
                      {categories.map(c => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </select>

                    {/* Warehouse Filter */}
                    <select
                      value={selectedWarehouse}
                      onChange={(e) => setSelectedWarehouse(e.target.value)}
                      className="px-2.5 py-1.5 text-xs font-semibold uppercase bg-white border border-zinc-300 focus:outline-none focus:border-zinc-900"
                    >
                      <option value="All">All Storage Locations</option>
                      {warehouses.map(w => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                      ))}
                      <option value="unassigned">Unassigned Depot</option>
                    </select>

                    {/* Sort Selector */}
                    <select
                      value={sortBy}
                      onChange={(e: any) => setSortBy(e.target.value)}
                      className="px-2.5 py-1.5 text-xs font-semibold uppercase bg-white border border-zinc-300 focus:outline-none focus:border-zinc-900"
                    >
                      <option value="value_desc">Valuation (High to Low)</option>
                      <option value="value_asc">Valuation (Low to High)</option>
                      <option value="qty_desc">Total Quantity (High to Low)</option>
                      <option value="name_asc">Name (A-Z)</option>
                    </select>
                  </div>
                </div>

                {/* Itemized Table */}
                <div className="border border-zinc-200 bg-white">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-zinc-100 border-b border-zinc-200 text-[10px] font-black uppercase tracking-wider text-zinc-600">
                          <th className="py-2.5 px-3">SKU</th>
                          <th className="py-2.5 px-3">Property Profile Name</th>
                          <th className="py-2.5 px-3">Category</th>
                          <th className="py-2.5 px-3">Depot Location</th>
                          <th className="py-2.5 px-3 text-right">Unit Replacement Value</th>
                          <th className="py-2.5 px-3 text-right">Owned Units</th>
                          <th className="py-2.5 px-3 text-right">In Stock</th>
                          <th className="py-2.5 px-3 text-right">On Rent</th>
                          <th className="py-2.5 px-3 text-right">Total Valuation</th>
                          <th className="py-2.5 px-3 text-right">Rental Rate</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 font-medium text-zinc-700">
                        {filteredItems.length === 0 ? (
                          <tr>
                            <td colSpan={10} className="py-8 text-center text-zinc-400 text-xs uppercase font-bold">
                              No matching rental properties found
                            </td>
                          </tr>
                        ) : (
                          filteredItems.map((item, idx) => {
                            const stats = getItemValuationAndUnits(item);
                            const isVeh = stats.isVehicle;
                            const isPermit = !isVeh && (item.isNoQuantity || item.category === 'Corkage & Service Permits');
                            const qTot = isPermit ? 'No Limit' : stats.totalUnits.toLocaleString();
                            const qAvail = isPermit ? 'Unlimited' : stats.availableUnits.toLocaleString();
                            const qRent = isPermit ? '-' : stats.rentedUnits.toLocaleString();
                            const unitVal = stats.unitPrice;
                            const totalVal = isPermit ? 0 : stats.totalValuation;
                            const rentalRate = Number(item.rentalPrice) || 0;

                            return (
                              <tr key={item.id} className={idx % 2 === 1 ? 'bg-zinc-50/40' : 'bg-white hover:bg-zinc-50'}>
                                <td className="py-2.5 px-3 font-mono font-bold text-zinc-500 text-[11px]">
                                  {item.sku}
                                </td>
                                <td className="py-2.5 px-3 font-bold text-zinc-900">
                                  {item.name}
                                  {isVeh && (
                                    <span className="ml-2 px-1.5 py-0.5 text-[8.5px] font-black uppercase tracking-wider bg-sky-100 text-sky-900 border border-sky-300">
                                      Car Rental (1 Unit)
                                    </span>
                                  )}
                                  {isPermit && (
                                    <span className="ml-2 px-1.5 py-0.5 text-[8.5px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300">
                                      Permit Fee
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 uppercase text-[11px] text-zinc-600">
                                  {item.category}
                                </td>
                                <td className="py-2.5 px-3 uppercase text-[11px] text-zinc-500">
                                  {getWarehouseName(item.warehouseId)}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono text-zinc-800">
                                  ₱{unitVal.toLocaleString()}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-bold text-zinc-900">
                                  {qTot}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono text-emerald-700 font-semibold">
                                  {qAvail}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono text-orange-700 font-semibold">
                                  {qRent}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-bold text-zinc-900">
                                  ₱{totalVal.toLocaleString()}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono text-zinc-600">
                                  ₱{rentalRate.toLocaleString()}{item.isHourlyCharged ? '/hr' : ''}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                      <tfoot>
                        <tr className="bg-zinc-100 border-t-2 border-zinc-300 font-black text-zinc-900 text-xs">
                          <td colSpan={5} className="py-3 px-3 uppercase tracking-wider">
                            Filtered Total ({filteredTotals.count} items)
                          </td>
                          <td className="py-3 px-3 text-right font-mono">
                            {filteredTotals.units.toLocaleString()}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-emerald-800">
                            {filteredTotals.avail.toLocaleString()}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-orange-800">
                            {filteredTotals.rent.toLocaleString()}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-amber-900">
                            ₱{filteredTotals.val.toLocaleString()}
                          </td>
                          <td className="py-3 px-3 text-right font-mono">
                            -
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: FINANCIAL & CUSTODY AUDIT INSIGHTS */}
            {activeTab === 'insights' && (
              <div className="space-y-6">
                {/* Executive Narrative */}
                <div className="p-4 bg-zinc-50 border border-zinc-200">
                  <h3 className="text-xs font-black uppercase tracking-wider text-zinc-800 mb-2 flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-zinc-600" />
                    <span>Executive Property Custody & Valuation Assessment</span>
                  </h3>
                  <p className="text-xs text-zinc-600 leading-relaxed">
                    Madigun Hotel & Events maintains <strong className="text-zinc-900 font-bold">{summaryMetrics.totalPhysicalUnits.toLocaleString()} physical asset units</strong> registered across <strong className="text-zinc-900 font-bold">{summaryMetrics.physicalProfiles} equipment profiles</strong>. The aggregate portfolio replacement value stands at <strong className="text-amber-900 font-mono font-bold">₱{summaryMetrics.totalValuation.toLocaleString()}</strong>.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 pt-3 border-t border-zinc-200 text-xs">
                    <div className="p-2.5 bg-white border border-zinc-200">
                      <span className="text-[10px] uppercase font-bold text-zinc-400 block">Warehouse Capital (Safe In Depot)</span>
                      <span className="text-base font-mono font-bold text-emerald-700">
                        ₱{summaryMetrics.inStockValuation.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-zinc-500 block mt-0.5">
                        {summaryMetrics.totalAvailableUnits} units in storage
                      </span>
                    </div>

                    <div className="p-2.5 bg-white border border-zinc-200">
                      <span className="text-[10px] uppercase font-bold text-zinc-400 block">Client Field Exposure</span>
                      <span className="text-base font-mono font-bold text-orange-700">
                        ₱{summaryMetrics.rentedExposureValuation.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-zinc-500 block mt-0.5">
                        {summaryMetrics.totalRentedUnits} units active in transmittals
                      </span>
                    </div>

                    <div className="p-2.5 bg-white border border-zinc-200">
                      <span className="text-[10px] uppercase font-bold text-zinc-400 block">Gross Yield Capability</span>
                      <span className="text-base font-mono font-bold text-zinc-900">
                        ₱{summaryMetrics.potentialRentalYield.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-zinc-500 block mt-0.5">
                        Single-cycle full deployment capacity
                      </span>
                    </div>
                  </div>
                </div>

                {/* Top 5 High-Value Assets */}
                <div className="border border-zinc-200 bg-white">
                  <div className="p-3.5 bg-zinc-50 border-b border-zinc-200 flex justify-between items-center">
                    <h4 className="text-xs font-black uppercase tracking-wider text-zinc-800">
                      Top 5 Highest Capital Value Asset Profiles
                    </h4>
                    <span className="text-[10px] font-mono text-zinc-500 font-bold uppercase">
                      Ranked by Total Worth
                    </span>
                  </div>
                  <div className="divide-y divide-zinc-100">
                    {[...physicalProperties]
                      .sort((a, b) => getItemValuationAndUnits(b).totalValuation - getItemValuationAndUnits(a).totalValuation)
                      .slice(0, 5)
                      .map((item, index) => {
                        const stats = getItemValuationAndUnits(item);
                        const totalWorth = stats.totalValuation;
                        const pct = summaryMetrics.totalValuation > 0
                          ? ((totalWorth / summaryMetrics.totalValuation) * 100).toFixed(1)
                          : '0.0';

                        return (
                          <div key={item.id} className="p-3 flex items-center justify-between gap-3 hover:bg-zinc-50">
                            <div className="flex items-center gap-3">
                              <span className="w-5 h-5 rounded-full bg-zinc-900 text-white flex items-center justify-center font-mono text-[10px] font-bold">
                                {index + 1}
                              </span>
                              <div>
                                <div className="text-xs font-bold text-zinc-900 uppercase">
                                  {item.name}
                                </div>
                                <div className="text-[10px] text-zinc-500 font-mono">
                                  {item.sku} • {item.category} • {stats.totalUnits} {stats.totalUnits === 1 ? 'unit' : 'units'} @ ₱{stats.unitPrice.toLocaleString()}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-xs font-mono font-bold text-zinc-900">
                                ₱{totalWorth.toLocaleString()}
                              </div>
                              <div className="text-[10px] font-mono text-amber-700 font-bold">
                                {pct}% of portfolio
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* Audit Signatures Display */}
                <div className="p-4 border border-zinc-200 bg-white">
                  <h4 className="text-xs font-black uppercase tracking-wider text-zinc-800 mb-4">
                    Audit Verification & Endorsement Register
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-2">
                    <div className="border-t border-zinc-400 pt-2">
                      <div className="text-xs font-bold text-zinc-900 uppercase">
                        {currentUser?.fullName || currentUser?.username || 'Property Custodian'}
                      </div>
                      <div className="text-[10px] text-zinc-500 uppercase tracking-wider">
                        Inspecting Property Custodian
                      </div>
                      <div className="text-[9px] font-mono text-zinc-400 mt-0.5">
                        Verified via System Session
                      </div>
                    </div>

                    <div className="border-t border-zinc-400 pt-2">
                      <div className="text-xs font-bold text-zinc-900 uppercase">
                        Warehouse Supervisor
                      </div>
                      <div className="text-[10px] text-zinc-500 uppercase tracking-wider">
                        Logistics & Storage Officer
                      </div>
                      <div className="text-[9px] font-mono text-zinc-400 mt-0.5">
                        Physical Stock Audit Division
                      </div>
                    </div>

                    <div className="border-t border-zinc-400 pt-2">
                      <div className="text-xs font-bold text-zinc-900 uppercase">
                        Managing Director
                      </div>
                      <div className="text-[10px] text-zinc-500 uppercase tracking-wider">
                        Executive Authorization
                      </div>
                      <div className="text-[9px] font-mono text-zinc-400 mt-0.5">
                        Madigun Hotel & Events Management
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="p-3 sm:p-4 border-t border-zinc-200 bg-zinc-50 flex flex-col sm:flex-row justify-between items-center gap-3 shrink-0">
            <div className="text-[11px] text-zinc-500 font-mono">
              Report Generated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' })} • Madigun Asset Logistics Core
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-zinc-700 bg-white hover:bg-zinc-100 border border-zinc-300 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Print</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-white bg-zinc-900 hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                Done / Close
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
