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
}

export interface Project {
  id: number;
  name: string;
  spaces: Space[];
}

export interface Product {
  sku: string;
  item: string;
  dimensions?: string;
  images?: string[];
  price?: number;
  vendor?: string;
  sheetName: string;
  notes: string | null;
  quantity?: number | null;
  total?: number | null;
}