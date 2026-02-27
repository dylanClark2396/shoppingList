import 'dotenv/config';
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
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

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
  region: "us-east-2" // change if needed
})

const db = DynamoDBDocumentClient.from(client)
const PROJECT_TABLE = "Projects"
const PRODUCTS_TABLE = "Products"

// =========================
// 📸 S3 SETUP
// =========================

const IMAGE_BUCKET = process.env.S3_IMAGES_BUCKET

const s3 = new S3Client({
  region: 'us-east-2',
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
})

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
    const newProject = {
      id: generateId(),
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
      Key: { id: Number(req.params.id) }
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

// ➕ Add space
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

// ✏️ Update space
app.patch('/projects/:projectId/spaces/:spaceId', async (req, res) => {
  try {
    const project = await getProject(req.params.projectId)
    if (!project) return res.status(404).json({ error: 'Project not found' })

    const space = project.spaces?.find(s => s.id === Number(req.params.spaceId))
    if (!space) return res.status(404).json({ error: 'Space not found' })

    Object.assign(space, req.body)

    await saveProject(project)
    res.json({ status: 'ok', space })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to update space' })
  }
})

// 📸 Presigned upload URL for space photo
app.get('/projects/:projectId/spaces/:spaceId/upload-url', async (req, res) => {
  try {
    const { filename, contentType } = req.query
    if (!filename) return res.status(400).json({ error: 'filename required' })

    const key = `spaces/${req.params.spaceId}/${Date.now()}-${filename}`
    const command = new PutObjectCommand({
      Bucket: IMAGE_BUCKET,
      Key: key,
      ContentType: contentType || 'application/octet-stream'
    })
    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 })
    const publicUrl = `https://${IMAGE_BUCKET}.s3.us-east-2.amazonaws.com/${key}`

    res.json({ uploadUrl, publicUrl })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to generate upload URL' })
  }
})

// 🗑 Delete space photo
app.delete('/projects/:projectId/spaces/:spaceId/images', async (req, res) => {
  try {
    const { url } = req.body
    if (!url) return res.status(400).json({ error: 'url required' })

    const key = new URL(url).pathname.slice(1)
    await s3.send(new DeleteObjectCommand({ Bucket: IMAGE_BUCKET, Key: key }))

    const project = await getProject(req.params.projectId)
    if (!project) return res.status(404).json({ error: 'Project not found' })

    const space = project.spaces?.find(s => s.id === Number(req.params.spaceId))
    if (!space) return res.status(404).json({ error: 'Space not found' })

    space.images = (space.images || []).filter(i => i !== url)

    await saveProject(project)
    res.json({ status: 'ok' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to delete image' })
  }
})

// ❌ Delete space
app.delete('/projects/:projectId/spaces/:spaceId', async (req, res) => {
  try {
    const project = await getProject(req.params.projectId)
    if (!project) return res.status(404).json({ error: 'Project not found' })

    project.spaces = (project.spaces || []).filter(s => s.id !== Number(req.params.spaceId))

    await saveProject(project)
    res.json({ status: 'ok' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to delete space' })
  }
})

// =========================
// 📐 MEASUREMENTS
// =========================

// ➕ Add measurement
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

// ✏️ Update measurement
app.patch('/projects/:projectId/spaces/:spaceId/measurements/:measurementId', async (req, res) => {
  try {
    const project = await getProject(req.params.projectId)
    if (!project) return res.status(404).json({ error: 'Project not found' })

    const space = project.spaces?.find(s => s.id === Number(req.params.spaceId))
    if (!space) return res.status(404).json({ error: 'Space not found' })

    const measurement = space.measurements?.find(m => m.id === Number(req.params.measurementId))
    if (!measurement) return res.status(404).json({ error: 'Measurement not found' })

    Object.assign(measurement, req.body)

    await saveProject(project)
    res.json({ status: 'ok', measurement })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to update measurement' })
  }
})

// ❌ Delete measurement
app.delete('/projects/:projectId/spaces/:spaceId/measurements/:measurementId', async (req, res) => {
  try {
    const project = await getProject(req.params.projectId)
    if (!project) return res.status(404).json({ error: 'Project not found' })

    const space = project.spaces?.find(s => s.id === Number(req.params.spaceId))
    if (!space) return res.status(404).json({ error: 'Space not found' })

    space.measurements = (space.measurements || []).filter(m => m.id !== Number(req.params.measurementId))

    await saveProject(project)
    res.json({ status: 'ok' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to delete measurement' })
  }
})

// =========================
// 🛍 PRODUCTS IN MEASUREMENT
// =========================

// ➕ Add product
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

// ❌ Remove product
app.delete('/projects/:projectId/spaces/:spaceId/measurements/:measurementId/products/:sku', async (req, res) => {
  try {
    const project = await getProject(req.params.projectId)
    if (!project) return res.status(404).json({ error: 'Project not found' })

    const space = project.spaces?.find(s => s.id === Number(req.params.spaceId))
    if (!space) return res.status(404).json({ error: 'Space not found' })

    const measurement = space.measurements?.find(m => m.id === Number(req.params.measurementId))
    if (!measurement) return res.status(404).json({ error: 'Measurement not found' })

    measurement.products = (measurement.products || []).filter(p => p.sku !== Number(req.params.sku))

    await saveProject(project)
    res.json({ status: 'ok' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to remove product' })
  }
})

// ✏️ Update product
app.patch('/projects/:projectId/spaces/:spaceId/measurements/:measurementId/products/:sku', async (req, res) => {
  try {
    const project = await getProject(req.params.projectId)
    if (!project) return res.status(404).json({ error: 'Project not found' })

    const space = project.spaces?.find(s => s.id === Number(req.params.spaceId))
    if (!space) return res.status(404).json({ error: 'Space not found' })

    const measurement = space.measurements?.find(m => m.id === Number(req.params.measurementId))
    if (!measurement) return res.status(404).json({ error: 'Measurement not found' })

    const product = measurement.products?.find(p => p.sku === Number(req.params.sku))
    if (!product) return res.status(404).json({ error: 'Product not found' })

    const updates = req.body

    if (!updates || Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No updates provided' })
    }

    if ('sku' in updates) {
      return res.status(400).json({ error: 'Cannot update SKU' })
    }

    Object.assign(product, updates)

    await saveProject(project)
    res.json({ status: 'ok', product })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to update product' })
  }
})

// =========================
// 🛍 PRODUCTS MASTER LIST
// =========================

app.get('/products', async (req, res) => {
  try {
    const result = await db.send(new ScanCommand({
      TableName: PRODUCTS_TABLE
    }))
    res.json(result.Items || [])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch products' })
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
