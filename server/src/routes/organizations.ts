import { Router } from "express"
import { z } from "zod"
import { researchAllOrganizationAddresses } from "../services/address-research-service.js"
import { addOrganization, getOrganizationById, getOrganizations } from "../services/data-store-service.js"
import {
  addDonation,
  deleteDonation,
  getOrganizationDonationSummaries,
  updateDonation,
  updateOrganizationAddress,
} from "../services/donation-service.js"
import { researchImpactFromForm990s } from "../services/impact-research-service.js"
import { updateOrganizationResearchNotes } from "../services/organization-research-service.js"
import { researchOrganizationById } from "../services/research-service.js"

const createOrganizationSchema = z.object({
  organizationName: z.string().min(2),
  category: z.string().min(2),
  subcategory: z.string().optional().default(""),
  approximateAnnualDonation: z.number().min(0).default(0),
  website: z.string().optional().default(""),
  notes: z.string().optional().default(""),
})

const donationSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.number().positive(),
  note: z.string().optional().default(""),
})

const addressSchema = z.object({
  street: z.string().optional().default(""),
  city: z.string().optional().default(""),
  state: z.string().optional().default(""),
  postalCode: z.string().optional().default(""),
  country: z.string().optional().default("US"),
})

const researchNotesSchema = z.object({
  impactEvidenceNotes: z.string().optional(),
  accountabilityNotes: z.string().optional(),
  politicalInvolvementNotes: z.string().optional(),
})

export function organizationsRouter(): Router {
  const router = Router()

  router.get("/", async (_request, response) => {
    const organizations = await getOrganizations()
    response.json({ organizations })
  })

  router.post("/research-addresses", async (_request, response) => {
    const result = await researchAllOrganizationAddresses()
    response.json(result)
  })

  router.post("/research-impact-from-990s", async (request, response) => {
    const force = request.body?.force === true
    const mergeManualNotes = request.body?.mergeManualNotes !== false
    const result = await researchImpactFromForm990s({ force, mergeManualNotes })
    response.json(result)
  })

  router.get("/:id", async (request, response) => {
    const organization = await getOrganizationById(request.params.id)
    if (!organization) {
      response.status(404).json({ message: "Organization not found." })
      return
    }

    const donationSummaries = await getOrganizationDonationSummaries(request.params.id)
    response.json({ organization, donationSummaries })
  })

  router.post("/", async (request, response) => {
    const payload = createOrganizationSchema.parse(request.body)
    const organization = await addOrganization(payload)
    const researchedOrganization = await researchOrganizationById(organization.id)
    response.status(201).json({ organization: researchedOrganization ?? organization })
  })

  router.patch("/:id/address", async (request, response) => {
    const address = addressSchema.parse(request.body)
    const organization = await updateOrganizationAddress(request.params.id, address)
    if (!organization) {
      response.status(404).json({ message: "Organization not found." })
      return
    }
    response.json({ organization })
  })

  router.patch("/:id/research-notes", async (request, response) => {
    const payload = researchNotesSchema.parse(request.body)
    const organization = await updateOrganizationResearchNotes(request.params.id, payload)
    if (!organization) {
      response.status(404).json({ message: "Organization not found." })
      return
    }
    response.json({ organization })
  })

  router.post("/:id/donations", async (request, response) => {
    const payload = donationSchema.parse(request.body)
    const organization = await addDonation(request.params.id, payload)
    if (!organization) {
      response.status(404).json({ message: "Organization not found." })
      return
    }
    const donationSummaries = await getOrganizationDonationSummaries(request.params.id)
    response.status(201).json({ organization, donationSummaries })
  })

  router.patch("/:id/donations/:donationId", async (request, response) => {
    const payload = donationSchema.partial().parse(request.body)
    const organization = await updateDonation(request.params.id, request.params.donationId, payload)
    if (!organization) {
      response.status(404).json({ message: "Organization not found." })
      return
    }
    const donationSummaries = await getOrganizationDonationSummaries(request.params.id)
    response.json({ organization, donationSummaries })
  })

  router.delete("/:id/donations/:donationId", async (request, response) => {
    const organization = await deleteDonation(request.params.id, request.params.donationId)
    if (!organization) {
      response.status(404).json({ message: "Organization not found." })
      return
    }
    const donationSummaries = await getOrganizationDonationSummaries(request.params.id)
    response.json({ organization, donationSummaries })
  })

  return router
}
