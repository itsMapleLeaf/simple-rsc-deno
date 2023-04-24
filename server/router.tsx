import { typeByExtension } from "https://deno.land/std@0.183.0/media_types/type_by_extension.ts"
import { toPathString } from "https://deno.land/std@0.184.0/fs/_util.ts"
import * as esbuild from "https://deno.land/x/esbuild@v0.17.18/mod.js"
import { Router } from "https://deno.land/x/oak@v12.2.0/mod.ts"
import { renderToString } from "react-dom/server"
import * as ReactServerDom from "react-server-dom-webpack/server.browser"
import { Document } from "../app/document.tsx"
import { loadPageComponent } from "./load-page-component.ts"

export const router = new Router()
const appFolderUrl = new URL("../app/", import.meta.url)

// Serve HTML homepage that fetches and renders the server component.
router.get("/", (ctx) => {
  const html = renderToString(
    <Document>
      <p>Loading...</p>
    </Document>,
  )
  ctx.response.body = html
  ctx.response.headers.set("Content-Type", "text/html")
})

// Serve client-side components in the app folder
router.get("/app/:file*", async (ctx) => {
  const entryUrl = new URL(ctx.params.file!, appFolderUrl)

  const result = await esbuild.build({
    entryPoints: [toPathString(entryUrl)],
    bundle: true,
    write: false,
    format: "esm",
    packages: "external",
    jsx: "automatic",
    sourcemap: "inline",
  })

  ctx.response.body = result.outputFiles[0].contents
  ctx.response.headers.set("Content-Type", getContentType(entryUrl.pathname))
})

router.get("/rsc", async (ctx) => {
  const { Component, componentMap } = await loadPageComponent(
    new URL("../app/page.tsx", import.meta.url),
  )

  console.log(componentMap)

  // 👀 This is where the magic happens!
  // Render the server component tree to a stream.
  // This renders your server components in real time and
  // sends each component to the browser as soon as its resolved.
  const stream: ReadableStream = ReactServerDom.renderToReadableStream(
    <Component search={ctx.request.url.searchParams.get("search") ?? ""} />,
    componentMap,
  )
  ctx.response.body = stream
  ctx.response.headers.set("Content-Type", "text/html")
})

function getContentType(path: string): string {
  if (path.endsWith(".ts")) return "text/javascript"
  if (path.endsWith(".tsx")) return "text/javascript"

  const contentType = typeByExtension(path)
  if (contentType) return contentType

  return "text/plain"
}
