const fs = require('node:fs/promises');
const { randomUUID } = require('node:crypto');
const express = require('express');
const multer = require('multer');
const createDocumentController = require('../controllers/documentController');

function createDocumentRouter({
  documentService,
  maxFileSizeBytes,
  storageDirectory,
}) {
  const router = express.Router();
  const storage = multer.diskStorage({
    destination(req, file, callback) {
      fs.mkdir(storageDirectory, { recursive: true })
        .then(() => callback(null, storageDirectory))
        .catch(callback);
    },
    filename(req, file, callback) {
      callback(null, randomUUID());
    },
  });
  const upload = multer({
    storage,
    limits: { fileSize: maxFileSizeBytes, files: 1 },
  });
  const controller = createDocumentController(documentService);

  router.post('/upload', upload.single('file'), controller.upload);
  router.get('/documents', controller.list);
  router.get('/documents/:id/download', controller.download);

  return router;
}

module.exports = createDocumentRouter;