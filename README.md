# AutoCar

Login e CRUDs de Usuários e Veículos implementados em JavaScript e Node.js, usando `desenvweb2026/` como referência de Express, Sequelize/PostgreSQL, bcrypt e JWT. A referência foi preservada. Os arquivos do projeto estão em `backend/`, `frontend/` e `database/` na raiz do AutoCar.

O frontend mantém os arquivos HTML/CSS/JavaScript já previstos no AutoCar e é servido pelo próprio Node.js. Não precisa iniciar um segundo servidor para a interface.

## Executar

Pré-requisitos: Node.js 22 ou superior, npm e PostgreSQL.

Na pasta `AutoCar`:

```bash
npm install
npm run setup
```

O comando `setup` cria `backend/.env` com uma chave JWT aleatória e não substitui uma configuração existente. Ajuste `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` e `DB_NAME` para seu PostgreSQL. Também é possível definir `DATABASE_URL`.

Escolha a opção de PostgreSQL que corresponde ao seu `backend/.env`:

- **Banco local do projeto:** com `DB_HOST=127.0.0.1`, `DB_PORT=5433`, `DB_USER=autocar`, `DB_NAME=autocar` e uma senha própria em `DB_PASSWORD`, execute `npm run db:local`. Esse comando inicia o PostgreSQL isolado em `.local/postgres` e cria o banco `autocar` se necessário. Não é preciso executar `createdb`. Se esse banco já foi configurado, preserve a senha existente no `.env`.
- **PostgreSQL do sistema ou outro servidor:** configure o `.env` com o host, porta, usuário e senha reais desse servidor e crie o banco vazio se ele ainda não existir. Por exemplo, `createdb -h 127.0.0.1 -p 5432 -U postgres autocar` só se aplica a uma instalação que usa a porta `5432` e o usuário `postgres`. A senha solicitada é a desse usuário no PostgreSQL; não é a senha do Linux nem a do login do AutoCar. Alterar `DB_PASSWORD` no `.env` não altera a senha cadastrada no PostgreSQL.

Com o banco disponível, execute:

```bash
npm run db:setup
npm start
```

Abra **http://localhost:8080**. O comando de preparação cria/atualiza as tabelas de usuários e veículos, as opções iniciais de marcas/categorias e o administrador configurado no `.env`. Execute-o também ao atualizar uma instalação anterior. Não apaga dados e não troca a senha de um usuário já existente.

Credenciais locais iniciais, com os valores do `.env.example`:

- E-mail: `admin@localhost`
- Senha: `admin123`

Esses valores são exclusivos de desenvolvimento. Configure credenciais próprias antes de usar um ambiente publicado. O comando de preparação recusa a senha de exemplo em produção.

Para reiniciar automaticamente o Node.js durante o desenvolvimento: `npm run dev`.

### PostgreSQL local opcional

Se preferir um banco separado para o projeto, execute `npm run db:local` após configurar `backend/.env`. É necessário ter os executáveis do PostgreSQL instalados. O comando cria um banco de desenvolvimento isolado em `.local/postgres`, exige senha e escuta somente em `127.0.0.1`. Pode coexistir com o serviço PostgreSQL do sistema, usando outra porta, sem alterar esse serviço. Usa `pg_config --bindir` para encontrar os executáveis; alternativamente, configure `PG_BIN`.

Nesta configuração, use uma porta livre (por exemplo, `DB_PORT=5433`), `DB_USER=autocar` e uma senha própria em `DB_PASSWORD`. O banco persiste em `.local/` e pode ser iniciado novamente pelo mesmo comando. Depois, execute `npm run db:setup` e `npm start`. Para pará-lo em Linux: `"$(pg_config --bindir)/pg_ctl" -D .local/postgres stop`.

## Cadastro e login

