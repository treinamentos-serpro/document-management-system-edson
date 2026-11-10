import { useState } from 'react';
import { downloadDocument } from '../services/api.js';

export default function DownloadButton({ document }) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState('');

  async function handleDownload() {
    setIsDownloading(true);
    setError('');

    try {
      const blob = await downloadDocument(document.id);
      const objectUrl = URL.createObjectURL(blob);
      const link = window.document.createElement('a');
      link.href = objectUrl;
      link.download = document.originalName;
      window.document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (downloadError) {
      setError(downloadError.message);
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <span className="download-control">
      <button
        className="download-button"
        type="button"
        onClick={handleDownload}
        disabled={isDownloading}
        aria-label={`Baixar ${document.originalName}`}
        title={error || `Baixar ${document.originalName}`}
      >
        {isDownloading ? 'Baixando...' : 'Baixar'}
        {!isDownloading && <span aria-hidden="true">↓</span>}
      </button>
      {error && <span className="download-error" role="alert">{error}</span>}
    </span>
  );
}