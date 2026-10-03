// Local test fixture serves the actual production build. Only SW/index revision
// and a selected failed download vary; no game APIs or simulation hooks.
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve, extname } from 'node:path'

const root = resolve('dist')
let release = 0
let failingAsset = ''
let failedPrecacheDownloads = 0
const mime: Record<string, string> = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
}

createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1:4175')
    if (request.method === 'POST' && url.pathname === '/__test/config') {
      release = Number(url.searchParams.get('release') ?? '0')
      failingAsset = url.searchParams.get('fail') ?? ''
      failedPrecacheDownloads = 0
      response.writeHead(204).end()
      return
    }
    if (request.method === 'GET' && url.pathname === '/__test/status') {
      response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ failedPrecacheDownloads }))
      return
    }
    if (!url.pathname.startsWith('/Saftladen/')) {
      response.writeHead(404).end()
      return
    }
    const relative = decodeURIComponent(url.pathname.slice('/Saftladen/'.length)) || 'index.html'
    const path = resolve(root, relative)
    if (!path.startsWith(`${root}/`)) {
      response.writeHead(403).end()
      return
    }
    if (failingAsset && relative.includes(failingAsset)) {
      if (request.headers['sec-fetch-dest'] === 'empty') failedPrecacheDownloads += 1
      response.writeHead(503).end('Interrupted test download')
      return
    }
    let data = await readFile(path)
    if (relative === 'sw.js') {
      const source = data.toString()
      // A real precache revision change forces a new HTML download/install.
      const revised = source.replace(/(url:"index\.html",revision:")[^"]+("})/, `$1test-release-${release}$2`)
      if (source === revised) throw new Error('Generated HTML precache entry not found')
      data = Buffer.from(`${revised}\n// Test release ${release}\n`)
    } else if (relative === 'index.html') {
      data = Buffer.from(data.toString().replace('</head>', `<meta name="test-release" content="${release}"></head>`))
    }
    response.writeHead(200, { 'Content-Type': mime[extname(path)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' })
    response.end(data)
  } catch {
    response.writeHead(404).end()
  }
}).listen(4175, '127.0.0.1')
