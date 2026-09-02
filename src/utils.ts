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

export const CATEGORIES = [
  'All',
  'Corkage & Service Permits',
  'Cameras',
  'Lenses',
  'Audio',
  'Lighting',
  'Laptops',
  'Accessories'
];
