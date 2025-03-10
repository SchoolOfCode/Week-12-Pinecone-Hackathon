import type {Index, PineconeRecord} from "@pinecone-database/pinecone"
import {embedder} from "../embeddings.js"

import {chunkedUpsert} from "./chunkedUpsert.js"

function* chunkArray<T>(array: T[], chunkSize: number): Generator<T[]> {
  for (let i = 0; i < array.length; i += chunkSize) {
    yield array.slice(i, i + chunkSize)
  }
}

async function embedAndUpsert({
  imagePaths,
  chunkSize,
  index,
}: {
  imagePaths: string[]
  chunkSize: number
  index: Index
}) {
  // Chunk the image paths into batches of size chunkSize
  const chunkGenerator = chunkArray(imagePaths, chunkSize)

  // Embed each batch and upsert the embeddings into the index
  for await (const imagePaths of chunkGenerator) {
    embedder.embedBatch(imagePaths, chunkSize, (embeddings: PineconeRecord[]) =>
      chunkedUpsert(index, embeddings, "default")
    )
  }
}

export {embedAndUpsert}
