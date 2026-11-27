# AI Customer Support

MVP de atendimento para uma loja virtual de roupas. A API valida o vínculo entre o usuário e o pedido, salva a mensagem no PostgreSQL e usa o Gemini para classificar e resumir a solicitação. Um mapeamento fixo atribui o departamento responsável.

**Primeira versão funcional de `RESPOSTA`**. O cliente pode iniciar uma conversa sobre um pedido, receber respostas automáticas com o contexto da entrega e ter o caso sinalizado para atendimento humano. No momento só funciona para mensagens categorizadas
como problema de entrega (`DELIVERY`).

Interface, notificações e chat em tempo real com atendente ficam para uma versão futura.

## Fluxo de entrega

1. O cliente escolhe um pedido e envia a primeira mensagem. O backend confere o vínculo entre `userId` e `orderId` e salva a fala antes de chamar o Gemini.
2. O Gemini classifica a solicitação. Em `DELIVERY`, o backend usa o histórico e os dados do pedido para gerar e salvar a primeira resposta no mesmo `POST`. As demais categorias ficam registradas e classificadas.
3. As próximas falas vão para `/messages`. O Gemini pode responder com os dados disponíveis, fazer uma pergunta útil ou recomendar revisão humana.
4. Se o cliente pedir um atendente, se o caso exigir investigação ou se chegar uma nova fala depois de quatro respostas automáticas, o backend registra `NEEDS_REVIEW`, salva um aviso ao cliente e interrompe as respostas automáticas. As novas falas continuam no histórico.

Um pedido que consta como entregue pode receber uma resposta normal. Se o cliente disser que não recebeu, a IA pode perguntar se alguém recebeu por ele e sinalizar revisão quando o histórico mostrar que é preciso investigar.

Use `GET /support-requests?replyStatus=NEEDS_REVIEW` para consultar a fila. O campo `reviewReason` identifica `HUMAN_REQUESTED`, `INVESTIGATION_REQUIRED` ou `TURN_LIMIT_REACHED` no fluxo atual.

## Rodar localmente

O projeto usa Bun, TypeScript, Hono, Zod, Prisma ORM 7, PostgreSQL e Gemini 3.1 Flash-Lite. Os testes locais usam usuários e pedidos fictícios. O `userId` enviado na requisição simula a identidade do cliente.

Crie um `.env` na raiz com a URL do seu PostgreSQL e a chave da API do Gemini.

```dotenv
DATABASE_URL="postgresql://support_app:SUA_SENHA@127.0.0.1:5433/customer_support"
GEMINI_API_KEY="SUA_CHAVE"
```

Com o banco rodando, instale as dependências, aplique as migrations, gere o Prisma Client e carregue os dados fictícios com a seed disponível.

```powershell
bun install
bunx --bun prisma migrate deploy --config prisma7.config.ts
bunx --bun prisma generate --config prisma7.config.ts
bun run prisma/seed.ts
bun run dev
```

A API fica em `http://localhost:3000`.

## Rotas

| Método | Rota | Uso |
| --- | --- | --- |
| `GET` | `/health` | Consultar o status da API |
| `GET` | `/users/:userId/orders` | Listar os pedidos do usuário |
| `POST` | `/support-requests` | Criar uma solicitação e gerar a primeira resposta de entrega |
| `GET` | `/support-requests` | Listar solicitações, com filtro opcional `replyStatus` |
| `GET` | `/support-requests/:id` | Consultar a solicitação e seu histórico |
| `POST` | `/support-requests/:id/messages` | Registrar outra fala e responder se o atendimento automático estiver ativo |
| `POST` | `/support-requests/:id/draft-reply` | Tentar gerar uma resposta para uma conversa de entrega já classificada |
| `POST` | `/support-requests/:id/retry` | Repetir uma triagem que ficou `FAILED` |

### Exemplo de conversa com `curl`

O exemplo usa a Marina, criada pelo seed, e o pedido `PED-1002`, que consta como entregue.

1. Liste os pedidos e copie o `id` do `PED-1002`.

   ```powershell
   curl.exe http://localhost:3000/users/7fb43c27-bb18-457a-a0a9-518383e96b28/orders
   ```

2. Substitua `ORDER_ID` pelo ID do pedido. O retorno traz o ID da solicitação e a primeira resposta em `reply`.

   ```powershell
   '{"userId":"7fb43c27-bb18-457a-a0a9-518383e96b28","orderId":"ORDER_ID","message":"Meu pedido aparece como entregue, mas eu nunca recebi."}' |
       curl.exe --json '@-' http://localhost:3000/support-requests
   ```

3. Leia a primeira resposta e substitua `REQUEST_ID` pelo ID retornado no passo anterior para continuar a conversa.

   ```powershell
   '{"message":"Falei com a portaria, com os vizinhos e com todo mundo de casa. Nenhuma dessas pessoas recebeu o pacote."}' |
       curl.exe --json '@-' http://localhost:3000/support-requests/REQUEST_ID/messages
   ```

4. Se o retorno indicar `NEEDS_REVIEW`, consulte o caso na fila.

   ```powershell
   curl.exe 'http://localhost:3000/support-requests?replyStatus=NEEDS_REVIEW'
   ```

Se a **triagem** falhar, a solicitação fica `FAILED` e pode ser reprocessada em `/retry`. Se a **resposta automática** falhar depois da triagem, a fala fica salva e o retorno pode trazer `replyError`, como `REPLY_UNAVAILABLE`. Use `/draft-reply` para tentar gerar a resposta sem reenviar a mensagem.

## Testes

A última execução da suíte de integração passou com **44 testes**. Ela usa o PostgreSQL indicado por `DATABASE_URL`, simula o Gemini e verifica a primeira resposta automática, a preservação da solicitação em caso de falha e o encaminhamento pelo limite de respostas. Use um banco de desenvolvimento com as migrations aplicadas.

```powershell
bun test tests/integration/support-requests.test.ts
```

O script de entrega usa o Gemini real para avaliar quatro cenários que cobrem consulta de status, primeiro relato de não recebimento, investigação e pedido de atendimento humano.

```powershell
bun run scripts/test-delivery-reply.ts
```

A avaliação de triagem usa o Gemini real com uma mensagem de cada categoria. Ela compara categoria e departamento e imprime os resumos para revisão. É necessário o valor RUN_GEMINI_EVAL = '1' no .env

```powershell
bun test tests/evaluation/triage.test.ts
```
