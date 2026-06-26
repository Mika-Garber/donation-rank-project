import { Card } from "@mui/material"
import { styled } from "@mui/material/styles"

export const OrganizationCardRoot = styled(Card, {
  shouldForwardProp: (prop) => prop !== "highlighted",
})<{ highlighted?: boolean }>(({ theme, highlighted }) => ({
  borderRadius: theme.spacing(1.5),
  border: highlighted ? `2px solid ${theme.palette.primary.main}` : "1px solid #d9e2f2",
  boxShadow: highlighted ? `0 0 0 4px ${theme.palette.primary.main}33` : undefined,
  transition: "border-color 0.2s ease, box-shadow 0.2s ease",
}))
