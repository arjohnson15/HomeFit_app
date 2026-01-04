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

// Helper to run shell commands
function runCommand(cmd, cwd = PROJECT_DIR) {
  return new Promise((resolve, reject) => {
    console.log(`[Updater] Running: ${cmd}`)
    updateStatus.logs.push(`$ ${cmd}`)

    exec(cmd, { cwd, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
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
  })
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'homefit-updater' })
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

    // Step 4: Rebuild and restart containers
    updateStatus.logs.push('Rebuilding containers...')

    // Use docker-compose to rebuild and restart
    const composeFile = path.join(PROJECT_DIR, 'production', 'docker-compose.yml')

    // Build new images
    await runCommand(`docker-compose -f ${composeFile} build --no-cache homefit`)

    // Restart the main app container (not the updater)
    updateStatus.logs.push('Restarting application...')
    await runCommand(`docker-compose -f ${composeFile} up -d homefit`)

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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Updater] HomeFit Updater Service running on port ${PORT}`)
  console.log(`[Updater] Project directory: ${PROJECT_DIR}`)
})
