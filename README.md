# agendaJá

Plataforma em português brasileiro para agendamento e gestão de estabelecimentos, com painel da equipe, página pública e portal do cliente.

## Executar

Recomendado **Node.js 22 ou superior** (exigido pela versão do SDK Supabase). O build e os testes de regras também foram executados no Node 20.3.1 deste ambiente; os testes de navegador foram executados com Node 22.

```sh
npm install
npm run dev
```

Abra o endereço exibido pelo Vite, normalmente `http://127.0.0.1:5173`. `npm run build` gera a aplicação em `dist/`; `npm run preview` serve esse build.

## Experimentar agora

Sem as duas variáveis Supabase, o sistema entra em **modo de demonstração**. Na tela de login, escolha **Sou profissional** ou **Sou cliente**, depois **Explorar demonstração**. Os formulários de autenticação não simulam login nem envio de e-mail.

- `/login/profissional`: acesso da equipe, cadastro e recuperação de senha.
- `/login/cliente`: acesso do cliente.
- `/app`: visão geral.
- `/app/agenda`: calendário diário, semanal e mensal; criação e edição; status; recebimentos; WhatsApp manual.
- `/app/clientes`, `/app/profissionais`, `/app/servicos`: cadastros, busca, histórico, serviços habilitados e bloqueios de horários.
- `/app/relatorios`: resumo por período/profissional e exportação CSV.
- `/app/configuracoes`: empresa, expediente, política de cancelamento e link público.
- `/agendar/studio-aurora`: exemplo de página pública com cinco passos e arquivo de calendário.
- `/cliente`: próximos atendimentos, histórico, reagendamento, cancelamento e dados pessoais.

Os dados fictícios são gravados em `localStorage` (`agendaja-demo-v1`) e a conta demonstrativa em `sessionStorage`. Cada navegador possui sua própria cópia. **Não use dados pessoais reais na demonstração.** Para restaurar, abra o menu do perfil no painel e selecione “Restaurar demonstração”. Os controles de perfil da demonstração servem para experimentar a interface; a segurança de uso real é aplicada pelo banco.

## Conectar o Supabase

1. Crie um projeto Supabase e aplique `supabase/migrations/202611110001_initial.sql`. Consulte [supabase/README.md](supabase/README.md) para contratos, permissões e verificações.
2. Copie `.env.example` para `.env.local` e preencha:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-publicavel-ou-anon
```

3. Configure a URL da aplicação e as URLs de redirecionamento no Supabase Auth, incluindo `/cliente`, `/onboarding` e `/redefinir-senha`. Ative confirmação de e-mail e configure o SMTP de produção.
4. Reinicie o Vite ou refaça o build. O modo demonstrativo fica desativado quando as duas variáveis estão presentes. Variáveis `VITE_*` fazem parte do build; mudar somente variáveis do servidor após o build não altera o frontend.
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

Com `npm run dev` ativo em outro terminal e Microsoft Edge instalado:

```sh
npm run test:e2e
```

Para usar Chromium em outro sistema, ajuste `channel` em `playwright.config.ts` e instale o navegador com `npx playwright install chromium`. Os testes usam contas demonstrativas e dados isolados por contexto de navegador. As imagens e traces ficam em `test-results/`, fora do versionamento.

As verificações SQL foram executadas com PostgreSQL WASM/PGlite e `btree_gist`, simulando as estruturas Auth/Storage do Supabase. Essa execução não valida o serviço Auth/Storage hospedado, SMTP ou concorrência entre conexões reais.

## Limites desta entrega

É uma implementação integrada para experimentar e evoluir; **não está certificada para produção**. Sem configuração do Supabase, não há autenticação real, isolamento entre dispositivos ou sincronização. Antes de comercializar, aplique e valide o banco em ambiente real, exercite os quatro papéis, teste reservas simultâneas, configure recuperação de senha, monitoramento, backups, termos e política de privacidade e os procedimentos de acesso/exclusão de dados pessoais.

Pagamentos de assinatura, conciliação financeira, WhatsApp automatizado e PWA continuam fora do MVP. O indicador “recebido” corresponde à marcação manual de recebimento, não a uma integração bancária. Bloqueios permitem pausas e folgas por data; cada profissional pode seguir o expediente do estabelecimento ou usar horários semanais personalizados. Upload e remoção de logo estão disponíveis em Configurações. Convites automatizados de equipe por e-mail dependem de integração adicional.

Cada organização representa um estabelecimento nesta versão; filiais com operação independente podem usar organizações separadas. Não há cobrança recorrente implementada nem gestão comercial de planos. A publicação inicial privada apresenta a demonstração sem credenciais externas.
