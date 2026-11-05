# CRUDs do Clemer — Usuários e Veículos

Todas as rotas abaixo exigem `Authorization: Bearer <token>` e um usuário ativo com perfil `ADMIN`. As telas usam HTML/CSS/JavaScript e a API usa Node.js, Express, Sequelize e PostgreSQL, seguindo `desenvweb2026/`.

## Preparação e atualização

Na raiz `AutoCar`, execute `npm install`, configure `backend/.env` e rode `npm run db:setup`. O comando cria as tabelas e aplica as novas colunas sem apagar usuários ou redefinir senhas existentes. As opções iniciais de marcas e categorias são inseridas sem duplicação. Em seguida, execute `npm start`.

As telas são `/pages/admin/usuarios.html` e `/pages/admin/veiculos.html`, acessíveis pelo menu após o login. O administrador inicial permanece `admin@localhost` / `admin123` quando usados os valores locais de exemplo.

## Rotas

| Método | Rota | Resultado |
| --- | --- | --- |
| GET | `/api/usuarios` | Usuários, com pesquisa e paginação |
| GET | `/api/usuarios/:id` | Dados públicos de um usuário, sem senha/hash |
| POST | `/api/usuarios` | Cria usuário; retorna 201 |
| PUT | `/api/usuarios/:id` | Atualiza o cadastro completo |
| DELETE | `/api/usuarios/:id` | Exclui; retorna 204 |
| GET | `/api/veiculos` | Veículos com marca/categoria e paginação |
| GET | `/api/veiculos/opcoes` | Opções de marcas e categorias |
| GET | `/api/veiculos/:id` | Dados e fotos de um veículo |
| POST | `/api/veiculos` | Cria; aceita JSON ou multipart/form-data |
| PUT | `/api/veiculos/:id` | Atualiza; aceita JSON ou multipart/form-data |
| DELETE | `/api/veiculos/:id` | Exclui o registro e limpa suas fotos |
| GET | `/api/painel` | Totais reais e últimos veículos |

As listagens retornam `{ items, total, page, limit, pages }`. `page` começa em 1; `limit` aceita de 1 a 100. O padrão é 5 usuários ou 8 veículos por página.

Filtros de usuários: `q` (nome/e-mail), `tipo=ADMIN|USUARIO`, `status=ATIVO|INATIVO`.

Filtros de veículos: `q` (modelo/marca), `marca_id`, `categoria_id`, `status=DISPONIVEL|RESERVADO|VENDIDO`.

## Usuários

Payload de criação/edição:

```json
{
  "nome": "Pessoa de exemplo",
  "email": "pessoa@exemplo.local",
  "cpf": "90000070114",
  "telefone": "11999991234",
  "senha": "senha-de-exemplo",
  "tipo": "USUARIO",
  "ativo": true
}
```

O CPF acima é um dado fictício de teste. CPF e telefone aceitam máscara e são armazenados apenas como dígitos. CPF passa pela validação dos dígitos verificadores; CPF e e-mail são únicos. O e-mail é normalizado em minúsculas. `tipo` aceita `ADMIN` ou `USUARIO`; a interface exibe Administrador/Cliente.

A senha tem pelo menos 8 caracteres e no máximo 72 bytes, e é armazenada com bcrypt. Na edição, `senha: ""` ou ausência de senha mantém o hash atual. Nenhuma resposta do CRUD retorna a senha, o hash ou a versão interna da sessão. Para evitar substituição de uma edição concorrente, envie também `versao`, retornada na consulta.

Não é permitido excluir/desativar a própria conta administrativa nem retirar o próprio perfil ADMIN. Alterações são serializadas e revalidam o administrador dentro da transação. Alterar senha/e-mail/perfil/status revoga tokens anteriores; excluir ou desativar uma conta bloqueia a sessão imediatamente.

## Veículos

```json
{
  "marca_id": 1,
  "categoria_id": 1,
  "modelo": "Modelo de exemplo",
  "ano": 2024,
  "quilometragem": 12500,
  "preco": "178990.50",
  "combustivel": "Flex",
  "cambio": "Automático",
  "cor": "Preto",
  "status": "DISPONIVEL",
  "descricao": "Descrição do veículo"
}
```

Consulte os IDs em `/api/veiculos/opcoes`. O ano vai de 1886 até o ano atual + 1; quilometragem não pode ser negativa. O preço deve ser maior que zero e ter até duas casas decimais, usando ponto no JSON. Combustível: Gasolina, Etanol, Flex, Diesel, Elétrico ou Híbrido. Câmbio: Manual, Automático ou CVT. Informe `versao` na edição para detectar conflitos.

No multipart, os campos de texto são os mesmos. `foto` recebe a foto principal e `galeria` recebe até seis arquivos. Cada imagem deve ser JPG, PNG ou WEBP estático, ter no máximo 5 MB e até 20 milhões de pixels. O servidor valida o conteúdo, remove metadados ao reencodar e gera nomes UUID em WEBP. As imagens ficam em `.local/uploads` e podem ser lidas publicamente por `/media/<uuid>.webp`, para exibição do veículo.

Na edição, as fotos existentes são preservadas por padrão. `remover_foto=true` remove a principal. `galeria_manter` aceita uma lista JSON apenas de fotos já pertencentes àquele veículo. Novas fotos podem ser enviadas junto. O formulário gerencia esses campos automaticamente.

## Respostas de erro

- 400: dados inválidos ou referência de marca/categoria inexistente.
- 401: sessão ausente, expirada, revogada ou conta inativa/excluída.
- 403: usuário sem perfil de administrador.
- 404: registro inexistente.
- 409: CPF/e-mail duplicado, edição concorrente ou tentativa de excluir/desativar/rebaixar a própria conta.
- 413: foto maior que 5 MB.

Erros usam `{ "message": "explicação" }`. A interface mantém os dados preenchidos quando o salvamento falha e pede confirmação antes da exclusão.

## Escopo e testes

Marcas e categorias são somente referências para o cadastro; seus CRUDs, vendas e serviços não fazem parte da tarefa do Clemer. O estoque, os clientes e os últimos veículos do dashboard vêm do banco; vendas, serviços e gráfico continuam identificados como exemplos do wireframe.

Execute a suíte com um PostgreSQL de testes:

```bash
TEST_DATABASE_URL=postgres://usuario:senha@localhost:5432/autocar_test npm test
```

Os testes criam schemas e imagens temporários exclusivos e limpam esses recursos ao terminar. Não apagam dados do banco principal.
