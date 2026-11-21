import {escapeHtml as esc, webUrl, icon, route, internal, header, footer, hero,
  fullDate, sourceIdentity, sourceLink, tags, newsCard, topicCards} from './ui.js';

const main = document.querySelector('#inhalt');
const pageSize = 8;
const views = ['aktuell', 'archiv', 'themen', 'meldung', 'ueber'];
const periods = [['30', 'Letzte 30 Tage'], ['90', 'Letzte 90 Tage'], ['jahr', 'Dieses Jahr'], ['frei', 'Eigener Zeitraum']];
let profile, items, sections, topics;
let editingSearch = false;

async function readJson(path) {
  const response = await fetch(new URL(path, document.baseURI));
  if (!response.ok) throw new Error('Datei nicht verfügbar');
  return response.json();
}

function localDateString(date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')].join('-');
}
function isDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const date = new Date(value + 'T12:00:00Z');
  return Number.isFinite(date.valueOf()) && date.toISOString().startsWith(value);
}
function normalize(value) {
  return String(value).toLocaleLowerCase('de').normalize('NFKD').replace(/\p{M}/gu, '').trim();
}

function getState() {
  const query = new URLSearchParams(location.search);
  const view = query.get('ansicht');
  const period = query.get('zeitraum');
  const page = Number(query.get('seite'));
  return {
    ansicht: views.includes(view) ? view : 'aktuell',
    bereich: sections.has(query.get('bereich')) ? query.get('bereich') : '',
    thema: topics.has(query.get('thema')) ? query.get('thema') : '',
    zeitraum: periods.some(([value]) => value === period) ? period : '',
    von: period === 'frei' && isDate(query.get('von')) ? query.get('von') : '',
    bis: period === 'frei' && isDate(query.get('bis')) ? query.get('bis') : '',
    suche: query.get('suche') || '',
    seite: Number.isSafeInteger(page) && page > 1 ? page : '',
    layout: query.get('layout') === 'karten' ? 'karten' : '',
    sortierung: query.get('sortierung') === 'aufsteigend' ? 'aufsteigend' : '',
    id: query.get('id') || '',
    rueckweg: ['aktuell', 'archiv', 'themen'].includes(query.get('rueckweg')) ? query.get('rueckweg') : ''
  };
}

function selectField(label, name, options, value, placeholder) {
  const choices = [['', placeholder], ...options];
  return `<label class="field select-field"><span class="field-label">${esc(label)}</span><span class="input-wrap">
    <select name="${name}">${choices.map(([id, text]) => `<option value="${esc(id)}" ${id === value ? 'selected' : ''}>${esc(text)}</option>`).join('')}</select>
    ${icon('chevron')}</span></label>`;
}
function filterForm(state) {
  return `<form class="filterbar" role="search" aria-label="Meldungen suchen und filtern">
    <label class="field search-field"><span class="field-label">Suche</span><span class="input-wrap">${icon('search')}
    <input type="search" name="suche" placeholder="${countLabel(items.length)} durchsuchen" value="${esc(state.suche)}" autocomplete="off"></span></label>
    ${selectField('Bereich', 'bereich', profile.sections.map(section => [section.id, section.label]), state.bereich, 'Alle Bereiche')}
    ${selectField('Thema', 'thema', profile.topics.map(topic => [topic.id, topic.label]), state.thema, 'Alle Themen')}
    ${selectField('Zeitraum', 'zeitraum', periods, state.zeitraum, 'Gesamter Zeitraum')}
    <div class="date-fields" ${state.zeitraum === 'frei' ? '' : 'hidden'}>
      <label class="field"><span class="field-label">Von</span><span class="input-wrap"><input type="date" name="von" value="${esc(state.von)}"></span></label>
      <label class="field"><span class="field-label">Bis</span><span class="input-wrap"><input type="date" name="bis" value="${esc(state.bis)}"></span></label>
    </div></form>
    <div id="filter-feedback"></div>`;
}
const emptyFilters = {bereich: '', thema: '', zeitraum: '', von: '', bis: '', suche: '', seite: ''};

