export interface ProPublicaOrganizationRecord {
  ein: number
  name: string
  careofname?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  zipcode?: string | null
  subsection_code?: number | null
}

export function normalizeEin(value: string | number | null | undefined): string {
  return String(value ?? "").replace(/\D/g, "")
}

function formatStreetAddress(record: ProPublicaOrganizationRecord): string {
  const parts = [record.address?.trim(), record.careofname?.trim()].filter(Boolean)
  return parts.join(", ")
}

export function proPublicaRecordToAddress(record: ProPublicaOrganizationRecord) {
  const zip = record.zipcode?.trim() ?? ""
  const postalCode = zip.includes("-") ? zip : zip.slice(0, 5)

  return {
    street: formatStreetAddress(record),
    city: record.city?.trim() ?? "",
    state: record.state?.trim() ?? "",
    postalCode,
    country: "US",
  }
}

export async function fetchProPublicaOrganizationByEin(ein: string): Promise<ProPublicaOrganizationRecord | null> {
  const normalizedEin = normalizeEin(ein)
  if (!normalizedEin) return null

  try {
    const response = await fetch(`https://projects.propublica.org/nonprofits/api/v2/organizations/${normalizedEin}.json`)
    if (!response.ok) return null
    const payload = (await response.json()) as { organization?: ProPublicaOrganizationRecord }
    return payload.organization ?? null
  } catch {
    return null
  }
}

function matchesOrganizationName(localName: string, remoteName: string): boolean {
  const left = localName.toLowerCase().replace(/[^a-z0-9]/g, "")
  const right = remoteName.toLowerCase().replace(/[^a-z0-9]/g, "")
  return right.includes(left) || left.includes(right)
}

export async function searchProPublicaOrganization(organizationName: string): Promise<ProPublicaOrganizationRecord | null> {
  try {
    const response = await fetch(
      `https://projects.propublica.org/nonprofits/api/v2/search.json?q=${encodeURIComponent(organizationName)}`,
    )
    if (!response.ok) return null

    const payload = (await response.json()) as { organizations?: ProPublicaOrganizationRecord[] }
    const match = (payload.organizations ?? []).find((candidate) => matchesOrganizationName(organizationName, candidate.name))
    if (!match?.ein) return null

    return fetchProPublicaOrganizationByEin(String(match.ein))
  } catch {
    return null
  }
}
