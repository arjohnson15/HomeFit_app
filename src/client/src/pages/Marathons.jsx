import { useState, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip, useMap } from 'react-leaflet'
import api from '../services/api'
import 'leaflet/dist/leaflet.css'

// Helper: interpolate position along route based on distance fraction
function getPositionAlongRoute(routeData, fraction) {
  if (!routeData || routeData.length < 2) return routeData?.[0] || [0, 0]
  if (fraction <= 0) return routeData[0]
  if (fraction >= 1) return routeData[routeData.length - 1]

  // Calculate total route length (sum of segment distances)
  let totalLen = 0
  const segLengths = []
  for (let i = 1; i < routeData.length; i++) {
    const d = Math.sqrt(
      Math.pow(routeData[i][0] - routeData[i - 1][0], 2) +
      Math.pow(routeData[i][1] - routeData[i - 1][1], 2)
    )
    segLengths.push(d)
    totalLen += d
  }

  const targetLen = totalLen * fraction
  let accum = 0
  for (let i = 0; i < segLengths.length; i++) {
    if (accum + segLengths[i] >= targetLen) {
      const segFraction = (targetLen - accum) / segLengths[i]
      return [
        routeData[i][0] + (routeData[i + 1][0] - routeData[i][0]) * segFraction,
        routeData[i][1] + (routeData[i + 1][1] - routeData[i][1]) * segFraction
      ]
    }
    accum += segLengths[i]
  }
  return routeData[routeData.length - 1]
}

// Split route into completed and remaining portions
function splitRoute(routeData, fraction) {
  if (!routeData || routeData.length < 2) return { completed: routeData || [], remaining: [] }
  if (fraction >= 1) return { completed: routeData, remaining: [] }
  if (fraction <= 0) return { completed: [], remaining: routeData }

  const midPoint = getPositionAlongRoute(routeData, fraction)

  // Find the segment index
  let totalLen = 0
  const segLengths = []
  for (let i = 1; i < routeData.length; i++) {
    const d = Math.sqrt(
      Math.pow(routeData[i][0] - routeData[i - 1][0], 2) +
      Math.pow(routeData[i][1] - routeData[i - 1][1], 2)
    )
    segLengths.push(d)
    totalLen += d
  }

  const targetLen = totalLen * fraction
  let accum = 0
  let splitIdx = 0
  for (let i = 0; i < segLengths.length; i++) {
    if (accum + segLengths[i] >= targetLen) {
      splitIdx = i + 1
      break
    }
    accum += segLengths[i]
  }

  const completed = [...routeData.slice(0, splitIdx), midPoint]
  const remaining = [midPoint, ...routeData.slice(splitIdx)]
  return { completed, remaining }
}

// Auto-fit map bounds
function FitBounds({ route }) {
  const map = useMap()
  useEffect(() => {
    if (route && route.length > 1) {
      map.fitBounds(route, { padding: [30, 30] })
    }
  }, [route, map])
  return null
}

