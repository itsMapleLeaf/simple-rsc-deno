// TODO: generate this
const importMap = {
  "imports": {
    "react": "https://esm.sh/react@18.3.0-next-3706edb81-20230308&dev",
    "react/": "https://esm.sh/react@18.3.0-next-3706edb81-20230308&dev/",
    "react-dom": "https://esm.sh/react-dom@18.3.0-next-3706edb81-20230308&dev",
    "react-dom/":
      "https://esm.sh/react-dom@18.3.0-next-3706edb81-20230308&dev/",
    "react-server-dom-webpack":
      "https://esm.sh/react-server-dom-webpack@0.0.0-experimental-41b4714f1-20230328&dev",
    "react-server-dom-webpack/":
      "https://esm.sh/react-server-dom-webpack@0.0.0-experimental-41b4714f1-20230328&dev/",
    "npm:nanoid": "https://esm.sh/nanoid",
  },
}

export function Document({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0"
        />
        <title>Document</title>
        <script
          type="importmap"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(importMap) }}
        />
        <script src="https://cdn.tailwindcss.com"></script>
        <script type="module" src="/app/_router.tsx"></script>
      </head>
      <body>
        {children}
      </body>
    </html>
  )
}
