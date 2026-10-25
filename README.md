# Batch 2025–26 Memory Archive

A static, multi-page memory portal for the SEBI Grade A Officers Batch 2025–26 induction at NISM Patalganga. It uses HTML, CSS, and JavaScript and supports GitHub Pages, including project subpaths and custom domains.

## Public pages

- Home and ceremony: the original batch photograph outside the NISM library.
- Journey: the illustrated induction chronicle.
- Albums, visits, and activities: 473 public photographs across 15 albums, with all available selected frames and no per-album display cap.
- Classroom and speakers: 212 sessions, 147 faculty records, and 43 available source portraits.
- Yearbook: all 130 officers, search and sorting, and individual officer pages.
- Saved photographs: browser-local bookmarks to public images.
- About: the context of the archive.

The small `IN` footer shortcut opens the inauguration. The scissors on the ribbon and the side-panel launch button both run the same cut and curtain reveal. Diyas, optional sound, replay, keyboard focus, and reduced-motion support remain available. No audio plays on page load.

## Private corner

Room 508 is absent from public album lists, home features, backgrounds, and event highlights. Only six reviewed photos are included in the private corner. Their contents are encrypted with AES-256-GCM, using a key derived from the configured shared password with PBKDF2-SHA256.

The password is supplied privately and is not stored in the repository. The browser decrypts the photo bundle after a successful password entry and creates temporary blob URLs. Locking clears the gallery and revokes those URLs. Refreshing or leaving the page requires another password entry. The legacy `albums/room-508.html` URL contains only a link to the private gate.

The other 508 web copies have been moved out of the public media tree into the ignored build archive. All original source files remain intact in `assets/508_Photos`, which is excluded from version control. Keep the ignored `assets` and `build` directories out of deployments.

Existing device-journal entries keep the same local storage key and export format. JSON backup restoration merges entries without duplicating them. Journal notes remain browser-local and are separate from the encrypted photo bundle.

## Structure

- Root `.html` files: the main documents.
- `albums/` and `officers/`: generated album and yearbook pages.
- `templates/`: shared layout and editable page content.
- `css/`, `js/`: styling and browser behavior.
- `data/portal-data.js`: public dataset only.
- `data/private-room508.js`: encrypted private bundle.
- `media/`: public, optimized images.
- `scripts/`: repeatable generation and verification.
- `assets/`: original media and workbooks, retained locally.
- `build/`: ignored staging, retired web copies, and build metadata.

## Preview

From the project root:

```powershell
python -m http.server 4173
```

Open the printed local URL. HTTPS or localhost supports all browser crypto and offline-cache features.

## Rebuild public content

```powershell
python scripts/build_portal_data.py
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/optimize_media.ps1
python scripts/build_pages.py
```

Edit `templates/pages/` for content or `templates/layout.html` for the common navigation/footer, then regenerate pages. Public album imports are not capped. HEIC-only sources remain in the original archive until browser-ready copies are provided.

The requested officer feature order and alternate search spellings are maintained in `data/curation.json`. Optional `photoOfficerTags` uses confirmed officer numbers to prioritize event photographs. The default tag map is empty because source photos have no person labels.

The public roster follows yearbook folders 1–130. Source folders 131–132 are retained outside that roster.

## Rebuild the private selection

Edit the six filenames in `scripts/private-room508.selection.json`, then run:

```powershell
python scripts/build_portal_data.py
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/optimize_media.ps1 -ManifestPath build/private-room508-manifest.json
node scripts/build_private_gallery.cjs
```

The last command prompts for the password without echoing it. Private resized copies are staged only under ignored `build/`; the public output contains the encrypted bundle. Changing unrelated public templates does not require re-encrypting the collection.

## Checks

```powershell
python scripts/verify_portal.py
node scripts/verify_interactions.cjs
node scripts/verify_cache.cjs
node scripts/verify_private_gallery.cjs
```

The private verification command requests the password through hidden input. The other interaction checks use an independent encrypted test fixture.

## GitHub Pages

Commit the generated root HTML files, `albums`, `officers`, `css`, `js`, `data`, `media`, and `assets/icons`. Keep templates and scripts for maintenance. Do not upload ignored raw assets, the original prototype, or the build directory.

In repository Settings → Pages, deploy the main branch from the root. Configure the custom domain in Pages settings and its DNS records, then enable HTTPS.

The service worker caches public pages and web assets. A version update clears the previous portal caches, including the formerly public 508 derivatives. It never caches decrypted blob images. Increase the cache version when publishing changes.
