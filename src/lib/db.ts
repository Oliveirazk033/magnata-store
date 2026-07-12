import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'

function parseLibsqlUrl(connectionString: string): { url: string; authToken?: string } {
  // libsql://host/path?authToken=xxx
  // URL parser doesn't support libsql:// protocol, so parse manually
  const withoutProtocol = connectionString.replace(/^libsql:\/\//, '')
  const queryIndex = withoutProtocol.indexOf('?')
  const urlPart = queryIndex >= 0 ? withoutProtocol.substring(0, queryIndex) : withoutProtocol
  const queryPart = queryIndex >= 0 ? withoutProtocol.substring(queryIndex + 1) : ''

  const params = new URLSearchParams(queryPart)
  const authToken = params.get('authToken') || undefined

  return { url: `libsql://${urlPart}`, authToken }
}

function createPrismaClient() {
  const tursoUrl = process.env.TURSO_DATABASE_URL
  const isTurso = tursoUrl?.startsWith('libsql://') || tursoUrl?.startsWith('https://')

  if (isTurso) {
    // Prisma requires DATABASE_URL for schema validation even when using adapter
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.startsWith('file:')) {
      process.env.DATABASE_URL = tursoUrl
    }

    // Newer @libsql/client doesn't support ?authToken= in URL
    // Must pass url and authToken separately
    const { url, authToken } = parseLibsqlUrl(tursoUrl)

    console.log('[DB] Connecting to Turso:', url)

    const adapterConfig: { url: string; authToken?: string } = { url }
    if (authToken) {
      adapterConfig.authToken = authToken
    }

    const adapter = new PrismaLibSQL(adapterConfig)
    return new PrismaClient({ adapter, log: ['error'] })
  }

  return new PrismaClient({ log: ['error'] })
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db