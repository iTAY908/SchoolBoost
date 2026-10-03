// ============================================================================
// Worker 4 (backend half) — real-time monitoring rules
// alerts.js — derive low-balance / overspend alerts from a cube snapshot.
// Pure functions; the client polls or receives these alongside chat replies.
// ============================================================================

const LOW_RATIO = 0.2; // balance under 20% of monthly target => "low"

/**
 * @param {Array} cubes
 * @returns {Array} alerts [{ level, key, name, message }]
 */
function evaluateAlerts(cubes = []) {
  const alerts = [];
  for (const c of cubes) {
    if (c.balance < 0) {
      alerts.push({
        level: 'critical',
        key: c.key,
        name: c.name,
        message: `${c.name} is overdrawn (${c.balance.toLocaleString()} ILS). Move funds in.`,
      });
      continue;
    }
    const target = c.monthlyContribution || 0;
    if (target > 0 && c.balance < target * LOW_RATIO) {
      alerts.push({
        level: 'warning',
        key: c.key,
        name: c.name,
        message: `${c.name} is running low: ${c.balance.toLocaleString()} of ${target.toLocaleString()} ILS.`,
      });
    }
  }
  return alerts;
}

module.exports = { evaluateAlerts, LOW_RATIO };
