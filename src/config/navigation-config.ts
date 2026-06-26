import { SHOW_ADMIN_TOOLS } from "./app-mode"

export const SHOW_ADMIN_NAV = SHOW_ADMIN_TOOLS

export interface NavItem {
  label: string
  href: string
}

export const clientNavItems: NavItem[] = [
  { label: "Dashboard", href: "/" },
  { label: "Final 15–20 Plan", href: "/portfolio-concentration" },
  { label: "Advisor Export", href: "/advisor-export" },
  { label: "How Ranking Works", href: "/how-ranking-works" },
]

export const adminNavItems: NavItem[] = [
  { label: "Add Organization", href: "/organizations/new" },
  { label: "Research Audit", href: "/research-audit" },
  { label: "Giving Plan", href: "/giving-plan" },
  { label: "Legacy Plan", href: "/legacy-plan" },
  { label: "Data Refresh", href: "/data-refresh" },
]

export function isNavItemActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/"
  return pathname === href
}