- Na tela de login, **Criar uma conta** abre `/pages/cadastro.html`, seguindo o formulário do wireframe: nome, CPF, telefone, e-mail, senha, confirmação e aceite dos termos/privacidade. Após salvar, a confirmação aparece no login; entre com o e-mail e a senha escolhidos.
- `POST /api/auth/register`: recebe `nome`, `cpf`, `telefone`, `email`, `senha`, `confirmar_senha` e `aceite_termos: true`. Cria uma conta ativa do tipo `USUARIO` (Cliente), independentemente de qualquer perfil enviado pelo navegador. Valida CPF, telefone, e-mail, senha de 8 a 72 bytes e confirmação; e-mail e CPF são únicos. Responde com os dados públicos da conta, sem senha ou token. Há limite de 20 tentativas por hora por IP.
- O cadastro registra a data do aceite e a versão `1` dos textos exibidos. Ao atualizar uma instalação, execute `npm run db:setup` para adicionar essas colunas sem remover usuários ou trocar senhas existentes.
- `POST /api/auth/login`: recebe `{ "login": "email", "senha": "senha" }` ou `{ "email": "email", "senha": "senha" }`. Retorna JWT Bearer e os dados públicos do usuário.
- `GET /api/auth/me`: recebe `Authorization: Bearer <token>`, valida assinatura/expiração e consulta o usuário no banco.
- A tela de login mostra erros de validação, credenciais incorretas e falhas de conexão. O botão de envio evita solicitações duplicadas.
- Após o login, clientes acessam `/pages/conta.html`, com nome, e-mail e saída da sessão. Administradores continuam no dashboard. A área de cliente consulta `/api/auth/me` e não concede acesso às APIs administrativas.
- A página `frontend/pages/admin/dashboard.html` reproduz o dashboard administrativo do wireframe. O painel só é exibido após a API validar a sessão e confirmar o perfil ADMIN. O nome e o perfil vêm da conta autenticada. Todos os indicadores, listas e gráficos consultam os registros reais do banco. O painel mostra total de veículos, disponíveis, reservados, vendidos por status, clientes cadastrados e valor do estoque disponível/reservado. As listas exibem os últimos clientes e veículos cadastrados. O gráfico conta cadastros reais de veículos e clientes nos últimos 12 meses, no horário de Brasília; meses sem cadastros ficam com zero. Não há vendas ou serviços fictícios. Usuários e Veículos abrem os CRUDs completos; os outros módulos continuam separados.
- Por padrão, o token fica em `sessionStorage`. A opção **Lembrar-me** utiliza `localStorage`. Ambos mantêm a sessão ao recarregar a página; o JWT vence em duas horas por padrão. **Sair** apaga o token do navegador. Alterar senha, e-mail, perfil ou status invalida os tokens anteriores dessa conta. Sair encerra a sessão do navegador; uma cópia do token só perde a validade por expiração, exclusão, desativação ou mudança de dados de acesso.
- A página revalida a sessão ao abrir, ao usar o botão Voltar e quando outra aba modifica o token persistente. Um erro de rede permite tentar novamente sem exibir dados da conta.
- Senhas ficam somente como hash bcrypt. As respostas de login não diferenciam usuário inexistente de senha incorreta. Tentativas malsucedidas são limitadas por IP.

O dashboard consulta `/api/painel`, com autenticação e perfil ADMIN. Cada consulta usa uma visão consistente do banco. Atualiza ao abrir a página, ao retornar à aba e pelo botão **Atualizar dados**, mostrando a data da última consulta. Falhas de atualização são informadas sem substituir dados reais por números de exemplo. Clientes são contas `USUARIO`, incluindo cadastros públicos; administradores não entram nessa contagem. O valor do estoque exclui veículos vendidos, e o status Vendido não é apresentado como transação financeira. O gráfico considera os registros ainda existentes pela data de criação; excluir um registro também o retira do gráfico. Uma tabela expansível permite consultar os valores exatos de cada mês.

O `.env` e os dados locais em `.local/` são ignorados pelo Git. Os módulos de vendas e serviços não estão implementados. Clientes/Leads e Avaliação de Veículos aparecem apenas como opções informativas no dashboard.

## Perfil e configurações

No topo das telas administrativas, clique no seu nome/avatar para abrir **Meu perfil** (`/pages/admin/perfil.html`). É possível atualizar nome, e-mail e senha, sempre confirmando a senha atual. Senha nova em branco preserva a atual. E-mail ou senha alterados invalidam todas as sessões e exigem novo login. Uma mudança apenas de nome mantém o acesso e atualiza a identificação exibida.

Em **Configurações** (`/pages/admin/configuracoes.html`), escolha o tema Claro ou Escuro. A preferência é salva no navegador (`autocar.theme`) e aplicada ao login, cadastro, conta, dashboard, listas e formulários. Também é possível encerrar todas as sessões ou encerrar a própria conta, com senha atual e confirmação. Encerrar a conta significa desativar o acesso, preservando os registros; a reativação é feita por outro administrador. O último administrador ativo não pode encerrar sua conta.

Os endpoints autenticados são `GET/PUT /api/auth/profile`, `POST /api/auth/logout-all` e `POST /api/auth/close-account`. As alterações recebem `senha_atual` e `versao`; o perfil recebe `nome`, `email` e, opcionalmente, `nova_senha` e `confirmar_senha`. Para encerrar a conta, envie também `confirmacao: "ENCERRAR"`. O usuário é identificado pela sessão, e campos enviados como id, perfil ou status não mudam o alvo nem as permissões. Operações concorrentes preservam um administrador ativo.

