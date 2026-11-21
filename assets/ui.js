// Text, links and layout shared by the feed, archive and topic pages.
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[character]);

export function webUrl(value) {
  if (!value) return '';
  try {
    const url = new URL(value, document.baseURI);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

const symbols = {
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/>',
  arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  back: '<path d="M20 12H5m6-6-6 6 6 6"/>',
  external: '<path d="M6 18 18 6M7 6h11v11"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/>',
  tag: '<path d="M3 4h8l10 10-7 7L3 10z"/><circle cx="7" cy="7.5" r=".8"/>',
  layers: '<path d="m3 8 9-5 9 5-9 5zM3 12l9 5 9-5M3 16l9 5 9-5"/>',
  list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.1M4 12h.1M4 18h.1"/>',
  grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="1"/><rect x="13.5" y="3.5" width="7" height="7" rx="1"/><rect x="3.5" y="13.5" width="7" height="7" rx="1"/><rect x="13.5" y="13.5" width="7" height="7" rx="1"/>',
  leaf: '<path d="M20 3C11 3 3 6 4 14c.4 3.4 3 5.5 6 5 7-.5 10-8 10-16ZM3 21l12-12"/>',
  route: '<circle cx="6" cy="6" r="2.2"/><circle cx="18" cy="18" r="2.2"/><path d="M8 6h7a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h7"/>',
  building: '<path d="M4 21V7l8-4v18m0-12h7v12M2 21h20M7 9h2m-2 4h2m-2 4h2m6-5h1m-1 4h1"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2"/>',
  orbit: '<circle cx="12" cy="12" r="3"/><ellipse cx="12" cy="12" rx="11" ry="4.5" transform="rotate(-36 12 12)"/>',
  globe: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
  telescope: '<path d="m3 10 13-6 3 6-13 5zM12 13v3m0 0-4 5m4-5 4 5m2-16 2-1 2 4-2 1"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>'
};
export function icon(name) {
  return `<svg class="icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${symbols[name] || symbols.tag}</svg>`;
}

export function route(parameters = {}) {
  const query = new URLSearchParams();
  const profile = new URLSearchParams(location.search).get('profil');
  if (profile) query.set('profil', profile);
  for (const [key, value] of Object.entries(parameters)) {
    if (value !== '' && value != null) query.set(key, value);
  }
  return location.pathname + (query.size ? '?' + query : '');
}

export function internal(label, parameters, className = '', attributes = '') {
  return `<a data-route class="${escapeHtml(className)}" href="${escapeHtml(route(parameters))}" ${attributes}>${label}</a>`;
}

function outbound(label, value, className = '') {
  const url = webUrl(value);
  return url ? `<a class="${className}" href="${escapeHtml(url)}">${label}</a>` : '';
}

export function brand(profile) {
  const logo = webUrl(profile.logo);
  const isWordmark = Boolean(logo && profile.logoMode === 'wordmark');
  const image = logo ? `<img class="${isWordmark ? 'brand-wordmark' : 'brand-mark'}" src="${escapeHtml(logo)}" alt="" height="44">` : '';
  return image + (isWordmark ? '' : `<span class="brand-name">${escapeHtml(profile.name)}</span>`);
}

export function header(profile, view) {
  const navigation = [['aktuell', 'Aktuell'], ['archiv', 'Alle Meldungen'], ['themen', 'Themen']];
  return `<header class="site-header"><div class="wrap header-inner">
    ${internal(brand(profile), {}, 'brand', 'aria-label="' + escapeHtml(profile.name) + ', Startseite"')}
    <nav class="main-nav" aria-label="Hauptnavigation">
      ${navigation.map(([id, label]) => internal(label, {ansicht: id === 'aktuell' ? '' : id}, 'nav-link', id === view ? 'aria-current="page"' : '')).join('')}
    </nav>
    ${internal(icon('info') + '<span>Über</span>', {ansicht: 'ueber'}, 'about-link', view === 'ueber' ? 'aria-current="page"' : '')}
  </div></header>`;
}

export function footer(profile) {
  const links = profile.links || {};
  return `<footer class="site-footer"><div class="wrap footer-inner">
    <span class="footer-name">${escapeHtml(profile.name)}</span>
    <nav class="footer-links" aria-label="Weitere Informationen">
    ${internal('Über die Website', {ansicht: 'ueber'})}
    ${outbound('Website', links.website)}${outbound('Newsletter', links.newsletter)}
    ${outbound('Impressum', links.impressum)}${outbound('Datenschutz', links.datenschutz)}
    </nav></div></footer>`;
}

export function hero({view, kicker, title, highlight, intro}) {
  return `<header class="hero" data-view="${escapeHtml(view)}"><div class="wrap hero-inner">
    <div class="hero-copy">${kicker ? `<p class="eyebrow">${escapeHtml(kicker)}</p>` : ''}
    <h1>${escapeHtml(title)}${highlight ? ` <em>${escapeHtml(highlight)}</em>` : ''}</h1>
    ${intro ? `<p class="intro">${escapeHtml(intro)}</p>` : ''}</div>
    <div class="hero-art" aria-hidden="true"></div>
  </div></header>`;
}

const germanDate = new Intl.DateTimeFormat('de-DE', {dateStyle: 'long', timeZone: 'UTC'});
const germanMonth = new Intl.DateTimeFormat('de-DE', {month: 'short', timeZone: 'UTC'});
export function fullDate(value) {
  return germanDate.format(new Date(value + 'T12:00:00Z'));
}
function dateBlock(value) {
  const date = new Date(value + 'T12:00:00Z');
  return `<time class="date-block" datetime="${escapeHtml(value)}" aria-label="${escapeHtml(germanDate.format(date))}"><strong>${date.getUTCDate()}</strong><span class="date-rest"><span class="date-month">${escapeHtml(germanMonth.format(date))}</span><span class="date-year">${date.getUTCFullYear()}</span></span></time>`;
}
export function sourceIdentity(source = {}) {
  const name = source.name || 'Quelle';
  const words = name.replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(/\s+/);
  const initials = words.length > 1 ? words.slice(0, 2).map(word => word[0]).join('') : name.slice(0, 2);
  const sourceMark = source.mark || initials.toLocaleUpperCase('de');
  return `<span class="source-identity"><span class="source-mark" aria-hidden="true">${escapeHtml(sourceMark)}</span><span class="source-name">${escapeHtml(name)}</span></span>`;
}
export function sourceLink(source, label = 'Zur Quelle', className = 'source-link') {
  return outbound(escapeHtml(label) + ' ' + icon('external'), source?.url, className);
}
export function tags(item, topics) {
  const items = (item.topics || []).map(id => topics.get(id)).filter(Boolean);
  return `<div class="tag-list">${items.map(topic =>
    internal(escapeHtml(topic.label), {ansicht: 'themen', thema: topic.id}, 'tag')).join('')}</div>`;
}

export function newsCard(item, state, topics) {
  const heading = state.ansicht === 'archiv' ? 'h2' : 'h3';
  const parameters = {...state, ansicht: 'meldung', id: item.id, rueckweg: state.ansicht || 'aktuell'};
  return `<article class="news-card" data-section="${escapeHtml(item.section)}">
    <div class="card-meta">${sourceIdentity(item.source)}${dateBlock(item.date)}</div>
    <${heading}>${internal(escapeHtml(item.title), parameters)}</${heading}>
    <p class="card-summary">${escapeHtml(item.summary)}</p>
    <div class="card-foot">${tags({...item, topics: item.topics.slice(0, 1)}, topics)}${sourceLink(item.source)}</div>
  </article>`;
}

export function topicCards(profile, items) {
  const cards = profile.topics.map(topic => {
    const count = items.filter(item => item.topics.includes(topic.id)).length;
    return internal(`<span class="topic-icon">${icon(topic.icon || 'layers')}</span>
      <h2>${escapeHtml(topic.label)}</h2><p>${escapeHtml(topic.description)}</p>
      <span class="topic-meta">${count} ${count === 1 ? 'Meldung' : 'Meldungen'} ${icon('arrow')}</span>`,
      {ansicht: 'themen', thema: topic.id}, 'topic-card');
  });
  return `<div class="topic-grid">${cards.join('')}</div>`;
}
