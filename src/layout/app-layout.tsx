import { AppBar, Box, Button, Container, Toolbar, Typography } from "@mui/material"
import { Link, Outlet, useLocation } from "react-router-dom"

const navItems = [
  { label: "Dashboard", href: "/" },
  { label: "Add Organization", href: "/organizations/new" },
  { label: "Giving Plan", href: "/giving-plan" },
  { label: "Legacy Plan", href: "/legacy-plan" },
  { label: "Research Audit", href: "/research-audit" },
  { label: "Data Refresh", href: "/data-refresh" },
  { label: "How Ranking Works", href: "/how-ranking-works" },
]

export function AppLayout() {
  const location = useLocation()

  return (
    <Box sx={{ backgroundColor: "#f5f7fb", minHeight: "100vh" }}>
      <AppBar position="static" color="inherit" elevation={1}>
        <Toolbar sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, gap: 1 }}>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Donation Ranking
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
            {navItems.map((item) => (
              <Button
                key={item.href}
                component={Link}
                to={item.href}
                variant={location.pathname === item.href ? "contained" : "text"}
                size="small"
              >
                {item.label}
              </Button>
            ))}
          </Box>
        </Toolbar>
      </AppBar>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Outlet />
      </Container>
    </Box>
  )
}
