import { toPathString } from "https://deno.land/std@0.184.0/fs/_util.ts"
import { ensureDir } from "https://deno.land/std@0.184.0/fs/mod.ts"
import * as path from "https://deno.land/std@0.184.0/path/mod.ts"
import { createCache } from "https://deno.land/x/deno_cache@0.4.1/mod.ts"
import { LoadResponseModule } from "https://deno.land/x/deno_graph@0.26.0/lib/types.d.ts"
import * as esbuild from "https://deno.land/x/esbuild@v0.17.17/mod.js"
import { parse } from "https://deno.land/x/swc@0.2.1/mod.ts"
import { denoPlugins } from "https://raw.githubusercontent.com/lucacasonato/esbuild_deno_loader/main/mod.ts"
import {
  ClientComponentMap,
  resolveDist,
  writeClientComponentMap,
} from "./utils.ts"

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

  console.log("🏝 Building client components")

  const { clientEntries, componentMap } = await discoverClientComponents(
    new URL("../app/page.tsx", import.meta.url),
  )

  const clientDist = resolveDist("client/")
  await ensureDir(clientDist)

  await esbuild.build({
    bundle: true,
    format: "esm",
    logLevel: "error",
    jsx: "automatic",
    plugins: createDenoPlugins(),
    entryPoints: [
      new URL("../app/_router.tsx", import.meta.url).href,
      ...clientEntries,
    ],
    outdir: toPathString(clientDist),
    splitting: true,
  })

  // Write mapping from client-side component ID to chunk
  // This is read by the server when generating the RSC stream.
  await writeClientComponentMap(componentMap)
}

async function discoverClientComponents(entryUrl: URL) {
  const componentMap: ClientComponentMap = {}
  const clientEntries = new Set<string>()

  await walkModules(entryUrl, async (specifier) => {
    const stats = await Deno.stat(specifier).catch(() => undefined)
    if (!stats?.isFile) return

    // Check for `"use client"` annotation. Short circuit if not found.
    const contents = await Deno.readTextFile(specifier)

    let ast
    try {
      ast = parse(contents, {
        syntax: "typescript",
        tsx: true,
      })
    } catch (error) {
      console.error(error)
      throw new Error(`Failed to parse "${specifier}"`)
    }

    const firstNode = ast.body[0]
    const isClientComponent = firstNode.type === "ExpressionStatement" &&
      firstNode.expression.type === "StringLiteral" &&
      firstNode.expression.value === "use client"
    if (!isClientComponent) return

    clientEntries.add(specifier.href)

    const parsed = path.posix.parse(specifier.pathname)

    const appRelativeDir = path.posix.relative(
      new URL("../app/", import.meta.url).pathname,
      parsed.dir,
    )

    // Path the browser will import this client-side component from.
    // This will be fulfilled by the server router.
    // @see './index.js'
    const id = path.posix.join(
      `/dist/client`,
      appRelativeDir,
      `${parsed.name}.js`,
    )

    componentMap[id] = {
      id,
      chunks: [],
      name: "default", // TODO support named exports
      async: true,
    }
  })

  return { componentMap, clientEntries }
}

const cache = createCache()

async function walkModules(
  entryUrl: URL,
  callback: (specifier: URL) => Promise<void>,
) {
  const response = await cache.load(import.meta.resolve(entryUrl.href))
  if (response?.kind !== "module") {
    throw new Error(`Entry point "${entryUrl.href}" is not a module`)
  }
  await walkModulesRecursive(response, callback, new Set())
}

async function walkModulesRecursive(
  module: LoadResponseModule,
  callback: (specifier: URL) => Promise<void>,
  visited: Set<string>,
) {
  visited.add(module.specifier)
  await callback(new URL(module.specifier))

  let ast
  try {
    ast = parse(module.content, {
      syntax: "typescript",
      tsx: true,
    })
  } catch (error) {
    console.error(error)
    throw new Error(`Failed to parse "${module.specifier}"`)
  }

  // TODO: also handle dynamic imports
  const importDeclarations = ast.body.flatMap(
    (node) => node.type === "ImportDeclaration" ? [node] : [],
  )

  await Promise.all(
    importDeclarations.map(async (declaration) => {
      const specifier = import.meta.resolve(
        new URL(declaration.source.value, module.specifier).href,
      )

      if (!isTypescriptSpecifier(specifier)) return
      if (visited.has(specifier)) return

      const response = await cache.load(specifier)
      if (response?.kind === "module") {
        await walkModulesRecursive(response, callback, visited)
      }
    }),
  )
}

function isTypescriptSpecifier(specifier: string) {
  return specifier.endsWith(".ts") || specifier.endsWith(".tsx")
}
