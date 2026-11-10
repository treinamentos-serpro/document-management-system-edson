const express = require('express');
const path = require('node:path');
const DocumentRepository = require('./repositories/documentRepository');
const DocumentService = require('./services/documentService');
const createDocumentRouter = require('./routes/documentRoutes');

const DEFAULT_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const DEFAULT_MAX_STORAGE_BYTES = 1024 * 1024 * 1024;
const DEFAULT_MAX_DOCUMENTS = 1000;
const DEFAULT_MAX_CONCURRENT_UPLOADS = 4;

function parsePositiveInteger(value, name, defaultValue) {
  if (value === undefined) {
    return defaultValue;
  }

  const parsedValue = Number(value);
  if (!Number.isSafeInteger(parsedValue) || parsedValue < 1) {
    throw new Error(`${name} deve ser um inteiro positivo.`);
  }

  return parsedValue;
}

function createApp(options = {}) {
  const storageDirectory = path.resolve(
    options.storageDirectory || path.join(__dirname, '..', 'storage'),
  );
  const maxFileSizeBytes = parsePositiveInteger(
    options.maxFileSizeBytes ?? process.env.MAX_FILE_SIZE_BYTES,
    'MAX_FILE_SIZE_BYTES',
    DEFAULT_MAX_FILE_SIZE_BYTES,
  );
  const maxStorageBytes = parsePositiveInteger(
    options.maxStorageBytes ?? process.env.MAX_STORAGE_BYTES,
    'MAX_STORAGE_BYTES',
    DEFAULT_MAX_STORAGE_BYTES,
  );
  const maxDocuments = parsePositiveInteger(
    options.maxDocuments ?? process.env.MAX_DOCUMENTS,
    'MAX_DOCUMENTS',
    DEFAULT_MAX_DOCUMENTS,
  );
  const maxConcurrentUploads = parsePositiveInteger(
    options.maxConcurrentUploads ?? process.env.MAX_CONCURRENT_UPLOADS,
    'MAX_CONCURRENT_UPLOADS',
    DEFAULT_MAX_CONCURRENT_UPLOADS,
  );
  const documentRepository = new DocumentRepository(storageDirectory);
  const documentService = new DocumentService(documentRepository, {
    maxStorageBytes,
    maxDocuments,
  });
  const app = express();

  app.use(express.json());

  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.use(
    createDocumentRouter({
      documentService,
      maxFileSizeBytes,
      maxConcurrentUploads,
      storageDirectory,
    }),
  );

  app.use((error, req, res, next) => {
    if (res.headersSent) {
      return next(error);
    }

    let status = error.statusCode || error.status || 500;
    let code = error.code || 'INTERNAL_SERVER_ERROR';
    let message =
      status >= 500 && error.name !== 'AppError'
        ? 'Erro interno do servidor.'
        : error.message;

    if (error.code === 'LIMIT_FILE_SIZE') {
      status = 413;
      code = 'FILE_TOO_LARGE';
      message = 'O arquivo excede o limite permitido.';
    } else if (
      error.name === 'MulterError' ||
      error.message?.startsWith('Multipart:') ||
      error.message === 'Unexpected end of form' ||
      error.message === 'Malformed part header'
    ) {
      status = 400;
      code = 'INVALID_MULTIPART';
      message = 'A requisição de upload é inválida.';
    } else if (error.type === 'entity.parse.failed') {
      status = 400;
      code = 'INVALID_JSON';
      message = 'O corpo JSON é inválido.';
    }

    res.status(status).json({ error: { code, message } });
  });

  return app;
}

const app = createApp();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '127.0.0.1';

if (require.main === module) {
  app.listen(PORT, HOST, () => {
    console.log(`DMS backend ouvindo em ${HOST}:${PORT}`);
  });
}

module.exports = app;
module.exports.createApp = createApp;
