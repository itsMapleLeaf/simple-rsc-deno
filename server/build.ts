import { toPathString } from "https://deno.land/std@0.184.0/fs/_util.ts"
import { ensureDir } from "https://deno.land/std@0.184.0/fs/mod.ts"
import * as esbuild from "https://deno.land/x/esbuild@v0.17.17/mod.js"
import outdent from "https://deno.land/x/outdent@v0.8.0/mod.ts"
import { denoPlugins } from "https://raw.githubusercontent.com/lucacasonato/esbuild_deno_loader/main/mod.ts"
import {
  ClientComponentMap,
  resolveClientDist,
  resolveDist,
  resolveSrc,
  writeClientComponentMap,
} from "./utils.ts"

const USE_CLIENT_ANNOTATIONS = ['"use client"', "'use client'"]
const relativeOrAbsolutePathRegex = /^\.{0,2}\//

const sharedConfig: esbuild.BuildOptions = {
  bundle: true,
  format: "esm",
  logLevel: "error",
  jsx: "automatic",
}

const createDenoPlugins = (): esbuild.Plugin[] => [
  // Hack around JSON loader overrides in esbuild_deno_loader that flag type
  // assertions.
  {
    name: "json",
    setup: (build) =>
      build.onLoad({ filter: /\.json$/ }, () => ({ loader: "json" })),
  },
  ...denoPlugins({
    configPath: toPathString(new URL("../deno.jsonc", import.meta.url)),
  }),
]

/**
 * Build all server and client components with esbuild
 */
export async function build() {
  await Deno.remove(new URL("../dist/", import.meta.url), { recursive: true })
    .catch(() => {})

  const clientImportResolver = createClientImportResolver()

  console.log("💿 Building server components")

  const serverDist = resolveDist("server/")
  await ensureDir(serverDist)

  await esbuild.build({
    ...sharedConfig,
    entryPoints: [new URL("../app/page.tsx", import.meta.url).href],
    outdir: toPathString(serverDist),
    plugins: [clientImportResolver.plugin, ...createDenoPlugins()],
  })

  if (clientImportResolver.entries.size > 0) {
    console.log("🏝 Building client components")
  }

  const clientDist = resolveDist("client/")
  await ensureDir(clientDist)

  await esbuild.build({
    ...sharedConfig,
    plugins: createDenoPlugins(),
    entryPoints: [
      new URL("../app/_router.tsx", import.meta.url).href,
      ...clientImportResolver.entries,
    ],
    outdir: toPathString(clientDist),
    splitting: true,
  })

  // Write mapping from client-side component ID to chunk
  // This is read by the server when generating the RSC stream.
  await writeClientComponentMap(clientImportResolver.componentMap)
}

function createClientImportResolver() {
  const componentMap: ClientComponentMap = {}
  const entries = new Set<string>()

  const plugin: esbuild.Plugin = {
    name: "resolve-client-imports",
    setup(build) {
      // Intercept component imports to find client entry points
      build.onResolve(
        { filter: relativeOrAbsolutePathRegex },
        async ({ path }) => {
          const absoluteSrc = resolveSrc(path)

          const stats = await Deno.stat(absoluteSrc).catch(() => undefined)
          if (!stats?.isFile) return

          // Check for `"use client"` annotation. Short circuit if not found.
          const contents = await Deno.readTextFile(absoluteSrc)
            .then((text) => text.trim())

          const isClientComponent = USE_CLIENT_ANNOTATIONS.some(
            (annotation) => contents.startsWith(annotation),
          )
          if (!isClientComponent) return

          entries.add(absoluteSrc.href)

          const absoluteDist = new URL(
            resolveClientDist(path).href.replace(/\.(j|t)sx?$/, ".js"),
          )

          // Path the browser will import this client-side component from.
          // This will be fulfilled by the server router.
          // @see './index.js'
          const id = `/dist/client/${path.replace(/\.(j|t)sx?$/, ".js")}`

          componentMap[id] = {
            id,
            chunks: [],
            name: "default", // TODO support named exports
            async: true,
          }

          return {
            // Encode the client component module in the import URL.
            // This is a... wacky solution to avoid import middleware.
            path: `data:text/javascript,${
              encodeURIComponent(
                getClientComponentModule(id, absoluteDist.href),
              )
            }`,
            external: true,
          }
        },
      )
    },
  }

  return { componentMap, entries, plugin }
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
