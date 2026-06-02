#!/usr/bin/env python3
"""Extract Part III program accomplishments from Form 990 PDFs and update impactEvidenceNotes."""

from __future__ import annotations

import argparse
import json
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

import pdfplumber

ROOT = Path(__file__).resolve().parents[1]
PDF_DIR = ROOT / "info" / "form-990s"
ORGS_PATH = ROOT / "server" / "data" / "organizations.json"
ALIASES_PATH = ROOT / "server" / "data" / "form-990-pdf-org-aliases.json"

EIN_PATTERN = re.compile(r"\b(\d{2}-\d{7}|\d{9})\b")
YEAR_PATTERN = re.compile(r"(20\d{2})")
NOISE_PATTERNS = [
    re.compile(r"^\d{1,2}/\d{1,2}/\d{2,4}.*ProPublica$"),
    re.compile(r"^Form 990 \(20\d{2}\) Page \d+$"),
    re.compile(r"^Page \d+$"),
    re.compile(r"^For Paperwork Reduction Act Notice.*$"),
]


@dataclass
class ImpactExtraction:
    filename: str
    ein: str | None
    tax_year: str | None
    mission: str | None
    accomplishments: str | None
    impact_note: str | None
    error: str | None = None


def normalize_ein(value: str) -> str:
    digits = re.sub(r"\D", "", value)
    if len(digits) == 9:
        return f"{digits[:2]}-{digits[2:]}"
    return value.strip()


def clean_line(line: str) -> str:
    line = re.sub(r"\s+", " ", line).strip()
    for pattern in NOISE_PATTERNS:
        if pattern.match(line):
            return ""
    return line


def extract_full_text(pdf_path: Path, max_pages: int = 15) -> str:
    chunks: list[str] = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages[:max_pages]:
            text = page.extract_text() or ""
            chunks.append(text)
    return "\n".join(chunks)


def extract_ein_and_year(text: str) -> tuple[str | None, str | None]:
    ein: str | None = None
    tax_year: str | None = None

    for line in text.split("\n"):
        lower = line.lower()
        if not ein and "employer identification number" in lower:
            match = EIN_PATTERN.search(line)
            if match:
                ein = normalize_ein(match.group(1))
        if not tax_year and lower.startswith("for the year ending"):
            year_match = YEAR_PATTERN.search(line)
            if year_match:
                tax_year = year_match.group(1)
        if not tax_year:
            form_match = re.search(r"form 990 \(?(20\d{2})\)?", lower)
            if form_match:
                tax_year = form_match.group(1)

    if not ein:
        for line in text.split("\n"):
            if "employer identification number" in line.lower():
                match = EIN_PATTERN.search(line)
                if match:
                    ein = normalize_ein(match.group(1))
                    break

    return ein, tax_year


def extract_mission(text: str) -> str | None:
    match = re.search(
        r"Briefly describe the organization[’']s mission:\s*(.+?)(?:\n2 Did the organization|\n2 Did the|$)",
        text,
        flags=re.IGNORECASE | re.DOTALL,
    )
    if not match:
        return None
    mission = re.sub(r"\s+", " ", match.group(1)).strip()
    return mission[:400] if mission else None


def extract_part_iii_accomplishments(text: str) -> str | None:
    start_match = re.search(r"Part III Statement of Program Service Accomplishments", text, flags=re.IGNORECASE)
    if not start_match:
        return None

    section = text[start_match.start() :]
    end_match = re.search(r"Part IV Checklist of Required Schedules|4e Total program service expenses", section, flags=re.IGNORECASE)
    if end_match:
        section = section[: end_match.start()]

    program_blocks: list[str] = []
    block_pattern = re.compile(
        r"4[a-d]\s*\(Code:[^\n]*\)\s*(?:\(Expenses[^\n]*\)\s*(?:\(Revenue[^\n]*\)\s*)?)?(.+?)(?=4[a-d]\s*\(Code:|4e Total program service expenses|Part IV|$)",
        flags=re.IGNORECASE | re.DOTALL,
    )
    for match in block_pattern.finditer(section):
        block = re.sub(r"\s+", " ", match.group(1)).strip()
        block = clean_line(block)
        if len(block) >= 40 and "did the organization" not in block.lower():
            program_blocks.append(block)

    if not program_blocks:
        schedule_match = re.search(
            r"Schedule O[\s\S]{0,4000}?(?:program service accomplishments|describe the organization[’']s program service accomplishments)([\s\S]{0,2500})",
            text,
            flags=re.IGNORECASE,
        )
        if schedule_match:
            schedule_text = re.sub(r"\s+", " ", schedule_match.group(1)).strip()
            if len(schedule_text) >= 80:
                return schedule_text[:1200]

    if not program_blocks:
        return None

    merged = " ".join(program_blocks[:3])
    merged = re.sub(r"\(Expenses \$[\d,]+ including grants of \$[\d,]*\) \(Revenue \$[\d,]*\)", "", merged)
    merged = re.sub(r"\s+", " ", merged).strip()

    if len(merged) < 80:
        return None

    return merged[:1200]


