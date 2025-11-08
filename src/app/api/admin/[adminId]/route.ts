import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyToken as verifyJWT, JWTPayload } from '@/lib/jwt'
import { handleError, ErrorResponses, createSuccessResponse } from '@/lib/error-handler'
import { logAdminOperation, AuditEventType } from '@/lib/audit-logger'

// Verify JWT token
function verifyToken(request: NextRequest): JWTPayload | null {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }
  
  const token = authHeader.substring(7)
  try {
    return verifyJWT(token)
  } catch {
    return null
  }
}

// DELETE admin
export async function DELETE(
  request: NextRequest,
  { params }: { params: { adminId: string } }
) {
  try {
    const user = verifyToken(request)
    if (!user) {
      return ErrorResponses.invalidToken()
    }
    
    if (user.role !== 'SUPER_ADMIN') {
      return ErrorResponses.insufficientPermissions('Только суперадминистраторы могут удалять администраторов')
    }

    const { adminId } = params

    // Check if admin exists and is middle admin
    const admin = await db.admin.findUnique({
      where: { id: adminId }
    })

    if (!admin || admin.role !== 'MIDDLE_ADMIN') {
      return ErrorResponses.notFound('Администратор')
    }

    // Delete admin
    await db.admin.delete({
      where: { id: adminId }
    })

    // Log the action
    await db.actionLog.create({
      data: {
        adminId: user.id,
        action: 'DELETE_ADMIN',
        entityType: 'ADMIN',
        entityId: adminId,
        description: `Deleted middle admin: ${admin.name}`
      }
    })
    
    await logAdminOperation(
      request,
      AuditEventType.ADMIN_DELETED,
      user.id,
      user.role,
      `admin/${adminId}`,
      { deletedAdminName: admin.name, deletedAdminEmail: admin.email }
    )

    return createSuccessResponse({ success: true }, 'Администратор успешно удален')
  } catch (error) {
    return handleError(error, request, {
      resource: 'admin',
      action: 'delete',
      userId: verifyToken(request)?.id,
      userRole: verifyToken(request)?.role
    })
  }
}