import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { MapContainer, TileLayer, Polyline, Marker, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import api from '../../services/api'
import 'leaflet/dist/leaflet.css'

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

// Draggable waypoint marker
function DraggableWaypoint({ position, index, total, onDrag, onRemove }) {
  const icon = index === 0 ? startIcon : index === total - 1 ? endIcon : midIcon
  const label = index === 0 ? 'Start' : index === total - 1 ? 'End' : `Point ${index + 1}`

  const eventHandlers = useMemo(() => ({
    dragend(e) {
      const { lat, lng } = e.target.getLatLng()
      onDrag(index, [lat, lng])
    },
    contextmenu(e) {
      L.DomEvent.preventDefault(e)
      onRemove(index)
    }
  }), [index, onDrag, onRemove])

  return (
    <Marker
      position={position}
      icon={icon}
      draggable={true}
      eventHandlers={eventHandlers}
    >
      <Tooltip direction="top" offset={[0, -10]}>
        {label}<br />
        {position[0].toFixed(4)}, {position[1].toFixed(4)}<br />
        <span style={{ fontSize: '10px', color: '#999' }}>Drag to move · Right-click to remove</span>
      </Tooltip>
    </Marker>
  )
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

function FitBounds({ route }) {
  const map = useMap()
  useEffect(() => {
    if (route && route.length > 1) {
      map.fitBounds(route, { padding: [30, 30] })
    }
  }, [route, map])
  return null
}

function MarathonManagement() {
  const [marathons, setMarathons] = useState([])
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)
  const [editing, setEditing] = useState(null) // marathon object or 'new'
  const [form, setForm] = useState({
    name: '', description: '', city: '', country: '', distance: '',
    type: 'run', difficulty: 'intermediate', routeData: [], milestones: []
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchMarathons()
  }, [])

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
        type: 'run', difficulty: 'intermediate', routeData: [], milestones: []
      })
      setEditing('new')
    } else {
      setForm({
        name: marathon.name,
        description: marathon.description || '',
        city: marathon.city,
        country: marathon.country,
        distance: String(marathon.distance),
        type: marathon.type,
        difficulty: marathon.difficulty,
        routeData: marathon.routeData || [],
        milestones: marathon.milestones || []
      })
      setEditing(marathon)
    }
  }

  const handleMapClick = useCallback((latlng) => {
    setForm(prev => {
      const newRoute = [...prev.routeData, latlng]
      return {
        ...prev,
        routeData: newRoute,
        distance: String(calculateRouteDistance(newRoute).toFixed(1))
      }
    })
  }, [])

  const handleWaypointDrag = useCallback((index, newPos) => {
    setForm(prev => {
      const newRoute = [...prev.routeData]
      newRoute[index] = newPos
      return {
        ...prev,
        routeData: newRoute,
        distance: String(calculateRouteDistance(newRoute).toFixed(1))
      }
    })
  }, [])

  const handlePolylineRightClick = useCallback((e) => {
    L.DomEvent.preventDefault(e)
    const point = [e.latlng.lat, e.latlng.lng]
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
  }, [])

  const removeWaypoint = useCallback((idx) => {
    setForm(prev => {
      const newRoute = prev.routeData.filter((_, i) => i !== idx)
      return {
        ...prev,
        routeData: newRoute,
        distance: String(calculateRouteDistance(newRoute).toFixed(1))
      }
    })
  }, [])

  const undoLastWaypoint = () => {
    setForm(prev => {
      const newRoute = prev.routeData.slice(0, -1)
      return {
        ...prev,
        routeData: newRoute,
        distance: String(calculateRouteDistance(newRoute).toFixed(1))
      }
    })
  }

  const clearAllWaypoints = () => {
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
          milestones: form.milestones.length > 0 ? form.milestones : null
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
          milestones: form.milestones.length > 0 ? form.milestones : null
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
              onChange={(e) => setForm(p => ({ ...p, type: e.target.value }))}
              className="input text-sm"
            >
              <option value="run">Run</option>
              <option value="bike">Bike</option>
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
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-xs">Distance:</span>
            <span className="text-accent font-semibold text-sm">{form.distance || '0'} mi</span>
            <span className="text-gray-500 text-xs ml-2">({form.routeData.length} waypoints)</span>
            <div className="flex-1" />
            <button onClick={undoLastWaypoint} disabled={form.routeData.length === 0} className="text-gray-400 hover:text-white text-xs px-2 py-1 bg-dark-elevated rounded">
              Undo
            </button>
            <button onClick={clearAllWaypoints} disabled={form.routeData.length === 0} className="text-gray-400 hover:text-error text-xs px-2 py-1 bg-dark-elevated rounded">
              Clear
            </button>
          </div>
        </div>

        {/* Map - click to add waypoints */}
        <div className="flex-1 relative">
          <div className="absolute top-2 left-2 z-[1000] bg-dark-card/90 px-3 py-1.5 rounded-lg">
            <p className="text-white text-xs font-medium">Click to add · Drag to move · Right-click route to insert</p>
          </div>
          <MapContainer
            center={form.routeData.length > 0 ? form.routeData[0] : [39.8283, -98.5795]}
            zoom={form.routeData.length > 0 ? 10 : 4}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapClickHandler onMapClick={handleMapClick} />
            {form.routeData.length > 1 && (
              <>
                <FitBounds route={form.routeData} />
                <Polyline
                  positions={form.routeData}
                  pathOptions={{ color: '#0a84ff', weight: 5, opacity: 0.8 }}
                  eventHandlers={{
                    contextmenu: handlePolylineRightClick
                  }}
                />
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
            {form.routeData.map((point, i) => (
              <DraggableWaypoint
                key={`${i}-${point[0]}-${point[1]}`}
                position={point}
                index={i}
                total={form.routeData.length}
                onDrag={handleWaypointDrag}
                onRemove={removeWaypoint}
              />
            ))}
          </MapContainer>
        </div>
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
                  <span className="text-lg">{m.isPassive ? '🇺🇸' : m.type === 'bike' ? '🚴' : '🏃'}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-white font-medium truncate">{m.name}</p>
                    {m.isPassive && <span className="text-purple-400 text-xs">(Passive)</span>}
                    {!m.isActive && <span className="text-error text-xs">(Inactive)</span>}
                  </div>
                  <p className="text-gray-400 text-xs">
                    {m.city} · {m.distance} mi · {m._count?.userMarathons || 0} enrolled
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
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
