// Pure geometry helpers shared by the browser app (js/main.js) and node:test.
// No DOM / no Turf dependency: everything here is plain data in / data out so the
// same code powers per-plan spatial distance in the UI and the unit tests.
//
// Coordinates are always [lng, lat] (GeoJSON order, EPSG:4326).

const METERS_PER_DEG_LAT = 110540; // local mean around mid-latitude Japan
const EQUATOR_METERS_PER_DEG = 111320;

// --- EPSG:4326 range validation ------------------------------------------

export function isValidLngLat(coord) {
  if (!Array.isArray(coord) || coord.length < 2) return false;
  const lng = Number(coord[0]);
  const lat = Number(coord[1]);
  return (
    Number.isFinite(lng) &&
    Number.isFinite(lat) &&
    lng >= -180 &&
    lng <= 180 &&
    lat >= -90 &&
    lat <= 90
  );
}

// Walk every coordinate of a GeoJSON geometry, calling cb(coord).
export function eachCoord(geometry, cb) {
  if (!geometry || !geometry.coordinates) return;
  const walk = (node) => {
    if (!Array.isArray(node)) return;
    if (typeof node[0] === "number") {
      cb(node);
      return;
    }
    node.forEach(walk);
  };
  walk(geometry.coordinates);
}

// Returns the first coordinate outside the EPSG:4326 range, or null when all
// coordinates are valid. Used to reject imports that are not really WGS84.
export function wgs84RangeViolation(geometry) {
  let violation = null;
  eachCoord(geometry, (coord) => {
    if (violation) return;
    if (!isValidLngLat(coord)) violation = coord;
  });
  return violation;
}

export function isWithinWgs84(geometry) {
  return wgs84RangeViolation(geometry) === null;
}

// --- geometry normalization (preserve Polygon / MultiPolygon / holes) ----

function cleanRing(ring) {
  if (!Array.isArray(ring)) return [];
  const out = [];
  for (const c of ring) {
    if (!Array.isArray(c) || c.length < 2) continue;
    const lng = Number(c[0]);
    const lat = Number(c[1]);
    if (Number.isFinite(lng) && Number.isFinite(lat)) out.push([lng, lat]);
  }
  return out;
}

function cleanPolygon(rings) {
  if (!Array.isArray(rings)) return null;
  const cleaned = rings.map(cleanRing).filter((ring) => ring.length >= 3);
  return cleaned.length ? cleaned : null;
}

// Returns a normalized { type, coordinates } (Polygon or MultiPolygon) keeping
// interior rings (holes) and every part of a MultiPolygon, or null when the
// input carries no usable polygon.
export function normalizeGeometry(geometry) {
  if (!geometry || typeof geometry !== "object") return null;
  if (geometry.type === "Polygon") {
    const poly = cleanPolygon(geometry.coordinates);
    return poly ? { type: "Polygon", coordinates: poly } : null;
  }
  if (geometry.type === "MultiPolygon") {
    const polys = (geometry.coordinates || [])
      .map(cleanPolygon)
      .filter(Boolean);
    return polys.length ? { type: "MultiPolygon", coordinates: polys } : null;
  }
  return null;
}

// A GeoJSON geometry built from a legacy outer-ring array ([[lng,lat], ...]).
export function polygonFromRing(ring) {
  const cleaned = cleanRing(ring);
  if (cleaned.length < 3) return null;
  const first = cleaned[0];
  const last = cleaned[cleaned.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) cleaned.push([first[0], first[1]]);
  return { type: "Polygon", coordinates: [cleaned] };
}

// Flatten a geometry into an array of polygons; each polygon is an array of
// rings ([outer, hole, hole, ...]).
export function polygonsFromGeometry(geometry) {
  const normalized = normalizeGeometry(geometry);
  if (!normalized) return [];
  if (normalized.type === "Polygon") return [normalized.coordinates];
  return normalized.coordinates;
}

// --- centroid / bearing ---------------------------------------------------

export function geometryCentroid(geometry) {
  let x = 0;
  let y = 0;
  let n = 0;
  const polys = polygonsFromGeometry(geometry);
  polys.forEach((poly) => {
    (poly[0] || []).forEach(([lng, lat]) => {
      x += lng;
      y += lat;
      n += 1;
    });
  });
  if (!n) return null;
  return [x / n, y / n];
}

