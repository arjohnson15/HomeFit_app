import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../services/authStore'

function TermsOfService() {
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
          <h1 className="text-2xl font-bold text-white">Terms of Service</h1>
        </div>

        <div className="card space-y-6">
          <p className="text-gray-400 text-sm">Last updated: January 1, 2026</p>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">1. Acceptance of Terms</h2>
            <p className="text-gray-300 leading-relaxed">
              By accessing or using HomeFit, you agree to be bound by these Terms of Service and all applicable
              laws and regulations. If you do not agree with any of these terms, you are prohibited from using
              or accessing this application.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">2. Description of Service</h2>
            <p className="text-gray-300 leading-relaxed">
              HomeFit is a personal fitness tracking application designed to help users track workouts,
              monitor nutrition, and achieve their fitness goals. The service includes features such as
              exercise logging, progress tracking, AI-powered recommendations, meal planning, and social
              features for connecting with other fitness enthusiasts.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">3. User Accounts</h2>
            <p className="text-gray-300 leading-relaxed mb-3">
              To use HomeFit, you must create an account. You agree to:
            </p>
            <ul className="list-disc list-inside text-gray-300 space-y-2 ml-2">
              <li>Provide accurate and complete information when creating your account</li>
              <li>Maintain the security of your password and account</li>
              <li>Notify us immediately of any unauthorized use of your account</li>
              <li>Accept responsibility for all activities that occur under your account</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">4. Acceptable Use</h2>
            <p className="text-gray-300 leading-relaxed mb-3">
              You agree not to use HomeFit to:
            </p>
            <ul className="list-disc list-inside text-gray-300 space-y-2 ml-2">
              <li>Violate any applicable laws or regulations</li>
              <li>Infringe upon the rights of others</li>
              <li>Upload malicious content or attempt to compromise the system</li>
              <li>Impersonate another person or entity</li>
              <li>Harass, abuse, or harm other users</li>
              <li>Share inappropriate or offensive content</li>
              <li>Attempt to gain unauthorized access to the system</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">5. Health Disclaimer</h2>
            <p className="text-gray-300 leading-relaxed">
              <strong className="text-white">Important:</strong> HomeFit is not a medical application and does not provide
              medical advice. The workout recommendations, nutrition information, and fitness tracking features
              are for informational purposes only. Always consult with a qualified healthcare professional
              before starting any new exercise program or making significant changes to your diet. If you
              experience any pain, discomfort, or health issues during exercise, stop immediately and seek
              medical attention.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">6. AI-Generated Content</h2>
            <p className="text-gray-300 leading-relaxed">
              HomeFit may use artificial intelligence to generate workout recommendations, meal suggestions,
              and other content. While we strive to provide accurate and helpful recommendations, AI-generated
              content should be used as a guide only. You are responsible for evaluating whether any AI-generated
              recommendations are appropriate for your individual circumstances and fitness level.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">7. Intellectual Property</h2>
            <p className="text-gray-300 leading-relaxed">
              The HomeFit application, including its design, features, content, and underlying code, is owned
              by HomeFit and is protected by intellectual property laws. You may not copy, modify, distribute,
              or create derivative works based on any part of the application without our express written permission.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">8. User Content</h2>
            <p className="text-gray-300 leading-relaxed">
              You retain ownership of any content you create or upload to HomeFit (such as workout logs,
              progress photos, or posts). By uploading content, you grant HomeFit a non-exclusive, royalty-free
              license to use, store, and display your content as necessary to provide the service. You are
              solely responsible for the content you upload and must ensure it does not violate any laws or
              third-party rights.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">9. Limitation of Liability</h2>
            <p className="text-gray-300 leading-relaxed">
              To the maximum extent permitted by law, HomeFit and its operators shall not be liable for any
              indirect, incidental, special, consequential, or punitive damages, including but not limited to
              loss of profits, data, or other intangible losses, resulting from your use or inability to use
              the service, any injuries sustained during exercise, or any other matter relating to the service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">10. Service Modifications</h2>
            <p className="text-gray-300 leading-relaxed">
              We reserve the right to modify, suspend, or discontinue any part of HomeFit at any time, with
              or without notice. We will not be liable to you or any third party for any modification,
              suspension, or discontinuation of the service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">11. Account Termination</h2>
            <p className="text-gray-300 leading-relaxed">
              We may terminate or suspend your account at any time, without prior notice, for conduct that we
              believe violates these Terms of Service or is harmful to other users, us, or third parties, or
              for any other reason at our sole discretion. You may also delete your account at any time through
              the app settings.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">12. Changes to Terms</h2>
            <p className="text-gray-300 leading-relaxed">
              We may revise these Terms of Service at any time without notice. By continuing to use HomeFit
              after any changes become effective, you agree to be bound by the revised terms. It is your
              responsibility to review these terms periodically for updates.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">13. Governing Law</h2>
            <p className="text-gray-300 leading-relaxed">
              These Terms of Service shall be governed by and construed in accordance with the laws of the
              jurisdiction in which the HomeFit service operates, without regard to its conflict of law provisions.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">14. Contact</h2>
            <p className="text-gray-300 leading-relaxed">
              If you have any questions about these Terms of Service, please contact us through the app's
              feedback feature or by reaching out to your system administrator.
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

export default TermsOfService
