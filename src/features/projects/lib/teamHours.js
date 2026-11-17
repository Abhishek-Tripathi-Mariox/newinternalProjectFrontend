/** Split `hours` over `team`: whole hours, the remainder (incl. any fraction) going to the first people. */
export function splitHours(team, hours) {
  const H = Math.max(0, +hours || 0);
  const n = team.length;
  if (!n) return {};
  const base = Math.floor(H / n);
  let left = Math.round((H - base * n) * 100) / 100;
  return Object.fromEntries(team.map((id) => {
    const add = Math.min(1, left);
    left = Math.round((left - add) * 100) / 100;
    return [id, base + add];
  }));
}

/**
 * Per-person hours after the milestone's team changes:
 * - one person → they get all of the milestone's hours;
 * - a second person joins a one-person milestone that had all the hours → split evenly;
 * - otherwise keep everyone's hours (newcomers start at 0).
 */
export function autoTeamHours(prevTeam, prevHours, nextTeam, msHours) {
  const H = Math.max(0, +msHours || 0);
  if (nextTeam.length === 1) return { [nextTeam[0]]: H };
  const had = prevTeam.length === 1 && Math.abs((+prevHours[prevTeam[0]] || 0) - H) < 1e-9;
  if (nextTeam.length > 1 && had && nextTeam.includes(prevTeam[0])) return splitHours(nextTeam, H);
  return Object.fromEntries(nextTeam.map((id) => [id, +prevHours[id] || 0]));
}
