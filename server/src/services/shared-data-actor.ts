import type { Request } from "express"
import type { SharedDataActor } from "./supabase-shared-data-service.js"

export function getActorFromRequest(request: Request): SharedDataActor {
  const actorName = typeof request.headers["x-actor-name"] === "string" ? request.headers["x-actor-name"].trim() : ""
  const actorType = typeof request.headers["x-actor-type"] === "string" ? request.headers["x-actor-type"].trim() : ""

  if (actorName) {
    return {
      actorType: actorType || "client",
      actorName,
    }
  }

  return {
    actorType: "client",
    actorName: "client",
  }
}
