export interface Dimension {
  depth: string | null;
  width: string | null;
  height: string | null;
}

export interface Measurement {
  id: number;
  name: string;
  quantity: number | null;
  dimensions: Dimension | null;
  category: string | null;
  products: Product[];
  note: string;
  images: string[];
}

export interface Space {
  id: number;
  name: string;
  measurements: Measurement[];
  images?: string[];
}

export interface Project {
  id: number;
  name: string;
  spaces: Space[];
}

export interface Product {
  sku: number;
  item: string;
  dimensions: string;
  images: string[];
  price: number;
  vendor: string;
  sheetName: string;
  notes: string;
  quantity: number;
  total: number;
}