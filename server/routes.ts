import express from 'express';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import { ServerlessSpecCloudEnum } from '@pinecone-database/pinecone';
import { queryImages } from './query.ts';
import { listFiles } from './utils/util.ts';
import { indexImages } from './indexImages.ts';
import { upsertImages } from './upsertImages.js';
import { deleteImage } from './deleteImage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface Route {
  route: string;
  method: 'get' | 'post' | 'put' | 'delete';
  handler: (req: express.Request, res: express.Response) => void;
}

function getImagesInRange(
  page: number,
  pageSize: number,
  imagePaths: string[]
): string[] {
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  return imagePaths.slice(start, end);
}

const routes: Route[] = [
  {
  route: '/indexImages',
  method: 'get',
    handler: async (req, res) => {
    console.log('Indexing request received');
    try {   
      // Return a response quickly
      res.status(202).json({ 
        message: 'Indexing started in background',
        status: 'processing'
      });
      
      // Run the indexing process in the background
      setTimeout(() => {
        indexImages()
          .then(() => console.log('Background indexing completed successfully'))
          .catch(error => console.error('Background indexing failed:', error));
      }, 100);
      
    } catch (error) {
      console.error('Indexing error:', error);
      res.status(500).json({
        error: 'Error indexing images',
        details: String(error),
      });
    }
  }
},
  {
    route: '/getImages',
    method: 'get',
    handler: async (req, res) => {
      try {
        const page = parseInt(req.query.page as string, 10) || 1;
        const pageSize =
          parseInt(req.query.pageSize as string, 10) || 10;

        console.log(`Getting images page ${page}, size ${pageSize}`);
        const imagePaths = await listFiles('./data');
        console.log(`Found ${imagePaths.length} total images`);

        const images = getImagesInRange(
          page,
          pageSize,
          imagePaths
        ).map((image) => ({
          src: image,
          alt: path.basename(image),
        }));
        console.log(`Returning ${images.length} images`);
        res.status(200).json(images);
      } catch (error) {
        console.error('Error fetching images:', error);
        res.status(500).json({
          error: 'Error fetching images',
          details: String(error),
        });
      }
    },
  },
  {
    route: '/search',
    method: 'get',
    handler: async (req, res) => {
      const imagePath = req.query.imagePath as string;
      console.log('Search request for:', imagePath);

      try {
        const matchingImages = await queryImages(imagePath);
        console.log(
          'Search results:',
          JSON.stringify(matchingImages, null, 2)
        );
        res.status(200).json(matchingImages);
      } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({
          error: 'Error fetching images',
          details: String(error),
        });
      }
    },
  },
  {
    route: '/uploadImages',
    method: 'post',
    handler: async (req, res) => {
      try {
        if (!req.files || Object.keys(req.files).length === 0) {
          return res.status(400).json({ error: 'No files uploaded' });
        }
        // Get uploaded files
        const uploadedFiles = req.files.images;
        const files = Array.isArray(uploadedFiles)
          ? uploadedFiles
          : [uploadedFiles];

        console.log(`Processing ${files.length} uploaded files`);

        // Save files to data directory
        const uploadedPaths = [];
        for (const file of files) {
          const savePath = path.join(__dirname, '../data', file.name);
          await file.mv(savePath);
          uploadedPaths.push(savePath);
          console.log(`Saved file: ${savePath}`);
        }

        // Upsert images to Pinecone
        try {
          await upsertImages(uploadedPaths);
          console.log(`Upserted ${uploadedPaths.length} images`);

          // Return the page number of the first image uploaded
          const imagePaths = await listFiles('../data');
          const pageSize =
            parseInt(req.query.pageSize as string, 10) || 10;
          const pageOfFirstImage =
            Math.floor(
              imagePaths.indexOf(uploadedPaths[0]) / pageSize
            ) + 1;

          return res.status(200).json({
            success: true,
            message: `${files.length} files uploaded successfully`,
            pageOfFirstImage,
          });
        } catch (upsertError) {
          console.error('Error upserting images:', upsertError);
          return res.status(500).json({
            error: 'Error upserting images',
            details: String(upsertError),
          });
        }
      } catch (error) {
        console.error('Error uploading files:', error);
        return res.status(500).json({
          error: 'Error uploading images',
          details: String(error),
        });
      }
    },
  },
  {
    route: '/deleteImage',
    method: 'delete',
    handler: async (req, res) => {
      const imagePath = req.query.imagePath as string;
      console.log('Delete request for:', imagePath);

      try {
        await deleteImage(imagePath);
        res.status(200).json({ message: 'Image deleted' });
      } catch (error) {
        console.error('Delete error:', error);
        res.status(500).json({
          error: 'Error deleting image',
          details: String(error),
        });
      }
    },
  },
];


// Add the debugIndex route
routes.push({
  route: '/debugIndex',
  method: 'get',
  handler: async (req, res) => {
    try {
      console.log('Debug index creation...');
      const { Pinecone } = await import(
        '@pinecone-database/pinecone'
      );
      const { getEnv } = await import('./utils/util.ts');

      const apiKey = getEnv('PINECONE_API_KEY');
      const indexName = getEnv('PINECONE_INDEX');
      const indexCloud = getEnv(
        'PINECONE_CLOUD'
      ) as ServerlessSpecCloudEnum;
      const indexRegion = getEnv('PINECONE_REGION');

      console.log('Using settings:');
      console.log(`- Index name: ${indexName}`);
      console.log(`- Region: ${indexRegion}`);
      console.log(`- Cloud: ${indexCloud}`);
      console.log(`- API key length: ${apiKey.length} chars`);

      const pinecone = new Pinecone({ apiKey });

      // List existing indexes
      console.log('Listing existing indexes...');
      try {
        const indexList = await pinecone.listIndexes();
        console.log(
          'Current indexes:',
          JSON.stringify(indexList, null, 2)
        );

        // Check if our index exists
        const indexExists = indexList.indexes?.some(
          (idx) => idx.name === indexName
        );

        if (!indexExists) {
          console.log(
            `Index ${indexName} does not exist, creating...`
          );

          try {
            // Create index
            const createResponse = await pinecone.createIndex({
              name: indexName,
              dimension: 512,
              metric: 'cosine',
              spec: {
                serverless: {
                  cloud: indexCloud,
                  region: indexRegion,
                },
              },
            });

            console.log('Create index response:', createResponse);

            res.status(200).json({
              message: 'Index creation started',
              details: 'Check server logs for progress',
            });
          } catch (createError) {
            console.error('Error creating index:', createError);
            res.status(500).json({
              error: 'Failed to create index',
              details: String(createError),
            });
          }
        } else {
          console.log(`Index ${indexName} already exists`);
          res.status(200).json({ message: 'Index already exists' });
        }
      } catch (listError) {
        console.error('Error listing indexes:', listError);
        res.status(500).json({
          error: 'Failed to list indexes',
          details: String(listError),
        });
      }
    } catch (error) {
      console.error('Debug index error:', error);
      res.status(500).json({
        error: 'Debug index error',
        details: String(error),
      });
    }
  },
});

export { routes as resolvers };
