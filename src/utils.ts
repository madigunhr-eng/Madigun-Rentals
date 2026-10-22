import { InventoryItem, TransmittalItem, Transmittal } from './types';

export function generateTransmittalNo(
  transmittals: { transmittalNo: string }[] = [],
  deletedLogs: { transmittalNo: string }[] = []
): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const arPrefix = `AR-${year}-${month}${day}-`;
  const legacyTxPrefix = `TX-${year}-${month}${day}-`;

  let maxSequence = 0;

  const checkItem = (itemNo: string) => {
    if (!itemNo) return;
    if (itemNo.startsWith(arPrefix) || itemNo.startsWith(legacyTxPrefix)) {
      const parts = itemNo.split('-');
      const seqStr = parts[parts.length - 1];
      const seqNum = parseInt(seqStr, 10);
      if (!isNaN(seqNum) && seqNum > maxSequence) {
        maxSequence = seqNum;
      }
    }
  };

  transmittals.forEach(tx => checkItem(tx.transmittalNo));
  deletedLogs.forEach(log => checkItem(log.transmittalNo));

  const nextSequence = maxSequence + 1;
  const seqFormatted = String(nextSequence).padStart(2, '0');

  return `${arPrefix}${seqFormatted}`;
}

export const generateAcknowledgementReceiptNo = generateTransmittalNo;

export const DEFAULT_CATEGORIES = [
  'Corkage & Service Permits',
  'Vehicles & Car Rentals',
  'Cameras',
  'Lenses',
  'Audio',
  'Lighting',
  'Laptops',
  'Accessories'
];

export const CATEGORIES = [
  'All',
  ...DEFAULT_CATEGORIES
];

/**
 * Identifies if an item or category name represents a vehicle or car rental
 */
export function isVehicleItemOrCategory(
  itemOrCategory: { category?: string; name?: string; sku?: string; plateNumber?: string } | string | null | undefined
): boolean {
  if (!itemOrCategory) return false;
  if (typeof itemOrCategory === 'string') {
    const s = itemOrCategory.toLowerCase();
    return (
      s.includes('vehicle') ||
      s.includes('car') ||
      s.includes('van') ||
      s.includes('fleet') ||
      s.includes('automobile') ||
      s.includes('truck') ||
      s.includes('motorcycle') ||
      s.includes('transport')
    );
  }
  const cat = (itemOrCategory.category || '').toLowerCase();
  const name = (itemOrCategory.name || '').toLowerCase();
  const sku = (itemOrCategory.sku || '').toLowerCase();
  return (
    cat.includes('vehicle') ||
    cat.includes('car') ||
    cat.includes('van') ||
    cat.includes('fleet') ||
    cat.includes('automobile') ||
    cat.includes('truck') ||
    cat.includes('motorcycle') ||
    cat.includes('transport') ||
    !!itemOrCategory.plateNumber ||
    sku.startsWith('veh-') ||
    sku.startsWith('car-')
  );
}

/**
 * Calculates correct unit count, deployment numbers, and total valuation for any rental item.
 * For vehicles/car rentals:
 * - Total units is ALWAYS 1 (not unlimited).
 * - Total valuation is ALWAYS identical to the unit replacement value.
 */
export function getItemValuationAndUnits(item: {
  quantityTotal: number;
  quantityAvailable: number;
  price?: number;
  rentalPrice?: number;
  category?: string;
  name?: string;
  sku?: string;
  plateNumber?: string;
  isNoQuantity?: boolean;
}) {
  const isVeh = isVehicleItemOrCategory(item);
  const unitPrice = Number(item.price) || 0;

  if (isVeh) {
    // Total units of all vehicles is 1 and not unlimited (car rental).
    // The unit replacement value is the same as the total valuation.
    const totalUnits = 1;
    const availableUnits = (Number(item.quantityAvailable) || 0) > 0 ? 1 : 0;
    const rentedUnits = totalUnits - availableUnits;
    const totalValuation = unitPrice; // exactly matches unit replacement value
    const inStockValuation = availableUnits > 0 ? unitPrice : 0;
    const rentedValuation = rentedUnits > 0 ? unitPrice : 0;
    const rentalYield = Number(item.rentalPrice) || 0;

    return {
      isVehicle: true,
      totalUnits,
      availableUnits,
      rentedUnits,
      unitPrice,
      totalValuation,
      inStockValuation,
      rentedValuation,
      rentalYield
    };
  }

  const qTot = Number(item.quantityTotal) || 0;
  const qAvail = Number(item.quantityAvailable) || 0;
  const qRented = Math.max(0, qTot - qAvail);
  const totalValuation = qTot * unitPrice;
  const inStockValuation = qAvail * unitPrice;
  const rentedValuation = qRented * unitPrice;
  const rentalYield = qTot * (Number(item.rentalPrice) || 0);

  return {
    isVehicle: false,
    totalUnits: qTot,
    availableUnits: qAvail,
    rentedUnits: qRented,
    unitPrice,
    totalValuation,
    inStockValuation,
    rentedValuation,
    rentalYield
  };
}

