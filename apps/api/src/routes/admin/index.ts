import { FastifyInstance } from 'fastify'
import { adminAnalyticsRoutes } from './analytics'
import { adminUsersRoutes } from './users'
import { adminTasksRoutes } from './tasks'
import { adminConnectorsRoutes } from './connectors'
import { adminFlagRoutes } from './flags'
import { novaRoutes } from './nova'
import { sandboxRoutes } from './sandbox'
import { sabhaAIRoutes } from './sabha-ai'
import { adminBroadcastRoutes } from './broadcast'

export async function adminRoutes(app: FastifyInstance) {
  await app.register(adminAnalyticsRoutes,  { prefix: '/analytics' })
  await app.register(adminUsersRoutes,      { prefix: '/users' })
  await app.register(adminTasksRoutes,      { prefix: '/tasks' })
  await app.register(adminConnectorsRoutes, { prefix: '/connectors' })
  await app.register(adminFlagRoutes,       { prefix: '/flags' })
  await app.register(novaRoutes,            { prefix: '/nova' })
  await app.register(sandboxRoutes,         { prefix: '/sandbox' })
  await app.register(sabhaAIRoutes,         { prefix: '/sabha-ai' })
  await app.register(adminBroadcastRoutes,  { prefix: '/broadcast' })
}
