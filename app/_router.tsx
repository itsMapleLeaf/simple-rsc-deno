// @ts-expect-error Module '"react"' has no exported member 'use'.
import { startTransition, StrictMode, use, useEffect, useState } from "react"
import { createRoot } from "react-dom/client"
import { createFromFetch } from "react-server-dom-webpack/client"

/** Dev-only dependencies */
import { DevPanel } from "./utils/dev/DevPanel.tsx"
import "./utils/dev/live-reload.ts"

// HACK: map webpack resolution to native ESM
// @ts-expect-error Property '__webpack_require__' does not exist on type 'Window & typeof globalThis'.
window.__webpack_require__ = (id) => import(id)

createRoot(document.body).render(
  <StrictMode>
    <Router />
  </StrictMode>,
)

const callbacks: Array<() => void> = []

declare global {
  interface Window {
    router: {
      navigate(url: string): void
    }
  }
}

window.router = {
  navigate(url) {
    window.history.replaceState({}, "", url)
    callbacks.forEach((cb) => cb())
  },
}

function Router() {
  const [url, setUrl] = useState("/rsc" + window.location.search)

  useEffect(() => {
    function handleNavigate() {
      startTransition(() => {
        setUrl("/rsc" + window.location.search)
      })
    }
    callbacks.push(handleNavigate)
    self.addEventListener("popstate", handleNavigate)
    return () => {
      callbacks.splice(callbacks.indexOf(handleNavigate), 1)
      self.removeEventListener("popstate", handleNavigate)
    }
  }, [])

  return (
    <>
      <ServerOutput url={url} />
      <DevPanel url={url} />
    </>
  )
}

const initialCache = new Map()

function ServerOutput({ url }: { url: string }) {
  const [cache] = useState(initialCache)
  let lazyJsx = cache.get(url)
  if (!lazyJsx) {
    lazyJsx = createFromFetch(fetch(url))
    cache.set(url, lazyJsx)
  }
  return use(lazyJsx)
}
