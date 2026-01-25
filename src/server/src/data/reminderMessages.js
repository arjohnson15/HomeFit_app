// Fun Workout Reminder Messages by Personality Type
// Each personality has messages organized by days inactive

const PERSONALITIES = {
  drill_sergeant: {
    name: 'Drill Sergeant',
    emoji: '🎖️',
    description: 'No excuses! Get moving, soldier!',
    preview: "DROP AND GIVE ME 20! Your muscles are getting SOFT!"
  },
  supportive: {
    name: 'Supportive Friend',
    emoji: '🤗',
    description: 'Gentle encouragement and positivity',
    preview: "Hey! Just a friendly reminder - you've got this!"
  },
  sarcastic: {
    name: 'Sarcastic Gym Bro',
    emoji: '😏',
    description: 'Witty motivation with a side of sass',
    preview: "Oh, you're tired? Cool story bro. The weights don't care."
  },
  motivational: {
    name: 'Motivational Speaker',
    emoji: '🔥',
    description: 'Inspiring quotes and powerful energy',
    preview: "Today is the day you become 1% better than yesterday!"
  },
  dad_jokes: {
    name: 'Dad Joke Coach',
    emoji: '👨',
    description: 'Puns, dad jokes, and groans guaranteed',
    preview: "Why did the dumbbell go to therapy? Too much emotional weight!"
  }
}

