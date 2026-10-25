"""Generate real, portable HTML documents. No runtime build or routing server."""
from __future__ import annotations

import html
import json
from pathlib import Path

from build_portal_data import slugify

ROOT = Path(__file__).resolve().parents[1]
TEMPLATES = ROOT / "templates"
RAW_DATA = (ROOT / "data" / "portal-data.js").read_text(encoding="utf-8")
DATA = json.loads(RAW_DATA.removeprefix("window.PORTAL_DATA = ").strip().removesuffix(";"))
LAYOUT = (TEMPLATES / "layout.html").read_text(encoding="utf-8")
e = html.escape
CATEGORIES = {"milestones": "Milestones", "visits": "Visits & attachments", "activities": "Beyond the classroom", "everyday": "Batch life"}
CURATION = DATA.get("curation", {})
FEATURED = CURATION.get("featuredOfficerNumbers", [])


def ordered_photos(album: dict) -> list[tuple[int, str]]:
    tags = CURATION.get("photoOfficerTags", {})
    def rank(item):
        people = tags.get(item[1], [])
        return min((FEATURED.index(number) for number in people if number in FEATURED), default=len(FEATURED))
    return sorted(enumerate(album["photos"]), key=rank)


def featured_strip(prefix: str = "", exclude: int = 0) -> str:
    officers = {officer["number"]: officer for officer in DATA["officers"]}
    cards = []
    for number in FEATURED:
        officer = officers.get(number)
        if not officer or number == exclude:
            continue
        image = f'<img src="{prefix}{e(officer["photo"])}" alt="" loading="lazy" width="72" height="82" />' if officer["photo"] else ""
        cards.append(f'<a class="featured-person" href="{prefix}officers/{number:03d}-{slugify(officer["name"])}.html">{image}<span>{e(officer["name"])}</span></a>')
    return f'<section class="featured-yearbook" aria-label="Featured yearbook portraits"><div class="featured-yearbook__heading"><div><p class="eyebrow">From our yearbook</p><h2>Familiar faces. Shared memories.</h2></div><a class="inline-link" href="{prefix}yearbook.html">All 130 officers ↗</a></div><div class="featured-people">{"".join(cards)}</div></section>'


def intro(kicker: str, title: str, description: str, image: str = "") -> str:
    visual = f'<div class="page-intro__image"><img src="{e(image)}" alt="" fetchpriority="high" /></div>' if image else ""
    ambient = '<img class="page-intro__ambient" src="media/albums/batch-life/01.jpg" alt="" loading="lazy" />'
    return f'<section class="page-intro">{ambient}<div class="wrap page-intro__inner"><div class="reveal"><a class="breadcrumb" href="index.html">Home <span>/ {e(kicker)}</span></a><p class="eyebrow">{e(kicker)}</p><h1>{e(title)}</h1><p>{e(description)}</p></div>{visual}</div></section>'


def write_page(relative: str, page: str, title: str, description: str, content: str, attrs: str = "", preload: str = "") -> None:
    target = ROOT / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    root = "../" * (len(Path(relative).parts) - 1)
    extra_scripts = '<script src="js/inaugurate.js"></script>' if page == "inaugurate" else '<script src="data/private-room508.js"></script><script src="js/private-gallery.js"></script>' if page == "private" else ""
    extra_styles = '<link rel="stylesheet" href="css/ceremony.css" />' if page == "inaugurate" else ""
    values = {"root": root, "page": page, "title": e(title), "description": e(description), "content": content, "body_attrs": attrs, "preload": preload, "extra_scripts": extra_scripts, "extra_styles": extra_styles}
    document = LAYOUT
    for key in ["content", "title", "description", "page", "body_attrs", "preload", "extra_scripts", "extra_styles", "root"]:
        document = document.replace("{{" + key + "}}", values[key])
    document = "\n".join(line.rstrip() for line in document.splitlines()) + "\n"
    (target).write_text(document, encoding="utf-8", newline="\n")


def album_card(album: dict, prefix: str = "") -> str:
    cover = ordered_photos(album)[0][1]
    return f'<a class="album-card reveal" href="{prefix}albums/{e(album["slug"])}.html"><span class="album-card__image"><img src="{prefix}{e(cover)}" alt="" loading="lazy" /><span class="album-card__count">{len(album["photos"])} photos</span></span><span class="album-card__copy"><span class="album-card__category">{e(CATEGORIES[album["category"]])}</span><span class="album-card__title">{e(album["title"])} <span aria-hidden="true">↗</span></span><span class="album-card__description">{e(album["description"])}</span></span></a>'


