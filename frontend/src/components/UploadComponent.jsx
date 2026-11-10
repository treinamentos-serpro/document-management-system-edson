import { useRef, useState } from 'react';

function formatFileSize(size) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export default function UploadComponent({ onUpload }) {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  function selectFile(selectedFile) {
    if (!selectedFile) return;
    setFile(selectedFile);
    setError('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!file || isUploading) return;

    setIsUploading(true);
    setError('');

    try {
      await onUpload(file);
      setFile(null);
      if (inputRef.current) inputRef.current.value = '';
    } catch (uploadError) {
      setError(uploadError.message);
    } finally {
      setIsUploading(false);
    }
  }

  function handleDrop(event) {
    event.preventDefault();
    setIsDragging(false);
    selectFile(event.dataTransfer.files[0]);
  }

  return (
    <form className="upload-form" onSubmit={handleSubmit}>
      <label
        className={`drop-zone${isDragging ? ' is-dragging' : ''}${file ? ' has-file' : ''}`}
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setIsDragging(false);
          }
        }}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          className="file-input"
          type="file"
          onChange={(event) => selectFile(event.target.files[0])}
          disabled={isUploading}
        />
        <span className="upload-glyph" aria-hidden="true">↑</span>
        <span className="drop-title">
          {file ? 'Arquivo selecionado' : 'Solte seu arquivo aqui'}
        </span>
        <span className="drop-subtitle">ou <span className="browse-link">escolha no dispositivo</span></span>
      </label>

      {file && (
        <div className="selected-file">
          <span className="file-type-mark" aria-hidden="true">FILE</span>
          <span className="selected-file-copy">
            <span className="selected-file-name" title={file.name}>{file.name}</span>
            <span className="selected-file-size">{formatFileSize(file.size)}</span>
          </span>
          <button
            className="remove-file-button"
            type="button"
            aria-label="Remover arquivo selecionado"
            onClick={() => {
              setFile(null);
              if (inputRef.current) inputRef.current.value = '';
            }}
            disabled={isUploading}
          >
            ×
          </button>
        </div>
      )}

      {error && <p className="inline-error" role="alert">{error}</p>}

      <button className="upload-button" type="submit" disabled={!file || isUploading}>
        {isUploading ? 'Enviando...' : 'Enviar documento'}
        {!isUploading && <span aria-hidden="true">↗</span>}
      </button>
    </form>
  );
}