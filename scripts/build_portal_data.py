"""Build the static portal data and a curated media manifest from the source archive.

The script uses only Python's standard library so the portal can be rebuilt on a
clean machine. It never changes source images or workbooks.
"""

from __future__ import annotations

import datetime as dt
import hashlib
import json
import re
import unicodedata
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
DATA_OUT = ROOT / "data" / "portal-data.js"
MANIFEST_OUT = ROOT / "build" / "media-manifest.json"

YEARBOOK_DIRS = [
    ASSETS / "0.SORTED_1" / "11. INDIVIDUAL PHOTOS OF BATCH 2025-26 (YEAR BOOK)",
    ASSETS / "0.SORTED" / "11. INDIVIDUAL PHOTOS OF BATCH 2025-26 (YEAR BOOK)",
]

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
RNS = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
WEB_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png"}


def clean_text(value: object) -> str:
    text = str(value or "").replace("\ufffd", "–").replace("\u2019", "'")
    return re.sub(r"\s+", " ", text).strip()


def slugify(value: str) -> str:
    ascii_text = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", ascii_text.lower()).strip("-")


def image_score(path: Path, officer_number: int | None = None) -> tuple[int, int, str]:
    name = path.stem.lower()
    score = 0
    if officer_number is not None and name == str(officer_number):
        score += 100
    if name.isdigit():
        score += 70
    if any(term in name for term in ("formal", "photo", "passport", "ps")):
        score += 45
    if any(term in name for term in ("casual", "informal", "copy")):
        score -= 10
    if path.suffix.lower() in {".jpg", ".jpeg"}:
        score += 8
    # Smaller files are generally already web-friendlier; retain a deterministic tie-break.
    return (-score, path.stat().st_size, path.name.lower())


def find_officers() -> tuple[list[dict], list[dict]]:
    folders: dict[int, dict] = {}
    for root in YEARBOOK_DIRS:
        if not root.exists():
            continue
        for folder in root.iterdir():
            if not folder.is_dir():
                continue
            match = re.match(r"^(\d+)\.\s*(.+)$", folder.name)
            if not match:
                continue
            number = int(match.group(1))
            record = folders.setdefault(number, {"number": number, "name": clean_text(match.group(2)).rstrip("_").strip(), "folders": []})
            record["folders"].append(folder)

    officers: list[dict] = []
    media: list[dict] = []
    for number in range(1, 131):
        record = folders.get(number)
        if not record:
            officers.append({"number": number, "name": f"Officer {number:03d}", "photo": ""})
            continue
        candidates: list[Path] = []
        for folder in record["folders"]:
            candidates.extend(p for p in folder.iterdir() if p.is_file() and p.suffix.lower() in WEB_IMAGE_EXTENSIONS)
        candidates = sorted(set(candidates), key=lambda path: image_score(path, number))
        destination = f"media/officers/{number:03d}-{slugify(record['name'])}.jpg" if candidates else ""
        officers.append({"number": number, "name": record["name"].title(), "photo": destination})
        if candidates:
            media.append({"source": str(candidates[0].relative_to(ROOT)), "destination": destination, "width": 720, "height": 900, "quality": 82})
    return officers, media


def column_number(reference: str) -> int:
    letters = re.match(r"[A-Z]+", reference).group(0)
    value = 0
    for letter in letters:
        value = value * 26 + ord(letter) - 64
    return value


def read_xlsx_rows(path: Path) -> list[list[str]]:
    with zipfile.ZipFile(path) as archive:
        shared: list[str] = []
        if "xl/sharedStrings.xml" in archive.namelist():
            root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            shared = ["".join(node.text or "" for node in item.iter(NS + "t")) for item in root.findall(NS + "si")]

        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        relationships = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        targets = {node.attrib["Id"]: node.attrib["Target"] for node in relationships}
        first_sheet = workbook.find(NS + "sheets")[0]
        target = targets[first_sheet.attrib[RNS + "id"]].lstrip("/")
        if not target.startswith("xl/"):
            target = "xl/" + target
        worksheet = ET.fromstring(archive.read(target))
        output: list[list[str]] = []
        sheet_data = worksheet.find(NS + "sheetData")
        if sheet_data is None:
            return output
        for row in sheet_data:
            values: dict[int, str] = {}
            for cell in row:
                position = column_number(cell.attrib.get("r", "A1"))
                cell_type = cell.attrib.get("t")
                value_node = cell.find(NS + "v")
                inline = cell.find(NS + "is")
                value = ""
                if inline is not None:
                    value = "".join(node.text or "" for node in inline.iter(NS + "t"))
                elif value_node is not None:
                    raw = value_node.text or ""
                    value = shared[int(raw)] if cell_type == "s" and raw.isdigit() else raw
                values[position] = clean_text(value)
            output.append([values.get(index, "") for index in range(1, max(values, default=0) + 1)])
        return output