function filterFeedback(state) {
  const entries = [
    ['suche', state.suche.trim() && 'Suche „' + state.suche.trim() + '“'],
    ['bereich', sections.get(state.bereich)?.label],
    ['thema', topics.get(state.thema)?.label],
    ['zeitraum', state.zeitraum === 'frei' && (state.von || state.bis)
      ? [state.von && 'Ab ' + fullDate(state.von), state.bis && 'bis ' + fullDate(state.bis)].filter(Boolean).join(' ')
      : periods.find(([value]) => value === state.zeitraum)?.[1]]
  ].filter(([, label]) => label);
  if (!entries.length) return '';
  return `<div class="active-filters" aria-label="Aktive Filter">${entries.map(([key, label]) => {
    const target = {...state, [key]: '', seite: ''};
    if (key === 'zeitraum') Object.assign(target, {von: '', bis: ''});
    return internal(esc(label) + ' ' + icon('close'), target, 'filter-chip', 'aria-label="' + esc(label) + ' entfernen"');
  }).join('')} ${internal('Alle löschen', {...state, ...emptyFilters}, 'reset-link')}</div>`;
}

function matches(state) {
  const today = new Date();
  const todayValue = localDateString(today);
  let earliest = state.von, latest = state.bis;
  if (state.zeitraum === 'jahr') {
    earliest = today.getFullYear() + '-01-01';
    latest = todayValue;
  }
  if (['30', '90'].includes(state.zeitraum)) {
    today.setDate(today.getDate() - Number(state.zeitraum) + 1);
    earliest = localDateString(today);
    latest = todayValue;
  }
  const terms = normalize(state.suche).split(/\s+/).filter(Boolean);
  return items.filter(item => {
    if (state.bereich && item.section !== state.bereich) return false;
    if (state.thema && !item.topics.includes(state.thema)) return false;
    if ((earliest && item.date < earliest) || (latest && item.date > latest)) return false;
    if (!terms.length) return true;
    const searchable = normalize([item.title, item.summary, item.body, item.source?.name,
      sections.get(item.section)?.label, ...item.topics.map(id => topics.get(id)?.label)].join(' '));
    return terms.every(term => searchable.includes(term));
  });
}
function countLabel(count) {
  return count + (count === 1 ? ' Meldung' : ' Meldungen');
}
function cards(list, state, layout = 'card-grid') {
  return `<div class="${layout}">${list.map(item => newsCard(item, state, topics)).join('')}</div>`;
}
function emptyState(state) {
  if (!items.length) return '<div class="empty-state"><h2>Noch keine Meldungen</h2><p>Hier erscheinen die ersten Beiträge der Redaktion.</p></div>';
  return `<div class="empty-state"><h2>Keine passende Meldung gefunden</h2><p>Ändere den Suchbegriff oder entferne einen Filter.</p>
    ${internal('Alle Filter zurücksetzen', {...state, ...emptyFilters}, 'button')}</div>`;
}
function groupedFeed(list, state) {
  return profile.sections.map(section => {
    const records = list.filter(item => item.section === section.id);
    if (!records.length) return '';
    const sectionTitle = esc(section.label);
    return `<section class="news-section"><div class="section-heading"><h2>${sectionTitle}</h2>
      ${internal('Alle ansehen ' + icon('arrow'), {...state, ansicht: 'archiv', bereich: section.id, seite: ''}, 'more-link', 'aria-label="Alle Meldungen aus ' + sectionTitle + ' ansehen"')}</div>
      ${cards(records.slice(0, 3), state)}</section>`;
  }).join('');
}
function archiveTools(state, count) {
  const reverse = state.sortierung === 'aufsteigend';
  return `<div class="archive-tools"><p class="result-count" role="status">${countLabel(count)}</p>
    <div class="archive-actions">${internal(reverse ? 'Älteste zuerst ↑' : 'Neueste zuerst ↓',
      {...state, sortierung: reverse ? '' : 'aufsteigend', seite: ''}, 'sort-link')}
    <div class="view-switch" role="group" aria-label="Darstellung">
    ${[['', 'Liste', 'list'], ['karten', 'Karten', 'grid']].map(([layout, label, glyph]) =>
      internal(icon(glyph) + ' ' + label, {...state, layout}, 'view-option',
        state.layout === layout ? 'aria-current="true"' : '')).join('')}
    </div></div></div>`;
}
function archive(list, state) {
  const lastPage = Math.ceil(list.length / pageSize);
  const page = Math.min(state.seite || 1, lastPage);
  const start = (page - 1) * pageSize;
  const sorted = state.sortierung === 'aufsteigend' ? [...list].reverse() : list;
  const navigation = lastPage > 1 ? `<nav class="pagination" aria-label="Archivseiten">
    ${page > 1 ? internal(icon('back') + ' Zurück', {...state, seite: page - 1 === 1 ? '' : page - 1}, 'page-link') : ''}
    <span>Seite ${page} von ${lastPage}</span>
    ${page < lastPage ? internal('Weiter ' + icon('arrow'), {...state, seite: page + 1}, 'page-link') : ''}
    </nav>` : '';
  return archiveTools(state, sorted.length) + cards(sorted.slice(start, start + pageSize), state,
    state.layout === 'karten' ? 'card-grid' : 'archive-list') + navigation;
}

