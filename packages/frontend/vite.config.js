import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react-swc'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '../..')
const proxyRoutes = ['/chat', '/health', '/models', '/api']

function readInt(value, fallback) {
  const parsed = Number.parseInt(value, 10)
  return Number.isNaN(parsed) ? fallback : parsed
}

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, '')
}

function readEnv(mode) {
  return {
    ...loadEnv(mode, repoRoot, ''),
    ...loadEnv(mode, __dirname, ''),
    ...process.env,
  }
}

function readAllowedHosts(value) {
  if (!value) return ['.local']
  if (value === 'true') return true
  if (value === 'false') return undefined

  return value
    .split(',')
    .map((host) => host.trim())
    .filter(Boolean)
}

export default defineConfig(({ mode }) => {
  const env = readEnv(mode)
  const backendPort = readInt(env.PORT, 4000)
  const backendUrl = trimTrailingSlash(
    env.VITE_BACKEND_URL || env.VITE_API_BASE_URL || `http://127.0.0.1:${backendPort}`,
  )
  const frontendHost = env.FRONTEND_HOST || env.VITE_HOST || env.HOST || '0.0.0.0'
  const frontendPort = readInt(env.FRONTEND_PORT || env.VITE_PORT, 5173)
  const allowedHosts = readAllowedHosts(env.VITE_ALLOWED_HOSTS)

  return {
    plugins: [react()],
    server: {
      host: frontendHost,
      port: frontendPort,
      allowedHosts,
      proxy: Object.fromEntries(
        proxyRoutes.map((route) => [
          route,
          {
            target: backendUrl,
            changeOrigin: true,
          },
        ]),
      ),
    },
    preview: {
      host: frontendHost,
      port: readInt(env.PREVIEW_PORT || env.VITE_PREVIEW_PORT, 4173),
      allowedHosts,
    },
  }
})
