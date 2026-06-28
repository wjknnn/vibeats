import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import path from 'node:path'

// dev 전용: 에디터가 보낸 비트맵 JSON을 public/beatmap/ 에 실제로 저장한다.
function beatmapSaver(): Plugin {
  return {
    name: 'beatmap-saver',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__save-beatmap', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          return res.end('method not allowed')
        }
        let body = ''
        req.on('data', (c) => (body += c))
        req.on('end', () => {
          try {
            const { file, data } = JSON.parse(body) as { file: string; data: unknown }
            const rel = file.replace(/^\//, '') // 앞 슬래시 제거
            // public/beatmap/*.json 으로만 제한 (경로 탈출 방지)
            if (!rel.startsWith('beatmap/') || !rel.endsWith('.json') || rel.includes('..')) {
              res.statusCode = 400
              return res.end('bad path')
            }
            const full = path.join(process.cwd(), 'public', rel)
            fs.writeFileSync(full, JSON.stringify(data, null, 2), 'utf-8')
            res.statusCode = 200
            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify({ ok: true, path: rel }))
          } catch (e) {
            res.statusCode = 500
            res.end(String(e))
          }
        })
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), beatmapSaver()],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
})
