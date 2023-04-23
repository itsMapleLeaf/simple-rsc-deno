import { useCallback, useEffect, useRef, useState } from "react"

export function DevPanel({ url }: { url: string }) {
  const initialContent: {
    type: "def" | "client" | "server"
    content: string
    key: string
  }[] = []
  const [content, setContent] = useState(initialContent)

  const { mouseMove, getResizeProps } = useWindowResize({
    direction: "vertical",
  })

  useEffect(() => {
    const abortController = new AbortController()

    fetch(url, {
      signal: abortController.signal,
    }).then(async (res) => {
      const reader = res.body?.getReader()
      if (!reader) return

      let allDone = false

      while (!allDone) {
        const { value, done } = await reader.read()
        if (done) {
          allDone = true
        } else {
          const decoded = new TextDecoder().decode(value)
          const segments = decoded.trim().split("\n")
          for (const segment of segments) {
            /** @type {'server' | 'client' | 'def'} */
            let type: "server" | "client" | "def" = "server"
            if (/^\d+:"\$/.test(segment)) {
              // Heuristic: messages starting with a "$"
              // are probably definitions.
              // Example: 2:"$Sreact.suspense"
              type = "def"
            } else if (/^\d+:I{"id"/.test(segment)) {
              // Heuristic: messages starting with I{"id"}
              // are probably client component imports.
              // Example: 4:I{"id":"/dist/client/SearchBox.js","chunks":[],"name":"default","async":true}
              type = "client"
            }
            setContent((state) => [
              ...state,
              { type, content: segment, key: crypto.randomUUID() },
            ])
          }
        }
      }
    })

    return () => abortController.abort()
  }, [url])

  return (
    <aside
      style={{ height: getDevtoolHeight(mouseMove) }}
      className="fixed bottom-0 left-0 right-0 bg-white rounded-2  overflow-y-scroll"
    >
      <div
        {...getResizeProps()}
        className="w-full h-4 cursor-row-resize select-none"
      >
        <hr className="border-t-2" />
      </div>
      <h2 className="font-bold p-3 pt-0">Dev panel</h2>
      <ul className="p-0 whitespace-pre-wrap">
        {content.map(({ type, content, key }) => (
          <div
            key={key}
            className={"px-3 py-1 " +
              (type === "def"
                ? "bg-blue-100"
                : type === "client"
                ? "bg-green-100"
                : "bg-orange-200")}
          >
            {type === "def"
              ? <h3 className="font-bold text-blue-900">Definition</h3>
              : null}
            {type === "client"
              ? <h3 className="font-bold text-green-900">Client import</h3>
              : null}
            {type === "server"
              ? <h3 className="font-bold text-orange-900">Server stream</h3>
              : null}
            <li style={{ listStyle: "none" }}>{content}</li>
          </div>
        ))}
      </ul>
    </aside>
  )
}

type Direction = "vertical" | "horizontal"

const toLocalStorageKey = (direction: Direction) =>
  `simple-rfc-devtool-resize-${direction}`
const DEFAULT_HEIGHT = 260

function useWindowResize({ direction }: { direction: Direction }) {
  const [mouseMove, setMouseMove] = useState(getInitialSize(direction))
  const [isMouseDown, setIsMouseDown] = useState(false)
  const ref = useRef(null)

  const handleMouseDown = useCallback(() => {
    setIsMouseDown(true)
  }, [])

  const handleMouseUp = useCallback(() => {
    setIsMouseDown(false)
  }, [])

  const handleMouseMove = useCallback(
    (event: MouseEvent) => {
      if (isMouseDown) {
        setMouseMove(direction === "vertical" ? event.pageY : event.pageX)
      }
    },
    [isMouseDown],
  )

  const getResizeProps = () => {
    return {
      onMouseDown: handleMouseDown,
      ref,
    }
  }

  useEffect(() => {
    if (isMouseDown) {
      self.addEventListener("mousemove", handleMouseMove)
      self.addEventListener("mouseup", handleMouseUp)
    }

    const timeout = setTimeout(
      () =>
        localStorage.setItem(
          toLocalStorageKey(direction),
          String(mouseMove === null ? "" : mouseMove),
        ),
      200,
    )

    return () => {
      self.removeEventListener("mousemove", handleMouseMove)
      self.removeEventListener("mouseup", handleMouseUp)
      clearTimeout(timeout)
    }
  }, [isMouseDown])

  return {
    mouseMove,
    getResizeProps,
  }
}

function getDevtoolHeight(mouseMove: number) {
  return `${window.innerHeight - mouseMove}px`
}

function getInitialSize(direction: Direction) {
  const { localStorage } = window ?? {}
  return Number(
    localStorage?.getItem(toLocalStorageKey(direction)) ?? DEFAULT_HEIGHT,
  )
}
