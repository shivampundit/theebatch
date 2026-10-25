(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const grid = $("privatePhotos");
  if (!grid) return;
  const viewer = $("privatePhotoViewer");
  let photos = [];
  let index = 0;
  const decode = value => Uint8Array.from(atob(value), character => character.charCodeAt(0));
  const closeViewer = () => { if (viewer.open) viewer.close(); };
  const lock = () => {
    closeViewer();
    $("privatePhotoImage").removeAttribute("src");
    $("privatePhotoDownload").removeAttribute("href");
    grid.replaceChildren();
    photos.forEach(photo => URL.revokeObjectURL(photo.url));
    photos = [];
    $("privatePhotoCount").textContent = "";
  };
  const show = next => {
    if (!photos.length) return;
    index = (next + photos.length) % photos.length;
    $("privatePhotoImage").src = photos[index].url;
    $("privatePhotoImage").alt = photos[index].caption;
    $("privatePhotoCaption").textContent = (index + 1) + " of " + photos.length + " · Private collection";
    $("privatePhotoDownload").href = photos[index].url;
    $("privatePhotoDownload").setAttribute("download", "private-memory-" + (index + 1) + ".jpg");
  };
  const unlock = async password => {
    lock();
    if (!window.crypto?.subtle) throw new Error("Open the portal through localhost or HTTPS to unlock the collection.");
    const envelope = window.ROOM508_ENVELOPE;
    if (!envelope || envelope.version !== 1 || envelope.iterations < 100000 || envelope.iterations > 1000000) throw new Error("The private collection is unavailable.");
    const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
    const key = await crypto.subtle.deriveKey({ name: "PBKDF2", salt: decode(envelope.salt), iterations: envelope.iterations, hash: "SHA-256" }, material, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
    let cleartext;
    try {
      cleartext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: decode(envelope.iv) }, key, decode(envelope.ciphertext));
    } catch { throw new Error("That password does not match the private collection."); }
    const gallery = JSON.parse(new TextDecoder().decode(cleartext));
    if (!Array.isArray(gallery.photos) || gallery.photos.length !== 6 || !gallery.photos.every(photo => photo.mime === "image/jpeg" && typeof photo.data === "string" && typeof photo.caption === "string")) throw new Error("The private collection is invalid.");
    photos = gallery.photos.map(photo => ({ caption: photo.caption, url: URL.createObjectURL(new Blob([decode(photo.data)], { type: photo.mime })) }));
    grid.innerHTML = photos.map((photo, position) => '<button type="button" class="private-photo" data-private-photo="' + position + '" aria-label="Open private photograph ' + (position + 1) + '"><img src="' + photo.url + '" alt="Private collection photograph ' + (position + 1) + '" loading="lazy" /></button>').join("");
    $("privatePhotoCount").textContent = photos.length + " selected photographs";
    return photos.length;
  };
  grid.addEventListener("click", event => {
    const button = event.target.closest("[data-private-photo]");
    if (!button || !photos.length) return;
    show(Number(button.dataset.privatePhoto));
    viewer.showModal();
    document.body.classList.add("modal-open");
  });
  $("privatePhotoClose").addEventListener("click", closeViewer);
  $("privatePhotoPrevious").addEventListener("click", () => show(index - 1));
  $("privatePhotoNext").addEventListener("click", () => show(index + 1));
  viewer.addEventListener("close", () => document.body.classList.remove("modal-open"));
  viewer.addEventListener("keydown", event => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); show(index + (event.key === "ArrowLeft" ? -1 : 1)); }
  });
  viewer.addEventListener("click", event => { if (event.target === viewer) closeViewer(); });
  window.addEventListener("pagehide", lock);
  window.ROOM508_GATE = { unlock, lock };
})();
