import { CircularProgress, Box } from "@mui/material"
import { lazy, Suspense } from "react"
import { Navigate, Route, Routes } from "react-router-dom"
import { AdminRouteGuard } from "./components/admin-route-guard/admin-route-guard"
import { AppLayout } from "./layout/app-layout"
import { DashboardPage } from "./pages/dashboard-page"
import { OrganizationPrintPage } from "./pages/organization-print-page"
import { PortfolioPrintPage } from "./pages/portfolio-print-page"
import { AdvisorExportPrintPage } from "./pages/advisor-export-print-page"

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
const PortfolioReviewPage = lazy(() =>
  import("./pages/portfolio-review-page").then((module) => ({ default: module.PortfolioReviewPage })),
)
const PortfolioConcentrationPage = lazy(() =>
  import("./pages/portfolio-concentration-page").then((module) => ({ default: module.PortfolioConcentrationPage })),
)
const AdvisorExportPage = lazy(() =>
  import("./pages/advisor-export-page").then((module) => ({ default: module.AdvisorExportPage })),
)
const LegacyPlanPage = lazy(() => import("./pages/legacy-plan-page").then((module) => ({ default: module.LegacyPlanPage })))
const ResearchAuditPage = lazy(() =>
  import("./pages/research-audit-page").then((module) => ({ default: module.ResearchAuditPage })),
)
const ClientActivityPage = lazy(() =>
  import("./pages/client-activity-page").then((module) => ({ default: module.ClientActivityPage })),
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
      <Route path="/print/portfolio-review" element={<PortfolioPrintPage />} />
      <Route path="/print/advisor-export" element={<AdvisorExportPrintPage />} />
      <Route path="/print/organizations/:id" element={<OrganizationPrintPage />} />
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
            <AdminRouteGuard>
              <Suspense fallback={<PageLoader />}>
                <DataRefreshPage />
              </Suspense>
            </AdminRouteGuard>
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
            <AdminRouteGuard>
              <Suspense fallback={<PageLoader />}>
                <GivingPlanPage />
              </Suspense>
            </AdminRouteGuard>
          }
        />
        <Route
          path="/portfolio-review"
          element={
            <Suspense fallback={<PageLoader />}>
              <PortfolioReviewPage />
            </Suspense>
          }
        />
        <Route
          path="/portfolio-concentration"
          element={
            <Suspense fallback={<PageLoader />}>
              <PortfolioConcentrationPage />
            </Suspense>
          }
        />
        <Route
          path="/advisor-export"
          element={
            <Suspense fallback={<PageLoader />}>
              <AdvisorExportPage />
            </Suspense>
          }
        />
        <Route
          path="/legacy-plan"
          element={
            <AdminRouteGuard>
              <Suspense fallback={<PageLoader />}>
                <LegacyPlanPage />
              </Suspense>
            </AdminRouteGuard>
          }
        />
        <Route
          path="/research-audit"
          element={
            <AdminRouteGuard>
              <Suspense fallback={<PageLoader />}>
                <ResearchAuditPage />
              </Suspense>
            </AdminRouteGuard>
          }
        />
        <Route
          path="/client-activity"
          element={
            <AdminRouteGuard>
              <Suspense fallback={<PageLoader />}>
                <ClientActivityPage />
              </Suspense>
            </AdminRouteGuard>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
