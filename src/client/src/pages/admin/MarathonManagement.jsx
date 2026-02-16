import { useState, useEffect, useCallback, useRef, Component } from 'react'
import { Link } from 'react-router-dom'
import { MapContainer, TileLayer, Polyline, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import api from '../../services/api'
import 'leaflet/dist/leaflet.css'

// Error boundary to catch Leaflet/React crashes and show fallback instead of black screen
class MapErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  componentDidCatch(error, info) {
    console.error('[MapErrorBoundary]', error, info)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex items-center justify-center bg-dark-elevated">
          <div className="text-center p-6">
            <p className="text-error text-lg font-semibold mb-2">Map failed to load</p>
            <p className="text-gray-400 text-sm mb-4">{this.state.error?.message || 'Unknown error'}</p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="btn-secondary px-4 py-2 text-sm"
            >
              Retry
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// Calculate approximate distance in miles from array of [lat,lng] waypoints
function calculateRouteDistance(waypoints) {
  if (!waypoints || waypoints.length < 2) return 0
  let total = 0
  for (let i = 1; i < waypoints.length; i++) {
    const [lat1, lon1] = waypoints[i - 1]
    const [lat2, lon2] = waypoints[i]
    // Haversine formula
    const R = 3958.8 // Earth radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLon = (lon2 - lon1) * Math.PI / 180
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    total += R * c
  }
  return total
}

// Create custom div icons for waypoints
function makeWaypointIcon(color, size) {
  return L.divIcon({
    className: '',
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid #fff;cursor:grab;box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2]
  })
}

const startIcon = makeWaypointIcon('#30d158', 16)
const endIcon = makeWaypointIcon('#ff453a', 16)
const midIcon = makeWaypointIcon('#0a84ff', 12)

// Find which segment of the polyline a point is closest to, returns the index to insert after
function findNearestSegment(point, waypoints) {
  if (waypoints.length < 2) return waypoints.length
  let minDist = Infinity
  let insertIdx = 1
  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i]
    const b = waypoints[i + 1]
    const dist = pointToSegmentDist(point, a, b)
    if (dist < minDist) {
      minDist = dist
      insertIdx = i + 1
    }
  }
  return insertIdx
}

// Distance from point p to line segment a-b
function pointToSegmentDist(p, a, b) {
  const dx = b[1] - a[1]
  const dy = b[0] - a[0]
  if (dx === 0 && dy === 0) {
    return Math.sqrt((p[0] - a[0]) ** 2 + (p[1] - a[1]) ** 2)
  }
  let t = ((p[1] - a[1]) * dx + (p[0] - a[0]) * dy) / (dx * dx + dy * dy)
  t = Math.max(0, Math.min(1, t))
  const closestLat = a[0] + t * dy
  const closestLng = a[1] + t * dx
  return Math.sqrt((p[0] - closestLat) ** 2 + (p[1] - closestLng) ** 2)
}

// Imperative waypoint markers - manages Leaflet markers directly to avoid React DOM conflicts
function ImperativeWaypoints({ points, onDrag, onRemove }) {
  const map = useMap()
  const markersRef = useRef([])

  useEffect(() => {
    // Remove old markers
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []

    if (!points || points.length === 0) return

    // Sample points if too many
    const MAX_MARKERS = 80
    let indices
    if (points.length <= MAX_MARKERS) {
      indices = points.map((_, i) => i)
    } else {
      const step = Math.ceil(points.length / MAX_MARKERS)
      const set = new Set([0, points.length - 1])
      for (let i = 0; i < points.length; i += step) set.add(i)
      indices = Array.from(set).sort((a, b) => a - b)
    }

    indices.forEach(idx => {
      const point = points[idx]
      if (!point || !Array.isArray(point) || point.length < 2) return

      const icon = idx === 0 ? startIcon : idx === points.length - 1 ? endIcon : midIcon
      const label = idx === 0 ? 'Start' : idx === points.length - 1 ? 'End' : `Point ${idx + 1}`

      const marker = L.marker(point, { icon, draggable: true }).addTo(map)
      marker.bindTooltip(
        `${label}<br/>${point[0].toFixed(4)}, ${point[1].toFixed(4)}<br/><span style="font-size:10px;color:#999">Drag to move · Right-click to remove</span>`,
        { direction: 'top', offset: [0, -10] }
      )
      marker.on('dragend', () => {
        const { lat, lng } = marker.getLatLng()
        onDrag(idx, [lat, lng])
      })
      marker.on('contextmenu', (e) => {
        L.DomEvent.preventDefault(e)
        onRemove(idx)
      })
      markersRef.current.push(marker)
    })

    return () => {
      markersRef.current.forEach(m => m.remove())
      markersRef.current = []
    }
  }, [points, map, onDrag, onRemove])

  return null
}

