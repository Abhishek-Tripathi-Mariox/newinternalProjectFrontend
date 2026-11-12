/**
 * Masters API: lead stages, lead sources, services and portal settings.
 * loadMasters() fills the `useMasters` / `useSettings` stores and returns the store state that
 * depends on them (the initial leads view).
 */
import { api } from './client';
import { useMasters } from '@/store/masters';
import { useSettings } from '@/store/settings';

/** Store path of each list kind. */
export const MASTER_PATHS = { stage: '/lead-stages', source: '/lead-sources', service: '/services' };

/** Stage DTO → store tuple [name, hue]. */
export const fromApiStage = (s) => [s.name, s.hue];
export const fromApiItem = (x) => x.name;

const enc = encodeURIComponent;

export const mastersApi = {
  add: (kind, name) => api.post(MASTER_PATHS[kind], { name }),
  rename: (kind, from, name) => api.patch(`${MASTER_PATHS[kind]}/${enc(from)}`, { name }),
  setHue: (name, hue) => api.patch(`${MASTER_PATHS.stage}/${enc(name)}`, { hue }),
  move: (kind, name, dir) => api.post(`${MASTER_PATHS[kind]}/${enc(name)}/move`, { dir }),
  remove: (kind, name) => api.del(`${MASTER_PATHS[kind]}/${enc(name)}`),
  list: (kind) => api.get(MASTER_PATHS[kind]),
  putSettings: (patch) => api.put('/settings', patch),
};

export async function loadMasters() {
  const [stages, sources, services, settings] = await Promise.all([
    api.get(MASTER_PATHS.stage),
    api.get(MASTER_PATHS.source),
    api.get(MASTER_PATHS.service),
    api.get('/settings').catch(() => null),
  ]);
  useMasters.setState({
    leadStatuses: (stages || []).map(fromApiStage),
    sources: (sources || []).map(fromApiItem),
    services: (services || []).map(fromApiItem),
  });
  if (settings) {
    const { currency, defaultLeadsView, reminderAlerts } = settings;
    useSettings.setState({
      ...(currency ? { currency } : {}),
      ...(defaultLeadsView ? { defaultLeadsView } : {}),
      ...(typeof reminderAlerts === 'boolean' ? { reminderAlerts } : {}),
    });
  }
  return { leadView: useSettings.getState().defaultLeadsView === 'Table' ? 'table' : 'kanban' };
}
