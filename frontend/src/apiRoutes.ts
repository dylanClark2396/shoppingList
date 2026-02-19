// apiRoutes.ts
export const API_BASE_URL = 'http://localhost:3000';

export const API_ROUTES = {
  // Projects
  projects: `${API_BASE_URL}/projects`,
  project: (projectId: number) => `${API_BASE_URL}/projects/${projectId}`,
  createProject: `${API_BASE_URL}/projects`,
  updateProject: (projectId: number) => `${API_BASE_URL}/projects/${projectId}`,

  // Spaces
  spaces: (projectId: number) => `${API_BASE_URL}/projects/${projectId}/spaces`,
  space: (projectId: number, spaceId: number) =>
    `${API_BASE_URL}/projects/${projectId}/spaces/${spaceId}`,

  // Measurements
  measurements: (projectId: number) => `${API_BASE_URL}/projects/${projectId}/measurements`,
  measurement: (projectId: number, measurementId: number) =>
    `${API_BASE_URL}/projects/${projectId}/measurements/${measurementId}`,

  // Products in a measurement
  addProductToMeasurement: (projectId: number, measurementId: number) =>
    `${API_BASE_URL}/projects/${projectId}/measurements/${measurementId}/product`,
  removeProductFromMeasurement: (projectId: number, measurementId: number, sku: string) =>
    `${API_BASE_URL}/projects/${projectId}/measurements/${measurementId}/products/${sku}`,

  // Products master list
  products: `${API_BASE_URL}/products`,
  product: (id: number) => `${API_BASE_URL}/products/${id}`,
};
