const experienceLevels = [
  { id: 'beginner', label: 'Beginner', desc: 'Less than 1 year training' },
  { id: 'intermediate', label: 'Intermediate', desc: '1-3 years training' },
  { id: 'advanced', label: 'Advanced', desc: '3+ years training' }
]

const liftingStyles = [
  { id: 'powerlifting', label: 'Powerlifting', icon: '🏋️' },
  { id: 'bodybuilding', label: 'Bodybuilding', icon: '💪' },
  { id: 'strength', label: 'Strength', icon: '🔥' },
  { id: 'crossfit', label: 'CrossFit', icon: '⚡' },
  { id: 'calisthenics', label: 'Calisthenics', icon: '🤸' }
]

const equipmentCategories = [
  {
    category: 'Free Weights',
    items: [
      { id: 'barbell', label: 'Barbell' },
      { id: 'dumbbell', label: 'Dumbbells' },
      { id: 'kettlebell', label: 'Kettlebells' }
    ]
  },
  {
    category: 'Benches & Racks',
    items: [
      { id: 'flat_bench', label: 'Flat Bench' },
      { id: 'adjustable_bench', label: 'Adjustable Bench' },
      { id: 'squat_rack', label: 'Squat Rack/Power Cage' }
    ]
  },
  {
    category: 'Machines',
    items: [
      { id: 'cable_machine', label: 'Cable Machine' },
      { id: 'lat_pulldown', label: 'Lat Pulldown' },
      { id: 'leg_press', label: 'Leg Press' }
    ]
  },
  {
    category: 'Bodyweight',
    items: [
      { id: 'pullup_bar', label: 'Pull-up Bar' },
      { id: 'dip_station', label: 'Dip Station' },
      { id: 'resistance_bands', label: 'Resistance Bands' }
    ]
  }
]

function TrainingStep({ data, updateData, showEquipment, setShowEquipment }) {
  const toggleEquipment = (id) => {
    const current = data.equipmentAccess || []
    const updated = current.includes(id)
      ? current.filter(e => e !== id)
      : [...current, id]
    updateData({ equipmentAccess: updated })
  }

  return (
    <div className="p-4 space-y-5">
      {/* Header */}
      <div className="text-center">
        <div className="w-16 h-16 bg-accent/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Training Style</h2>
        <p className="text-gray-400 text-sm">
          Help us personalize your workout experience
        </p>
      </div>

      {/* Experience Level */}
      <div>
        <label className="block text-white font-medium mb-3">Experience Level</label>
        <div className="space-y-2">
          {experienceLevels.map((level) => (
            <button
              key={level.id}
              onClick={() => updateData({ experienceLevel: level.id })}
              className={`w-full p-3 rounded-xl text-left transition-colors flex items-center justify-between ${
                data.experienceLevel === level.id
                  ? 'bg-accent text-white'
                  : 'bg-dark-elevated text-gray-400 hover:text-white'
              }`}
            >
              <span className="font-medium">{level.label}</span>
              <span className={`text-sm ${data.experienceLevel === level.id ? 'text-white/70' : 'text-gray-500'}`}>
                {level.desc}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Lifting Style */}
      <div>
        <label className="block text-white font-medium mb-3">Lifting Style</label>
        <div className="grid grid-cols-2 gap-2">
          {liftingStyles.map((style) => (
            <button
              key={style.id}
              onClick={() => updateData({ liftingStyle: style.id })}
              className={`p-3 rounded-xl text-left transition-colors ${
                data.liftingStyle === style.id
                  ? 'bg-accent text-white'
                  : 'bg-dark-elevated text-gray-400 hover:text-white'
              }`}
            >
              <span className="text-lg mr-2">{style.icon}</span>
              <span className="font-medium">{style.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Workouts Per Week */}
      <div>
        <label className="block text-white font-medium mb-3">Workouts Per Week</label>
        <div className="grid grid-cols-7 gap-2">
          {[1, 2, 3, 4, 5, 6, 7].map((days) => (
            <button
              key={days}
              onClick={() => updateData({ workoutsPerWeek: days })}
              className={`py-3 rounded-xl font-medium transition-colors ${
                data.workoutsPerWeek === days
                  ? 'bg-accent text-white'
                  : 'bg-dark-elevated text-gray-400 hover:text-white'
              }`}
            >
              {days}
            </button>
          ))}
        </div>
      </div>

      {/* Equipment Expansion Toggle */}
      {!showEquipment ? (
        <button
          onClick={() => setShowEquipment(true)}
          className="w-full p-4 rounded-xl bg-dark-elevated border border-dashed border-dark-border text-center hover:border-accent/50 transition-colors"
        >
          <div className="flex items-center justify-center gap-2 text-gray-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span>Want to set up your available equipment?</span>
          </div>
          <p className="text-gray-500 text-xs mt-1">This helps filter exercises to match your setup</p>
        </button>
      ) : (
        <div className="bg-dark-elevated rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-medium">Available Equipment</h3>
            <button
              onClick={() => setShowEquipment(false)}
              className="text-gray-500 hover:text-white text-sm"
            >
              Collapse
            </button>
          </div>

          <div className="space-y-4">
            {equipmentCategories.map((category) => (
              <div key={category.category}>
                <p className="text-gray-400 text-xs uppercase tracking-wide mb-2">{category.category}</p>
                <div className="grid grid-cols-2 gap-2">
                  {category.items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => toggleEquipment(item.id)}
                      className={`p-2 rounded-lg text-sm text-left transition-colors flex items-center gap-2 ${
                        (data.equipmentAccess || []).includes(item.id)
                          ? 'bg-accent text-white'
                          : 'bg-dark-card text-gray-400 hover:text-white'
                      }`}
                    >
                      <svg
                        className={`w-4 h-4 flex-shrink-0 ${(data.equipmentAccess || []).includes(item.id) ? 'text-white' : 'text-gray-600'}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        {(data.equipmentAccess || []).includes(item.id) ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        )}
                      </svg>
                      <span className="truncate">{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <p className="text-gray-500 text-xs mt-4 text-center">
            You can add more equipment later in Settings
          </p>
        </div>
      )}

      <p className="text-gray-500 text-xs text-center">
        You can always adjust these in Settings → Training Style
      </p>
    </div>
  )
}

export default TrainingStep
