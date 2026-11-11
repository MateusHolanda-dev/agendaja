# Administração exclusiva da plataforma

Endereço: `/gestao`. O atalho **Administração da plataforma** aparece no menu do perfil apenas quando o banco confirma que a conta tem acesso. Visitantes usam a tela de login normal; contas autenticadas sem a liberação recebem “Página não encontrada”. O componente do painel é carregado somente após a verificação.

## Ativar sua conta

1. Crie sua conta normal no agendaJá e confirme seu e-mail.
2. No SQL Editor do seu projeto Supabase, execute uma única vez `supabase/migrations/202611110003_platform_admin.sql`. As migrations anteriores já precisam estar instaladas. Não execute novamente o instalador completo em um projeto existente.
3. Abra `supabase/ATIVAR_ADMIN.sql`, substitua `SEU_EMAIL_AQUI` pelo e-mail exato da sua conta e execute esse arquivo no SQL Editor.
4. Entre novamente no agendaJá e abra `/gestao`. No site publicado, o endereço é `https://agendaja-gestao-mateu.cladlace4.chatgpt.site/gestao`.

A primeira liberação exige acesso administrativo ao banco. Não há cadastro público, botão ou RPC que conceda esse privilégio. O script exige uma conta já existente com e-mail confirmado e impede a troca silenciosa de um administrador já configurado.

## Recursos

- Indicadores de todas as empresas, contas, clientes, profissionais e atendimentos.
- Consulta de empresas, contas, membros das equipes, serviços, profissionais, clientes e agendamentos.
- Consulta de expedientes, disponibilidade individual, bloqueios e vínculos de serviços.
- Busca, filtro por empresa, paginação e detalhes dos registros.
- Edição dos dados principais de empresas, profissionais, serviços e clientes.
- Edição de nome/telefone do perfil; os e-mails exibidos em Contas vêm do Supabase Auth.
- Alteração de status, recebimento e observações de agendamentos, além de reagendamento por instante com fuso. As regras de conflito e horário continuam aplicadas pelo banco.
- Suspensão e reativação de empresas: suspensão retira o acesso da equipe às APIs da empresa e desativa a página pública. O histórico próprio do cliente continua acessível a ele. Agendamentos existentes não são apagados nem cancelados automaticamente.
- Auditoria das alterações feitas neste painel, identificando autor, registro, campos e horário.

Os vínculos e papéis das equipes são consultáveis no painel da plataforma. Sua edição continua no fluxo autorizado do proprietário de cada estabelecimento. Senhas, tokens de autenticação e chaves secretas não são retornados pelas funções administrativas. Exclusões definitivas e processamento de cobranças não foram acrescentados.

## Como o acesso é protegido

`agendaja_private.platform_owner` aceita apenas um administrador. O schema privado não é exposto pela API e não concede privilégios às contas comuns. Ser proprietário ou administrador de um estabelecimento não concede administração da plataforma. Dados em `user_metadata`, parâmetros de URL e armazenamento do navegador não definem essa permissão.

Cada RPC confere novamente `auth.uid()`, o vínculo privado e a confirmação de e-mail. A interface não substitui a autorização. As consultas usam uma lista fixa de entidades, parâmetros SQL e limite máximo de 100 registros por página. Alterações aceitam apenas campos específicos, preservam os identificadores e vínculos entre empresas e geram auditoria na mesma transação.

Para revogar o acesso, o administrador do projeto pode executar no SQL Editor:

```sql
delete from agendaja_private.platform_owner where singleton;
```

Isso bloqueia imediatamente novas operações administrativas; não remove a conta normal nem os dados das empresas. Uma nova liberação continua exigindo o SQL Editor.

## Verificação

Os testes PostgreSQL/PGlite cobrem bloqueio de anônimos e contas comuns, tentativa de autopromoção, metadata adulterada, administrador único, confirmação de e-mail, leitura entre empresas, campos permitidos, auditoria e suspensão/reativação. Os testes de navegador cobrem invisibilidade para proprietário comum, bloqueio de conta sem liberação e o fluxo permitido com servidor simulado. A liberação e o login da conta real precisam ser verificados no projeto Supabase após executar os scripts.
