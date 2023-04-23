export const src = new URL("../app/", import.meta.url)
export const dist = new URL("../dist/", import.meta.url)

export function resolveSrc(path: string): URL {
  return new URL(path, src)
}

export function resolveDist(path: string): URL {
  return new URL(path, dist)
}

export function resolveClientDist(path: string | URL) {
  return new URL(path, resolveDist("client/"))
}

export function resolveServerDist(path: string | URL) {
  return new URL(path, resolveDist("server/"))
}

export const clientComponentMapUrl = resolveDist("clientComponentMap.json")

export type ClientComponentMap = {
  [key: string]: {
    id: string
    chunks: unknown[]
    name: string
    async: boolean
  }
}

export async function writeClientComponentMap(bundleMap: ClientComponentMap) {
  await Deno.writeTextFile(clientComponentMapUrl, JSON.stringify(bundleMap))
}

export async function readClientComponentMap() {
  const bundleMap = await Deno.readTextFile(clientComponentMapUrl)
  return JSON.parse(bundleMap) as ClientComponentMap
}
