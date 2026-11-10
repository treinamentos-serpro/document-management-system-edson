const API_PREFIX = '/api';

async function request(path, options = {}) {
  let response;

  try {
    response = await fetch(`${API_PREFIX}${path}`, options);
  } catch {
    throw new Error('Não foi possível conectar ao servidor.');
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error?.message || 'Não foi possível concluir a solicitação.');
  }

  return response;
}

export async function listDocuments() {
  const response = await request('/documents');
  const documents = await response.json();

  if (!Array.isArray(documents)) {
    throw new Error('A resposta do servidor não contém uma lista de documentos.');
  }

  return documents;
}

export async function uploadDocument(file) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await request('/upload', {
    method: 'POST',
    body: formData,
  });

  return response.json();
}

export function getDocumentDownloadUrl(id) {
  return `${API_PREFIX}/documents/${encodeURIComponent(id)}/download`;
}