/**
 * Fallback pricing for legacy or unpriced inventory items
 */
export function getFallbackPrice(name: string): number {
  const nameLower = (name || '').toLowerCase();
  if (nameLower.includes('photographer') || nameLower.includes('photobooth') || nameLower.includes('corkage') || nameLower.includes('permit')) return 500;
  if (nameLower.includes('chair')) return 35;
  if (nameLower.includes('table')) return 150;
  if (nameLower.includes('plate') || nameLower.includes('bowl') || nameLower.includes('dish')) return 15;
  if (nameLower.includes('glass') || nameLower.includes('cup')) return 20;
  if (nameLower.includes('fork') || nameLower.includes('spoon') || nameLower.includes('knife')) return 10;
  if (nameLower.includes('tent') || nameLower.includes('canopy')) return 1200;
  if (nameLower.includes('sound') || nameLower.includes('speaker') || nameLower.includes('light')) return 800;
  if (nameLower.includes('tray') || nameLower.includes('pan')) return 100;
  if (nameLower.includes('van') || nameLower.includes('car') || nameLower.includes('vehicle')) return 2500;
  return 50;
}

/**
 * Detect if an item is classified as a Rental Hall or Event Venue
 */
export function isRentalHallItem(item: { itemId?: string; name?: string; sku?: string }, invItem?: InventoryItem): boolean {
  if (invItem?.category === 'Rental Halls & Event Venues') return true;
  if (item.sku && item.sku.toUpperCase().startsWith('HALL-')) return true;
  const nameLower = (item.name || '').toLowerCase();
  if (
    nameLower.includes('hall') || 
    nameLower.includes('ballroom') || 
    nameLower.includes('pavilion') || 
    nameLower.includes('terrace') || 
    nameLower.includes('event venue') ||
    nameLower.includes('function hall')
  ) {
    return true;
  }
  return false;
}

export interface ItemRevenueCalculation {
  revenue: number;           // Actual billable revenue (0 if complimentary)
  grossRevenue: number;      // Value at scheduled rate (rate * duration * qty)
  courtesyWaived: number;    // Amount waived if complimentary, 0 if rented
  days: number;
  hours?: number;
  rate: number;
  rateLabel: string;
  isHourly: boolean;
  isFlatFee: boolean;
  isHall: boolean;
  isComplimentary: boolean;
  stream: 'hall' | 'item';
}

/**
 * Calculates itemized revenue breakdown, including standard gross charges and complimentary waivers
 */
