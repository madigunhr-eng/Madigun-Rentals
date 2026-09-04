export interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  category: string;
  quantityTotal: number;
  quantityAvailable: number;
  status: 'In Stock' | 'Partially Rented' | 'Out of Stock' | 'In Use' | 'Under Maintenance' | 'Retired';
  location?: string;
  description?: string;
  createdAt: any;
  assignedCustodianId?: string;
  assignedCustodianName?: string;
  isStationary?: boolean;
  isCompanyProperty?: boolean;
  gridLocation?: string;
  price?: number;
  rentalPrice?: number;
  isHourlyCharged?: boolean;
  estimatedLifespan?: string;
  warehouseId?: string;
  plateNumber?: string;
  serialNumber?: string;
  lastMaintenanceDate?: string;
  nextMaintenanceDate?: string;
  assetCondition?: 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Under Repair';
  isNoQuantity?: boolean;
  chargeType?: 'Daily' | 'Hourly' | 'Flat Fee';
}

export interface Warehouse {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
}

export interface ItemCategory {
  id: string;
  name: string;
  isSystem?: boolean;
  createdAt?: string;
}

export interface TransmittalItem {
  itemId: string;
  name: string;
  sku: string;
  quantity: number;
  returnedQuantity: number;
}

export interface Transmittal {
  id: string;
  transmittalNo: string;
  handler: string;
  rentee: string;
  address: string;
  dateCheckout: string;
  dateCheckin: string; // Target return date
  items: TransmittalItem[];
  status: 'Pending' | 'On Going' | 'Partially Returned' | 'Returned';
  notes: string;
  createdAt: any;
  custodianSigned?: boolean;
  custodianSignedBy?: string;
  custodianSignedAt?: string;
  gatePassRequested?: boolean;
  gatePassRequestedBy?: string;
  gatePassRequestedAt?: string;
}

export interface DeletedLog {
  id: string;
  transmittalNo: string;
  rentee: string;
  handler: string;
  deletedAt: string;
  originalCreatedAt: string;
  statusAtDeletion: string;
  itemsSummary: string;
  itemsCount: number;
  originalData?: any;
}

export interface Custodian {
  id: string;
  name: string;
  employeeId: string;
  role: string;
  contact: string;
  status: 'Active' | 'Inactive';
  createdAt: string;
}

export interface AuditLog {
  id: string;
  itemId: string;
  itemName: string;
  itemSku: string;
  previousQuantity: number;
  countedQuantity: number;
  difference: number;
  auditorName: string;
  notes: string;
  status: 'Matched' | 'Discrepancy - Discovered Extra' | 'Discrepancy - Missing Units';
  createdAt: string;
}

export type UserRole = 'Managing Director' | 'Front Desk' | 'Admin';

export interface UserSession {
  username: string;
  role: UserRole;
  employeeId: string;
  fullName?: string;
  phone?: string;
  email?: string;
  department?: string;
  bio?: string;
  status?: 'Approved' | 'Pending' | 'Rejected';
}

export interface UserProfile {
  id?: string;
  username: string;
  password?: string;
  role: UserRole | 'Pending';
  employeeId: string;
  fullName?: string;
  phone?: string;
  email?: string;
  department?: string;
  bio?: string;
  status: 'Approved' | 'Pending' | 'Rejected';
  createdAt: string;
}