// Messages by personality and days inactive
const REMINDER_MESSAGES = {
  drill_sergeant: {
    1: [
      "ATTENTION! Your workout is waiting. Don't make me come find you!",
      "Rise and shine, soldier! Those weights aren't going to lift themselves!",
      "I don't hear any gym equipment moving! GET TO IT!",
      "Your muscles are getting COMFORTABLE. Time to WAKE THEM UP!",
      "Did I say you could take a day off? I DON'T THINK SO!"
    ],
    2: [
      "TWO DAYS without training?! Your gains are going AWOL!",
      "I've seen potatoes with more discipline. MOVE IT!",
      "Those dumbbells have been crying without you. Don't be heartless!",
      "Your excuses are weaker than an untrained bicep. DROP AND GIVE ME EFFORT!",
      "This is NOT a drill! Get your behind to that workout space!"
    ],
    3: [
      "THREE DAYS?! Your muscles have filed a missing person report!",
      "I'm not angry, I'm DISAPPOINTED. And a little angry. GET MOVING!",
      "Your couch is NOT your commanding officer. I AM. Now TRAIN!",
      "Every minute you waste is a rep your future self is crying about!",
      "You think results come from REST? Wrong! They come from WORK!"
    ],
    5: [
      "FIVE DAYS! At this point, your body thinks exercise was just a rumor!",
      "Did you retire from fitness without telling me?! UNACCEPTABLE!",
      "Your muscles are holding a protest. They demand to be used!",
      "Even my drill whistle is getting hoarse waiting for you. TRAIN NOW!",
      "This isn't a vacation, recruit! Your body is a machine - USE IT!"
    ],
    7: [
      "ONE WEEK?! I've trained HOUSEPLANTS with more consistency!",
      "Your gym equipment is gathering DUST and SHAME. Both are bad!",
      "A week without training?! Time to drop and give me YOUR BEST EFFORT!",
      "Your gains have officially entered the witness protection program!",
      "SEVEN DAYS! At ease, soldier? NO! AT WORKOUT!"
    ],
    14: [
      "TWO WEEKS! Even I'm starting to think you're a myth!",
      "Legend has it, someone named {name} used to work out here...",
      "Your muscles have forgotten what you look like! SAD!",
      "I'm drafting a SEARCH AND RESCUE mission for your motivation!",
      "Fourteen days... I've trained rocks that showed more commitment!"
    ]
  },

  supportive: {
    1: [
      "Hey {name}! Just a gentle reminder that your workout is ready when you are 💪",
      "No pressure, but today is a great day for some movement! You've got this!",
      "Just checking in! Even a quick 15 minutes counts. We believe in you!",
      "Hey friend! Your workout misses you. Ready to make it happen?",
      "Friendly nudge: Your body will thank you for some exercise today!"
    ],
    2: [
      "Hi {name}! Two days is okay - life happens! But today could be great!",
      "Missing you! Remember, any workout is better than no workout 🌟",
      "Just a friendly check-in. We're here cheering you on when you're ready!",
      "Taking a break is fine, but don't forget how good you feel after a workout!",
      "Two days without training, no judgment here! Ready to get back at it?"
    ],
    3: [
      "Hey {name}! Three days off - we all need rest sometimes. Ready to restart?",
      "Just thinking about you! A small workout today can make a big difference 💙",
      "Three days is nothing! Today is the perfect day for a fresh start!",
      "We believe in you! One workout today and you're back on track!",
      "Missing your energy! Remember why you started this journey."
    ],
    5: [
      "Hi {name}! It's been 5 days - everything okay? We're here for you!",
      "Five days is just a pause, not a stop. Ready when you are!",
      "We miss you! Even a walk or light stretch would be wonderful today.",
      "Life gets busy, we get it. But you deserve to feel strong!",
      "Just a gentle reminder: You're capable of amazing things. Like a workout!"
    ],
    7: [
      "Hey {name}! A full week - that's okay! Tomorrow is a new day too.",
      "One week off doesn't erase your progress. You can start fresh today!",
      "We're still here cheering for you! Ready whenever you are.",
      "A week is just 7 days. Today can be day 1 of an awesome streak!",
      "Missing you lots! Your journey is still yours - pick it back up anytime!"
    ],
    14: [
      "Hi {name}! It's been two weeks - just want you to know we're still here!",
      "Two weeks off? That's okay! Your workout will welcome you back with open arms.",
      "We haven't forgotten about you! And your fitness journey hasn't either.",
      "Fourteen days is just a number. Your comeback story starts whenever you say go!",
      "We believe in you, {name}! Even a tiny step today is still progress."
    ]
  },

  sarcastic: {
    1: [
      "Oh, taking a day off? Your couch and I were just talking about you...",
      "Netflix isn't going anywhere, but your gains might be. Just saying.",
      "So... we're just NOT going to acknowledge the workout you skipped? Cool, cool.",
      "Your workout: 😢 You: 🛋️ Netflix: 😈",
      "Legend says someone was supposed to exercise today..."
    ],
    2: [
      "Two days off? Your dumbbells are starting a support group.",
      "Oh you're 'resting'? Interesting strategy. Bold, but interesting.",
      "Day 2 of you avoiding exercise. Your muscles are taking notes.",
      "I see we're on the 'Wishful Thinking' workout plan. How's that going?",
      "Your gym equipment: 'Am I a joke to you?'"
    ],
    3: [
      "Three days... I'm not mad, I'm just disappointed. Okay, a little mad.",
      "Your workout equipment is collecting dust AND feelings. Double whammy.",
      "Day 3: Your muscles have officially given up hope.",
      "At this point, your workout mat thinks it's a rug.",
      "Three days off? Your future beach body just sent you to voicemail."
    ],
    5: [
      "Five days! Your gains have filed a missing persons report.",
      "Oh, so we're just not doing fitness anymore? Good to know.",
      "Day 5: Even your stretching routine is judging you.",
      "Remember exercise? Pepperidge Farm remembers.",
      "Your body: 'Are we ever going to work out again?' You: 'Yes.' Your body: 'So that was a lie.'"
    ],
    7: [
      "A WHOLE week?! Your muscles thought you moved to a new city.",
      "Seven days. That's almost a personal record for avoiding exercise!",
      "Your workout gear has started listing itself on eBay.",
      "Week 1 of your 'Extended Couch Sabbatical.' How zen.",
      "At this rate, your gym membership is basically a donation."
    ],
    14: [
      "Two weeks?! At this point, exercise is just a rumor in your life.",
      "14 days... Your fitness app has trust issues now.",
      "Your muscles have officially entered the 'What could have been' phase.",
      "Wow, 2 weeks! At least you're committed... to NOT working out.",
      "Your body has forgotten what sweat feels like. Congrats?"
    ]
  },

  motivational: {
    1: [
      "Today is not just another day. It's YOUR day to get stronger, {name}!",
      "Champions are made when nobody is watching. Time to train! 🔥",
      "The pain you feel today is the strength you feel tomorrow. Let's go!",
      "Every workout is a step toward the best version of yourself!",
      "Your only limit is you. Break through it today! 💪"
    ],
    2: [
      "Two days ago was history. Today is your opportunity! Seize it!",
      "The comeback is always stronger than the setback. Let's GO!",
      "Your future self is counting on the decisions you make today!",
      "Success isn't owned, it's rented. And the rent is due TODAY!",
      "Two days off means two days of rest. Now it's time to RISE!"
    ],
    3: [
      "Three days off? That's just the calm before YOUR storm! 🌩️",
      "Your potential is limitless. Today is the day you prove it!",
      "The difference between who you ARE and who you WANT TO BE is what you DO!",
      "Great things never came from comfort zones. Step out TODAY!",
      "Every champion was once a contender who refused to give up!"
    ],
    5: [
      "Five days is just a pause in your victory march. Resume the MISSION!",
      "You have the power to write your story. Make today a GREAT chapter!",
      "Discipline is choosing between what you want NOW and what you want MOST!",
      "The only bad workout is the one that didn't happen. Change that TODAY!",
      "You are stronger than your excuses. PROVE IT! 🔥"
    ],
    7: [
      "A week is 7 new opportunities. Today is opportunity NUMBER ONE!",
      "Your journey is not over. It's just getting INTERESTING!",
      "The harder the struggle, the more glorious the triumph. RISE UP!",
      "One week off doesn't define you. Your COMEBACK will!",
      "Today you can start building the life you want. One rep at a time!"
    ],
    14: [
      "Two weeks off? Your GREATEST comeback story starts RIGHT NOW!",
      "Your past does not determine your future. TODAY determines your future!",
      "The phoenix rises from the ashes. Time for YOUR resurrection!",
      "Every master was once a disaster. Today, begin your mastery!",
      "14 days of rest = 14 days of stored ENERGY. Time to UNLEASH IT!"
    ]
  },

  dad_jokes: {
    1: [
      "Why did the dumbbell go to therapy? Too much emotional weight! 😄 Now go lift yours!",
      "I tried to come up with a gym joke... but I'm still working out the details! Speaking of which...",
      "What did the weight say to the bodybuilder? 'You lift me up!' Your turn!",
      "Why don't scientists trust atoms? They make up everything! Unlike YOUR workout excuses. Go train!",
      "I used to hate working out... but then it grew on me. Like muscles! Get it? 💪"
    ],
    2: [
      "What do you call a fake noodle? An IMPASTA! What do you call skipping leg day? A MISTAKE!",
      "Why did the gym close down? It just didn't work out! Unlike you - YOU can work out today!",
      "I told my trainer I wanted to touch my toes. She asked if I was in the living room. I said 'No, living room is too far.' 🤣",
      "Two days without exercise? That's not very punny. I mean funny. Go workout!",
      "Why do hamburgers go to the gym? To get better buns! What about you?"
    ],
    3: [
      "What's a personal trainer's favorite day? WEIGH day! Time to get back to it!",
      "Why did the scarecrow win an award? Because he was outstanding in his field! Be outstanding in your workout!",
      "Three days off? You're really pushing my buttons. Speaking of pushing... push-ups?",
      "What do you call someone who doesn't finish their workout? You, apparently! 😆 Just kidding, go train!",
      "I'm reading a book about anti-gravity. Can't put it down! You know what else can't be put down? Your fitness goals!"
    ],
    5: [
      "Why don't eggs tell jokes? They'd crack each other up! Speaking of cracking... time to crack open that workout!",
      "What did the yoga instructor say when the electricity went out? 'Namaste in the dark!' Five days? Let's light up that workout!",
      "I wondered why the barbell was getting bigger. Then it hit me! 😂 Time to hit YOUR workout!",
      "What's a ghoul's favorite exercise? DEAD-lifts! 💀 Your workout is dying to see you!",
      "Five days? I'm not mad, I'm just FLEXED. I mean VEXED. Time to get flexed for real!"
    ],
    7: [
      "Why did the cookie go to the gym? It wanted to be a wafer thin! A whole week?! 🍪",
      "What did one treadmill say to the other? 'We're going NOWHERE!' Don't be a treadmill, go somewhere!",
      "I went to the gym and asked if I could do the splits. They said 'How flexible are you?' I said 'I can't make Tuesdays.' 😄",
      "A week off? That's wheely bad. I mean REALLY bad. Okay, I'll stop. But you should START!",
      "What exercise do lazy people do? DIDDLY-SQUATS! Don't be lazy, do actual squats!"
    ],
    14: [
      "Why was the weight lifter so good at his job? He really knew how to raise the bar! 14 days?! Raise YOUR bar!",
      "What's a skeleton's least favorite room? The LIVING room - too much activity! You've had enough rest, time for activity!",
      "Two weeks off? That's un-BICEP-table! Get back to it! 💪",
      "I asked the gym trainer if he could teach me to do the splits. He said 'How flexible are you?' I said 'I can make it every other week.' NOT GOOD ENOUGH!",
      "What do you call 14 days without working out? A WEAK fortnight! (Weak... week... get it?) 🤣 Now GO!"
    ]
  }
}

