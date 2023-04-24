import { toPathString } from "https://deno.land/std@0.184.0/fs/_util.ts"
import * as esbuild from "https://deno.land/x/esbuild@v0.17.18/mod.js"
import * as swc from "https://deno.land/x/swc@0.2.1/mod.ts"
import { ComponentMap } from "./component-map.ts"
import { transformSource } from "./react-server-dom-webpack-node-loader.production.min.js"

export async function loadPageComponent(url: URL) {
  const resolver = clientComponentsResolver()

  const result = await esbuild.build({
    entryPoints: [toPathString(url)],
    bundle: true,
    packages: "external",
    format: "esm",
    write: false,
    jsx: "automatic",
    platform: "neutral",
    plugins: [resolver.plugin],
    sourcemap: "inline",
  })

  const module = await import(
    `data:text/javascript,${encodeURIComponent(result.outputFiles[0].text)}`
  )
  return { Component: module.default, componentMap: resolver.componentMap }
}

function clientComponentsResolver() {
  const componentMap: ComponentMap = {}

  const plugin: esbuild.Plugin = {
    name: "react-server-components",
    setup(build) {
      build.onLoad({ filter: /\.(jsx|tsx)$/ }, async (args) => {
        const source = await Deno.readTextFile(args.path)

        const output = await transformSource(source, {
          format: "module",
          url: args.path,
        }, (source: string) => {
          const result = swc.transform(
            source,
            {
              jsc: {
                parser: {
                  syntax: "typescript",
                  tsx: true,
                },
                target: "es2022",
                transform: {
                  react: {
                    runtime: "automatic",
                  },
                },
              },
            },
          )
          return { source: result.code }
        })

        if (output.source) {
          return {
            contents: output.source,
            loader: "js",
          }
        }
      })
    },
  }

  return { plugin, componentMap }
}
