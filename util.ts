import { extname } from "@std/path";

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