def summarize_numbers(text: str) -> list[str]:
    snippets: list[str] = []
    patterns = [
        r"\b\d[\d,]*(?:\.\d+)?\s*(?:million|billion|thousand)\b[^.;]{0,40}",
        r"\b\d[\d,]*(?:\.\d+)?\s*(?:animals|dogs|cats|horses|acres|people|clients|patients|participants|adoptions|rescues|investigations|convictions|operations|states|countries|grants|projects|investigators|surgeries|transports|placements|volunteers|members|donors|meals|pounds|miles|hours|visits|calls|cases|laws|bills|veterans|teams|pairs|guides|puppies|kittens|birds|wildlife|sanctuaries|farms|ranches|facilities|centers|programs|services|events|trainings|workshops|sessions|classes|students|schools|communities|households|families|individuals|beneficiaries|recipients|supporters|partners|agencies|officers|employees|staff|volunteers)\b[^.;]{0,30}",
        r"\$\s?\d[\d,]*(?:\.\d+)?(?:\s*(?:million|billion|thousand))?\b[^.;]{0,30}",
        r"\b\d[\d,]*(?:\.\d+)?%\b[^.;]{0,30}",
    ]
    for pattern in patterns:
        for match in re.finditer(pattern, text, flags=re.IGNORECASE):
            snippet = re.sub(r"\s+", " ", match.group(0)).strip(" ,;")
            if len(snippet) >= 4 and snippet not in snippets:
                snippets.append(snippet)
            if len(snippets) >= 6:
                return snippets
    return snippets


def build_impact_note(tax_year: str | None, accomplishments: str, filename: str) -> str:
    year_label = f"TY{tax_year}" if tax_year else "latest filing"
    number_snippets = summarize_numbers(accomplishments)
    summary = accomplishments
    if len(summary) > 450:
        sentence_end = summary.rfind(".", 0, 450)
        summary = summary[: sentence_end + 1] if sentence_end > 120 else summary[:447].rstrip() + "..."

    parts = [f"Form 990 {year_label} Part III program accomplishments:"]
    if number_snippets:
        parts.append("Key quantified outcomes: " + "; ".join(number_snippets[:5]) + ".")
    parts.append(summary)
    parts.append(f"Source: Form 990 PDF ({filename}).")
    return " ".join(parts)


def extract_from_pdf(pdf_path: Path) -> ImpactExtraction:
    try:
        text = extract_full_text(pdf_path)
    except Exception as error:  # noqa: BLE001
        return ImpactExtraction(pdf_path.name, None, None, None, None, None, str(error))

    ein, tax_year = extract_ein_and_year(text)
    mission = extract_mission(text)
    accomplishments = extract_part_iii_accomplishments(text)
    if not accomplishments:
        return ImpactExtraction(
            pdf_path.name,
            ein,
            tax_year,
            mission,
            None,
            None,
            "Could not extract Part III program accomplishments.",
        )

    impact_note = build_impact_note(tax_year, accomplishments, pdf_path.name)
    return ImpactExtraction(pdf_path.name, ein, tax_year, mission, accomplishments, impact_note, None)


def find_org_by_ein(organizations: list[dict], ein: str | None) -> dict | None:
    if not ein:
        return None
    normalized = normalize_ein(ein)
    for organization in organizations:
        org_ein = normalize_ein(str(organization.get("ein", "")))
        if org_ein == normalized:
            return organization
    return None


