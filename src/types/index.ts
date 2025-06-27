export interface Product {
  id: string;
  name: string;
  expiryDate: string; // YYYY-MM-DD format
  scanTimestamp: number;
  imageUrl?: string;
  brand?: string;
  quantity?: string;
  categories?: string;
  nutriscore?: string;
  ecoscore?: string;
  ingredients?: string;
  country?: string;
  barcode?: string;
  url?: string;
  rawData?: any;
}
