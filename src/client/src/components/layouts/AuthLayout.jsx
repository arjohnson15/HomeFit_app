import { Outlet } from 'react-router-dom'
import { motion } from 'framer-motion'

function AuthLayout() {
  return (
    <div className="min-h-screen bg-dark-bg flex flex-col items-center justify-center p-4">
      {/* Logo/Brand */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 text-center"
      >
        <img src="/full-logo.png" alt="HomeFit" className="h-24 mx-auto mb-4" />
        <p className="text-gray-400">Your personal home gym tracker</p>
      </motion.div>

      {/* Auth Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md"
      >
        <div className="card">
          <Outlet />
        </div>
      </motion.div>

      {/* Footer */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="mt-8 text-gray-500 text-sm"
      >
        Train smarter. Get stronger.
      </motion.p>
    </div>
  )
}

export default AuthLayout
