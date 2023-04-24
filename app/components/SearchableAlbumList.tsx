import { Album } from "../db/get.ts"
import SearchBox from "./SearchBox.tsx"

export default function SearchableAlbumList(
  { albums, search }: { albums: Album[]; search: string },
) {
  const filteredAlbums = filterAlbums(albums, search ?? "")
  return (
    <>
      <SearchBox search={search} />
      <ul>
        {filteredAlbums.map((album) => (
          <div key={album.id}>
            <img className="w-20" src={album.cover} alt={album.title} />
            <li>{album.title}</li>
          </div>
        ))}
      </ul>
    </>
  )
}

function filterAlbums(albums: Album[], search: string) {
  const keywords = search
    .toLowerCase()
    .split(" ")
    .filter((s) => s !== "")
  if (keywords.length === 0) {
    return albums
  }
  return albums.filter((album) => {
    const words = (album.artist + " " + album.title).toLowerCase().split(" ")
    return keywords.every((kw) => words.some((w) => w.startsWith(kw)))
  })
}
