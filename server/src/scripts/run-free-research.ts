import { config as loadEnv } from "dotenv"
import { existsSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { runAllFreeResearch } from "../services/free-research-service.js"

const currentDirectory = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(currentDirectory, "..", "..", ".env")
if (existsSync(envPath)) {
  loadEnv({ path: envPath })
}

async function main(): Promise<void> {
  console.log("Running all free research sources...")
  const result = await runAllFreeResearch()
  console.log(JSON.stringify(result, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
