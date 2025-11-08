# Code Review and Analysis Report
## Next.js TypeScript Delivery/Courier Management System

**Review Date:** 2025-11-08  
**Reviewer:** Architecture Analysis  
**Project Type:** Multi-admin level delivery management system with auto-ordering

---

## Executive Summary

This comprehensive code review identified **28 critical issues**, **35 high-priority issues**, **42 medium-priority issues**, and **18 low-priority issues** across security, architecture, performance, and code quality domains.

### Critical Findings Summary:
- ❌ Hardcoded JWT secret keys in production code
- ❌ Plaintext password storage in server.ts
- ❌ SQL injection vulnerabilities via lack of input validation
- ❌ Race conditions in auto-order scheduler
- ❌ Missing authentication on critical API routes
- ❌ Type safety violations throughout codebase
- ❌ No database indexes on frequently queried fields
- ❌ Dual data storage system (in-memory + database)

### Overall Risk Assessment: **HIGH**

**Recommended Actions:**
1. Immediate security fixes (JWT, passwords, input validation)
2. Database migration and indexing
3. Remove dual storage system
4. Implement proper error handling and logging
5. Add comprehensive testing

---

## Table of Contents

1. [Security Vulnerabilities](#1-security-vulnerabilities)
2. [Architecture Issues](#2-architecture-issues)
3. [Database & Data Model Issues](#3-database--data-model-issues)
4. [Authentication & Authorization](#4-authentication--authorization)
5. [API Route Security](#5-api-route-security)
6. [Type Safety Issues](#6-type-safety-issues)
7. [Performance Issues](#7-performance-issues)
8. [Auto-Order Scheduler Issues](#8-auto-order-scheduler-issues)
9. [WebSocket Implementation](#9-websocket-implementation)
10. [Code Quality Issues](#10-code-quality-issues)
11. [Best Practice Violations](#11-best-practice-violations)
12. [Recommendations & Fixes](#12-recommendations--fixes)

---

## 1. Security Vulnerabilities

### 🔴 CRITICAL: Hardcoded JWT Secret

**Files:**
- [`src/app/api/auth/login/route.ts:6`](src/app/api/auth/login/route.ts:6)
- [`src/app/api/admin/couriers/route.ts:6`](src/app/api/admin/couriers/route.ts:6)
- [`src/app/api/orders/route.ts:7`](src/app/api/orders/route.ts:7)
- [`src/app/api/orders/[orderId]/route.ts:7`](src/app/api/orders/[orderId]/route.ts:7)

```typescript
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'
```

**Issue:** Fallback to hardcoded secret defeats security. If `JWT_SECRET` env var missing, all tokens can be forged.

**Impact:** Complete authentication bypass, unauthorized admin access.

**Fix:**
```typescript
const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) {
  throw new Error('FATAL: JWT_SECRET environment variable is required')
}
```

---

### 🔴 CRITICAL: Plaintext Passwords in Memory

**File:** [`server.ts:82-92`](server.ts:82-92)

```typescript
let admins: any[] = [
  {
    id: 'super-1',
    email: 'super@admin.com',
    password: 'admin123',  // ❌ PLAINTEXT
    name: 'Супер Администратор',
    role: 'SUPER_ADMIN',
    isActive: true,
    createdAt: new Date().toISOString()
  }
];
```

**Issue:** Plaintext credentials in global variable.

**Impact:** Credential exposure, security breach.

**Fix:** Remove entirely. Use database with bcrypt-hashed passwords only.

---

### 🔴 CRITICAL: No Input Validation

**File:** [`src/app/api/orders/route.ts:160-174`](src/app/api/orders/route.ts:160-174)

**Issue:** No validation/sanitization before database operations.

**Impact:** SQL injection, XSS, data corruption.

**Fix:**
```typescript
import { z } from 'zod'

const OrderSchema = z.object({
  customerName: z.string().min(1).max(100).trim(),
  customerPhone: z.string().regex(/^\+\d{10,15}$/),
  deliveryAddress: z.string().min(5).max(500),
  calories: z.number().int().positive(),
  quantity: z.number().int().positive(),
  specialFeatures: z.string().max(500).optional(),
  paymentStatus: z.enum(['PAID', 'UNPAID']),
  paymentMethod: z.enum(['CARD', 'CASH']),
  isPrepaid: z.boolean(),
  date: z.string().datetime().optional()
})

const body = await request.json()
const validated = OrderSchema.parse(body) // Throws on invalid
```

---

### 🔴 CRITICAL: Weak Password Requirements

**File:** [`src/app/super-admin/page.tsx:373`](src/app/super-admin/page.tsx:373)

```typescript
<Input
  type="password"
  required
  minLength={6}  // ❌ Too weak
/>
```

**Issue:** Only 6 characters required.

**Fix:** Enforce strong policy (12+ chars, mixed case, numbers, symbols).

---

### 🟠 HIGH: No Rate Limiting

**Files:** All API routes

**Issue:** No rate limiting on auth or API endpoints.

**Impact:** Brute force attacks, API abuse, DDoS.

**Fix:** Implement rate limiting middleware:
```typescript
import rateLimit from 'express-rate-limit'

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
})
```

---

### 🟠 HIGH: CORS Too Permissive

**File:** [`server.ts:356-359`](server.ts:356-359)

```typescript
cors: {
  origin: "*",  // ❌ Allows all origins
  methods: ["GET", "POST"]
}
```

**Fix:**
```typescript
cors: {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
  methods: ["GET", "POST", "PATCH", "DELETE"]
}
```

---

### 🟠 HIGH: No CSRF Protection

**Files:** All POST/PATCH/DELETE routes

**Issue:** State-changing operations lack CSRF tokens.

**Fix:** Implement CSRF token validation or use SameSite cookies.

---

### 🟠 HIGH: API Returns Plaintext Passwords

**File:** [`src/app/super-admin/page.tsx:233-251`](src/app/super-admin/page.tsx:233-251)

```typescript
const response = await fetch(`/api/admin/${adminId}/password`)
const data = await response.json()
setSelectedPassword(data.password)  // ❌ Plaintext password
```

**Issue:** API endpoint returns unhashed passwords.

**Fix:** Remove this endpoint. Implement password reset flow instead.

---

## 2. Architecture Issues

### 🔴 CRITICAL: Dual Data Storage

**File:** [`server.ts:13-79`](server.ts:13-79)

```typescript
// In-memory storage
let clients: any[] = [...]
let orders: any[] = []

// Plus Prisma database
const dbClient = await db.customer.findUnique({...})
```

**Issue:** Both in-memory arrays AND database used simultaneously.

**Impact:**
- Data inconsistency
- Data loss on restart
- Race conditions
- Memory leaks

**Fix:** Remove ALL in-memory storage. Database is single source of truth.

---

### 🟠 HIGH: Global State Pollution

**File:** [`server.ts:395-452`](server.ts:395-452)

```typescript
(global as any).autoOrderScheduler = {...}
(global as any).admins = admins;
```

**Issue:** Application state attached to global object.

**Impact:** Memory leaks, race conditions, testing difficulties.

**Fix:** Use dependency injection or context pattern.

---

### 🟠 HIGH: No Error Boundaries

**Files:** All React pages

**Issue:** Component errors crash entire app.

**Fix:**
```typescript
// components/ErrorBoundary.tsx
class ErrorBoundary extends React.Component {
  componentDidCatch(error, errorInfo) {
    console.error('Caught error:', error, errorInfo)
  }
  render() {
    return this.state.hasError ? <ErrorFallback /> : this.props.children
  }
}
```

---

### 🟡 MEDIUM: Tight Coupling

**Issue:** Business logic, data access, presentation mixed together.

**Fix:** Implement layered architecture:
```
controllers/ (API routes)
services/   (business logic)
repositories/ (data access)
models/     (domain models)
dtos/       (data transfer objects)
```

---

## 3. Database & Data Model Issues

### 🔴 CRITICAL: Missing Database Indexes

**File:** [`prisma/schema.prisma`](prisma/schema.prisma)

```prisma
model Order {
  customerId      String     // ❌ No index
  adminId         String     // ❌ No index
  courierId       String?    // ❌ No index
  deliveryDate    DateTime?  // ❌ No index
  orderStatus     OrderStatus // ❌ No index
}
```

**Impact:** Severe performance degradation as data grows.

**Fix:**
```prisma
model Order {
  id              String     @id @default(cuid())
  orderNumber     Int        @unique
  customerId      String
  adminId         String
  courierId       String?
  deliveryDate    DateTime?
  orderStatus     OrderStatus @default(PENDING)
  paymentStatus   PaymentStatus
  
  customer  Customer @relation(fields: [customerId], references: [id])
  admin     Admin    @relation("OrderAdmin", fields: [adminId], references: [id])
  courier   Admin?   @relation("OrderCourier", fields: [courierId], references: [id])
  
  @@index([customerId])
  @@index([adminId])
  @@index([courierId])
  @@index([deliveryDate])
  @@index([orderStatus])
  @@index([deliveryDate, orderStatus])
  @@map("orders")
}
```

---

### 🟠 HIGH: JSON Strings Instead of Proper Types

**File:** [`prisma/schema.prisma:49,72,114`](prisma/schema.prisma)

```prisma
model Customer {
  preferences  String?  // ❌ JSON string
}

model Order {
  specialFeatures String?  // ❌ JSON string
}
```

**Issue:** Cannot query by structure, no type safety.

**Fix:**
```prisma
model Customer {
  preferences  Json?  // Use Prisma Json type
}
```

---

### 🟠 HIGH: Missing Cascade Rules

**File:** [`prisma/schema.prisma`](prisma/schema.prisma)

**Issue:** No `onDelete` rules defined.

**Fix:**
```prisma
model Order {
  customer  Customer @relation(fields: [customerId], references: [id], onDelete: Restrict)
  admin     Admin    @relation("OrderAdmin", fields: [adminId], references: [id], onDelete: Restrict)
  courier   Admin?   @relation("OrderCourier", fields: [courierId], references: [id], onDelete: SetNull)
}
```

---

### 🟡 MEDIUM: SQLite for Production

**File:** [`prisma/schema.prisma:8-11`](prisma/schema.prisma:8-11)

```prisma
datasource db {
  provider = "sqlite"  // ❌ Not production-ready
  url      = env("DATABASE_URL")
}
```

**Issue:** SQLite doesn't support concurrent writes, replication, or clustering.

**Fix:** Migrate to PostgreSQL:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

---

## 4. Authentication & Authorization

### 🔴 CRITICAL: No Password Reset Flow

**Issue:** Users locked out if password forgotten.

**Fix:** Implement secure password reset with email tokens.

---

### 🟠 HIGH: Token Expiration Too Long

**File:** [`src/app/api/auth/login/route.ts:57`](src/app/api/auth/login/route.ts:57)

```typescript
{ expiresIn: '24h' }  // ❌ Too long
```

**Fix:** Use 1-2 hours with refresh token pattern.

---

### 🟠 HIGH: No Token Revocation

**Issue:** Cannot invalidate tokens (logout, deactivation).

**Fix:** Implement Redis token blacklist or use sessions.

---

### 🟠 HIGH: Inconsistent RBAC

**Files:** API routes throughout

```typescript
if (user.role !== 'MIDDLE_ADMIN' && user.role !== 'SUPER_ADMIN' && user.role !== 'COURIER') {
  return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
}
```

**Issue:** Authorization checks duplicated and inconsistent.

**Fix:**
```typescript
// lib/rbac.ts
const permissions = {
  SUPER_ADMIN: ['*'],
  MIDDLE_ADMIN: ['orders:*', 'couriers:*', 'clients:*'],
  LOW_ADMIN: ['orders:read', 'clients:*'],
  COURIER: ['orders:read', 'orders:update:own']
}

export function requirePermissions(...perms: string[]) {
  return (handler: Handler) => async (req: 