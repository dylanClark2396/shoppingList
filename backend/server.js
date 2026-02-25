import express from 'express';
import fs from 'fs';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const DATA_FILE = './data/projects.json';
const PRODUCTS_FILE = '../python/output/data.json';

// =========================
// 🔧 ID GENERATOR
// =========================

function generateId() {
  return Date.now() + Math.floor(Math.random() * 1000);
}

// =========================
// 🔧 FILE HELPERS
// =========================

function readJson(file, fallback = []) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    console.error('Read error:', err);
    return fallback;
  }
}

function writeJsonAtomic(file, data) {
  const temp = file + '.tmp';
  fs.writeFileSync(temp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(temp, file);
}

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// =========================
// 📦 PROJECT ROUTES
// =========================

// GET all projects
app.get('/projects', (req, res) => {
  const data = readJson(DATA_FILE, []);
  res.json(data);
});

// GET single project
app.get('/projects/:id', (req, res) => {
  const projects = readJson(DATA_FILE, []);
  const project = projects.find(p => p.id === Number(req.params.id));

  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  res.json(project);
});

// =========================
// ✨ CREATE PROJECT
// =========================

app.post('/projects', (req, res) => {
  const projects = readJson(DATA_FILE, []);

  const newProject = {
    id: generateId(),
    name: req.body.name,
    spaces: (req.body.spaces || []).map(s => ({
      id: generateId(),
      name: s.name ?? s,
      measurements: []
    }))
  };

  projects.push(newProject);
  writeJsonAtomic(DATA_FILE, projects);

  res.json({ status: 'ok', project: newProject });
});

// =========================
// ✏️ UPDATE PROJECT
// =========================

app.patch('/projects/:id', (req, res) => {
  const projects = readJson(DATA_FILE, []);
  const project = projects.find(p => p.id === Number(req.params.id));

  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  Object.assign(project, req.body);

  writeJsonAtomic(DATA_FILE, projects);
  res.json({ status: 'ok', project });
});

// =========================
// ❌ DELETE PROJECT (optional but useful)
// =========================

app.delete('/projects/:id', (req, res) => {
  let projects = readJson(DATA_FILE, []);
  projects = projects.filter(p => p.id !== Number(req.params.id));

  writeJsonAtomic(DATA_FILE, projects);
  res.json({ status: 'ok' });
});

// =========================
// 🏠 SPACES
// =========================

// ➕ Add space
app.post('/projects/:projectId/spaces', (req, res) => {
  const projects = readJson(DATA_FILE, []);
  const project = projects.find(p => p.id === Number(req.params.projectId));

  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  project.spaces = project.spaces || [];

  const space = {
    id: generateId(),
    name: req.body.name,
    measurements: []
  };

  project.spaces.push(space);

  writeJsonAtomic(DATA_FILE, projects);
  res.json({ status: 'ok', space });
});

// ✏️ Update space
app.patch('/projects/:projectId/spaces/:spaceId', (req, res) => {
  const projects = readJson(DATA_FILE, []);
  const project = projects.find(p => p.id === Number(req.params.projectId));
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const space = project.spaces?.find(
    s => s.id === Number(req.params.spaceId)
  );
  if (!space) return res.status(404).json({ error: 'Space not found' });

  Object.assign(space, req.body);

  writeJsonAtomic(DATA_FILE, projects);
  res.json({ status: 'ok', space });
});

// ❌ Delete space
app.delete('/projects/:projectId/spaces/:spaceId', (req, res) => {
  const projects = readJson(DATA_FILE, []);
  const project = projects.find(p => p.id === Number(req.params.projectId));
  if (!project) return res.status(404).json({ error: 'Project not found' });

  project.spaces = (project.spaces || []).filter(
    s => s.id !== Number(req.params.spaceId)
  );

  writeJsonAtomic(DATA_FILE, projects);
  res.json({ status: 'ok' });
});

// =========================
// 📐 MEASUREMENTS (UNDER SPACE)
// =========================

// ➕ Add measurement
app.post(
  '/projects/:projectId/spaces/:spaceId/measurements',
  (req, res) => {
    const projects = readJson(DATA_FILE, []);
    const project = projects.find(p => p.id === Number(req.params.projectId));
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const space = project.spaces?.find(
      s => s.id === Number(req.params.spaceId)
    );
    if (!space) return res.status(404).json({ error: 'Space not found' });

    space.measurements = space.measurements || [];

    const measurement = {
      id: generateId(),
      ...req.body,
      products: []
    };

    space.measurements.push(measurement);

    writeJsonAtomic(DATA_FILE, projects);
    res.json({ status: 'ok', measurement });
  }
);

// ✏️ Update measurement
app.patch(
  '/projects/:projectId/spaces/:spaceId/measurements/:measurementId',
  (req, res) => {
    const projects = readJson(DATA_FILE, []);
    const project = projects.find(p => p.id === Number(req.params.projectId));
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const space = project.spaces?.find(
      s => s.id === Number(req.params.spaceId)
    );
    if (!space) return res.status(404).json({ error: 'Space not found' });

    const measurement = space.measurements?.find(
      m => m.id === Number(req.params.measurementId)
    );
    if (!measurement)
      return res.status(404).json({ error: 'Measurement not found' });

    Object.assign(measurement, req.body);

    writeJsonAtomic(DATA_FILE, projects);
    res.json({ status: 'ok', measurement });
  }
);

// ❌ Delete measurement
app.delete(
  '/projects/:projectId/spaces/:spaceId/measurements/:measurementId',
  (req, res) => {
    const projects = readJson(DATA_FILE, []);
    const project = projects.find(p => p.id === Number(req.params.projectId));
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const space = project.spaces?.find(
      s => s.id === Number(req.params.spaceId)
    );
    if (!space) return res.status(404).json({ error: 'Space not found' });

    space.measurements = (space.measurements || []).filter(
      m => m.id !== Number(req.params.measurementId)
    );

    writeJsonAtomic(DATA_FILE, projects);
    res.json({ status: 'ok' });
  }
);

// =========================
// 🛍 PRODUCTS IN MEASUREMENT
// =========================

// ➕ Add product
app.post(
  '/projects/:projectId/spaces/:spaceId/measurements/:measurementId/products',
  (req, res) => {
    const projects = readJson(DATA_FILE, []);
    const project = projects.find(p => p.id === Number(req.params.projectId));
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const space = project.spaces?.find(
      s => s.id === Number(req.params.spaceId)
    );
    if (!space) return res.status(404).json({ error: 'Space not found' });

    const measurement = space.measurements?.find(
      m => m.id === Number(req.params.measurementId)
    );
    if (!measurement)
      return res.status(404).json({ error: 'Measurement not found' });

    measurement.products = measurement.products || [];

    const product = req.body;

    const exists = measurement.products.some(p => p.sku === product.sku);
    if (exists) {
      return res.status(400).json({ error: 'Product already exists' });
    }

    measurement.products.push(product);

    writeJsonAtomic(DATA_FILE, projects);
    res.json({ status: 'ok', product });
  }
);

// ❌ Remove product
app.delete(
  '/projects/:projectId/spaces/:spaceId/measurements/:measurementId/products/:sku',
  (req, res) => {
    const projects = readJson(DATA_FILE, []);
    const project = projects.find(p => p.id === Number(req.params.projectId));
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const space = project.spaces?.find(
      s => s.id === Number(req.params.spaceId)
    );
    if (!space) return res.status(404).json({ error: 'Space not found' });

    const measurement = space.measurements?.find(
      m => m.id === Number(req.params.measurementId)
    );
    if (!measurement)
      return res.status(404).json({ error: 'Measurement not found' });

    measurement.products = (measurement.products || []).filter(
      p => p.sku !== req.params.sku
    );

    writeJsonAtomic(DATA_FILE, projects);
    res.json({ status: 'ok' });
  }
);

app.patch(
  '/projects/:projectId/spaces/:spaceId/measurements/:measurementId/products/:sku',
  (req, res) => {
    const projects = readJson(DATA_FILE, []);
    const project = projects.find(p => p.id === Number(req.params.projectId));
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const space = project.spaces?.find(
      s => s.id === Number(req.params.spaceId)
    );
    if (!space) return res.status(404).json({ error: 'Space not found' });

    const measurement = space.measurements?.find(
      m => m.id === Number(req.params.measurementId)
    );
    if (!measurement)
      return res.status(404).json({ error: 'Measurement not found' });

    const product = measurement.products?.find(
      p => p.sku === req.params.sku
    );
    if (!product)
      return res.status(404).json({ error: 'Product not found' });

    const updates = req.body;

    if (!updates || Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    // Prevent immutable fields
    if ('sku' in updates) {
      return res.status(400).json({ error: 'Cannot update SKU' });
    }

    Object.assign(product, updates);

    writeJsonAtomic(DATA_FILE, projects);

    res.json({ status: 'ok', product });
  }
);

// =========================
// 🛍 PRODUCTS MASTER LIST
// =========================

app.get('/products', (req, res) => {
  const data = readJson(PRODUCTS_FILE, []);
  res.json(data);
});

app.get('/products/:id', (req, res) => {
  const data = readJson(PRODUCTS_FILE, []);
  const product = data.find(p => p.id === Number(req.params.id));

  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  res.json(product);
});

// =========================
// 🚀 START SERVER
// =========================

app.listen(3000, "0.0.0.0", () =>
  console.log('Server running on port 3000')
);
