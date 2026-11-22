# CRUDs de Serviços e Vendas

Todas as rotas exigem `Authorization: Bearer <token>` e um usuário ativo com perfil `ADMIN`, como nos CRUDs de Usuários e Veículos. As telas ficam em `/pages/admin/servicos.html` e `/pages/admin/vendas.html`, acessíveis pelo menu lateral.

## Preparação

Depois de atualizar o código, rode `npm run db:setup` na raiz. O comando cria as tabelas `servicos`, `vendas` e `venda_servicos` sem apagar dados existentes. Sem elas, `npm start` avisa para executar o comando.

## Serviços

| Método | Rota | Resultado |
| --- | --- | --- |
| GET | `/api/servicos` | Lista com pesquisa e paginação |
| GET | `/api/servicos/:id` | Dados de um serviço |
| POST | `/api/servicos` | Cria; retorna 201 |
| PUT | `/api/servicos/:id` | Atualiza o cadastro completo |
| DELETE | `/api/servicos/:id` | Exclui; retorna 204 |

Filtros: `q` (nome/descrição) e `status=ATIVO|INATIVO`. Padrão de 8 itens por página.

```json
{ "nome": "Revisão completa", "descricao": "Troca de óleo e filtros", "preco": "850.00", "ativo": true }
```

- O nome é único, sem diferenciar maiúsculas de minúsculas. O preço aceita zero e até duas casas decimais.
- Serviços inativos não aparecem ao registrar novas vendas.
- Um serviço já usado em uma venda **não pode ser excluído** (409); marque-o como inativo.
- Alterar o preço de um serviço não muda vendas já registradas: cada venda guarda o preço cobrado na época.
- Envie `versao` na edição para detectar alterações concorrentes (409).

## Vendas

| Método | Rota | Resultado |
| --- | --- | --- |
| GET | `/api/vendas` | Lista com pesquisa, filtros e paginação |
| GET | `/api/vendas/opcoes` | Clientes ativos, veículos livres e serviços ativos para o formulário |
| GET | `/api/vendas/:id` | Venda com os serviços adicionais |
| POST | `/api/vendas` | Registra; retorna 201 |
| PUT | `/api/vendas/:id` | Atualiza |
| DELETE | `/api/vendas/:id` | **Cancela** a venda; retorna 204 |

Filtros: `q` (número como `V-2026-0001`, cliente ou veículo), `status`, `forma_pagamento` e `periodo=30|mes|ano` (últimos 30 dias, este mês, este ano, no horário de Brasília).

```json
{
  "cliente_id": 3, "veiculo_id": 7, "valor_veiculo": "178990.00",
  "servicos": [1, 2], "forma_pagamento": "FINANCIAMENTO", "status": "EM_NEGOCIACAO"
}
```

Formas de pagamento: `A_VISTA`, `FINANCIAMENTO`, `CARTAO`. Status: `EM_NEGOCIACAO`, `APROVADA`, `CONCLUIDA`, `CANCELADA`.

### Regras

- O servidor calcula `valor_servicos` (soma dos serviços escolhidos) e `valor_total`; valores enviados para esses campos são ignorados.
- O cliente precisa ser um usuário ativo do tipo cliente. O número da venda (`numero`) é gerado a partir do ano e do id.
- Um veículo só pode ter **uma venda não cancelada**. Veículos já vendidos não podem ser vendidos de novo (409).
- O status do veículo acompanha o da venda: em negociação e aprovada deixam o veículo **Reservado**, concluída o deixa **Vendido** e cancelada o devolve para **Disponível**. Isso alimenta a contagem de vendidos do dashboard.
- Na edição não é possível trocar o veículo; cancele a venda e registre outra. Vendas canceladas não podem ser alteradas.
- Excluir é cancelar: o registro e os valores ficam no histórico. A tela mostra a ação como "Cancelar", conforme o wireframe.
- Clientes e veículos com vendas não podem ser excluídos (409).

## Respostas de erro

Seguem o padrão `{ "message": "explicação" }`: 400 para dados inválidos, 401/403 para sessão e permissão, 404 para registro inexistente e 409 para nome duplicado, edição concorrente e conflitos de venda ou vínculo.

## Testes

`npm test` inclui `tests/money.test.js`, que valida os cálculos em centavos e não precisa de banco.
