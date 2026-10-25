"""Check the published static documents and their real asset/link graph."""
from __future__ import annotations

import json
import hashlib
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]


class Document(HTMLParser):
    def __init__(self, source: str):
        super().__init__(convert_charrefs=True)
        self.ids: list[str] = []
        self.references: list[str] = []
        self.h1_count = 0
        self.feed(source)

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        if "id" in attrs:
            self.ids.append(attrs["id"])
        if tag == "h1":
            self.h1_count += 1
        for key in ("src", "href"):
            if key in attrs:
                self.references.append(attrs[key])

class CeremonyStructure(HTMLParser):
    def __init__(self, source: str):
        super().__init__()
        self.divisions = []
        self.stage_parent = None
        self.console_parent = None
        self.feed(source)

    def handle_starttag(self, tag, attributes):
        if tag != "div":
            return
        attrs = dict(attributes)
        parent = self.divisions[-1].get("id") if self.divisions else None
        if attrs.get("id") == "ceremonyStage":
            self.stage_parent = parent
        if "ceremony-console" in attrs.get("class", "").split():
            self.console_parent = parent
        self.divisions.append(attrs)

    def handle_endtag(self, tag):
        if tag == "div" and self.divisions:
            self.divisions.pop()


def main() -> None:
    pages = sorted(path for path in ROOT.glob("*.html") if not path.name.startswith("sebi_grade_"))
    pages += sorted((ROOT / "albums").glob("*.html"))
    pages += sorted((ROOT / "officers").glob("*.html"))
    documents = {path: Document(path.read_text(encoding="utf-8")) for path in pages}
    errors: list[str] = []
    references = 0
    for path, document in documents.items():
        source = path.read_text(encoding="utf-8")
        if 'class="inaugurate-link"' not in source or ">IN</a>" not in source:
            errors.append(f"Missing IN inauguration shortcut: {path.name}")
        if "{{" in source or "}}" in source:
            errors.append(f"Unresolved template placeholder in {path.relative_to(ROOT)}")
        if document.h1_count != 1:
            errors.append(f"{path.name}: expected one H1, found {document.h1_count}")
        duplicates = [value for value, count in Counter(document.ids).items() if count > 1]
        if duplicates:
            errors.append(f"{path.name}: duplicate IDs {duplicates}")
        for reference in document.references:
            parts = urlsplit(reference)
            if parts.scheme or parts.netloc:
                continue
            references += 1
            target = (path.parent / unquote(parts.path)).resolve() if parts.path else path
            if not target.exists():
                errors.append(f"{path.relative_to(ROOT)} -> missing {reference}")
            elif parts.fragment and target in documents and parts.fragment not in documents[target].ids:
                errors.append(f"{path.relative_to(ROOT)} -> missing anchor {reference}")

    raw = (ROOT / "data" / "portal-data.js").read_text(encoding="utf-8")
    data = json.loads(raw.removeprefix("window.PORTAL_DATA = ").strip().removesuffix(";"))
    assert [officer["number"] for officer in data["officers"]] == list(range(1, 131)), "Officer roster must remain 1–130"
    assert len(list((ROOT / "officers").glob("*.html"))) == 130
    assert len([path for path in (ROOT / "albums").glob("*.html") if path.name != "room-508.html"]) == len(data["albums"])
    media = [officer["photo"] for officer in data["officers"] if officer["photo"]]
    media += [speaker["photo"] for speaker in data["featuredSpeakers"] if speaker.get("photo")]
    album_photos = [photo for album in data["albums"] for photo in album["photos"]]
    curation = data.get("curation", {})
    assert not any(album["slug"] == "room-508" for album in data["albums"]), "Private albums must not enter the public dataset"
    assert not (ROOT / "media" / "albums" / "room-508").exists(), "Plaintext 508 photographs must not remain in public media"
    for path in pages:
        source = path.read_text(encoding="utf-8")
        assert "media/albums/room-508" not in source, "Private media must not be linked from generated documents"
        assert 'class="room-moment' not in source, "Public 508 highlights must be removed"
    assert 'src="media/albums/chairman/01.jpg"' in (ROOT / "index.html").read_text(encoding="utf-8")
    assert 'src="media/albums/chairman/01.jpg"' in (ROOT / "inaugurate.html").read_text(encoding="utf-8")
    assert (ROOT / "data/private-room508.js").exists()
    ceremony = CeremonyStructure((ROOT / "inaugurate.html").read_text(encoding="utf-8"))
    assert ceremony.stage_parent == ceremony.console_parent == "ceremonyWorkbench", "The stage and controls must share the same ceremony frame"
    assert curation.get("featuredOfficerNumbers") == [101, 114, 23, 45, 112, 20, 31, 24, 113]
    for reference, numbers in curation.get("photoOfficerTags", {}).items():
        assert reference in album_photos, "Photo tags must reference an existing album photo"
        assert isinstance(numbers, list) and all(isinstance(number, int) and number in range(1, 131) for number in numbers), "Tags must use valid officer numbers"
    for album in data["albums"]:
        album_html = (ROOT / "albums" / (album["slug"] + ".html")).read_text(encoding="utf-8")
        assert album_html.count('class="featured-person"') == 9, "Every album must include all nine featured yearbook portraits"
    assert len(album_photos) == len(set(album_photos)), "Photo paths must be unique across albums"
    media += album_photos
    for reference in media:
        path = ROOT / reference
        if not path.exists():
            errors.append(f"Missing dataset media {reference}")
        else:
            with path.open("rb") as stream:
                if stream.read(2) != b"\xff\xd8":
                    errors.append(f"Invalid JPEG signature: {reference}")
    for css_path in (ROOT / "css").glob("*.css"):
        css = css_path.read_text(encoding="utf-8")
        if css.count("{") != css.count("}"):
            errors.append(f"Unbalanced CSS braces in {css_path.name}")
    if errors:
        raise SystemExit("\n".join(errors))
    total_bytes = sum((ROOT / path).stat().st_size for path in set(media))
    print(f"PASS: {len(pages)} HTML documents, {references} local links/assets, one H1 and unique IDs on every page.")
    print(f"PASS: 130 officer pages, {len(data['albums'])} album pages, {len(album_photos)} album photographs.")
    print(f"PASS: {len(media)} web images present; dataset media total {total_bytes / 1024 / 1024:.1f} MB.")


if __name__ == "__main__":
    main()
