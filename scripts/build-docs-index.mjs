// Genereert DOCS-INDEX.md uit de publieke documentatie van mijn.autorespond.nl.
// Draait in de GitHub Action (dagelijks) of lokaal: node scripts/build-docs-index.mjs
import { writeFileSync } from 'node:fs';

const BASE = 'https://mijn.autorespond.nl/wp-json/wp/v2';
const UA = 'autorespond-ai-context-index (+https://github.com/Autorespond/ai-context)';

async function getJson(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return { data: await r.json(), totalPages: Number(r.headers.get('x-wp-totalpages') || 1) };
}

function clean(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#8230;|&hellip;/g, ' ')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#8217;|&#8216;|&rsquo;|&lsquo;/g, "'")
    .replace(/&#8220;|&#8221;|&ldquo;|&rdquo;/g, '"').replace(/&#8211;|&ndash;/g, '-')
    .replace(/\s+/g, ' ').trim();
}

function summary(excerpt, max = 170) {
  const t = clean(excerpt).replace(/\s*\[…\]\s*$/, '').replace(/\s*\.\.\.\s*$/, '');
  return t.length > max ? t.slice(0, max - 1).replace(/\s+\S*$/, '') + '…' : t;
}

const cats = new Map();
{
  const { data } = await getJson(`${BASE}/doc_category?per_page=100&_fields=id,name,slug,count`);
  for (const c of data) cats.set(c.id, { name: clean(c.name), slug: c.slug, docs: [] });
}

const docs = [];
for (let page = 1, pages = 1; page <= pages; page++) {
  const { data, totalPages } = await getJson(`${BASE}/docs?per_page=100&page=${page}&orderby=title&order=asc&_fields=id,title,link,excerpt,doc_category,modified`);
  pages = totalPages;
  for (const d of data) docs.push(d);
}

const uncategorized = [];
for (const d of docs) {
  const item = { title: clean(d.title?.rendered), link: d.link, sum: summary(d.excerpt?.rendered) };
  const ids = Array.isArray(d.doc_category) ? d.doc_category : [];
  const placed = ids.filter((id) => cats.has(id));
  if (!placed.length) uncategorized.push(item);
  for (const id of placed) cats.get(id).docs.push(item);
}

const today = new Date().toISOString().slice(0, 10);
let md = `# Autorespond documentatie: index\n\n`;
md += `Alle artikelen op https://mijn.autorespond.nl/docs/ per onderwerp, met korte samenvatting. Automatisch bijgewerkt op ${today} (${docs.length} artikelen). Open alleen het artikel dat bij de vraag past.\n\n`;
const ordered = [...cats.values()].filter((c) => c.docs.length).sort((a, b) => a.name.localeCompare(b.name, 'nl'));
for (const c of ordered) {
  md += `## ${c.name}\n\n`;
  for (const d of c.docs.sort((a, b) => a.title.localeCompare(b.title, 'nl'))) {
    md += `- [${d.title}](${d.link})${d.sum ? ` — ${d.sum}` : ''}\n`;
  }
  md += `\n`;
}
if (uncategorized.length) {
  md += `## Overig\n\n`;
  for (const d of uncategorized) md += `- [${d.title}](${d.link})${d.sum ? ` — ${d.sum}` : ''}\n`;
  md += `\n`;
}
writeFileSync('DOCS-INDEX.md', md);
console.log(`DOCS-INDEX.md: ${docs.length} artikelen in ${ordered.length} categorieën`);
