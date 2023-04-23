import { toPathString } from "https://deno.land/std@0.184.0/fs/_util.ts"
import { exists } from "https://deno.land/std@0.184.0/fs/mod.ts"
import {} from "https://deno.land/std@0.184.0/path/mod.ts"
import * as esbuild from "https://deno.land/x/esbuild@v0.17.17/mod.js"
import outdent from "https://deno.land/x/outdent@v0.8.0/mod.ts"
import {
  ClientComponentMap,
  resolveClientDist,
  resolveDist,
  resolveSrc,
  writeClientComponentMap,
} from "./utils.ts"

const USE_CLIENT_ANNOTATIONS = ['"use client"', "'use client'"]
const relativeOrAbsolutePathRegex = /^\.{0,2}\//

/**
 * Build all server and client components with esbuild
 */
export async function build() {
  const clientComponentMap: ClientComponentMap = {}
  const clientEntryPoints = new Set<string>()

  console.log("💿 Building server components")
  const serverDist = resolveDist("server/")
  if (!(await exists(serverDist))) {
    await Deno.mkdir(serverDist, { recursive: true })
  }

  const sharedConfig: esbuild.BuildOptions = {
    bundle: true,
    format: "esm",
    logLevel: "error",
  }

  await esbuild.build({
    ...sharedConfig,
    entryPoints: [toPathString(resolveSrc("page.jsx"))],
    outdir: toPathString(serverDist),
    packages: "external",
    plugins: [
      {
        name: "resolve-client-imports",
        setup(build) {
          // Intercept component imports to find client entry points
          build.onResolve(
            { filter: relativeOrAbsolutePathRegex },
            async ({ path }) => {
              const absoluteSrc = new URL(resolveSrc(path))

              if (await exists(absoluteSrc)) {
                // Check for `"use client"` annotation. Short circuit if not found.
                const contents = await Deno.readTextFile(absoluteSrc)
                if (
                  !USE_CLIENT_ANNOTATIONS.some((annotation) =>
                    contents.startsWith(annotation),
                  )
                )
                  return

                clientEntryPoints.add(toPathString(absoluteSrc))

                const absoluteDist = new URL(
                  resolveClientDist(path).href.replace(/\.(j|t)sx?$/, ".js"),
                )

                // Path the browser will import this client-side component from.
                // This will be fulfilled by the server router.
                // @see './index.js'
                const id = `/dist/client/${path.replace(/\.(j|t)sx?$/, ".js")}`

                clientComponentMap[id] = {
                  id,
                  chunks: [],
                  name: "default", // TODO support named exports
                  async: true,
                }

                return {
                  // Encode the client component module in the import URL.
                  // This is a... wacky solution to avoid import middleware.
                  path: `data:text/javascript,${encodeURIComponent(
                    getClientComponentModule(id, absoluteDist.href),
                  )}`,
                  external: true,
                }
              }
            },
          )
        },
      },
    ],
  })

  const clientDist = resolveDist("client/")
  if (!(await exists(clientDist))) {
    await Deno.mkdir(clientDist, { recursive: true })
  }

  if (clientEntryPoints.size > 0) {
    console.log("🏝 Building client components")
  }

  await esbuild.build({
    ...sharedConfig,
    entryPoints: [
      ...clientEntryPoints,
      toPathString(resolveSrc("_router.jsx")),
    ],
    outdir: toPathString(clientDist),
    splitting: true,
  })

  // Write mapping from client-side component ID to chunk
  // This is read by the server when generating the RSC stream.
  await writeClientComponentMap(clientComponentMap)
}

/**
 * Wrap a client-side module import with metadata
 * that tells React this is a client-side component.
 */
function getClientComponentModule(id: string, localImportPath: string) {
  return outdent`
    import DefaultExport from ${JSON.stringify(localImportPath)};
    DefaultExport.$$typeof = Symbol.for("react.client.reference");
    DefaultExport.$$id=${JSON.stringify(id)};
    export default DefaultExport;
  `
}
