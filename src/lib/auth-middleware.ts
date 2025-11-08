import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, JWTPayload } from '@/lib/jwt'
import { ErrorResponses, handleError } from '@/lib/error-handler'
import { logUnauthorizedAccess } from '@/lib/audit-logger'

export interface AuthenticatedRequest extends NextRequest {
  user?: JWTPayload
}

export function withAuth(
  handler: (request: AuthenticatedRequest) => Promise<NextResponse>
) {
  return async (request: NextRequest) => {
    try {
      const authHeader = request.headers.get('authorization')

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        await logUnauthorizedAccess(request, new URL(request.url).pathname)
        return ErrorResponses.unauthorized()
      }

      const token = authHeader.substring(7) // Remove 'Bearer '
      
      try {
        const user = verifyToken(token)
        
        // Attach user to request
        const authenticatedRequest = request as AuthenticatedRequest
        authenticatedRequest.user = user
        
        return handler(authenticatedRequest)
      } catch (error) {
        await logUnauthorizedAccess(request, new URL(request.url).pathname)
        return ErrorResponses.invalidToken()
      }
    } catch (error) {
      return handleError(error, request, {
        resource: new URL(request.url).pathname,
        action: 'authenticate'
      })
    }
  }
}

export function requireRole(...allowedRoles: string[]) {
  return (handler: (request: AuthenticatedRequest) => Promise<NextResponse>) => {
    return withAuth(async (request: AuthenticatedRequest) => {
      const user = request.user!
      
      if (!allowedRoles.includes(user.role)) {
        await logUnauthorizedAccess(
          request,
          new URL(request.url).pathname,
          user.id,
          allowedRoles.join(',')
        )
        return ErrorResponses.insufficientPermissions()
      }
      
      return handler(request)
    })
  }
}