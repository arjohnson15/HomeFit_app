import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api'

function UserManagement() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedUser, setSelectedUser] = useState(null)
  const [editingEmail, setEditingEmail] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [resettingPassword, setResettingPassword] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [actionMessage, setActionMessage] = useState(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const response = await api.get('/admin/users')
      setUsers(response.data.users || [])
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateUserRole = async (userId, role) => {
    try {
      const response = await api.put(`/admin/users/${userId}/role`, { role })
      const newRole = response.data.user.role
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u))
      setSelectedUser(prev => prev ? { ...prev, role: newRole } : prev)
      showMessage(`Role updated to ${newRole}`, 'success')
    } catch (error) {
      showMessage(error.response?.data?.message || 'Failed to update role', 'error')
    }
  }

  const toggleUserStatus = async (userId, active) => {
    try {
      await api.put(`/admin/users/${userId}/status`, { active })
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, active } : u))
    } catch (error) {
      console.error('Error updating status:', error)
    }
  }

  const updateUserEmail = async () => {
    if (!newEmail.trim()) return
    try {
      await api.put(`/admin/users/${selectedUser.id}/email`, { email: newEmail })
      setUsers(prev => prev.map(u => u.id === selectedUser.id ? { ...u, email: newEmail } : u))
      setSelectedUser(prev => ({ ...prev, email: newEmail }))
      setEditingEmail(false)
      setNewEmail('')
      showMessage('Email updated successfully', 'success')
    } catch (error) {
      showMessage(error.response?.data?.message || 'Failed to update email', 'error')
    }
  }

  const resetUserPassword = async () => {
    if (!newPassword.trim() || newPassword.length < 6) {
      showMessage('Password must be at least 6 characters', 'error')
      return
    }
    try {
      await api.put(`/admin/users/${selectedUser.id}/password`, { password: newPassword })
      setResettingPassword(false)
      setNewPassword('')
      showMessage('Password reset successfully', 'success')
    } catch (error) {
      showMessage(error.response?.data?.message || 'Failed to reset password', 'error')
    }
  }

  const removeUserAvatar = async () => {
    try {
      await api.delete(`/admin/users/${selectedUser.id}/avatar`)
      setUsers(prev => prev.map(u => u.id === selectedUser.id ? { ...u, avatarUrl: null } : u))
      setSelectedUser(prev => ({ ...prev, avatarUrl: null }))
      showMessage('Avatar removed successfully', 'success')
    } catch (error) {
      showMessage(error.response?.data?.message || 'Failed to remove avatar', 'error')
    }
  }

  const deleteUser = async () => {
    try {
      await api.delete(`/admin/users/${selectedUser.id}`)
      setUsers(prev => prev.filter(u => u.id !== selectedUser.id))
      setSelectedUser(null)
      setShowDeleteConfirm(false)
      showMessage('User deleted successfully', 'success')
    } catch (error) {
      showMessage(error.response?.data?.message || 'Failed to delete user', 'error')
      setShowDeleteConfirm(false)
    }
  }

  const showMessage = (message, type) => {
    setActionMessage({ message, type })
    setTimeout(() => setActionMessage(null), 3000)
  }

  const filteredUsers = users.filter(user =>
    user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="p-4 space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/settings" className="btn-ghost p-2 -ml-2">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-2xl font-bold text-white">User Management</h1>
      </div>

      {/* Search */}
      <div className="relative">
        <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Search users..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input w-full pl-12"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card text-center">
          <p className="text-2xl font-bold text-white">{users.length}</p>
          <p className="text-gray-400 text-sm">Total Users</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-green-400">{users.filter(u => u.active !== false).length}</p>
          <p className="text-gray-400 text-sm">Active</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-accent">{users.filter(u => u.role === 'ADMIN').length}</p>
          <p className="text-gray-400 text-sm">Admins</p>
        </div>
      </div>

      {/* User List */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredUsers.map((user) => (
            <div
              key={user.id}
              className="card cursor-pointer hover:bg-dark-elevated transition-colors"
              onClick={() => setSelectedUser(user)}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center text-accent font-medium">
                  {user.name?.charAt(0).toUpperCase() || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-white font-medium truncate">{user.name}</h3>
                    {user.role === 'ADMIN' && (
                      <span className="px-2 py-0.5 rounded-full bg-accent/20 text-accent text-xs">Admin</span>
                    )}
                  </div>
                  <p className="text-gray-400 text-sm truncate">{user.email}</p>
                </div>
                <div className={`w-2 h-2 rounded-full ${user.active !== false ? 'bg-green-500' : 'bg-gray-500'}`} />
              </div>
            </div>
          ))}

          {filteredUsers.length === 0 && (
            <div className="card text-center py-8">
              <p className="text-gray-400">No users found</p>
            </div>
          )}
        </div>
      )}

      {/* User Detail Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center" onClick={() => { setSelectedUser(null); setEditingEmail(false); setResettingPassword(false); setShowDeleteConfirm(false); }}>
          <div
            className="bg-dark-card w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-dark-border flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">User Details</h2>
              <button onClick={() => { setSelectedUser(null); setEditingEmail(false); setResettingPassword(false); setShowDeleteConfirm(false); }} className="btn-ghost p-2">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4 space-y-6">
              {/* Action Message */}
              {actionMessage && (
                <div className={`p-3 rounded-xl text-sm ${
                  actionMessage.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                }`}>
                  {actionMessage.message}
                </div>
              )}

              {/* User Info */}
              <div className="text-center">
                <div className="relative w-20 h-20 mx-auto mb-4">
                  {selectedUser.avatarUrl ? (
                    <img
                      src={selectedUser.avatarUrl}
                      alt={selectedUser.name}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full rounded-full bg-accent/20 flex items-center justify-center text-accent text-2xl font-medium">
                      {selectedUser.name?.charAt(0).toUpperCase() || '?'}
                    </div>
                  )}
                  {selectedUser.avatarUrl && (
                    <button
                      onClick={removeUserAvatar}
                      className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-error flex items-center justify-center"
                      title="Remove avatar"
                    >
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
                <h3 className="text-xl font-bold text-white">{selectedUser.name}</h3>
                <p className="text-gray-400">{selectedUser.email}</p>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="card text-center">
                  <p className="text-xl font-bold text-white">{selectedUser.workoutCount || 0}</p>
                  <p className="text-gray-400 text-sm">Workouts</p>
                </div>
                <div className="card text-center">
                  <p className="text-xl font-bold text-white">{selectedUser.streak || 0}</p>
                  <p className="text-gray-400 text-sm">Day Streak</p>
                </div>
              </div>

              {/* Update Email */}
              <div className="card">
                <h4 className="text-white font-medium mb-3">Email Address</h4>
                {editingEmail ? (
                  <div className="space-y-2">
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="New email address"
                      className="input w-full"
                    />
                    <div className="flex gap-2">
                      <button onClick={() => { setEditingEmail(false); setNewEmail(''); }} className="btn-secondary flex-1">
                        Cancel
                      </button>
                      <button onClick={updateUserEmail} className="btn-primary flex-1">
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">{selectedUser.email}</span>
                    <button
                      onClick={() => { setEditingEmail(true); setNewEmail(selectedUser.email); }}
                      className="btn-ghost p-2 text-accent"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>

              {/* Reset Password */}
              <div className="card">
                <h4 className="text-white font-medium mb-3">Reset Password</h4>
                {resettingPassword ? (
                  <div className="space-y-2">
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="New password (min 6 characters)"
                      className="input w-full"
                    />
                    <div className="flex gap-2">
                      <button onClick={() => { setResettingPassword(false); setNewPassword(''); }} className="btn-secondary flex-1">
                        Cancel
                      </button>
                      <button onClick={resetUserPassword} className="btn-primary flex-1">
                        Reset
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setResettingPassword(true)}
                    className="btn-secondary w-full"
                  >
                    Reset User Password
                  </button>
                )}
              </div>

              {/* Role */}
              <div className="card">
                <h4 className="text-white font-medium mb-3">Role</h4>
                <div className="flex gap-2">
                  <button
                    onClick={() => updateUserRole(selectedUser.id, 'USER')}
                    className={`flex-1 py-2 rounded-xl text-sm ${
                      selectedUser.role === 'USER' ? 'bg-accent text-white' : 'bg-dark-elevated text-gray-400'
                    }`}
                  >
                    User
                  </button>
                  <button
                    onClick={() => updateUserRole(selectedUser.id, 'ADMIN')}
                    className={`flex-1 py-2 rounded-xl text-sm ${
                      selectedUser.role === 'ADMIN' ? 'bg-accent text-white' : 'bg-dark-elevated text-gray-400'
                    }`}
                  >
                    Admin
                  </button>
                </div>
              </div>

              {/* Status */}
              <div className="card">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-medium">Account Active</p>
                    <p className="text-gray-500 text-sm">Allow user to log in</p>
                  </div>
                  <button
                    onClick={() => toggleUserStatus(selectedUser.id, selectedUser.active === false)}
                    className={`w-12 h-7 rounded-full transition-colors relative ${
                      selectedUser.active !== false ? 'bg-green-500' : 'bg-dark-elevated'
                    }`}
                  >
                    <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${
                      selectedUser.active !== false ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>
              </div>

              {/* Delete User */}
              <div className="card border-error/30">
                <h4 className="text-error font-medium mb-3">Danger Zone</h4>
                {showDeleteConfirm ? (
                  <div className="space-y-3">
                    <p className="text-gray-400 text-sm">
                      Are you sure you want to delete <span className="text-white">{selectedUser.name}</span>?
                      This action cannot be undone.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowDeleteConfirm(false)}
                        className="btn-secondary flex-1"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={deleteUser}
                        className="flex-1 py-2 px-4 rounded-xl bg-error text-white hover:bg-error/80 transition-colors"
                      >
                        Delete User
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="w-full py-2 px-4 rounded-xl border border-error/50 text-error hover:bg-error/10 transition-colors"
                  >
                    Delete User Account
                  </button>
                )}
              </div>

              {/* Created At */}
              <div className="text-center text-gray-500 text-sm">
                Joined {new Date(selectedUser.createdAt).toLocaleDateString()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default UserManagement
