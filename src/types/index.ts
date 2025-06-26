export interface Product {
  id: string;
  name: string;
  expiryDate: string; // YYYY-MM-DD format
  scanTimestamp: number;
  imageUrl?: string;
}
