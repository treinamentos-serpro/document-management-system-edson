# Especificação - Document Management System

## 1. Objetivo

Permitir que uma única instância local receba, liste e disponibilize para download documentos enviados, mantendo os arquivos no filesystem local e seus metadados em memória.

## 2. Escopo

### Dentro do escopo

- Envio de um documento por requisição.
- Listagem dos metadados dos documentos recebidos durante a execução atual da aplicação.
- Download de um documento pelo seu identificador.
- Registro simples de um campo `owner`, sem autenticação nem isolamento entre usuários nesta versão.
- Armazenamento dos arquivos no diretório local `backend/storage`, usando `multer` com `diskStorage`.
- Configuração do servidor e do limite de upload por variáveis de ambiente.

### Fora do escopo

- Armazenamento externo ou em nuvem.
- Autenticação, autorização e isolamento de documentos entre usuários.
- Persistência ou recuperação automática de metadados após reiniciar a aplicação.
- Reindexação ou limpeza automática de arquivos sem metadados após reinício.
- Versionamento, busca, paginação e filtros de documentos.
- Allowlist de extensões ou tipos MIME nesta versão.

## 3. Requisitos funcionais

| ID | Requisito |
| --- | --- |
| RF-01 | O sistema deve aceitar um arquivo por requisição `multipart/form-data` no campo `file`. |
| RF-02 | O sistema deve rejeitar requisições sem arquivo, com mais de um arquivo, arquivo vazio ou arquivo acima do limite configurado. |
| RF-03 | Ao receber um arquivo válido, o sistema deve gerar um identificador único no servidor, gravar o conteúdo localmente e criar os metadados correspondentes. |
| RF-04 | O sistema deve retornar os metadados do documento criado após o upload bem-sucedido. |
| RF-05 | O sistema deve listar os metadados de todos os documentos conhecidos durante a execução atual, em ordem decrescente de `uploadedAt`. |
| RF-06 | O sistema deve permitir baixar o arquivo associado a um identificador conhecido, preservando o nome original no nome sugerido para download. |
| RF-07 | O sistema deve retornar erro `404` quando o identificador não estiver nos metadados em memória ou quando o arquivo associado não estiver disponível. |
| RF-08 | O sistema deve usar o valor fixo `local` no campo `owner` nesta versão. Esse campo é informativo e não representa autenticação ou controle de acesso. |

## 4. Requisitos não funcionais

| ID | Requisito |
| --- | --- |
| RNF-01 | Os arquivos devem ser gravados exclusivamente no filesystem local, em `backend/storage`, por meio de `multer` configurado com `diskStorage`. Não usar provedores externos. |
| RNF-02 | Os metadados devem permanecer em memória. Ao reiniciar o processo, a listagem começa vazia e os arquivos já gravados não são reindexados nem removidos automaticamente. |
| RNF-03 | O diretório e o nome físico do arquivo devem ser determinados pelo servidor. O nome original fornecido pelo cliente não deve ser usado como caminho de armazenamento. |
| RNF-04 | O limite máximo de upload deve ser configurável pela variável `MAX_FILE_SIZE_BYTES`, com padrão de 10 MiB (10.485.760 bytes). O arquivo deve conter ao menos um byte. |
| RNF-05 | A porta HTTP deve ser configurável pela variável `PORT`, com padrão `3000`. A configuração deve seguir o princípio 12-Factor. |
| RNF-06 | O conteúdo do download deve ser enviado como `application/octet-stream`, com disposição de anexo e nome original tratado com segurança para uso em cabeçalho HTTP. |
| RNF-07 | Erros devem usar o formato JSON definido nesta especificação e não devem expor caminhos locais, stack traces ou detalhes internos ao cliente. |
| RNF-08 | A API não deve afirmar garantias de confidencialidade por usuário: não há autenticação, e os documentos pertencem ao contexto único da instância. |

## 5. Modelo de dados (metadados do documento)

Os metadados existem somente em memória durante a execução atual do processo.

| Campo | Tipo | Descrição |
| --- | --- | --- |
| `id` | string | Identificador único, opaco e gerado pelo servidor. Usado nas rotas de listagem e download. |
| `originalName` | string | Nome original informado para o arquivo, armazenado como metadado; nunca usado como caminho físico. |
| `size` | number | Tamanho do arquivo em bytes. Deve ser maior que zero e não exceder `MAX_FILE_SIZE_BYTES`. |
| `uploadedAt` | string | Data e hora do recebimento bem-sucedido em formato ISO 8601. |
| `owner` | string | Valor `local` nesta versão. Não identifica uma pessoa nem concede isolamento de acesso. |

