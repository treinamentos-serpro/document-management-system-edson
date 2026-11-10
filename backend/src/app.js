const express = require('express');
const path = require('node:path');
const DocumentRepository = require('./repositories/documentRepository');
const DocumentService = require('./services/documentService');
const createDocumentRouter = require('./routes/documentRoutes');

const DEFAULT_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

function parseMaxFileSize(value) {
  if (value === undefined) {
    return DEFAULT_MAX_FILE_SIZE_BYTES;
  }

  const maxFileSizeBytes = Number(value);
  if (!Number.isSafeInteger(maxFileSizeBytes) || maxFileSizeBytes < 1) {
    throw new Error('MAX_FILE_SIZE_BYTES deve ser um inteiro positivo.');
  }

  return maxFileSizeBytes;
}

function createApp(options = {}) {
  const storageDirectory = path.resolve(
    options.storageDirectory || path.join(__dirname, '..', 'storage'),
  );
  const maxFileSizeBytes =
    options.maxFileSizeBytes ??
    parseMaxFileSize(process.env.MAX_FILE_SIZE_BYTES);
  const documentRepository = new DocumentRepository(storageDirectory);
  const documentService = new DocumentService(documentRepository);
  const app = express();

  app.use(express.json());

  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.use(
    createDocumentRouter({
      documentService,
      maxFileSizeBytes,
      storageDirectory,
    }),
  );

  app.use((error, req, res, next) => {
    if (res.headersSent) {
      return next(error);
    }

    let status = error.statusCode || error.status || 500;
    let code = error.code || 'INTERNAL_SERVER_ERROR';
    let message = status >= 500 ? 'Erro interno do servidor.' : error.message;

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

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`DMS backend ouvindo na porta ${PORT}`);
  });
}

module.exports = app;
module.exports.createApp = createApp;
