import type { Organization, SourceMeta } from "../../types/organization.js"
import type { ResearchAdapter, ResearchPatch } from "./adapter-types.js"

const SEARCH_ENDPOINT = "https://duckduckgo.com/html/"

function buildSourceMeta(confidenceNote: string): SourceMeta {
  return {
    sourceName: "DuckDuckGo Search",
    fetchedAt: new Date().toISOString(),
    confidenceNote,
  }
}

function extractCandidateUrls(html: string): string[] {
  const hrefRegex = /uddg=([^"&]+)/g
  const urls: string[] = []
  let match = hrefRegex.exec(html)
  while (match) {
    try {
      const decodedUrl = decodeURIComponent(match[1])
      if (decodedUrl.startsWith("http://") || decodedUrl.startsWith("https://")) {
        urls.push(decodedUrl)
      }
    } catch {
      // Ignore malformed URL encodings.
    }
    match = hrefRegex.exec(html)
  }
  return urls
}

function pickOrganizationWebsite(urls: string[]): string | null {
  for (const url of urls) {
    if (
      !url.includes("wikipedia.org") &&
      !url.includes("facebook.com") &&
      !url.includes("instagram.com") &&
      !url.includes("linkedin.com") &&
      !url.includes("charitynavigator.org")
    ) {
      return url
    }
  }
  return null
}

export const websiteDiscoveryAdapter: ResearchAdapter = {
  sourceName: "DuckDuckGo Search",
  async enrichOrganization(organization: Organization): Promise<ResearchPatch> {
    if (organization.website) {
      return {
        organizationPatch: {},
        sourceMetaPatch: {},
        changedFields: [],
        errors: [],
      }
    }

    try {
      const query = `${organization.organizationName} official website`
      const response = await fetch(`${SEARCH_ENDPOINT}?q=${encodeURIComponent(query)}`)
      if (!response.ok) {
        return {
          organizationPatch: {},
          sourceMetaPatch: {
            website: buildSourceMeta(`Website discovery unavailable (${response.status}).`),
          },
          changedFields: [],
          errors: [],
        }
      }

      const html = await response.text()
      const urls = extractCandidateUrls(html)
      const selectedWebsite = pickOrganizationWebsite(urls)
      if (!selectedWebsite) {
        return {
          organizationPatch: {},
          sourceMetaPatch: {
            website: buildSourceMeta("No confident website match found."),
          },
          changedFields: [],
          errors: [],
        }
      }

      return {
        organizationPatch: { website: selectedWebsite },
        sourceMetaPatch: {
          website: buildSourceMeta("Selected from top public search results."),
        },
        changedFields: ["website"],
        errors: [],
      }
    } catch (error) {
      return {
        organizationPatch: {},
        sourceMetaPatch: {
          website: buildSourceMeta("Website discovery temporarily unavailable."),
        },
        changedFields: [],
        errors: [],
      }
    }
  },
}
