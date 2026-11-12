import { useSettings } from '@/store/settings';
import { useStore } from '@/store';
import { Button, Field, Modal, SegmentedControl, Toggle } from '@/components/ui';
import ManageLists from './ManageLists';
import s from './SettingsModal.module.css';

/**
 * Portal settings (Super Admin, from the sidebar footer). Changes apply immediately and are saved
 * on the server for everyone (useSettings.set → PUT /settings); a rejection is rolled back.
 */
export default function SettingsModal({ onClose }) {
  const { currency, defaultLeadsView, reminderAlerts, set } = useSettings();
  const setLeadView = useStore((x) => x.setLeadView);
  const flash = useStore((x) => x.flash);

  return (
    <Modal
      title="Portal settings"
      sub="Applies to everyone using the portal."
      width={560}
      onClose={onClose}
      footer={<Button variant="primary" onClick={onClose}>Done</Button>}
    >
      <Field as="div" label="Currency" hint="Money values across the portal are shown in this currency.">
        <SegmentedControl
          label="Currency"
          options={[['INR', 'INR (₹)'], ['USD', 'USD ($)']]}
          value={currency}
          onChange={async (v) => {
            const e = await set({ currency: v });
            flash?.(e || `Currency set to ${v}`);
          }}
        />
      </Field>
      <Field as="div" label="Default leads view" hint="How the Leads page opens.">
        <SegmentedControl
          label="Default leads view"
          options={[['Kanban', 'Board'], ['Table', 'Table']]}
          value={defaultLeadsView}
          onChange={async (v) => {
            setLeadView?.(v === 'Table' ? 'table' : 'kanban');
            const e = await set({ defaultLeadsView: v });
            if (e) flash?.(e);
          }}
        />
      </Field>
      <div className={s.row}>
        <div>
          <div className={s.rowTitle} id="set-reminders">Reminder alerts</div>
          <div className={s.rowSub}>Pop up a reminder before follow-ups are due.</div>
        </div>
        <Toggle aria-labelledby="set-reminders" checked={reminderAlerts} onChange={async (v) => { const e = await set({ reminderAlerts: v }); if (e) flash?.(e); }} />
      </div>
      <div className={s.section}>
        <div className={s.sectionTitle}>Manage lists</div>
        <div className={s.sectionSub}>Lead stages, sources and services offered across the portal. Values in use can't be removed.</div>
        <ManageLists />
      </div>
    </Modal>
  );
}
