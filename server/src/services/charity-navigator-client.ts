import {
  CHARITY_NAVIGATOR_API_URL,
  getCharityNavigatorApiKey,
  isCharityNavigatorConfigured,
} from "../config/watchdog-config.js"
import { normalizeEin } from "./watchdog-utils.js"

const SEARCH_QUERY = `
  query PublicSearchFaceted(
    $term: String!
    $states: [String!]!
    $sizes: [String!]!
    $causes: [String!]!
    $ratings: [String!]!
    $c3: Boolean!
    $result_size: Int!
    $from: Int!
    $orderBy: String!
  ) {
    publicSearchFaceted(
      term: $term
      states: $states
      sizes: $sizes
      causes: $causes
      ratings: $ratings
      c3: $c3
      result_size: $result_size
      from: $from
      order_by: $orderBy
    ) {
      results {
        ein
        name
        mission
        organization_url
        charity_navigator_url
        encompass_score
        encompass_star_rating
        highest_level_alert
      }
    }
  }
`

export interface CharityNavigatorSearchResult {
  ein: string
  name: string
  mission: string
  organization_url: string | null
  charity_navigator_url: string | null
  encompass_score: number | null
  encompass_star_rating: number | null
  highest_level_alert: string | null
}

interface GraphQlResponse {
  data?: {
    publicSearchFaceted?: {
      results: CharityNavigatorSearchResult[]
    }
  }
  errors?: Array<{ message: string }>
}

export async function searchCharityNavigatorByTerm(term: string): Promise<CharityNavigatorSearchResult[]> {
  if (!isCharityNavigatorConfigured()) return []

  const response = await fetch(CHARITY_NAVIGATOR_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: getCharityNavigatorApiKey(),
    },
    body: JSON.stringify({
      query: SEARCH_QUERY,
      variables: {
        term,
        states: [],
        sizes: [],
        causes: [],
        ratings: [],
        c3: true,
        result_size: 10,
        from: 0,
        orderBy: "RELEVANCE",
      },
    }),
  })

  if (!response.ok) {
    throw new Error(`Charity Navigator API request failed (${response.status}).`)
  }

  const payload = (await response.json()) as GraphQlResponse
  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message).join("; "))
  }

  return payload.data?.publicSearchFaceted?.results ?? []
}

export async function lookupCharityNavigatorOrganization(
  organizationName: string,
  ein: string,
): Promise<CharityNavigatorSearchResult | null> {
  const normalizedEin = normalizeEin(ein)
  const searchTerms = [normalizedEin, organizationName.trim()].filter(Boolean)

  for (const term of searchTerms) {
    const results = await searchCharityNavigatorByTerm(term)
    if (results.length === 0) continue

    if (normalizedEin) {
      const exactEinMatch = results.find((result) => normalizeEin(result.ein) === normalizedEin)
      if (exactEinMatch) return exactEinMatch
    }

    return results[0]
  }

  return null
}
