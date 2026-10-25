(() => {
  "use strict";
  const stage = document.getElementById("ceremonyStage");
  if (!stage) return;
  const $ = id => document.getElementById(id);
  const lamps = [...document.querySelectorAll("[data-diya]")];
  const lit = new Set();
  let opened = false;
  let sound = true;
  let audio;
  let revealTimer;
  const tones = new Set();
  const quietMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.body.classList.contains("motion-paused");
  const keepRevealInView = () => {
    const workbench = $("ceremonyWorkbench");
    const bounds = workbench.getBoundingClientRect();
    const headerHeight = document.getElementById("siteHeader").getBoundingClientRect().height || 80;
    if (bounds.top < headerHeight + 8 || bounds.bottom > window.innerHeight - 8) {
      workbench.scrollIntoView({ block: "start", behavior: "instant" });
    }
  };

  // One audio context, created only inside a click. No network audio or autoplay.
  const stopSound = () => {
    tones.forEach(oscillator => { try { oscillator.stop(); } catch {} });
    tones.clear();
  };
  const playNotes = async (frequencies, gap = .13) => {
    if (!sound) return;
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return;
    try {
      audio ||= new Context();
      if (audio.state === "suspended") await audio.resume();
      if (!sound || document.hidden) return;
      const start = audio.currentTime;
      frequencies.forEach((frequency, index) => {
        const oscillator = audio.createOscillator();
        const envelope = audio.createGain();
        const when = start + index * gap;
        oscillator.type = "triangle";
        oscillator.frequency.setValueAtTime(frequency, when);
        envelope.gain.setValueAtTime(.0001, when);
        envelope.gain.exponentialRampToValueAtTime(.055, when + .025);
        envelope.gain.exponentialRampToValueAtTime(.0001, when + .75);
        oscillator.connect(envelope);
        envelope.connect(audio.destination);
        oscillator.onended = () => { tones.delete(oscillator); oscillator.disconnect(); envelope.disconnect(); };
        tones.add(oscillator);
        oscillator.start(when);
        oscillator.stop(when + .8);
      });
    } catch {
      $("ceremonyStatus").textContent = "The ceremony is ready. Audio is unavailable in this browser.";
    }
  };
  const updateLamp = (button, active) => {
    const label = button.dataset.diya;
    button.classList.toggle("is-lit", active);
    button.setAttribute("aria-pressed", String(active));
    button.setAttribute("aria-label", (active ? "Lit: " : "Light the ") + label + " diya");
    button.querySelector("small").textContent = active ? "Lit" : "Click to light";
  };
  const updateCount = () => { $("diyaStatus").textContent = lit.size + " of 3 ceremonial diyas lit."; };
  lamps.forEach((button, index) => button.addEventListener("click", () => {
    if (lit.has(button.dataset.diya)) return;
    lit.add(button.dataset.diya);
    updateLamp(button, true);
    updateCount();
    playNotes([261.63, 329.63, 392].slice(index, index + 1));
  }));
  $("ceremonySound").addEventListener("click", () => {
    sound = !sound;
    $("ceremonySound").textContent = sound ? "Sound on ♫" : "Sound off";
    $("ceremonySound").setAttribute("aria-pressed", String(sound));
    $("ceremonySound").setAttribute("aria-label", sound ? "Mute ceremony sound" : "Enable ceremony sound");
    if (!sound) stopSound();
  });
  const celebrate = () => {
    const field = $("ceremonyConfetti");
    field.replaceChildren();
    if (quietMotion()) return;
    for (let index = 0; index < 36; index++) {
      const piece = document.createElement("span");
      piece.style.setProperty("--x", ((index * 37) % 100) + "%");
      piece.style.setProperty("--drift", ((index % 7) - 3) * 24 + "px");
      piece.style.setProperty("--fall-delay", (index % 9) * .07 + "s");
      piece.style.setProperty("--piece-color", ["#e9bb6b", "#f6e2af", "#7da6ff", "#f1a58a"][index % 4]);
      field.appendChild(piece);
    }
  };
  const revealWelcome = () => {
    $("ceremonyReveal").setAttribute("aria-hidden", "false");
    $("ceremonyReveal").removeAttribute("inert");
    $("ceremonyWelcome").focus({ preventScroll: true });
  };
  const launch = () => {
    if (opened) return;
    keepRevealInView();
    opened = true;
    lamps.forEach(button => { lit.add(button.dataset.diya); updateLamp(button, true); });
    updateCount();
    stage.classList.add("is-open");
    stage.classList.add("is-cutting");
    $("inaugurateLaunch").disabled = true;
    $("ribbonCut").disabled = true;
    $("inaugurateReplay").classList.remove("is-hidden");
    $("ceremonyStatus").textContent = "The archive is unveiled. Welcome, Batch 2025–26.";
    $("ceremonyStatus").focus({ preventScroll: true });
    playNotes([261.63, 329.63, 392, 523.25, 659.25, 783.99]);
    celebrate();
    if (quietMotion()) revealWelcome();
    else revealTimer = setTimeout(revealWelcome, 1850);
  };
  $("inaugurateLaunch").addEventListener("click", launch);
  $("ribbonCut").addEventListener("click", launch);
  $("inaugurateReplay").addEventListener("click", () => {
    clearTimeout(revealTimer);
    opened = false;
    stopSound();
    lit.clear();
    lamps.forEach(button => updateLamp(button, false));
    stage.classList.remove("is-open");
    stage.classList.remove("is-cutting");
    $("ceremonyReveal").setAttribute("aria-hidden", "true");
    $("ceremonyReveal").setAttribute("inert", "");
    $("ceremonyConfetti").replaceChildren();
    $("inaugurateLaunch").disabled = false;
    $("ribbonCut").disabled = false;
    $("inaugurateReplay").classList.add("is-hidden");
    $("diyaStatus").textContent = "Light the three diyas, or unveil the archive to begin.";
    $("ceremonyStatus").textContent = "Ready for the next ceremonial reveal.";
    $("inaugurateLaunch").focus();
  });
  document.addEventListener("archive:motionchange", event => {
    if (event.detail.reduced) {
      $("ceremonyConfetti").replaceChildren();
      if (opened) { clearTimeout(revealTimer); revealWelcome(); }
    }
  });
  document.addEventListener("visibilitychange", () => { if (document.hidden) stopSound(); });
  window.addEventListener("pagehide", () => { stopSound(); clearTimeout(revealTimer); audio?.close().catch(() => {}); });
})();
