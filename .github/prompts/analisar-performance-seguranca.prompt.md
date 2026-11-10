---
description: Analisa código em busca de gargalos de desempenho e riscos de segurança, com evidências e recomendações priorizadas.
name: analisar-performance-seguranca
argument-hint: escopo ou arquivos a analisar
agent: agent
---

# Análise de desempenho e segurança

Analise o escopo `${input:escopo:arquivos ou módulos a analisar}` no workspace, considerando as instruções do projeto, a arquitetura existente e boas práticas aplicáveis. Se o escopo não for informado, concentre-se nas alterações mais recentes e nos módulos diretamente relacionados.

Faça uma revisão somente leitura. Não edite arquivos, não aplique correções e não execute testes ou comandos que alterem o estado do workspace. Baseie os achados em código e fluxos verificáveis; diferencie fatos, hipóteses e lacunas de informação.

## Desempenho

Considere, quando pertinente:

- Complexidade algorítmica, operações repetidas, consultas redundantes e possíveis padrões N+1.
- Uso de memória, coleções sem limite, cópias de dados e processamento de arquivos ou respostas grandes.
- I/O síncrono ou bloqueante, streaming, concorrência e operações de rede.
- Cache, paginação e limites de recursos, evitando sugeri-los quando não houver necessidade demonstrável.
- Renderizações desnecessárias, carregamento de assets e tamanho do bundle no frontend.

Explique o cenário em que o custo aparece e seu efeito provável. Não classifique código como lento sem evidência; quando faltarem medições, indique a hipótese e recomende como medi-la.

## Segurança

Considere, quando pertinente:

- Validação de entrada e tratamento de dados não confiáveis nos limites HTTP e da interface.
- Autenticação, autorização, exposição de dados e princípio do menor privilégio.
- Upload e download de arquivos, limites de tamanho, nomes, caminhos, traversal e acesso ao filesystem.
- Injeção, XSS, CSRF, CORS, configuração de headers e uso seguro de dependências.
- Segredos, dados sensíveis em logs ou respostas, tratamento de erros e configuração por ambiente.
- Limites contra consumo abusivo de recursos e comportamento em falhas.

Use princípios defensivos e padrões reconhecidos, como OWASP, quando forem relevantes ao fluxo analisado. Não descreva exploração contra sistemas reais nem apresente payloads ou passos ofensivos; proponha apenas verificações locais e seguras para confirmar riscos.

## Formato da resposta

Comece pelos achados, em ordem de severidade. Para cada achado, informe:

1. Categoria: segurança ou desempenho; severidade: crítica, alta, média ou baixa; e confiança: alta, média ou baixa.
2. Localização precisa no formato `caminho/arquivo:linha` e trecho ou fluxo que sustenta o achado.
3. Condição necessária para o problema ocorrer e impacto concreto.
4. Recomendação mínima e proporcional para corrigir ou validar o problema.

Não inclua achados especulativos como vulnerabilidades confirmadas. Evite conselhos genéricos, duplicados ou refatorações amplas sem relação direta com um risco ou custo observado. Se não encontrar problemas relevantes, diga isso claramente e registre brevemente o escopo e as limitações da análise. Não faça alterações no código.