def normalize_name(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", value.lower())


def filename_to_org_name(filename: str) -> str:
    base = filename.replace(" - Full Filing - Nonprofit Explorer - ProPublica.pdf", "")
    base = base.replace(".pdf", "")
    return base.strip()


def load_pdf_aliases() -> dict[str, str]:
    if not ALIASES_PATH.exists():
        return {}
    return json.loads(ALIASES_PATH.read_text(encoding="utf-8"))


def find_org(organizations: list[dict], ein: str | None, filename: str, aliases: dict[str, str]) -> dict | None:
    by_ein = find_org_by_ein(organizations, ein)
    if by_ein:
        return by_ein

    pdf_key = filename_to_org_name(filename)
    alias_name = aliases.get(pdf_key)
    if alias_name:
        alias_norm = normalize_name(alias_name)
        for organization in organizations:
            if normalize_name(str(organization.get("organizationName", ""))) == alias_norm:
                return organization

    candidate = normalize_name(pdf_key)
    if not candidate:
        return None

    best: dict | None = None
    best_score = 0
    for organization in organizations:
        org_name = normalize_name(str(organization.get("organizationName", "")))
        if not org_name:
            continue
        if candidate in org_name or org_name in candidate:
            score = min(len(candidate), len(org_name))
            if score > best_score:
                best = organization
                best_score = score
    return best


def should_replace_impact_notes(existing: str, force: bool) -> bool:
    normalized = existing.strip().lower()
    if not normalized:
        return True
    if force:
        return True
    if normalized.startswith("form 990") and "part iii" in normalized:
        return False
    return True


def apply_result(
    organization: dict,
    result: ImpactExtraction,
    force: bool = False,
    merge_manual: bool = False,
) -> str:
    if not result.impact_note:
        return "skipped"

    existing = str(organization.get("impactEvidenceNotes", "")).strip()
    if not should_replace_impact_notes(existing, force):
        return "skipped"

    now = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    if merge_manual and existing and not existing.lower().startswith("form 990"):
        organization["impactEvidenceNotes"] = f"{result.impact_note} Additional research: {existing}"
        mode = "merged"
    else:
        organization["impactEvidenceNotes"] = result.impact_note
        mode = "applied"

    source_meta = organization.setdefault("sourceMeta", {})
    source_meta["impactEvidenceNotes"] = {
        "sourceName": "Form 990 PDF Part III extraction",
        "fetchedAt": now,
        "confidenceNote": f"Impact evidence extracted from Part III program accomplishments (TY{result.tax_year or 'unknown'}).",
        "sourceType": "ProPublica/Form 990",
        "reliability": "high",
    }
    return mode


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract Form 990 Part III impact notes from uploaded PDFs.")
    parser.add_argument("--apply", action="store_true", help="Write extracted impact notes into organizations.json")
    parser.add_argument("--force", action="store_true", help="Replace existing Form 990 Part III notes")
    parser.add_argument("--merge-manual", action="store_true", help="Keep manual notes after the 990 extract")
    parser.add_argument("--pdf-dir", type=Path, default=PDF_DIR, help="Directory containing Form 990 PDF files")
    args = parser.parse_args()

    pdf_files = sorted(args.pdf_dir.glob("*.pdf"))
    if not pdf_files:
        print(f"No PDF files found in {args.pdf_dir}")
        return

    results = [extract_from_pdf(path) for path in pdf_files]
    success_count = sum(1 for result in results if result.impact_note)
    error_count = sum(1 for result in results if result.error)

    print(json.dumps({"processed": len(results), "success": success_count, "errors": error_count}, indent=2))

    if not args.apply:
        print("\nSample successes:")
        for result in results[:3]:
            if result.impact_note:
                print(f"\n{result.filename}\n{result.impact_note[:400]}...")
        print("\nDry run only. Re-run with --apply to update organizations.json.")
        return

    organizations = json.loads(ORGS_PATH.read_text(encoding="utf-8"))
    aliases = load_pdf_aliases()
    applied: list[str] = []
    merged: list[str] = []
    skipped: list[str] = []

    for result in results:
        organization = find_org(organizations, result.ein, result.filename, aliases)
        if not organization:
            skipped.append(f"{result.filename}: no matching organization ({result.ein})")
            continue
        if result.error:
            skipped.append(f"{result.filename}: {result.error}")
            continue
        mode = apply_result(organization, result, force=args.force, merge_manual=args.merge_manual)
        if mode == "applied":
            applied.append(organization["organizationName"])
        elif mode == "merged":
            merged.append(organization["organizationName"])
        else:
            skipped.append(f"{result.filename}: existing Form 990 note kept for {organization['organizationName']}")

    ORGS_PATH.write_text(json.dumps(organizations, indent=2), encoding="utf-8")
    print(f"\nApplied impact notes for {len(applied)} organizations.")
    if merged:
        print(f"Merged impact notes for {len(merged)} organizations.")
    if skipped:
        print(f"Skipped {len(skipped)} files.")
        for item in skipped[:15]:
            print(f"  - {item}")


if __name__ == "__main__":
    main()
