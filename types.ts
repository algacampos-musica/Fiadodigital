export interface Product {
  id: string;
  name: string;
  defaultPrice: number;
}

export type DebtorStatus = 'OTIMO' | 'BOM' | 'REGULAR' | 'CALOTEIRO';

export interface Debtor {
  id: string;
  name: string;
  phone: string;
  status?: DebtorStatus; // Opcional para suportar dados antigos
  notes?: string;
  createdAt: string;
}

export enum TransactionType {
  DEBT = 'DEBT',
  PAYMENT = 'PAYMENT'
}

export interface TransactionItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Transaction {
  id: string;
  debtorId: string;
  type: TransactionType;
  date: string;
  description?: string;
  // For Debts
  items?: TransactionItem[];
  // For Payments
  paymentMethod?: string;
  installments?: number;
  
  totalAmount: number;
}

export interface DashboardStats {
  totalDebtors: number;
  totalProducts: number;
  totalOutstanding: number;
  recentTransactions: Transaction[];
}