# Watchdog Sources Setup

This app can enrich organization research from three watchdog sources:

| Source | Method | Cost |
|--------|--------|------|
| **Charity Navigator** | Official GraphQL API | Free tier (register for API key) |
| **CharityWatch** | Local catalog file | Manual entry (no public API) |
| **Animal Charity Evaluators (ACE)** | Local catalog file | Manual sync (no public API) |

After setup, go to **Data Refresh** in the app and click **Research all organizations**.

---

## 1. Charity Navigator (API)

Charity Navigator replaces the old broken HTML scraper.

### Steps

1. Register at [developer.charitynavigator.org](https://developer.charitynavigator.org/)
2. Request access to the GraphQL API and wait for approval email
3. Copy your API key
4. Create `server/.env` from the example:

```bash
cp server/.env.example server/.env
```

5. Add your key:

```env
CHARITY_NAVIGATOR_API_KEY=your_key_here
```

6. Restart the API server:

```bash
npm run dev:all
```

### What it fills

- Star rating (`charityNavigatorRating`)
- Profile URL (`charityNavigatorProfileUrl`)
- Alert level (`charityNavigatorAlert`) — may trigger red flags
- Website (if missing)

---

## 2. CharityWatch (local catalog)

CharityWatch blocks automated scraping (Cloudflare). Use the local catalog instead.

### File

`server/data/charitywatch-ratings.json`

### Add an entry

```json
{
  "ein": "275219467",
  "organizationName": "K9s For Warriors",
  "grade": "A",
  "programPercent": 70,
  "notes": "From CharityWatch supporter page review."
}
```

Grades: `A+`, `A`, `B+`, `B`, `C+`, `C`, `D`, `F`

Eight orgs from Jody's list are seeded with verified or published CharityWatch data (Best Friends, Alzheimer's Association, Red Rover, Mutts with a Mission, Project K-9 Hero, White Coat Waste Project, Pilots to the Rescue, Paws of Honor).

### What it fills

- CharityWatch grade (`charityWatchGrade`)
- Program % (only if missing and listed in catalog entry)
- Accountability notes (if missing)

---

## 3. Animal Charity Evaluators / ACE (local catalog)

ACE has no public API. The app matches organization names against ACE's recommended charity list.

### File

`server/data/ace-recommended-charities.json`

Contains ACE's 2025 recommended charities (The Humane League, Wild Animal Initiative, etc.).

### Update the list

When ACE publishes a new list each year:

1. Open [animalcharityevaluators.org/recommended-charities](https://animalcharityevaluators.org/recommended-charities/)
2. Update the `recommended` array in the JSON file
3. Set `updatedAt` to today's date
4. Run **Research all organizations**

### What it fills

- ACE status (`aceRecommendation`: `Recommended` or `Standout`)
- Impact evidence notes (if missing)

---

## Verify setup

1. Open the app → **Data Refresh**
2. Check the **Watchdog sources setup** section:
   - Charity Navigator: green = API key configured
   - CharityWatch: shows catalog entry count
   - ACE: shows recommended/standout counts
3. Click **Research all organizations**
4. Open **Research Audit** to see counts for CN ratings, CW grades, and ACE matches

---

## Scoring impact

Watchdog data boosts scores when present:

- **Charity Navigator stars** → impact + accountability
- **CharityWatch A/A+ grades** → impact + accountability
- **ACE Recommended** → impact + accountability
- **Charity Navigator alerts** → may add red flags

Form 990 data still takes priority for financial efficiency when both exist.
