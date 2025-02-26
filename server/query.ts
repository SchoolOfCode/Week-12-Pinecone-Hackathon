/* eslint-disable import/no-extraneous-dependencies */
import { Pinecone } from '@pinecone-database/pinecone';
import { embedder } from './embeddings.ts';
import { getEnv } from './utils/util.ts';

export type Metadata = {
  imagePath: string;
};

const indexName = getEnv('PINECONE_INDEX');
const pinecone = new Pinecone();
const index = pinecone.index<Metadata>(indexName);

await embedder.init('Xenova/clip-vit-base-patch32');

const queryImages = async (imagePath: string) => {
  const queryEmbedding = await embedder.embed(imagePath);
  const queryResult = await index.namespace('default').query({
    vector: queryEmbedding.values,
    includeMetadata: true,
    includeValues: true,
    topK: 6,
  });
  console.log(
    'Search results: ',
    JSON.stringify(queryResult.matches, null, 2)
  );
  return (
    queryResult.matches?.map((match) => {
      const { metadata } = match;
      let imageSrc = '';

      if (metadata && metadata.imagePath) {
        // Get the original path
        let originalPath = metadata.imagePath;

        // Convert to proper URL format
        if (originalPath.includes('\\')) {
          // Handle Windows-style paths
          originalPath = originalPath.replace(/\\/g, '/');
        }
        // Ensure it's a proper URL path - extract just the filename if needed
        const parts = originalPath.split('/');
        const filename = parts[parts.length - 1];

        // Make it an absolute path starting with /data/
        imageSrc = `/data/${filename}`;
      }

      return {
        src: imageSrc,
        score: match.score || 0,
      };
    }) || []
  );
};

export { queryImages };
