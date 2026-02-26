// apiRoutes.ts
export const API_BASE_URL = import.meta.env.VITE_API_BASE || 'http://localhost:3000';

export const API_ROUTES = {
  // ========================
  // 📦 Projects
  // ========================
  projects: `${API_BASE_URL}/projects`,
  project: (projectId: number) => `${API_BASE_URL}/projects/${projectId}`,
  createProject: `${API_BASE_URL}/projects`,
  updateProject: (projectId: number) => `${API_BASE_URL}/projects/${projectId}`,

  // ========================
  // 🏠 Spaces (under project)
  // ========================
  spaces: (projectId: number) =>
    `${API_BASE_URL}/projects/${projectId}/spaces`,

  space: (projectId: number, spaceId: number) =>
    `${API_BASE_URL}/projects/${projectId}/spaces/${spaceId}`,

  spaceUploadUrl: (projectId: number, spaceId: number) =>
    `${API_BASE_URL}/projects/${projectId}/spaces/${spaceId}/upload-url`,

  // ========================
  // 📐 Measurements (under space)
  // ========================
  measurements: (projectId: number, spaceId: number) =>
    `${API_BASE_URL}/projects/${projectId}/spaces/${spaceId}/measurements`,

  measurement: (projectId: number, spaceId: number, measurementId: number) =>
    `${API_BASE_URL}/projects/${projectId}/spaces/${spaceId}/measurements/${measurementId}`,

  // ========================
  // 🛒 Products (under measurement)
  // ========================
  addProductToMeasurement: (
    projectId: number,
    spaceId: number,
    measurementId: number
  ) =>
    `${API_BASE_URL}/projects/${projectId}/spaces/${spaceId}/measurements/${measurementId}/products`,

  removeProductFromMeasurement: (
    projectId: number,
    spaceId: number,
    measurementId: number,
    sku: number
  ) =>
    `${API_BASE_URL}/projects/${projectId}/spaces/${spaceId}/measurements/${measurementId}/products/${sku}`,

  updateProduct: (
    projectId: number,
    spaceId: number,
    measurementId: number,
    sku: number
  ) =>
    `${API_BASE_URL}/projects/${projectId}/spaces/${spaceId}/measurements/${measurementId}/products/${sku}`,

  // ========================
  // 🛍 Master Products
  // ========================
  products: `${API_BASE_URL}/products`,
  product: (id: number) => `${API_BASE_URL}/products/${id}`,
};
