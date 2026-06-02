#!/usr/bin/env python3
"""Extract Form 990 functional expense ratios from PDFs in info/form-990s/."""

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

NUMBER_PATTERN = re.compile(r"\b\d{1,3}(?:,\d{3})+\b|\b\d+\b")
EIN_PATTERN = re.compile(r"\b(\d{2}-\d{7}|\d{9})\b")


@dataclass
class ExtractionResult:
    filename: str
    ein: str | None
    tax_year: str | None
    program: float | None
    fundraising: float | None
    admin: float | None
    program_percent: float | None
    fundraising_percent: float | None
    admin_percent: float | None
    error: str | None = None


def normalize_ein(value: str) -> str:
    digits = re.sub(r"\D", "", value)
    if len(digits) == 9:
        return f"{digits[:2]}-{digits[2:]}"
    return value.strip()


def parse_amount(text: str) -> int | None:
    matches = NUMBER_PATTERN.findall(text)
    if not matches:
        return None
    return int(matches[-1].replace(",", ""))


def extract_lines(pdf_path: Path) -> list[str]:
    lines: list[str] = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages[:6]:
            text = page.extract_text() or ""
            lines.extend(line.strip() for line in text.split("\n") if line.strip())
    return lines


def extract_from_pdf(pdf_path: Path) -> ExtractionResult:
    try:
        lines = extract_lines(pdf_path)
    except Exception as error:  # noqa: BLE001
        return ExtractionResult(
            filename=pdf_path.name,
            ein=None,
            tax_year=None,
            program=None,
            fundraising=None,
            admin=None,
            program_percent=None,
            fundraising_percent=None,
            admin_percent=None,
            error=str(error),
        )

    ein: str | None = None
    tax_year: str | None = None
    program: int | None = None
    fundraising: int | None = None
    admin: int | None = None
    total_expenses: int | None = None

    for line in lines:
        lower = line.lower()
        if not ein and "employer identification number" in lower:
            match = EIN_PATTERN.search(line)
            if match:
                ein = normalize_ein(match.group(1))
        if not tax_year and lower.startswith("for the year ending"):
            year_match = re.search(r"(20\d{2})", line)
            if year_match:
                tax_year = year_match.group(1)
        if "total program service expenses" in lower:
            program = parse_amount(line)
        if "total fundraising expenses" in lower:
            fundraising = parse_amount(line)
        if "management and general expenses" in lower and "total" in lower:
            admin = parse_amount(line)
        if "total expenses. add lines 13" in lower or "total expenses. add lines 13-17" in lower:
            total_expenses = parse_amount(line)

    if program is None or total_expenses is None:
        return ExtractionResult(
            filename=pdf_path.name,
            ein=ein,
            tax_year=tax_year,
            program=float(program) if program else None,
            fundraising=float(fundraising) if fundraising else None,
            admin=float(admin) if admin else None,
            program_percent=None,
            fundraising_percent=None,
            admin_percent=None,
            error="Could not find program/total expense lines in PDF.",
        )

    if fundraising is None:
        fundraising = 0
    if admin is None:
        admin = max(total_expenses - program - fundraising, 0)

    return ExtractionResult(
        filename=pdf_path.name,
        ein=ein,
        tax_year=tax_year,
        program=float(program),
        fundraising=float(fundraising),
        admin=float(admin),
        program_percent=round(program / total_expenses * 100, 1),
        fundraising_percent=round(fundraising / total_expenses * 100, 1),
        admin_percent=round(admin / total_expenses * 100, 1),
    )


def find_org_by_ein(organizations: list[dict], ein: str | None) -> dict | None:
    if not ein:
        return None
    normalized = normalize_ein(ein)
    for organization in organizations:
        org_ein = normalize_ein(str(organization.get("ein", "")))
        if org_ein == normalized:
            return organization
    return None


def apply_result(organization: dict, result: ExtractionResult) -> None:
    if result.program_percent is None:
        return

    now = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    tax_year = result.tax_year or "latest"
    organization["programPercent"] = result.program_percent
    organization["fundraisingPercent"] = result.fundraising_percent
    organization["adminPercent"] = result.admin_percent
    organization["lastRefreshedAt"] = now

    note = (
        f"Manual Form 990 extraction (TY{tax_year}): Program {result.program_percent}%, "
        f"Fundraising {result.fundraising_percent}%, Admin {result.admin_percent}% "
        f"from full filing PDF ({result.filename})."
    )
    existing_notes = str(organization.get("notes", "")).strip()
    if note not in existing_notes:
        organization["notes"] = f"{existing_notes} | {note}" if existing_notes else note

    source_meta = organization.setdefault("sourceMeta", {})
    for field in ("programPercent", "fundraisingPercent", "adminPercent"):
        source_meta[field] = {
            "sourceName": "Form 990 PDF extraction",
            "fetchedAt": now,
            "confidenceNote": f"Ratios extracted directly from uploaded full filing PDF (TY{tax_year}).",
            "sourceType": "ProPublica/Form 990",
            "reliability": "high",
        }


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract Form 990 ratios from uploaded PDFs.")
    parser.add_argument("--apply", action="store_true", help="Write extracted values into organizations.json")
    parser.add_argument("--pdf-dir", type=Path, default=PDF_DIR, help="Directory containing Form 990 PDF files")
    args = parser.parse_args()

    pdf_files = sorted(args.pdf_dir.glob("*.pdf"))
    if not pdf_files:
        print(f"No PDF files found in {args.pdf_dir}")
        return

    results = [extract_from_pdf(path) for path in pdf_files]
    organizations = json.loads(ORGS_PATH.read_text(encoding="utf-8")) if args.apply else []

    print(json.dumps([result.__dict__ for result in results], indent=2))

    if not args.apply:
        print("\nDry run only. Re-run with --apply to update organizations.json.")
        return

    applied: list[str] = []
    for result in results:
        organization = find_org_by_ein(organizations, result.ein)
        if not organization:
            print(f"Skipped {result.filename}: no matching EIN ({result.ein}).")
            continue
        if result.error:
            print(f"Skipped {result.filename}: {result.error}")
            continue
        apply_result(organization, result)
        applied.append(organization["organizationName"])

    ORGS_PATH.write_text(json.dumps(organizations, indent=2), encoding="utf-8")
    print(f"\nApplied updates for: {', '.join(applied) if applied else 'none'}")


if __name__ == "__main__":
    main()
