/**
 * HomeFit Updater Service
 * Handles automatic updates from within Docker environment
 */

const express = require('express')
const { exec, spawn } = require('child_process')
const fs = require('fs')
const path = require('path')

const app = express()
app.use(express.json())

const PORT = 9999
const PROJECT_DIR = '/project'
const UPDATE_SECRET = process.env.UPDATE_SECRET || 'homefit-update-secret'

// Track update status
let updateStatus = {
  inProgress: false,
  lastUpdate: null,
  lastResult: null,
  logs: []
}

// Helper to run shell commands with timeout
function runCommand(cmd, cwd = PROJECT_DIR, timeoutMs = 300000) {
  return new Promise((resolve, reject) => {
    console.log(`[Updater] Running: ${cmd}`)
    updateStatus.logs.push(`$ ${cmd}`)

    const child = exec(cmd, { cwd, maxBuffer: 10 * 1024 * 1024, timeout: timeoutMs }, (error, stdout, stderr) => {
      if (stdout) {
        console.log(stdout)
        updateStatus.logs.push(stdout)
      }
      if (stderr) {
        console.error(stderr)
        updateStatus.logs.push(stderr)
      }
      if (error) {
        reject(error)
      } else {
        resolve(stdout)
      }
    })

    // Extra timeout safety
    const timer = setTimeout(() => {
      child.kill('SIGTERM')
      reject(new Error(`Command timed out after ${timeoutMs / 1000} seconds: ${cmd}`))
    }, timeoutMs + 5000)

    child.on('exit', () => clearTimeout(timer))
  })
}

// Track if frontend is ready
let frontendReady = false

// Health check - only healthy when frontend is built
app.get('/health', (req, res) => {
  const distPath = path.join(PROJECT_DIR, 'src', 'client', 'dist', 'index.html')
  const ready = fs.existsSync(distPath)

  if (ready) {
    frontendReady = true
    res.json({ status: 'ok', service: 'homefit-updater', frontendReady: true })
  } else {
    res.status(503).json({ status: 'waiting', service: 'homefit-updater', frontendReady: false, message: 'Building frontend...' })
  }
})

// Get update status
app.get('/status', (req, res) => {
  res.json(updateStatus)
})

// Trigger update
app.post('/update', async (req, res) => {
  const { secret } = req.body

  // Verify secret
  if (secret !== UPDATE_SECRET) {
    return res.status(403).json({ error: 'Invalid secret' })
  }

  // Check if update already in progress
  if (updateStatus.inProgress) {
    return res.status(409).json({
      error: 'Update already in progress',
      status: updateStatus
    })
  }

  // Start update process
  updateStatus.inProgress = true
  updateStatus.logs = []
  updateStatus.lastUpdate = new Date().toISOString()

  // Respond immediately that update has started
  res.json({
    message: 'Update started',
    status: 'in_progress'
  })

  // Run update in background
  try {
    console.log('[Updater] Starting update process...')
    updateStatus.logs.push('Starting update process...')

    // Step 1: Git fetch and check for changes
    await runCommand('git fetch origin main')

    // Step 2: Get current and remote commit
    const localCommit = await runCommand('git rev-parse HEAD')
    const remoteCommit = await runCommand('git rev-parse origin/main')

    if (localCommit.trim() === remoteCommit.trim()) {
      updateStatus.logs.push('Already up to date!')
      updateStatus.lastResult = 'already_current'
      updateStatus.inProgress = false
      console.log('[Updater] Already up to date')
      return
    }

    // Step 3: Pull latest changes
    updateStatus.logs.push('Pulling latest changes...')
    await runCommand('git pull origin main')

    // Step 4: Build frontend (source is volume-mounted, so no Docker rebuild needed)
    updateStatus.logs.push('Building frontend...')
    const clientDir = path.join(PROJECT_DIR, 'src', 'client')
    await runCommand('npm install', clientDir, 120000)
    await runCommand('npm run build', clientDir, 120000)

    // Step 5: Restart the app container to pick up changes
    updateStatus.logs.push('Restarting application...')
    const composeFile = path.join(PROJECT_DIR, 'production', 'docker-compose.yml')
    await runCommand(`docker compose -f ${composeFile} restart app`)

    updateStatus.lastResult = 'success'
    updateStatus.logs.push('Update completed successfully!')
    console.log('[Updater] Update completed successfully')

  } catch (error) {
    console.error('[Updater] Update failed:', error)
    updateStatus.lastResult = 'failed'
    updateStatus.logs.push(`Error: ${error.message}`)
  } finally {
    updateStatus.inProgress = false
  }
})

// Clear logs
app.post('/clear-logs', (req, res) => {
  updateStatus.logs = []
  res.json({ message: 'Logs cleared' })
})

// Check if frontend needs initial build on startup
async function ensureFrontendBuilt() {
  const distPath = path.join(PROJECT_DIR, 'src', 'client', 'dist')
  const indexPath = path.join(distPath, 'index.html')

  if (!fs.existsSync(indexPath)) {
    console.log('[Updater] Frontend not built yet, building now...')
    try {
      const clientDir = path.join(PROJECT_DIR, 'src', 'client')
      await runCommand('npm install', clientDir, 180000)
      await runCommand('npm run build', clientDir, 180000)
      console.log('[Updater] Frontend built successfully!')
    } catch (error) {
      console.error('[Updater] Failed to build frontend:', error.message)
    }
  } else {
    console.log('[Updater] Frontend already built')
  }
}

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`[Updater] HomeFit Updater Service running on port ${PORT}`)
  console.log(`[Updater] Project directory: ${PROJECT_DIR}`)

  // Build frontend if needed
  await ensureFrontendBuilt()
})