def excel_date(value: str) -> str:
    try:
        serial = float(value)
    except (TypeError, ValueError):
        return ""
    return (dt.datetime(1899, 12, 30) + dt.timedelta(days=serial)).strftime("%d %b %Y")


def build_training_data() -> tuple[list[dict], list[dict]]:
    schedule_rows = read_xlsx_rows(ASSETS / "Schedule sebi 2026 updated till 21st oct.xlsx")
    sessions: list[dict] = []
    current_day = ""
    current_date = ""
    for row in schedule_rows:
        cells = row + ["", "", ""]
        first, second, third = cells[:3]
        if re.match(r"^.?Day\s+\d+", first, re.IGNORECASE):
            current_day = re.sub(r"^[^A-Za-z]+", "", first)
            current_date = excel_date(second)
            continue
        if not re.search(r"\d", first) or not second:
            continue
        if any(term in second.lower() for term in ("tea/coffee", "lunch", "group photograph")):
            continue
        sessions.append({
            "day": current_day,
            "date": current_date,
            "time": first,
            "topic": second,
            "speaker": third or "NISM / SEBI faculty",
        })

    allocation_rows = read_xlsx_rows(ASSETS / "Allocated List FINAL.xlsx")
    featured: list[dict] = []
    seen: set[tuple[str, str]] = set()
    for row in allocation_rows:
        cells = row + [""] * 9
        name, designation, topic = cells[3], cells[4], cells[6]
        if not name or name.lower() in {"ed", "wtm"}:
            continue
        key = (name.lower(), topic.lower())
        if key in seen:
            continue
        seen.add(key)
        source_id = re.sub(r"\.0$", "", cells[0])
        featured.append({"name": name, "designation": designation, "topic": topic or "Address to the batch", "sourceId": source_id})
    return sessions, featured


ALBUM_SOURCES = [
    ("inauguration", "Inauguration", "The opening ceremony and the first day together.", ["1. INAUGURAL PHOTS"]),
    ("chairman", "Batch with the Chairman", "Formal batch photographs marking the induction.", ["2. BATCH PHOTO WITH CHAIRMAN"]),
    ("nse", "NSE Visit", "Learning inside a core Indian market institution.", ["6A. VISITS OR ATTACHMENTS/1. NSE VISIT"]),
    ("hyderabad", "Hyderabad Attachment", "Institutional exposure and shared travel memories.", ["6A. VISITS OR ATTACHMENTS/2. HYDERABAD VISIT"]),
    ("bse", "BSE Visit", "A day at the historic heart of Dalal Street.", ["6A. VISITS OR ATTACHMENTS/3. BSE VISIT"]),
    ("delhi", "Delhi Attachment", "The batch on assignment in the national capital.", ["6A. VISITS OR ATTACHMENTS/4. DELHI VISIT"]),
    ("ahmedabad", "Ahmedabad Attachment", "Learning, travel, and evenings on the road.", ["6A. VISITS OR ATTACHMENTS/5. AHEMDABAD VISIT"]),
    ("chess", "Chess Tournament", "Quiet concentration and spirited competition.", ["10. TOURNAMENTS AND OTHER ACTIVITIES/1. CHESS"]),
    ("trek", "Trek", "Monsoon trails beyond the classroom.", ["10. TOURNAMENTS AND OTHER ACTIVITIES/3. TREK"]),
    ("team-building", "Team Building", "Activities that turned a new batch into one team.", ["10. TOURNAMENTS AND OTHER ACTIVITIES/4.. TEAM BUILDING ACTIVITIES"]),
    ("cricket", "Cricket", "Floodlights, friendly rivalry, and loud support.", ["10. TOURNAMENTS AND OTHER ACTIVITIES/5. CRICKET"]),
    ("hindi-diwas", "Hindi Diwas", "Language, culture, and performances by the batch.", ["10. TOURNAMENTS AND OTHER ACTIVITIES/6. HINDI DIWAS"]),
    ("batch-life", "Batch Life", "The unplanned frames that made Patalganga feel like home.", ["12A. GROUP PHOTOS", "12. RANDOM PICTURES"]),
    ("rbi", "RBI Visit", "Photographs from the batch's visit to the Reserve Bank of India.", ["6A. VISITS OR ATTACHMENTS/6. RBI"]),
    ("campus-diaries", "NISM Diaries", "Everyday company, familiar corners, and the quieter moments between sessions.", []),
]

