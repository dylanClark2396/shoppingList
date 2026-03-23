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

export type LabelMachine = 'P-touch' | 'Cricut'

export interface Label {
  id: number;
  machine: LabelMachine;
  spaceName: string;
  labelName: string;
  color: string;
  size?: string;       // P-touch only
  material?: string;   // Cricut only
  notes?: string;
  quantity?: number;
}

export interface Project {
  id: number;
  name: string;
  spaces: Space[];
  labels?: Label[];
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