from __future__ import annotations

import json
import re
import time
from pathlib import Path
from urllib.parse import quote
from urllib.request import Request, urlopen


ORGS_PATH = Path("server/data/organizations.json")
SEARCH_ENDPOINT = "https://duckduckgo.com/html/?q="


def fetch_html(url: str) -> str:
    request = Request(
        url=url,
        headers={
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)",
            "Accept": "text/html",
        },
    )
    with urlopen(request, timeout=15) as response:
        return response.read().decode("utf-8", errors="ignore")


def extract_candidate_urls(html: str) -> list[str]:
    urls: list[str] = []
    for match in re.findall(r"uddg=([^\"&]+)", html):
        try:
            decoded = match.replace("%3A", ":").replace("%2F", "/")
            decoded = re.sub(r"%([0-9A-Fa-f]{2})", lambda m: bytes.fromhex(m.group(1)).decode("latin1"), decoded)
            if decoded.startswith("http://") or decoded.startswith("https://"):
                urls.append(decoded)
        except Exception:
            continue
    return urls


def pick_website(urls: list[str]) -> str | None:
    blocked = (
        "charitynavigator.org",
        "guidestar.org",
        "causeiq.com",
        "facebook.com",
        "instagram.com",
        "linkedin.com",
        "wikipedia.org",
        "x.com",
        "twitter.com",
    )
    for url in urls:
        if any(domain in url for domain in blocked):
            continue
        return url
    return None


def append_note(existing: str, note: str) -> str:
    existing_text = (existing or "").strip()
    if not existing_text:
        return note
    if note in existing_text:
        return existing_text
    return f"{existing_text} | {note}"


def main() -> None:
    organizations = json.loads(ORGS_PATH.read_text(encoding="utf-8"))
    updated = 0
    unresolved = 0

    for org in organizations:
        if org.get("website"):
            continue
        name = str(org.get("organizationName", "")).strip()
        if not name:
            continue
        try:
            html = fetch_html(f"{SEARCH_ENDPOINT}{quote(name + ' official website')}")
            urls = extract_candidate_urls(html)
            website = pick_website(urls)
            if website:
                org["website"] = website
                org["notes"] = append_note(str(org.get("notes", "")), "Website discovered from public search results.")
                updated += 1
            else:
                unresolved += 1
        except Exception:
            unresolved += 1
        time.sleep(0.2)

    ORGS_PATH.write_text(json.dumps(organizations, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Websites updated: {updated}")
    print(f"Websites unresolved: {unresolved}")


if __name__ == "__main__":
    main()
