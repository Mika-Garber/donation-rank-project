# Donation Ranking Workflow

This project now has a repeatable ranking process for organizations, with an explicit confidence score so low-data organizations are not over-trusted.

## Files created

- `scripts/rank_organizations.py` - calculates ranking and research priority
- `data/Jody_Organizations_ranked.csv` - ranked list with score and tier
- `data/Jody_Organizations_research_queue.csv` - organizations to research first
- `data/Jody_Donation_Dashboard.csv` - compact decision view (best everyday file)
- `data/Jody_Research_Top20.csv` - focused research queue for first 20 orgs

## How ranking works

The ranking script calculates:

- **Mission Score (40%)**: prioritizes categories aligned to donation goals, especially animal charities.
- **Efficiency Score (30%)**: uses `Program %`, `Fundraising %`, and `Admin %` when available.
- **Transparency Score (25%)**: uses website, EIN, 501(c)(3) verification, Charity Navigator rating, and notes.
- **History Score (5%)**: lightly factors current annual donation amount.
- **Duplicate penalty (-12)**: applied only when duplicate mission is explicitly marked `Y`.

Because many accountability columns are still blank, every organization also gets:

- **Confidence Score**: percent of critical ranking fields that are currently populated.
- **Tier**:
  - `Needs Research` when confidence is below 45
  - otherwise `Tier 1`, `Tier 2`, or `Tier 3` by score

## Recommended process

1. Run the script to refresh outputs.
2. Use `data/Jody_Donation_Dashboard.csv` for a compact, easy daily view.
3. Use `data/Jody_Research_Top20.csv` for the first set of research tasks.
4. Fill missing fields in `data/Jody_Organizations_COMPLETE.xlsx`:
   - `Website`
   - `EIN (if listed)`
   - `501(c)(3) verified`
   - `Charity Navigator rating`
   - `Program %`, `Fundraising %`, `Admin %`
5. Run the script again and re-check tiers.
6. Focus long-term giving on organizations that are both:
   - high `Legacy Fit Score`
   - high `Confidence Score`

## Weekly app workflow (recommended)

1. Open the web app dashboard.
2. Click `Research all organizations` on the Data Refresh page.
3. Review only the triage queue (high-impact + low-confidence organizations).
4. Resolve the first 5-10 `Next action` items.

## Monthly quality check

1. Manually verify the top 10 funded organizations.
2. Confirm EIN + 501(c)(3) + website for each.
3. Save a snapshot export for audit history.

## Run command

From project root:

`python3 scripts/rank_organizations.py`
