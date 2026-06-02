export function normalizeEin(value: string): string {
  return value.replace(/\D/g, "")
}

export function normalizeOrganizationName(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function organizationNamesMatch(left: string, right: string): boolean {
  const normalizedLeft = normalizeOrganizationName(left)
  const normalizedRight = normalizeOrganizationName(right)
  if (!normalizedLeft || !normalizedRight) return false
  if (normalizedLeft === normalizedRight) return true
  if (normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft)) return true

  const leftTokens = normalizedLeft.split(" ").filter((token) => token.length > 2)
  const rightTokens = new Set(normalizedRight.split(" ").filter((token) => token.length > 2))
  if (leftTokens.length === 0 || rightTokens.size === 0) return false

  const overlap = leftTokens.filter((token) => rightTokens.has(token)).length
  const overlapRatio = overlap / Math.max(leftTokens.length, rightTokens.size)
  return overlapRatio >= 0.75
}
