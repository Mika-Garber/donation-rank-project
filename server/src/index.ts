import cors from "cors"
import { config as loadEnv } from "dotenv"
import express from "express"
import { existsSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { ZodError } from "zod"
import { organizationsRouter } from "./routes/organizations.js"
import { rankingRouter } from "./routes/ranking.js"
import { refreshRouter } from "./routes/refresh.js"
import { requireAccessToken } from "./services/auth-middleware.js"

const currentDirectory = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(currentDirectory, "..", ".env")
if (existsSync(envPath)) {
  loadEnv({ path: envPath })
}

const app = express()
const port = Number.parseInt(process.env.PORT ?? "4000", 10)

app.use(cors())
app.use(express.json())

const apiRouter = express.Router()

apiRouter.get("/health", (_request, response) => {
  response.json({ status: "ok" })
})

apiRouter.use(requireAccessToken)
apiRouter.use("/organizations", organizationsRouter())
apiRouter.use("/ranking", rankingRouter())
apiRouter.use("/refresh", refreshRouter())

app.use("/api", apiRouter)

if (process.env.VERCEL) {
  app.use(apiRouter)
}

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  if (error instanceof ZodError) {
    response.status(400).json({
      message: "Validation failed.",
      issues: error.issues,
    })
    return
  }

  console.error(error)
  response.status(500).json({ message: "Unexpected server error." })
})

app.listen(port, () => {
  console.log(`Donation API server listening on http://localhost:${port}`)
})
