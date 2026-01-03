/**
 * HomeFit Update Service
 * Checks GitHub for new releases and manages update process
 */

const GITHUB_REPO = process.env.GITHUB_REPO || 'arjohnson15/HomeFit_app'
const GITHUB_API = 'https://api.github.com'

class UpdateService {
  constructor() {
    this.cache = null
    this.cacheTime = null
    this.cacheDuration = 5 * 60 * 1000 // 5 minutes
  }

  /**
   * Get current app version
   */
  getCurrentVersion() {
    return process.env.APP_VERSION || '1.0.0'
  }

  /**
   * Parse version string to comparable object
   */
  parseVersion(version) {
    const clean = version.replace(/^v/, '')
    const parts = clean.split('.')
    return {
      major: parseInt(parts[0] || 0),
      minor: parseInt(parts[1] || 0),
      patch: parseInt(parts[2] || 0),
      raw: clean
    }
  }

  /**
   * Compare two versions
   * Returns: 1 if a > b, -1 if a < b, 0 if equal
   */
  compareVersions(a, b) {
    const vA = this.parseVersion(a)
    const vB = this.parseVersion(b)

    if (vA.major !== vB.major) return vA.major > vB.major ? 1 : -1
    if (vA.minor !== vB.minor) return vA.minor > vB.minor ? 1 : -1
    if (vA.patch !== vB.patch) return vA.patch > vB.patch ? 1 : -1
    return 0
  }

  /**
   * Fetch latest release from GitHub
   */
  async fetchLatestRelease() {
    // Check cache first
    if (this.cache && this.cacheTime && (Date.now() - this.cacheTime) < this.cacheDuration) {
      return this.cache
    }

    try {
      const response = await fetch(`${GITHUB_API}/repos/${GITHUB_REPO}/releases/latest`, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'HomeFit-App'
        }
      })

      if (response.status === 404) {
        // No releases yet
        return null
      }

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`)
      }

      const release = await response.json()

      // Cache the result
      this.cache = release
      this.cacheTime = Date.now()

      return release
    } catch (error) {
      console.error('[UpdateService] Failed to fetch latest release:', error.message)
      throw error
    }
  }

  /**
   * Fetch all releases from GitHub
   */
  async fetchAllReleases(limit = 10) {
    try {
      const response = await fetch(`${GITHUB_API}/repos/${GITHUB_REPO}/releases?per_page=${limit}`, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'HomeFit-App'
        }
      })

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('[UpdateService] Failed to fetch releases:', error.message)
      throw error
    }
  }

  /**
   * Check for available updates
   */
  async checkForUpdates() {
    const currentVersion = this.getCurrentVersion()

    try {
      const latestRelease = await this.fetchLatestRelease()

      if (!latestRelease) {
        return {
          currentVersion,
          latestVersion: currentVersion,
          updateAvailable: false,
          message: 'No releases found on GitHub'
        }
      }

      const latestVersion = latestRelease.tag_name.replace(/^v/, '')
      const comparison = this.compareVersions(latestVersion, currentVersion)
      const updateAvailable = comparison > 0

      return {
        currentVersion,
        latestVersion,
        updateAvailable,
        releaseUrl: latestRelease.html_url,
        releaseNotes: latestRelease.body || '',
        releaseName: latestRelease.name || `v${latestVersion}`,
        publishedAt: latestRelease.published_at,
        downloadUrl: latestRelease.tarball_url
      }
    } catch (error) {
      // Return current version info even on error
      return {
        currentVersion,
        latestVersion: currentVersion,
        updateAvailable: false,
        error: error.message
      }
    }
  }

  /**
   * Get version history (changelog)
   */
  async getVersionHistory() {
    try {
      const releases = await this.fetchAllReleases(10)

      return releases.map(release => ({
        version: release.tag_name.replace(/^v/, ''),
        name: release.name || release.tag_name,
        notes: release.body || '',
        publishedAt: release.published_at,
        url: release.html_url
      }))
    } catch (error) {
      return []
    }
  }

  /**
   * Clear the release cache
   */
  clearCache() {
    this.cache = null
    this.cacheTime = null
  }
}

const updateService = new UpdateService()
export default updateService
