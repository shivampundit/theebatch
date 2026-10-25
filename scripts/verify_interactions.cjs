// Exercise page startup and stateful workflows without a browser.
// Visual layout and native dialog rendering still need browser QA.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const { webcrypto, pbkdf2Sync, createCipheriv, randomBytes } = require("node:crypto");
const code = fs.readFileSync("js/app.js", "utf8");
const dataCode = fs.readFileSync("data/portal-data.js", "utf8");
const storage = new Map();
const session = new Map();
const store = map => ({ getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value) });
const fixturePassword = "test-only-shared-phrase";
const salt = randomBytes(16);
const iv = randomBytes(12);
const iterations = 100000;
const fixtureCipher = createCipheriv("aes-256-gcm", pbkdf2Sync(fixturePassword, salt, iterations, 32, "sha256"), iv);
const fixtureBody = JSON.stringify({ photos: Array.from({length: 6}, (_, index) => ({ mime: "image/jpeg", caption: "Private frame " + index, data: Buffer.from([255,216,255,217]).toString("base64") })) });
const fixtureEncrypted = Buffer.concat([fixtureCipher.update(fixtureBody), fixtureCipher.final(), fixtureCipher.getAuthTag()]);
const fixtureEnvelope = { version: 1, iterations, salt: salt.toString("base64"), iv: iv.toString("base64"), ciphertext: fixtureEncrypted.toString("base64") };

