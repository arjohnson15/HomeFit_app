/**
 * Timezone utility for converting between client local time and server UTC.
 * The client sends its IANA timezone (e.g., 'America/Chicago') via the
 * X-Timezone header on every API request. These helpers use that to
 * compute correct day boundaries and dates in the user's local timezone.
 *
 * Note: The offset calculation uses Date.parse of toLocaleString output,
 * which works because the server runs in UTC (Docker TZ=UTC).
 */

/**
 * Get UTC boundaries for "today" in the client's timezone.
 * @param {string|null} timezone - IANA timezone name from X-Timezone header
 * @returns {{ startOfDay: Date, endOfDay: Date, localDate: string }}
 */
export function getLocalDayBounds(timezone) {
  if (!timezone) return _utcDayBounds()
  try {
    const localDate = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date())
    const offsetMs = _getOffsetMs(timezone)
    const startOfDay = new Date(localDate + 'T00:00:00.000Z')
    startOfDay.setTime(startOfDay.getTime() + offsetMs)
    const endOfDay = new Date(startOfDay.getTime() + 86400000)
    return { startOfDay, endOfDay, localDate }
  } catch {
    return _utcDayBounds()
  }
}

/**
 * Get today's date as YYYY-MM-DD in the client's timezone.
 * @param {string|null} timezone - IANA timezone name
 * @returns {string} Date string like '2026-02-18'
 */
export function getLocalDate(timezone) {
  if (!timezone) return new Date().toISOString().split('T')[0]
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date())
  } catch {
    return new Date().toISOString().split('T')[0]
  }
}

/**
 * Convert a YYYY-MM-DD date string to a UTC Date representing midnight
 * in the client's timezone on that date.
 * @param {string} dateStr - Date string like '2026-02-18'
 * @param {string|null} timezone - IANA timezone name
 * @returns {Date}
 */
export function localMidnightToUTC(dateStr, timezone) {
  if (!timezone) return new Date(dateStr + 'T00:00:00.000Z')
  try {
    const offsetMs = _getOffsetMs(timezone)
    const date = new Date(dateStr + 'T00:00:00.000Z')
    date.setTime(date.getTime() + offsetMs)
    return date
  } catch {
    return new Date(dateStr + 'T00:00:00.000Z')
  }
}

/**
 * Extract client timezone from Express request headers.
 * @param {import('express').Request} req
 * @returns {string|null}
 */
export function getClientTimezone(req) {
  return req.headers['x-timezone'] || null
}

// --- Internal helpers ---

function _getOffsetMs(timezone) {
  const now = new Date()
  const utcMs = Date.parse(now.toLocaleString('en-US', { timeZone: 'UTC' }))
  const localMs = Date.parse(now.toLocaleString('en-US', { timeZone: timezone }))
  return utcMs - localMs
}

function _utcDayBounds() {
  const start = new Date()
  start.setUTCHours(0, 0, 0, 0)
  const end = new Date(start.getTime() + 86400000)
  return { startOfDay: start, endOfDay: end, localDate: start.toISOString().split('T')[0] }
}
