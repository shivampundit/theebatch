const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");

(async () => {
  const scope = "https://example.test/portal/";
  const maps = new Map([["batch-2025-26-v1", new Map()], ["batch-2025-26-v5", new Map([["old-private-copy", new Response("retired plaintext")]])], ["unrelated-cache", new Map()]]);
  const handlers = {};
  let online = true;
  const keyOf = request => typeof request === "string" ? request : request.url;
  const caches = {
    keys: async () => [...maps.keys()],
    delete: async key => maps.delete(key),
    open: async key => {
      if (!maps.has(key)) maps.set(key, new Map());
      const map = maps.get(key);
      return {
        match: async request => map.get(keyOf(request))?.clone(),
        put: async (request, response) => map.set(keyOf(request), response.clone()),
        addAll: async paths => {
          for (const item of paths) {
            const relative = item === "./" ? "index.html" : item.replace(/^\.\//, "");
            assert.ok(fs.existsSync(relative), "Missing cache shell resource " + relative);
            const text = relative.endsWith(".html") ? fs.readFileSync(relative, "utf8") : "cached resource";
            map.set(new URL(item, scope).href, new Response(text));
          }
        }
      };
    }
  };
  const context = {
    URL, Response, caches,
    fetch: async () => { if (!online) throw new Error("offline"); return new Response("fresh response"); },
    self: { location: { origin: "https://example.test" }, registration: { scope }, skipWaiting() {}, clients: { claim() {} }, addEventListener: (type, fn) => { handlers[type] = fn; } }
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync("sw.js", "utf8"), context);
  const lifecycle = async type => {
    const tasks = [];
    handlers[type]({ waitUntil: task => tasks.push(task) });
    await Promise.all(tasks);
  };
  const request = async (relative, mode = "cors") => {
    const tasks = [];
    let promise;
    handlers.fetch({ request: { method: "GET", url: new URL(relative, scope).href, mode }, respondWith: value => { promise = value; }, waitUntil: task => tasks.push(task) });
    const result = await promise;
    await Promise.all(tasks);
    return result;
  };
  await lifecycle("install");
  assert.equal(await (await request("css/styles.css")).text(), "fresh response");
  online = false;
  assert.equal(await (await request("css/styles.css")).text(), "fresh response");
  assert.match(await (await request("yearbook.html", "navigate")).text(), /officerGrid/);
  const cache = await caches.open("batch-2025-26-v6");
  await cache.put(scope + "albums/delhi.html", new Response("cached Delhi album"));
  assert.equal(await (await request("albums/delhi.html?photo=2", "navigate")).text(), "cached Delhi album");
  const fallback = await (await request("albums/not-visited.html", "navigate")).text();
  assert.match(fallback, /<base href="https:\/\/example.test\/portal\/">/);
  assert.match(fallback, /This page has not been saved yet/);
  await cache.put(scope + "media/photo.jpg", new Response("cached photo"));
  assert.equal(await (await request("media/photo.jpg")).text(), "cached photo");
  await lifecycle("activate");
  assert.equal(maps.has("batch-2025-26-v1"), false);
  assert.equal(maps.has("batch-2025-26-v5"), false);
  assert.equal(maps.has("unrelated-cache"), true);
  console.log("PASS: complete shell, fresh online assets, offline documents, photo-query URLs, fallback paths, scoped cache cleanup");
})().catch(error => { console.error(error); process.exitCode = 1; });
