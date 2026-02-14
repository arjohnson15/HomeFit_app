// Pre-built marathon route data with GPS waypoints
// Each route has ~50-100 waypoints for smooth map rendering

const MARATHON_ROUTES = [
  // =============================================
  // PASSIVE: Run/Bike Across America (NYC → LA)
  // =============================================
  {
    name: 'Run Across America',
    description: 'A coast-to-coast journey from New York City to Los Angeles. Every cardio workout automatically contributes to your progress across 2,800 miles of American landscape.',
    city: 'USA',
    country: 'USA',
    distance: 2800,
    type: 'run',
    difficulty: 'legendary',
    isPassive: true,
    routeData: [
      [40.7128, -74.0060],   // New York City
      [40.7357, -74.1724],   // Newark, NJ
      [40.4862, -74.4518],   // New Brunswick, NJ
      [40.2171, -74.7429],   // Trenton, NJ
      [39.9526, -75.1652],   // Philadelphia, PA
      [39.9625, -75.6057],   // West Chester, PA
      [40.0379, -76.3055],   // Lancaster, PA
      [40.2732, -76.8867],   // Harrisburg, PA
      [40.4406, -79.9959],   // Pittsburgh, PA
      [40.4406, -80.6148],   // East Liverpool, OH
      [40.7989, -81.3784],   // Canton, OH
      [41.0814, -81.5190],   // Akron, OH
      [40.7608, -82.5155],   // Mansfield, OH
      [40.3428, -83.7730],   // Bellefontaine, OH
      [39.7684, -86.1581],   // Indianapolis, IN
      [39.7817, -86.7816],   // Greencastle, IN
      [39.4667, -87.4139],   // Terre Haute, IN
      [38.6270, -90.1994],   // St. Louis, MO
      [38.7510, -90.3733],   // St. Charles, MO
      [38.9517, -91.7711],   // Columbia, MO
      [39.0997, -94.5786],   // Kansas City, MO
      [38.8814, -94.8191],   // Olathe, KS
      [38.7251, -95.6890],   // Topeka, KS
      [38.8584, -97.6114],   // Salina, KS
      [38.8712, -99.3268],   // Hays, KS
      [39.7555, -104.9874],  // Denver, CO
      [39.8283, -105.7631],  // Idaho Springs, CO
      [39.6403, -106.3742],  // Vail, CO
      [39.5297, -107.3248],  // Glenwood Springs, CO
      [39.0639, -108.5506],  // Grand Junction, CO
      [38.5733, -109.5498],  // Moab, UT
      [38.7783, -110.9020],  // Green River, UT
      [39.3210, -111.0937],  // Price, UT
      [40.7608, -111.8910],  // Salt Lake City, UT
      [40.8448, -112.6562],  // Tooele, UT
      [40.7352, -114.0403],  // Wendover, UT
      [40.8324, -115.7631],  // Elko, NV
      [40.4555, -117.0658],  // Winnemucca, NV
      [39.5296, -119.8138],  // Reno, NV
      [38.8026, -119.9947],  // Gardnerville, NV
      [36.1699, -115.1398],  // Las Vegas, NV
      [35.2527, -115.9847],  // Baker, CA
      [35.0211, -116.8625],  // Barstow, CA
      [34.5362, -117.2928],  // Victorville, CA
      [34.1083, -117.2898],  // San Bernardino, CA
      [34.0522, -118.2437],  // Los Angeles, CA
    ],
    milestones: [
      { mile: 0, label: 'New York City, NY', lat: 40.7128, lng: -74.0060 },
      { mile: 97, label: 'Philadelphia, PA', lat: 39.9526, lng: -75.1652 },
      { mile: 305, label: 'Pittsburgh, PA', lat: 40.4406, lng: -79.9959 },
      { mile: 660, label: 'Indianapolis, IN', lat: 39.7684, lng: -86.1581 },
      { mile: 900, label: 'St. Louis, MO', lat: 38.6270, lng: -90.1994 },
      { mile: 1160, label: 'Kansas City, MO', lat: 39.0997, lng: -94.5786 },
      { mile: 1600, label: 'Denver, CO', lat: 39.7555, lng: -104.9874 },
      { mile: 2050, label: 'Salt Lake City, UT', lat: 40.7608, lng: -111.8910 },
      { mile: 2400, label: 'Las Vegas, NV', lat: 36.1699, lng: -115.1398 },
      { mile: 2800, label: 'Los Angeles, CA', lat: 34.0522, lng: -118.2437 },
    ]
  },

  // =============================================
  // WORLD MARATHON MAJORS
  // =============================================
  {
    name: 'Chicago Marathon',
    description: 'The Bank of America Chicago Marathon winds through 29 neighborhoods, from Grant Park through Lincoln Park, Wrigleyville, Chinatown, and back.',
    city: 'Chicago, IL',
    country: 'USA',
    distance: 26.2,
    type: 'run',
    difficulty: 'intermediate',
    routeData: [
      [41.8744, -87.6245],   // Start - Grant Park / Columbus
      [41.8836, -87.6244],   // North on Columbus
      [41.8926, -87.6247],   // Grand Ave
      [41.9023, -87.6310],   // River North
      [41.9109, -87.6345],   // Clark St
      [41.9256, -87.6389],   // North Ave
      [41.9360, -87.6427],   // Armitage
      [41.9478, -87.6553],   // Lincoln Park
      [41.9562, -87.6558],   // Diversey
      [41.9537, -87.6637],   // Sheffield
      [41.9481, -87.6688],   // Wrigleyville area
      [41.9398, -87.6528],   // Lakeview south
      [41.9268, -87.6436],   // Lincoln Park south
      [41.9109, -87.6375],   // Old Town
      [41.8979, -87.6334],   // Near North Side
      [41.8876, -87.6395],   // West Loop
      [41.8809, -87.6502],   // UIC area
      [41.8721, -87.6567],   // Little Italy
      [41.8654, -87.6655],   // Pilsen
      [41.8568, -87.6559],   // Chinatown connector
      [41.8518, -87.6340],   // Chinatown
      [41.8488, -87.6262],   // Bridgeport
      [41.8442, -87.6247],   // 33rd St
      [41.8400, -87.6238],   // IIT area
      [41.8465, -87.6195],   // Turn north
      [41.8566, -87.6162],   // McCormick Place
      [41.8654, -87.6174],   // Museum Campus
      [41.8744, -87.6197],   // Finish - Grant Park
    ],
    milestones: [
      { mile: 0, label: 'Start - Grant Park', lat: 41.8744, lng: -87.6245 },
      { mile: 5, label: 'Lincoln Park Zoo', lat: 41.9256, lng: -87.6389 },
      { mile: 10, label: 'Wrigleyville', lat: 41.9481, lng: -87.6688 },
      { mile: 13.1, label: 'Halfway - Old Town', lat: 41.9109, lng: -87.6375 },
      { mile: 15, label: 'West Loop', lat: 41.8876, lng: -87.6395 },
      { mile: 20, label: 'Chinatown', lat: 41.8518, lng: -87.6340 },
      { mile: 25, label: 'Museum Campus', lat: 41.8654, lng: -87.6174 },
      { mile: 26.2, label: 'Finish - Grant Park', lat: 41.8744, lng: -87.6197 },
    ]
  },
  {
    name: 'Boston Marathon',
    description: 'The world\'s oldest annual marathon, running from Hopkinton to Copley Square in Boston. Famous for Heartbreak Hill and the passionate crowds.',
    city: 'Boston, MA',
    country: 'USA',
    distance: 26.2,
    type: 'run',
    difficulty: 'advanced',
    routeData: [
      [42.2293, -71.5228],   // Start - Hopkinton
      [42.2319, -71.5059],   // Hopkinton east
      [42.2329, -71.4804],   // Ashland border
      [42.2508, -71.4638],   // Ashland
      [42.2656, -71.4367],   // Framingham
      [42.2832, -71.4167],   // Natick west
      [42.2880, -71.3579],   // Natick center
      [42.2928, -71.3268],   // Wellesley west
      [42.2965, -71.2987],   // Wellesley College (Scream Tunnel)
      [42.3084, -71.2710],   // Wellesley east
      [42.3235, -71.2425],   // Newton Lower Falls
      [42.3295, -71.2168],   // Newton Hills begin
      [42.3345, -71.1897],   // Heartbreak Hill
      [42.3405, -71.1675],   // Boston College
      [42.3445, -71.1512],   // Brighton
      [42.3465, -71.1304],   // Brookline
      [42.3478, -71.1095],   // Coolidge Corner
      [42.3485, -71.0904],   // Kenmore Square
      [42.3497, -71.0826],   // Mass Ave
      [42.3497, -71.0776],   // Finish - Copley Square
    ],
    milestones: [
      { mile: 0, label: 'Start - Hopkinton', lat: 42.2293, lng: -71.5228 },
      { mile: 5, label: 'Ashland', lat: 42.2508, lng: -71.4638 },
      { mile: 10, label: 'Natick Center', lat: 42.2880, lng: -71.3579 },
      { mile: 13.1, label: 'Wellesley (Scream Tunnel)', lat: 42.2965, lng: -71.2987 },
      { mile: 18, label: 'Newton Hills', lat: 42.3295, lng: -71.2168 },
      { mile: 20, label: 'Heartbreak Hill', lat: 42.3345, lng: -71.1897 },
      { mile: 25, label: 'Kenmore Square', lat: 42.3485, lng: -71.0904 },
      { mile: 26.2, label: 'Finish - Copley Square', lat: 42.3497, lng: -71.0776 },
    ]
  },
  {
    name: 'NYC Marathon',
    description: 'The TCS New York City Marathon crosses all five boroughs, from Staten Island through Brooklyn, Queens, The Bronx, and finishing in Central Park.',
    city: 'New York, NY',
    country: 'USA',
    distance: 26.2,
    type: 'run',
    difficulty: 'intermediate',
    routeData: [
      [40.6032, -74.0596],   // Start - Staten Island / Verrazzano
      [40.6197, -74.0363],   // Verrazzano Bridge
      [40.6425, -74.0135],   // Bay Ridge, Brooklyn
      [40.6605, -73.9892],   // Sunset Park
      [40.6772, -73.9705],   // Park Slope
      [40.6887, -73.9782],   // Prospect Park area
      [40.6930, -73.9575],   // Flatbush
      [40.6870, -73.9424],   // Bedford-Stuyvesant
      [40.6965, -73.9288],   // Williamsburg
      [40.7106, -73.9220],   // Greenpoint
      [40.7199, -73.9448],   // Pulaski Bridge to Queens
      [40.7434, -73.9236],   // Long Island City
      [40.7553, -73.9388],   // Queensboro Bridge
      [40.7614, -73.9617],   // Upper East Side, Manhattan
      [40.7756, -73.9522],   // Yorkville
      [40.7918, -73.9437],   // East Harlem
      [40.8075, -73.9413],   // Harlem
      [40.8140, -73.9350],   // Willis Ave Bridge to Bronx
      [40.8200, -73.9280],   // The Bronx
      [40.8100, -73.9340],   // Madison Ave Bridge back
      [40.7940, -73.9502],   // Harlem south
      [40.7860, -73.9580],   // Fifth Ave into Central Park
      [40.7752, -73.9680],   // Central Park East
      [40.7680, -73.9734],   // Finish - Central Park
    ],
    milestones: [
      { mile: 0, label: 'Start - Staten Island', lat: 40.6032, lng: -74.0596 },
      { mile: 3, label: 'Bay Ridge, Brooklyn', lat: 40.6425, lng: -74.0135 },
      { mile: 8, label: 'Bedford-Stuyvesant', lat: 40.6870, lng: -73.9424 },
      { mile: 13.1, label: 'Halfway - LIC, Queens', lat: 40.7434, lng: -73.9236 },
      { mile: 16, label: 'Upper East Side', lat: 40.7614, lng: -73.9617 },
      { mile: 20, label: 'The Bronx', lat: 40.8200, lng: -73.9280 },
      { mile: 23, label: 'Fifth Ave, Harlem', lat: 40.7860, lng: -73.9580 },
      { mile: 26.2, label: 'Finish - Central Park', lat: 40.7680, lng: -73.9734 },
    ]
  },
  {
    name: 'London Marathon',
    description: 'The TCS London Marathon runs from Greenwich to The Mall, passing Tower Bridge, the Thames embankment, and Buckingham Palace.',
    city: 'London',
    country: 'UK',
    distance: 26.2,
    type: 'run',
    difficulty: 'intermediate',
    routeData: [
      [51.4742, 0.0151],     // Start - Greenwich / Blackheath
      [51.4772, 0.0058],     // Greenwich Park edge
      [51.4810, -0.0044],    // Greenwich town
      [51.4836, -0.0188],    // Deptford
      [51.4771, -0.0339],    // Surrey Quays
      [51.4700, -0.0504],    // Bermondsey
      [51.4619, -0.0602],    // Rotherhithe
      [51.4550, -0.0503],    // Surrey Docks
      [51.4493, -0.0341],    // Isle of Dogs north
      [51.4890, -0.0293],    // Canary Wharf area
      [51.4950, -0.0164],    // Poplar
      [51.5055, -0.0259],    // Limehouse
      [51.5076, -0.0450],    // Tower Bridge approach
      [51.5058, -0.0753],    // Tower Bridge / Monument
      [51.5071, -0.0863],    // Cannon St
      [51.5095, -0.0990],    // Blackfriars
      [51.5078, -0.1114],    // Temple
      [51.5061, -0.1224],    // Embankment
      [51.5018, -0.1347],    // Westminster Bridge
      [51.4968, -0.1397],    // Lambeth
      [51.5001, -0.1267],    // Back to Westminster
      [51.5023, -0.1347],    // Big Ben
      [51.5017, -0.1412],    // Birdcage Walk
      [51.5014, -0.1419],    // Finish - The Mall / Buckingham Palace
    ],
    milestones: [
      { mile: 0, label: 'Start - Greenwich', lat: 51.4742, lng: 0.0151 },
      { mile: 5, label: 'Bermondsey', lat: 51.4700, lng: -0.0504 },
      { mile: 10, label: 'Isle of Dogs', lat: 51.4493, lng: -0.0341 },
      { mile: 13.1, label: 'Halfway - Canary Wharf', lat: 51.4890, lng: -0.0293 },
      { mile: 15, label: 'Tower Bridge', lat: 51.5058, lng: -0.0753 },
      { mile: 20, label: 'Embankment', lat: 51.5061, lng: -0.1224 },
      { mile: 25, label: 'Big Ben', lat: 51.5023, lng: -0.1347 },
      { mile: 26.2, label: 'Finish - Buckingham Palace', lat: 51.5014, lng: -0.1419 },
    ]
  },
  {
    name: 'Berlin Marathon',
    description: 'The BMW Berlin Marathon is known as the world\'s fastest course, running through the Brandenburg Gate, Tiergarten, and past iconic Berlin landmarks.',
    city: 'Berlin',
    country: 'Germany',
    distance: 26.2,
    type: 'run',
    difficulty: 'beginner',
    routeData: [
      [52.5148, 13.3510],    // Start - Straße des 17. Juni
      [52.5163, 13.3630],    // Tiergarten
      [52.5090, 13.3745],    // Potsdamer Platz area
      [52.5045, 13.3845],    // Leipziger Str
      [52.5010, 13.4007],    // Checkpoint Charlie area
      [52.4905, 13.4215],    // Kreuzberg
      [52.4835, 13.4401],    // Alt-Treptow
      [52.4785, 13.4540],    // Treptower Park
      [52.4860, 13.4710],    // Neukölln
      [52.4940, 13.4510],    // North through Neukölln
      [52.4990, 13.4340],    // Tempelhof
      [52.4880, 13.4070],    // Schöneberg
      [52.4770, 13.3840],    // Steglitz
      [52.4720, 13.3540],    // Wilmersdorf
      [52.4820, 13.3280],    // Charlottenburg
      [52.5050, 13.3070],    // Charlottenburg Palace area
      [52.5190, 13.3200],    // Moabit
      [52.5340, 13.3580],    // Wedding
      [52.5380, 13.3890],    // Gesundbrunnen
      [52.5310, 13.4120],    // Prenzlauer Berg
      [52.5260, 13.4180],    // Alexanderplatz area
      [52.5200, 13.4050],    // Mitte
      [52.5170, 13.3915],    // Unter den Linden
      [52.5163, 13.3777],    // Brandenburg Gate
      [52.5148, 13.3510],    // Finish
    ],
    milestones: [
      { mile: 0, label: 'Start - Straße des 17. Juni', lat: 52.5148, lng: 13.3510 },
      { mile: 5, label: 'Checkpoint Charlie', lat: 52.5010, lng: 13.4007 },
      { mile: 10, label: 'Treptower Park', lat: 52.4785, lng: 13.4540 },
      { mile: 13.1, label: 'Halfway - Schöneberg', lat: 52.4880, lng: 13.4070 },
      { mile: 15, label: 'Wilmersdorf', lat: 52.4720, lng: 13.3540 },
      { mile: 20, label: 'Wedding', lat: 52.5340, lng: 13.3580 },
      { mile: 25, label: 'Unter den Linden', lat: 52.5170, lng: 13.3915 },
      { mile: 26.2, label: 'Finish - Brandenburg Gate', lat: 52.5163, lng: 13.3777 },
    ]
  },
  {
    name: 'Tokyo Marathon',
    description: 'The Tokyo Marathon starts at the Tokyo Metropolitan Government Building and finishes at Tokyo Station, passing through Ginza, Asakusa, and alongside the Imperial Palace.',
    city: 'Tokyo',
    country: 'Japan',
    distance: 26.2,
    type: 'run',
    difficulty: 'intermediate',
    routeData: [
      [35.6896, 139.6917],   // Start - Shinjuku (Metro Gov Building)
      [35.6943, 139.7036],   // Shinjuku Gyoen
      [35.6920, 139.7150],   // Yotsuya
      [35.6810, 139.7375],   // Imperial Palace north
      [35.6762, 139.7530],   // Nihonbashi
      [35.6738, 139.7678],   // Nihonbashi east
      [35.6900, 139.7720],   // Asakusabashi
      [35.7100, 139.7966],   // Asakusa / Senso-ji
      [35.7183, 139.8035],   // Sumida River
      [35.7030, 139.7914],   // Kuramae
      [35.6920, 139.7818],   // Ryogoku
      [35.6810, 139.7710],   // Back to Nihonbashi
      [35.6720, 139.7620],   // Ginza north
      [35.6648, 139.7588],   // Ginza center
      [35.6570, 139.7494],   // Shinbashi
      [35.6485, 139.7395],   // Shibakoen
      [35.6435, 139.7454],   // Tokyo Tower area
      [35.6370, 139.7472],   // Tamachi
      [35.6290, 139.7413],   // Shinagawa approach
      [35.6370, 139.7472],   // Turn back at Tamachi
      [35.6485, 139.7395],   // Shibakoen return
      [35.6580, 139.7505],   // Toranomon
      [35.6660, 139.7555],   // Hibiya
      [35.6812, 139.7671],   // Finish - Tokyo Station
    ],
    milestones: [
      { mile: 0, label: 'Start - Shinjuku', lat: 35.6896, lng: 139.6917 },
      { mile: 5, label: 'Imperial Palace', lat: 35.6810, lng: 139.7375 },
      { mile: 9, label: 'Asakusa / Senso-ji', lat: 35.7100, lng: 139.7966 },
      { mile: 13.1, label: 'Halfway - Nihonbashi', lat: 35.6810, lng: 139.7710 },
      { mile: 18, label: 'Shinbashi', lat: 35.6570, lng: 139.7494 },
      { mile: 22, label: 'Shinagawa', lat: 35.6290, lng: 139.7413 },
      { mile: 25, label: 'Hibiya', lat: 35.6660, lng: 139.7555 },
      { mile: 26.2, label: 'Finish - Tokyo Station', lat: 35.6812, lng: 139.7671 },
    ]
  },

  // =============================================
  // ADDITIONAL POPULAR ROUTES
  // =============================================
  {
    name: 'LA Marathon',
    description: 'Stadium to the Sea — the Los Angeles Marathon runs from Dodger Stadium to the Santa Monica Pier, passing through Hollywood, Beverly Hills, and Westwood.',
    city: 'Los Angeles, CA',
    country: 'USA',
    distance: 26.2,
    type: 'run',
    difficulty: 'intermediate',
    routeData: [
      [34.0739, -118.2400],  // Start - Dodger Stadium
      [34.0622, -118.2472],  // Echo Park
      [34.0535, -118.2520],  // Downtown LA
      [34.0522, -118.2600],  // Westlake
      [34.0620, -118.2825],  // Silver Lake
      [34.0759, -118.2937],  // Los Feliz
      [34.0928, -118.3287],  // Hollywood
      [34.0984, -118.3416],  // Hollywood/Highland
      [34.0836, -118.3614],  // West Hollywood
      [34.0739, -118.3775],  // Beverly Hills
      [34.0644, -118.3958],  // Century City
      [34.0583, -118.4093],  // Westwood / UCLA
      [34.0493, -118.4351],  // Brentwood
      [34.0367, -118.4567],  // San Vicente
      [34.0259, -118.4753],  // West LA
      [34.0195, -118.4912],  // Ocean Park
      [34.0101, -118.4970],  // Finish - Santa Monica Pier
    ],
    milestones: [
      { mile: 0, label: 'Start - Dodger Stadium', lat: 34.0739, lng: -118.2400 },
      { mile: 5, label: 'Silver Lake', lat: 34.0620, lng: -118.2825 },
      { mile: 10, label: 'Hollywood', lat: 34.0928, lng: -118.3287 },
      { mile: 13.1, label: 'Halfway - Beverly Hills', lat: 34.0739, lng: -118.3775 },
      { mile: 18, label: 'Westwood / UCLA', lat: 34.0583, lng: -118.4093 },
      { mile: 22, label: 'San Vicente', lat: 34.0367, lng: -118.4567 },
      { mile: 26.2, label: 'Finish - Santa Monica Pier', lat: 34.0101, lng: -118.4970 },
    ]
  },
  {
    name: 'Half Marathon',
    description: 'A classic 13.1-mile half marathon distance. Log your runs to complete this popular race distance at your own pace.',
    city: 'Anywhere',
    country: 'Worldwide',
    distance: 13.1,
    type: 'run',
    difficulty: 'beginner',
    routeData: [
      [40.7580, -73.9855],   // Start - Times Square
      [40.7614, -73.9776],   // Bryant Park
      [40.7527, -73.9772],   // Grand Central
      [40.7484, -73.9857],   // Empire State Building
      [40.7411, -73.9897],   // Madison Square Park
      [40.7336, -73.9911],   // Gramercy
      [40.7265, -73.9899],   // Union Square
      [40.7282, -73.9972],   // Washington Square Park
      [40.7198, -74.0012],   // SoHo
      [40.7128, -74.0060],   // City Hall
      [40.7061, -73.9969],   // Brooklyn Bridge
      [40.7033, -73.9903],   // DUMBO
      [40.6980, -73.9876],   // Brooklyn Bridge Park
    ],
    milestones: [
      { mile: 0, label: 'Start', lat: 40.7580, lng: -73.9855 },
      { mile: 5, label: 'Mile 5', lat: 40.7336, lng: -73.9911 },
      { mile: 10, label: 'Mile 10', lat: 40.7128, lng: -74.0060 },
      { mile: 13.1, label: 'Finish', lat: 40.6980, lng: -73.9876 },
    ]
  },
  {
    name: '10K Fun Run',
    description: 'A 6.2-mile fun run — perfect for getting started with distance challenges. Great for beginners building up to longer distances.',
    city: 'Anywhere',
    country: 'Worldwide',
    distance: 6.2,
    type: 'run',
    difficulty: 'beginner',
    routeData: [
      [37.7749, -122.4194],  // Start - San Francisco
      [37.7831, -122.4098],  // Union Square
      [37.7893, -122.4034],  // Chinatown
      [37.7956, -122.3934],  // Embarcadero
      [37.8077, -122.4097],  // Fisherman's Wharf
      [37.8029, -122.4186],  // Ghirardelli Square
      [37.8006, -122.4267],  // Marina
      [37.8020, -122.4369],  // Palace of Fine Arts
      [37.8080, -122.4468],  // Crissy Field
      [37.8088, -122.4556],  // Finish - Near Golden Gate
    ],
    milestones: [
      { mile: 0, label: 'Start', lat: 37.7749, lng: -122.4194 },
      { mile: 3, label: 'Mile 3', lat: 37.7956, lng: -122.3934 },
      { mile: 5, label: 'Mile 5', lat: 37.8006, lng: -122.4267 },
      { mile: 6.2, label: 'Finish', lat: 37.8088, lng: -122.4556 },
    ]
  },
  {
    name: 'Century Ride',
    description: 'The classic 100-mile cycling challenge. A legendary distance for cyclists, following a scenic route through varied terrain.',
    city: 'Anywhere',
    country: 'Worldwide',
    distance: 100,
    type: 'bike',
    difficulty: 'advanced',
    routeData: [
      [38.9072, -77.0369],   // Start - Washington DC
      [38.9340, -77.0311],   // Adams Morgan
      [38.9784, -77.0214],   // Silver Spring
      [39.0458, -77.0494],   // Rockville
      [39.1435, -77.2014],   // Germantown
      [39.2563, -77.2776],   // Frederick
      [39.4143, -77.4106],   // Thurmont
      [39.6312, -77.7325],   // Gettysburg, PA
      [39.8027, -77.8613],   // Chambersburg
      [39.9282, -77.9862],   // Greencastle
      [40.0379, -78.1175],   // Finish area
    ],
    milestones: [
      { mile: 0, label: 'Start - Washington DC', lat: 38.9072, lng: -77.0369 },
      { mile: 20, label: 'Rockville, MD', lat: 39.0458, lng: -77.0494 },
      { mile: 40, label: 'Frederick, MD', lat: 39.2563, lng: -77.2776 },
      { mile: 60, label: 'Gettysburg, PA', lat: 39.6312, lng: -77.7325 },
      { mile: 80, label: 'Chambersburg, PA', lat: 39.8027, lng: -77.8613 },
      { mile: 100, label: 'Finish', lat: 40.0379, lng: -78.1175 },
    ]
  }
]

export default MARATHON_ROUTES
