import { Suspense } from "react"
import SearchableAlbumList from "./SearchableAlbumList.jsx"
import { getAll } from "./db/get.js"

/** @param {{ search: string }} props */
export default async function ServerRoot({ search }) {
  return (
    <>
      <h1>AbraMix</h1>
      <Suspense fallback={<h2>Loading...</h2>}>
        <Albums search={search} />
      </Suspense>
    </>
  )
}

/** @param {{ search: string }} props */
async function Albums({ search }) {
  const albums = await getAll()
  return <SearchableAlbumList search={search} albums={albums} />
}
