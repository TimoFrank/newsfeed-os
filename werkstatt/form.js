const form = document.querySelector('#editor');
const field = name => form.elements.namedItem(name);
const statusLine = document.querySelector('#status');
const previewLink = document.querySelector('#open-preview');
const frame = document.querySelector('#frame');
const submitters = [...form.querySelectorAll('button')];
let catalog;
let selectionVersion = 0;

async function readJSON(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error('Das Ausgangsprofil konnte nicht geladen werden.');
  return response.json();
}
async function loadProfile() {
  const version = ++selectionVersion;
  const profile = await readJSON('/' + catalog.profiles[field('basis').value]);
  if (version !== selectionVersion) return;
  for (const key of ['name','kicker','headline','highlight','intro','publisher','about']) field(key).value = profile[key] || '';
  for (const key of ['style','artwork','primary','accent','tint','ink']) field(key).value = profile.theme[key] || '';
  for (const key of ['website','newsletter','impressum','datenschutz']) field(key).value = profile.links?.[key] || '';
  for (const key of ['sections','topics']) field(key).value = profile[key].map(item => item.label).join('\n');
  field('keepLogo').checked = Boolean(profile.logo);
  field('wordmark').checked = profile.logoMode === 'wordmark';
  field('includeNews').checked = true;
  field('logo').value = '';
  await send('vorschau');
}
async function attachment(file) {
  if (!file?.size) return '';
  if (file.size > 2000000) throw new Error('Das Logo darf höchstens 2 MB haben.');
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Das Logo konnte nicht gelesen werden.'));
    reader.readAsDataURL(file);
  });
}
async function send(action) {
  const data = Object.fromEntries(new FormData(form));
  delete data.logo;
  for (const key of ['keepLogo', 'wordmark', 'includeNews']) data[key] = field(key).checked;
  submitters.forEach(button => button.disabled = true);
  try {
    data.image = await attachment(field('logo').files[0]);
    const response = await fetch(action, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data)});
    if (!response.ok) throw new Error((await response.json()).error || 'Die Ausgabe konnte nicht erstellt werden.');
    if (action === 'vorschau') {
      const {url} = await response.json();
      frame.src = url;
      previewLink.href = url;
      previewLink.hidden = false;
      statusLine.textContent = 'Die Vorschau zeigt deine aktuelle Auswahl.';
    } else {
      const link = document.createElement('a');
      const fileURL = URL.createObjectURL(await response.blob());
      link.href = fileURL;
      link.download = response.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] || 'ausgabe.zip';
      link.click();
      setTimeout(() => URL.revokeObjectURL(fileURL), 30000);
      statusLine.textContent = 'Das Websitepaket ist bereit zum Herunterladen.';
    }
  } catch (error) {statusLine.textContent = error.message;}
  finally {submitters.forEach(button => button.disabled = false);}
}
form.addEventListener('submit', event => {
  event.preventDefault();
  send(event.submitter?.value || 'vorschau');
});
field('basis').addEventListener('change', () => loadProfile().catch(error => statusLine.textContent = error.message));
(async () => {
  catalog = await readJSON('/site.json');
  for (const [id, path] of Object.entries(catalog.profiles)) {
    const profile = await readJSON('/' + path);
    field('basis').add(new Option(profile.name, id));
  }
  field('basis').value = catalog.defaultProfile;
  await loadProfile();
})().catch(error => statusLine.textContent = error.message);
