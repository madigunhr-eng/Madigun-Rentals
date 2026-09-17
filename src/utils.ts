export function generateTransmittalNo(
  transmittals: { transmittalNo: string }[] = [],
  deletedLogs: { transmittalNo: string }[] = []
): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const datePrefix = `TX-${year}-${month}${day}-`;

  let maxSequence = 0;

  const checkItem = (itemNo: string) => {
    if (itemNo && itemNo.startsWith(datePrefix)) {
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

  return `${datePrefix}${seqFormatted}`;
}

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
