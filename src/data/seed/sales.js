import { OWNERS, SOURCES, SERVICES, FU_DEFAULTS } from '@/config/constants';
import { DAY, HOUR, MINUTE, today } from '@/lib/date';
import { seeded, genMeet } from '@/lib/random';

/** Build a follow-up with type defaults applied. */
export function makeFollowUp(o) {
  const [dur, remind] = FU_DEFAULTS[o.type] || [0, 0];
  return { dur, remind, prio: 'Medium', meet: '', attendees: '', notes: '', done: false, notified: false, ...o };
}

const COMPANIES = ['Zenvy Retail', 'Kaveri Foods', 'UrbanNest Realty', 'MedPlus Clinics', 'Swift Logistics', 'Bloom Edutech', 'FinOrbit', 'Greenleaf Organics', 'Trekly Travels', 'Apex Motors', 'Nova Fitness', 'Cartwheel Kids', 'Indus Pharma', 'PayKart', 'Haveli Hotels', 'Stellar Interiors', 'BrightPath Academy', 'QuickServe Cafe', 'Orbit Fintech', 'Saffron Weddings', 'Northwind Traders', 'Desert Rose LLC', 'Maple Health', 'Kiwi Learning', 'Lumen Labs', 'CloudKitchen Co', 'Vastra Fashion', 'RideOn Mobility', 'Ayur Wellness', 'Pixel Studios', 'Tatva Builders', 'Gharwala Services', 'Spice Route Exports', 'Credora Finance', 'Shubh Jewellers', 'Velocity Couriers', 'Kisan Mart', 'Atlas Insurance', 'Moksha Yoga', 'Hexa Robotics', 'Sunrise Hospitals', 'Doodle Toys'];
const FIRST = ['Ankit', 'Riya', 'Karan', 'Sneha', 'Arjun', 'Pooja', 'Vivek', 'Isha', 'Manish', 'Divya', 'Rahul', 'Tanvi', 'James', 'Sarah', 'Omar', 'Emily'];
const LAST = ['Mehta', 'Gupta', 'Reddy', 'Iyer', 'Malhotra', 'Bansal', 'Chopra', 'Nair', 'Saxena', 'Agarwal', 'Smith', 'Khan', 'Brown', 'Patel'];
const BASE_VALUE = { 'Mobile App': 8e5, 'Web Development': 3.5e5, 'UI/UX Design': 1.5e5, 'Custom Software': 12e5, 'E-commerce': 4e5, 'AI / ML': 15e5, 'Digital Marketing': 1.2e5 };
const FU_TITLES = {
  Meeting: ['Discovery call', 'Proposal walkthrough', 'Prototype demo', 'Scope & timeline review'],
  Call: ['Follow-up call', 'Pricing discussion', 'Requirement clarification'],
  Task: ['Send proposal', 'Prepare cost estimate', 'Share case studies', 'Draft SOW'],
  Reminder: ['Check proposal feedback', 'Payment follow-up', 'Re-engage lead'],
};

/** Seed 42 leads and ~49 follow-ups. */
export function seedSales() {
  const { r, pick } = seeded(20261109);
  const now = Date.now();
  const T = today();

  const leads = COMPANIES.map((co, i) => {
    const age = Math.floor(Math.pow(r(), 1.4) * 200);
    const x = r();
    let status;
    if (age < 7) status = x < 0.55 ? 'New' : x < 0.85 ? 'Contacted' : 'Qualified';
    else if (age < 30) status = ['New', 'Contacted', 'Qualified', 'Proposal Sent', 'Negotiation', 'Won', 'Lost'][Math.floor(x * 7)];
    else status = x < 0.35 ? 'Won' : x < 0.58 ? 'Lost' : ['Contacted', 'Qualified', 'Proposal Sent', 'Negotiation'][Math.floor(r() * 4)];
    const service = pick(SERVICES);
    const fn = pick(FIRST);
    const ln = pick(LAST);
    return {
      id: `MX-${1001 + i}`,
      company: co,
      contact: `${fn} ${ln}`,
      email: `${fn}.${ln}`.toLowerCase() + '@' + co.toLowerCase().replace(/[^a-z]/g, '').slice(0, 12) + '.com',
      phone: '+91 9' + String(Math.floor(r() * 1e9)).padStart(9, '0').replace(/(\d{4})(\d{5})/, '$1 $2'),
      service,
      source: pick(SOURCES),
      owner: pick(OWNERS).id,
      status,
      value: Math.round((BASE_VALUE[service] * (0.5 + r() * 1.6)) / 5000) * 5000,
      created: T - age * DAY + Math.floor(9 + r() * 9) * HOUR,
      notes: '',
    };
  });

  const active = leads.filter((l) => l.status !== 'Lost' && l.status !== 'Won');
  const fus = [];
  for (let i = 0; i < 48; i++) {
    const l = pick(active);
    const type = pick(['Meeting', 'Meeting', 'Call', 'Call', 'Task', 'Reminder']);
    const off = Math.floor(r() * 24) - 9;
    const due = T + off * DAY + (10 + Math.floor(r() * 8)) * HOUR + (r() < 0.5 ? 0 : 30) * MINUTE;
    fus.push(makeFollowUp({
      id: `F${i + 1}`, type, title: pick(FU_TITLES[type]), leadId: l.id, owner: l.owner, due,
      prio: pick(['High', 'Medium', 'Medium', 'Low']), meet: type === 'Meeting' ? genMeet(r) : '', attendees: l.email,
      done: due < now - HOUR && r() < 0.6, notified: due < now,
    }));
  }
  // A meeting starting soon so the reminder alert is visible on first load.
  const l0 = active[0];
  const soon = Math.ceil((now + 18 * MINUTE) / 3e5) * 3e5;
  fus.push(makeFollowUp({ id: 'F49', type: 'Meeting', title: 'Proposal walkthrough', leadId: l0.id, owner: l0.owner, due: soon, prio: 'High', remind: 30, meet: genMeet(r), attendees: l0.email }));

  return { leads, fus };
}