function boot(file, query = "", options = {}) {
  const html = fs.readFileSync(file, "utf8");
  const elements = [];
  const docListeners = {};
  const windowListeners = {};
  const livePhotoUrls = new Set();
  class BrowserURL extends URL {
    static createObjectURL(blob) { const url = URL.createObjectURL(blob); livePhotoUrls.add(url); return url; }
    static revokeObjectURL(url) { livePhotoUrls.delete(url); URL.revokeObjectURL(url); }
  }
  let focused;
  let copied;
  const audioStats = { contexts: 0, notes: 0, stops: 0 };
  class Element {
    constructor(attrs = {}, tag = "div") {
      this.attrs = attrs; this.tag = tag; this.dataset = {};
      for (const [name, value] of Object.entries(attrs)) if (name.startsWith("data-")) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, char) => char.toUpperCase())] = value;
      this.value = attrs.value || (attrs.id === "sessionMonth" ? "all" : attrs.id === "officerSort" ? "featured" : "");
      this.textContent = ""; this.innerHTML = ""; this.listeners = {};
      this.children = new Proxy([], { get: () => ({ focus: () => { focused = this; } }) });
      this.style = { setProperty() {} };
      this.childNodes = [];
      this.classes = new Set((attrs.class || "").split(" "));
      this.classList = {
        add: name => this.classes.add(name), remove: name => this.classes.delete(name), contains: name => this.classes.has(name),
        toggle: (name, force) => { const value = force ?? !this.classes.has(name); if (value) this.classes.add(name); else this.classes.delete(name); return value; }
      };
    }
    setAttribute(key, value) { this.attrs[key] = value; }
    getAttribute(key) { return this.attrs[key]; }
    removeAttribute(key) { delete this.attrs[key]; }
    querySelector() { return this.small ||= new Element({}, "small"); }
    querySelectorAll() { return []; }
    appendChild(element) { this.childNodes.push(element); }
    replaceChildren() { this.childNodes = []; this.innerHTML = ""; }
    addEventListener(type, callback) { (this.listeners[type] ||= []).push(callback); }
    async fire(type, extra = {}) { for (const fn of this.listeners[type] || []) await fn({ target: this, preventDefault() {}, ...extra }); }
    closest(selector) { return selector.startsWith("[") && selector.slice(1,-1) in this.attrs ? this : null; }
    contains() { return false; }
    focus() { focused = this; }
    getBoundingClientRect() { return this.bounds || { top: 100, bottom: 500, left: 0, right: 1200, height: this.attrs.id === "siteHeader" ? 80 : 400 }; }
    scrollIntoView(options) { this.scrollRequest = options; }
    showModal() { this.open = true; }
    close() { this.open = false; this.fire("close"); }
    animate() {}
    click() {}
    reset() { for (const id of ["memoryAuthor", "memoryText"]) { const node = get(id); if (node) node.value = ""; } }
  }
  for (const match of html.matchAll(/<([a-z][\w-]*)\b([^>]*)>/gi)) {
    const attrs = {};
    for (const attr of match[2].matchAll(/([\w-]+)="([^"]*)"/g)) attrs[attr[1]] = attr[2];
    for (const attr of match[2].matchAll(/\b(data-[\w-]+)(?=\s|$)/g)) if (!(attr[1] in attrs)) attrs[attr[1]] = "";
    elements.push(new Element(attrs, match[1]));
  }
  const get = id => elements.find(item => item.attrs.id === id);
  const select = selector => {
    if (selector.startsWith("#")) return elements.filter(item => item.attrs.id === selector.slice(1));
    if (selector.startsWith("meta")) return elements.filter(item => item.tag === "meta" && item.attrs.name === "theme-color");
    if (selector.startsWith(".reveal")) return [];
    const attr = selector.match(/^\[([^\]]+)\]$/);
    return attr ? elements.filter(item => attr[1] in item.attrs) : [];
  };
  const body = elements.find(item => item.tag === "body");
  const document = {
    body, hidden: false, documentElement: new Element(),
    getElementById: id => get(id),
    querySelector: selector => select(selector)[0] || null,
    querySelectorAll: selector => selector.split(",").flatMap(part => select(part.trim())),
    addEventListener: (type, callback) => (docListeners[type] ||= []).push(callback),
    dispatchEvent: event => { for (const callback of docListeners[event.type] || []) callback(event); },
    createElement: tag => new Element({}, tag)
  };
  document.documentElement.scrollHeight = 2000;
  const location = new URL("https://example.test/portal/" + file.replaceAll(path.sep, "/") + query);
  class FakeAudioContext {
    constructor() { audioStats.contexts++; this.state = "running"; this.currentTime = 0; }
    createOscillator() { return { frequency: { setValueAtTime() {} }, connect() {}, disconnect() {}, start: () => { audioStats.notes++; }, stop: () => { audioStats.stops++; } }; }
    createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} }; }
    async resume() { this.state = "running"; }
    async close() { this.state = "closed"; }
  }
  const window = { matchMedia: () => ({ matches: options.reduced !== false }), scrollY: 0, innerHeight: 800, addEventListener: (type, callback) => (windowListeners[type] ||= []).push(callback), crypto: webcrypto, confirm: () => false, AudioContext: FakeAudioContext };
  const context = {
    document, window, location, navigator: { clipboard: { writeText: async value => { copied = value; } } },
    localStorage: store(storage), sessionStorage: store(session), console, URL: BrowserURL, URLSearchParams, Blob, TextEncoder, TextDecoder, atob, crypto: webcrypto,
    Image: class {}, performance: { now: () => 0 }, requestAnimationFrame() {}, setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1, clearInterval() {},
    history: { replaceState() {} }
  };
  context.CustomEvent = class { constructor(type, init) { this.type = type; this.detail = init.detail; } };
  vm.createContext(context);
  vm.runInContext(dataCode, context);
  if (options.photoTags) context.window.PORTAL_DATA.curation.photoOfficerTags = options.photoTags;
  vm.runInContext(code, context, { filename: "js/app.js" });
  if (body.dataset.page === "private") {
    context.window.ROOM508_ENVELOPE = fixtureEnvelope;
    vm.runInContext(fs.readFileSync("js/private-gallery.js", "utf8"), context, { filename: "js/private-gallery.js" });
  }
  if (body.dataset.page === "inaugurate") vm.runInContext(fs.readFileSync("js/inaugurate.js", "utf8"), context, { filename: "js/inaugurate.js" });
  return {
    get, body, document, context, elements, audioStats, livePhotoUrls,
    windowEvent: async type => { for (const callback of windowListeners[type] || []) await callback({ type }); },
    element: attrs => new Element(attrs),
    count: (id, className) => (get(id).innerHTML.match(new RegExp('class="' + className + '(?: |")', "g")) || []).length,
    dispatch: async (type, target) => { for (const fn of docListeners[type] || []) await fn({ target, preventDefault() {} }); },
    copied: () => copied
  };
}

