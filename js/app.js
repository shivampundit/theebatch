(() => {
  "use strict";
  const data = window.PORTAL_DATA || { officers: [], sessions: [], featuredSpeakers: [], albums: [] };
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const root = document.body.dataset.root || "";
  const page = document.body.dataset.page || "home";
  const asset = path => root + path;
  const escape = (value = "") => String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
  const slugify = value => String(value).normalize("NFKD").replace(/[^\x00-\x7F]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const categories = { milestones: "Milestones", visits: "Visits & attachments", activities: "Beyond the classroom", everyday: "Batch life" };
  const albumUrl = album => asset("albums/" + album.slug + ".html");
  const officerUrl = officer => asset("officers/" + String(officer.number).padStart(3, "0") + "-" + slugify(officer.name) + ".html");
  const systemReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let reducedMotion = systemReducedMotion;
  const read = (key, fallback, storage = localStorage) => {
    try { return JSON.parse(storage.getItem(key)) ?? fallback; } catch { return fallback; }
  };
  const write = (key, value, storage = localStorage) => {
    try { storage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
  };
  reducedMotion = systemReducedMotion || read("batch-archive-pause-motion", false);
  document.body.classList.toggle("motion-paused", reducedMotion);
  document.documentElement.classList.toggle("motion-paused", reducedMotion);
  const featuredNumbers = data.curation?.featuredOfficerNumbers || [101, 114, 23, 45, 112, 20, 31, 24, 113];
  const featuredRank = number => { const rank = featuredNumbers.indexOf(number); return rank < 0 ? featuredNumbers.length : rank; };
  const featuredOfficers = featuredNumbers.map(number => data.officers.find(officer => officer.number === number)).filter(Boolean);
  const photoRank = path => {
    return Math.min(featuredNumbers.length, ...(data.curation?.photoOfficerTags?.[path] || []).map(featuredRank));
  };
  const orderedPhotoIndexes = album => album.photos.map((_, index) => index).sort((a, b) => photoRank(album.photos[a]) - photoRank(album.photos[b]));
  let toastTimer;
  const toast = message => {
    const box = $("#toast");
    if (!box) return;
    box.textContent = message;
    box.classList.add("is-visible");
    if ($("#lightbox")?.open) $("#lightboxStatus").textContent = message;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { box.classList.remove("is-visible"); $("#lightboxStatus").textContent = ""; }, 3500);
  };

  // Shared controls work on every root and nested document.
  const nav = $("#primaryNav");
  const navToggle = $("#navToggle");
  const activeNav = ["album", "visits", "activities", "saved"].includes(page) ? "albums" : page === "officer" ? "yearbook" : page === "speakers" ? "classroom" : page === "private-gate" ? "private" : page;
  $$("[data-nav]").forEach(link => {
    if (link.dataset.nav === activeNav) link.setAttribute("aria-current", "page");
  });
  const closeMenu = () => { nav.classList.remove("is-open"); navToggle.setAttribute("aria-expanded", "false"); };
  navToggle.addEventListener("click", () => navToggle.setAttribute("aria-expanded", String(nav.classList.toggle("is-open"))));
  document.addEventListener("click", event => { if (!$("#siteHeader").contains(event.target)) closeMenu(); });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && nav.classList.contains("is-open")) { closeMenu(); navToggle.focus(); }
  });
  const themeKey = "batch-archive-theme-v2";
  let savedTheme;
  try { savedTheme = localStorage.getItem(themeKey); } catch {}
  document.body.classList.toggle("dark", savedTheme === "dark");
  const syncTheme = () => {
    const dark = document.body.classList.contains("dark");
    $("#themeToggle").textContent = dark ? "Light mode" : "Dark mode";
    $("#themeToggle").setAttribute("aria-pressed", String(dark));
    $("#themeToggle").setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
    $('meta[name="theme-color"]').setAttribute("content", dark ? "#101827" : "#f5f7fc");
  };
  syncTheme();
  $("#themeToggle").addEventListener("click", () => {
    document.body.classList.toggle("dark");
    try { localStorage.setItem(themeKey, document.body.classList.contains("dark") ? "dark" : "light"); } catch {}
    syncTheme();
  });
  const syncMotionControl = () => {
    $("#motionToggle").textContent = systemReducedMotion ? "Reduced motion enabled" : reducedMotion ? "Resume animations" : "Pause animations";
    $("#motionToggle").setAttribute("aria-pressed", String(reducedMotion));
    $("#motionToggle").disabled = systemReducedMotion;
  };
  syncMotionControl();
  $("#motionToggle").addEventListener("click", () => {
    if (systemReducedMotion) return;
    reducedMotion = !reducedMotion;
    write("batch-archive-pause-motion", reducedMotion);
    document.body.classList.toggle("motion-paused", reducedMotion);
    document.documentElement.classList.toggle("motion-paused", reducedMotion);
    if (reducedMotion) {
      revealObserver?.disconnect();
      $$(".reveal").forEach(element => element.classList.add("is-visible"));
    } else setupRevealObserver();
    syncMotionControl();
    document.dispatchEvent(new CustomEvent("archive:motionchange", { detail: { reduced: reducedMotion } }));
  });
  const updateScroll = () => {
    const distance = document.documentElement.scrollHeight - window.innerHeight;
    $("#readingProgress").style.transform = "scaleX(" + (distance > 0 ? Math.min(1, window.scrollY / distance) : 0) + ")";
    $("#siteHeader").classList.toggle("is-scrolled", window.scrollY > 20);
    document.body.classList.toggle("has-scrolled", window.scrollY > 500);
  };
  let scrollPending = false;
  window.addEventListener("scroll", () => {
    if (scrollPending) return;
    scrollPending = true;
    requestAnimationFrame(() => { updateScroll(); scrollPending = false; });
  }, { passive: true });
  window.addEventListener("resize", updateScroll, { passive: true });

  // Content stays visible without JavaScript or when reduced motion is preferred.
  let revealObserver;
  function setupRevealObserver() {
    if (reducedMotion || !("IntersectionObserver" in window)) return;
    document.documentElement.classList.add("has-motion");
    revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) { entry.target.classList.add("is-visible"); revealObserver.unobserve(entry.target); }
      });
    }, { threshold: .08 });
  }
  setupRevealObserver();
  const reveal = (scope = document) => $$(".reveal:not([data-observed])", scope).forEach((element, index) => {
    element.dataset.observed = "true";
    element.style.setProperty("--reveal-delay", Math.min(index % 6, 4) * 55 + "ms");
    if (revealObserver) revealObserver.observe(element);
    else element.classList.add("is-visible");
  });
  const stats = { sessions: data.sessions.length, speakers: data.featuredSpeakers.length, albums: data.albums.length, photos: data.albums.reduce((sum, album) => sum + album.photos.length, 0) };
  $$("[data-stat]").forEach(element => { element.textContent = stats[element.dataset.stat]; });
  const animateCount = element => {
    const target = Number(element.textContent);
    if (reducedMotion || !Number.isFinite(target)) return;
    const start = performance.now();
    const tick = now => {
      const progress = Math.min(1, (now - start) / 1100);
      element.textContent = Math.round(target * (1 - Math.pow(1 - progress, 3)));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  if ("IntersectionObserver" in window) {
    const counterObserver = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { animateCount(entry.target); counterObserver.unobserve(entry.target); }
    }), { threshold: .5 });
    $$("[data-counter], [data-count]").forEach(element => counterObserver.observe(element));
  }

  const albumCard = album => `<a class="album-card reveal" href="${albumUrl(album)}"><span class="album-card__image"><img src="${asset(album.photos[orderedPhotoIndexes(album)[0]])}" alt="" loading="lazy" decoding="async" width="600" height="375" /><span class="album-card__count">${album.photos.length} photos</span></span><span class="album-card__copy"><span class="album-card__category">${escape(categories[album.category])}</span><span class="album-card__title">${escape(album.title)} <span aria-hidden="true">↗</span></span><span class="album-card__description">${escape(album.description)}</span></span></a>`;
  const empty = (heading, text) => `<div class="empty-state"><strong>${escape(heading)}</strong><p>${escape(text)}</p></div>`;
  const initials = name => name.split(/\s+/).slice(0, 2).map(word => word[0]).join("");
  const portrait = officer => officer.photo ? `<img src="${asset(officer.photo)}" alt="Portrait of ${escape(officer.name)}" loading="lazy" decoding="async" />` : `<div class="officer-card__initials" aria-label="Portrait not available">${escape(initials(officer.name))}</div>`;

  if ($("#homeAlbums")) {
    const picks = ["inauguration", "delhi", "trek", "chess", "batch-life", "campus-diaries"];
    $("#homeAlbums").innerHTML = picks.map(slug => data.albums.find(album => album.slug === slug)).filter(Boolean).map(albumCard).join("");
    $("#portraitMosaic").innerHTML = featuredOfficers.map(officer => `<a class="reveal" href="${officerUrl(officer)}" aria-label="${escape(officer.name)}">${portrait(officer)}<span>${escape(officer.name)}</span></a>`).join("");
    const everyday = data.albums.find(album => album.slug === "batch-life");
    const ribbonPhotos = [];
    for (let index = 0; index < 6; index++) {
      for (const album of [everyday].filter(Boolean)) {
        const frame = orderedPhotoIndexes(album)[index];
        if (frame !== undefined) ribbonPhotos.push({ album, frame });
      }
    }
    $("#photoRibbon").innerHTML = ribbonPhotos.map(({album, frame}) => `<a href="${albumUrl(album)}?photo=${frame + 1}"><img src="${asset(album.photos[frame])}" alt="${escape(album.title)}, photograph ${frame + 1}" loading="lazy" /></a>`).join("");
  }

  if ($("#albumGrid")) {
    let category = document.body.dataset.collection || "all";
    if (!categories[category]) category = "all";
    const queryCategory = new URLSearchParams(location.search).get("category");
    if (categories[queryCategory] && !document.body.dataset.collection) category = queryCategory;
    const renderAlbums = () => {
      const query = $("#albumSearch").value.trim().toLowerCase();
      const filtered = data.albums.filter(album => (category === "all" || album.category === category) && [album.title, album.description, album.location].join(" ").toLowerCase().includes(query));
      $("#albumCount").textContent = filtered.length + " albums · " + filtered.reduce((sum, album) => sum + album.photos.length, 0) + " photographs";
      $("#albumGrid").innerHTML = filtered.map(albumCard).join("") || empty("No albums found", "Try a different city, activity, or category.");
      $$("[data-album-filter]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.albumFilter === category)));
      reveal($("#albumGrid"));
    };
    $("#albumFilters").addEventListener("click", event => {
      const button = event.target.closest("[data-album-filter]");
      if (!button) return;
      category = button.dataset.albumFilter;
      renderAlbums();
    });
    $("#albumSearch").addEventListener("input", renderAlbums);
    renderAlbums();
  }

  // A saved collection contains only public photo identifiers, stored on-device.
  const saveKey = "batch-2025-26-saved-photos";
  const storedSaved = read(saveKey, []);
  let saved = new Set(Array.isArray(storedSaved) ? storedSaved.filter(item => typeof item === "string") : []);
  const resolvePhoto = key => {
    const [slug, rawIndex] = key.split(":");
    const album = data.albums.find(item => item.slug === slug);
    const index = Number(rawIndex);
    return album && Number.isInteger(index) && index >= 0 && index < album.photos.length ? { album, index, path: album.photos[index], key } : null;
  };
  saved = new Set([...saved].filter(key => resolvePhoto(key)));
  const syncSaved = () => {
    $$("[data-save-photo]").forEach(button => {
      const active = saved.has(button.dataset.savePhoto);
      button.textContent = active ? "♥" : "♡";
      button.setAttribute("aria-pressed", String(active));
      button.setAttribute("aria-label", active ? "Unsave photograph" : "Save photograph");
    });
  };
  const toggleSaved = key => {
    if (saved.has(key)) saved.delete(key); else saved.add(key);
    if (!write(saveKey, [...saved])) toast("Browser storage is unavailable. This selection lasts for this visit.");
    syncSaved();
    renderSaved();
  };
  const renderSaved = () => {
    if (!$("#savedPhotos")) return;
    const photos = [...saved].map(resolvePhoto).filter(Boolean);
    $("#savedCount").textContent = photos.length + " saved photographs";
    $("#savedPhotos").innerHTML = photos.map(item => `<figure class="photo-tile reveal"><a class="photo-tile__open" href="${albumUrl(item.album)}?photo=${item.index + 1}"><img src="${asset(item.path)}" alt="${escape(item.album.title)}, photograph ${item.index + 1}" loading="lazy" /></a><figcaption><a href="${albumUrl(item.album)}">${escape(item.album.title)}</a><button class="save-photo" type="button" data-save-photo="${item.key}" aria-pressed="true" aria-label="Unsave photograph">♥</button></figcaption></figure>`).join("") || empty("Your collection starts with a favourite frame.", "Use the heart beside a photograph in any album to keep it here.");
    reveal($("#savedPhotos"));
  };
  document.addEventListener("click", event => {
    const button = event.target.closest("[data-save-photo]");
    if (button) toggleSaved(button.dataset.savePhoto);
  });
  renderSaved();
  syncSaved();

  const currentAlbum = data.albums.find(album => album.slug === document.body.dataset.album);
  const photoOrder = currentAlbum ? orderedPhotoIndexes(currentAlbum) : [];
  const lightbox = $("#lightbox");
  let photoIndex = 0;
  let playTimer;
  const stopSlideshow = () => {
    clearInterval(playTimer);
    playTimer = null;
    $("#slidePlay").textContent = "Play slideshow";
    $("#slidePlay").setAttribute("aria-pressed", "false");
  };
  const showPhoto = index => {
    if (!currentAlbum) return;
    photoIndex = (index + currentAlbum.photos.length) % currentAlbum.photos.length;
    const image = $("#lightboxImage");
    image.src = asset(currentAlbum.photos[photoIndex]);
    image.alt = currentAlbum.title + ", photograph " + (photoIndex + 1);
    $("#lightboxCaption").textContent = currentAlbum.title + " · " + (photoIndex + 1) + " of " + currentAlbum.photos.length;
    $("#downloadPhoto").href = image.src;
    $("#downloadPhoto").setAttribute("download", currentAlbum.slug + "-" + (photoIndex + 1) + ".jpg");
    const active = saved.has(currentAlbum.slug + ":" + photoIndex);
    $("#saveCurrentPhoto").textContent = active ? "Saved ♥" : "Save photo ♡";
    $("#saveCurrentPhoto").setAttribute("aria-pressed", String(active));
    if (!reducedMotion) image.animate?.([{ opacity: .3, transform: "scale(.99)" }, { opacity: 1, transform: "scale(1)" }], { duration: 280, easing: "ease-out" });
    // Warm only the adjacent frame, never the whole album.
    const next = new Image();
    next.src = asset(currentAlbum.photos[photoOrder[(photoOrder.indexOf(photoIndex) + 1) % photoOrder.length]]);
  };
  const stepPhoto = direction => { if (currentAlbum) showPhoto(photoOrder[(photoOrder.indexOf(photoIndex) + direction + photoOrder.length) % photoOrder.length]); };
  const openPhoto = index => {
    showPhoto(index);
    if (!lightbox.open) lightbox.showModal();
    document.body.classList.add("modal-open");
  };
  const toggleSlideshow = () => {
    if (playTimer) { stopSlideshow(); return; }
    $("#slidePlay").textContent = "Pause slideshow";
    $("#slidePlay").setAttribute("aria-pressed", "true");
    playTimer = setInterval(() => stepPhoto(1), 4500);
  };
  if (currentAlbum && $("#albumPhotos")) {
    $("#albumPhotos").addEventListener("click", event => {
      const button = event.target.closest("[data-photo-index]");
      if (button) openPhoto(Number(button.dataset.photoIndex));
    });
    $("#startSlideshow").addEventListener("click", () => { openPhoto(photoOrder[0]); if (!playTimer) toggleSlideshow(); });
    $("#layoutToggle").addEventListener("click", () => {
      const masonry = $("#albumPhotos").classList.toggle("photo-grid--masonry");
      $("#layoutToggle").textContent = masonry ? "Grid view" : "Masonry view";
      $("#layoutToggle").setAttribute("aria-pressed", String(masonry));
    });
    const requestedPhoto = Number(new URLSearchParams(location.search).get("photo"));
    if (Number.isInteger(requestedPhoto) && requestedPhoto > 0 && requestedPhoto <= currentAlbum.photos.length) openPhoto(requestedPhoto - 1);
  }
  $("[data-close-lightbox]").addEventListener("click", () => lightbox.close());
  $("[data-lightbox-prev]").addEventListener("click", () => { stopSlideshow(); stepPhoto(-1); });
  $("[data-lightbox-next]").addEventListener("click", () => { stopSlideshow(); stepPhoto(1); });
  lightbox.addEventListener("keydown", event => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); stopSlideshow(); stepPhoto(event.key === "ArrowLeft" ? -1 : 1); }
  });
  lightbox.addEventListener("close", () => { stopSlideshow(); document.body.classList.remove("modal-open"); });
  lightbox.addEventListener("click", event => { if (event.target === lightbox) lightbox.close(); });
  document.addEventListener("visibilitychange", () => { if (document.hidden) stopSlideshow(); });
  let touchStart;
  $("#lightboxImage").addEventListener("touchstart", event => { touchStart = event.touches[0].clientX; }, { passive: true });
  $("#lightboxImage").addEventListener("touchend", event => {
    const distance = event.changedTouches[0].clientX - touchStart;
    if (Math.abs(distance) > 50) { stopSlideshow(); stepPhoto(distance > 0 ? -1 : 1); }
  }, { passive: true });
  $("#slidePlay").addEventListener("click", toggleSlideshow);
  $("#saveCurrentPhoto").addEventListener("click", () => {
    if (!currentAlbum) return;
    toggleSaved(currentAlbum.slug + ":" + photoIndex);
    const active = saved.has(currentAlbum.slug + ":" + photoIndex);
    $("#saveCurrentPhoto").textContent = active ? "Saved ♥" : "Save photo ♡";
    $("#saveCurrentPhoto").setAttribute("aria-pressed", String(active));
  });
  $("#sharePhoto").addEventListener("click", async () => {
    if (!currentAlbum) return;
    const url = new URL(albumUrl(currentAlbum), location.href);
    url.searchParams.set("photo", photoIndex + 1);
    try { await navigator.clipboard.writeText(url.href); toast("Photo link copied."); }
    catch { toast("Copy this link from the address bar."); history.replaceState(null, "", url.href); }
  });

  if ($("#officerGrid")) {
    let limit = 20;
    const renderOfficers = () => {
      const query = $("#officerSearch").value.trim().toLowerCase().replace(/^#/, "");
      const filtered = data.officers.filter(officer => [officer.number, String(officer.number).padStart(3, "0"), officer.name, ...(data.curation?.officerSearchAliases?.[officer.number] || [])].join(" ").toLowerCase().includes(query));
      if ($("#officerSort").value === "featured") filtered.sort((a, b) => featuredRank(a.number) - featuredRank(b.number) || a.number - b.number);
      if ($("#officerSort").value === "name") filtered.sort((a, b) => a.name.localeCompare(b.name));
      const visible = filtered.slice(0, limit);
      $("#officerCount").textContent = "Showing " + visible.length + " of " + filtered.length + " officers";
      $("#officerMore").classList.toggle("is-hidden", visible.length >= filtered.length);
      $("#officerReset").classList.toggle("is-hidden", !query);
      $("#officerGrid").innerHTML = visible.map(officer => `<a class="officer-card reveal" href="${officerUrl(officer)}"><div class="officer-card__photo">${portrait(officer)}<span>#${String(officer.number).padStart(3, "0")}</span></div><h3>${escape(officer.name)}</h3><p>Open yearbook page ↗</p></a>`).join("") || empty("No batchmates found", "Try a shorter name or a batch number.");
      reveal($("#officerGrid"));
    };
    $("#officerSearch").addEventListener("input", () => { limit = 20; renderOfficers(); });
    $("#officerSort").addEventListener("change", () => { limit = 20; renderOfficers(); });
    $("#officerReset").addEventListener("click", () => { $("#officerSearch").value = ""; limit = 20; renderOfficers(); $("#officerSearch").focus(); });
    $("#officerMore").addEventListener("click", () => { const old = limit; limit += 20; renderOfficers(); $("#officerGrid").children[old]?.focus(); });
    renderOfficers();
  }

  if ($("#classroomSearch")) {
    let limit = 12;
    const speakerPage = page === "speakers";
    const grid = speakerPage ? $("#speakerGrid") : $("#sessionList");
    const renderLearning = () => {
      const query = $("#classroomSearch").value.trim().toLowerCase();
      const month = $("#sessionMonth")?.value || "all";
      const filtered = (speakerPage ? data.featuredSpeakers : data.sessions).filter(item => Object.values(item).join(" ").toLowerCase().includes(query) && (speakerPage || month === "all" || item.date.includes(month)));
      const visible = filtered.slice(0, limit);
      $("#classroomCount").textContent = "Showing " + visible.length + " of " + filtered.length + (speakerPage ? " speaker records" : " sessions");
      $("#classroomMore").classList.toggle("is-hidden", visible.length >= filtered.length);
      grid.innerHTML = visible.map(item => speakerPage ? `<article class="speaker-card reveal" tabindex="-1"><div class="speaker-card__head">${item.photo ? `<img src="${asset(item.photo)}" alt="Portrait of ${escape(item.name)}" loading="lazy" />` : `<span class="speaker-initials" aria-hidden="true">${escape(initials(item.name.replace(/^(Shri\.?|Mr\.?|Ms\.?|Dr\.?)\s+/i, "")))}</span>`}<span>Guest faculty</span></div><h3>${escape(item.name)}</h3><p>${escape(item.designation || "Guest faculty")}</p><strong>${escape(item.topic)}</strong></article>` : `<article class="session-row reveal" tabindex="-1"><span>${escape(item.day || "Training day")}<br />${escape(item.date)}</span><span>${escape(item.time)}</span><strong>${escape(item.topic)}</strong><span>${escape(item.speaker)}</span></article>`).join("") || empty("No matching records", "Try another topic, faculty name, or month.");
      reveal(grid);
    };
    $("#classroomSearch").addEventListener("input", () => { limit = 12; renderLearning(); });
    $("#sessionMonth")?.addEventListener("change", () => { limit = 12; renderLearning(); });
    $("#classroomMore").addEventListener("click", () => { const old = limit; limit += 12; renderLearning(); grid.children[old]?.focus(); });
    renderLearning();
  }

  // Keep the existing journal key and export format across the multi-page upgrade.
  if ($("#vaultGate")) {
    const key = "batch-2025-26-device-journal";
    const stored = read(key, []);
    const validEntry = entry => entry && typeof entry.author === "string" && entry.author.length <= 60 && typeof entry.text === "string" && entry.text.length <= 500 && typeof entry.date === "string" && entry.date.length <= 80;
    let memories = Array.isArray(stored) ? stored.filter(validEntry) : [];
    let unlocked = false;
    let unlocking = false;
    const persist = () => {
      const ok = write(key, memories);
      $("#journalStatus").textContent = ok ? "Saved on this device." : "Browser storage is unavailable. Export your journal before leaving.";
    };
    const renderMemories = () => {
      $("#memoryList").innerHTML = memories.slice().reverse().map(entry => `<article class="memory-entry"><p>${escape(entry.text)}</p><span>${escape(entry.author)} · ${escape(entry.date)}</span></article>`).join("") || empty("Your next memory starts here.", "Choose a prompt or write a note of your own.");
    };
    const setUnlocked = value => {
      unlocked = value;
      $("#vaultGate").classList.toggle("is-hidden", value);
      $("#vaultContent").classList.toggle("is-hidden", !value);
      if (value) renderMemories();
      else { window.ROOM508_GATE?.lock(); $("#memoryList").replaceChildren(); }
    };
    setUnlocked(unlocked);
    $("#vaultGate").addEventListener("submit", async event => {
      event.preventDefault();
      if (unlocking) return;
      unlocking = true;
      $("#privateUnlockButton").disabled = true;
      $("#vaultMessage").textContent = "Unlocking…";
      try {
        if (!window.ROOM508_GATE) throw new Error("The private collection is unavailable.");
        await window.ROOM508_GATE.unlock($("#vaultPassphrase").value.trim());
        $("#vaultPassphrase").value = "";
        $("#vaultMessage").textContent = "";
        setUnlocked(true);
        $("#privatePhotoTitle").focus({ preventScroll: true });
      } catch (error) { $("#vaultMessage").textContent = error.message; }
      finally { unlocking = false; $("#privateUnlockButton").disabled = false; }
    });
    $("#lockVault").addEventListener("click", () => { setUnlocked(false); $("#vaultPassphrase").focus(); });
    window.addEventListener("pagehide", () => setUnlocked(false));
    $("#memoryForm").addEventListener("submit", event => {
      event.preventDefault();
      const author = $("#memoryAuthor").value.trim();
      const text = $("#memoryText").value.trim();
      if (!author || !text) { toast("Add your name and a memory first."); return; }
      memories.push({ author, text, date: new Date().toLocaleDateString("en-IN", { dateStyle: "medium" }) });
      persist();
      $("#memoryForm").reset();
      renderMemories();
    });
    $$("[data-prompt]").forEach(button => button.addEventListener("click", () => {
      if (!unlocked) { toast("Unlock your journal to use a writing prompt."); $("#vaultPassphrase").focus(); return; }
      if ($("#memoryText").value.trim()) { toast("Save your current note before starting a new prompt."); return; }
      $("#memoryText").value = button.dataset.prompt;
      $("#memoryText").focus();
    }));
    $("#exportMemories").addEventListener("click", () => {
      const url = URL.createObjectURL(new Blob([JSON.stringify(memories, null, 2)], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url; link.download = "batch-2025-26-memory-journal.json"; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
    $("#importMemories").addEventListener("click", () => $("#journalFile").click());
    $("#journalFile").addEventListener("change", async event => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        if (file.size > 2 * 1024 * 1024) throw new Error("This backup is too large. Choose a journal JSON under 2 MB.");
        const imported = JSON.parse(await file.text());
        if (!Array.isArray(imported) || !imported.every(validEntry)) throw new Error("Choose a valid exported journal JSON.");
        const known = new Set(memories.map(entry => JSON.stringify([entry.author, entry.text, entry.date])));
        const newEntries = imported.filter(entry => {
          const id = JSON.stringify([entry.author, entry.text, entry.date]);
          if (known.has(id)) return false;
          known.add(id); return true;
        });
        memories.push(...newEntries.map(({ author, text, date }) => ({ author, text, date })));
        persist(); renderMemories(); toast("Restored " + newEntries.length + " new memories.");
      } catch (error) { toast(error.message); }
      event.target.value = "";
    });
    $("#clearMemories").addEventListener("click", () => {
      if (window.confirm("Clear every journal entry on this device? Export a backup first if you want to keep them.")) { memories = []; persist(); renderMemories(); }
    });
  }
  reveal();
  updateScroll();
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    window.addEventListener("load", () => navigator.serviceWorker.register(asset("sw.js")).catch(() => {}));
  }
})();
