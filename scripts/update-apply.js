#!/usr/bin/env node
/**
 * HomeFit Update Applier
 * Downloads and applies updates from GitHub
 */

import https from 'https'
import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const GITHUB_REPO = process.env.GITHUB_REPO || 'arjohnson15/HomeFit_app'
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main'
const PROJECT_ROOT = path.join(__dirname, '..')

// Create backup of current state
function createBackup() {
  const backupDir = path.join(PROJECT_ROOT, 'backups')
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupPath = path.join(backupDir, `backup-${timestamp}`)

  console.log('Creating backup...')

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true })
  }

  // Backup important files
  const filesToBackup = [
    'package.json',
    '.env',
    'src/server/prisma/schema.prisma'
  ]

  fs.mkdirSync(backupPath, { recursive: true })

  for (const file of filesToBackup) {
    const srcPath = path.join(PROJECT_ROOT, file)
    if (fs.existsSync(srcPath)) {
      const destPath = path.join(backupPath, file)
      fs.mkdirSync(path.dirname(destPath), { recursive: true })
      fs.copyFileSync(srcPath, destPath)
    }
  }

  console.log(`Backup created at: ${backupPath}`)
  return backupPath
}

// Download file from GitHub
function downloadFile(filePath) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'raw.githubusercontent.com',
      path: `/${GITHUB_REPO}/${GITHUB_BRANCH}/${filePath}`,
      method: 'GET',
      headers: {
        'User-Agent': 'HomeFit-Updater'
      }
    }

    const req = https.request(options, (res) => {
      if (res.statusCode === 404) {
        resolve(null) // File doesn't exist
        return
      }

      let data = ''
      res.on('data', (chunk) => {
        data += chunk
      })
      res.on('end', () => {
        resolve(data)
      })
    })

    req.on('error', reject)
    req.end()
  })
}

// Apply update using git pull
async function applyUpdateWithGit() {
  console.log('Applying update via git pull...')

  try {
    // Stash any local changes
    execSync('git stash', { cwd: PROJECT_ROOT, stdio: 'inherit' })

    // Pull latest changes
    execSync(`git pull origin ${GITHUB_BRANCH}`, { cwd: PROJECT_ROOT, stdio: 'inherit' })

    // Install dependencies
    console.log('Installing dependencies...')
    execSync('npm run setup', { cwd: PROJECT_ROOT, stdio: 'inherit' })

    // Run database migrations
    console.log('Running database migrations...')
    execSync('npm run db:migrate', { cwd: PROJECT_ROOT, stdio: 'inherit' })

    console.log('Update applied successfully!')
    return true
  } catch (error) {
    console.error('Git update failed:', error.message)
    return false
  }
}

// Main update function
async function applyUpdate() {
  console.log('HomeFit Update Applier')
  console.log('======================')
  console.log('')

  // Check if git is available and we're in a git repo
  let useGit = false
  try {
    execSync('git status', { cwd: PROJECT_ROOT, stdio: 'pipe' })
    useGit = true
  } catch {
    console.log('Git not available or not a git repository.')
    console.log('Manual update required.')
    console.log('')
    console.log('To update manually:')
    console.log(`1. Download the latest code from https://github.com/${GITHUB_REPO}`)
    console.log('2. Extract and replace the source files')
    console.log('3. Run: npm run setup')
    console.log('4. Run: npm run db:migrate')
    return
  }

  if (useGit) {
    // Create backup first
    const backupPath = createBackup()

    console.log('')

    const success = await applyUpdateWithGit()

    if (!success) {
      console.log('')
      console.log('Update failed. Your backup is at:', backupPath)
      console.log('You may need to restore from backup manually.')
    }
  }
}

// Run if called directly
applyUpdate()

export { applyUpdate, createBackup }