SUPPLEMENTARY_FOLDERS = {
    "delhi": ["2. Delhi Attachment"],
    "ahmedabad": ["3. Ahemdabad Attachment"],
    "hyderabad": ["6. hyderabad visit"],
    "chess": ["Chess Tournament"],
    "batch-life": ["1. Personal or Group Photos"],
    "campus-diaries": ["5. Miscellaneous NISM Diaries"],
}

ALBUM_DETAILS = {
    "inauguration": ("milestones", "NISM Patalganga", "29 July 2026", ["The opening ceremony", "The auditorium and dais", "The first day as a batch"]),
    "chairman": ("milestones", "NISM Patalganga", "Induction 2026", ["The formal batch portrait", "A shared beginning", "A photograph to return to"]),
    "nse": ("visits", "Mumbai", "Institutional visit", ["The exchange visit", "Market institutions", "The batch on location"]),
    "bse": ("visits", "Mumbai", "Institutional visit", ["A visit to BSE", "Dalal Street", "Learning beyond campus"]),
    "delhi": ("visits", "Delhi", "Attachment", ["The national capital", "Institutional exposure", "Time together on the road"]),
    "ahmedabad": ("visits", "Ahmedabad", "Attachment", ["A different city", "Learning on assignment", "Shared travel memories"]),
    "hyderabad": ("visits", "Hyderabad", "Attachment", ["The Hyderabad attachment", "Institutional visits", "A new backdrop for the batch"]),
    "rbi": ("visits", "RBI", "Institutional visit", ["An institutional visit", "The batch together", "A part of our learning journey"]),
    "chess": ("activities", "NISM Patalganga", "Beyond the classroom", ["Across the chessboard", "Friendly competition", "Concentration and camaraderie"]),
    "cricket": ("activities", "NISM Patalganga", "Beyond the classroom", ["Time on the ground", "A shared love of the game", "Teammates beyond training"]),
    "trek": ("activities", "The hills around Patalganga", "Beyond the classroom", ["Out on the trails", "A change of pace", "The landscape around campus"]),
    "team-building": ("activities", "NISM Patalganga", "Beyond the classroom", ["Activities together", "Cooperation in action", "Building batch connections"]),
    "hindi-diwas": ("activities", "NISM Patalganga", "Cultural activities", ["Language and expression", "The batch takes part", "A day of shared culture"]),
    "batch-life": ("everyday", "In and around NISM", "Everyday memories", ["Group photographs", "The people around us", "Moments between milestones"]),
    "campus-diaries": ("everyday", "NISM Patalganga", "Everyday memories", ["Life around campus", "Time between sessions", "A place we shared"]),
}


