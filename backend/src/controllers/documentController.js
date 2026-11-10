const AppError = require('../services/AppError');

function createDocumentController(documentService) {
  return {
    async upload(req, res, next) {
      try {
        if (!req.file) {
          throw new AppError(
            400,
            'FILE_REQUIRED',
            'Envie um arquivo no campo "file".',
          );
        }

        const document = await documentService.createDocument(req.file);
        res.status(201).json(document);
      } catch (error) {
        next(error);
      }
    },

    list(req, res, next) {
      try {
        res.status(200).json(documentService.listDocuments());
      } catch (error) {
        next(error);
      }
    },

    async download(req, res, next) {
      try {
        const { document, filePath } =
          await documentService.getDocumentForDownload(req.params.id);

        res.download(
          filePath,
          document.originalName,
          { headers: { 'Content-Type': 'application/octet-stream' } },
          (error) => {
            if (error && !res.headersSent) {
              next(error);
            }
          },
        );
      } catch (error) {
        next(error);
      }
    },
  };
}

module.exports = createDocumentController;