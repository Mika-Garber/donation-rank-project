function parseOptionalBoolean(value: string | undefined): boolean | undefined {
  if (value === undefined || value === "") return undefined
  if (value === "true") return true
  if (value === "false") return false
  return undefined
}

const configured = parseOptionalBoolean(import.meta.env.VITE_SHOW_ADMIN_TOOLS)

export const SHOW_ADMIN_TOOLS = configured ?? import.meta.env.DEV
