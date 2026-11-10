const fs = require('node:fs/promises');
const { randomUUID } = require('node:crypto');
const express = require('express');
const multer = require('multer');
const createDocumentController = require('../controllers/documentController');
const AppError = require('../services/AppError');

function createDocumentRouter({
  documentService,
  maxFileSizeBytes,
  maxConcurrentUploads,
  storageDirectory,
}) {
  const router = express.Router();
  let activeUploads = 0;
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
    limits: {
      fileSize: maxFileSizeBytes,
      files: 1,
      fields: 0,
      parts: 2,
    },
  });
  const controller = createDocumentController(documentService);
  const limitConcurrentUploads = (req, res, next) => {
    if (activeUploads >= maxConcurrentUploads) {
      return next(
        new AppError(
          503,
          'UPLOAD_CAPACITY_REACHED',
          'A capacidade de upload está temporariamente ocupada.',
        ),
      );
    }

    activeUploads += 1;
    let released = false;
    const releaseUploadSlot = () => {
      if (released) return;
      released = true;
      activeUploads -= 1;
    };

    res.once('finish', releaseUploadSlot);
    res.once('close', releaseUploadSlot);
    next();
  };

  router.post(
    '/upload',
    limitConcurrentUploads,
    upload.single('file'),
    controller.upload,
  );
  router.get('/documents', controller.list);
  router.get('/documents/:id/download', controller.download);

  return router;
}

module.exports = createDocumentRouter;