function updateResults(state) {
  const form = main.querySelector('.filterbar');
  const filtered = Boolean(state.suche.trim() || state.bereich || state.thema || state.zeitraum);
  form.elements.suche.placeholder = filtered ? 'Meldungen durchsuchen' : countLabel(items.length) + ' durchsuchen';
  form.querySelector('.date-fields').hidden = state.zeitraum !== 'frei';
  main.querySelector('#filter-feedback').innerHTML = filterFeedback(state);
  const output = main.querySelector('#results');
  if (state.von && state.bis && state.von > state.bis) {
    output.innerHTML = '<p class="empty-state" role="alert">Das Enddatum muss am Startdatum oder danach liegen.</p>';
    return;
  }
  const list = matches(state);
  if (!list.length) {
    output.innerHTML = `<p class="result-count" role="status">0 Meldungen</p>${emptyState(state)}`;
    return;
  }
  output.innerHTML = state.ansicht === 'archiv' ? archive(list, state) :
    `<p class="${filtered ? '' : 'sr-only '}result-count" role="status">${countLabel(list.length)}</p>${groupedFeed(list, state)}`;
}

function topicsPage(state) {
  const topic = topics.get(state.thema);
  if (!topic) {
    return hero({view: 'themen', title: 'Themen', intro: 'Wähle ein Thema und entdecke die neuesten Meldungen.'}) +
      `<div class="wrap main-content">${topicCards(profile, items)}</div>`;
  }
  const list = items.filter(item => item.topics.includes(topic.id));
  return hero({view: 'thema', kicker: 'Thema', title: topic.label, intro: topic.description}) +
    `<div class="wrap main-content">
      ${internal(icon('back') + ' Alle Themen', {ansicht: 'themen'}, 'back-link')}
      <section class="news-section"><div class="section-heading"><h2>Neueste Meldungen</h2></div>
      ${list.length ? cards(list.slice(0, 3), state) : '<p>Zu diesem Thema gibt es noch keine Meldungen.</p>'}
      ${list.length ? `<div class="topic-actions">${internal('Alle Meldungen zu diesem Thema ' + icon('arrow'), {ansicht: 'archiv', thema: topic.id}, 'button')}</div>` : ''}
      </section></div>`;
}

