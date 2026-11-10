const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
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

function beginPendingUpload(baseUrl) {
  const boundary = 'dms-concurrency-test';
  let resolveResponse;
  let rejectResponse;
  const response = new Promise((resolve, reject) => {
    resolveResponse = resolve;
    rejectResponse = reject;
  });
  const request = http.request(`${baseUrl}/upload`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
  }, (result) => {
    let body = '';
    result.setEncoding('utf8');
    result.on('data', (chunk) => { body += chunk; });
    result.on('end', () => {
      resolveResponse({ status: result.statusCode, body: JSON.parse(body) });
    });
  });
  request.on('error', rejectResponse);
  request.write(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="pending.txt"\r\nContent-Type: text/plain\r\n\r\npending`,
  );

  return {
    response,
    finish() {
      request.end(`\r\n--${boundary}--\r\n`);
    },
  };
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

    const extraFieldForm = makeUpload('with-field.txt', 'tiny');
    extraFieldForm.append('description', 'not accepted');
    const extraFieldResponse = await fetch(`${baseUrl}/upload`, {
      method: 'POST',
      body: extraFieldForm,
    });
    assert.equal(extraFieldResponse.status, 400);
    assert.equal(
      (await extraFieldResponse.json()).error.code,
      'INVALID_MULTIPART',
    );

    const listResponse = await fetch(`${baseUrl}/documents`);
    assert.deepEqual(await listResponse.json(), []);
  });
});

test('impede uploads que ultrapassem a cota de armazenamento', async () => {
  await withServer({ maxStorageBytes: 4 }, async (baseUrl, storageDirectory) => {
    const uploadResponse = await fetch(`${baseUrl}/upload`, {
      method: 'POST',
      body: makeUpload('over-quota.txt', '12345'),
    });

    assert.equal(uploadResponse.status, 507);
    assert.equal(
      (await uploadResponse.json()).error.code,
      'STORAGE_LIMIT_REACHED',
    );
    assert.deepEqual(await (await fetch(`${baseUrl}/documents`)).json(), []);
    assert.deepEqual(await fs.readdir(storageDirectory), []);
  });
});

test('contabiliza arquivos locais sem metadados na quota', async () => {
  await withServer({ maxStorageBytes: 4 }, async (baseUrl, storageDirectory) => {
    await fs.writeFile(path.join(storageDirectory, 'orphaned-file'), '1234');

    const uploadResponse = await fetch(`${baseUrl}/upload`, {
      method: 'POST',
      body: makeUpload('new.txt', 'x'),
    });

    assert.equal(uploadResponse.status, 507);
    assert.equal(
      (await uploadResponse.json()).error.code,
      'STORAGE_LIMIT_REACHED',
    );
    assert.deepEqual(await (await fetch(`${baseUrl}/documents`)).json(), []);
    assert.deepEqual(await fs.readdir(storageDirectory), ['orphaned-file']);
  });
});

test('impede uploads além do limite de documentos', async () => {
  await withServer({ maxDocuments: 1 }, async (baseUrl, storageDirectory) => {
    const firstUpload = await fetch(`${baseUrl}/upload`, {
      method: 'POST',
      body: makeUpload('first.txt', 'first'),
    });
    assert.equal(firstUpload.status, 201);

    const secondUpload = await fetch(`${baseUrl}/upload`, {
      method: 'POST',
      body: makeUpload('second.txt', 'second'),
    });
    assert.equal(secondUpload.status, 507);
    assert.equal(
      (await secondUpload.json()).error.code,
      'STORAGE_LIMIT_REACHED',
    );
    assert.equal((await (await fetch(`${baseUrl}/documents`)).json()).length, 1);
    assert.equal((await fs.readdir(storageDirectory)).length, 1);
  });
});

test('limita a quantidade de uploads simultâneos', async () => {
  await withServer({ maxConcurrentUploads: 1 }, async (baseUrl) => {
    const pendingUpload = beginPendingUpload(baseUrl);
    await new Promise((resolve) => setImmediate(resolve));

    const rejectedUpload = await fetch(`${baseUrl}/upload`, {
      method: 'POST',
      body: makeUpload('second.txt', 'second'),
    });
    assert.equal(rejectedUpload.status, 503);
    assert.equal(
      (await rejectedUpload.json()).error.code,
      'UPLOAD_CAPACITY_REACHED',
    );

    pendingUpload.finish();
    assert.equal((await pendingUpload.response).status, 201);
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

    const traversalResponse = await fetch(
      `${baseUrl}/documents/%2e%2e%2f..%2fetc%2fpasswd/download`,
    );
    assert.equal(traversalResponse.status, 404);
    assert.equal(
      (await traversalResponse.json()).error.code,
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
