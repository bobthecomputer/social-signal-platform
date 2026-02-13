import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export class FileStore {
  constructor(baseDir) {
    this.baseDir = baseDir;
  }

  async init() {
    await mkdir(this.baseDir, { recursive: true });
  }

  file(name) {
    return path.join(this.baseDir, name);
  }

  async readJson(name, fallback = null) {
    try {
      const data = await readFile(this.file(name), "utf8");
      return JSON.parse(data);
    } catch {
      return fallback;
    }
  }

  async writeJson(name, value) {
    await writeFile(this.file(name), JSON.stringify(value, null, 2), "utf8");
  }

  async appendJsonArray(name, item, max = 5000) {
    const arr = (await this.readJson(name, [])) || [];
    arr.push(item);
    if (arr.length > max) {
      arr.splice(0, arr.length - max);
    }
    await this.writeJson(name, arr);
  }
}
