import { useCallback } from 'react';
import { DocumentsPanel, LinksEditor, SectionTitle } from '@/components/ui';
import { useStore } from '@/store';
import { LINK_HUE } from '@/config/constants';
import { badgeTone } from '../lib/view';
import s from './drawer.module.css';

const EMPTY = [];

/**
 * Documents & links: brief, saved link chips, link editor and documents.
 * Valid links (https://…) are saved to the project straight away; incomplete
 * ones are kept as a per-project draft in pj.linkDraft (store.setProjLinks).
 */
export default function DocsLinksSection({ project: sp }) {
  const linkDraft = useStore((st) => st.pj.linkDraft);
  const setProjLinks = useStore((st) => st.setProjLinks);
  const setProjDocs = useStore((st) => st.setProjDocs);

  const saved = sp.links || EMPTY;
  const draft = linkDraft && linkDraft.pid === sp.id ? linkDraft.links : EMPTY;
  const docs = sp.docs || EMPTY;
  const allLinks = saved.concat(draft);

  // The store keeps valid https:// links on the project and parks the rest in pj.linkDraft.
  const onLinks = useCallback((next) => setProjLinks(sp.id, next), [setProjLinks, sp.id]);
  const onDocs = useCallback((fn) => setProjDocs(sp.id, (d) => fn(d || [])), [setProjDocs, sp.id]);

  const sum = `${saved.length ? `${saved.length} link${saved.length > 1 ? 's' : ''} · ` : ''}${docs.length} file${docs.length === 1 ? '' : 's'}`;

  return (
    <section className={s.section}>
      <SectionTitle title="Documents & links" sub={sum} />
      {sp.brief && <div className={s.brief}>{sp.brief}</div>}
      {saved.length > 0 && (
        <div className={s.savedLinks}>
          {saved.map((l, i) => {
            const t = badgeTone(LINK_HUE[l.type] ?? 265);
            return (
              <a key={`${l.url}-${i}`} className={s.savedLink} href={l.url} target="_blank" rel="noreferrer" title={l.url}>
                <span className={s.linkType} style={{ background: t.bg, color: t.fg }}>
                  {l.type}
                </span>
                <span className={s.linkShort}>{l.url.replace(/^https?:\/\/(www\.)?/, '')}</span>
                <span className={s.muted}>↗</span>
              </a>
            );
          })}
        </div>
      )}
      <LinksEditor links={allLinks} onChange={onLinks} />
      <DocumentsPanel docs={docs} onChange={onDocs} />
    </section>
  );
}