def main() -> None:
    pages = [
        ("index.html", "home", "Our induction. Our story.", "A home for the people, places, and memories of Batch 2025–26.", "", "", ""),
        ("journey.html", "journey", "Our induction journey", "From a formal beginning to the memories that stayed with us.", "The chronicle", "The story of a shared season.", "media/albums/inauguration/01.jpg"),
        ("albums.html", "albums", "Memory albums", "Explore the photographs of our induction, one album at a time.", "The albums", "Every frame takes us back.", "media/albums/batch-life/01.jpg"),
        ("visits.html", "visits", "Visits & attachments", "Explore the batch's institutional visits and attachments beyond campus.", "On the road", "The world beyond the classroom.", "media/albums/delhi/01.jpg"),
        ("activities.html", "activities", "Beyond the classroom", "Sports, trails, team activities, and cultural memories from induction.", "After class", "Where the batch came alive.", "media/albums/trek/01.jpg"),
        ("classroom.html", "classroom", "The classroom archive", "Revisit the session topics, dates, and faculty in the induction schedule.", "Our learning", "Ideas that travelled with us.", ""),
        ("speakers.html", "speakers", "Our speakers", "Meet the speakers and faculty recorded in the supplied induction archive.", "People behind the learning", "The voices we learned from.", ""),
        ("yearbook.html", "yearbook", "The batch of 130", "Find a familiar face in the yearbook of Batch 2025–26.", "Our yearbook", "All 130. Still a batch.", ""),
        ("private.html", "private", "The private corner", "A device-local journal for personal induction memories.", "Just for the batch", "A little space of our own.", ""),
        ("saved.html", "saved", "My saved photographs", "Your favourite photographs, bookmarked in this browser.", "Your collection", "The moments you kept close.", ""),
        ("about.html", "about", "About the archive", "A commemorative home for the SEBI Grade A Batch 2025–26 induction memories.", "About this archive", "A little piece of Patalganga.", ""),
        ("offline.html", "offline", "You are offline", "Return to a saved chapter or connect to explore more.", "A pause in the journey", "Our memories will be here.", ""),
        ("inaugurate.html", "inaugurate", "Ceremonial inauguration", "Light three diyas and unveil the Batch 2025–26 digital memory archive.", "", "", ""),
    ]
    for relative, page, title, description, kicker, heading, image in pages:
        template_name = "albums" if page in {"visits", "activities"} else page
        content = (TEMPLATES / "pages" / (template_name + ".html")).read_text(encoding="utf-8")
        content = content.replace("{{intro}}", intro(kicker, heading, description, image))
        content = content.replace("{{photo_count}}", str(sum(len(album["photos"]) for album in DATA["albums"])))
        content = content.replace("{{album_count}}", str(len(DATA["albums"])))
        content = content.replace("{{album_links}}", "".join(album_card(album) for album in DATA["albums"]))
        content = content.replace("{{officer_links}}", '<ul class="plain-directory">' + "".join(f'<li><a href="officers/{officer["number"]:03d}-{slugify(officer["name"])}.html">{e(officer["name"])}</a></li>' for officer in DATA["officers"]) + "</ul>")
        if page in {"visits", "activities", "about"}:
            content += '<div class="wrap">' + featured_strip() + '</div>'
        attrs = f'data-collection="{page}"' if page in {"visits", "activities"} else ""
        preload = '<link rel="preload" href="media/albums/chairman/01.jpg" as="image" />' if page in {"home", "inaugurate"} else ""
        write_page(relative, page, title, description, content, attrs, preload)

    for album in DATA["albums"]:
        slug = album["slug"]
        photos = "".join(
            f'<figure class="photo-tile reveal"><button class="photo-tile__open" type="button" data-photo-index="{index}" aria-label="Open {e(album["title"])} photograph {index+1}"><img src="../{e(photo)}" alt="{e(album["title"])} — photograph {index+1}" loading="lazy" decoding="async" /></button><figcaption><span>Frame {index+1:02d}</span><button class="save-photo" type="button" data-save-photo="{slug}:{index}" aria-pressed="false" aria-label="Save photograph {index+1}">♡</button></figcaption></figure>'
            for index, photo in ordered_photos(album)
        )
        related = [item for item in DATA["albums"] if item["category"] == album["category"] and item["slug"] != slug][:3]
        if not related:
            related = [item for item in DATA["albums"] if item["slug"] != slug][:3]
        highlights = "".join(f"<li>{e(item)}</li>" for item in album["highlights"])
        content = f"""
        <section class="album-cover"><img src="../{e(ordered_photos(album)[0][1])}" alt="" fetchpriority="high" /><div class="album-cover__shade"></div><div class="wrap album-cover__copy"><a class="breadcrumb" href="../albums.html">Albums / {e(CATEGORIES[album["category"]])}</a><p class="eyebrow">{e(album["period"])}</p><h1>{e(album["title"])}</h1><p>{e(album["description"])}</p><div class="album-meta"><span>{e(album["location"])}</span><span>{len(album["photos"])} photographs</span></div></div></section>
        <section class="section"><div class="wrap"><div class="album-story reveal"><div><p class="eyebrow">Inside this chapter</p><h2>A place in our shared story.</h2><p>{e(album["description"])} This collection brings the photographs together so the batch can revisit the experience, frame by frame.</p></div><ul>{highlights}</ul></div>
        {featured_strip("../")}
        <div class="photo-toolbar"><p class="result-count">{len(album["photos"])} photographs · Select any frame to view it</p><div class="photo-toolbar__actions"><button class="text-button" type="button" id="startSlideshow">Play slideshow ▷</button><button class="text-button" type="button" id="layoutToggle" aria-pressed="false">Masonry view</button><a class="text-button" href="../saved.html">Saved photos ♡</a></div></div>
        <div class="photo-grid" id="albumPhotos">{photos}</div>
        </div></section>
        <section class="section section--paper"><div class="wrap"><div class="section-heading"><p class="eyebrow">Another chapter awaits</p><h2>Keep wandering.</h2></div><div class="album-grid">{"".join(album_card(item, "../") for item in related)}</div></div></section>"""
        write_page(f"albums/{slug}.html", "album", album["title"], album["description"], content, f'data-album="{slug}"')

    officers = DATA["officers"]
    for index, officer in enumerate(officers):
        number = officer["number"]
        initials = "".join(part[0] for part in officer["name"].split()[:2])
        image = f'<img src="../{e(officer["photo"])}" alt="Portrait of {e(officer["name"])}" fetchpriority="high" />' if officer["photo"] else f'<div class="profile-initials">{e(initials)}</div>'
        previous = officers[(index-1) % len(officers)]
        following = officers[(index+1) % len(officers)]
        content = f"""
        <section class="section"><div class="wrap"><a class="breadcrumb" href="../yearbook.html">Yearbook / Officer {number:03d}</a><div class="officer-profile"><div class="officer-profile__portrait reveal">{image}<span>Batch 2025–26</span></div><div class="officer-profile__copy reveal"><p class="eyebrow">Officer #{number:03d}</p><h1>{e(officer["name"])}</h1><p class="profile-role">SEBI Grade A Officer</p><div class="profile-facts"><span><small>Our batch</small><strong>2025–26</strong></span><span><small>Our campus</small><strong>NISM Patalganga</strong></span></div><p>One of the people who made this induction a shared experience. A place in the yearbook, and a part of the batch's story.</p><div class="hero__actions"><a class="button button--primary" href="../albums.html">Explore our memories ↗</a><a class="button button--secondary" href="../yearbook.html">Back to the yearbook</a></div></div></div>
        <nav class="profile-pagination" aria-label="Browse officers"><a href="{previous["number"]:03d}-{slugify(previous["name"])}.html"><small>← Previous officer</small><strong>{e(previous["name"])}</strong></a><a href="{following["number"]:03d}-{slugify(following["name"])}.html"><small>Next officer →</small><strong>{e(following["name"])}</strong></a></nav>{featured_strip("../", number)}</div></section>"""
        write_page(f"officers/{number:03d}-{slugify(officer['name'])}.html", "officer", officer["name"], f"{officer['name']} · SEBI Grade A Batch 2025–26 yearbook.", content)

    private_gate = '<section class="section"><div class="wrap"><p class="eyebrow">Private corner</p><h1>This collection is private.</h1><p>Open the private corner and enter its shared password to view the selected photographs.</p><a class="button button--primary" href="../private.html#room-508">Open private corner ↗</a></div></section>'
    write_page("albums/room-508.html", "private-gate", "Private collection", "A password is required to view this collection.", private_gate)
    print(f"Generated {len(pages)} main pages, {len(DATA['albums'])} public albums, a private gate, and {len(officers)} officer pages.")


if __name__ == "__main__":
    main()
