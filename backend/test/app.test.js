const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const appModule = require('../src/app');

async function withServer(options, run) {
  const storageDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'dms-test-'));
  const app = appModule.createApp({ ...options, storageDirectory });
  const server = app.listen(0);

  await new Promise((resolve) => server.once('listening', resolve));

  try {
    const address = server.address();
    await run(`http://127.0.0.1:${address.port}`, storageDirectory);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    await fs.rm(storageDirectory, { recursive: true, force: true });
  }
}

function makeUpload(name, content) {
  const form = new FormData();
  form.append('file', new Blob([content]), name);
  return form;
}

test('o app backend é exportado', () => {
  assert.equal(typeof appModule, 'function');
});

test('faz upload, lista e baixa um documento', async () => {
  await withServer({}, async (baseUrl, storageDirectory) => {
    const uploadResponse = await fetch(`${baseUrl}/upload`, {
      method: 'POST',
      body: makeUpload('relatorio.txt', 'conteudo do documento'),
    });

    assert.equal(uploadResponse.status, 201);
    const document = await uploadResponse.json();
    assert.equal(document.originalName, 'relatorio.txt');
    assert.equal(document.size, Buffer.byteLength('conteudo do documento'));
    assert.equal(document.owner, 'local');
    assert.match(document.id, /^[\w-]+$/);
    assert.doesNotThrow(() => new Date(document.uploadedAt).toISOString());
    assert.equal(
      await fs.readFile(path.join(storageDirectory, document.id), 'utf8'),
      'conteudo do documento',
    );

    const listResponse = await fetch(`${baseUrl}/documents`);
    assert.equal(listResponse.status, 200);
    assert.deepEqual(await listResponse.json(), [document]);

    const downloadResponse = await fetch(
      `${baseUrl}/documents/${document.id}/download`,
    );
    assert.equal(downloadResponse.status, 200);
    assert.equal(
      downloadResponse.headers.get('content-type'),
      'application/octet-stream',
    );
    assert.match(
      downloadResponse.headers.get('content-disposition'),
      /attachment/,
    );
    assert.equal(await downloadResponse.text(), 'conteudo do documento');
  });
});

test('rejeita arquivo ausente, vazio e maior que o limite', async () => {
  await withServer({ maxFileSizeBytes: 8 }, async (baseUrl) => {
    const missingFileResponse = await fetch(`${baseUrl}/upload`, {
      method: 'POST',
      body: new FormData(),
    });
    assert.equal(missingFileResponse.status, 400);
    assert.equal((await missingFileResponse.json()).error.code, 'FILE_REQUIRED');

    const emptyFileResponse = await fetch(`${baseUrl}/upload`, {
      method: 'POST',
      body: makeUpload('empty.txt', ''),
    });
    assert.equal(emptyFileResponse.status, 400);
    assert.equal((await emptyFileResponse.json()).error.code, 'EMPTY_FILE');

    const oversizedResponse = await fetch(`${baseUrl}/upload`, {
      method: 'POST',
      body: makeUpload('large.txt', '123456789'),
    });
    assert.equal(oversizedResponse.status, 413);
    assert.equal((await oversizedResponse.json()).error.code, 'FILE_TOO_LARGE');

    const invalidMultipartResponse = await fetch(`${baseUrl}/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'multipart/form-data' },
      body: 'invalid multipart body',
    });
    assert.equal(invalidMultipartResponse.status, 400);
    assert.equal(
      (await invalidMultipartResponse.json()).error.code,
      'INVALID_MULTIPART',
    );

    const multipleFiles = new FormData();
    multipleFiles.append('file', new Blob(['one']), 'one.txt');
    multipleFiles.append('file', new Blob(['two']), 'two.txt');
    const multipleFilesResponse = await fetch(`${baseUrl}/upload`, {
      method: 'POST',
      body: multipleFiles,
    });
    assert.equal(multipleFilesResponse.status, 400);
    assert.equal(
      (await multipleFilesResponse.json()).error.code,
      'INVALID_MULTIPART',
    );

    const listResponse = await fetch(`${baseUrl}/documents`);
    assert.deepEqual(await listResponse.json(), []);
  });
});

test('retorna 404 para documento inexistente ou arquivo ausente', async () => {
  await withServer({}, async (baseUrl, storageDirectory) => {
    const unknownResponse = await fetch(
      `${baseUrl}/documents/unknown/download`,
    );
    assert.equal(unknownResponse.status, 404);
    assert.equal(
      (await unknownResponse.json()).error.code,
      'DOCUMENT_NOT_FOUND',
    );

    const uploadResponse = await fetch(`${baseUrl}/upload`, {
      method: 'POST',
      body: makeUpload('missing.txt', 'temporario'),
    });
    const document = await uploadResponse.json();
    await fs.unlink(path.join(storageDirectory, document.id));

    const missingFileResponse = await fetch(
      `${baseUrl}/documents/${document.id}/download`,
    );
    assert.equal(missingFileResponse.status, 404);
    assert.equal(
      (await missingFileResponse.json()).error.code,
      'DOCUMENT_NOT_FOUND',
    );
  });
});
