/** Attachments: kind detection and reading browser File objects into storable records. */

/** Max upload size; larger files are skipped. */
export const MAX_FILE = 10 * 1048576;
/** Files above this are stored by name only (url ''). */
export const MAX_STORED = 1.5 * 1048576;

/** Guess the document kind (SOW, NDA, …) from a file name. */
export function docKind(name) {
  const n = ` ${(name || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ')} `;
  return /\bsow\b|statement.of.work/.test(n) ? 'SOW'
    : /\bfrd\b|functional/.test(n) ? 'FRD'
      : /\bbrd\b|business.req/.test(n) ? 'BRD'
        : /\bnda\b|non.disclosure/.test(n) ? 'NDA'
          : /proposal|quotation|quote|estimate/.test(n) ? 'Proposal'
            : /contract|agreement|\bmsa\b/.test(n) ? 'Contract / MSA'
              : /wireframe/.test(n) ? 'Wireframes'
                : /invoice/.test(n) ? 'Invoice'
                  : /spec|style.?guide|design/.test(n) ? 'Design specs'
                    : 'Other';
}

/**
 * Read a FileList / File[] into attachment records.
 * @returns {Promise<{atts: object[], skipped: number}>} skipped = files over 10 MB
 */
export async function readFiles(list) {
  const files = Array.from(list || []);
  const skipped = files.filter((f) => f.size > MAX_FILE).length;
  const atts = await Promise.all(files.filter((f) => f.size <= MAX_FILE).map((f) => new Promise((res) => {
    const base = { name: f.name, size: f.size, type: f.type || '', at: Date.now() };
    if (f.size > MAX_STORED) return res({ ...base, url: '' });
    const rd = new FileReader();
    rd.onload = () => res({ ...base, url: rd.result });
    rd.onerror = () => res({ ...base, url: '' });
    rd.readAsDataURL(f);
  })));
  atts.forEach((a) => { a.kind = docKind(a.name); });
  return { atts, skipped };
}

/** Toast text after attaching: "3 files attached · 1 skipped (over 10 MB)". */
export const attachedMessage = (n, skipped = 0) =>
  `${n} file${n === 1 ? '' : 's'} attached${skipped ? ` · ${skipped} skipped (over 10 MB)` : ''}`;