function Marathons() {
  const [tab, setTab] = useState('myMarathons')
  const [marathons, setMarathons] = useState([])
  const [userMarathons, setUserMarathons] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewingMarathon, setViewingMarathon] = useState(null) // map view
  const [logModal, setLogModal] = useState(null) // { userMarathonId, marathonName, marathonDistance, currentDistance }
  const [logDistance, setLogDistance] = useState('')
  const [logDuration, setLogDuration] = useState('')
  const [logNotes, setLogNotes] = useState('')
  const [logSaving, setLogSaving] = useState(false)
  const [celebration, setCelebration] = useState(null)
  const [enrolling, setEnrolling] = useState(null)
  const [filter, setFilter] = useState('all') // all, run, bike

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [marathonRes, myRes] = await Promise.all([
        api.get('/marathons'),
        api.get('/marathons/my/active')
      ])
      setMarathons(marathonRes.data.marathons || [])
      setUserMarathons(myRes.data.userMarathons || [])
    } catch (err) {
      console.error('Error fetching marathons:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleEnroll = async (marathonId) => {
    setEnrolling(marathonId)
    try {
      await api.post(`/marathons/${marathonId}/enroll`)
      await fetchData()
    } catch (err) {
      console.error('Error enrolling:', err)
    } finally {
      setEnrolling(null)
    }
  }

  const handleAbandon = async (marathonId) => {
    if (!confirm('Are you sure you want to abandon this marathon? You can re-enroll later and keep your progress.')) return
    try {
      await api.delete(`/marathons/${marathonId}/abandon`)
      await fetchData()
    } catch (err) {
      console.error('Error abandoning:', err)
    }
  }

  const handleLogDistance = async () => {
    if (!logModal || !logDistance) return
    setLogSaving(true)
    try {
      // Parse duration HH:MM:SS or MM:SS
      let durationSec = null
      if (logDuration) {
        const parts = logDuration.split(':').map(Number)
        if (parts.length === 3) durationSec = parts[0] * 3600 + parts[1] * 60 + parts[2]
        else if (parts.length === 2) durationSec = parts[0] * 60 + parts[1]
        else durationSec = parts[0] * 60
      }

      const res = await api.post(`/marathons/${logModal.userMarathonId}/log`, {
        distance: parseFloat(logDistance),
        duration: durationSec,
        notes: logNotes || null
      })

      if (res.data.completed) {
        setCelebration({
          name: logModal.marathonName,
          distance: logModal.marathonDistance,
          totalSeconds: res.data.userMarathon?.totalSeconds || 0
        })
      }

      setLogModal(null)
      setLogDistance('')
      setLogDuration('')
      setLogNotes('')
      await fetchData()
    } catch (err) {
      console.error('Error logging distance:', err)
    } finally {
      setLogSaving(false)
    }
  }

  const enrolledIds = new Set(userMarathons.filter(um => um.status !== 'abandoned').map(um => um.marathon.id))
  const activeMarathons = userMarathons.filter(um => um.status === 'active')
  const completedMarathons = userMarathons.filter(um => um.status === 'completed')
  const passiveMarathon = userMarathons.find(um => um.isPassive && um.status === 'active')

  const filteredBrowse = marathons.filter(m => {
    if (m.isPassive) return false // Don't show passive in browse
    if (filter === 'run') return m.type === 'run'
    if (filter === 'bike') return m.type === 'bike'
    return true
  })

  const difficultyColors = {
    beginner: 'bg-green-500/20 text-green-400',
    intermediate: 'bg-yellow-500/20 text-yellow-400',
    advanced: 'bg-orange-500/20 text-orange-400',
    legendary: 'bg-purple-500/20 text-purple-400'
  }

  return (
    <div className="p-4 space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Marathons</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {['myMarathons', 'browse', 'awards'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
              tab === t ? 'bg-accent text-white' : 'bg-dark-elevated text-gray-400 hover:text-white'
            }`}
          >
            {t === 'myMarathons' ? 'My Marathons' : t === 'browse' ? 'Browse' : 'Awards'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
        </div>
      ) : (
        <>
          {/* MY MARATHONS TAB */}
          {tab === 'myMarathons' && (
            <div className="space-y-4">
              {/* Across America - Pinned */}
              {passiveMarathon && (
                <button
                  onClick={() => setViewingMarathon(passiveMarathon)}
                  className="w-full card p-4 text-left"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                      <span className="text-lg">🇺🇸</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-white font-semibold">{passiveMarathon.marathon.name}</p>
                      <p className="text-gray-400 text-xs">Auto-tracks all your cardio</p>
                    </div>
                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                  <div className="w-full bg-dark-elevated rounded-full h-2 mb-1">
                    <div
                      className="bg-accent h-2 rounded-full transition-all"
                      style={{ width: `${Math.min(100, (passiveMarathon.currentDistance / passiveMarathon.marathon.distance) * 100)}%` }}
                    />
                  </div>
                  <p className="text-gray-400 text-xs">
                    {passiveMarathon.currentDistance.toFixed(1)} / {passiveMarathon.marathon.distance} mi
                    {' · '}{((passiveMarathon.currentDistance / passiveMarathon.marathon.distance) * 100).toFixed(1)}%
                  </p>
                </button>
              )}

              {/* Active Marathons */}
              {activeMarathons.filter(um => !um.isPassive).length > 0 && (
                <div>
                  <h3 className="text-white font-medium text-sm mb-2">Active</h3>
                  <div className="space-y-3">
                    {activeMarathons.filter(um => !um.isPassive).map((um) => (
                      <div key={um.id} className="card p-4">
                        <div className="flex items-center gap-3 mb-2">
                          <button
                            onClick={() => setViewingMarathon(um)}
                            className="flex-1 text-left flex items-center gap-3"
                          >
                            <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center flex-shrink-0">
                              <span className="text-lg">{um.marathon.type === 'bike' ? '🚴' : '🏃'}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-white font-medium truncate">{um.marathon.name}</p>
                              <p className="text-gray-400 text-xs">{um.marathon.city}</p>
                            </div>
                          </button>
                          <button
                            onClick={() => setLogModal({
                              userMarathonId: um.id,
                              marathonName: um.marathon.name,
                              marathonDistance: um.marathon.distance,
                              currentDistance: um.currentDistance
                            })}
                            className="btn-primary px-3 py-1.5 text-xs flex-shrink-0"
                          >
                            Log Run
                          </button>
                        </div>
                        <div className="w-full bg-dark-elevated rounded-full h-2 mb-1">
                          <div
                            className="bg-accent h-2 rounded-full transition-all"
                            style={{ width: `${Math.min(100, (um.currentDistance / um.marathon.distance) * 100)}%` }}
                          />
                        </div>
                        <div className="flex justify-between">
                          <p className="text-gray-400 text-xs">
                            {um.currentDistance.toFixed(1)} / {um.marathon.distance} mi
                          </p>
                          <p className="text-gray-400 text-xs">
                            {((um.currentDistance / um.marathon.distance) * 100).toFixed(1)}%
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Completed Marathons */}
              {completedMarathons.filter(um => !um.isPassive).length > 0 && (
                <div>
                  <h3 className="text-white font-medium text-sm mb-2">Completed</h3>
                  <div className="space-y-3">
                    {completedMarathons.filter(um => !um.isPassive).map((um) => (
                      <button
                        key={um.id}
                        onClick={() => setViewingMarathon(um)}
                        className="w-full card p-4 text-left border border-success/30"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-success/20 flex items-center justify-center">
                            <span className="text-lg">🏅</span>
                          </div>
                          <div className="flex-1">
                            <p className="text-white font-medium">{um.marathon.name}</p>
                            <p className="text-success text-xs">
                              Completed {um.completedAt ? new Date(um.completedAt).toLocaleDateString() : ''}
                              {um.totalSeconds > 0 && ` · ${Math.floor(um.totalSeconds / 3600)}h ${Math.floor((um.totalSeconds % 3600) / 60)}m total`}
                            </p>
                          </div>
                          <svg className="w-5 h-5 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {activeMarathons.filter(um => !um.isPassive).length === 0 && completedMarathons.filter(um => !um.isPassive).length === 0 && !passiveMarathon && (
                <div className="text-center py-12">
                  <span className="text-4xl mb-3 block">🏃</span>
                  <p className="text-gray-400">No marathons yet</p>
                  <p className="text-gray-500 text-sm mt-1">Browse available marathons and enroll to get started!</p>
                  <button onClick={() => setTab('browse')} className="btn-primary mt-4 px-6">
                    Browse Marathons
                  </button>
                </div>
              )}
            </div>
          )}

          {/* BROWSE TAB */}
          {tab === 'browse' && (
            <div className="space-y-4">
              {/* Filter */}
              <div className="flex gap-2">
                {[{ id: 'all', label: 'All' }, { id: 'run', label: 'Running' }, { id: 'bike', label: 'Cycling' }].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFilter(f.id)}
                    className={`px-4 py-1.5 rounded-full text-sm transition-colors ${
                      filter === f.id ? 'bg-accent text-white' : 'bg-dark-elevated text-gray-400 hover:text-white'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {filteredBrowse.map((m) => (
                <div key={m.id} className="card p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-2xl">{m.type === 'bike' ? '🚴' : '🏃'}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-white font-semibold">{m.name}</p>
                        {enrolledIds.has(m.id) && (
                          <span className="text-success text-xs">Enrolled</span>
                        )}
                      </div>
                      <p className="text-gray-400 text-sm">{m.city}, {m.country}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-accent text-sm font-medium">{m.distance} mi</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs ${difficultyColors[m.difficulty] || 'bg-gray-500/20 text-gray-400'}`}>
                          {m.difficulty}
                        </span>
                      </div>
                      {m.description && (
                        <p className="text-gray-500 text-xs mt-1 line-clamp-2">{m.description}</p>
                      )}
                    </div>
                    {!enrolledIds.has(m.id) ? (
                      <button
                        onClick={() => handleEnroll(m.id)}
                        disabled={enrolling === m.id}
                        className="btn-primary px-4 py-2 text-sm flex-shrink-0"
                      >
                        {enrolling === m.id ? '...' : 'Enroll'}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleAbandon(m.id)}
                        className="text-gray-500 hover:text-error text-xs px-2 py-1 flex-shrink-0"
                      >
                        Leave
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {filteredBrowse.length === 0 && (
                <p className="text-gray-500 text-center py-12">No marathons found for this filter</p>
              )}
            </div>
          )}

          {/* AWARDS TAB */}
          {tab === 'awards' && (
            <div className="space-y-4">
              {completedMarathons.filter(um => !um.isPassive).length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {completedMarathons.filter(um => !um.isPassive).map((um) => (
                    <div key={um.id} className="card p-4 text-center border border-yellow-500/30">
                      <div className="w-16 h-16 mx-auto mb-2 rounded-full bg-yellow-500/20 flex items-center justify-center">
                        <span className="text-3xl">🏅</span>
                      </div>
                      <p className="text-white font-semibold text-sm">{um.marathon.name}</p>
                      <p className="text-gray-400 text-xs">{um.marathon.distance} mi</p>
                      <p className="text-yellow-400 text-xs mt-1">
                        {um.completedAt ? new Date(um.completedAt).toLocaleDateString() : 'Completed'}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <span className="text-4xl mb-3 block">🏅</span>
                  <p className="text-gray-400">No awards yet</p>
                  <p className="text-gray-500 text-sm mt-1">Complete a marathon to earn your first finisher medal!</p>
                </div>
              )}

              {/* Locked awards for enrolled but not completed */}
              {activeMarathons.filter(um => !um.isPassive).length > 0 && (
                <div>
                  <h3 className="text-gray-500 font-medium text-xs uppercase tracking-wide mb-2">In Progress</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {activeMarathons.filter(um => !um.isPassive).map((um) => (
                      <div key={um.id} className="card p-4 text-center opacity-40">
                        <div className="w-16 h-16 mx-auto mb-2 rounded-full bg-gray-500/20 flex items-center justify-center">
                          <span className="text-3xl">🔒</span>
                        </div>
                        <p className="text-gray-400 font-medium text-sm">{um.marathon.name}</p>
                        <p className="text-gray-500 text-xs">
                          {((um.currentDistance / um.marathon.distance) * 100).toFixed(0)}% complete
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* MAP VIEW MODAL */}
      {viewingMarathon && (
        <div className="fixed inset-0 z-50 bg-dark-bg flex flex-col">
          {/* Header */}
          <div className="bg-dark-card p-4 border-b border-dark-border flex items-center gap-3">
            <button onClick={() => setViewingMarathon(null)} className="text-gray-400 hover:text-white">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex-1">
              <h2 className="text-white font-semibold">{viewingMarathon.marathon.name}</h2>
              <p className="text-gray-400 text-xs">{viewingMarathon.marathon.city}</p>
            </div>
            {viewingMarathon.status === 'active' && !viewingMarathon.isPassive && (
              <button
                onClick={() => {
                  setLogModal({
                    userMarathonId: viewingMarathon.id,
                    marathonName: viewingMarathon.marathon.name,
                    marathonDistance: viewingMarathon.marathon.distance,
                    currentDistance: viewingMarathon.currentDistance
                  })
                }}
                className="btn-primary px-3 py-1.5 text-sm"
              >
                Log Run
              </button>
            )}
          </div>

          {/* Map */}
          <div className="flex-1 relative">
            <MapContainer
              center={viewingMarathon.marathon.routeData?.[0] || [39.8283, -98.5795]}
              zoom={10}
              style={{ height: '100%', width: '100%' }}
              className="z-0"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <FitBounds route={viewingMarathon.marathon.routeData} />

              {(() => {
                const fraction = Math.min(1, viewingMarathon.currentDistance / viewingMarathon.marathon.distance)
                const { completed, remaining } = splitRoute(viewingMarathon.marathon.routeData, fraction)
                const currentPos = getPositionAlongRoute(viewingMarathon.marathon.routeData, fraction)
                const milestones = viewingMarathon.marathon.milestones || []

                return (
                  <>
                    {/* Remaining route - gray dashed */}
                    {remaining.length > 1 && (
                      <Polyline
                        positions={remaining}
                        pathOptions={{ color: '#555', weight: 3, dashArray: '8 8', opacity: 0.6 }}
                      />
                    )}
                    {/* Completed route - accent color */}
                    {completed.length > 1 && (
                      <Polyline
                        positions={completed}
                        pathOptions={{ color: 'var(--color-accent, #0a84ff)', weight: 5, opacity: 0.9 }}
                      />
                    )}
                    {/* Current position marker */}
                    {fraction > 0 && fraction < 1 && (
                      <CircleMarker
                        center={currentPos}
                        radius={8}
                        pathOptions={{ color: '#fff', fillColor: 'var(--color-accent, #0a84ff)', fillOpacity: 1, weight: 3 }}
                      >
                        <Tooltip permanent direction="top" offset={[0, -10]}>
                          {viewingMarathon.currentDistance.toFixed(1)} mi
                        </Tooltip>
                      </CircleMarker>
                    )}
                    {/* Milestone markers */}
                    {milestones.map((ms, i) => (
                      <CircleMarker
                        key={i}
                        center={[ms.lat, ms.lng]}
                        radius={5}
                        pathOptions={{
                          color: '#fff',
                          fillColor: ms.mile <= viewingMarathon.currentDistance ? 'var(--color-accent, #0a84ff)' : '#666',
                          fillOpacity: 1,
                          weight: 2
                        }}
                      >
                        <Tooltip direction="top" offset={[0, -8]}>
                          <span className="font-semibold">Mile {ms.mile}</span>
                          {ms.label && <br />}
                          {ms.label}
                        </Tooltip>
                      </CircleMarker>
                    ))}
                  </>
                )
              })()}
            </MapContainer>
          </div>

          {/* Bottom stats */}
          <div className="bg-dark-card p-4 border-t border-dark-border">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-400 text-sm">Progress</span>
              <span className="text-white font-semibold">
                {viewingMarathon.currentDistance.toFixed(1)} / {viewingMarathon.marathon.distance} mi
              </span>
            </div>
            <div className="w-full bg-dark-elevated rounded-full h-3 mb-2">
              <div
                className="bg-accent h-3 rounded-full transition-all"
                style={{ width: `${Math.min(100, (viewingMarathon.currentDistance / viewingMarathon.marathon.distance) * 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>{((viewingMarathon.currentDistance / viewingMarathon.marathon.distance) * 100).toFixed(1)}% complete</span>
              <span>{Math.max(0, viewingMarathon.marathon.distance - viewingMarathon.currentDistance).toFixed(1)} mi remaining</span>
            </div>
          </div>
        </div>
      )}

      {/* LOG DISTANCE MODAL */}
      {logModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-4">
          <div className="bg-dark-card w-full max-w-md rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-dark-border flex items-center justify-between">
              <h3 className="text-white font-semibold">Log Distance</h3>
              <button onClick={() => setLogModal(null)} className="text-gray-400 hover:text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-gray-400 text-sm">
                {logModal.marathonName} — {logModal.currentDistance.toFixed(1)} / {logModal.marathonDistance} mi
              </p>

              <div>
                <label className="text-gray-400 text-sm mb-1 block">Distance (miles)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={logDistance}
                  onChange={(e) => setLogDistance(e.target.value)}
                  className="input w-full"
                  placeholder="e.g. 3.5"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-gray-400 text-sm mb-1 block">Duration (optional)</label>
                <input
                  type="text"
                  value={logDuration}
                  onChange={(e) => setLogDuration(e.target.value)}
                  className="input w-full"
                  placeholder="MM:SS or HH:MM:SS"
                />
              </div>

              <div>
                <label className="text-gray-400 text-sm mb-1 block">Notes (optional)</label>
                <input
                  type="text"
                  value={logNotes}
                  onChange={(e) => setLogNotes(e.target.value)}
                  className="input w-full"
                  placeholder="Great run today!"
                />
              </div>

              <button
                onClick={handleLogDistance}
                disabled={!logDistance || logSaving}
                className="btn-primary w-full py-3"
              >
                {logSaving ? 'Logging...' : 'Log Distance'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CELEBRATION MODAL */}
      {celebration && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-dark-card w-full max-w-sm rounded-2xl p-6 text-center">
            <div className="text-6xl mb-4">🏅</div>
            <h2 className="text-2xl font-bold text-white mb-2">FINISHER!</h2>
            <p className="text-accent text-lg font-semibold mb-1">{celebration.name}</p>
            <p className="text-gray-400 mb-4">{celebration.distance} miles completed</p>
            {celebration.totalSeconds > 0 && (
              <p className="text-gray-500 text-sm mb-4">
                Total time: {Math.floor(celebration.totalSeconds / 3600)}h {Math.floor((celebration.totalSeconds % 3600) / 60)}m
              </p>
            )}
            <button
              onClick={() => setCelebration(null)}
              className="btn-primary w-full py-3"
            >
              Awesome!
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default Marathons
