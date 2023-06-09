import { toPathString } from "https://deno.land/std@0.184.0/fs/_util.ts"
import { Application } from "https://deno.land/x/oak@v12.2.0/mod.ts"
import {
  WebSocketClient,
  WebSocketServer,
} from "https://deno.land/x/websocket@v0.1.4/mod.ts"
import { router } from "./router.tsx"

Deno.env.set("NODE_ENV", "development")

function startHttpServer() {
  const app = new Application().use(router.routes())

  app.addEventListener("listen", () => {
    console.log(`⚛️ Future of React started on http://localhost:${port}`)
  })

  const port = 3000
  return app.listen({ port, hostname: "localhost" })
}

// File watcher to trigger browser refreshes
// ------------
const sockets = new Set<WebSocketClient>()
function startSocketServer() {
  const refreshPort = 21717
  const wsServer = new WebSocketServer(refreshPort)

  wsServer.on("connection", (ws) => {
    sockets.add(ws)

    ws.on("close", () => {
      sockets.delete(ws)
    })

    ws.send("connected")
  })
}

// /**
//  * Watch files in the `app/` directory
//  * and trigger a build + refresh on change.
//  */
async function startFileWatcher() {
  const watcher = Deno.watchFs(
    toPathString(new URL("../app/", import.meta.url)),
  )
  for await (const _event of watcher) {
    for (const socket of sockets) {
      socket.send("refresh")
    }
  }
}

await Promise.all([startHttpServer(), startSocketServer(), startFileWatcher()])
