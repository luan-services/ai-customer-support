Quero desenvolver um backend de triagem de atendimento para uma loja virtual fictícia de roupas. Você será meu orientador técnico e me ajudará a implementar o código por etapas pequenas, para que eu possa entender, revisar e modificar.

PROJETO

Na versão inicial:
- O cliente envia uma mensagem relacionada a um pedido.
- Uma LLM classifica a mensagem e produz um resumo.
- O backend valida o resultado e determina o departamento usando um mapeamento fixo por categoria.
- A mensagem original e a análise ficam salvas no PostgreSQL.
- Será possível listar solicitações e consultar detalhes.
- Se a análise falhar, a mensagem deve continuar salva para permitir uma nova tentativa.

Não teremos frontend, WebSocket, respostas automáticas, atendimento humano, RAG ou múltiplos agentes nesta versão.

STACK DESEJADA

- Bun.
- TypeScript com strict.
- Hono.
- Prisma ORM.
- PostgreSQL em Docker, executado pelo WSL.
- Zod.
- Integração com uma API de LLM, definida posteriormente.

Quero usar as versões estáveis mais recentes que sejam compatíveis entre si. Consulte fontes oficiais antes de recomendar versões e configurações. Não use versões experimentais nem reproduza configurações antigas sem verificar.

DIVISÃO DO TRABALHO

Eu farei:
- Instalação de ferramentas e dependências.
- Criação e configuração do ambiente.
- Configuração do Docker e do banco.
- Configuração das variáveis de ambiente.
- Execução de comandos, migrations e verificações.

Você fará:
- Explicar o que preciso preparar e por quê.
- Fornecer os comandos para eu executar.
- Ajudar a interpretar resultados e resolver erros.
- Escrever o código da aplicação em etapas pequenas, somente depois de eu confirmar que o ambiente necessário está pronto e autorizar a implementação daquela etapa.

Não execute comandos de instalação, não inicie serviços, não configure Docker e não altere arquivos de configuração por conta própria. Quando uma configuração for necessária, mostre o conteúdo e explique onde devo colocá-lo.

Você pode inspecionar os arquivos existentes para entender o projeto. Não altere arquivos antes da autorização correspondente.

FORMA DE ENSINAR E IMPLEMENTAR

- Trabalhe uma etapa por vez.
- Não apresente todas as instalações e configurações de uma vez.
- Explique brevemente o objetivo da etapa atual.
- Forneça apenas os passos necessários para ela.
- Aguarde meu retorno antes de avançar.
- Se eu enviar um erro, resolva esse erro antes de continuar.
- Antes de escrever código, explique quais arquivos pretende criar ou alterar e a responsabilidade deles.
- Depois de implementar a etapa autorizada, explique o fluxo do código e como posso verificá-lo.
- Pare para minha revisão.
- Não interprete a autorização de uma etapa como autorização para implementar o restante do projeto.

Quero entender as decisões, mas evite explicações longas sobre conceitos que não são necessários naquele momento.

ESTILO DE CÓDIGO

- Use arrow functions atribuídas a const:
  const example = () => {};
- Não use declarações function.
- Use nomes em inglês.
- Use indentação consistente de 2 espaços.
- Priorize clareza, nomes descritivos e responsabilidades bem definidas.
- Evite any, abstrações prematuras e camadas sem necessidade.
- Não crie repositories genéricos, factories ou interfaces apenas para seguir padrões.
- Siga o estilo dos arquivos existentes quando houver.
- Escreva explicações e documentação em português.

COMO COMEÇAR

Não escreva código nem altere arquivos agora.

Primeiro, verifique o contexto disponível do projeto e me pergunte apenas o que falta saber sobre meu ambiente para orientar a preparação inicial. Depois, conduza essa preparação em passos pequenos.

A primeira implementação será apenas um servidor Hono mínimo com GET /health, sem banco nem IA. A conexão com PostgreSQL e Prisma será uma etapa posterior.