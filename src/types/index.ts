import { stockMovementTypeEnum, paymentMethodEnum, paymentStatusEnum, saleTypeEnum, priceTypeEnum, syncStatusEnum, userRoleEnum } from "@/db/schema";

export type UserRole = typeof userRoleEnum.enumValues[number];
export type StockMovementType = typeof stockMovementTypeEnum.enumValues[number];
export type PaymentMethod = typeof paymentMethodEnum.enumValues[number];
export type PaymentStatus = typeof paymentStatusEnum.enumValues[number];
export type SaleType = typeof saleTypeEnum.enumValues[number];
export type PriceType = typeof priceTypeEnum.enumValues[number];
export type SyncStatus = typeof syncStatusEnum.enumValues[number];

export interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

export interface CartItem {
  productId: number;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  quantity: number;
  unitPrice: number;
  purchasePrice: number;
  priceType: PriceType;
  stock: number;
}

export interface OfflineSale {
  localId: string;
  deviceId: string;
  customerId?: number | null;
  saleType: SaleType;
  items: Array<{
    productId: number;
    productName: string;
    productSku?: string | null;
    quantity: number;
    purchasePriceAtTime: number;
    unitPrice: number;
    priceType: PriceType;
  }>;
  paymentMethod: PaymentMethod;
  amountPaid: number;
  notes?: string;
  createdAt: string;
  userId?: number;
  synced?: boolean;
}

export interface OfflinePurchase {
  localId: string;
  deviceId: string;
  supplierId?: number | null;
  invoiceNumber?: string;
  items: Array<{
    productId: number;
    productName: string;
    quantity: number;
    unitCost: number;
  }>;
  paymentMethod: PaymentMethod;
  amountPaid: number;
  notes?: string;
  purchaseDate: string;
  userId?: number;
  synced?: boolean;
}
