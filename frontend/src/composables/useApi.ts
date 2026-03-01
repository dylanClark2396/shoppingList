// composables/useApi.ts
import type { Product, Measurement, Space, Project } from '@/models';
import { API_ROUTES } from '@/apiRoutes';

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('access_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function safeJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API Error ${res.status}: ${text}`)
  }
  return res.json()
}

export function useApi() {
  // ========================
  // 📦 Projects
  // ========================

  const getProjects = async (): Promise<Project[]> => {
    const res = await fetch(API_ROUTES.projects, {
      headers: { ...authHeaders() },
    })
    return safeJson<Project[]>(res)
  }

  const getProject = async (projectId: number): Promise<Project> => {
    const res = await fetch(API_ROUTES.project(projectId), {
      headers: { ...authHeaders() },
    })
    return safeJson<Project>(res)
  }

  const createProject = async (project: Partial<Project>): Promise<Project> => {
    const res = await fetch(API_ROUTES.createProject, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(project),
    })
    const data = await safeJson<{ project: Project }>(res)
    return data.project
  }

  const updateProject = async (
    projectId: number,
    updates: Partial<Project>
  ): Promise<Project> => {
    const res = await fetch(API_ROUTES.updateProject(projectId), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(updates),
    })
    const data = await safeJson<{ project: Project }>(res)
    return data.project
  }

  // ========================
  // 🏠 Spaces
  // ========================

  const createSpace = async (
    projectId: number,
    space: Partial<Space>
  ): Promise<Space> => {
    const res = await fetch(API_ROUTES.spaces(projectId), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(space),
    })
    const data = await safeJson<{ space: Space }>(res)
    return data.space
  }

  const updateSpace = async (
    projectId: number,
    spaceId: number,
    updates: Partial<Space>
  ): Promise<Space> => {
    const res = await fetch(API_ROUTES.space(projectId, spaceId), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(updates),
    })
    const data = await safeJson<{ space: Space }>(res)
    return data.space
  }

  const deleteSpace = async (projectId: number, spaceId: number): Promise<void> => {
    const res = await fetch(API_ROUTES.space(projectId, spaceId), {
      method: 'DELETE',
      headers: { ...authHeaders() },
    })
    if (!res.ok) throw new Error('Failed to delete space')
  }

  const deleteSpaceImage = async (projectId: number, spaceId: number, url: string): Promise<void> => {
    const res = await fetch(API_ROUTES.spaceImages(projectId, spaceId), {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ url }),
    })
    if (!res.ok) throw new Error('Failed to delete image')
  }

  const getSpaceUploadUrl = async (
    projectId: number,
    spaceId: number,
    filename: string,
    contentType: string
  ): Promise<{ uploadUrl: string; publicUrl: string }> => {
    const res = await fetch(
      `${API_ROUTES.spaceUploadUrl(projectId, spaceId)}?filename=${encodeURIComponent(filename)}&contentType=${encodeURIComponent(contentType)}`,
      { headers: { ...authHeaders() } }
    )
    return safeJson(res)
  }

  // ========================
  // 📐 Measurements
  // ========================

  const createMeasurement = async (
    projectId: number,
    spaceId: number,
    measurement: Partial<Measurement>
  ): Promise<Measurement> => {
    const res = await fetch(API_ROUTES.measurements(projectId, spaceId), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(measurement),
    })
    const data = await safeJson<{ measurement: Measurement }>(res)
    return data.measurement
  }

  const updateMeasurement = async (
    projectId: number,
    spaceId: number,
    measurementId: number,
    updates: Partial<Measurement>
  ): Promise<Measurement> => {
    const res = await fetch(API_ROUTES.measurement(projectId, spaceId, measurementId), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(updates),
    })
    const data = await safeJson<{ measurement: Measurement }>(res)
    return data.measurement
  }

  const deleteMeasurement = async (
    projectId: number,
    spaceId: number,
    measurementId: number
  ): Promise<void> => {
    const res = await fetch(API_ROUTES.measurement(projectId, spaceId, measurementId), {
      method: 'DELETE',
      headers: { ...authHeaders() },
    })
    if (!res.ok) throw new Error('Failed to delete measurement')
  }

  // ========================
  // 🛒 Products in Measurement
  // ========================

  const addProductToMeasurement = async (
    projectId: number,
    spaceId: number,
    measurementId: number,
    product: Product
  ): Promise<Product> => {
    const res = await fetch(API_ROUTES.addProductToMeasurement(projectId, spaceId, measurementId), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(product),
    })
    const data = await safeJson<{ product: Product }>(res)
    return data.product
  }

  const removeProductFromMeasurement = async (
    projectId: number,
    spaceId: number,
    measurementId: number,
    sku: number
  ): Promise<void> => {
    const res = await fetch(
      API_ROUTES.removeProductFromMeasurement(projectId, spaceId, measurementId, sku),
      {
        method: 'DELETE',
        headers: { ...authHeaders() },
      }
    )
    if (!res.ok) throw new Error('Failed to remove product')
  }

  const updateProduct = async (
    projectId: number,
    spaceId: number,
    measurementId: number,
    sku: number,
    updates: Partial<Product>
  ): Promise<Product> => {
    const res = await fetch(API_ROUTES.updateProduct(projectId, spaceId, measurementId, sku), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(updates),
    })
    const data = await safeJson<{ product: Product }>(res)
    return data.product
  }

  // ========================
  // 🛍 Master Products
  // ========================

  const getProducts = async (): Promise<Product[]> => {
    const res = await fetch(API_ROUTES.products)
    return safeJson<Product[]>(res)
  }

  const getProduct = async (id: number): Promise<Product> => {
    const res = await fetch(API_ROUTES.product(id))
    return safeJson<Product>(res)
  }

  return {
    getProjects,
    getProject,
    createProject,
    updateProject,
    createSpace,
    updateSpace,
    deleteSpace,
    deleteSpaceImage,
    getSpaceUploadUrl,
    createMeasurement,
    updateMeasurement,
    deleteMeasurement,
    addProductToMeasurement,
    removeProductFromMeasurement,
    updateProduct,
    getProducts,
    getProduct,
  }
}
