# agendaJá

Plataforma em português brasileiro para negócios com hora marcada: salões, barbearias, estética, consultórios, aulas, consultorias, serviços para pets, oficinas e outros segmentos. Cada empresa mantém seus próprios serviços, profissionais, clientes e horários.

**Para conectar seu projeto, siga [CONECTAR_SUPABASE.md](CONECTAR_SUPABASE.md).** A versão publicada usa exclusivamente autenticação e dados reais. Sem conexão configurada, o login informa que o acesso ainda não foi ativado; não cria contas de amostra.

## Executar

Recomendado **Node.js 22 ou superior** (exigido pela versão do SDK Supabase). O build e os testes de regras também foram executados no Node 20.3.1 deste ambiente; os testes de navegador foram executados com Node 22.

```sh
npm install
npm run dev
```

Abra o endereço exibido pelo Vite, normalmente `http://127.0.0.1:5173`. `npm run build` gera a aplicação em `dist/`; `npm run preview` serve esse build.

## Rotas

- `/`: página institucional para diferentes segmentos.

- `/login/profissional`: acesso da equipe, cadastro e recuperação de senha.
- `/login/cliente`: acesso do cliente.
- `/app`: visão geral.
- `/app/agenda`: calendário diário, semanal e mensal; criação e edição; status; recebimentos; WhatsApp manual.
- `/app/clientes`, `/app/profissionais`, `/app/servicos`: cadastros, busca, histórico, serviços habilitados e bloqueios de horários.
- `/app/relatorios`: resumo por período/profissional e exportação CSV.
- `/app/configuracoes`: empresa, expediente, política de cancelamento e link público.
- `/agendar/seu-negocio`: página pública com cinco passos e arquivo de calendário.
- `/cliente`: próximos atendimentos, histórico, reagendamento, cancelamento e dados pessoais.

Dados de teste existem apenas para desenvolvimento e testes automatizados, com ativação explícita de `VITE_ENABLE_DEMO=true` no servidor de desenvolvimento. O build de publicação desativa esse modo, mesmo se a variável estiver ligada. Sessões fictícias antigas são ignoradas. Os dados de teste nunca são inseridos no Supabase.

## Conectar o Supabase

1. Crie um projeto Supabase e aplique todas as migrations de `supabase/migrations/` em ordem numérica. Se a primeira já foi aplicada, execute somente as novas. Consulte [supabase/README.md](supabase/README.md) para contratos, permissões e verificações.
2. Copie `.env.example` para `.env.local` e preencha:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-publicavel-ou-anon
```

3. Configure a URL da aplicação e as URLs de redirecionamento no Supabase Auth, incluindo `/cliente`, `/onboarding` e `/redefinir-senha`. Ative confirmação de e-mail e configure o SMTP de produção.
4. Reinicie o Vite ou refaça o build. Variáveis `VITE_*` fazem parte do build; mudar somente variáveis do servidor após o build não altera o frontend. Nenhum acesso fictício é oferecido quando a conexão está ausente.
5. Cadastre uma conta profissional, confirme o e-mail e conclua o onboarding. Cadastre os serviços e profissionais e vincule os serviços oferecidos. Compartilhe o endereço público do estabelecimento.

**Nunca use `service_role` no frontend.** A chave pública não substitui as políticas RLS. O banco valida reservas, relacionamentos e papéis. O catálogo público não retorna dados de clientes. A reserva real exige conta com e-mail confirmado, e o servidor mantém o usuário como proprietário dos próprios atendimentos.

O cadastro de um profissional da agenda não cria automaticamente um login nem envia convite. O proprietário pode vincular contas com e-mail confirmado em Configurações → Acesso e assinatura, escolhendo o papel e o profissional correspondente. A operação é validada no banco; não envia convites. Convites automatizados por e-mail ainda não estão implementados.

## Organização

```text
src/
  components/ui.tsx    # componentes compartilhados, diálogo Radix, variantes shadcn
  lib/types.ts        # contratos do domínio
  lib/store.tsx       # sessão, permissões de interface e operações
  lib/repository.ts   # adaptação de dados e chamadas Supabase
  lib/scheduling.ts   # regras e disponibilidade da demonstração
  pages/              # autenticação, gestão, agenda, reservas e cliente
supabase/             # migrations, contratos e testes de integração
tests/                # testes de navegador
```

React + TypeScript + Vite, Tailwind CSS, componentes com Radix/shadcn, Lucide, TanStack Query, React Hook Form + Zod, date-fns e Recharts. Temas claro/escuro no painel; componentes responsivos; formulários com tratamento de erros e estados vazios.

## Verificar

```sh
npm test
npm run build
npm audit
```

Com Node 22 e Microsoft Edge instalado:

```sh
npm run test:e2e
```

Os testes iniciam e encerram seus próprios servidores nas portas 5175 e 4175. Não é necessário manter o servidor de desenvolvimento aberto. Eles validam tanto os fluxos isolados com fixtures quanto o build publicado, sem amostras nem acesso por sessões fictícias. Para usar Chromium em outro sistema, ajuste `channel` em `playwright.config.ts` e instale o navegador com `npx playwright install chromium`. As imagens e traces ficam em `test-results/`, fora do versionamento.

As verificações SQL foram executadas com PostgreSQL WASM/PGlite e `btree_gist`, simulando as estruturas Auth/Storage do Supabase. Essa execução não valida o serviço Auth/Storage hospedado, SMTP ou concorrência entre conexões reais.

## Limites desta entrega

**A ativação operacional depende do Supabase e da validação no ambiente real.** Sem configuração, o acesso permanece indisponível. Antes de comercializar, aplique e valide o banco em ambiente real, exercite os quatro papéis, teste reservas simultâneas, configure recuperação de senha, monitoramento, backups, termos e política de privacidade e os procedimentos de acesso/exclusão de dados pessoais.

Pagamentos de assinatura, conciliação financeira, WhatsApp automatizado e PWA continuam fora do MVP. O indicador “recebido” corresponde à marcação manual de recebimento, não a uma integração bancária. Bloqueios permitem pausas e folgas por data; cada profissional pode seguir o expediente do estabelecimento ou usar horários semanais personalizados. Upload e remoção de logo estão disponíveis em Configurações. Convites automatizados de equipe por e-mail dependem de integração adicional.

Cada organização representa um estabelecimento nesta versão; filiais com operação independente podem usar organizações separadas. Não há cobrança recorrente implementada nem gestão comercial de planos. A hospedagem permanece privada até uma mudança explícita de acesso.