export function bearingBetweenLngLat([lng1, lat1], [lng2, lat2]) {
  const toRad = (d) => (d * Math.PI) / 180;
  const toDeg = (r) => (r * 180) / Math.PI;
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const dLambda = toRad(lng2 - lng1);
  const y = Math.sin(dLambda) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

const BEARING_DIRECTIONS = ["北", "北東", "東", "南東", "南", "南西", "西", "北西"];

export function bearingToDirection(bearingDeg) {
  const normalized = ((Number(bearingDeg) % 360) + 360) % 360;
  return BEARING_DIRECTIONS[Math.round(normalized / 45) % 8];
}

// --- local metric projection ---------------------------------------------

function referenceFor(geometries) {
  let x = 0;
  let y = 0;
  let n = 0;
  geometries.forEach((geometry) =>
    eachCoord(geometry, ([lng, lat]) => {
      x += lng;
      y += lat;
      n += 1;
    }),
  );
  if (!n) return null;
  const lat0 = y / n;
  return { lng0: x / n, lat0, cosLat0: Math.cos((lat0 * Math.PI) / 180) };
}

function projectRing(ring, ref) {
  return ring.map(([lng, lat]) => [
    (lng - ref.lng0) * ref.cosLat0 * EQUATOR_METERS_PER_DEG,
    (lat - ref.lat0) * METERS_PER_DEG_LAT,
  ]);
}

function projectPolygons(geometry, ref) {
  return polygonsFromGeometry(geometry).map((poly) => poly.map((ring) => projectRing(ring, ref)));
}

// --- planar polygon distance ---------------------------------------------

export function pointInRing(pt, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const straddles = yi > pt[1] !== yj > pt[1];
    if (straddles && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// A projected polygon is [outerRing, ...holeRings].
function pointInPolygon(pt, polygon) {
  if (!pointInRing(pt, polygon[0])) return false;
  for (let h = 1; h < polygon.length; h++) {
    if (pointInRing(pt, polygon[h])) return false; // inside a hole => outside
  }
  return true;
}

export function pointSegmentDistance(p, a, b) {
  const abx = b[0] - a[0];
  const aby = b[1] - a[1];
  const apx = p[0] - a[0];
  const apy = p[1] - a[1];
  const lenSq = abx * abx + aby * aby;
  let t = lenSq ? (apx * abx + apy * aby) / lenSq : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = a[0] + t * abx;
  const cy = a[1] + t * aby;
  return Math.hypot(p[0] - cx, p[1] - cy);
}

function orientation(a, b, c) {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

function onSegment(a, b, c) {
  return (
    Math.min(a[0], c[0]) <= b[0] &&
    b[0] <= Math.max(a[0], c[0]) &&
    Math.min(a[1], c[1]) <= b[1] &&
    b[1] <= Math.max(a[1], c[1])
  );
}

function segmentsIntersect(p1, p2, p3, p4) {
  const d1 = orientation(p3, p4, p1);
  const d2 = orientation(p3, p4, p2);
  const d3 = orientation(p1, p2, p3);
  const d4 = orientation(p1, p2, p4);
  if (((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0))) return true;
  if (d1 === 0 && onSegment(p3, p1, p4)) return true;
  if (d2 === 0 && onSegment(p3, p2, p4)) return true;
  if (d3 === 0 && onSegment(p1, p3, p2)) return true;
  if (d4 === 0 && onSegment(p1, p4, p2)) return true;
  return false;
}

function segmentSegmentDistance(a, b, c, d) {
  if (segmentsIntersect(a, b, c, d)) return 0;
  return Math.min(
    pointSegmentDistance(a, c, d),
    pointSegmentDistance(b, c, d),
    pointSegmentDistance(c, a, b),
    pointSegmentDistance(d, a, b),
  );
}

function polygonPairDistance(polyA, polyB) {
  // Containment (including one polygon fully inside the other) => 0.
  if (polyA[0].some((pt) => pointInPolygon(pt, polyB))) return 0;
  if (polyB[0].some((pt) => pointInPolygon(pt, polyA))) return 0;
  let min = Infinity;
  for (const ringA of polyA) {
    for (let i = 0; i < ringA.length; i++) {
      const a = ringA[i];
      const b = ringA[(i + 1) % ringA.length];
      for (const ringB of polyB) {
        for (let j = 0; j < ringB.length; j++) {
          const c = ringB[j];
          const d = ringB[(j + 1) % ringB.length];
          const dist = segmentSegmentDistance(a, b, c, d);
          if (dist < min) min = dist;
          if (min === 0) return 0;
        }
      }
    }
  }
  return min;
}

// Shortest distance in metres between two geometries. Returns 0 when they
// touch or overlap, and null when either geometry is unusable. Handles
// Polygon / MultiPolygon with holes on both sides.
export function geometryDistanceMeters(a, b) {
  const na = normalizeGeometry(a);
  const nb = normalizeGeometry(b);
  if (!na || !nb) return null;
  const ref = referenceFor([na, nb]);
  if (!ref) return null;
  const polysA = projectPolygons(na, ref);
  const polysB = projectPolygons(nb, ref);
  let min = Infinity;
  for (const pa of polysA) {
    for (const pb of polysB) {
      const dist = polygonPairDistance(pa, pb);
      if (dist < min) min = dist;
      if (min === 0) return 0;
    }
  }
  return Number.isFinite(min) ? min : null;
}

export function geometriesIntersect(a, b) {
  return geometryDistanceMeters(a, b) === 0;
}

// Local projection used by coverage grids and prescription area estimates.
// Keep the matching inverse together so browser rendering and calculations
// use one data-in/data-out implementation.
export function projectLngLatToLocalMeters([lng, lat], [lng0, lat0]) {
  const metresPerDegreeLat = EQUATOR_METERS_PER_DEG;
  const metresPerDegreeLng = EQUATOR_METERS_PER_DEG * Math.cos((lat0 * Math.PI) / 180);
  return [(lng - lng0) * metresPerDegreeLng, (lat - lat0) * metresPerDegreeLat];
}

export function unprojectLocalMetersToLngLat([x, y], [lng0, lat0]) {
  const metresPerDegreeLat = EQUATOR_METERS_PER_DEG;
  const metresPerDegreeLng = EQUATOR_METERS_PER_DEG * Math.cos((lat0 * Math.PI) / 180);
  return [lng0 + x / metresPerDegreeLng, lat0 + y / metresPerDegreeLat];
}

export function ringAreaSquareMeters(ring) {
  if (!Array.isArray(ring) || ring.length < 3) return 0;
  const origin = ring[0];
  const points = ring.map((coord) => projectLngLatToLocalMeters(coord, origin));
  let area = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    area += points[j][0] * points[i][1] - points[i][0] * points[j][1];
  }
  return Math.abs(area / 2);
}

export function polygonAreaHectares(geometry) {
  if (!geometry) return 0;
  const ringsArea = (rings) => (
    rings.length
      ? ringAreaSquareMeters(rings[0]) - rings.slice(1).reduce((sum, ring) => sum + ringAreaSquareMeters(ring), 0)
      : 0
  );
  let squareMetres = 0;
  if (geometry.type === "Polygon") squareMetres = ringsArea(geometry.coordinates);
  if (geometry.type === "MultiPolygon") {
    squareMetres = geometry.coordinates.reduce((sum, polygon) => sum + ringsArea(polygon), 0);
  }
  return Math.max(0, squareMetres) / 10000;
}

// --- stable hash (deterministic across browser + node) -------------------

export function hashString(input) {
  let h = 0x811c9dc5; // FNV-1a 32-bit
  const s = String(input);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

// Stable key for a geometry: rounds coordinates so re-imports of the same
// parcel hash identically even through float noise.
export function hashGeometry(geometry) {
  const normalized = normalizeGeometry(geometry);
  if (!normalized) return null;
  const parts = [];
  eachCoord(normalized, ([lng, lat]) => {
    parts.push(`${lng.toFixed(6)},${lat.toFixed(6)}`);
  });
  return hashString(`${normalized.type}|${parts.join(";")}`);
}

export function stableImportedId(type, stableKey) {
  const safeType = String(type || "field").replace(/[^a-zA-Z0-9_-]/g, "-");
  return `imported-${safeType}-${hashString(stableKey)}`;
}
