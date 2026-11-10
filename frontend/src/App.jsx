import { useEffect, useState } from 'react';
import DocumentList from './components/DocumentList.jsx';
import UploadComponent from './components/UploadComponent.jsx';
import { listDocuments, uploadDocument } from './services/api.js';
import './styles.css';

export default function App() {
  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState('');

  async function refreshDocuments() {
    setIsLoading(true);
    setLoadError('');

    try {
      setDocuments(await listDocuments());
    } catch (error) {
      setLoadError(error.message);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    refreshDocuments();
  }, []);

  async function handleUpload(file) {
    await uploadDocument(file);
    setNotice(`${file.name} enviado com sucesso.`);
    await refreshDocuments();
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#inicio" aria-label="DMS, início">
          <span className="brand-mark" aria-hidden="true">D</span>
          <span className="brand-copy">
            <span className="brand-name">Arquivo</span>
            <span className="brand-caption">DOCUMENTOS LOCAIS</span>
          </span>
        </a>
        <span className="workspace-status"><span /> ESPAÇO LOCAL</span>
      </header>

      <main className="workspace" id="inicio">
        <div className="page-heading">
          <div>
            <p className="eyebrow">GESTÃO DE DOCUMENTOS <span>/</span> 01</p>
            <h1>Documentos</h1>
            <p className="page-description">Sua biblioteca de arquivos, em um só lugar.</p>
          </div>
          <button
            className="refresh-button"
            type="button"
            onClick={() => {
              setNotice('');
              refreshDocuments();
            }}
            disabled={isLoading}
          >
            <span aria-hidden="true">↻</span> Atualizar
          </button>
        </div>

        <div className="workspace-grid">
          <section className="upload-section" aria-labelledby="upload-title">
            <div className="section-heading">
              <div>
                <p className="eyebrow">ADICIONAR</p>
                <h2 id="upload-title">Novo documento</h2>
              </div>
              <span className="section-index">01</span>
            </div>
            <UploadComponent onUpload={handleUpload} />
            {notice && <p className="notice" role="status">{notice}</p>}
          </section>

          <section className="documents-section" aria-labelledby="documents-title">
            <div className="section-heading documents-heading">
              <div>
                <p className="eyebrow">BIBLIOTECA</p>
                <h2 id="documents-title">Todos os documentos</h2>
              </div>
              <span className="document-count" aria-label={`${documents.length} documentos`}>
                {String(documents.length).padStart(2, '0')}
              </span>
            </div>
            <DocumentList
              documents={documents}
              isLoading={isLoading}
              error={loadError}
              onRetry={refreshDocuments}
            />
          </section>
        </div>
        <footer className="page-footer">
          <span>DMS <span className="footer-separator">/</span> GESTÃO LOCAL</span>
          <span>ARQUIVOS PRIVADOS DESTA INSTÂNCIA</span>
        </footer>
      </main>
    </div>
  );
}
