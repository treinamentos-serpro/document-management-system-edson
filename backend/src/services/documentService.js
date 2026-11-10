const AppError = require('./AppError');

class DocumentService {
  constructor(documentRepository, { maxStorageBytes, maxDocuments }) {
    this.documentRepository = documentRepository;
    this.maxStorageBytes = maxStorageBytes;
    this.maxDocuments = maxDocuments;
  }

  async createDocument(file) {
    if (file.size === 0) {
      await this.documentRepository.removeFile(file.filename);
      throw new AppError(400, 'EMPTY_FILE', 'O arquivo não pode estar vazio.');
    }

    try {
      const storageStats = await this.documentRepository.getStorageStats();
      if (
        storageStats.storageBytes > this.maxStorageBytes ||
        storageStats.documentCount > this.maxDocuments
      ) {
        throw new AppError(
          507,
          'STORAGE_LIMIT_REACHED',
          'O limite de armazenamento da aplicação foi atingido.',
        );
      }

      const document = {
        id: file.filename,
        originalName: file.originalname,
        size: file.size,
        uploadedAt: new Date().toISOString(),
        owner: 'local',
      };

      this.documentRepository.add(document);
      return document;
    } catch (error) {
      await this.documentRepository.removeFile(file.filename);
      throw error;
    }
  }

  listDocuments() {
    return this.documentRepository.findAll();
  }

  async getDocumentForDownload(id) {
    const document = this.documentRepository.findById(id);
    const fileStream = await this.documentRepository.openFile(id);

    if (!document || !fileStream) {
      throw new AppError(
        404,
        'DOCUMENT_NOT_FOUND',
        'Documento não encontrado.',
      );
    }

    return { document, fileStream };
  }
}

module.exports = DocumentService;