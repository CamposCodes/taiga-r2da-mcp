# taiga-mcp

[English](README.md)

Servidor [MCP](https://modelcontextprotocol.io) que liga um modelo de IA a uma instalação do
[Taiga](https://taiga.io) 6. Com ele, o Claude Code, o Claude Desktop, o Codex ou qualquer cliente MCP lê
projetos, sprints, histórias de usuário, tarefas, problemas e os anexos deles em nome de quem fez o login, e
responde perguntas como "o que está aberto na sprint atual?" ou "quais tarefas estão sem responsável?".

Por padrão o servidor **só lê**: toda chamada ao Taiga é um `GET`. Iniciado com `TAIGA_WRITE=1` ele também cria,
edita e move histórias de usuário, tarefas e problemas e anexa arquivos a eles. Ele só exclui quando
`TAIGA_DELETE=1` também está definida, e mesmo assim em duas chamadas: a primeira só mostra o que seria excluído.

- **18 tools**: 10 de leitura, 7 de escrita, 1 de exclusão.
- **Nomes, não ids**: o modelo diz `"In progress"` ou um nome de usuário, e o servidor encontra o id.
- **Respostas curtas**: uma linha de resumo por item, com paginação, para um quadro de centenas de itens caber
  no contexto.
- **Funciona com login único (SSO)**: usa o token de sessão do navegador, então não precisa de senha do Taiga.
- **Segue as permissões do Taiga**: quando o papel do usuário não permite criar, alterar ou excluir um item,
  nada é enviado e o modelo é informado do que esse papel pode fazer no lugar.
- **Duas dependências**: `@modelcontextprotocol/server` e `zod`.

A documentação detalhada, em `docs/`, está em inglês.

## Como funciona

A figura mostra as peças de uma sessão: o cliente e o servidor rodam na sua máquina, e o servidor fala com o seu
Taiga.

![Arquitetura do taiga-mcp: cliente e servidor na máquina do usuário, API do Taiga e arquivos de anexo na instalação do Taiga](docs/diagrams/01-architecture.svg)

O seu cliente MCP inicia `node dist/index.js` com o endereço do seu Taiga e o seu token. O servidor confere o
token, registra as tools e espera. Cada chamada de tool vira uma ou mais chamadas à API REST do Taiga, e a
resposta volta ao modelo em JSON curto. Mais em [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Início rápido

Requer Node 20 ou mais novo e um Taiga 6 em que você consiga entrar, acessado por `https://`.

**1. Compile**

```bash
git clone https://github.com/CamposCodes/taiga-r2da-mcp.git taiga-mcp
cd taiga-mcp
npm ci
npm run build
```

**2. Pegue um token.** Entre no seu Taiga pelo navegador, abra as ferramentas do desenvolvedor (F12), vá em
**Aplicativo** (Application), **Armazenamento local** (Local Storage), o endereço do seu Taiga, e copie o valor
da chave `token`.

**3. Registre o servidor no seu cliente.** No Claude Code:

```bash
claude mcp add --env TAIGA_URL=https://taiga.example.com --env "TAIGA_TOKEN=<YOUR_TOKEN>" --transport stdio --scope local taiga -- node /absolute/path/to/taiga-mcp/dist/index.js
```

Passo a passo, por cliente:

| Cliente | Guia |
| --- | --- |
| Claude Code | [docs/clients/claude-code.md](docs/clients/claude-code.md) |
| Claude Desktop | [docs/clients/claude-desktop.md](docs/clients/claude-desktop.md) |
| Codex (CLI, extensão de IDE, aplicativo) | [docs/clients/codex.md](docs/clients/codex.md) |

Qualquer outro cliente que inicie um servidor MCP por stdio funciona do mesmo jeito: o comando é `node`, o
argumento é o caminho absoluto de `dist/index.js`, e as variáveis abaixo vão no ambiente do servidor.

**4. Pergunte.** "Quais projetos eu tenho no Taiga?" Não é preciso citar o nome de uma tool.

## Tools

Leitura, sempre presentes:

| Tool | O que faz |
| --- | --- |
| `taiga_me` | O usuário do token |
| `taiga_projects_list` | Projetos de que o usuário participa |
| `taiga_projects_get` | Um projeto: status, membros, sprints, pontos, tipos de problema, gravidades, prioridades e as permissões do usuário |
| `taiga_sprints_list` | Sprints com datas, histórias abertas e fechadas e pontos, da mais nova para a mais antiga |
| `taiga_userstories_list` | Histórias de usuário, uma linha por história, com filtros |
| `taiga_tasks_list` | Tarefas, cada uma com a história a que pertence, com filtros |
| `taiga_issues_list` | Problemas, com filtros por tipo, gravidade e prioridade |
| `taiga_items_get` | Um item pelo número, de qualquer tipo, com a descrição e a lista de anexos; comentários e histórico quando pedidos |
| `taiga_search` | Busca por palavras em histórias, tarefas, problemas e páginas da wiki |
| `taiga_attachments_get` | O conteúdo de um anexo: uma imagem, um texto ou o caminho de um arquivo gravado. Ela pode gravar um arquivo na máquina, por isso não é marcada como somente leitura |

Escrita, só com `TAIGA_WRITE=1`:

| Tool | O que faz |
| --- | --- |
| `taiga_userstories_create` | Cria uma história de usuário |
| `taiga_userstories_update` | Edita ou move uma história de usuário, e comenta nela. Só muda os campos informados |
| `taiga_tasks_create` | Cria uma tarefa em uma história ou em uma sprint |
| `taiga_tasks_update` | Edita ou move uma tarefa, e comenta nela. Só muda os campos informados |
| `taiga_issues_create` | Cria um problema |
| `taiga_issues_update` | Edita ou move um problema, e comenta nele. Só muda os campos informados |
| `taiga_attachments_add` | Envia um arquivo da máquina para uma história, uma tarefa ou um problema. Um arquivo que parece credencial é recusado |

Exclusão, só com `TAIGA_DELETE=1` além de `TAIGA_WRITE=1`:

| Tool | O que faz |
| --- | --- |
| `taiga_items_delete` | Exclui de vez uma história, uma tarefa ou um problema, em duas chamadas: a primeira não exclui nada, mostra o item e dá um código; a segunda, com esse código, exclui |

Antes de criar, alterar ou excluir um item, o servidor confere o que o Taiga diz que o usuário pode fazer no
projeto (`myPermissions` de `taiga_projects_get`). Quando falta a permissão, nada é enviado e o erro diz ao modelo
o que aquele papel pode fazer no lugar: por exemplo, criar uma tarefa em uma história que já existe, registrar um
problema ou deixar um comentário. O modelo é orientado a não escolher sozinho: ele informa a recusa, oferece as
alternativas e espera a escolha. Uma recusa que vem do próprio Taiga traz o mesmo pedido.

Parâmetros, exemplos de chamada, exemplos de resposta e erros: [docs/TOOLS.md](docs/TOOLS.md). Fluxos de uso e
pedidos de exemplo: [docs/USAGE.md](docs/USAGE.md).

## Configuração

| Variável | Obrigatória | Para que serve |
| --- | --- | --- |
| `TAIGA_URL` | sim | Endereço do Taiga, com ou sem `/api/v1` no fim. Precisa começar com `https://`: só esta máquina (`localhost`, `127.0.0.1`, `[::1]`) pode ser acessada por `http://`. Um endereço com usuário ou senha é recusado |
| `TAIGA_TOKEN` | sim | Token de sessão do Taiga 6, copiado do navegador |
| `TAIGA_WRITE` | não | `1` registra as sete tools de escrita. Qualquer outro valor, ou a falta dela, deixa o servidor somente leitura |
| `TAIGA_DELETE` | não | `1` registra `taiga_items_delete`, a tool que exclui. Precisa de `TAIGA_WRITE=1`: sem ela o servidor não inicia |

O servidor lê essas variáveis do próprio ambiente e de nenhum outro lugar. O arquivo
[`.env.example`](.env.example) lista todas elas.

O token expira depois de um tempo definido pelo seu Taiga. Quando isso acontece, as tools respondem
`Taiga refused the token: it expired or is wrong.` e você copia um novo. O servidor não renova o token.

## Segurança

O token **é a sua sessão no Taiga**: quem tem o token lê tudo o que você lê, até ele expirar.

- Informe o token na configuração do seu cliente, por servidor. Não cole em chat, issue ou repositório.
- `TAIGA_URL` precisa começar com `https://`: por `http://` simples o token viajaria em texto claro, então o
  servidor recusa um endereço assim, exceto o desta máquina.
- O texto de uma tarefa, de um comentário ou de um anexo é escrito por outras pessoas e pode trazer instruções
  para o modelo.
- Com `TAIGA_WRITE=1`, o que o modelo cria ou edita sai no seu nome. O servidor não pede confirmação por conta
  própria: quem pede é o cliente. Leia o que o modelo propõe antes de permitir.
- Com `TAIGA_DELETE=1`, o que é excluído não volta: o Taiga não tem lixeira, e excluir uma história exclui as
  tarefas dela. A primeira chamada de `taiga_items_delete` só mostra o que seria excluído, mas a segunda ainda é
  feita pelo modelo: o que mantém você no controle é o pedido de permissão do seu cliente.
- `taiga_attachments_add` recusa um arquivo que parece credencial: um nome que começa com ponto em qualquer parte
  do caminho, a pasta onde os programas guardam os dados do usuário, ou um arquivo de chave. É uma lista de
  bloqueio, não um sandbox: qualquer outro arquivo que o seu usuário lê pode ser enviado. Confira o caminho antes
  de permitir.

O modelo de ameaças, o que o servidor alcança e como reportar uma falha: [SECURITY.md](SECURITY.md).

## Documentação

| Página | O que tem |
| --- | --- |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Componentes, partida, uma chamada de leitura e uma de escrita, com diagramas |
| [docs/USAGE.md](docs/USAGE.md) | Fluxos de uso, pedidos de exemplo, limites e solução de problemas |
| [docs/TOOLS.md](docs/TOOLS.md) | Cada tool: parâmetros, exemplo de chamada, exemplo de resposta, erros |
| [docs/clients/](docs/clients/) | Instalação no Claude Code, no Claude Desktop e no Codex |
| [SECURITY.md](SECURITY.md) | Modelo de ameaças e como reportar uma falha |
| [docs/COMPLIANCE.md](docs/COMPLIANCE.md) | Auditoria contra a especificação do MCP e as orientações da Anthropic, com as fontes, e o que foi feito a respeito de cada achado |
| [docs/TESTING.md](docs/TESTING.md) | Como o servidor é testado, a lista de todos os cenários e o relatório da última execução |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Como compilar, testar e alterar o servidor |
| [CHANGELOG.md](CHANGELOG.md) | O que mudou em cada versão |

## Estado e limites

- Versão 0.3.0. Alvo: Taiga 6. Transporte: só stdio.
- Protocolo: revisão `2026-07-28` do MCP e as anteriores, na mesma conexão stdio, pela versão 2 do SDK de
  TypeScript (`@modelcontextprotocol/server`).
- A escrita cobre histórias de usuário, tarefas e problemas: criar, editar, mover, comentar, anexar arquivo e,
  com `TAIGA_DELETE=1`, excluir. Sprints e páginas da wiki não são alteradas, anexos não são excluídos e os
  pontos de uma história não são definidos.
- No máximo 120 chamadas de tool por minuto, e 120 segundos para cada chamada ao Taiga.
- O filtro de responsável das histórias só encontra o responsável principal.
- O token é renovado à mão.
- O pacote não está publicado no npm, onde o nome `taiga-mcp` pertence a outro projeto: instale a partir deste
  repositório, como no [Início rápido](#início-rápido).
- Fora do que existe hoje: conteúdo das páginas da wiki, épicos, linha do tempo, notificações, estatísticas e
  campos personalizados.

## Desenvolvimento

```bash
npm run check      # tipos
npm run build      # compila para dist/
npm test           # cenários de ponta a ponta contra um Taiga simulado, precisa do build
npm run coverage   # os mesmos cenários, e quanto do servidor compilado eles executam
```

Esses comandos nunca falam com um Taiga real. O `npm run test:live` fala, em um único projeto: ele é executado à
mão e nunca no CI. Veja [docs/TESTING.md](docs/TESTING.md) e [CONTRIBUTING.md](CONTRIBUTING.md).

## Origem e licença

A organização (um cliente HTTP e tools com nome `taiga_<recurso>_<ação>`) segue a do
[illodev/taiga-mcp](https://github.com/illodev/taiga-mcp), de licença MIT. O código daqui foi escrito do zero e
não contém código do Taiga: usa só a API REST pública dele. "Taiga" é marca dos seus donos e aparece aqui apenas
para dizer a que sistema o servidor se conecta.

Este projeto é distribuído sob a licença MIT: veja [LICENSE](LICENSE).
