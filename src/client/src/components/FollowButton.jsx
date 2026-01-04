import { useState } from 'react'
import api from '../services/api'

function FollowButton({ friendId, initialFollowing = false, onFollowChange, size = 'default' }) {
  const [isFollowing, setIsFollowing] = useState(initialFollowing)
  const [loading, setLoading] = useState(false)

  const toggleFollow = async () => {
    setLoading(true)
    try {
      if (isFollowing) {
        await api.delete(`/social/follow/${friendId}`)
        setIsFollowing(false)
        onFollowChange?.(false)
      } else {
        await api.post(`/social/follow/${friendId}`)
        setIsFollowing(true)
        onFollowChange?.(true)
      }
    } catch (error) {
      console.error('Error toggling follow:', error)
    } finally {
      setLoading(false)
    }
  }

  const sizeClasses = {
    small: 'px-2 py-1 text-xs',
    default: 'px-3 py-1.5 text-sm',
    large: 'px-4 py-2 text-base'
  }

  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        e.preventDefault()
        toggleFollow()
      }}
      disabled={loading}
      className={`${sizeClasses[size]} rounded-lg font-medium transition-all duration-200 flex items-center gap-1.5 ${
        isFollowing
          ? 'bg-dark-elevated text-gray-400 hover:bg-red-500/20 hover:text-red-400 border border-dark-border'
          : 'bg-accent text-white hover:bg-accent/80'
      } disabled:opacity-50`}
    >
      {loading ? (
        <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : isFollowing ? (
        <>
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
          </svg>
          <span className="group-hover:hidden">Following</span>
        </>
      ) : (
        <>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          <span>Follow</span>
        </>
      )}
    </button>
  )
}

export default FollowButton