O caminho físico é um detalhe interno de persistência: deve ser derivado do identificador gerado pelo servidor e permanecer dentro de `backend/storage`. Não faz parte dos metadados retornados pela API.

## 6. Contratos de API

As rotas do backend são definidas sem prefixo: `/upload` e `/documents`. Em desenvolvimento, o frontend pode chamá-las pelo prefixo `/api`; o proxy do Vite remove esse prefixo antes de encaminhar a requisição. `/api` não é parte das rotas implementadas pelo backend.

Formato JSON de erro comum:

```json
{
  "error": {
    "code": "DOCUMENT_NOT_FOUND",
    "message": "Documento não encontrado."
  }
}
```

A propriedade `code` é estável para consumo pelo cliente; `message` é uma mensagem legível em português. Respostas de erro de upload e API devem usar `Content-Type: application/json; charset=utf-8`.

### `POST /upload`

- Entrada: `multipart/form-data` com exatamente um arquivo no campo `file`.
- Validação: arquivo presente, não vazio e dentro do limite `MAX_FILE_SIZE_BYTES`; não há allowlist fixa de extensão ou MIME nesta versão.
- Sucesso: `201 Created`, corpo JSON com os metadados do documento criado.

```json
{
  "id": "identificador-gerado",
  "originalName": "relatorio.pdf",
  "size": 12345,
  "uploadedAt": "2026-11-10T12:00:00.000Z",
  "owner": "local"
}
```

- Erros: `400 Bad Request` para multipart inválido, arquivo ausente, múltiplos arquivos ou arquivo vazio; `413 Payload Too Large` para arquivo acima do limite; `500 Internal Server Error` para falha inesperada de gravação. Em falha, não deve ser criado metadado de documento; arquivos parciais da tentativa devem ser removidos quando possível.

### `GET /documents`

- Entrada: nenhuma.
- Sucesso: `200 OK`, corpo JSON como array de metadados, ordenado do mais recente para o mais antigo. Sem documentos, retorna `[]`.

```json
[
  {
    "id": "identificador-gerado",
    "originalName": "relatorio.pdf",
    "size": 12345,
    "uploadedAt": "2026-11-10T12:00:00.000Z",
    "owner": "local"
  }
]
```

- Erro: `500 Internal Server Error` somente para falha inesperada ao atender a requisição.

### `GET /documents/:id/download`

- Entrada: identificador do documento no parâmetro `id`.
- Sucesso: `200 OK`, conteúdo binário com `Content-Type: application/octet-stream` e `Content-Disposition: attachment`, indicando o nome original de forma segura.
- Erros: `404 Not Found` se o ID não for conhecido na execução atual ou se o arquivo não existir; `500 Internal Server Error` para outra falha de leitura. Não retornar o caminho local ao cliente.

## 7. Decisões arquiteturais

- Backend em Node.js e Express, organizado em Clean Architecture simples: `routes` delegam a `controllers`; `controllers` tratam HTTP e validação de entrada; `services` concentram regras de negócio; `repositories` encapsulam metadados em memória e acesso ao arquivo local. As dependências seguem `routes -> controllers -> services -> repositories`.
- O tratamento de upload usa `multer` com `diskStorage`. O nome físico é gerado pelo servidor a partir do identificador; o nome enviado pelo usuário é mantido somente como `originalName`.
- A persistência dos arquivos é local em `backend/storage`. O repositório de metadados é em memória nesta fase, portanto reiniciar o processo perde a associação entre IDs e arquivos existentes.
- Não há autenticação nesta versão. A listagem é global para a instância e o `owner` tem valor `local`; não se deve apresentar esse campo como mecanismo de segurança.
- O frontend usa React e acessa a API por `fetch`. O prefixo `/api` é apenas a configuração de proxy de desenvolvimento do Vite.
- Códigos e nomes de campos permanecem em inglês conforme as convenções do projeto; mensagens de erro ao usuário são em português.

## 8. Plano de execução

Etapas futuras em nível de capacidades do produto; este plano não atribui mudanças a arquivos específicos de backend ou frontend.

1. Estabelecer os contratos de metadados, erros, configuração e armazenamento local que servirão de base para os fluxos do sistema.
2. Entregar o fluxo de upload local, incluindo validação, criação de metadados e retorno do documento criado.
3. Entregar a listagem dos documentos disponíveis na execução atual, com ordenação definida e estado vazio.
4. Entregar o download por identificador, incluindo cabeçalhos seguros e comportamento para documento inexistente.
5. Integrar os fluxos na experiência do usuário e validar os cenários de sucesso, entradas inválidas, erros e reinício conforme os limites desta especificação.
