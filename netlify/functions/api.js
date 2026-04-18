const fs = require('fs')
const os = require('os')
const path = require('path')
const serverless = require('serverless-http')

let handlerPromise

function getCallableExport(moduleValue, exportName) {
  if (typeof moduleValue === 'function') {
    return moduleValue
  }

  if (moduleValue && typeof moduleValue.default === 'function') {
    return moduleValue.default
  }

  if (exportName && moduleValue && typeof moduleValue[exportName] === 'function') {
    return moduleValue[exportName]
  }

  throw new TypeError(
    `${exportName || 'Required module'} is not a function`,
  )
}

function ensureAnonymousTokenFile() {
  const anonymousTokenPath = path.resolve(os.tmpdir(), 'anonymous_token')
  if (!fs.existsSync(anonymousTokenPath)) {
    fs.writeFileSync(anonymousTokenPath, '', 'utf-8')
  }
}

async function createHandler() {
  process.env.NCM_API_PROJECT_ROOT =
    process.env.NCM_API_PROJECT_ROOT ||
    process.env.LAMBDA_TASK_ROOT ||
    process.cwd()

  ensureAnonymousTokenFile()

  const generateConfig = getCallableExport(
    require('../../generateConfig'),
    'generateConfig',
  )
  await generateConfig()

  const serverModule = require('../../server')
  const constructServer = getCallableExport(serverModule, 'constructServer')
  const app = await constructServer()

  return serverless(app)
}

exports.handler = async (event, context) => {
  if (!handlerPromise) {
    handlerPromise = createHandler().catch((error) => {
      handlerPromise = null
      throw error
    })
  }

  const handler = await handlerPromise
  return handler(event, context)
}
