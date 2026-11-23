// Comprehensive Geocoding dictionary and dynamic geocoding engine

export interface CityCoord {
  name: string;
  country: string;
  lat: number;
  lng: number;
  zoom: number;
}

export const KNOWN_CITIES: Record<string, CityCoord> = {
  // UK
  "luton": { name: "Luton", country: "UK", lat: 51.8787, lng: -0.4200, zoom: 13 },
  "manchester": { name: "Manchester", country: "UK", lat: 53.4808, lng: -2.2426, zoom: 13 },
  "london": { name: "London", country: "UK", lat: 51.5074, lng: -0.1278, zoom: 12 },
  "birmingham": { name: "Birmingham", country: "UK", lat: 52.4862, lng: -1.8904, zoom: 13 },
  "leeds": { name: "Leeds", country: "UK", lat: 53.8008, lng: -1.5491, zoom: 13 },
  "glasgow": { name: "Glasgow", country: "UK", lat: 55.8642, lng: -4.2518, zoom: 13 },
  "liverpool": { name: "Liverpool", country: "UK", lat: 53.4084, lng: -2.9916, zoom: 13 },
  "edinburgh": { name: "Edinburgh", country: "UK", lat: 55.9533, lng: -3.1883, zoom: 13 },
  "bristol": { name: "Bristol", country: "UK", lat: 51.4545, lng: -2.5879, zoom: 13 },
  "sheffield": { name: "Sheffield", country: "UK", lat: 53.3811, lng: -1.4701, zoom: 13 },
  "newcastle": { name: "Newcastle", country: "UK", lat: 54.9783, lng: -1.6178, zoom: 13 },
  "cardiff": { name: "Cardiff", country: "UK", lat: 51.4816, lng: -3.1791, zoom: 13 },
  "belfast": { name: "Belfast", country: "UK", lat: 54.5973, lng: -5.9301, zoom: 13 },
  "nottingham": { name: "Nottingham", country: "UK", lat: 52.9548, lng: -1.1581, zoom: 13 },
  "leicester": { name: "Leicester", country: "UK", lat: 52.6369, lng: -1.1398, zoom: 13 },
  "southampton": { name: "Southampton", country: "UK", lat: 50.9097, lng: -1.4044, zoom: 13 },
  "bradford": { name: "Bradford", country: "UK", lat: 53.7960, lng: -1.7594, zoom: 13 },
  "oxford": { name: "Oxford", country: "UK", lat: 51.7520, lng: -1.2577, zoom: 13 },
  "cambridge": { name: "Cambridge", country: "UK", lat: 52.2053, lng: 0.1218, zoom: 13 },
  "reading": { name: "Reading", country: "UK", lat: 51.4543, lng: -0.9781, zoom: 13 },
  "coventry": { name: "Coventry", country: "UK", lat: 52.4068, lng: -1.5197, zoom: 13 },
  "brighton": { name: "Brighton", country: "UK", lat: 50.8225, lng: -0.1372, zoom: 13 },
  "milton keynes": { name: "Milton Keynes", country: "UK", lat: 52.0406, lng: -0.7594, zoom: 13 },
  "norwich": { name: "Norwich", country: "UK", lat: 52.6309, lng: 1.2974, zoom: 13 },
  "plymouth": { name: "Plymouth", country: "UK", lat: 50.3755, lng: -4.1427, zoom: 13 },
  "derby": { name: "Derby", country: "UK", lat: 52.9225, lng: -1.4746, zoom: 13 },
  "stoke-on-trent": { name: "Stoke-on-Trent", country: "UK", lat: 53.0027, lng: -2.1794, zoom: 13 },
  "wolverhampton": { name: "Wolverhampton", country: "UK", lat: 52.5870, lng: -2.1288, zoom: 13 },
  "swansea": { name: "Swansea", country: "UK", lat: 51.6214, lng: -3.9436, zoom: 13 },
  "aberdeen": { name: "Aberdeen", country: "UK", lat: 57.1497, lng: -2.0943, zoom: 13 },

  // US
  "new york": { name: "New York", country: "US", lat: 40.7128, lng: -74.0060, zoom: 12 },
  "nyc": { name: "New York", country: "US", lat: 40.7128, lng: -74.0060, zoom: 12 },
  "los angeles": { name: "Los Angeles", country: "US", lat: 34.0522, lng: -118.2437, zoom: 12 },
  "la": { name: "Los Angeles", country: "US", lat: 34.0522, lng: -118.2437, zoom: 12 },
  "chicago": { name: "Chicago", country: "US", lat: 41.8781, lng: -87.6298, zoom: 12 },
  "houston": { name: "Houston", country: "US", lat: 29.7604, lng: -95.3698, zoom: 12 },
  "miami": { name: "Miami", country: "US", lat: 25.7617, lng: -80.1918, zoom: 13 },
  "dallas": { name: "Dallas", country: "US", lat: 32.7767, lng: -96.7970, zoom: 12 },
  "austin": { name: "Austin", country: "US", lat: 30.2672, lng: -97.7431, zoom: 13 },
  "san francisco": { name: "San Francisco", country: "US", lat: 37.7749, lng: -122.4194, zoom: 13 },
  "seattle": { name: "Seattle", country: "US", lat: 47.6062, lng: -122.3321, zoom: 13 },
  "atlanta": { name: "Atlanta", country: "US", lat: 33.7490, lng: -84.3880, zoom: 13 },
  "denver": { name: "Denver", country: "US", lat: 39.7392, lng: -104.9903, zoom: 13 },
  "boston": { name: "Boston", country: "US", lat: 42.3601, lng: -71.0589, zoom: 13 },
  "las vegas": { name: "Las Vegas", country: "US", lat: 36.1699, lng: -115.1398, zoom: 13 },
  "phoenix": { name: "Phoenix", country: "US", lat: 33.4484, lng: -112.0740, zoom: 12 },
  "orlando": { name: "Orlando", country: "US", lat: 28.5383, lng: -81.3792, zoom: 13 },
  "san diego": { name: "San Diego", country: "US", lat: 32.7157, lng: -117.1611, zoom: 12 },
  "philadelphia": { name: "Philadelphia", country: "US", lat: 39.9526, lng: -75.1652, zoom: 12 },
  "san antonio": { name: "San Antonio", country: "US", lat: 29.4241, lng: -98.4936, zoom: 12 },

  // UAE / Middle East
  "dubai": { name: "Dubai", country: "UAE", lat: 25.2048, lng: 55.2708, zoom: 12 },
  "abu dhabi": { name: "Abu Dhabi", country: "UAE", lat: 24.4539, lng: 54.3773, zoom: 12 },
  "sharjah": { name: "Sharjah", country: "UAE", lat: 25.3463, lng: 55.4209, zoom: 13 },
  "ajman": { name: "Ajman", country: "UAE", lat: 25.4052, lng: 55.5136, zoom: 13 },
  "ras al khaimah": { name: "Ras Al Khaimah", country: "UAE", lat: 25.7895, lng: 55.9432, zoom: 13 },
  "riyadh": { name: "Riyadh", country: "Saudi Arabia", lat: 24.7136, lng: 46.6753, zoom: 12 },
  "jeddah": { name: "Jeddah", country: "Saudi Arabia", lat: 21.5433, lng: 39.1728, zoom: 12 },
  "dammam": { name: "Dammam", country: "Saudi Arabia", lat: 26.4207, lng: 50.0888, zoom: 12 },
  "mecca": { name: "Mecca", country: "Saudi Arabia", lat: 21.3891, lng: 39.8579, zoom: 13 },
  "medina": { name: "Medina", country: "Saudi Arabia", lat: 24.5247, lng: 39.5692, zoom: 13 },
  "doha": { name: "Doha", country: "Qatar", lat: 25.2854, lng: 51.5310, zoom: 13 },
  "kuwait city": { name: "Kuwait City", country: "Kuwait", lat: 29.3759, lng: 47.9774, zoom: 12 },
  "manama": { name: "Manama", country: "Bahrain", lat: 26.2285, lng: 50.5860, zoom: 13 },
  "muscat": { name: "Muscat", country: "Oman", lat: 23.5880, lng: 58.3829, zoom: 12 },

  // Pakistan
  "karachi": { name: "Karachi", country: "Pakistan", lat: 24.8607, lng: 67.0011, zoom: 12 },
  "lahore": { name: "Lahore", country: "Pakistan", lat: 31.5204, lng: 74.3587, zoom: 12 },
  "islamabad": { name: "Islamabad", country: "Pakistan", lat: 33.6844, lng: 73.0479, zoom: 13 },
  "rawalpindi": { name: "Rawalpindi", country: "Pakistan", lat: 33.5651, lng: 73.0169, zoom: 13 },
  "faisalabad": { name: "Faisalabad", country: "Pakistan", lat: 31.4504, lng: 73.1350, zoom: 12 },
  "multan": { name: "Multan", country: "Pakistan", lat: 30.1575, lng: 71.5249, zoom: 12 },
  "peshawar": { name: "Peshawar", country: "Pakistan", lat: 34.0151, lng: 71.5249, zoom: 13 },
  "quetta": { name: "Quetta", country: "Pakistan", lat: 30.1798, lng: 66.9750, zoom: 13 },
  "hyderabad": { name: "Hyderabad", country: "Pakistan", lat: 25.3960, lng: 68.3578, zoom: 13 },
  "gujranwala": { name: "Gujranwala", country: "Pakistan", lat: 32.1877, lng: 74.1945, zoom: 13 },
  "sialkot": { name: "Sialkot", country: "Pakistan", lat: 32.4945, lng: 74.5229, zoom: 13 },

  // Canada
  "toronto": { name: "Toronto", country: "Canada", lat: 43.6532, lng: -79.3832, zoom: 12 },
  "vancouver": { name: "Vancouver", country: "Canada", lat: 49.2827, lng: -123.1207, zoom: 13 },
  "montreal": { name: "Montreal", country: "Canada", lat: 45.5017, lng: -73.5673, zoom: 12 },
  "calgary": { name: "Calgary", country: "Canada", lat: 51.0447, lng: -114.0719, zoom: 12 },
  "ottawa": { name: "Ottawa", country: "Canada", lat: 45.4215, lng: -75.6972, zoom: 12 },
  "edmonton": { name: "Edmonton", country: "Canada", lat: 53.5461, lng: -113.4938, zoom: 12 },

  // Australia
  "sydney": { name: "Sydney", country: "Australia", lat: -33.8688, lng: 151.2093, zoom: 12 },
  "melbourne": { name: "Melbourne", country: "Australia", lat: -37.8136, lng: 144.9631, zoom: 12 },
  "brisbane": { name: "Brisbane", country: "Australia", lat: -27.4698, lng: 153.0251, zoom: 13 },
  "perth": { name: "Perth", country: "Australia", lat: -31.9505, lng: 115.8605, zoom: 13 },
  "adelaide": { name: "Adelaide", country: "Australia", lat: -34.9285, lng: 138.6007, zoom: 13 },

  // Europe
  "paris": { name: "Paris", country: "France", lat: 48.8566, lng: 2.3522, zoom: 12 },
  "berlin": { name: "Berlin", country: "Germany", lat: 52.5200, lng: 13.4050, zoom: 12 },
  "munich": { name: "Munich", country: "Germany", lat: 48.1351, lng: 11.5820, zoom: 12 },
  "frankfurt": { name: "Frankfurt", country: "Germany", lat: 50.1109, lng: 8.6821, zoom: 12 },
  "amsterdam": { name: "Amsterdam", country: "Netherlands", lat: 52.3676, lng: 4.9041, zoom: 13 },
  "madrid": { name: "Madrid", country: "Spain", lat: 40.4168, lng: -3.7038, zoom: 12 },
  "barcelona": { name: "Barcelona", country: "Spain", lat: 41.3879, lng: 2.1699, zoom: 13 },
  "rome": { name: "Rome", country: "Italy", lat: 41.9028, lng: 12.4964, zoom: 12 },
  "milan": { name: "Milan", country: "Italy", lat: 45.4642, lng: 9.1900, zoom: 13 },
  "dublin": { name: "Dublin", country: "Ireland", lat: 53.3498, lng: -6.2603, zoom: 13 },
  "zurich": { name: "Zurich", country: "Switzerland", lat: 47.3769, lng: 8.5417, zoom: 13 },
};

