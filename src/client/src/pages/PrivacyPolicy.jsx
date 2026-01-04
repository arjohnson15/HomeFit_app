import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../services/authStore'

function PrivacyPolicy() {
  const navigate = useNavigate()
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

  const handleBack = () => {
    if (isAuthenticated) {
      navigate('/settings/about')
    } else {
      navigate(-1)
    }
  }

  return (
    <div className="min-h-screen bg-dark">
      <div className="max-w-3xl mx-auto p-4 pb-24">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button onClick={handleBack} className="btn-ghost p-2 -ml-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-2xl font-bold text-white">Privacy Policy</h1>
        </div>

        <div className="card space-y-6">
          <p className="text-gray-400 text-sm">Last updated: January 1, 2026</p>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">1. Introduction</h2>
            <p className="text-gray-300 leading-relaxed">
              Welcome to HomeFit. We are committed to protecting your personal information and your right to privacy.
              This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use
              our fitness tracking application.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">2. Information We Collect</h2>
            <p className="text-gray-300 leading-relaxed mb-3">
              We collect information that you provide directly to us, including:
            </p>
            <ul className="list-disc list-inside text-gray-300 space-y-2 ml-2">
              <li>Account information (name, email address, password)</li>
              <li>Profile information (age, gender, height, weight, fitness goals)</li>
              <li>Workout data (exercises, sets, reps, weights, duration)</li>
              <li>Nutrition data (meals, calories, macronutrients)</li>
              <li>Equipment preferences and training settings</li>
              <li>Progress photos (if you choose to upload them)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">3. How We Use Your Information</h2>
            <p className="text-gray-300 leading-relaxed mb-3">
              We use the information we collect to:
            </p>
            <ul className="list-disc list-inside text-gray-300 space-y-2 ml-2">
              <li>Provide, maintain, and improve our services</li>
              <li>Personalize your workout and nutrition recommendations</li>
              <li>Track your fitness progress over time</li>
              <li>Generate AI-powered workout suggestions based on your preferences</li>
              <li>Send you notifications and reminders (with your consent)</li>
              <li>Respond to your comments, questions, and support requests</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">4. Data Storage and Security</h2>
            <p className="text-gray-300 leading-relaxed">
              Your data is stored securely on our servers. We implement appropriate technical and organizational
              measures to protect your personal information against unauthorized access, alteration, disclosure,
              or destruction. Your password is encrypted and never stored in plain text.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">5. Data Sharing</h2>
            <p className="text-gray-300 leading-relaxed">
              We do not sell, trade, or rent your personal information to third parties. We may share your
              information only in the following circumstances:
            </p>
            <ul className="list-disc list-inside text-gray-300 space-y-2 ml-2 mt-3">
              <li>With your explicit consent</li>
              <li>To comply with legal obligations</li>
              <li>To protect our rights and prevent fraud</li>
              <li>With service providers who assist in operating our application (under strict confidentiality agreements)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">6. Your Rights</h2>
            <p className="text-gray-300 leading-relaxed mb-3">
              You have the right to:
            </p>
            <ul className="list-disc list-inside text-gray-300 space-y-2 ml-2">
              <li>Access your personal data</li>
              <li>Correct inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Export your data in a portable format</li>
              <li>Opt out of marketing communications</li>
              <li>Withdraw consent at any time</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">7. Data Retention</h2>
            <p className="text-gray-300 leading-relaxed">
              We retain your personal information for as long as your account is active or as needed to provide
              you services. You can delete your account at any time, and we will delete your data within 30 days
              of your request, unless we are required to retain it for legal purposes.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">8. Children's Privacy</h2>
            <p className="text-gray-300 leading-relaxed">
              HomeFit is not intended for users under the age of 13. We do not knowingly collect personal
              information from children under 13. If we learn that we have collected personal information
              from a child under 13, we will take steps to delete that information.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">9. Changes to This Policy</h2>
            <p className="text-gray-300 leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of any changes by
              posting the new Privacy Policy on this page and updating the "Last updated" date. You are
              advised to review this Privacy Policy periodically for any changes.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">10. Contact Us</h2>
            <p className="text-gray-300 leading-relaxed">
              If you have any questions about this Privacy Policy or our data practices, please contact us
              through the app's feedback feature or by reaching out to your system administrator.
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-gray-500 text-sm">
            &copy; 2026 HomeFit. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  )
}

export default PrivacyPolicy
