import type { NextFunction, Request, Response } from "express"

export function requireAccessToken(request: Request, response: Response, next: NextFunction): void {
  const configuredToken = process.env.APP_ACCESS_TOKEN
  if (!configuredToken) {
    next()
    return
  }

  const requestToken = request.header("x-access-token")
  if (requestToken === configuredToken) {
    next()
    return
  }

  response.status(401).json({
    message: "Missing or invalid access token.",
  })
}