export const CITIES_BY_COUNTRY: Record<string, string[]> = {
  UK: [
    "London", "Manchester", "Birmingham", "Leeds", "Glasgow", "Liverpool", "Edinburgh",
    "Bristol", "Sheffield", "Newcastle", "Cardiff", "Belfast", "Nottingham", "Leicester",
    "Southampton", "Luton", "Bradford", "Oxford", "Cambridge", "Reading", "Coventry",
    "Brighton", "Milton Keynes", "Norwich", "Plymouth", "Derby", "Stoke-on-Trent", "Wolverhampton",
    "Swansea", "Aberdeen", "York", "Portsmouth", "Peterborough", "Northampton", "Blackpool"
  ],
  US: [
    "New York", "Los Angeles", "Chicago", "Houston", "Miami", "Dallas", "Austin",
    "San Francisco", "Seattle", "Atlanta", "Denver", "Boston", "Las Vegas", "Phoenix",
    "Orlando", "San Diego", "Philadelphia", "San Antonio", "San Jose", "Charlotte",
    "Indianapolis", "Columbus", "Nashville", "Washington DC", "Tampa", "Detroit"
  ],
  UAE: [
    "Dubai", "Abu Dhabi", "Sharjah", "Ajman", "Ras Al Khaimah", "Fujairah", "Umm Al Quwain", "Al Ain"
  ],
  PK: [
    "Karachi", "Lahore", "Islamabad", "Rawalpindi", "Faisalabad", "Multan", "Peshawar",
    "Quetta", "Hyderabad", "Gujranwala", "Sialkot", "Bahawalpur", "Sargodha", "Abbottabad"
  ],
  CA: [
    "Toronto", "Vancouver", "Montreal", "Calgary", "Ottawa", "Edmonton", "Quebec City",
    "Winnipeg", "Hamilton", "Kitchener", "Victoria", "Halifax"
  ],
  AU: [
    "Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide", "Gold Coast", "Canberra",
    "Newcastle", "Wollongong", "Hobart", "Darwin"
  ],
  DE: [
    "Berlin", "Munich", "Frankfurt", "Hamburg", "Cologne", "Stuttgart", "Düsseldorf",
    "Leipzig", "Dortmund", "Essen", "Bremen", "Dresden", "Nuremberg", "Hannover"
  ],
  FR: [
    "Paris", "Marseille", "Lyon", "Toulouse", "Nice", "Nantes", "Strasbourg",
    "Montpellier", "Bordeaux", "Lille", "Rennes", "Toulon", "Reims"
  ],
  SA: [
    "Riyadh", "Jeddah", "Mecca", "Medina", "Dammam", "Khobar", "Tabuk", "Abha", "Taif"
  ],
};

