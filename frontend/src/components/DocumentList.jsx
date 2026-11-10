import DownloadButton from './DownloadButton.jsx';

function formatFileSize(size) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export default function DocumentList({ documents, isLoading, error, onRetry }) {
  if (isLoading) {
    return <div className="list-message" role="status">Carregando documentos...</div>;
  }

  if (error) {
    return (
      <div className="list-message list-error" role="alert">
        <p>{error}</p>
        <button className="text-button" type="button" onClick={onRetry}>Tentar novamente</button>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="empty-state">
        <span className="empty-mark" aria-hidden="true">—</span>
        <p>Nenhum documento ainda.</p>
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table className="documents-table">
        <thead>
          <tr>
            <th scope="col">NOME</th>
            <th scope="col">TAMANHO</th>
            <th scope="col">ENVIADO EM</th>
            <th scope="col"><span className="visually-hidden">Ações</span></th>
          </tr>
        </thead>
        <tbody>
          {documents.map((document) => (
            <tr key={document.id}>
              <td>
                <div className="document-name-cell">
                  <span className="document-icon" aria-hidden="true">DOC</span>
                  <span className="document-name" title={document.originalName}>
                    {document.originalName}
                  </span>
                </div>
              </td>
              <td className="document-size">{formatFileSize(document.size)}</td>
              <td className="document-date">{formatDate(document.uploadedAt)}</td>
              <td className="document-action"><DownloadButton document={document} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}