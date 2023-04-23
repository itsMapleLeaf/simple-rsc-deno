import SearchBox from "./SearchBox.jsx"

/** @param {{ albums: import('./db/get.js').Album[], search: string }} props */
export default function SearchableAlbumList({ albums, search }) {
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

/**
 * @param {import('./db/get.js').Album[]} albums
 * @param {string} search
 */
function filterAlbums(albums, search) {
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