export const POPULAR_COUNTRIES = [
  { code: "UK", name: "United Kingdom", defaultCity: "London" },
  { code: "US", name: "United States", defaultCity: "New York" },
  { code: "UAE", name: "United Arab Emirates", defaultCity: "Dubai" },
  { code: "CA", name: "Canada", defaultCity: "Toronto" },
  { code: "AU", name: "Australia", defaultCity: "Sydney" },
  { code: "DE", name: "Germany", defaultCity: "Berlin" },
  { code: "FR", name: "France", defaultCity: "Paris" },
  { code: "PK", name: "Pakistan", defaultCity: "Karachi" },
  { code: "SA", name: "Saudi Arabia", defaultCity: "Riyadh" },
];

export const POPULAR_CATEGORIES = [
  "Restaurants",
  "Dentists",
  "Real Estate Agencies",
  "Lawyers & Legal Services",
  "HVAC & Plumbers",
  "Beauty Salons & Spas",
  "Gyms & Fitness Centers",
  "Marketing Agencies",
  "Accountants & CPA",
  "Auto Repair & Dealerships",
  "Solar & Roofing Contractors",
  "Hotels & Hospitality",
];

// Memory cache for dynamic geocoding
const geocodeCache = new Map<string, CityCoord>();

// Dynamic Geocoding with Fallback
export async function geocodeLocation(city: string, country?: string): Promise<CityCoord> {
  const query = `${city.trim()}, ${country?.trim() || ""}`.trim();
  const cacheKey = query.toLowerCase();

  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey)!;
  }

  // 1. Check local dictionary
  const staticResult = resolveLocationCoords(city, country);
  if (staticResult.name.toLowerCase() === city.toLowerCase().trim()) {
    geocodeCache.set(cacheKey, staticResult);
    return staticResult;
  }

  // 2. Fetch live from OpenStreetMap Nominatim
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`,
      { headers: { "Accept-Language": "en" } }
    );
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const item = data[0];
        const coord: CityCoord = {
          name: item.display_name?.split(",")[0] || city,
          country: country || "",
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
          zoom: 13,
        };
        geocodeCache.set(cacheKey, coord);
        return coord;
      }
    }
  } catch {}

  return staticResult;
}

// Synchronous Resolver
export function resolveLocationCoords(city?: string, country?: string): CityCoord {
  const normalizedCity = (city || "").toLowerCase().trim();
  const normalizedCountry = (country || "").toLowerCase().trim();

  // Exact city match
  if (normalizedCity && KNOWN_CITIES[normalizedCity]) {
    return KNOWN_CITIES[normalizedCity];
  }

  // Partial match in city name
  for (const [key, coord] of Object.entries(KNOWN_CITIES)) {
    if (normalizedCity && (normalizedCity === key || normalizedCity.startsWith(key) || key.startsWith(normalizedCity))) {
      return coord;
    }
  }

  // Fallback by country
  if (normalizedCountry) {
    if (normalizedCountry.includes("uk") || normalizedCountry.includes("kingdom") || normalizedCountry.includes("britain")) {
      return KNOWN_CITIES["london"];
    }
    if (normalizedCountry.includes("us") || normalizedCountry.includes("state") || normalizedCountry.includes("america")) {
      return KNOWN_CITIES["new york"];
    }
    if (normalizedCountry.includes("uae") || normalizedCountry.includes("emirates") || normalizedCountry.includes("dubai")) {
      return KNOWN_CITIES["dubai"];
    }
    if (normalizedCountry.includes("canada")) {
      return KNOWN_CITIES["toronto"];
    }
    if (normalizedCountry.includes("australia")) {
      return KNOWN_CITIES["sydney"];
    }
    if (normalizedCountry.includes("pakistan")) {
      return KNOWN_CITIES["karachi"];
    }
    if (normalizedCountry.includes("saudi")) {
      return KNOWN_CITIES["riyadh"];
    }
    if (normalizedCountry.includes("france")) {
      return KNOWN_CITIES["paris"];
    }
    if (normalizedCountry.includes("germany")) {
      return KNOWN_CITIES["berlin"];
    }
  }

  return KNOWN_CITIES["london"];
}

// Pseudo-random deterministic dispersion for leads lacking exact GPS
function stringHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getLeadCoordinates(
  lead: { id: string; business_name: string; lat?: number; lng?: number; address?: string },
  centerCoords: { lat: number; lng: number }
): { lat: number; lng: number } {
  if (typeof lead.lat === "number" && typeof lead.lng === "number" && (lead.lat !== 0 || lead.lng !== 0)) {
    return { lat: lead.lat, lng: lead.lng };
  }

  const hash1 = stringHash(lead.id || lead.business_name || "lead");
  const hash2 = stringHash((lead.business_name || "lead") + (lead.address || ""));

  const angle = (hash1 % 360) * (Math.PI / 180);
  const distance = 0.005 + ((hash2 % 100) / 100) * 0.035;

  const latOffset = Math.sin(angle) * distance;
  const lngOffset = (Math.cos(angle) * distance) / Math.cos(centerCoords.lat * (Math.PI / 180));

  return {
    lat: Number((centerCoords.lat + latOffset).toFixed(6)),
    lng: Number((centerCoords.lng + lngOffset).toFixed(6)),
  };
}