// Streak alert messages (when user's streak is at risk)
const STREAK_ALERTS = {
  drill_sergeant: [
    "MAYDAY! MAYDAY! Your {streak}-day streak is about to CRASH! SAVE IT, SOLDIER!",
    "RED ALERT! That {streak}-day streak you built? ABOUT TO CRUMBLE! GET MOVING!",
    "Your streak is hanging by a THREAD! Don't let {streak} days of effort die!",
    "STREAK EMERGENCY! {streak} days on the line! This is NOT a drill!"
  ],
  supportive: [
    "Hey! Just a heads up - your amazing {streak}-day streak ends tonight. You can do it! 💪",
    "Your {streak}-day streak is counting on you today! Even a quick workout saves it!",
    "Quick reminder: that beautiful {streak}-day streak needs just a bit of love today!",
    "Rooting for you! A mini workout keeps your {streak}-day streak alive!"
  ],
  sarcastic: [
    "Oh cool, so we're just gonna let that {streak}-day streak die? Neat. 😐",
    "Your {streak}-day streak is making sad puppy eyes at you. Are you really gonna do this?",
    "Imagine explaining to your future self why you let a {streak}-day streak die...",
    "Your streak: 'I thought we had something special...' You: *ignores*"
  ],
  motivational: [
    "CHAMPIONS DON'T BREAK STREAKS! Your {streak}-day streak needs you NOW!",
    "That {streak}-day streak represents your DEDICATION! Don't let it slip away!",
    "Your {streak}-day streak is a symbol of your commitment. PROTECT IT! 🔥",
    "Today is the day that defines your {streak}-day streak! Rise to the challenge!"
  ],
  dad_jokes: [
    "Your {streak}-day streak is on thin ice! And that's not a cool pun to break! 🧊",
    "Why did the streak cross the road? TO GET TO DAY {nextDay}! Help it get there!",
    "Your streak isn't just a number, it's a SCORE! And {streak} is a high score! Don't game over!",
    "Knock knock! Who's there? Your {streak}-day streak... about to be GONE if you don't workout! 😅"
  ]
}

