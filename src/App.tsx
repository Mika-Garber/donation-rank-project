import { CircularProgress, Box } from "@mui/material"
import { lazy, Suspense } from "react"
import { Navigate, Route, Routes } from "react-router-dom"
import { AppLayout } from "./layout/app-layout"
import { DashboardPage } from "./pages/dashboard-page"

const AddOrganizationPage = lazy(() =>
  import("./pages/add-organization-page").then((module) => ({ default: module.AddOrganizationPage })),
)
const OrganizationDetailPage = lazy(() =>
  import("./pages/organization-detail-page").then((module) => ({ default: module.OrganizationDetailPage })),
)
const DataRefreshPage = lazy(() =>
  import("./pages/data-refresh-page").then((module) => ({ default: module.DataRefreshPage })),
)
const HowRankingWorksPage = lazy(() =>
  import("./pages/how-ranking-works-page").then((module) => ({ default: module.HowRankingWorksPage })),
)
const GivingPlanPage = lazy(() => import("./pages/giving-plan-page").then((module) => ({ default: module.GivingPlanPage })))
const LegacyPlanPage = lazy(() => import("./pages/legacy-plan-page").then((module) => ({ default: module.LegacyPlanPage })))
const ResearchAuditPage = lazy(() =>
  import("./pages/research-audit-page").then((module) => ({ default: module.ResearchAuditPage })),
)

function PageLoader() {
  return (
    <Box sx={{ alignItems: "center", display: "flex", justifyContent: "center", py: 8 }}>
      <CircularProgress />
    </Box>
  )
}

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route
          path="/organizations/new"
          element={
            <Suspense fallback={<PageLoader />}>
              <AddOrganizationPage />
            </Suspense>
          }
        />
        <Route
          path="/organizations/:id"
          element={
            <Suspense fallback={<PageLoader />}>
              <OrganizationDetailPage />
            </Suspense>
          }
        />
        <Route
          path="/data-refresh"
          element={
            <Suspense fallback={<PageLoader />}>
              <DataRefreshPage />
            </Suspense>
          }
        />
        <Route
          path="/how-ranking-works"
          element={
            <Suspense fallback={<PageLoader />}>
              <HowRankingWorksPage />
            </Suspense>
          }
        />
        <Route
          path="/giving-plan"
          element={
            <Suspense fallback={<PageLoader />}>
              <GivingPlanPage />
            </Suspense>
          }
        />
        <Route
          path="/legacy-plan"
          element={
            <Suspense fallback={<PageLoader />}>
              <LegacyPlanPage />
            </Suspense>
          }
        />
        <Route
          path="/research-audit"
          element={
            <Suspense fallback={<PageLoader />}>
              <ResearchAuditPage />
            </Suspense>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
