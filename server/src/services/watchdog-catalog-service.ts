import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import type { AceRecommendation } from "../types/organization.js"
import { normalizeEin, normalizeOrganizationName, organizationNamesMatch } from "./watchdog-utils.js"

const currentDirectory = dirname(fileURLToPath(import.meta.url))
const DATA_DIRECTORY = resolve(currentDirectory, "..", "..", "data")

export interface AceCatalogEntry {
  name: string
  aliases: string[]
  ein?: string
}

export interface AceCatalog {
  updatedAt: string
  sourceUrl: string
  recommended: AceCatalogEntry[]
  standout: AceCatalogEntry[]
}

export interface CharityWatchEntry {
  ein: string
  organizationName: string
  grade: string
  programPercent?: number | null
  fundraisingPercent?: number | null
  adminPercent?: number | null
  notes?: string
  sourceUrl?: string
}

export interface CharityWatchCatalog {
  updatedAt: string
  sourceUrl: string
  notes?: string
  entries: CharityWatchEntry[]
}

let cachedAceCatalog: AceCatalog | null = null
let cachedCharityWatchCatalog: CharityWatchCatalog | null = null

function readJsonFile<T>(filename: string): T {
  const filePath = resolve(DATA_DIRECTORY, filename)
  return JSON.parse(readFileSync(filePath, "utf-8")) as T
}

export function getAceCatalog(): AceCatalog {
  if (!cachedAceCatalog) {
    cachedAceCatalog = readJsonFile<AceCatalog>("ace-recommended-charities.json")
  }
  return cachedAceCatalog
}

export function getCharityWatchCatalog(): CharityWatchCatalog {
  if (!cachedCharityWatchCatalog) {
    cachedCharityWatchCatalog = readJsonFile<CharityWatchCatalog>("charitywatch-ratings.json")
  }
  return cachedCharityWatchCatalog
}

function matchesAceEntry(organizationName: string, entry: AceCatalogEntry): boolean {
  const candidates = [entry.name, ...entry.aliases]
  return candidates.some((candidate) => organizationNamesMatch(organizationName, candidate))
}

export function findAceRecommendation(organizationName: string, ein: string): {
  recommendation: AceRecommendation
  matchedName: string
} | null {
  const catalog = getAceCatalog()

  for (const entry of catalog.recommended) {
    if (matchesAceEntry(organizationName, entry)) {
      return { recommendation: "Recommended", matchedName: entry.name }
    }
  }

  for (const entry of catalog.standout) {
    if (matchesAceEntry(organizationName, entry)) {
      return { recommendation: "Standout", matchedName: entry.name }
    }
  }

  const normalizedEin = normalizeEin(ein)
  if (normalizedEin) {
    for (const entry of catalog.recommended) {
      if (entry.ein && normalizeEin(entry.ein) === normalizedEin) {
        return { recommendation: "Recommended", matchedName: entry.name }
      }
    }
    for (const entry of catalog.standout) {
      if (entry.ein && normalizeEin(entry.ein) === normalizedEin) {
        return { recommendation: "Standout", matchedName: entry.name }
      }
    }
  }

  return null
}

export function findCharityWatchEntry(organizationName: string, ein: string): CharityWatchEntry | null {
  const catalog = getCharityWatchCatalog()
  const normalizedEin = normalizeEin(ein)
  if (normalizedEin) {
    const byEin = catalog.entries.find((entry) => normalizeEin(entry.ein) === normalizedEin)
    if (byEin) return byEin
  }

  return catalog.entries.find((entry) => organizationNamesMatch(organizationName, entry.organizationName)) ?? null
}

export function getWatchdogCatalogStats(): {
  aceRecommendedCount: number
  aceStandoutCount: number
  charityWatchEntryCount: number
  aceUpdatedAt: string
  charityWatchUpdatedAt: string
} {
  const aceCatalog = getAceCatalog()
  const charityWatchCatalog = getCharityWatchCatalog()
  return {
    aceRecommendedCount: aceCatalog.recommended.length,
    aceStandoutCount: aceCatalog.standout.length,
    charityWatchEntryCount: charityWatchCatalog.entries.length,
    aceUpdatedAt: aceCatalog.updatedAt,
    charityWatchUpdatedAt: charityWatchCatalog.updatedAt,
  }
}
