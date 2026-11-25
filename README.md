# AI Customer Support

MVP de um backend de atendimento para uma loja virtual de roupas. A API salva a mensagem original no PostgreSQL, usa a API do Gemini para classificar e resumir a solicitação e atribui o departamento responsável com base em um mapeamento fixo. 

É possível listar solicitações, consultar seus detalhes e tentar novamente quando a análise falha.

A visão para as próximas versões é que a IA possa responder diretamente ao cliente e encaminhar a conversa para um atendente humano via websocket quando necessário. O projeto também vai receber uma interface visual para acompanhar os atendimentos. Nesta versão, a API cobre o registro e a triagem das solicitações.

## Tecnologias

Bun, TypeScript, Hono, Zod, Prisma ORM 7, PostgreSQL e Gemini 3.1 Flash-Lite.

## Rodar localmente

Você precisa do Bun, de um PostgreSQL acessível e de uma chave da API do Gemini, ou outra LLM.

Crie um `.env` na raiz do projeto com as variáveis abaixo, é necessário ter uma connection string de um banco de dados postgre local ou hospedado em algum serviço (como supabase).

```dotenv
DATABASE_URL="postgresql://support_app:SUA_SENHA@127.0.0.1:5433/customer_support"
GEMINI_API_KEY="SUA_CHAVE"
```

Na raiz do projeto, instale as dependências, aplique as migrations, gere o Prisma Client e inicie a API.

```powershell
bun install
bunx --bun prisma migrate deploy --config prisma7.config.ts
bunx --bun prisma generate --config prisma7.config.ts
bun run dev
```

A API fica em `http://localhost:3000`. O servidor verifica a conexão com o PostgreSQL na inicialização.

## Rotas

| Método | Rota | Resposta esperada |
| --- | --- | --- |
| `POST` | `/support-requests` | `201` com a solicitação criada |
| `GET` | `/support-requests` | `200` com as solicitações da mais recente para a mais antiga |
| `GET` | `/support-requests/:id` | `200` com a solicitação encontrada |
| `POST` | `/support-requests/:id/retry` | `200` com o resultado da nova tentativa no mesmo registro |

Exemplo de teste com curl: 

```powershell
'{"message":"Minha blusa chegou rasgada."}' | curl.exe -i http://localhost:3000/support-requests `
  -H 'Content-Type: application/json' `
  --data-binary '@-'
```

A mensagem é gravada como `PENDING` antes da análise. O `POST` aguarda o resultado e devolve o registro como `ANALYZED`, com categoria, resumo e departamento, ou como `FAILED` se a análise falhar. N

esse caso, use o `id` retornado para tentar novamente.

```powershell
curl.exe -i http://localhost:3000/support-requests
curl.exe -i http://localhost:3000/support-requests/uuid
curl.exe -i -X POST http://localhost:3000/support-requests/uuid/retry
```

O `/retry` aceita solicitações `FAILED` e devolve `409` para outros estados.

## Testes

Os testes de integração enviam mensagens fictícias ao Hono, simulam as respostas do Gemini e conferem a gravação no PostgreSQL. 

Eles usam o banco indicado por `DATABASE_URL` e removem pelo ID os registros que criam quando recebem esse ID da API.

```powershell
bun test tests/integration/support-requests.test.ts
```

A avaliação com o Gemini real envia uma mensagem por categoria, em sete chamadas. Ela compara a categoria e o departamento e imprime os resumos para revisão manual. Essa avaliação roda sem salvar nada no PostgreSQL e só é ativada com `RUN_GEMINI_EVAL=1` no .env.