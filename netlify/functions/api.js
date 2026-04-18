const fs = require('fs')
const os = require('os')
const path = require('path')
const serverless = require('serverless-http')

let handlerPromise

function ensureAnonymousTokenFile() {
  const anonymousTokenPath = path.resolve(os.tmpdir(), 'anonymous_token')
  if (!fs.existsSync(anonymousTokenPath)) {
    fs.writeFileSync(anonymousTokenPath, '', 'utf-8')
  }
}

async function createHandler() {
  // Resolve against the packaged npm module rather than the repo root.
  const packageRoot = path.dirname(
    require.resolve('@neteasecloudmusicapienhanced/api/package.json'),
  )

  process.env.NCM_API_PROJECT_ROOT =
    process.env.NCM_API_PROJECT_ROOT || packageRoot

  ensureAnonymousTokenFile()

  const generateConfig = require('@neteasecloudmusicapienhanced/api/generateConfig')
  await generateConfig()

  const { constructServer } = require('@neteasecloudmusicapienhanced/api/server')
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
