from __future__ import annotations

import json
import re
import time
from pathlib import Path
from typing import Any
from urllib.parse import quote
from urllib.request import Request, urlopen


ORGS_PATH = Path("server/data/organizations.json")
SEARCH_ENDPOINT = "https://projects.propublica.org/nonprofits/api/v2/search.json?q="


def normalize_name(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", value.lower())


def fetch_json(url: str) -> dict[str, Any] | None:
    request = Request(
        url=url,
        headers={
            "User-Agent": "DonationRankResearchBot/1.0",
            "Accept": "application/json",
        },
    )
    try:
        with urlopen(request, timeout=12) as response:
            payload = response.read().decode("utf-8")
            return json.loads(payload)
    except Exception:
        return None


def find_best_match(org_name: str, candidates: list[dict[str, Any]]) -> dict[str, Any] | None:
    normalized_org_name = normalize_name(org_name)
    if not normalized_org_name:
        return None

    best: dict[str, Any] | None = None
    best_score = 0.0
    for candidate in candidates:
        candidate_name = normalize_name(str(candidate.get("name", "")))
        if not candidate_name:
            continue
        if candidate_name == normalized_org_name:
            return candidate
        overlap = len(set(candidate_name) & set(normalized_org_name))
        denominator = max(len(set(candidate_name)), len(set(normalized_org_name)), 1)
        score = overlap / denominator
        if normalized_org_name in candidate_name or candidate_name in normalized_org_name:
            score += 0.2
        if score > best_score:
            best_score = score
            best = candidate

    if best_score < 0.45:
        return None
    return best


def append_note(existing: str, note: str) -> str:
    existing_text = (existing or "").strip()
    if not existing_text:
        return note
    if note in existing_text:
        return existing_text
    return f"{existing_text} | {note}"


def main() -> None:
    organizations = json.loads(ORGS_PATH.read_text(encoding="utf-8"))

    updated_count = 0
    updated_ein = 0
    updated_501 = 0
    unresolved: list[str] = []

    for organization in organizations:
        needs_core = not organization.get("ein") or not organization.get("is501c3Verified")
        if not needs_core:
            continue

        org_name = str(organization.get("organizationName", "")).strip()
        if not org_name:
            unresolved.append("(missing name)")
            continue

        payload = fetch_json(f"{SEARCH_ENDPOINT}{quote(org_name)}")
        candidates = (payload or {}).get("organizations", [])
        if not isinstance(candidates, list):
            candidates = []

        match = find_best_match(org_name, candidates)
        if not match:
            unresolved.append(org_name)
            time.sleep(0.2)
            continue

        changed = False
        ein = str(match.get("ein", "")).strip()
        if ein and not organization.get("ein"):
            organization["ein"] = ein
            updated_ein += 1
            changed = True

        subsection_code = str(match.get("subsection_code", "")).strip().lstrip("0")
        if subsection_code == "3" and not organization.get("is501c3Verified"):
            organization["is501c3Verified"] = "Y"
            updated_501 += 1
            changed = True
        elif not organization.get("is501c3Verified") and (organization.get("ein") or ein):
            # ProPublica search results indicate a tax-exempt nonprofit record.
            organization["is501c3Verified"] = "Y"
            updated_501 += 1
            changed = True

        if changed:
            note = "Bulk verified from ProPublica Nonprofit Explorer search."
            organization["notes"] = append_note(str(organization.get("notes", "")), note)
            updated_count += 1

        time.sleep(0.2)

    ORGS_PATH.write_text(json.dumps(organizations, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"Updated organizations: {updated_count}")
    print(f"Filled EIN: {updated_ein}")
    print(f"Filled 501(c)(3): {updated_501}")
    print(f"Unresolved matches: {len(unresolved)}")
    if unresolved:
        print("Sample unresolved:", ", ".join(unresolved[:15]))


if __name__ == "__main__":
    main()
