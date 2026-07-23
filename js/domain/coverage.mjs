import {
  pointInRing,
  pointSegmentDistance,
  projectLngLatToLocalMeters,
  unprojectLocalMetersToLngLat,
} from "./geometry.mjs";

export const DEFAULT_COVERAGE_CELL_METRES = 5;

const gridCache = new Map();

function numericOr(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function validCoordinates(coordinates) {
  return (
    Array.isArray(coordinates)
    && coordinates.length >= 2
    && Number.isFinite(Number(coordinates[0]))
    && Number.isFinite(Number(coordinates[1]))
  );
}

function coverageGridKey(fieldId, ring, cellMetres) {
  const points = ring.map((point) => point.map((number) => Math.round(number)).join(",")).join(";");
  return `${fieldId || "field"}:${cellMetres}:${points}`;
}

export function buildCoverageGrid({
  fieldId = "",
  ringLngLat,
  cellMetres = DEFAULT_COVERAGE_CELL_METRES,
} = {}) {
  if (!Array.isArray(ringLngLat) || ringLngLat.length < 3) return null;
  const origin = ringLngLat[0];
  const ring = ringLngLat.map((coordinate) => projectLngLatToLocalMeters(coordinate, origin));
  const cell = Math.max(1, numericOr(cellMetres, DEFAULT_COVERAGE_CELL_METRES));
  const key = coverageGridKey(fieldId, ring, cell);
  if (gridCache.has(key)) return gridCache.get(key);

  const xs = ring.map((point) => point[0]);
  const ys = ring.map((point) => point[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const cells = [];
  for (let y = minY; y < maxY; y += cell) {
    for (let x = minX; x < maxX; x += cell) {
      const cx = x + cell / 2;
      const cy = y + cell / 2;
      if (pointInRing([cx, cy], ring)) cells.push({ x, y, cx, cy });
    }
  }

  const grid = { origin, ring, cells, cell };
  gridCache.set(key, grid);
  return grid;
}

export function projectCoverageTrack(grid, track) {
  if (!grid || !Array.isArray(track)) return [];
  return track.map((point) => {
    const coordinates = validCoordinates(point?.coordinates)
      ? [Number(point.coordinates[0]), Number(point.coordinates[1])]
      : null;
    return {
      coordinates,
      projected: coordinates ? projectLngLatToLocalMeters(coordinates, grid.origin) : null,
      sprayOn: Boolean(point?.sprayOn),
    };
  });
}

export function coverageSprayedFlags(grid, projectedTrack, sprayWidthMetres, uptoIndex) {
  const flags = new Uint8Array(grid?.cells?.length || 0);
  if (!grid || !Array.isArray(projectedTrack) || projectedTrack.length < 2) return flags;
  const halfWidth = (numericOr(sprayWidthMetres, 4) || 4) / 2 + grid.cell * 0.4;
  const end = uptoIndex == null
    ? projectedTrack.length - 1
    : Math.min(uptoIndex, projectedTrack.length - 1);

  for (let index = 1; index <= end; index += 1) {
    if (!projectedTrack[index - 1].projected || !projectedTrack[index].projected) continue;
    if (!projectedTrack[index - 1].sprayOn && !projectedTrack[index].sprayOn) continue;
    const start = projectedTrack[index - 1].projected;
    const finish = projectedTrack[index].projected;
    for (let cellIndex = 0; cellIndex < grid.cells.length; cellIndex += 1) {
      if (flags[cellIndex]) continue;
      const cell = grid.cells[cellIndex];
      if (pointSegmentDistance([cell.cx, cell.cy], start, finish) <= halfWidth) {
        flags[cellIndex] = 1;
      }
    }
  }
  return flags;
}

export function calculateGridCoverage(input = {}, uptoIndex) {
  const track = Array.isArray(input.track) ? input.track : [];
  if (track.length < 2) return null;
  const grid = buildCoverageGrid(input);
  if (!grid?.cells?.length) return null;
  const projectedTrack = projectCoverageTrack(grid, track);
  if (projectedTrack.length < 2 || projectedTrack.filter((point) => point.projected).length < 2) return null;
  const flags = coverageSprayedFlags(grid, projectedTrack, input.sprayWidthMetres, uptoIndex);
  let sprayedCells = 0;
  for (let index = 0; index < flags.length; index += 1) sprayedCells += flags[index];
  const cellHa = (grid.cell * grid.cell) / 10000;
  return {
    grid,
    flags,
    sprayedCells,
    totalCells: grid.cells.length,
    coveredHa: sprayedCells * cellHa,
    fieldAreaHa: grid.cells.length * cellHa,
    coveragePct: Math.round((sprayedCells / grid.cells.length) * 100),
  };
}

export function estimateCoverage(input = {}) {
  if (!input.imported) return { hasLog: false };
  const coverage = calculateGridCoverage(input);
  if (!coverage) return { hasLog: false };
  return {
    hasLog: true,
    coveredHa: Number(coverage.coveredHa.toFixed(2)),
    fieldAreaHa: Number(coverage.fieldAreaHa.toFixed(2)),
    coveragePct: coverage.coveragePct,
    unsprayedCells: coverage.totalCells - coverage.sprayedCells,
  };
}

export function coveragePlanHasLog(input = {}) {
  return Boolean(input.imported && Array.isArray(input.track) && input.track.length >= 2);
}

export function coverageMapData(input = {}, uptoIndex) {
  const coverage = calculateGridCoverage(input, uptoIndex);
  if (!coverage) return null;
  const { origin, cell } = coverage.grid;
  const cellFeatures = coverage.grid.cells.map((gridCell, index) => ({
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [[
        unprojectLocalMetersToLngLat([gridCell.x, gridCell.y], origin),
        unprojectLocalMetersToLngLat([gridCell.x + cell, gridCell.y], origin),
        unprojectLocalMetersToLngLat([gridCell.x + cell, gridCell.y + cell], origin),
        unprojectLocalMetersToLngLat([gridCell.x, gridCell.y + cell], origin),
        unprojectLocalMetersToLngLat([gridCell.x, gridCell.y], origin),
      ]],
    },
    properties: { sprayed: coverage.flags[index] },
  }));
  const track = input.track;
  const index = uptoIndex == null
    ? track.length - 1
    : Math.max(0, Math.min(uptoIndex, track.length - 1));
  const marker = validCoordinates(track[index]?.coordinates) ? track[index] : null;
  return {
    cells: { type: "FeatureCollection", features: cellFeatures },
    marker: {
      type: "FeatureCollection",
      features: marker
        ? [{ type: "Feature", geometry: { type: "Point", coordinates: marker.coordinates }, properties: {} }]
        : [],
    },
    gc: coverage,
    idx: index,
  };
}

export function resetCoverageGridCacheForTest() {
  gridCache.clear();
}
