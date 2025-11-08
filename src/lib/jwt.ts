import jwt from 'jsonwebtoken'

// Enforce JWT_SECRET is set - fail fast if missing
const JWT_SECRET = process.env.JWT_SECRET

if (!JWT_SECRET) {
  throw new Error('FATAL: JWT_SECRET environment variable must be set')
}

export interface JWTPayload {
  id: string
  email: string
  role: string
}

export function signToken(payload: JWTPayload, expiresIn: string = '2h'): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn })
}

export function verifyToken(token: string): JWTPayload {
  return jwt.verify(token, JWT_SECRET) as JWTPayload
}

export function getJWTSecret(): string {
  return JWT_SECRET
}