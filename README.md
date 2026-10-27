# AutoCar

Login e dashboard implementados em JavaScript e Node.js, usando `desenvweb2026/` como referência de Express, Sequelize/PostgreSQL, bcrypt e JWT. A referência foi preservada. Os arquivos do projeto estão em `backend/`, `frontend/` e `database/` na raiz do AutoCar.

O frontend mantém os arquivos HTML/CSS/JavaScript já previstos no AutoCar e é servido pelo próprio Node.js. Não precisa iniciar um segundo servidor para a interface.

## Executar

Pré-requisitos: Node.js 22 ou superior, npm e PostgreSQL.

Na pasta `AutoCar`:

```bash
npm install
npm run setup
```

O comando `setup` cria `backend/.env` com uma chave JWT aleatória e não substitui uma configuração existente. Ajuste `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` e `DB_NAME` para seu PostgreSQL. Também é possível definir `DATABASE_URL`.

Crie um banco vazio chamado `autocar` no PostgreSQL (por exemplo, `createdb -h localhost -U postgres autocar`). Depois:

```bash
npm run db:setup
npm start
```

Abra **http://localhost:8080**. O comando de preparação cria a tabela de usuários e o administrador configurado no `.env`. Execute-o também ao atualizar uma instalação anterior. Não apaga dados e não troca a senha de um usuário já existente.

Credenciais locais iniciais, com os valores do `.env.example`:

- E-mail: `admin@localhost`
- Senha: `admin123`

Esses valores são exclusivos de desenvolvimento. Configure credenciais próprias antes de usar um ambiente publicado. O comando de preparação recusa a senha de exemplo em produção.

Para reiniciar automaticamente o Node.js durante o desenvolvimento: `npm run dev`.

### PostgreSQL local opcional

Se o PostgreSQL estiver instalado mas não houver um serviço configurado, execute `npm run db:local` após configurar `backend/.env`. O comando cria um banco de desenvolvimento isolado em `.local/postgres`, exige senha e escuta somente em `127.0.0.1`. Não altera o serviço PostgreSQL do sistema. Usa `pg_config --bindir` para encontrar os executáveis; alternativamente, configure `PG_BIN`.

Nesta configuração, use uma porta livre (por exemplo, `DB_PORT=5433`), `DB_USER=autocar` e uma senha própria em `DB_PASSWORD`. O banco persiste em `.local/` e pode ser iniciado novamente pelo mesmo comando. Depois, execute `npm run db:setup` e `npm start`. Para pará-lo em Linux: `"$(pg_config --bindir)/pg_ctl" -D .local/postgres stop`.

## Fluxo do login

- `POST /api/auth/login`: recebe `{ "login": "email", "senha": "senha" }` ou `{ "email": "email", "senha": "senha" }`. Retorna JWT Bearer e os dados públicos do usuário.
- `GET /api/auth/me`: recebe `Authorization: Bearer <token>`, valida assinatura/expiração e consulta o usuário no banco.
- A tela de login mostra erros de validação, credenciais incorretas e falhas de conexão. O botão de envio evita solicitações duplicadas.
- A página `frontend/pages/admin/dashboard.html` reproduz o dashboard administrativo do wireframe. O painel só é exibido após a API validar a sessão e confirmar o perfil ADMIN. O nome e o perfil vêm da conta autenticada. Os indicadores, vendas, veículos e gráfico são exemplos do wireframe, identificados na tela. A conta autenticada vem do banco de dados.
- Por padrão, o token fica em `sessionStorage`. A opção **Lembrar-me** utiliza `localStorage`. Ambos mantêm a sessão ao recarregar a página; o JWT vence em duas horas por padrão. **Sair** apaga o token do navegador. Uma cópia do token permanece válida até a expiração ou exclusão da conta.
- A página revalida a sessão ao abrir, ao usar o botão Voltar e quando outra aba modifica o token persistente. Um erro de rede permite tentar novamente sem exibir dados da conta.
- Senhas ficam somente como hash bcrypt. As respostas de login não diferenciam usuário inexistente de senha incorreta. Tentativas malsucedidas são limitadas por IP.

O `.env` e os dados locais em `.local/` são ignorados pelo Git. Os demais módulos administrativos e o cadastro público não estão implementados.

## Testes

Os testes usam um PostgreSQL real e criam um schema temporário exclusivo, removido ao final. Informe uma conexão destinada a testes:

```bash
TEST_DATABASE_URL=postgres://usuario:senha@localhost:5432/autocar_test npm test
```

Cobrem login, validação de campos, bcrypt, JWT, consulta da conta no banco, exclusão de conta, proteção de arquivos e limite de tentativas. Não dependem de mock da autenticação ou do banco.

## Referência preservada

O antigo `backend/package.json` continha comandos MongoDB sem relação com a configuração Node.js. O conteúdo original está preservado em `docs/referencias/package-original.mongodb.js`; o arquivo `package.json` foi corrigido para permitir instalar e executar o backend.

## Modelo visual

As telas de login e dashboard seguem os modelos do `docs/wireframes/WireFrame_AutoCar.pdf`. Foram reproduzidos a identidade vermelha e azul-escura, a foto do carro, os textos, a disposição do formulário, o menu lateral, os cartões, a tabela e o gráfico. A foto e as miniaturas foram extraídas do PDF; as fontes Inter e Barlow Condensed são servidas localmente e suas licenças estão em `frontend/assets/fonts/`.

A autenticação continua real: a nota de demonstração do wireframe não permite entrar sem credenciais. Recuperação de senha, solicitação de conta e as outras opções fora do escopo mostram informações em uma caixa de diálogo; não simulam operações de cadastro ou envio de e-mail. O escopo desta versão inclui login e dashboard.
