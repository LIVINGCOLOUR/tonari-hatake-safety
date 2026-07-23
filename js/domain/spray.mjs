const UNIT_STEP_UP = Object.freeze({
  mL: ["L", 1000],
  g: ["kg", 1000],
});

function numericValue(value) {
  if (value === "" || value === null || value === undefined) return "";
  const number = Number(value);
  return Number.isFinite(number) ? number : "";
}

export function trimNumber(value) {
  return Number(Number(value).toFixed(2)).toString();
}

export function plannedTotalAmount(plan = {}) {
  const rate = numericValue(plan.ratePer10a);
  const area = numericValue(plan.areaHa);
  if (!rate || !area) return null;
  return { value: rate * area * 10, unit: plan.rateUnit || "mL" };
}

export function formatAmountValue(value, unit) {
  if (!Number.isFinite(value)) return "";
  const stepUp = UNIT_STEP_UP[unit];
  if (stepUp && value >= stepUp[1]) {
    return `${trimNumber(value / stepUp[1])}${stepUp[0]}`;
  }
  return `${trimNumber(value)}${unit}`;
}

export function formatTotalAmount(plan) {
  const total = plannedTotalAmount(plan);
  return total ? formatAmountValue(total.value, total.unit) : "\u2014";
}
