# CRUDs de Marcas e Categorias

Todas as rotas exigem `Authorization: Bearer <token>` e um usuário ativo com perfil `ADMIN`, como nos CRUDs de Usuários, Veículos, Serviços e Vendas. As telas ficam em `/pages/admin/marcas.html` e `/pages/admin/categorias.html`, acessíveis pelo menu lateral.

## Preparação

Execute `npm run db:setup` depois de atualizar. As tabelas existentes são preservadas e recebem índices únicos com comparação Unicode via ICU. Isso impede duplicados inclusive em solicitações simultâneas e em bancos com localidade C. A preparação informa se houver nomes repetidos antigos, sem apagá-los nem mesclá-los automaticamente. Depois, reinicie o servidor (`npm start`).

## Rotas

As duas APIs têm o mesmo formato; troque `marcas` por `categorias`.

| Método | Rota | Resultado |
| --- | --- | --- |
| GET | `/api/marcas` | Lista com pesquisa e paginação |
| GET | `/api/marcas/:id` | Dados de uma marca |
| POST | `/api/marcas` | Cria; retorna 201 |
| PUT | `/api/marcas/:id` | Atualiza |
| DELETE | `/api/marcas/:id` | Exclui; retorna 204 |

Filtro: `q` (nome). Padrão de 8 itens por página. A resposta da listagem é `{ items, total, page, limit, pages }`; cada item tem `id`, `nome` e `total_veiculos` (quantidade de veículos que usam a marca/categoria).

```json
{ "nome": "Toyota" }
```

## Regras

- O nome é obrigatório, tem até 100 caracteres e é único **sem diferenciar maiúsculas de minúsculas** (409 se já existir).
- A regra também vale para letras acentuadas: `Citroën` e `CITROËN` são o mesmo nome. Acentos continuam significativos: `Revisão` e `Revisao` podem ser nomes diferentes.
- Uma marca ou categoria que já tem veículos **não pode ser excluída** (409), pois o banco usa `ON DELETE RESTRICT`. Altere ou exclua os veículos antes.
- Na edição é possível trocar apenas as letras do próprio nome (ex.: `toyota` → `Toyota`).
- A tabela só tem `id` e `nome`; por isso não há `versao`, status ativo/inativo nem datas de cadastro, diferentemente de Serviços.
- O formulário de veículos continua lendo as opções por `GET /api/veiculos/opcoes`; novas marcas e categorias aparecem ali automaticamente.

## Respostas de erro

Seguem o padrão `{ "message": "explicação" }`: 400 para dados inválidos, 401/403 para sessão e permissão, 404 para registro inexistente e 409 para nome duplicado ou item em uso por veículos.

## Testes

`tests/marcas-categorias.test.js` roda com `npm test` e, como `tests/crud.test.js`, exige `TEST_DATABASE_URL` (usa um schema temporário e não toca no banco principal).
