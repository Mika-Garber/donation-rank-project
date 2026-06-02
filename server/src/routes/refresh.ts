import { Router } from "express"
import { getRefreshLog } from "../services/data-store-service.js"
import { refreshOrganizationsFromPublicSources } from "../services/refresh-service.js"

export function refreshRouter(): Router {
  const router = Router()

  router.get("/status", async (_request, response) => {
    const latestRefresh = await getRefreshLog()
    response.json({ latestRefresh })
  })

  router.post("/", async (_request, response) => {
    const refreshResult = await refreshOrganizationsFromPublicSources()
    response.json({ refreshResult })
  })

  return router
}