A navegação administrativa fica centralizada em `frontend/js/admin/navigation.js`. Clientes/Leads e Avaliação de Veículos continuam sendo etapas informativas da Isadora e aparecem em todas as telas administrativas, sem CRUD próprio.

Se o terminal mostrar `EADDRINUSE`, já há um processo usando a porta 8080. Evite iniciar uma segunda instância. Para parar o servidor no terminal em que foi iniciado, use **Ctrl+C**; **Ctrl+Z** apenas o suspende e mantém a porta ocupada. Um processo suspenso pode voltar ao primeiro plano com `fg` para então ser encerrado com Ctrl+C.

## Testes

Os testes usam um PostgreSQL real e criam um schema temporário exclusivo, removido ao final. Informe uma conexão destinada a testes:

```bash
TEST_DATABASE_URL=postgres://usuario:senha@localhost:5432/autocar_test npm test
```

Cobrem dashboard vazio, totais por status, soma decimal do estoque, agrupamento mensal e limites de data em Brasília, atualização após alterações/exclusões, cadastro público, confirmação de senha, aceite, tentativas de elevação de privilégio, cadastros simultâneos, login, JWT, operações completas dos CRUDs, permissões, CPF/e-mail duplicados, contas inativas, invalidação de sessões, edição concorrente, proteção dos administradores, filtros/paginação, valores decimais, fotos inválidas/grandes e limpeza das imagens excluídas. Não dependem de mock da autenticação ou do banco.

## Referência preservada

O antigo `backend/package.json` continha comandos MongoDB sem relação com a configuração Node.js. O conteúdo original está preservado em `docs/referencias/package-original.mongodb.js`; o arquivo `package.json` foi corrigido para permitir instalar e executar o backend.

## Modelo visual

As telas de login, cadastro, dashboard e CRUDs seguem os modelos do `docs/wireframes/WireFrame_AutoCar.pdf`. Foram reproduzidos a identidade vermelha e azul-escura, a foto do carro, os textos, a disposição do formulário, o menu lateral, os cartões, a tabela e o gráfico. A foto e as miniaturas foram extraídas do PDF; as fontes Inter e Barlow Condensed são servidas localmente e suas licenças estão em `frontend/assets/fonts/`.

A autenticação continua real: a nota de demonstração do wireframe não permite entrar sem credenciais. O cadastro público salva a conta no PostgreSQL. Recuperação de senha e as outras opções fora do escopo mostram informações em uma caixa de diálogo; não simulam envio de e-mail. O escopo inclui cadastro, login, dashboard e os CRUDs de Usuários e Veículos atribuídos ao Clemer. As opções de Marcas e Categorias fornecem dados para o formulário de veículo, mas não possuem CRUD próprio nesta etapa.

## CRUDs do Clemer

No menu administrativo, acesse **Usuários** ou **Veículos**. As duas telas têm busca, filtros, paginação, consulta, cadastro, edição e exclusão com confirmação. Os registros são persistidos no PostgreSQL e não há preenchimento automático com usuários ou veículos fictícios.

- Usuários: nome, CPF válido/único, telefone com DDD, e-mail único, senha bcrypt, tipo Cliente/Administrador e status Ativo/Inativo. Na edição, senha em branco preserva a senha atual. A conta inicial pode ter CPF/telefone vazios porque foi criada antes do CRUD; complete esses campos para editar seu cadastro.
- Apenas administradores acessam as APIs dos CRUDs. Uma conta inativa não autentica. Não é possível excluir/desativar a própria conta administrativa ou remover seu próprio perfil ADMIN. Alterações simultâneas são serializadas para não eliminar todos os administradores.
- Veículos: marca, modelo, categoria, ano, quilometragem, preço com duas casas, combustível, câmbio, cor, status e descrição. Os relacionamentos com marca/categoria são validados no banco.
- Fotos: principal opcional e até seis imagens de galeria, JPG/PNG/WEBP com até 5 MB por arquivo. O servidor valida o conteúdo real, reencoda em WEBP e salva em `.local/uploads`. Ao remover/substituir fotos ou excluir o veículo, os arquivos correspondentes são removidos. As fotos de veículos são públicas em `/media/<uuid>.webp`; criar ou alterar requer ADMIN.
- Os formulários enviam a versão do registro. Se outra pessoa o alterar antes do salvamento, a API retorna conflito em vez de sobrescrever silenciosamente.

Os endpoints e exemplos de payload estão em `docs/cruds-clemer.md`.
