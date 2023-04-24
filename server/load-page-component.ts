import { toPathString } from "https://deno.land/std@0.184.0/fs/_util.ts"
import * as path from "https://deno.land/std@0.184.0/path/mod.ts"
import * as esbuild from "https://deno.land/x/esbuild@v0.17.18/mod.js"
import { outdent } from "https://deno.land/x/outdent@v0.8.0/mod.ts"
import * as swc from "https://deno.land/x/swc@0.2.1/mod.ts"
import { ComponentMap } from "./component-map.ts"

const reactComponentNameRegex = /^[A-Z]/

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
    name: "react-client-components",
    setup(build) {
      build.onLoad({ filter: /\.(jsx|tsx)$/ }, async (args) => {
        const source = await Deno.readTextFile(args.path)

        const ast = swc.parse(source, {
          syntax: "typescript",
          tsx: true,
        })

        const isClientComponentFile = ast.body.some((node) =>
          node.type === "ExpressionStatement" &&
          node.expression.type === "StringLiteral" &&
          node.expression.value === "use client"
        )
        if (!isClientComponentFile) {
          return
        }

        const fileUrl = path.toFileUrl(args.path)
        const projectRootUrl = new URL(import.meta.url)

        // get the path relative from the root
        const id = path.posix.join(
          "/",
          path.posix.relative(
            path.posix.dirname(projectRootUrl.pathname),
            fileUrl.pathname,
          ),
        )

        for (let i = ast.body.length - 1; i >= 0; i--) {
          const node = ast.body[i]
          if (
            node.type === "ExportDefaultDeclaration" &&
            node.decl.type === "FunctionExpression" &&
            node.decl.identifier.value.match(reactComponentNameRegex)
          ) {
            ast.body[i] = swc.parse(getClientComponentTemplate(id), {
              syntax: "typescript",
              tsx: true,
            }).body[0]

            componentMap[id] = {
              id,
              name: "default",
              chunks: [],
              async: true,
            }
          }
        }

        return {
          contents: swc.print(ast).code,
          loader: "tsx",
        }
      })
    },
  }

  return { plugin, componentMap }
}

function getClientComponentTemplate(id: string) {
  return outdent`
    export default Object.defineProperties(function() {
      throw new Error("Attempted to call the default export of ${id} from the server.")
    },{
      $$typeof: { value: Symbol.for("react.client.reference") },
      $$id: { value: ${JSON.stringify(id)} },
    })
  `
}
