const fs = require('node:fs/promises');
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

  getFilePath(id) {
    return this.documents.has(id)
      ? path.join(this.storageDirectory, id)
      : null;
  }

  async removeFile(id) {
    try {
      await fs.unlink(path.join(this.storageDirectory, id));
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }
}

module.exports = DocumentRepository;