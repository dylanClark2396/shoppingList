// composables/useApi.ts
import type { Product, Measurement, Space, Project } from '@/models';
import { API_ROUTES } from '@/apiRoutes';

export function useApi() {
  // ------------------------
  // Projects
  // ------------------------
  const getProjects = async (): Promise<Project[]> => {
    const res = await fetch(API_ROUTES.projects);
    return await res.json();
  };

  const getProject = async (projectId: number): Promise<Project> => {
    const res = await fetch(API_ROUTES.project(projectId));
    return await res.json();
  };

  const createProject = async (project: Partial<Project>): Promise<Project> => {
    const res = await fetch(API_ROUTES.createProject, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(project),
    });
    const data = await res.json();
    return data.project;
  };

  const updateProject = async (projectId: number, updates: Partial<Project>) => {
    const res = await fetch(API_ROUTES.updateProject(projectId), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    return await res.json();
  };

  // ------------------------
  // Spaces
  // ------------------------
  const createSpace = async (projectId: number, space: Partial<Space>) => {
    const res = await fetch(API_ROUTES.spaces(projectId), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(space),
    });
    const data = await res.json();
    return data.space;
  };

  const updateSpace = async (projectId: number, spaceId: number, updates: Partial<Space>) => {
    const res = await fetch(API_ROUTES.space(projectId, spaceId), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    return data.space;
  };

  // ------------------------
  // Measurements
  // ------------------------
  const createMeasurement = async (projectId: number, measurement: Partial<Measurement>) => {
    const res = await fetch(API_ROUTES.measurements(projectId), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(measurement),
    });
    const data = await res.json();
    return data.measurement;
  };

  const updateMeasurement = async (
    projectId: number,
    measurementId: number,
    updates: Partial<Measurement>
  ) => {
    const res = await fetch(API_ROUTES.measurement(projectId, measurementId), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    return data.measurement;
  };

  // ------------------------
  // Products in Measurements
  // ------------------------
  const addProductToMeasurement = async (
    projectId: number,
    measurementId: number,
    product: Product
  ) => {
    const res = await fetch(
      API_ROUTES.addProductToMeasurement(projectId, measurementId),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(product),
      }
    );
    const data = await res.json();
    return data.product;
  };

  const removeProductFromMeasurement = async (
    projectId: number,
    measurementId: number,
    sku: string
  ) => {
    await fetch(
      API_ROUTES.removeProductFromMeasurement(projectId, measurementId, sku),
      { method: 'DELETE' }
    );
  };

  // ------------------------
  // Products master list
  // ------------------------
  const getProducts = async (): Promise<Product[]> => {
    const res = await fetch(API_ROUTES.products);
    return await res.json();
  };

  const getProduct = async (id: number): Promise<Product> => {
    const res = await fetch(API_ROUTES.product(id));
    return await res.json();
  };

  return {
    getProjects,
    getProject,
    createProject,
    updateProject,
    createSpace,
    updateSpace,
    createMeasurement,
    updateMeasurement,
    addProductToMeasurement,
    removeProductFromMeasurement,
    getProducts,
    getProduct,
  };
}
