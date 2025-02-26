/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable dot-notation */
import {
  Pinecone,
  type ServerlessSpecCloudEnum,
} from '@pinecone-database/pinecone';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { embedder } from './embeddings.ts';
import { getEnv, listFiles } from './utils/util.ts';
import { embedAndUpsert } from './utils/embedAndUpsert.js';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Index setup
const indexName = getEnv('PINECONE_INDEX');
const indexCloud = getEnv(
  'PINECONE_CLOUD'
) as ServerlessSpecCloudEnum;
const indexRegion = getEnv('PINECONE_REGION');
const pinecone = new Pinecone({
  // Explicitly provide API key
  apiKey: getEnv('PINECONE_API_KEY'),
});

const indexImages = async () => {
  try {
    console.log('Starting indexing process...');

    // Check data directory
    const dataDir = path.resolve(__dirname, '../data');
    console.log(`Data directory: ${dataDir}`);

    if (!fs.existsSync(dataDir)) {
      console.log("Data directory doesn't exist, creating it");
      fs.mkdirSync(dataDir, { recursive: true });
    }

    try {
      console.log('Checking Pinecone connection...');
      // Create the index if it doesn't already exist
      console.log('Listing existing indexes...');
      const indexList = await pinecone.listIndexes();
      console.log(
        `Found ${indexList.indexes?.length || 0} existing indexes`
      );

      const indexExists = indexList.indexes?.some(
        (index) => index.name === indexName
      );

      if (!indexExists) {
        console.log(`Creating new index: ${indexName}`);
        console.log(
          `Using cloud: ${indexCloud}, region: ${indexRegion}`
        );
        try {
          await pinecone.createIndex({
            name: indexName,
            dimension: 512,
            metric: 'cosine', // Add metric explicitly
            spec: {
              serverless: {
                cloud: indexCloud,
                region: indexRegion,
              },
            },
            waitUntilReady: true,
          });
          console.log(`Index ${indexName} created successfully!`);
        } catch (createError) {
          console.error('Error creating index:', createError);
          throw createError;
        }
      } else {
        console.log(
          `Index ${indexName} already exists, skipping creation`
        );
      }

      // Get the index
      console.log('Retrieving index object...');
      const index = pinecone.index(indexName);

      // Initialize CLIP model
      console.log('Initializing CLIP embedder...');
      await embedder.init('Xenova/clip-vit-base-patch32');

      // Get image paths
      console.log('Listing image files...');
      const allImagePaths = await listFiles(dataDir);
      console.log(`Found ${allImagePaths.length} total images`);

      const BATCH_SIZE = 50; // Process 50 images at a time
      const totalBatches = Math.ceil(
        allImagePaths.length / BATCH_SIZE
      );

      console.log(
        `Will process ${totalBatches} batches of ${BATCH_SIZE} images each`
      );

      for (let i = 0; i < allImagePaths.length; i += BATCH_SIZE) {
        const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
        const batchImages = allImagePaths.slice(i, i + BATCH_SIZE);

        console.log(
          `Processing batch ${batchNumber}/${totalBatches} (${batchImages.length} images)`
        );

        // Process this batch
        try {
          await embedAndUpsert({
            imagePaths: batchImages,
            chunkSize: 10, // Further chunk each batch for embedAndUpsert
            index,
          });
          console.log(
            `✓ Completed batch ${batchNumber}/${totalBatches}`
          );
        } catch (batchError) {
          console.error(
            `Error processing batch ${batchNumber}:`,
            batchError
          );
          // Continue with next batch despite errors
        }
      }

      console.log('Indexing completed successfully!');
      return;
    } catch (pineconeError) {
      console.error('Pinecone operation error:', pineconeError);
      throw pineconeError;
    }
  } catch (error) {
    console.error('Indexing failed:', error);
    throw error;
  }
};

export { indexImages };
