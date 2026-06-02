import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import App from "./App"
import "./index.css"

const queryClient = new QueryClient()
const appTheme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#2f67d8" },
    secondary: { main: "#00897b" },
  },
  typography: {
    fontSize: 15,
  },
})

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider theme={appTheme}>
      <CssBaseline />
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
)
