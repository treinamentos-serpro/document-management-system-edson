const fs = require('node:fs/promises');
const { createReadStream } = require('node:fs');
const path = require('node:path');

class DocumentRepository {
  constructor(storageDirectory) {
    this.storageDirectory = storageDirectory;
    this.documents = new Map();
  }

  add(document) {
    this.documents.set(document.id, { ...document });
  }

  findAll() {
    return Array.from(this.documents.values(), (document) => ({ ...document }))
      .sort((left, right) => right.uploadedAt.localeCompare(left.uploadedAt));
  }

  findById(id) {
    const document = this.documents.get(id);
    return document ? { ...document } : null;
  }

  async getStorageStats() {
    await fs.mkdir(this.storageDirectory, { recursive: true });
    const entries = await fs.readdir(this.storageDirectory, {
      withFileTypes: true,
    });
    const files = entries.filter(
      (entry) => entry.isFile() && entry.name !== '.gitkeep',
    );
    const sizes = await Promise.all(
      files.map((entry) => fs.stat(path.join(this.storageDirectory, entry.name))),
    );

    return {
      documentCount: files.length,
      storageBytes: sizes.reduce((total, file) => total + file.size, 0),
    };
  }

  async openFile(id) {
    if (!this.documents.has(id)) {
      return null;
    }

    const filePath = this.resolveStoragePath(id);
    if (!filePath) {
      return null;
    }

    try {
      const file = await fs.stat(filePath);
      return file.isFile() ? createReadStream(filePath) : null;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  async removeFile(id) {
    const filePath = this.resolveStoragePath(id);
    if (!filePath) {
      return;
    }

    try {
      await fs.unlink(filePath);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  resolveStoragePath(id) {
    if (
      typeof id !== 'string' ||
      !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(id)
    ) {
      return null;
    }

    const filePath = path.resolve(this.storageDirectory, id);
    const relativePath = path.relative(this.storageDirectory, filePath);
    if (
      relativePath.startsWith('..') ||
      path.isAbsolute(relativePath)
    ) {
      return null;
    }

    return filePath;
  }
}

module.exports = DocumentRepository;