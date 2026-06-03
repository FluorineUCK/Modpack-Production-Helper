const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const LOCAL_FILE_SIGNATURE = 0x04034b50;

function findEndOfCentralDirectory(buffer) {
  const maxCommentLength = 0xffff;
  const start = Math.max(0, buffer.length - maxCommentLength - 22);
  for (let offset = buffer.length - 22; offset >= start; offset -= 1) {
    if (buffer.readUInt32LE(offset) === EOCD_SIGNATURE) {
      return offset;
    }
  }
  throw new Error("ZIP end of central directory not found");
}

function readEntries(zipPath) {
  const buffer = fs.readFileSync(zipPath);
  const eocdOffset = findEndOfCentralDirectory(buffer);
  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  let offset = buffer.readUInt32LE(eocdOffset + 16);
  const entries = [];

  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(offset) !== CENTRAL_DIRECTORY_SIGNATURE) {
      throw new Error(`Invalid central directory record at offset ${offset}`);
    }

    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString("utf8", offset + 46, offset + 46 + fileNameLength);

    entries.push({
      name,
      compressionMethod,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
    });

    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  return { buffer, entries };
}

function readEntryContent(buffer, entry) {
  const offset = entry.localHeaderOffset;
  if (buffer.readUInt32LE(offset) !== LOCAL_FILE_SIGNATURE) {
    throw new Error(`Invalid local file record for ${entry.name}`);
  }

  const fileNameLength = buffer.readUInt16LE(offset + 26);
  const extraLength = buffer.readUInt16LE(offset + 28);
  const dataStart = offset + 30 + fileNameLength + extraLength;
  const compressed = buffer.subarray(dataStart, dataStart + entry.compressedSize);

  if (entry.compressionMethod === 0) {
    return compressed;
  }
  if (entry.compressionMethod === 8) {
    const inflated = zlib.inflateRawSync(compressed);
    if (entry.uncompressedSize && inflated.length !== entry.uncompressedSize) {
      throw new Error(`Unexpected inflated size for ${entry.name}`);
    }
    return inflated;
  }

  throw new Error(`Unsupported ZIP compression method ${entry.compressionMethod} for ${entry.name}`);
}

function isRecipeEntry(name) {
  return /^data\/[^/]+\/recipes?\/.+\.json$/i.test(name);
}

function isTagEntry(name) {
  return /^data\/[^/]+\/tags\/(item|items|fluid|fluids)\/.+\.json$/i.test(name);
}

function tagInfoFromEntry(name) {
  const match = String(name).match(/^data\/([^/]+)\/tags\/(item|items|fluid|fluids)\/(.+)\.json$/i);
  if (!match) {
    return null;
  }
  const registry = match[2].startsWith("fluid") ? "fluid" : "item";
  return {
    id: `#${match[1]}:${match[3]}`,
    namespace: match[1],
    registry,
    path: match[3],
  };
}

function stripBom(text) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function readRecipeJsonFromArchive(zipPath) {
  const { buffer, entries } = readEntries(zipPath);
  return entries
    .filter((entry) => isRecipeEntry(entry.name))
    .map((entry) => {
      const content = stripBom(readEntryContent(buffer, entry).toString("utf8"));
      const parsed = JSON.parse(content);
      const recipes = Array.isArray(parsed) ? parsed : [parsed];
      return recipes.map((recipe) => {
        if (recipe && typeof recipe === "object") {
          Object.defineProperty(recipe, "__sourcePath", {
            value: entry.name,
            enumerable: false,
          });
          Object.defineProperty(recipe, "__sourceArchive", {
            value: path.basename(zipPath),
            enumerable: false,
          });
        }
        return recipe;
      });
    })
    .flat();
}

function readTagJsonFromArchive(zipPath) {
  const { buffer, entries } = readEntries(zipPath);
  return entries
    .filter((entry) => isTagEntry(entry.name))
    .flatMap((entry) => {
      try {
        const info = tagInfoFromEntry(entry.name);
        const content = stripBom(readEntryContent(buffer, entry).toString("utf8"));
        const parsed = JSON.parse(content);
        return [{
          ...info,
          raw: parsed,
          sourcePath: entry.name,
          sourceArchive: path.basename(zipPath),
        }];
      } catch {
        return [];
      }
    });
}

module.exports = {
  isRecipeEntry,
  isTagEntry,
  readEntries,
  readEntryContent,
  readRecipeJsonFromArchive,
  readTagJsonFromArchive,
  stripBom,
  tagInfoFromEntry,
};
