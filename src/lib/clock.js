/**
 * Server clock. Every API response carries `X-Server-Time` (ms); we keep the difference between the
 * server's clock and this device's clock, so timers, "today", late / overdue checks and reminders
 * follow the server even when the laptop's clock is wrong.
 *
 * Use `serverNow()` wherever the app needs "now". Times saved to the database are always stamped by
 * the server itself — this only keeps what the screen shows in line with it.
 */
let offset = 0; // server − device, ms
let bestRtt = Infinity; // round-trip of the sample `offset` came from
let bestAt = 0;

/** Current time on the server's clock (ms since epoch). */
export const serverNow = () => Date.now() + offset;

/** Current offset (ms); positive when the device clock is behind the server. */
export const clockOffset = () => offset;

/**
 * Feed one measurement from an HTTP response.
 * @param {string|number|null} serverMs value of the X-Server-Time header
 * @param {number} sentAt   device time just before the request was sent
 * @param {number} receivedAt device time when the response arrived
 */
export function syncClock(serverMs, sentAt, receivedAt) {
  const server = Number(serverMs);
  if (!Number.isFinite(server) || server <= 0) return;
  const rtt = Math.max(0, receivedAt - sentAt);
  // Prefer fast round-trips (most accurate); refresh the estimate at least once a minute
  // so a clock that is changed or drifts is picked up.
  if (rtt <= bestRtt || receivedAt - bestAt > 60_000) {
    offset = Math.round(server + rtt / 2 - receivedAt);
    bestRtt = rtt;
    bestAt = receivedAt;
  }
}