export function calculateItemRevenueDetail(
  item: TransmittalItem,
  dateCheckout: string,
  dateCheckin: string,
  inventory: InventoryItem[]
): ItemRevenueCalculation {
  const invItem = inventory.find(i => i.id === item.itemId || (item.sku && i.sku === item.sku));
  const isHall = isRentalHallItem(item, invItem);
  const itemName = item.name || '';
  const isComp = !!item.isComplimentary || item.allocationType === 'Complimentary';

  // 1. Check for day pattern embedded in name: e.g., "Grand Ballroom (2 Day(s) @ ₱18,000/day: ...)"
  const dayMatch = itemName.match(/(\d+)\s*Day\(s\)\s*@\s*₱?([\d,]+)\/day/i);
  if (dayMatch) {
    const days = Math.max(1, parseInt(dayMatch[1], 10) || 1);
    const dailyRate = parseFloat(dayMatch[2].replace(/,/g, '')) || 0;
    const computedGross = days * dailyRate * (item.quantity || 1);
    return {
      revenue: isComp ? 0 : computedGross,
      grossRevenue: computedGross,
      courtesyWaived: isComp ? computedGross : 0,
      days,
      rate: dailyRate,
      isHourly: false,
      isFlatFee: false,
      isHall: true,
      isComplimentary: isComp,
      stream: 'hall',
      rateLabel: `₱${dailyRate.toLocaleString()}/day (${days}d)`
    };
  }

  // 2. Check for hour pattern embedded in name: e.g., "Emerald Pavilion (4 hrs @ ₱2,500/hr: ...)"
  const hourMatch = itemName.match(/(\d+)\s*hrs?\s*@\s*₱?([\d,]+)\/hr/i);
  if (hourMatch) {
    const hours = Math.max(1, parseInt(hourMatch[1], 10) || 1);
    const hourlyRate = parseFloat(hourMatch[2].replace(/,/g, '')) || 0;
    const computedGross = hours * hourlyRate * (item.quantity || 1);
    return {
      revenue: isComp ? 0 : computedGross,
      grossRevenue: computedGross,
      courtesyWaived: isComp ? computedGross : 0,
      days: Math.ceil(hours / 24),
      hours,
      rate: hourlyRate,
      isHourly: true,
      isFlatFee: false,
      isHall,
      isComplimentary: isComp,
      stream: isHall ? 'hall' : 'item',
      rateLabel: `₱${hourlyRate.toLocaleString()}/hr (${hours}h)`
    };
  }

  // 3. Check for flat fee or corkage embedded: e.g., "Outside Catering Permit (₱1,500 fee)"
  const feeMatch = itemName.match(/₱?([\d,]+)\s*(?:fee|flat fee)/i);
  if (feeMatch) {
    const fee = parseFloat(feeMatch[1].replace(/,/g, '')) || 0;
    const computedGross = fee * (item.quantity || 1);
    return {
      revenue: isComp ? 0 : computedGross,
      grossRevenue: computedGross,
      courtesyWaived: isComp ? computedGross : 0,
      days: 1,
      rate: fee,
      isHourly: false,
      isFlatFee: true,
      isHall,
      isComplimentary: isComp,
      stream: isHall ? 'hall' : 'item',
      rateLabel: `₱${fee.toLocaleString()} (flat)`
    };
  }

  // 4. Default duration calculation based on transmittal checkout and checkin dates
  const start = new Date(dateCheckout || new Date());
  const end = new Date(dateCheckin || dateCheckout || new Date());
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const days = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24))) || 1;

  // If item is classified as a Rental Hall
  if (isHall) {
    const dailyRate = Number(invItem?.dailyRentalPrice) || (invItem?.rentalPrice ? Number(invItem.rentalPrice) * 6 : 18000);
    const computedGross = dailyRate * days * (item.quantity || 1);
    return {
      revenue: isComp ? 0 : computedGross,
      grossRevenue: computedGross,
      courtesyWaived: isComp ? computedGross : 0,
      days,
      rate: dailyRate,
      isHourly: false,
      isFlatFee: false,
      isHall: true,
      isComplimentary: isComp,
      stream: 'hall',
      rateLabel: `₱${dailyRate.toLocaleString()}/day`
    };
  }

  // If item is a flat fee service item
  if (invItem?.isNoQuantity || invItem?.chargeType === 'Flat Fee' || invItem?.category === 'Corkage & Service Permits') {
    const flatRate = Number(invItem?.rentalPrice || 500);
    const computedGross = flatRate * (item.quantity || 1);
    return {
      revenue: isComp ? 0 : computedGross,
      grossRevenue: computedGross,
      courtesyWaived: isComp ? computedGross : 0,
      days: 1,
      rate: flatRate,
      isHourly: false,
      isFlatFee: true,
      isHall: false,
      isComplimentary: isComp,
      stream: 'item',
      rateLabel: `₱${flatRate.toLocaleString()} (flat)`
    };
  }

  // Standard physical rental asset (Chairs, Tables, Tents, Catering Equipment, Vehicles, etc.)
  const rate = Number(invItem?.dailyRentalPrice || invItem?.rentalPrice || getFallbackPrice(item.name));
  let totalRate = rate;
  if (invItem?.isHourlyCharged) {
    totalRate = rate * 24;
  }
  const computedGross = totalRate * days * (item.quantity || 1);

  return {
    revenue: isComp ? 0 : computedGross,
    grossRevenue: computedGross,
    courtesyWaived: isComp ? computedGross : 0,
    days,
    rate: totalRate,
    isHourly: !!invItem?.isHourlyCharged,
    isFlatFee: false,
    isHall: false,
    isComplimentary: isComp,
    stream: 'item',
    rateLabel: `₱${totalRate.toLocaleString()}/${invItem?.isHourlyCharged ? 'hr' : 'day'}`
  };
}

