#!/usr/bin/env node
/**
 * HomeFit Update Checker
 * Checks GitHub repository for new versions
 */

import https from 'https'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const GITHUB_REPO = process.env.GITHUB_REPO || 'arjohnson15/HomeFit_app'
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main'

// Get current version from package.json
function getCurrentVersion() {
  try {
    const packagePath = path.join(__dirname, '../package.json')
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf-8'))
    return pkg.version
  } catch (error) {
    console.error('Error reading current version:', error.message)
    return '0.0.0'
  }
}

// Fetch latest commit from GitHub
function fetchLatestCommit() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${GITHUB_REPO}/commits/${GITHUB_BRANCH}`,
      method: 'GET',
      headers: {
        'User-Agent': 'HomeFit-Update-Checker',
        'Accept': 'application/vnd.github.v3+json'
      }
    }

    const req = https.request(options, (res) => {
      let data = ''

      res.on('data', (chunk) => {
        data += chunk
      })

      res.on('end', () => {
        try {
          const commit = JSON.parse(data)
          resolve({
            sha: commit.sha,
            message: commit.commit?.message,
            date: commit.commit?.committer?.date,
            author: commit.commit?.author?.name
          })
        } catch (error) {
          reject(new Error('Failed to parse GitHub response'))
        }
      })
    })

    req.on('error', reject)
    req.end()
  })
}

// Fetch package.json from GitHub to get remote version
function fetchRemoteVersion() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'raw.githubusercontent.com',
      path: `/${GITHUB_REPO}/${GITHUB_BRANCH}/package.json`,
      method: 'GET',
      headers: {
        'User-Agent': 'HomeFit-Update-Checker'
      }
    }

    const req = https.request(options, (res) => {
      let data = ''

      res.on('data', (chunk) => {
        data += chunk
      })

      res.on('end', () => {
        try {
          const pkg = JSON.parse(data)
          resolve(pkg.version)
        } catch (error) {
          // If package.json doesn't exist yet, assume same version
          resolve(getCurrentVersion())
        }
      })
    })

    req.on('error', () => {
      // If request fails, assume no update
      resolve(getCurrentVersion())
    })

    req.end()
  })
}

// Compare semantic versions
function compareVersions(current, remote) {
  const parseVersion = (v) => v.split('.').map(Number)
  const [currMajor, currMinor, currPatch] = parseVersion(current)
  const [remMajor, remMinor, remPatch] = parseVersion(remote)

  if (remMajor > currMajor) return 1
  if (remMajor < currMajor) return -1
  if (remMinor > currMinor) return 1
  if (remMinor < currMinor) return -1
  if (remPatch > currPatch) return 1
  if (remPatch < currPatch) return -1
  return 0
}

// Main check function
async function checkForUpdates() {
  console.log('HomeFit Update Checker')
  console.log('======================')
  console.log(`Repository: ${GITHUB_REPO}`)
  console.log(`Branch: ${GITHUB_BRANCH}`)
  console.log('')

  try {
    const currentVersion = getCurrentVersion()
    console.log(`Current version: ${currentVersion}`)

    const [latestCommit, remoteVersion] = await Promise.all([
      fetchLatestCommit(),
      fetchRemoteVersion()
    ])

    console.log(`Remote version: ${remoteVersion}`)
    console.log('')
    console.log('Latest commit:')
    console.log(`  SHA: ${latestCommit.sha?.substring(0, 7)}`)
    console.log(`  Message: ${latestCommit.message?.split('\n')[0]}`)
    console.log(`  Date: ${latestCommit.date}`)
    console.log(`  Author: ${latestCommit.author}`)
    console.log('')

    const comparison = compareVersions(currentVersion, remoteVersion)

    if (comparison > 0) {
      console.log('UPDATE AVAILABLE!')
      console.log(`Run 'npm run update:apply' to update to version ${remoteVersion}`)

      // Write update info to file for the app to read
      const updateInfo = {
        updateAvailable: true,
        currentVersion,
        remoteVersion,
        latestCommit,
        checkedAt: new Date().toISOString()
      }

      fs.writeFileSync(
        path.join(__dirname, '../.update-info.json'),
        JSON.stringify(updateInfo, null, 2)
      )

      return { updateAvailable: true, currentVersion, remoteVersion }
    } else {
      console.log('You are running the latest version.')
      return { updateAvailable: false, currentVersion, remoteVersion }
    }
  } catch (error) {
    console.error('Error checking for updates:', error.message)
    return { error: error.message }
  }
}

// Run if called directly
checkForUpdates()

export { checkForUpdates, getCurrentVersion, compareVersions }
