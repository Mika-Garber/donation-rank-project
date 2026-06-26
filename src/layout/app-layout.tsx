import {
  AppBar,
  Box,
  Button,
  Container,
  Divider,
  Menu,
  MenuItem,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material"
import { useState } from "react"
import { Link, Outlet, useLocation } from "react-router-dom"
import {
  SHOW_ADMIN_NAV,
  adminNavItems,
  clientNavItems,
  isNavItemActive,
  type NavItem,
} from "../config/navigation-config"

function NavButton({ item, pathname }: { item: NavItem; pathname: string }) {
  return (
    <Button
      component={Link}
      to={item.href}
      variant={isNavItemActive(item.href, pathname) ? "contained" : "text"}
      size="small"
    >
      {item.label}
    </Button>
  )
}

function NavSection({
  title,
  items,
  pathname,
}: {
  title: string
  items: NavItem[]
  pathname: string
}) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
      <Typography
        color="text.secondary"
        sx={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}
      >
        {title}
      </Typography>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
        {items.map((item) => (
          <NavButton key={item.href} item={item} pathname={pathname} />
        ))}
      </Box>
    </Box>
  )
}

function AdminNavMenu({ pathname }: { pathname: string }) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const isOpen = Boolean(anchorEl)
  const isAdminRouteActive = adminNavItems.some((item) => isNavItemActive(item.href, pathname))

  return (
    <>
      <Button
        onClick={(event) => setAnchorEl(event.currentTarget)}
        size="small"
        variant={isAdminRouteActive ? "contained" : "outlined"}
      >
        Admin Tools ▾
      </Button>
      <Menu anchorEl={anchorEl} open={isOpen} onClose={() => setAnchorEl(null)}>
        {adminNavItems.map((item) => (
          <MenuItem
            key={item.href}
            component={Link}
            to={item.href}
            onClick={() => setAnchorEl(null)}
            selected={isNavItemActive(item.href, pathname)}
          >
            {item.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  )
}

export function AppLayout() {
  const location = useLocation()
  const theme = useTheme()
  const isCompactNav = useMediaQuery(theme.breakpoints.down("md"))

  return (
    <Box sx={{ backgroundColor: "#f5f7fb", minHeight: "100vh" }}>
      <AppBar position="static" color="inherit" elevation={1}>
        <Toolbar
          sx={{
            alignItems: { md: "center", xs: "stretch" },
            display: "flex",
            flexDirection: { md: "row", xs: "column" },
            gap: 2,
            py: { xs: 1.5, md: 1 },
          }}
        >
          <Typography sx={{ flexShrink: 0, fontWeight: 700 }} variant="h6">
            Stewardship Ranking
          </Typography>

          <Box
            sx={{
              alignItems: { md: "center", xs: "stretch" },
              display: "flex",
              flex: 1,
              flexDirection: { md: "row", xs: "column" },
              gap: { md: 2, xs: 1.5 },
              justifyContent: { md: "flex-end", xs: "flex-start" },
            }}
          >
            {SHOW_ADMIN_NAV ? (
              <NavSection title="Client View" items={clientNavItems} pathname={location.pathname} />
            ) : (
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
                {clientNavItems.map((item) => (
                  <NavButton key={item.href} item={item} pathname={location.pathname} />
                ))}
              </Box>
            )}

            {SHOW_ADMIN_NAV && (
              <>
                {isCompactNav ? (
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
                    <Typography
                      color="text.secondary"
                      sx={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}
                    >
                      Admin Tools
                    </Typography>
                    <AdminNavMenu pathname={location.pathname} />
                  </Box>
                ) : (
                  <>
                    <Divider flexItem orientation="vertical" sx={{ display: { md: "block", xs: "none" } }} />
                    <NavSection title="Admin Tools" items={adminNavItems} pathname={location.pathname} />
                  </>
                )}
              </>
            )}
          </Box>
        </Toolbar>
      </AppBar>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Outlet />
      </Container>
    </Box>
  )
}
