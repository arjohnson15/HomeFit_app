// Pre-built marathon route data with GPS waypoints
// Each route has ~50-100 waypoints for smooth map rendering

const MARATHON_ROUTES = [
  // =============================================
  // PASSIVE: Run/Bike Across America (NYC → LA)
  // =============================================
  {
    name: 'Run Across America',
    description: 'A coast-to-coast journey from Santa Monica to New York City. Every cardio workout automatically contributes to your progress across 3,245 miles through Albuquerque, Oklahoma City, Omaha, Des Moines, Chicago, and Cleveland.',
    city: 'USA',
    country: 'USA',
    distance: 3245,
    type: 'run',
    difficulty: 'legendary',
    isPassive: true,
    routeData: [
      [34.019562,-118.491129],[34.029011,-118.396645],[34.037672,-118.279668],[34.046619,-118.214822],
      [34.062182,-118.161981],[34.067776,-118.022332],[34.070105,-117.864392],[34.081701,-117.715324],
      [34.068446,-117.605276],[34.136425,-117.495558],[34.265644,-117.449342],[34.368337,-117.427575],
      [34.683909,-117.212987],[34.887281,-117.022908],[34.885567,-116.994443],[34.815526,-116.606544],
      [34.727199,-116.081582],[34.733262,-115.87142],[34.73378,-115.55543],[34.818238,-115.139446],
      [34.868011,-114.833164],[34.845814,-114.614513],[34.717623,-114.480833],[34.732754,-114.263344],
      [34.897392,-114.154936],[35.151616,-114.090812],[35.18824,-114.037836],[35.152035,-113.947464],
      [35.157988,-113.895717],[35.17428,-113.785136],[35.162683,-113.532876],[35.183397,-113.390031],
      [35.286823,-113.092901],[35.270873,-112.73249],[35.214357,-112.428077],[35.222534,-112.244439],
      [35.257824,-112.082789],[35.248267,-111.858084],[35.192253,-111.706922],[35.192738,-111.66118],
      [35.194971,-111.628966],[35.216472,-111.552974],[35.131238,-111.190143],[35.07651,-110.866963],
      [35.019796,-110.67805],[34.969334,-110.43565],[34.904888,-110.192302],[34.995279,-109.929004],
      [35.132355,-109.53539],[35.282715,-109.23123],[35.373486,-109.035308],[35.497108,-108.855181],
      [35.532562,-108.734783],[35.493326,-108.493955],[35.389162,-108.188786],[35.185733,-107.902992],
      [35.063615,-107.690689],[35.027551,-107.450316],[34.989509,-107.212586],[35.060941,-106.79701],
      [35.105639,-106.647312],[35.085007,-106.635687],[35.072647,-106.505415],[35.067087,-106.422419],
      [35.099139,-106.366418],[35.104594,-106.300096],[35.006567,-106.023253],[34.997479,-105.420365],
      [34.947809,-104.686717],[35.064962,-104.272517],[35.14014,-103.825103],[35.151756,-103.713238],
      [35.122392,-103.38318],[35.18214,-103.036859],[35.247223,-102.795731],[35.270235,-102.652754],
      [35.249263,-102.454379],[35.210266,-102.243606],[35.186542,-101.970222],[35.206195,-101.902828],
      [35.222013,-101.84499],[35.221987,-101.819549],[35.221965,-101.801053],[35.230247,-101.716725],
      [35.221393,-101.475543],[35.212734,-101.106792],[35.182153,-100.85277],[35.217398,-100.672857],
      [35.226767,-100.304503],[35.23165,-99.959358],[35.258377,-99.724221],[35.359463,-99.556005],
      [35.420341,-99.363949],[35.442609,-99.173966],[35.50028,-98.969135],[35.520375,-98.722314],
      [35.529455,-98.524011],[35.536597,-98.255745],[35.514118,-98.00056],[35.496727,-97.781198],
      [35.460765,-97.562455],[35.464222,-97.51987],[35.473073,-97.506299],[35.531009,-97.499738],
      [35.570908,-97.447948],[35.763086,-97.416141],[35.970183,-97.357308],[36.216935,-97.327979],
      [36.487609,-97.328286],[36.807051,-97.342751],[37.030273,-97.338114],[37.32945,-97.336047],
      [37.54502,-97.325527],[37.617977,-97.334119],[37.66249,-97.335538],[37.687961,-97.328208],
      [37.73677,-97.317567],[37.840803,-97.327588],[38.067113,-97.323325],[38.199931,-97.484143],
      [38.44381,-97.620751],[38.720367,-97.621707],[38.855633,-97.646007],[39.089752,-97.650568],
      [39.365169,-97.666059],[39.631457,-97.660092],[39.846888,-97.630774],[40.098402,-97.613464],
      [40.183478,-97.575622],[40.419845,-97.596106],[40.574223,-97.595629],[40.819208,-97.597401],
      [40.822057,-97.114811],[40.821693,-96.828065],[40.81363,-96.725295],[40.850266,-96.711956],
      [40.894576,-96.56508],[41.021218,-96.301731],[41.120145,-96.21058],[41.196397,-96.095612],
      [41.223657,-96.045502],[41.23009,-95.954914],[41.255456,-95.929384],[41.232054,-95.891094],
      [41.276006,-95.786958],[41.393897,-95.666936],[41.498529,-95.577642],[41.497795,-95.32031],
      [41.497958,-95.092567],[41.497001,-94.838264],[41.496066,-94.515866],[41.517551,-94.091636],
      [41.566037,-93.860084],[41.593065,-93.663903],[41.588667,-93.61619],[41.644325,-93.575577],
      [41.684875,-93.287958],[41.683656,-93.059091],[41.695954,-92.726185],[41.69608,-92.399482],
      [41.69337,-92.118977],[41.687142,-91.858623],[41.686374,-91.571262],[41.663556,-91.530146],
      [41.685455,-91.50024],[41.663331,-91.259315],[41.634043,-90.936015],[41.600204,-90.633536],
      [41.588177,-90.37002],[41.536938,-90.337658],[41.611715,-90.193704],[41.73922,-89.887236],
      [41.786244,-89.536137],[41.888681,-89.100847],[41.900624,-88.690619],[41.817101,-88.457785],
      [41.79792,-88.290577],[41.828053,-88.021082],[41.873778,-87.903967],[41.872982,-87.799131],
      [41.875555,-87.638037],[41.857456,-87.630225],[41.774902,-87.621556],[41.711305,-87.53309],
      [41.631031,-87.501441],[41.60869,-87.353419],[41.592602,-87.232689],[41.576393,-87.120335],
      [41.582988,-86.942335],[41.658352,-86.755186],[41.716596,-86.610015],[41.755656,-86.460456],
      [41.730312,-86.327236],[41.717876,-86.166896],[41.730491,-85.947185],[41.745339,-85.716019],
      [41.745247,-85.531606],[41.744888,-85.32532],[41.749282,-85.093123],[41.699992,-84.917093],
      [41.630623,-84.786245],[41.613748,-84.547236],[41.594403,-84.361586],[41.593514,-84.141819],
      [41.59985,-83.873143],[41.593054,-83.664671],[41.61236,-83.618716],[41.646615,-83.546218],
      [41.640299,-83.525567],[41.584342,-83.476867],[41.522078,-83.453977],[41.409778,-83.141245],
      [41.341396,-82.769445],[41.32959,-82.469517],[41.382989,-82.196341],[41.412456,-82.09865],
      [41.464341,-82.015753],[41.467531,-81.758722],[41.492782,-81.685574],[41.500348,-81.696852],
      [41.521048,-81.669005],[41.573636,-81.557919],[41.600302,-81.489294],[41.596328,-81.444587],
      [41.651194,-81.289063],[41.765928,-80.992105],[41.794682,-80.841317],[41.844452,-80.716332],
      [41.916834,-80.568428],[42.023236,-80.146103],[42.05754,-80.11223],[42.112394,-80.111457],
      [42.129029,-80.084963],[42.113067,-80.109631],[42.068497,-80.105582],[42.010629,-80.154621],
      [41.820497,-80.176028],[41.67585,-80.209396],[41.513984,-80.172027],[41.351523,-80.159791],
      [41.196371,-80.16292],[41.201532,-79.968732],[41.173916,-79.746378],[41.196643,-79.622856],
      [41.183333,-79.520706],[41.19603,-79.441674],[41.177545,-79.345718],[41.172983,-79.267731],
      [41.185672,-79.166925],[41.169178,-79.052264],[41.141398,-78.980454],[41.150079,-78.847882],
      [41.137982,-78.736117],[41.124252,-78.567085],[41.058968,-78.445122],[41.022812,-78.357925],
      [40.994343,-78.24482],[40.974255,-78.122108],[40.988138,-78.028761],[41.001041,-77.86123],
      [40.943949,-77.728843],[41.004093,-77.599508],[41.054957,-77.435644],[41.052342,-77.351345],
      [41.055349,-77.209777],[41.068833,-77.053523],[41.043342,-76.816494],[40.989627,-76.67988],
      [41.009048,-76.504268],[41.024134,-76.318437],[41.009294,-76.133397],[41.133412,-75.962299],
      [41.245995,-75.821993],[41.355056,-75.720361],[41.380006,-75.665662],[41.409072,-75.662443],
      [41.397404,-75.648037],[41.409855,-75.622099],[41.381583,-75.580515],[41.178379,-75.431661],
      [41.038881,-75.312566],[40.984689,-75.18924],[40.970551,-75.120304],[40.928003,-75.081721],
      [40.929236,-74.980757],[40.923059,-74.873206],[40.921734,-74.801643],[40.911743,-74.754064],
      [40.890035,-74.682401],[40.90905,-74.572065],[40.889184,-74.475929],[40.860642,-74.399275],
      [40.826542,-74.323447],[40.783554,-74.246164],[40.752233,-74.190774],[40.74742,-74.162972],
      [40.74998,-74.124123],[40.743003,-74.085374],[40.731813,-74.052779],[40.712153,-74.005625],
    ],
    milestones: [
      { mile: 0, label: 'Santa Monica, CA', lat: 34.0195, lng: -118.4912 },
      { mile: 131, label: 'Barstow, CA', lat: 34.8958, lng: -117.0173 },
      { mile: 488, label: 'Flagstaff, AZ', lat: 35.1983, lng: -111.6513 },
      { mile: 811, label: 'Albuquerque, NM', lat: 35.0844, lng: -106.6504 },
      { mile: 1099, label: 'Amarillo, TX', lat: 35.2220, lng: -101.8313 },
      { mile: 1357, label: 'Oklahoma City, OK', lat: 35.4676, lng: -97.5164 },
      { mile: 1517, label: 'Wichita, KS', lat: 37.6872, lng: -97.3301 },
      { mile: 1850, label: 'Omaha, NE', lat: 41.2565, lng: -95.9345 },
      { mile: 1985, label: 'Des Moines, IA', lat: 41.5868, lng: -93.6250 },
      { mile: 2213, label: 'Chicago, IL', lat: 41.8781, lng: -87.6298 },
      { mile: 2568, label: 'Cleveland, OH', lat: 41.4993, lng: -81.6944 },
      { mile: 3245, label: 'New York City, NY', lat: 40.7128, lng: -74.0060 },
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
