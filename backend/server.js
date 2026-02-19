import express from 'express';
import fs from 'fs';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const DATA_FILE = './data/projects.json';
const PRODUCTS_FILE = '../python/output/data.json';

function generateId() {
  // simple millisecond-based unique ID
  return Date.now() + Math.floor(Math.random() * 1000);
}


// =========================
// 🔧 FILE HELPERS (SAFE)
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
  const newProject = req.body;

  if (!newProject.id) newProject.id = generateId();

  newProject.spaces = newProject.spaces || [];
  newProject.measurements = newProject.measurements || [];

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
// ➕ ADD SPACE
// =========================

// Add a new space to a project
app.post('/projects/:id/spaces', (req, res) => {
  const projects = readJson(DATA_FILE);
  const project = projects.find(p => p.id === Number(req.params.id));

  if (!project) return res.status(404).json({ error: 'Project not found' });

  const newSpace = req.body;

  if (!newSpace.id) newSpace.id = generateId();
  project.spaces.push({ ...newSpace });

  writeJsonAtomic(DATA_FILE, projects);
  res.json({ status: 'ok', space: newSpace });
});


// =========================
// ✏️ UPDATE SPACE
// =========================

// Update a space
app.patch('/projects/:projectId/spaces/:spaceId', (req, res) => {
  const projects = readJson(DATA_FILE);
  const project = projects.find(p => p.id === Number(req.params.projectId));
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const space = project.spaces.find((s) => s.id === Number(req.params.spaceId));
  if (!space) return res.status(404).json({ error: 'Space not found' });

  Object.assign(space, req.body); // update name or measurements
  writeJsonAtomic(DATA_FILE, projects);

  res.json({ status: 'ok', space });
});


// =========================
// 📐 ADD MEASUREMENT
// =========================

app.post('/projects/:projectId/measurements', (req, res) => {
  const projects = readJson(DATA_FILE, []);
  const project = projects.find(p => p.id === Number(req.params.projectId));

  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  const measurement = req.body;

  if (!measurement.id) measurement.id = generateId();
  measurement.products = measurement.products || [];

  project.measurements = project.measurements || [];

  project.measurements.push(measurement);

  writeJsonAtomic(DATA_FILE, projects);
  res.json({ status: 'ok', measurement });
});


// =========================
// ✏️ UPDATE MEASUREMENT
// =========================

app.patch('/projects/:projectId/measurements/:measurementId', (req, res) => {
  const projects = readJson(DATA_FILE, []);
  const project = projects.find(p => p.id === Number(req.params.projectId));

  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  const measurement = project.measurements?.find(
    m => m.id === Number(req.params.measurementId)
  );

  if (!measurement) {
    return res.status(404).json({ error: 'Measurement not found' });
  }

  Object.assign(measurement, req.body);

  writeJsonAtomic(DATA_FILE, projects);
  res.json({ status: 'ok', measurement });
});


// =========================
// ➕ ADD PRODUCT TO MEASUREMENT
// =========================

app.post(
  '/projects/:projectId/measurements/:measurementId/product',
  (req, res) => {
    const projects = readJson(DATA_FILE, []);
    const project = projects.find(p => p.id === Number(req.params.projectId));

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const measurement = project.measurements?.find(
      m => m.id === Number(req.params.measurementId)
    );

    if (!measurement) {
      return res.status(404).json({ error: 'Measurement not found' });
    }

    const product = req.body;

    if (!product.id) product.id = generateId(); // assign id if missing

    measurement.products = measurement.products || [];

    // prevent duplicates
    const exists = measurement.products.some(p => p.sku === product.sku);
    if (exists) {
      return res.status(400).json({ error: 'Product already exists' });
    }

    measurement.products.push(product);

    writeJsonAtomic(DATA_FILE, projects);
    res.json({ status: 'ok', product });
  }
);


// =========================
// ❌ REMOVE PRODUCT
// =========================

app.delete(
  '/projects/:projectId/measurements/:measurementId/products/:sku',
  (req, res) => {
    const projects = readJson(DATA_FILE, []);
    const project = projects.find(p => p.id === Number(req.params.projectId));

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const measurement = project.measurements?.find(
      m => m.id === Number(req.params.measurementId)
    );

    if (!measurement) {
      return res.status(404).json({ error: 'Measurement not found' });
    }

    measurement.products = (measurement.products || []).filter(
      p => p.sku !== req.params.sku
    );

    writeJsonAtomic(DATA_FILE, projects);
    res.json({ status: 'ok' });
  }
);


// =========================
// 🛍 PRODUCTS ROUTES
// =========================

// GET all products
app.get('/products', (req, res) => {
  const data = readJson(PRODUCTS_FILE, []);
  res.json(data);
});

// GET product by id
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

app.listen(3000, () =>
  console.log('Server running on http://localhost:3000')
);
