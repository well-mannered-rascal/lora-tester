/**
 * 99% of this was from chatGPT :P
 */

import { extname } from "@std/path";
import { existsSync } from "@std/fs";
import { PNG } from "npm:pngjs";

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    const stat = await Deno.stat(filePath);
    return stat.isFile; // Checks if it's a file (not a directory)
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return false;
    } else {
      throw error; // Rethrow if it's a different error
    }
  }
}

export async function loadJsonFile(filePath: string) {
  try {
    // Read file as text
    const data = await Deno.readTextFile(filePath);
    // Parse JSON
    const jsonData = JSON.parse(data);
    return jsonData;
  } catch (error) {
    console.error("Error reading or parsing the JSON file:", error);
  }
}

export async function getFilesWithExtension(
  directory: string,
  extension: string,
): Promise<string[]> {
  const files: string[] = [];

  for await (const entry of Deno.readDir(directory)) {
    if (entry.isFile && extname(entry.name) === extension) {
      files.push(entry.name);
    }
  }

  return files;
}

export async function saveReadableStreamToFile(
  stream: ReadableStream<Uint8Array>,
  outputPath: string,
): Promise<void> {
  const reader = stream.getReader();
  let chunks: Uint8Array[] = [];
  let totalLength = 0;

  // Read all chunks from the stream
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      totalLength += value.length;
    }
  }

  reader.cancel();

  // Concatenate all chunks into a single Uint8Array
  const imageData = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    imageData.set(chunk, offset);
    offset += chunk.length;
  }

  console.log(imageData.toString());

  // Save the image data as a PNG file
  await Deno.writeFile(outputPath, imageData);
  console.log(`File saved successfully to ${outputPath}`);
}

/**
 * Returns
 * @param basePath
 * @returns
 */
export function getUniqueFilePath(basePath: string): string {
  let counter = 0;
  let uniquePath = basePath;

  // Increment the counter and modify the file path if it already exists
  while (existsSync(uniquePath)) {
    counter++;
    const extensionIndex = basePath.lastIndexOf(".");

    // If the basePath has an extension, insert the counter before it
    if (extensionIndex !== -1) {
      uniquePath = `${basePath.slice(0, extensionIndex)}_${counter}${
        basePath.slice(extensionIndex)
      }`;
    } else {
      // If there's no extension, just append the counter
      uniquePath = `${basePath}_${counter}`;
    }
  }

  return uniquePath;
}

/**
 * Always creates a unique directory with a simple int counter
 * @param baseDirPath
 * @returns The path that was created
 */
export async function createUniqueDirectory(
  baseDirPath: string,
): Promise<string> {
  let counter = 0;
  let uniqueDirPath = baseDirPath;

  // Increment the counter and modify the directory name if it already exists
  while (existsSync(uniqueDirPath)) {
    counter++;
    uniqueDirPath = `${baseDirPath}_${counter}`;
  }

  // Create the new unique directory
  await Deno.mkdir(uniqueDirPath);

  console.log(`Directory created: ${uniqueDirPath}`);
  return uniqueDirPath;
}

// /**
//  * Returns true if directory was created, false otherwise
//  * @param dirPath
//  * @returns
//  */
// export async function ensureDirectoryExists(dirPath: string): Promise<boolean> {
//   try {
//     const stat = await Deno.stat(dirPath);
//     if (!stat.isDirectory) {
//       throw new Error(`${dirPath} exists but is not a directory.`);
//     }
//     console.log(`Directory already exists: ${dirPath}`);
//     return false;
//   } catch (err) {
//     if (err instanceof Deno.errors.NotFound) {
//       // Directory does not exist, create it
//       await Deno.mkdir(dirPath, { recursive: true });
//       return true;
//     } else {
//       throw err;
//     }

//   }
// }