function paragraphs(value) {
  const entries = Array.isArray(value) ? value : String(value || '').split(/\n\s*\n/);
  return entries.filter(Boolean).map(text => '<p>' + esc(text) + '</p>').join('');
}
function detailPage(state) {
  const item = items.find(record => record.id === state.id);
  const back = {...state, ansicht: state.rueckweg || 'archiv', rueckweg: '', id: ''};
  const label = {archiv: 'Alle Meldungen', aktuell: 'Aktuell',
    themen: topics.get(state.thema)?.label || 'Themen'}[back.ansicht];
  const backLink = internal(icon('back') + ' ' + esc(label), back, 'back-link');
  if (!item) {
    return `<div class="wrap main-content"><div class="empty-state"><h1>Meldung nicht gefunden</h1>${backLink}</div></div>`;
  }
  return `<div class="wrap main-content detail-wrap">${backLink}
    <article class="detail-article"><div class="detail-meta">
      ${sourceIdentity(item.source)}<time datetime="${esc(item.date)}">${esc(fullDate(item.date))}</time></div>
      <p class="eyebrow">${esc(sections.get(item.section)?.label)}</p>
      <h1>${esc(item.title)}</h1><p class="detail-lead">${esc(item.summary)}</p>
      <div class="detail-body">${paragraphs(item.body)}</div>
      ${tags(item, topics)}<div class="detail-source">${sourceLink(item.source, 'Zur Originalquelle', 'button')}</div>
    </article></div>`;
}

function aboutPage() {
  return hero({view: 'ueber', title: 'Über ' + profile.name}) +
    `<div class="wrap main-content"><section class="about-panel"><h2>Das Angebot</h2>
      ${paragraphs(profile.about)}${profile.publisher ? `<h2>Herausgeber</h2><p>${esc(profile.publisher)}</p>` : ''}
      ${profile.links?.website ? sourceLink({url: profile.links.website}, 'Zur Website', 'button') : ''}
    </section></div>`;
}
function render() {
  const state = getState();
  const view = state.ansicht;
  const item = view === 'meldung' ? items.find(record => record.id === state.id) : undefined;
  const titles = {aktuell: 'Aktuell', archiv: 'Alle Meldungen', themen: topics.get(state.thema)?.label || 'Themen',
    meldung: item?.title || 'Meldung', ueber: 'Über die Website'};
  document.title = titles[view] + ' | ' + profile.name;
  const description = item?.summary || (view === 'themen' && topics.get(state.thema)?.description) || profile.intro || profile.name;
  document.querySelector('meta[name="description"]').content = description;
  document.querySelector('#masthead').innerHTML = header(profile, view === 'meldung' ? (state.rueckweg || 'archiv') : view);
  document.querySelector('#colophon').innerHTML = footer(profile);
  if (view === 'aktuell' || view === 'archiv') {
    const intro = view === 'aktuell' ? {kicker: profile.kicker, title: profile.headline, highlight: profile.highlight, intro: profile.intro}
      : {title: 'Alle Meldungen', intro: 'Alle Beiträge nach Datum, Bereich und Thema durchsuchen.'};
    main.innerHTML = hero({view, ...intro}) + `<div class="wrap main-content">${filterForm(state)}<div id="results"></div></div>`;
    updateResults(state);
  } else if (view === 'themen') {
    main.innerHTML = topicsPage(state);
  } else if (view === 'meldung') {
    main.innerHTML = detailPage(state);
  } else {
    main.innerHTML = aboutPage();
  }
}