// Achievement tease messages (close to unlocking)
const ACHIEVEMENT_TEASES = {
  drill_sergeant: [
    "SOLDIER! You're {remaining} workouts away from '{achievement}'! FINISH THE MISSION!",
    "'{achievement}' is within REACH! Just {remaining} more! Don't you DARE give up!",
    "I can SMELL that '{achievement}' badge! {remaining} workouts. GO GO GO!"
  ],
  supportive: [
    "So exciting! You're only {remaining} workouts away from earning '{achievement}'! 🌟",
    "You're SO close to '{achievement}'! Just {remaining} more to go. You've got this!",
    "Amazing progress! '{achievement}' is just {remaining} workouts away!"
  ],
  sarcastic: [
    "'{achievement}' is literally {remaining} workouts away. It's basically begging you. Don't be rude.",
    "You're {remaining} workouts from '{achievement}'. No pressure. Except all the pressure.",
    "So close to '{achievement}'... it would be a SHAME if someone didn't workout..."
  ],
  motivational: [
    "GLORY AWAITS! '{achievement}' is just {remaining} workouts away! Claim your destiny!",
    "You're on the BRINK of greatness! '{achievement}' needs just {remaining} more victories!",
    "The '{achievement}' badge has your name on it! {remaining} workouts to legendary status!"
  ],
  dad_jokes: [
    "Why did the achievement wait for you? Because it knew you'd be there in {remaining} workouts! 😄",
    "'{achievement}' is {remaining} workouts away. It's not rocket science... it's rocket GAINS! 🚀",
    "What did '{achievement}' say? 'I've been waiting for you!' Only {remaining} more!"
  ]
}

// Social motivation messages (friends' activity)
const SOCIAL_MESSAGES = {
  drill_sergeant: [
    "{friendCount} of your friends already trained today! Are you going to let them OUTWORK you?!",
    "Your friend {friendName} just crushed a workout! WHAT'S YOUR EXCUSE, SOLDIER?!",
    "The squad is training WITHOUT you! Fall in line, NOW!"
  ],
  supportive: [
    "{friendCount} friends worked out today! Want to join the fun? 💪",
    "Your friend {friendName} just finished training! You could be workout buddies today!",
    "Your fitness friends are on a roll! Ready to join them?"
  ],
  sarcastic: [
    "{friendCount} friends worked out today. Meanwhile, you're here reading this notification.",
    "{friendName} just worked out. But I'm sure your excuse is better than theirs was.",
    "Your friends are all getting fitter. Just thought you should know. 👀"
  ],
  motivational: [
    "YOUR TRIBE IS MOVING! {friendCount} friends trained today. Join the MOVEMENT!",
    "{friendName} is putting in the WORK! Let their energy INSPIRE you!",
    "Together we RISE! Your friends are training - be part of something BIGGER!"
  ],
  dad_jokes: [
    "{friendCount} friends exercised today! Don't be the odd one OUT... work IN! (Workout... get it?) 😂",
    "{friendName} just worked out! What's their secret? They didn't let puns stop them!",
    "Your friends are really FLEXING on you right now! Time to flex back!"
  ]
}

