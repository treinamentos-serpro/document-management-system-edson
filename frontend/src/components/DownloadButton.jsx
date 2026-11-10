import { getDocumentDownloadUrl } from '../services/api.js';

export default function DownloadButton({ document }) {
  return (
    <span className="download-control">
      <a
        className="download-button"
        href={getDocumentDownloadUrl(document.id)}
        download={document.originalName}
        aria-label={`Baixar ${document.originalName}`}
        title={`Baixar ${document.originalName}`}
      >
        Baixar <span aria-hidden="true">↓</span>
      </a>
    </span>
  );
}