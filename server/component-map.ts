export type ComponentMap = {
  [key: string]: {
    id: string
    name: string
    chunks: unknown[]
    async: boolean
  }
}
