import { toPathString } from "https://deno.land/std@0.184.0/fs/_util.ts"
import * as path from "https://deno.land/std@0.184.0/path/mod.ts"
import { toFileUrl } from "https://deno.land/std@0.184.0/path/win32.ts"
import * as esbuild from "https://deno.land/x/esbuild@v0.17.18/mod.js"
import * as swc from "https://deno.land/x/swc@0.2.1/mod.ts"

const reactComponentNameRegex = /^[A-Z]/

export async function loadPageComponent(url: URL) {
  const result = await esbuild.build({
    entryPoints: [toPathString(url)],
    bundle: true,
    packages: "external",
    format: "esm",
    write: false,
    jsx: "automatic",
    platform: "neutral",
    plugins: [clientComponentsPlugin()],
    sourcemap: "inline",
  })

  const module = await import(
    `data:text/javascript,${encodeURIComponent(result.outputFiles[0].text)}`
  )
  return module.default
}

function clientComponentsPlugin(): esbuild.Plugin {
  return {
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

        const fileUrl = toFileUrl(args.path)
        const projectRootUrl = new URL(import.meta.url)

        // get the path relative from the root
        const id = path.posix.join(
          "/",
          path.posix.relative(
            path.posix.dirname(projectRootUrl.pathname),
            fileUrl.pathname,
          ),
        )

        // insert the below assignments after each exported react component
        // DefaultExport.$$typeof = Symbol.for("react.client.reference");
        // DefaultExport.$$id=${JSON.stringify(appFolderRelativePath)};
        for (let i = ast.body.length - 1; i >= 0; i--) {
          const node = ast.body[i]
          if (
            node.type === "ExportDefaultDeclaration" &&
            node.decl.type === "FunctionExpression" &&
            node.decl.identifier.value.match(reactComponentNameRegex)
          ) {
            const name = node.decl.identifier.value
            const assignments = swc.parse(
              [
                `${name}.$$typeof = Symbol.for("react.client.reference");`,
                `${name}.$$id = ${JSON.stringify(id)};`,
              ].join("\n"),
              {
                syntax: "typescript",
              },
            )
            ast.body.splice(i + 1, 0, ...assignments.body)
          }
        }

        return {
          contents: swc.print(ast).code,
          loader: "tsx",
        }
      })
    },
  }
}
