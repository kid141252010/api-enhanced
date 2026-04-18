const fs = require('fs')
const path = require('path')

function hasProjectMarkers(dir) {
  return ['module', 'util', 'data'].every((name) =>
    fs.existsSync(path.join(dir, name)),
  )
}

function findProjectRoot(startDir = __dirname) {
  const candidates = [
    process.env.NCM_API_PROJECT_ROOT,
    process.env.LAMBDA_TASK_ROOT,
    process.cwd(),
    startDir,
    path.resolve(startDir, '..'),
    path.resolve(startDir, '../..'),
    path.resolve(startDir, '../../..'),
  ].filter(Boolean)

  const visited = new Set()

  for (const candidate of candidates) {
    let current = path.resolve(candidate)

    while (!visited.has(current)) {
      visited.add(current)

      if (hasProjectMarkers(current)) {
        return current
      }

      const parent = path.dirname(current)
      if (parent === current) {
        break
      }
      current = parent
    }
  }

  return path.resolve(process.cwd())
}

function resolveProjectPath(...segments) {
  return path.join(findProjectRoot(__dirname), ...segments)
}

module.exports = {
  findProjectRoot,
  resolveProjectPath,
}