def build_albums() -> tuple[list[dict], list[dict]]:
    albums: list[dict] = []
    media: list[dict] = []
    roots = [ASSETS / "0.SORTED", ASSETS / "0.SORTED_1"]
    previous = json.loads(MANIFEST_OUT.read_text(encoding="utf-8")) if MANIFEST_OUT.exists() else []
    known_hashes: set[str] = set()
    for slug, title, description, relative_dirs in ALBUM_SOURCES:
        candidates: list[Path] = []
        for root in roots:
            for relative in relative_dirs:
                folder = root / Path(relative)
                if folder.exists():
                    candidates.extend(path for path in folder.rglob("*") if path.is_file() and path.suffix.lower() in WEB_IMAGE_EXTENSIONS)
        for folder_name in SUPPLEMENTARY_FOLDERS.get(slug, []):
            folder = ASSETS / "SEARCHED ALREADY" / folder_name
            if folder.exists():
                candidates.extend(path for path in folder.rglob("*") if path.is_file() and path.suffix.lower() in WEB_IMAGE_EXTENSIONS)
        # Retain existing image numbering before adding new frames.
        retained = [ROOT / item["source"] for item in previous if item["destination"].startswith(f"media/albums/{slug}/") and (ROOT / item["source"]).exists()]
        unique: dict[str, Path] = {}
        for candidate in retained + sorted(candidates, key=lambda p: (p.stat().st_size, p.name.lower())):
            unique.setdefault(candidate.name.lower().replace("copy of ", ""), candidate)
        selected = []
        album_hashes: set[str] = set()
        for candidate in unique.values():
            digest = hashlib.sha256(candidate.read_bytes()).hexdigest()
            if digest not in album_hashes and digest not in known_hashes:
                known_hashes.add(digest)
                album_hashes.add(digest)
                selected.append(candidate)
        photos: list[str] = []
        for index, source in enumerate(selected, 1):
            destination = f"media/albums/{slug}/{index:02d}.jpg"
            photos.append(destination)
            media.append({"source": str(source.relative_to(ROOT)), "destination": destination, "width": 1500, "height": 1100, "quality": 84})
        category, location, period, highlights = ALBUM_DETAILS[slug]
        if photos:
            albums.append({"slug": slug, "title": title, "description": description, "photos": photos, "category": category, "location": location, "period": period, "highlights": highlights})
    return albums, media


def build_speaker_media(speakers: list[dict]) -> list[dict]:
    portraits: dict[str, Path] = {}
    for root in [ASSETS / "0.SORTED", ASSETS / "0.SORTED_1"]:
        folder = root / "0.Magazine Final" / "6. SPEAKERS FINAL"
        if not folder.exists():
            continue
        for path in sorted(folder.iterdir()):
            if path.suffix.lower() not in WEB_IMAGE_EXTENSIONS:
                continue
            prefix = path.name.split(".")[0]
            for code in re.findall(r"\d+[a-zA-Z]?", prefix):
                portraits.setdefault(code.lower(), path)
    media = []
    for index, speaker in enumerate(speakers, 1):
        source = portraits.get(speaker["sourceId"].lower())
        if source:
            destination = f"media/speakers/{index:03d}.jpg"
            speaker["photo"] = destination
            media.append({"source": str(source.relative_to(ROOT)), "destination": destination, "width": 480, "height": 600, "quality": 82})
    return media


def main() -> None:
    officers, officer_media = find_officers()
    sessions, featured_speakers = build_training_data()
    albums, album_media = build_albums()
    speaker_media = build_speaker_media(featured_speakers)
    curation = json.loads((ROOT / "data" / "curation.json").read_text(encoding="utf-8"))
    payload = {
        "batch": {"title": "SEBI Grade A Officers · Batch 2025–26", "location": "NISM Patalganga", "officerCount": 130},
        "officers": officers,
        "sessions": sessions,
        "featuredSpeakers": featured_speakers,
        "albums": albums,
        "curation": curation,
    }
    DATA_OUT.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST_OUT.parent.mkdir(parents=True, exist_ok=True)
    DATA_OUT.write_text("window.PORTAL_DATA = " + json.dumps(payload, ensure_ascii=False, indent=2) + ";\n", encoding="utf-8")
    MANIFEST_OUT.write_text(json.dumps(officer_media + album_media + speaker_media, ensure_ascii=False, indent=2), encoding="utf-8")
    selection = json.loads((ROOT / "scripts" / "private-room508.selection.json").read_text(encoding="utf-8"))
    private_manifest = [{
        "source": str((ASSETS / "508_Photos" / name).relative_to(ROOT)),
        "destination": f"build/private-room508-media/{index:02d}.jpg",
        "width": 1500, "height": 1100, "quality": 84
    } for index, name in enumerate(selection, 1)]
    (ROOT / "build" / "private-room508-manifest.json").write_text(json.dumps(private_manifest, indent=2), encoding="utf-8")
    print(f"Built {len(officers)} officers, {len(sessions)} sessions, {len(featured_speakers)} featured speakers, and {len(albums)} albums.")
    print(f"Media manifest contains {len(officer_media) + len(album_media) + len(speaker_media)} images.")


if __name__ == "__main__":
    main()
