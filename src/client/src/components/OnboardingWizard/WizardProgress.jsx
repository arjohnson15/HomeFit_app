function WizardProgress({ currentStep, totalSteps }) {
  const stepLabels = ['Welcome', 'Privacy', 'Training', 'Nutrition']

  return (
    <div className="px-6 py-4 border-b border-dark-border">
      {/* Progress bar */}
      <div className="flex gap-2">
        {[...Array(totalSteps)].map((_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
              i <= currentStep ? 'bg-accent' : 'bg-dark-elevated'
            }`}
          />
        ))}
      </div>

      {/* Step label */}
      <div className="flex items-center justify-between mt-2">
        <p className="text-gray-500 text-sm">
          Step {currentStep + 1} of {totalSteps}
        </p>
        <p className="text-gray-400 text-sm font-medium">
          {stepLabels[currentStep]}
        </p>
      </div>
    </div>
  )
}

export default WizardProgress
