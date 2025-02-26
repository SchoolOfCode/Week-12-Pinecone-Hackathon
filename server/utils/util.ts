import fs from "fs/promises";
import path from "path";
import * as dotenv from "dotenv";

dotenv.config();

const sliceIntoChunks = <T>(arr: T[], chunkSize: number) =>
  Array.from({ length: Math.ceil(arr.length / chunkSize) }, (_, i) =>
    arr.slice(i * chunkSize, (i + 1) * chunkSize)
  );

async function listFiles(dir: string): Promise<string[]> {
  try {
    // Check if directory exists first
    try {
      await fs.access(dir);
    } catch (e) {
      console.log(`Directory ${dir} does not exist, creating it`);
      await fs.mkdir(dir, { recursive: true });
      return []; // Return empty array for new directory
    }
      
    const files = await fs.readdir(dir);
    const filePaths: string[] = [];
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stats = await fs.stat(filePath);
      if (
        stats.isFile() &&
        !filePath.includes('.DS_Store') &&
        !filePath.includes('_deleted') &&
        /\.(jpg|jpeg|png|gif|webp)$/i.test(filePath)
      ) {
        filePaths.push(filePath);
      }
    }
    return filePaths;
  } catch (err) {
    console.error(`Error listing files in ${dir}:`, err);
    return [];
  }
}

export const getEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`${key} environment variable not set`);
  }
  return value;
};

const validateEnvironmentVariables = () => {
  getEnv("PINECONE_API_KEY");
  getEnv("PINECONE_INDEX");
  getEnv("PINECONE_CLOUD");
  getEnv("PINECONE_REGION");
};

export { listFiles, sliceIntoChunks, validateEnvironmentVariables };