function rememberPosition() {
  history.replaceState({...history.state, top: scrollY}, '', location.href);
}
function navigate(url, targetFocus) {
  rememberPosition();
  history.pushState({top: 0}, '', url);
  editingSearch = false;
  render();
  const target = targetFocus && main.querySelector(targetFocus);
  if (target) {
    target.tabIndex = -1;
    target.focus();
  } else {
    main.focus({preventScroll: true});
    window.scrollTo(0, 0);
  }
}
document.addEventListener('click', event => {
  const link = event.target.closest('a[data-route]');
  if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey ||
      event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  const focus = link.closest('.pagination, .archive-tools') ? '.archive-tools' :
    link.closest('.active-filters') ? '[name="suche"]' : '';
  navigate(link.href, focus);
});
window.addEventListener('popstate', () => {
  if (!profile) return;
  editingSearch = false;
  render();
  window.scrollTo(0, history.state?.top || 0);
});
function updateFilters(form, isTyping) {
  const values = new FormData(form);
  const state = {...getState(), ...Object.fromEntries(values), seite: ''};
  if (state.zeitraum !== 'frei') {
    state.von = '';
    state.bis = '';
    form.elements.von.value = '';
    form.elements.bis.value = '';
  }
  const target = route(state);
  if (target !== location.pathname + location.search) {
    const position = {top: scrollY};
    if (isTyping && editingSearch) history.replaceState(position, '', target);
    else {
      rememberPosition();
      history.pushState(position, '', target);
    }
  }
  editingSearch = isTyping;
  updateResults(state);
}
main.addEventListener('input', event => {
  if (event.target.name === 'suche') updateFilters(event.target.form, true);
});
main.addEventListener('change', event => {
  if (event.target.form?.matches('.filterbar') && event.target.name !== 'suche') updateFilters(event.target.form, false);
});
main.addEventListener('focusout', event => {
  if (event.target.name === 'suche') editingSearch = false;
});
main.addEventListener('submit', event => {
  if (!event.target.matches('.filterbar')) return;
  event.preventDefault();
  updateFilters(event.target, false);
});

function feedIssue(records) {
  if (!Array.isArray(records)) return 'Die Feeddatei muss eine JSON-Liste mit Meldungen enthalten.';
  const ids = new Set();
  for (const [index, item] of records.entries()) {
    const entry = item?.id ? 'Meldung „' + item.id + '“' : 'Eintrag ' + (index + 1);
    if (!item || typeof item.id !== 'string' || !item.id.trim() || ids.has(item.id)) {
      return entry + ' braucht eine eindeutige, dauerhafte Kennung im Feld id.';
    }
    ids.add(item.id);
    if (typeof item.title !== 'string' || !item.title.trim()) return entry + ' braucht einen Titel.';
    if (!isDate(item.date)) return entry + ' braucht im Feld date ein gültiges Datum im Format JJJJ-MM-TT.';
    if (!sections.has(item.section)) return entry + ' braucht im Feld section eine Bereichskennung aus dem Profil.';
    if (!Array.isArray(item.topics) || item.topics.some(id => !topics.has(id))) return entry + ' braucht im Feld topics eine Liste mit Themenkennungen.';
    if (!item.source?.name || !webUrl(item.source.url)) return entry + ' braucht eine Originalquelle mit Name und Webadresse.';
  }
  return '';
}

function showLoadError(message) {
  profile = undefined;
  main.innerHTML = `<div class="wrap main-content"><h1>Der Feed konnte nicht geladen werden</h1><p>${esc(message)}</p></div>`;
}

async function start() {
  const site = await readJson('site.json');
  const requested = new URLSearchParams(location.search).get('profil');
  const key = requested && Object.hasOwn(site.profiles, requested) ? requested : site.defaultProfile;
  profile = await readJson(site.profiles[key]);
  sections = new Map(profile.sections.map(section => [section.id, section]));
  topics = new Map(profile.topics.map(topic => [topic.id, topic]));
  items = await readJson(profile.feed);
  const issue = feedIssue(items);
  if (issue) return showLoadError(issue);
  items.sort((left, right) => right.date.localeCompare(left.date) || left.id.localeCompare(right.id));
  const theme = profile.theme || {};
  document.documentElement.dataset.style = theme.style || 'journal';
  document.body.dataset.style = document.documentElement.dataset.style;
  document.documentElement.dataset.artwork = theme.artwork || '';
  for (const token of ['primary', 'accent', 'tint', 'ink']) {
    if (theme[token] && CSS.supports('color', theme[token])) document.documentElement.style.setProperty('--' + token, theme[token]);
  }
  if (theme.primary) document.querySelector('meta[name="theme-color"]').content = theme.primary;
  if (webUrl(profile.logo)) document.querySelector('#site-icon').href = webUrl(profile.logo);
  history.scrollRestoration = 'manual';
  render();
}
start().catch(() => showLoadError('Prüfe den Zugriff auf Profil und Feeddatei und lade die Seite erneut.'));
