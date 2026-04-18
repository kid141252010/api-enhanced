const AdmZip = require('adm-zip')
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const projectRoot = path.resolve(__dirname, '..')
const netlifyRoot = path.join(projectRoot, '.netlify')
const packagesDir = path.join(netlifyRoot, 'packages')
const functionsBuildDir = path.join(netlifyRoot, 'functions-build')
const functionsDistDir = path.join(netlifyRoot, 'functions-dist')
const functionName = 'api'
const functionBuildDir = path.join(functionsBuildDir, functionName)

// Netlify's JS bundlers strip the dynamic module tree this project relies on.
// Build a complete ZIP artifact instead so the runtime layout stays intact.
function getChildEnv() {
  const env = { ...process.env }

  for (const key of Object.keys(env)) {
    if (key.startsWith('npm_') || key.startsWith('pnpm_')) {
      delete env[key]
    }
  }

  return env
}

function run(command, args, cwd) {
  execFileSync(command, args, {
    cwd,
    stdio: 'inherit',
    env: getChildEnv(),
  })
}

function execNpm(args, options = {}) {
  if (process.platform === 'win32') {
    return execFileSync('cmd.exe', ['/d', '/s', '/c', 'npm', ...args], {
      env: getChildEnv(),
      ...options,
    })
  }

  return execFileSync('npm', args, {
    env: getChildEnv(),
    ...options,
  })
}

function resetDir(dirPath) {
  fs.rmSync(dirPath, { recursive: true, force: true })
  fs.mkdirSync(dirPath, { recursive: true })
}

function packProject() {
  const packOutput = execNpm(
    [
      'pack',
      '--json',
      '--ignore-scripts',
      '--pack-destination',
      packagesDir,
    ],
    {
      cwd: projectRoot,
      encoding: 'utf8',
    },
  )

  const [packResult] = JSON.parse(packOutput)
  if (!packResult || !packResult.filename) {
    throw new Error('Failed to create the Netlify package tarball.')
  }

  return packResult.filename
}

function writeFunctionPackage(tarballFileName) {
  const packageJSON = {
    name: 'ncm-api-netlify-function',
    private: true,
    dependencies: {
      '@neteasecloudmusicapienhanced/api': `file:../../packages/${tarballFileName}`,
      'serverless-http': '^4.0.0',
    },
  }

  fs.writeFileSync(
    path.join(functionBuildDir, 'package.json'),
    JSON.stringify(packageJSON, null, 2),
  )
}

function copyFunctionEntry() {
  const sourceEntry = path.join(projectRoot, 'netlify', 'functions', 'api.js')
  const targetEntry = path.join(functionBuildDir, 'api.js')

  fs.copyFileSync(sourceEntry, targetEntry)
}

function installFunctionDependencies() {
  execNpm(
    [
      'install',
      '--omit=dev',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      '--no-package-lock',
    ],
    { cwd: functionBuildDir, stdio: 'inherit' },
  )
}

function zipFunctionBundle() {
  const zip = new AdmZip()
  zip.addLocalFolder(functionBuildDir, '')
  zip.writeZip(path.join(functionsDistDir, `${functionName}.zip`))
}

function main() {
  resetDir(packagesDir)
  resetDir(functionsBuildDir)
  resetDir(functionsDistDir)

  const tarballFileName = packProject()
  fs.mkdirSync(functionBuildDir, { recursive: true })

  writeFunctionPackage(tarballFileName)
  copyFunctionEntry()
  installFunctionDependencies()
  zipFunctionBundle()

  console.log(`Prepared Netlify function bundle at ${functionsDistDir}`)
}

main()