export interface TransmittalRevenueSummary {
  grossRevenue: number;         // Total standard scheduled charges before waivers
  complimentaryWaived: number;  // Total value waived for complimentary items
  extensionsTotal: number;      // Venue duration extensions from notes
  netRevenue: number;           // Total billable revenue (gross + extensions - waived)
  totalItemsCount: number;
  rentedItemsCount: number;
  complimentaryItemsCount: number;
  totalUnitsCount: number;
  rentedUnitsCount: number;
  complimentaryUnitsCount: number;
  hasComplimentary: boolean;
  breakdown: {
    item: TransmittalItem;
    invItem?: InventoryItem;
    calc: ItemRevenueCalculation;
  }[];
}

/**
 * Calculates complete transmittal revenue breakdown minus complimentary waived
 */
export function calculateTransmittalRevenue(
  tx: Transmittal,
  inventory: InventoryItem[]
): TransmittalRevenueSummary {
  const breakdown = (tx.items || []).map(item => {
    const invItem = inventory.find(i => i.id === item.itemId || (item.sku && i.sku === item.sku));
    const calc = calculateItemRevenueDetail(item, tx.dateCheckout, tx.dateCheckin, inventory);
    return { item, invItem, calc };
  });

  const grossRevenue = breakdown.reduce((sum, b) => sum + b.calc.grossRevenue, 0);
  const complimentaryWaived = breakdown.reduce((sum, b) => sum + b.calc.courtesyWaived, 0);

  // Parse venue rental duration extension surcharges from tx.notes if any
  let extensionsTotal = 0;
  if (tx.notes) {
    const extensionRegex = /\[EXTENDED\s*\+(\d+)\s*HR\(S\)[^|]*\|\s*\+₱?([\d,]+)\]/gi;
    let match;
    while ((match = extensionRegex.exec(tx.notes)) !== null) {
      const cost = parseFloat(match[2].replace(/,/g, '')) || 0;
      extensionsTotal += cost;
    }
  }

  const netRevenue = Math.max(0, grossRevenue + extensionsTotal - complimentaryWaived);

  const totalItemsCount = (tx.items || []).length;
  const rentedItemsCount = (tx.items || []).filter(i => !i.isComplimentary && i.allocationType !== 'Complimentary').length;
  const complimentaryItemsCount = (tx.items || []).filter(i => i.isComplimentary || i.allocationType === 'Complimentary').length;

  const totalUnitsCount = (tx.items || []).reduce((sum, i) => sum + (i.quantity || 0), 0);
  const rentedUnitsCount = (tx.items || []).filter(i => !i.isComplimentary && i.allocationType !== 'Complimentary').reduce((sum, i) => sum + (i.quantity || 0), 0);
  const complimentaryUnitsCount = (tx.items || []).filter(i => i.isComplimentary || i.allocationType === 'Complimentary').reduce((sum, i) => sum + (i.quantity || 0), 0);

  return {
    grossRevenue,
    complimentaryWaived,
    extensionsTotal,
    netRevenue,
    totalItemsCount,
    rentedItemsCount,
    complimentaryItemsCount,
    totalUnitsCount,
    rentedUnitsCount,
    complimentaryUnitsCount,
    hasComplimentary: complimentaryWaived > 0 || complimentaryUnitsCount > 0,
    breakdown
  };
}