// Click handler component for map
function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick([e.latlng.lat, e.latlng.lng])
    }
  })
  return null
}

function FitBounds({ route, once = false }) {
  const map = useMap()
  const hasFit = useRef(false)
  useEffect(() => {
    if (once && hasFit.current) return
    if (route && route.length > 1) {
      map.fitBounds(route, { padding: [30, 30] })
      hasFit.current = true
    }
  }, [route, map, once])
  return null
}

// Fetch road-snapped route from OSRM between control points
async function fetchOSRMRoute(controlPoints, type = 'run') {
  if (controlPoints.length < 2) return controlPoints
  const profile = type === 'bike' ? 'bike' : type === 'swim' ? 'foot' : 'foot'
  // OSRM expects lng,lat format
  const coords = controlPoints.map(p => `${p[1]},${p[0]}`).join(';')
  const url = `https://router.project-osrm.org/route/v1/${profile}/${coords}?overview=full&geometries=geojson`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`OSRM error: ${res.status}`)
  const data = await res.json()
  if (data.code !== 'Ok' || !data.routes?.[0]) throw new Error('No route found')
  // GeoJSON [lng, lat] → Leaflet [lat, lng]
  return data.routes[0].geometry.coordinates.map(c => [c[1], c[0]])
}

function MarathonManagement() {
  const [marathons, setMarathons] = useState([])
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)
  const [editing, setEditing] = useState(null) // marathon object or 'new'
  const [form, setForm] = useState({
    name: '', description: '', city: '', country: '', distance: '',
    type: 'run', difficulty: 'intermediate', routeData: [], milestones: [],
    segments: [] // For triathlon: [{type: 'swim'|'bike'|'run', startIdx, endIdx}]
  })
  const [saving, setSaving] = useState(false)
  const [uploadingAward, setUploadingAward] = useState(null) // marathon id being uploaded to
  const [activeSegmentType, setActiveSegmentType] = useState('run') // Current segment type being drawn
  const [snapToRoads, setSnapToRoads] = useState(false)
  const [controlPoints, setControlPoints] = useState([]) // User-placed waypoints
  const [snapping, setSnapping] = useState(false) // Loading state for OSRM
  const snapTimerRef = useRef(null)
  const formTypeRef = useRef(form.type)
  formTypeRef.current = form.type

  useEffect(() => {
    fetchMarathons()
  }, [])

  // Snap control points to roads via OSRM when snap mode is on
  useEffect(() => {
    if (!snapToRoads || controlPoints.length < 2) return
    if (snapTimerRef.current) clearTimeout(snapTimerRef.current)

    snapTimerRef.current = setTimeout(async () => {
      setSnapping(true)
      try {
        const snappedRoute = await fetchOSRMRoute(controlPoints, formTypeRef.current)
        setForm(prev => ({
          ...prev,
          routeData: snappedRoute,
          distance: String(calculateRouteDistance(snappedRoute).toFixed(1))
        }))
      } catch (err) {
        console.error('OSRM snap failed:', err)
      } finally {
        setSnapping(false)
      }
    }, 500)

    return () => {
      if (snapTimerRef.current) clearTimeout(snapTimerRef.current)
    }
  }, [controlPoints, snapToRoads])

  const fetchMarathons = async () => {
    setLoading(true)
    try {
      const res = await api.get('/marathons/admin/all')
      setMarathons(res.data.marathons || [])
    } catch (err) {
      console.error('Error fetching marathons:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSeed = async () => {
    setSeeding(true)
    try {
      const res = await api.post('/marathons/seed')
      alert(res.data.message)
      await fetchMarathons()
    } catch (err) {
      console.error('Error seeding:', err)
    } finally {
      setSeeding(false)
    }
  }

  const startEditing = (marathon) => {
    if (marathon === 'new') {
      setForm({
        name: '', description: '', city: '', country: 'USA', distance: '',
        type: 'run', difficulty: 'intermediate', routeData: [], milestones: [],
        segments: []
      })
      setActiveSegmentType('run')
      setControlPoints([])
      setSnapToRoads(false)
      setEditing('new')
    } else {
      // Validate routeData - ensure it's a proper array of [lat, lng] pairs
      let routeData = []
      try {
        const raw = marathon.routeData
        if (Array.isArray(raw)) {
          routeData = raw.filter(p => Array.isArray(p) && p.length >= 2 && typeof p[0] === 'number' && typeof p[1] === 'number')
        }
      } catch (e) {
        console.error('Invalid routeData:', e)
      }
      setForm({
        name: marathon.name,
        description: marathon.description || '',
        city: marathon.city,
        country: marathon.country,
        distance: String(marathon.distance),
        type: marathon.type,
        difficulty: marathon.difficulty,
        routeData,
        milestones: Array.isArray(marathon.milestones) ? marathon.milestones : [],
        segments: Array.isArray(marathon.segments) ? marathon.segments : []
      })
      setActiveSegmentType(marathon.type === 'triathlon' ? 'swim' : marathon.type || 'run')
      setControlPoints(routeData)
      setSnapToRoads(false)
      setEditing(marathon)
    }
  }

  const handleMapClick = useCallback((latlng) => {
    if (snapToRoads) {
      setControlPoints(prev => [...prev, latlng])
    } else {
      setForm(prev => {
        const newRoute = [...prev.routeData, latlng]
        return {
          ...prev,
          routeData: newRoute,
          distance: String(calculateRouteDistance(newRoute).toFixed(1))
        }
      })
    }
  }, [snapToRoads])

  const handleWaypointDrag = useCallback((index, newPos) => {
    if (snapToRoads) {
      setControlPoints(prev => {
        const newPts = [...prev]
        newPts[index] = newPos
        return newPts
      })
    } else {
      setForm(prev => {
        const newRoute = [...prev.routeData]
        newRoute[index] = newPos
        return {
          ...prev,
          routeData: newRoute,
          distance: String(calculateRouteDistance(newRoute).toFixed(1))
        }
      })
    }
  }, [snapToRoads])

  const handlePolylineRightClick = useCallback((e) => {
    L.DomEvent.preventDefault(e)
    const point = [e.latlng.lat, e.latlng.lng]
    if (snapToRoads) {
      setControlPoints(prev => {
        const insertIdx = findNearestSegment(point, prev)
        const newPts = [...prev]
        newPts.splice(insertIdx, 0, point)
        return newPts
      })
    } else {
      setForm(prev => {
        const insertIdx = findNearestSegment(point, prev.routeData)
        const newRoute = [...prev.routeData]
        newRoute.splice(insertIdx, 0, point)
        return {
          ...prev,
          routeData: newRoute,
          distance: String(calculateRouteDistance(newRoute).toFixed(1))
        }
      })
    }
  }, [snapToRoads])

  const removeWaypoint = useCallback((idx) => {
    if (snapToRoads) {
      setControlPoints(prev => prev.filter((_, i) => i !== idx))
    } else {
      setForm(prev => {
        const newRoute = prev.routeData.filter((_, i) => i !== idx)
        return {
          ...prev,
          routeData: newRoute,
          distance: String(calculateRouteDistance(newRoute).toFixed(1))
        }
      })
    }
  }, [snapToRoads])

  const undoLastWaypoint = () => {
    if (snapToRoads) {
      setControlPoints(prev => prev.slice(0, -1))
    } else {
      setForm(prev => {
        const newRoute = prev.routeData.slice(0, -1)
        return {
          ...prev,
          routeData: newRoute,
          distance: String(calculateRouteDistance(newRoute).toFixed(1))
        }
      })
    }
  }

  const clearAllWaypoints = () => {
    setControlPoints([])
    setForm(prev => ({ ...prev, routeData: [], distance: '0', milestones: [] }))
  }

  const handleSave = async () => {
    if (!form.name || !form.city || !form.country || !form.distance) {
      alert('Name, city, country, and distance are required')
      return
    }
    if (form.routeData.length < 2) {
      alert('Please add at least 2 waypoints on the map')
      return
    }

    setSaving(true)
    try {
      // Build segments data for triathlon: calculate distance per segment from waypoints
      let segmentsData = null
      if (form.type === 'triathlon' && form.segments.length > 0) {
        segmentsData = form.segments.map(seg => ({
          type: seg.type,
          startIdx: seg.startIdx,
          endIdx: seg.endIdx,
          distance: calculateRouteDistance(form.routeData.slice(seg.startIdx, seg.endIdx + 1))
        }))
      }

      if (editing === 'new') {
        await api.post('/marathons/admin/create', {
          name: form.name,
          description: form.description || null,
          city: form.city,
          country: form.country,
          distance: parseFloat(form.distance),
          type: form.type,
          difficulty: form.difficulty,
          routeData: form.routeData,
          milestones: form.milestones.length > 0 ? form.milestones : null,
          segments: segmentsData
        })
      } else {
        await api.put(`/marathons/admin/${editing.id}`, {
          name: form.name,
          description: form.description || null,
          city: form.city,
          country: form.country,
          distance: parseFloat(form.distance),
          type: form.type,
          difficulty: form.difficulty,
          routeData: form.routeData,
          milestones: form.milestones.length > 0 ? form.milestones : null,
          segments: segmentsData
        })
      }
      setEditing(null)
      await fetchMarathons()
    } catch (err) {
      console.error('Error saving marathon:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this marathon? This cannot be undone.')) return
    try {
      await api.delete(`/marathons/admin/${id}`)
      await fetchMarathons()
    } catch (err) {
      console.error('Error deleting:', err)
    }
  }

  const handleToggleActive = async (marathon) => {
    try {
      await api.put(`/marathons/admin/${marathon.id}`, { isActive: !marathon.isActive })
      await fetchMarathons()
    } catch (err) {
      console.error('Error toggling:', err)
    }
  }

  const handleAwardUpload = async (marathonId, file) => {
    if (!file) return
    setUploadingAward(marathonId)
    try {
      const formData = new FormData()
      formData.append('awardImage', file)
      await api.post(`/marathons/admin/${marathonId}/award`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      await fetchMarathons()
    } catch (err) {
      console.error('Error uploading award:', err)
      alert('Failed to upload award image')
    } finally {
      setUploadingAward(null)
    }
  }

  // Route builder / editor view
  if (editing) {
    return (
      <div className="fixed inset-0 z-50 bg-dark-bg flex flex-col">
        {/* Header */}
        <div className="bg-dark-card p-3 border-b border-dark-border flex items-center gap-3">
          <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-white font-semibold flex-1">
            {editing === 'new' ? 'Create Marathon' : `Edit: ${editing.name}`}
          </h2>
          <button onClick={handleSave} disabled={saving} className="btn-primary px-4 py-1.5 text-sm">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>

        {/* Form fields */}
        <div className="bg-dark-card p-3 border-b border-dark-border space-y-2 overflow-y-auto max-h-[200px]">
          <div className="grid grid-cols-2 gap-2">
            <input
              value={form.name}
              onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
              className="input text-sm"
              placeholder="Marathon Name"
            />
            <input
              value={form.city}
              onChange={(e) => setForm(p => ({ ...p, city: e.target.value }))}
              className="input text-sm"
              placeholder="City"
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <input
              value={form.country}
              onChange={(e) => setForm(p => ({ ...p, country: e.target.value }))}
              className="input text-sm"
              placeholder="Country"
            />
            <select
              value={form.type}
              onChange={(e) => {
                const newType = e.target.value
                setForm(p => ({ ...p, type: newType, segments: newType === 'triathlon' ? p.segments : [] }))
                if (newType === 'triathlon') setActiveSegmentType('swim')
                else setActiveSegmentType(newType)
              }}
              className="input text-sm"
            >
              <option value="run">Run</option>
              <option value="bike">Bike</option>
              <option value="swim">Swim</option>
              <option value="triathlon">Triathlon</option>
            </select>
            <select
              value={form.difficulty}
              onChange={(e) => setForm(p => ({ ...p, difficulty: e.target.value }))}
              className="input text-sm"
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>
          <input
            value={form.description}
            onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))}
            className="input text-sm w-full"
            placeholder="Description (optional)"
          />
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-gray-400 text-xs">Distance:</span>
            <span className="text-accent font-semibold text-sm">{form.distance || '0'} mi</span>
            <span className="text-gray-500 text-xs ml-2">
              ({snapToRoads ? `${controlPoints.length} ctrl pts · ${form.routeData.length} route pts` : `${form.routeData.length} waypoints`})
            </span>
            <div className="flex-1" />
            <button
              onClick={() => {
                if (!snapToRoads) {
                  // Turning snap ON: use current routeData as control points
                  let pts = form.routeData
                  // Downsample if too many points for OSRM (limit ~100)
                  if (pts.length > 50) {
                    const step = Math.ceil(pts.length / 50)
                    const sampled = [pts[0]]
                    for (let i = step; i < pts.length - 1; i += step) sampled.push(pts[i])
                    sampled.push(pts[pts.length - 1])
                    pts = sampled
                  }
                  setControlPoints(pts)
                  setSnapToRoads(true)
                } else {
                  // Turning snap OFF: keep control points as direct route
                  setForm(prev => ({
                    ...prev,
                    routeData: controlPoints,
                    distance: String(calculateRouteDistance(controlPoints).toFixed(1))
                  }))
                  setSnapToRoads(false)
                }
              }}
              className={`text-xs px-2 py-1 rounded transition-colors ${
                snapToRoads
                  ? 'bg-accent/20 text-accent ring-1 ring-accent'
                  : 'bg-dark-elevated text-gray-400 hover:text-white'
              }`}
            >
              {snapping ? 'Snapping...' : snapToRoads ? 'Road Snap ON' : 'Road Snap'}
            </button>
            <button onClick={undoLastWaypoint} disabled={snapToRoads ? controlPoints.length === 0 : form.routeData.length === 0} className="text-gray-400 hover:text-white text-xs px-2 py-1 bg-dark-elevated rounded">
              Undo
            </button>
            <button onClick={clearAllWaypoints} disabled={snapToRoads ? controlPoints.length === 0 : form.routeData.length === 0} className="text-gray-400 hover:text-error text-xs px-2 py-1 bg-dark-elevated rounded">
              Clear
            </button>
          </div>
          {/* Triathlon segment controls */}
          {form.type === 'triathlon' && (
            <div className="space-y-2 border-t border-dark-border pt-2">
              <div className="flex items-center gap-2">
                <span className="text-gray-400 text-xs">Drawing segment:</span>
                {['swim', 'bike', 'run'].map(t => (
                  <button
                    key={t}
                    onClick={() => setActiveSegmentType(t)}
                    className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                      activeSegmentType === t
                        ? t === 'swim' ? 'bg-cyan-500/30 text-cyan-400 ring-1 ring-cyan-500'
                          : t === 'bike' ? 'bg-yellow-500/30 text-yellow-400 ring-1 ring-yellow-500'
                          : 'bg-green-500/30 text-green-400 ring-1 ring-green-500'
                        : 'bg-dark-elevated text-gray-500'
                    }`}
                  >
                    {t === 'swim' ? '🏊 Swim' : t === 'bike' ? '🚴 Bike' : '🏃 Run'}
                  </button>
                ))}
              </div>
              <p className="text-gray-500 text-[10px]">
                Mark segment transitions: click "Set Transition" to mark where current segment ends and next begins.
                {form.segments.length > 0 && ` (${form.segments.length} segments defined)`}
              </p>
              {form.routeData.length >= 2 && (
                <button
                  onClick={() => {
                    const lastEnd = form.segments.length > 0 ? form.segments[form.segments.length - 1].endIdx : 0
                    const currentIdx = form.routeData.length - 1
                    if (currentIdx > lastEnd) {
                      setForm(prev => ({
                        ...prev,
                        segments: [...prev.segments, { type: activeSegmentType, startIdx: lastEnd === 0 && prev.segments.length === 0 ? 0 : lastEnd, endIdx: currentIdx }]
                      }))
                      // Auto-advance to next segment type
                      const order = ['swim', 'bike', 'run']
                      const nextIdx = order.indexOf(activeSegmentType) + 1
                      if (nextIdx < order.length) setActiveSegmentType(order[nextIdx])
                    }
                  }}
                  className="text-accent text-xs px-3 py-1 bg-accent/20 rounded hover:bg-accent/30 transition-colors"
                >
                  Set Transition Here (wp #{form.routeData.length})
                </button>
              )}
              {form.segments.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {form.segments.map((seg, i) => (
                    <span key={i} className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                      seg.type === 'swim' ? 'bg-cyan-500/20 text-cyan-400'
                        : seg.type === 'bike' ? 'bg-yellow-500/20 text-yellow-400'
                        : 'bg-green-500/20 text-green-400'
                    }`}>
                      {seg.type}: wp {seg.startIdx + 1}-{seg.endIdx + 1}
                      ({calculateRouteDistance(form.routeData.slice(seg.startIdx, seg.endIdx + 1)).toFixed(1)} mi)
                    </span>
                  ))}
                  <button
                    onClick={() => setForm(prev => ({ ...prev, segments: prev.segments.slice(0, -1) }))}
                    className="text-gray-500 hover:text-error text-[10px] px-1"
                  >
                    Undo
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Map - click to add waypoints */}
        <MapErrorBoundary>
        <div className="flex-1 relative">
          <div className="absolute top-2 left-2 z-[1000] bg-dark-card/90 px-3 py-1.5 rounded-lg">
            <p className="text-white text-xs font-medium">
              Click to add · Drag to move · Right-click route to insert
              {snapToRoads && (
                <span className="text-accent ml-2">· Road snap ON ({controlPoints.length} ctrl pts)</span>
              )}
              {!snapToRoads && form.routeData.length > 80 && (
                <span className="text-yellow-400 ml-2">· Showing sampled markers ({form.routeData.length} pts)</span>
              )}
              {form.type === 'triathlon' && (
                <span className={`ml-2 ${activeSegmentType === 'swim' ? 'text-cyan-400' : activeSegmentType === 'bike' ? 'text-yellow-400' : 'text-green-400'}`}>
                  · Drawing: {activeSegmentType}
                </span>
              )}
            </p>
          </div>
          {snapping && (
            <div className="absolute top-12 left-2 z-[1000] bg-accent/90 px-3 py-1.5 rounded-lg flex items-center gap-2">
              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span className="text-white text-xs font-medium">Snapping to roads...</span>
            </div>
          )}
          <MapContainer
            key={editing === 'new' ? 'new' : editing?.id || 'editor'}
            center={form.routeData.length > 0 ? form.routeData[0] : controlPoints.length > 0 ? controlPoints[0] : [39.8283, -98.5795]}
            zoom={form.routeData.length > 0 || controlPoints.length > 0 ? 10 : 4}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapClickHandler onMapClick={handleMapClick} />
            {/* Snap mode: show control point connections as dashed line */}
            {snapToRoads && controlPoints.length > 1 && (
              <>
                <FitBounds route={controlPoints} once />
                <Polyline
                  positions={controlPoints}
                  pathOptions={{ color: '#666', weight: 2, dashArray: '6 6', opacity: 0.5 }}
                />
              </>
            )}
            {form.routeData.length > 1 && (
              <>
                {!snapToRoads && <FitBounds route={form.routeData} once />}
                {/* Triathlon: show colored segments */}
                {form.type === 'triathlon' && form.segments.length > 0 ? (
                  <>
                    {form.segments.map((seg, i) => {
                      const segColor = seg.type === 'swim' ? '#06b6d4' : seg.type === 'bike' ? '#eab308' : '#22c55e'
                      const segPoints = form.routeData.slice(seg.startIdx, seg.endIdx + 1)
                      return segPoints.length > 1 ? (
                        <Polyline key={`seg-${i}`} positions={segPoints} pathOptions={{ color: segColor, weight: 6, opacity: 0.9 }}
                          eventHandlers={{ contextmenu: handlePolylineRightClick }} />
                      ) : null
                    })}
                    {/* Unsegmented portion (if waypoints added after last segment) */}
                    {(() => {
                      const lastEnd = form.segments[form.segments.length - 1]?.endIdx || 0
                      if (lastEnd < form.routeData.length - 1) {
                        const remaining = form.routeData.slice(lastEnd)
                        return remaining.length > 1 ? (
                          <Polyline positions={remaining} pathOptions={{ color: '#555', weight: 4, dashArray: '8 8', opacity: 0.6 }}
                            eventHandlers={{ contextmenu: handlePolylineRightClick }} />
                        ) : null
                      }
                      return null
                    })()}
                  </>
                ) : (
                  <Polyline
                    positions={form.routeData}
                    pathOptions={{ color: form.type === 'swim' ? '#06b6d4' : form.type === 'bike' ? '#eab308' : '#0a84ff', weight: snapToRoads ? 6 : 5, opacity: 0.8 }}
                    eventHandlers={{ contextmenu: handlePolylineRightClick }}
                  />
                )}
                {/* Invisible wider polyline for easier right-click targeting */}
                <Polyline
                  positions={form.routeData}
                  pathOptions={{ color: 'transparent', weight: 20, opacity: 0 }}
                  eventHandlers={{
                    contextmenu: handlePolylineRightClick
                  }}
                />
              </>
            )}
            <ImperativeWaypoints points={snapToRoads ? controlPoints : form.routeData} onDrag={handleWaypointDrag} onRemove={removeWaypoint} />
          </MapContainer>
        </div>
        </MapErrorBoundary>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/settings" className="btn-ghost p-2 -ml-2">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-2xl font-bold text-white">Marathon Management</h1>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button onClick={handleSeed} disabled={seeding} className="btn-primary px-4 py-2 text-sm">
          {seeding ? 'Seeding...' : 'Seed Marathons'}
        </button>
        <button onClick={() => startEditing('new')} className="bg-dark-elevated text-white px-4 py-2 rounded-lg text-sm hover:bg-dark-border transition-colors">
          + Create Marathon
        </button>
      </div>

      <p className="text-gray-500 text-xs">
        Seed pre-built marathons (World Marathon Majors + Across America) or create custom routes by clicking on the map.
      </p>

      {/* Marathon List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
        </div>
      ) : (
        <div className="space-y-3">
          {marathons.map((m) => (
            <div key={m.id} className={`card p-3 ${!m.isActive ? 'opacity-50' : ''}`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-lg">{m.isPassive ? '🇺🇸' : m.type === 'triathlon' ? '🏊' : m.type === 'swim' ? '🏊' : m.type === 'bike' ? '🚴' : '🏃'}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-white font-medium truncate">{m.name}</p>
                    {m.isPassive && <span className="text-purple-400 text-xs">(Passive)</span>}
                    {!m.isActive && <span className="text-error text-xs">(Inactive)</span>}
                  </div>
                  <p className="text-gray-400 text-xs">
                    {m.city} · {m.distance} mi · {m._count?.userMarathons || 0} enrolled
                    {m.awardImageUrl && <span className="text-yellow-400 ml-1">· Award set</span>}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {/* Award image upload */}
                  <label
                    className={`px-2 py-1 rounded text-xs cursor-pointer flex items-center gap-1 ${
                      m.awardImageUrl ? 'text-yellow-400 bg-yellow-500/10' : 'text-gray-500 hover:text-yellow-400 hover:bg-yellow-500/10'
                    }`}
                    title={m.awardImageUrl ? 'Award image set (click to change)' : 'Upload award image'}
                  >
                    <span>{m.awardImageUrl ? '🏅' : '📷'}</span>
                    <span>{uploadingAward === m.id ? '...' : m.awardImageUrl ? 'Award' : 'Medal'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleAwardUpload(m.id, e.target.files[0])}
                      disabled={uploadingAward === m.id}
                    />
                  </label>
                  <button
                    onClick={() => handleToggleActive(m)}
                    className={`px-2 py-1 rounded text-xs ${m.isActive ? 'text-success' : 'text-gray-500'}`}
                    title={m.isActive ? 'Deactivate' : 'Activate'}
                  >
                    {m.isActive ? 'On' : 'Off'}
                  </button>
                  <button
                    onClick={() => startEditing(m)}
                    className="text-gray-400 hover:text-white p-1"
                    title="Edit"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  {!m.isOfficial && !m.isPassive && (
                    <button
                      onClick={() => handleDelete(m.id)}
                      className="text-gray-400 hover:text-error p-1"
                      title="Delete"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {marathons.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-400">No marathons yet</p>
              <p className="text-gray-500 text-sm mt-1">Click "Seed Marathons" to add the pre-built routes</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default MarathonManagement
