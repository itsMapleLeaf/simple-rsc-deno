import bjorkPost from "./data/bjork-post.json" assert { type: "json" }
import glassAnimalsHowToBeAMHumanBeing from "./data/glass-animals-how-to-be.json" assert {
  type: "json",
}
import ladyGagaTheFame from "./data/lady-gaga-the-fame.json" assert {
  type: "json",
}

const albums = [bjorkPost, ladyGagaTheFame, glassAnimalsHowToBeAMHumanBeing]
export type Album = typeof albums[number]

const artificialWait = (ms = 200) =>
  new Promise((resolve) => setTimeout(resolve, ms))

export async function getAll() {
  await artificialWait()
  return albums
}

export async function getById(id: string) {
  await artificialWait()
  return albums.find((album) => album.id === id)
}