// Random fitness jokes (bonus content)
const RANDOM_JOKES = [
  "Why did the gym close down? It just didn't work out!",
  "I go to the gym religiously - about twice a year, around Easter and Christmas.",
  "My favorite exercise is a cross between a lunge and a crunch. It's called lunch.",
  "I like long romantic walks... to the fridge.",
  "The only exercise I get is jumping to conclusions and running my mouth.",
  "Gym tip: if you can't find your abs under the fat, they're still there. They're just in witness protection.",
  "I've been doing crunches twice a day now. Captain Crunch in the morning, Nestle Crunch at night.",
  "I don't sweat - I sparkle.",
  "Running late counts as cardio, right?",
  "I tried to do crunches, but Cheetos just taste better than floor."
]

// Helper function to get random message
function getRandomMessage(messages) {
  return messages[Math.floor(Math.random() * messages.length)]
}

// Helper function to get appropriate days category
function getDaysCategory(daysInactive) {
  if (daysInactive <= 1) return 1
  if (daysInactive === 2) return 2
  if (daysInactive <= 4) return 3
  if (daysInactive <= 6) return 5
  if (daysInactive <= 13) return 7
  return 14
}

// Main export function to get a reminder message
function getReminderMessage(personality, daysInactive, userName = 'friend') {
  const messages = REMINDER_MESSAGES[personality]
  if (!messages) {
    // Default to supportive if personality not found
    return getReminderMessage('supportive', daysInactive, userName)
  }

  const daysCategory = getDaysCategory(daysInactive)
  const categoryMessages = messages[daysCategory]

  if (!categoryMessages || categoryMessages.length === 0) {
    return "Time for a workout!"
  }

  let message = getRandomMessage(categoryMessages)
  // Replace {name} placeholder with actual name
  message = message.replace(/\{name\}/g, userName)

  return message
}

// Get streak alert message
function getStreakAlertMessage(personality, currentStreak, userName = 'friend') {
  const messages = STREAK_ALERTS[personality]
  if (!messages) {
    return getStreakAlertMessage('supportive', currentStreak, userName)
  }

  let message = getRandomMessage(messages)
  message = message.replace(/\{streak\}/g, currentStreak)
  message = message.replace(/\{nextDay\}/g, currentStreak + 1)
  message = message.replace(/\{name\}/g, userName)

  return message
}

// Get achievement tease message
function getAchievementTeaseMessage(personality, achievementName, remainingCount, userName = 'friend') {
  const messages = ACHIEVEMENT_TEASES[personality]
  if (!messages) {
    return getAchievementTeaseMessage('supportive', achievementName, remainingCount, userName)
  }

  let message = getRandomMessage(messages)
  message = message.replace(/\{achievement\}/g, achievementName)
  message = message.replace(/\{remaining\}/g, remainingCount)
  message = message.replace(/\{name\}/g, userName)

  return message
}

// Get social motivation message
function getSocialMessage(personality, friendCount, friendName = null, userName = 'friend') {
  const messages = SOCIAL_MESSAGES[personality]
  if (!messages) {
    return getSocialMessage('supportive', friendCount, friendName, userName)
  }

  // Filter messages based on whether we have a specific friend name
  const suitableMessages = friendName
    ? messages.filter(m => m.includes('{friendName}') || m.includes('{friendCount}'))
    : messages.filter(m => !m.includes('{friendName}'))

  let message = getRandomMessage(suitableMessages.length > 0 ? suitableMessages : messages)
  message = message.replace(/\{friendCount\}/g, friendCount)
  message = message.replace(/\{friendName\}/g, friendName || 'A friend')
  message = message.replace(/\{name\}/g, userName)

  return message
}

// Get a random fitness joke
function getRandomJoke() {
  return getRandomMessage(RANDOM_JOKES)
}

export {
  PERSONALITIES,
  REMINDER_MESSAGES,
  STREAK_ALERTS,
  ACHIEVEMENT_TEASES,
  SOCIAL_MESSAGES,
  RANDOM_JOKES,
  getReminderMessage,
  getStreakAlertMessage,
  getAchievementTeaseMessage,
  getSocialMessage,
  getRandomJoke,
  getDaysCategory
}