(async () => {
  const pages = fs.readdirSync(".").filter(file => file.endsWith(".html") && !file.startsWith("sebi_grade_"));
  for (const folder of ["albums", "officers"]) pages.push(...fs.readdirSync(folder).filter(file => file.endsWith(".html")).map(file => folder + "/" + file));
  for (const file of pages) boot(file);
  console.log("PASS: shared JavaScript starts on all " + pages.length + " static documents");

  let app = boot("albums.html");
  assert.equal(app.count("albumGrid", "album-card"), 15);
  assert.doesNotMatch(app.get("albumGrid").innerHTML, /room-508/);
  await app.get("albumFilters").fire("click", { target: app.element({ "data-album-filter": "visits" }) });
  assert.equal(app.count("albumGrid", "album-card"), 6);
  app.get("albumSearch").value = "delhi";
  await app.get("albumSearch").fire("input");
  assert.equal(app.count("albumGrid", "album-card"), 1);
  assert.match(app.get("albumGrid").innerHTML, /albums\/delhi.html/);
  assert.equal(boot("activities.html").count("albumGrid", "album-card"), 5);
  console.log("PASS: album search, categories, and dedicated collection pages");
  assert.doesNotMatch(boot("index.html").get("homeAlbums").innerHTML, /room-508/);
  assert.equal(boot("albums/room-508.html").get("albumPhotos"), undefined);
  console.log("PASS: Room 508 is absent from public albums, homepage features, and legacy photo URLs");

  app = boot("yearbook.html");
  assert.equal(app.count("officerGrid", "officer-card"), 20);
  const featuredOrder = [101, 114, 23, 45, 112, 20, 31, 24, 113];
  const displayed = [...app.get("officerGrid").innerHTML.matchAll(/href="officers\/(\d+)-/g)].map(match => Number(match[1]));
  assert.deepEqual(displayed.slice(0, 9), featuredOrder);
  for (const [alias, number] of [["venkateswara", 45], ["divy rawal", 31], ["bhabesh", 24], ["subhrojit", 113]]) {
    app.get("officerSearch").value = alias;
    await app.get("officerSearch").fire("input");
    assert.equal(app.count("officerGrid", "officer-card"), 1);
    assert.match(app.get("officerGrid").innerHTML, new RegExp("officers/" + String(number).padStart(3, "0") + "-"));
  }
  app.get("officerSearch").value = "Aaditya";
  await app.get("officerSearch").fire("input");
  assert.equal(app.count("officerGrid", "officer-card"), 1);
  assert.match(app.get("officerGrid").innerHTML, /officers\/001-aaditya-kumar.html/);
  await app.get("officerReset").fire("click");
  app.get("officerSort").value = "name";
  await app.get("officerSort").fire("change");
  for (let index = 0; index < 6; index++) await app.get("officerMore").fire("click");
  assert.equal(app.count("officerGrid", "officer-card"), 130);
  console.log("PASS: yearbook search, sorting, and all 130 profile links");
  const home = boot("index.html");
  for (const number of featuredOrder) assert.match(home.get("portraitMosaic").innerHTML, new RegExp("officers/" + String(number).padStart(3, "0") + "-"));
  const curated = boot("albums/delhi.html", "", { photoTags: { "media/albums/delhi/03.jpg": [101] } });
  await curated.get("startSlideshow").fire("click");
  assert.match(curated.get("lightboxImage").src, /03.jpg$/);
  await curated.elements.find(item => "data-lightbox-next" in item.attrs).fire("click");
  assert.match(curated.get("lightboxImage").src, /01.jpg$/);
  console.log("PASS: nine featured officers, spelling aliases, verified-tag priority, stable original photo indices");

  app = boot("classroom.html");
  assert.equal(app.count("sessionList", "session-row"), 12);
  app.get("sessionMonth").value = "Aug";
  await app.get("sessionMonth").fire("change");
  assert.ok(app.get("sessionList").innerHTML.includes("Aug"));
  app.get("classroomSearch").value = "not-a-real-session";
  await app.get("classroomSearch").fire("input");
  assert.match(app.get("sessionList").innerHTML, /No matching records/);
  assert.equal(boot("speakers.html").count("speakerGrid", "speaker-card"), 12);
  console.log("PASS: classroom month filter, empty state, and speaker page");

  app = boot("albums/delhi.html", "?photo=2");
  assert.equal(app.get("lightbox").open, true);
  assert.match(app.get("lightboxImage").src, /\.\.\/media\/albums\/delhi\/02.jpg/);
  await app.get("sharePhoto").fire("click");
  assert.equal(app.copied(), "https://example.test/portal/albums/delhi.html?photo=2");
  await app.get("saveCurrentPhoto").fire("click");
  assert.deepEqual(JSON.parse(storage.get("batch-2025-26-saved-photos")), ["delhi:1"]);
  assert.equal(boot("saved.html").count("savedPhotos", "photo-tile"), 1);
  await app.get("slidePlay").fire("click");
  assert.equal(app.get("slidePlay").attrs["aria-pressed"], "true");
  await app.elements.find(item => "data-close-lightbox" in item.attrs).fire("click");
  assert.equal(app.get("slidePlay").attrs["aria-pressed"], "false");
  await app.get("layoutToggle").fire("click");
  assert.equal(app.get("albumPhotos").classList.contains("photo-grid--masonry"), true);
  console.log("PASS: nested photo URLs, sharing, saved photos, slideshow stop, masonry switch");

  const original = { author: "Batchmate", text: "An existing memory.", date: "25 Oct 2026" };
  storage.set("batch-2025-26-device-journal", JSON.stringify([original]));
  session.set("batch-vault-open", "yes");
  app = boot("private.html");
  assert.equal(app.get("vaultContent").classList.contains("is-hidden"), true);
  assert.equal(app.get("privatePhotos").innerHTML, "");
  app.get("vaultPassphrase").value = "incorrect";
  await app.get("vaultGate").fire("submit");
  assert.equal(app.get("privatePhotos").innerHTML, "");
  assert.equal(app.get("vaultContent").classList.contains("is-hidden"), true);
  app.get("vaultPassphrase").value = fixturePassword;
  await app.get("vaultGate").fire("submit");
  assert.equal(app.get("vaultContent").classList.contains("is-hidden"), false);
  assert.match(app.get("memoryList").innerHTML, /An existing memory/);
  assert.equal(app.count("privatePhotos", "private-photo"), 6);
  assert.equal(app.livePhotoUrls.size, 6);
  await app.get("privatePhotos").fire("click", { target: app.element({ "data-private-photo": "0" }) });
  assert.equal(app.get("privatePhotoViewer").open, true);
  await app.get("privatePhotoClose").fire("click");
  app.get("memoryAuthor").value = "Another batchmate";
  app.get("memoryText").value = "<img src=x onerror=alert(1)> Safe text.";
  await app.get("memoryForm").fire("submit");
  assert.match(app.get("memoryList").innerHTML, /&lt;img/);
  assert.equal(JSON.parse(storage.get("batch-2025-26-device-journal")).length, 2);
  const restored = { author: "From backup", text: "A restored memory.", date: "24 Oct 2026" };
  app.get("journalFile").files = [{ size: 200, text: async () => JSON.stringify([original, restored]) }];
  await app.get("journalFile").fire("change");
  assert.equal(JSON.parse(storage.get("batch-2025-26-device-journal")).length, 3);
  await app.get("lockVault").fire("click");
  assert.equal(app.get("privatePhotos").innerHTML, "");
  assert.equal(app.livePhotoUrls.size, 0);
  assert.equal(app.get("vaultContent").classList.contains("is-hidden"), true);
  assert.equal(boot("private.html").get("privatePhotos").innerHTML, "");
  app.get("vaultPassphrase").value = fixturePassword;
  await app.get("vaultGate").fire("submit");
  await app.windowEvent("pagehide");
  assert.equal(app.livePhotoUrls.size, 0);
  assert.equal(app.get("vaultContent").classList.contains("is-hidden"), true);
  await app.get("journalFile").fire("change");
  assert.equal(JSON.parse(storage.get("batch-2025-26-device-journal")).length, 3);
  await app.get("themeToggle").fire("click");
  assert.equal(boot("index.html").body.classList.contains("dark"), true);
  console.log("PASS: original journal preserved, unlock, escaped notes, backup merge, theme across pages");

  app = boot("inaugurate.html");
  assert.equal(app.audioStats.contexts, 0);
  const lamps = app.elements.filter(item => "data-diya" in item.attrs);
  await lamps[0].fire("click");
  assert.equal(app.audioStats.contexts, 1);
  assert.equal(app.audioStats.notes, 1);
  assert.equal(lamps[0].attrs["aria-pressed"], "true");
  await lamps[0].fire("click");
  assert.equal(app.audioStats.notes, 1);
  await app.get("ceremonySound").fire("click");
  assert.equal(app.get("ceremonySound").attrs["aria-pressed"], "false");
  app.get("ceremonyWorkbench").bounds = { top: -200, bottom: 300, height: 500 };
  await app.get("ribbonCut").fire("click");
  assert.equal(app.get("ceremonyWorkbench").scrollRequest.block, "start");
  assert.equal(app.get("ceremonyWorkbench").scrollRequest.behavior, "instant");
  assert.equal(app.get("ceremonyStage").classList.contains("is-open"), true);
  assert.equal(app.get("ceremonyReveal").attrs["aria-hidden"], "false");
  assert.ok(!("inert" in app.get("ceremonyReveal").attrs));
  assert.equal(app.get("inaugurateLaunch").disabled, true);
  assert.equal(app.get("ribbonCut").disabled, true);
  assert.equal(app.audioStats.notes, 1);
  assert.ok(lamps.every(lamp => lamp.attrs["aria-pressed"] === "true"));
  await app.get("inaugurateReplay").fire("click");
  assert.equal(app.get("ceremonyStage").classList.contains("is-open"), false);
  assert.equal(app.get("ceremonyReveal").attrs["aria-hidden"], "true");
  assert.equal(app.get("inaugurateLaunch").disabled, false);
  assert.equal(app.get("ribbonCut").disabled, false);
  await app.get("ceremonySound").fire("click");
  app.get("ceremonyWorkbench").scrollRequest = null;
  app.get("ceremonyWorkbench").bounds = { top: 100, bottom: 600, height: 500 };
  await app.get("inaugurateLaunch").fire("click");
  assert.equal(app.get("ceremonyWorkbench").scrollRequest, null);
  assert.equal(app.audioStats.contexts, 1);
  assert.equal(app.audioStats.notes, 7);
  assert.equal(app.context.location.pathname, "/portal/inaugurate.html");
  console.log("PASS: reveal stays in view, lamp lighting, mute, ribbon reveal, replay, reused audio context, no forced redirect");

  storage.set("batch-archive-pause-motion", "false");
  app = boot("inaugurate.html", "", { reduced: false });
  await app.get("inaugurateLaunch").fire("click");
  assert.equal(app.get("ceremonyConfetti").childNodes.length, 36);
  await app.get("motionToggle").fire("click");
  assert.equal(app.body.classList.contains("motion-paused"), true);
  assert.equal(app.get("ceremonyConfetti").childNodes.length, 0);
  assert.equal(app.get("ceremonyReveal").attrs["aria-hidden"], "false");
  assert.equal(boot("index.html", "", { reduced: false }).body.classList.contains("motion-paused"), true);
  console.log("PASS: bounded confetti, pause-motion control, immediate accessible reveal, preference across pages");
})().catch(error => { console.error(error); process.exitCode = 1; });
