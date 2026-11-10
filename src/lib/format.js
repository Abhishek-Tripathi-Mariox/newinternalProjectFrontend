import { useSettings } from '@/store/settings';

/** INR → compact currency label, honouring the portal currency setting. */
export function money(v, currency = useSettings.getState().currency) {
  v = +v || 0;
  if (currency === 'USD') {
    v = v / 84;
    return v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `$${Math.round(v / 1e3)}K` : `$${Math.round(v)}`;
  }
  return v >= 1e7 ? `₹${(v / 1e7).toFixed(2)} Cr` : v >= 1e5 ? `₹${(v / 1e5).toFixed(1)} L` : `₹${Math.round(v).toLocaleString('en-IN')}`;
}

/** Full INR amount: ₹1,25,000. */
export const inr = (v) => `₹${Math.round(+v || 0).toLocaleString('en-IN')}`;

/** Hours with one decimal: "12.5h". */
export const hh = (x) => `${(Math.round((+x || 0) * 10) / 10).toLocaleString('en-IN')}h`;

/** Hours without locale grouping: "12.5h". */
export const h1 = (x) => `${Math.round((+x || 0) * 10) / 10}h`;

/** Bar width as a clamped percentage string. */
export const pctW = (x) => `${(isFinite(x) ? Math.max(0, Math.min(100, x * 100)) : 0).toFixed(1)}%`;

/** File size label. */
export const fileSize = (b) => (b < 1048576 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1048576).toFixed(1)} MB`);

export const initials = (name = '') => name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

export const plural = (n, word, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;

export const firstName = (name = '') => name.split(' ')[0];
