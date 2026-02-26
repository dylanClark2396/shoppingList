import express from 'express'
import cors from 'cors'
import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  ScanCommand,
  DeleteCommand
} from "@aws-sdk/lib-dynamodb"

// =========================
// 🚀 APP SETUP
// =========================

const app = express()
app.use(cors())
app.use(express.json())

// =========================
// 🗄 DYNAMODB SETUP
// =========================

const client = new DynamoDBClient({
  region: "us-east-1" // change if needed
})

const db = DynamoDBDocumentClient.from(client)
const PROJECT_TABLE = "Projects"
const PRODUCTS_TABLE = "Products"

// =========================
// 🔧 HELPERS
// =========================

function generateId() {
  return Date.now() + Math.floor(Math.random() * 1000)
}

async function getProject(projectId) {
  const result = await db.send(new GetCommand({
    TableName: PROJECT_TABLE,
    Key: { id: Number(projectId) }
  }))
  return result.Item
}

async function saveProject(project) {
  await db.send(new PutCommand({
    TableName: PROJECT_TABLE,
    Item: project
  }))
}

// =========================
// ❤️ HEALTH
// =========================

app.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

// =========================
// 📦 PROJECT ROUTES
// =========================

app.get('/projects', async (req, res) => {
  try {
    const result = await db.send(new ScanCommand({
      TableName: PROJECT_TABLE
    }))
    res.json(result.Items || [])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch projects' })
  }
})

app.get('/projects/:id', async (req, res) => {
  try {
    const project = await getProject(req.params.id)
    if (!project) return res.status(404).json({ error: 'Project not found' })
    res.json(project)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch project' })
  }
})

app.post('/projects', async (req, res) => {
  try {
    const id = generateId()

    const newProject = {
      PK: `${id}`,
      id,
      name: req.body.name,
      spaces: (req.body.spaces || []).map(s => ({
        id: generateId(),
        name: s.name ?? s,
        measurements: []
      }))
    }

    await saveProject(newProject)
    res.json({ status: 'ok', project: newProject })

  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to create project' })
  }
})

app.patch('/projects/:id', async (req, res) => {
  try {
    const project = await getProject(req.params.id)
    if (!project) return res.status(404).json({ error: 'Project not found' })

    Object.assign(project, req.body)
    await saveProject(project)

    res.json({ status: 'ok', project })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to update project' })
  }
})

app.delete('/projects/:id', async (req, res) => {
  try {
    await db.send(new DeleteCommand({
      TableName: PROJECT_TABLE,
      Key: { PK: `${req.params.id}` }
    }))
    res.json({ status: 'ok' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to delete project' })
  }
})

// =========================
// 🏠 SPACES
// =========================

app.post('/projects/:projectId/spaces', async (req, res) => {
  try {
    const project = await getProject(req.params.projectId)
    if (!project) return res.status(404).json({ error: 'Project not found' })

    const space = {
      id: generateId(),
      name: req.body.name,
      measurements: []
    }

    project.spaces = project.spaces || []
    project.spaces.push(space)

    await saveProject(project)
    res.json({ status: 'ok', space })

  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to add space' })
  }
})

// =========================
// 📐 MEASUREMENTS
// =========================

app.post('/projects/:projectId/spaces/:spaceId/measurements', async (req, res) => {
  try {
    const project = await getProject(req.params.projectId)
    if (!project) return res.status(404).json({ error: 'Project not found' })

    const space = project.spaces?.find(s => s.id === Number(req.params.spaceId))
    if (!space) return res.status(404).json({ error: 'Space not found' })

    const measurement = {
      id: generateId(),
      ...req.body,
      products: []
    }

    space.measurements = space.measurements || []
    space.measurements.push(measurement)

    await saveProject(project)
    res.json({ status: 'ok', measurement })

  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to add measurement' })
  }
})

// =========================
// 🛍 PRODUCTS
// =========================

app.post('/projects/:projectId/spaces/:spaceId/measurements/:measurementId/products', async (req, res) => {
  try {
    const project = await getProject(req.params.projectId)
    if (!project) return res.status(404).json({ error: 'Project not found' })

    const space = project.spaces?.find(s => s.id === Number(req.params.spaceId))
    if (!space) return res.status(404).json({ error: 'Space not found' })

    const measurement = space.measurements?.find(m => m.id === Number(req.params.measurementId))
    if (!measurement) return res.status(404).json({ error: 'Measurement not found' })

    measurement.products = measurement.products || []

    if (measurement.products.some(p => p.sku === req.body.sku)) {
      return res.status(400).json({ error: 'Product already exists' })
    }

    measurement.products.push(req.body)

    await saveProject(project)
    res.json({ status: 'ok', product: req.body })

  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to add product' })
  }
})

app.get('/products/:id', async (req, res) => {
  try {
    const result = await db.send(new GetCommand({
      TableName: PRODUCTS_TABLE,
      Key: { sku: Number(req.params.id) }
    }))

    if (!result.Item) {
      return res.status(404).json({ error: 'Product not found' })
    }

    res.json(result.Item)

  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch product' })
  }
})

// =========================
// 🚀 START SERVER
// =========================

app.listen(3000, "0.0.0.0", () => {
  console.log('Server running on port 3000')
})