import { Router } from "express"
import { z } from "zod"
import { getOrganizations } from "../services/data-store-service.js"
import { getActorFromRequest } from "../services/shared-data-actor.js"
import {
  deleteAdvisorExportItem,
  isSupabaseConfigured,
  listAdvisorExportItemRows,
  listClientActivity,
  logAdvisorExportGenerated,
  replaceAdvisorExportItems,
  upsertAdvisorExportItem,
} from "../services/supabase-shared-data-service.js"
import type { AdvisorExportDetailsJson } from "../types/shared-data.js"
import { buildAdvisorExportRowFromSharedItem } from "../utils/advisor-export-merge.js"

const advisorExportItemSchema = z.object({
  organizationId: z.string().min(1),
  organizationName: z.string().optional().default(""),
  donationAmount: z.number().nullable().optional(),
  notes: z.string().optional().default(""),
  includeInExport: z.boolean().optional().default(true),
  details: z
    .object({
      checkPayeeName: z.string().optional(),
      addressLine1: z.string().optional(),
      addressLine2: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      zip: z.string().optional(),
      country: z.string().optional(),
    })
    .optional()
    .default({}),
})

const advisorExportReplaceSchema = z.object({
  items: z.array(advisorExportItemSchema),
})

const advisorExportGeneratedSchema = z.object({
  selectedCount: z.number().int().min(0),
  totalDonationAmount: z.number().min(0),
  rowCount: z.number().int().min(0),
})

export function sharedDataRouter(): Router {
  const router = Router()

  router.get("/status", (_request, response) => {
    response.json({
      sharedDataEnabled: isSupabaseConfigured(),
      message: isSupabaseConfigured()
        ? "Donations and advisor export are stored in Supabase."
        : "Shared online donation saving requires Supabase configuration (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the server). Local JSON storage is used instead.",
    })
  })

  router.get("/advisor-export", async (_request, response) => {
    if (!isSupabaseConfigured()) {
      response.status(503).json({
        message: "Shared advisor export requires Supabase configuration.",
        sharedDataEnabled: false,
      })
      return
    }

    const [organizations, items] = await Promise.all([getOrganizations(), listAdvisorExportItemRows()])
    const organizationById = new Map(organizations.map((organization) => [organization.id, organization]))
    const rows = items.map((item) => buildAdvisorExportRowFromSharedItem(item, organizationById.get(item.organization_id)))

    response.json({ rows, sharedDataEnabled: true })
  })

  router.put("/advisor-export", async (request, response) => {
    if (!isSupabaseConfigured()) {
      response.status(503).json({ message: "Shared advisor export requires Supabase configuration." })
      return
    }

    const payload = advisorExportReplaceSchema.parse(request.body)
    const actor = getActorFromRequest(request)
    const items = payload.items.map((item) => ({
      organizationId: item.organizationId,
      organizationName: item.organizationName,
      donationAmount: item.donationAmount ?? null,
      notes: item.notes,
      includeInExport: item.includeInExport,
      details: item.details as AdvisorExportDetailsJson,
    }))

    await replaceAdvisorExportItems(items, actor)
    const organizations = await getOrganizations()
    const organizationById = new Map(organizations.map((organization) => [organization.id, organization]))
    const savedItems = await listAdvisorExportItemRows()
    const rows = savedItems.map((item) => buildAdvisorExportRowFromSharedItem(item, organizationById.get(item.organization_id)))

    response.json({ rows })
  })

  router.patch("/advisor-export/:organizationId", async (request, response) => {
    if (!isSupabaseConfigured()) {
      response.status(503).json({ message: "Shared advisor export requires Supabase configuration." })
      return
    }

    const payload = advisorExportItemSchema.parse({
      ...request.body,
      organizationId: request.params.organizationId,
    })
    const actor = getActorFromRequest(request)
    const existingItems = await listAdvisorExportItemRows()
    const isNew = !existingItems.some((item) => item.organization_id === payload.organizationId)

    const row = await upsertAdvisorExportItem(
      {
        organizationId: payload.organizationId,
        organizationName: payload.organizationName,
        donationAmount: payload.donationAmount ?? null,
        notes: payload.notes,
        includeInExport: payload.includeInExport,
        details: payload.details as AdvisorExportDetailsJson,
      },
      actor,
      isNew,
    )

    const organizations = await getOrganizations()
    const organization = organizations.find((entry) => entry.id === payload.organizationId)
    response.json({ row: buildAdvisorExportRowFromSharedItem(row, organization) })
  })

  router.delete("/advisor-export/:organizationId", async (request, response) => {
    if (!isSupabaseConfigured()) {
      response.status(503).json({ message: "Shared advisor export requires Supabase configuration." })
      return
    }

    const actor = getActorFromRequest(request)
    const removed = await deleteAdvisorExportItem(request.params.organizationId, actor)
    if (!removed) {
      response.status(404).json({ message: "Advisor export item not found." })
      return
    }

    response.json({ removed: true })
  })

  router.post("/advisor-export/generated", async (request, response) => {
    if (!isSupabaseConfigured()) {
      response.json({ logged: false })
      return
    }

    const payload = advisorExportGeneratedSchema.parse(request.body)
    const actor = getActorFromRequest(request)
    await logAdvisorExportGenerated(payload, actor)
    response.json({ logged: true })
  })

  router.get("/client-activity", async (request, response) => {
    if (!isSupabaseConfigured()) {
      response.status(503).json({
        message: "Client activity log requires Supabase configuration.",
        sharedDataEnabled: false,
        entries: [],
      })
      return
    }

    const limit = Number.parseInt(String(request.query.limit ?? "100"), 10)
    const entries = await listClientActivity(Number.isFinite(limit) ? limit : 100)
    response.json({ entries, sharedDataEnabled: true })
  })

  return router
}
