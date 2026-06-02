from __future__ import annotations

import json
from pathlib import Path


ORGS_PATH = Path("server/data/organizations.json")

MANUAL_UPDATES = {
    "Cure Alzheimer’s Fund": {
        "website": "https://curealz.org/",
        "ein": "52-2396428",
        "is501c3Verified": "Y",
        "notes_append": "Manually verified from official site: 501(c)(3) status and EIN confirmed.",
    },
    "Reservation Animal Rescue": {
        "website": "https://nativepartnership.org/animal-welfare/",
        "ein": "47-3730147",
        "is501c3Verified": "Y",
        "notes_append": "Appears to be a program of Partnership With Native Americans (PWNA); EIN is parent organization.",
    },
    "International Fund for Animal Welfare (IFAW)": {
        "website": "https://www.ifaw.org/",
        "ein": "31-1594197",
        "is501c3Verified": "Y",
        "notes_append": "Manually verified from nonprofit profile sources.",
    },
    "National Anti-Vivsection Society": {
        "website": "https://navs.org/",
        "ein": "36-2229588",
        "is501c3Verified": "Y",
        "notes_append": "Manually verified from charity profile sources.",
    },
    "Little Longears Miniature Donkey Rescue": {
        "website": "https://littlelongears.org/",
        "ein": "46-4921857",
        "is501c3Verified": "Y",
        "notes_append": "Manually verified from official and charity profile sources.",
    },
    "MSPCA": {
        "website": "https://www.mspca.org/",
        "ein": "04-2103597",
        "is501c3Verified": "Y",
        "notes_append": "MSPCA-Angell legal entity manually verified from official source.",
    },
    "Houston SPCA": {
        "website": "https://houstonspca.org/",
        "ein": "74-1287171",
        "is501c3Verified": "Y",
        "notes_append": "Manually verified from official and charity profile sources.",
    },
    "Dharma Rescue for Cats & Dogs": {
        "website": "https://www.dharmarescue.org/",
        "ein": "80-0266821",
        "is501c3Verified": "Y",
        "notes_append": "Manually verified from official and charity profile sources.",
    },
    "Alzheimer’s Assoc": {
        "website": "https://www.alz.org/",
        "ein": "13-3039601",
        "is501c3Verified": "Y",
        "notes_append": "Manually verified from official and charity profile sources.",
    },
}


def append_note(existing: str, note: str) -> str:
    existing_text = (existing or "").strip()
    if not existing_text:
        return note
    if note in existing_text:
        return existing_text
    return f"{existing_text} | {note}"


def main() -> None:
    if not ORGS_PATH.exists():
        raise FileNotFoundError(f"Could not find {ORGS_PATH}")

    organizations = json.loads(ORGS_PATH.read_text(encoding="utf-8"))
    updated_count = 0

    for organization in organizations:
        name = organization.get("organizationName", "")
        if name not in MANUAL_UPDATES:
            continue

        update = MANUAL_UPDATES[name]
        organization["website"] = update["website"]
        organization["ein"] = update["ein"]
        organization["is501c3Verified"] = update["is501c3Verified"]
        organization["notes"] = append_note(organization.get("notes", ""), update["notes_append"])
        updated_count += 1

    ORGS_PATH.write_text(json.dumps(organizations, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Updated organizations: {updated_count}")


if __name__ == "__main__":
    main()
