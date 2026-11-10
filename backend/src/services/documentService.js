const { randomUUID } = require('node:crypto');
const fs = require('node:fs/promises');
const AppError = require('./AppError');

class DocumentService {
  constructor(documentRepository) {
    this.documentRepository = documentRepository;
  }

  async createDocument(file) {
    if (file.size === 0) {
      await this.documentRepository.removeFile(file.filename);
      throw new AppError(400, 'EMPTY_FILE', 'O arquivo não pode estar vazio.');
    }

    const document = {
      id: file.filename || randomUUID(),
      originalName: file.originalname,
      size: file.size,
      uploadedAt: new Date().toISOString(),
      owner: 'local',
    };

    try {
      this.documentRepository.add(document);
    } catch (error) {
      await this.documentRepository.removeFile(document.id);
      throw error;
    }

    return document;
  }

  listDocuments() {
    return this.documentRepository.findAll();
  }

  async getDocumentForDownload(id) {
    const document = this.documentRepository.findById(id);
    const filePath = this.documentRepository.getFilePath(id);

    if (!document || !filePath) {
      throw new AppError(
        404,
        'DOCUMENT_NOT_FOUND',
        'Documento não encontrado.',
      );
    }

    try {
      await fs.access(filePath);
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new AppError(
          404,
          'DOCUMENT_NOT_FOUND',
          'Documento não encontrado.',
        );
      }
      throw error;
    }

    return { document, filePath };
  }
}

module.exports = DocumentService;