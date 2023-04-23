import { Suspense } from "react"
import SearchableAlbumList from "./SearchableAlbumList.tsx"
import { getAll } from "./db/get.ts"

export default function ServerRoot({ search }: { search: string }) {
  return (
    <>
      <h1>AbraMix</h1>
      <Suspense fallback={<h2>Loading...</h2>}>
        {/* @ts-expect-error */}
        <Albums search={search} />
      </Suspense>
    </>
  )
}

async function Albums({ search }: { search: string }) {
  const albums = await getAll()
  return <SearchableAlbumList search={search} albums={albums} />
}
