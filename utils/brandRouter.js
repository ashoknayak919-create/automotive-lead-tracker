// utils/brandRouter.js
// ─────────────────────────────────────────────────────────────
// Maps a vehicle name from the Meta lead form to:
//   - brand (TATA_PV | TATA_CV | TOYOTA)
//   - branch (Trupti Motors | Trupti Automotives | Trupti Toyota)
//   - assignedTeam (sales exec pool)
//   - segment (Passenger | Commercial)
// ─────────────────────────────────────────────────────────────

const BRAND_MAP = {
  // ── TATA PASSENGER VEHICLES ──────────────────
  TATA_PV: {
    branch:      "Trupti Motors",
    segment:     "Passenger",
    showrooms:   ["Patrapada", "Baramunda"],
    assignedTeam:"tata_pv_sales",
    keywords: [
      "punch", "nexon", "curvv", "tiago", "tigor",
      "altroz", "harrier", "safari", "nexon ev",
      "punch ev", "curvv ev", "tiago ev", "tata ev",
      "tata passenger", "tata car", "tata suv",
    ],
  },

  // ── TATA COMMERCIAL VEHICLES ─────────────────
  TATA_CV: {
    branch:      "Trupti Automotives",
    segment:     "Commercial",
    showrooms:   ["Patrapada CV Yard", "Paradeep"],
    assignedTeam:"tata_cv_sales",
    keywords: [
      "intra", "intra ev", "yodha", "ace", "ace ev",
      "prima", "signa", "ultra", "truck", "bus",
      "pick up", "pickup", "mini truck", "commercial",
      "tata cv", "tata truck", "tata bus", "tipper",
      "cargo", "fleet", "logistics",
    ],
  },

  // ── TOYOTA ───────────────────────────────────
  TOYOTA: {
    branch:      "Trupti Toyota",
    segment:     "Passenger",
    showrooms:   ["Patia", "Patrapada"],
    assignedTeam:"toyota_sales",
    keywords: [
      "hyryder", "urban cruiser", "innova", "crysta",
      "hycross", "fortuner", "hilux", "glanza",
      "camry", "toyota", "hybrid", "innova hycross",
      "innova crysta", "urban cruiser hyryder",
    ],
  },
};

/**
 * Determine brand from vehicle interest string
 * @param {string} vehicleInterest - raw string from Meta lead form
 * @returns {{ brand, branch, segment, showrooms, assignedTeam }}
 */
function routeByVehicle(vehicleInterest = "") {
  const input = vehicleInterest.toLowerCase().trim();

  for (const [brand, config] of Object.entries(BRAND_MAP)) {
    if (config.keywords.some((kw) => input.includes(kw))) {
      return { brand, ...config };
    }
  }

  // Default fallback — route to Tata PV if unrecognised
  return {
    brand:       "UNKNOWN",
    branch:      "Trupti Motors",
    segment:     "Passenger",
    showrooms:   ["Patrapada"],
    assignedTeam:"tata_pv_sales",
  };
}

/**
 * Determine brand from Meta Ad Form ID
 * (Use as secondary check if vehicle interest is blank)
 */
const FORM_BRAND_MAP = {
  // Fill these with your actual Meta form IDs
  // e.g. "1234567890": "TATA_PV"
};

function routeByFormId(formId = "") {
  const brand = FORM_BRAND_MAP[formId];
  if (brand && BRAND_MAP[brand]) {
    return { brand, ...BRAND_MAP[brand] };
  }
  return null;
}

module.exports = { routeByVehicle, routeByFormId, BRAND_MAP };
