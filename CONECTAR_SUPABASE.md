# Conectar o agendaJá ao seu Supabase

## 1. Copiar os dados públicos

Abra seu projeto em https://supabase.com/dashboard e clique em **Connect**. Copie **Project URL** e **Publishable key**. Se estiver usando chaves antigas, a chave equivalente é `anon`. Também é possível consultar as chaves em **Settings → API Keys**.

Não use uma chave `secret` nem `service_role` na aplicação web.

## 2. Criar o arquivo local

No VS Code, abra a pasta `C:\Users\mateu\Desktop\AgendaJá\agendaja`. Crie `.env.local` ao lado do `package.json`, com este conteúdo, substituindo os valores:

```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=SUA_CHAVE_PUBLICA
VITE_ENABLE_DEMO=false
```

Para a chave antiga `anon`, também aceitamos o nome `VITE_SUPABASE_ANON_KEY`. Variáveis `NEXT_PUBLIC_*` são para Next.js e não são utilizadas por esta aplicação Vite. O arquivo deve se chamar `.env.local`, sem `.txt`. Ele já está excluído do Git.

## 3. Criar as tabelas e regras

No Supabase, abra **SQL Editor → New query**. Abra, copie e execute o conteúdo completo de cada arquivo, nesta ordem:

1. `supabase/migrations/202611110001_initial.sql`
2. `supabase/migrations/202611110002_business_industries.sql`

Cada migration é aplicada uma única vez. Se a primeira já foi aplicada com sucesso, execute somente a segunda. A primeira cria as tabelas, funções, permissões e armazenamento de logos; a segunda acrescenta os segmentos de negócio e atualiza o cadastro da empresa. Elas não inserem clientes, profissionais ou serviços fictícios.

## 4. Configurar o login

Em **Authentication → URL Configuration**, para testar localmente use:

**Site URL:** `http://127.0.0.1:5173`

Adicione estas **Redirect URLs**:

```text
http://127.0.0.1:5173/cliente
http://127.0.0.1:5173/onboarding
http://127.0.0.1:5173/redefinir-senha
```

Use o mesmo endereço no navegador. `localhost` e `127.0.0.1` são endereços diferentes para os redirecionamentos; se usar `localhost`, adicione as três URLs equivalentes. Se a porta for outra, ajuste as URLs.

Mantenha o provedor Email habilitado e a confirmação de e-mail ativada. Para receber confirmações e recuperação de senha com usuários reais, configure **SMTP próprio** no Supabase. O serviço padrão de envio do Supabase tem restrições e não deve ser usado como serviço comercial de e-mail.

## 5. Reiniciar e criar sua conta

No PowerShell:

```powershell
cd "C:\Users\mateu\Desktop\AgendaJá\agendaja"
npm run dev
```

Se já estiver rodando, pressione `Ctrl+C` e execute de novo. Abra a URL exibida pelo Vite.

Entre em **Sou profissional → Comece por aqui** ou no botão de criar conta da página inicial. Cadastre uma conta, confirme o e-mail e escolha nome, segmento e endereço do negócio. A empresa começa vazia: cadastre seus serviços e seus profissionais, marque os serviços oferecidos por cada profissional e confira os horários.

Crie uma conta de cliente com outro e-mail para testar uma reserva pelo link público. Confira no painel se a reserva aparece e teste cancelamento e reagendamento.

## 6. Conectar o site publicado

O `.env.local` só configura a aplicação local. O site publicado precisa de um novo build com os mesmos valores públicos. Nunca envie a chave `service_role` para esse build.

Ao ativar a versão publicada, altere **Site URL** para:

```text
https://agendaja-gestao-mateu.cladlace4.chatgpt.site
```

Acrescente em **Redirect URLs**:

```text
https://agendaja-gestao-mateu.cladlace4.chatgpt.site/cliente
https://agendaja-gestao-mateu.cladlace4.chatgpt.site/onboarding
https://agendaja-gestao-mateu.cladlace4.chatgpt.site/redefinir-senha
```

O acesso à hospedagem continua privado enquanto não for alterado explicitamente. Isso é independente do login Supabase da aplicação. Para atender clientes externos, a hospedagem também precisa permitir o acesso deles.

## Se aparecer um erro

- **Acesso ainda não ativado:** confira o nome do arquivo `.env.local`, as duas variáveis e reinicie o Vite.
- **Tabela ou função inexistente:** confira se as duas migrations foram executadas no mesmo projeto informado no arquivo.
- **E-mail não chega:** confira spam, confirmação de e-mail e configuração SMTP. Não desative a confirmação: a reserva pública real exige conta confirmada.
- **Link abre no endereço errado:** confira Site URL e Redirect URLs.
- **Sem horários disponíveis:** cadastre um serviço ativo e um profissional ativo habilitado para ele; confira dias, duração, horários e bloqueios.

Referências oficiais: [chaves de API](https://supabase.com/docs/guides/getting-started/api-keys), [redirecionamentos](https://supabase.com/docs/guides/auth/redirect-urls), [SMTP](https://supabase.com/docs/guides/auth/auth-smtp).
