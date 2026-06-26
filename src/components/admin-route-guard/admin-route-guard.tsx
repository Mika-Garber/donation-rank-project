import { Alert, Box, Button } from "@mui/material"
import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import { SHOW_ADMIN_TOOLS } from "../../config/app-mode"

interface AdminRouteGuardProps {
  children: ReactNode
}

export function AdminRouteGuard({ children }: AdminRouteGuardProps) {
  if (SHOW_ADMIN_TOOLS) {
    return children
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Alert severity="info">Admin tools are only available in the local admin version.</Alert>
      <Button component={Link} sx={{ alignSelf: "flex-start" }} to="/" variant="contained">
        Back to Dashboard
      </Button>
    </Box>
  )
}
