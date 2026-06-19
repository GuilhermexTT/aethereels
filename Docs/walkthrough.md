# Walkthrough - Segurança e Controle de Créditos do AetherReels

Consolidamos a base de segurança e isolamento de dados do AetherReels por meio da criação de perfis específicos de créditos no Supabase e da trava server-side em rotas de API.

---

## 🛠️ Alterações Efetuadas

### 1. Migração no Supabase (SQL)
Criamos a migração em [20260618000000_create_profiles.sql](file:///c:/Users/Guilherme%20Gutil%C3%A3o/Desktop/Meus%20Desenvolvimentos/AetherNetwork/supabase/migrations/20260618000000_create_profiles.sql) que:
* **Cria a tabela `profiles`**: Contém `id` (vinculado a `auth.users`), `email` e `credits` (padrão de 5 para novos usuários).
* **Ativa RLS e Políticas**: Habilita Row Level Security e cria políticas onde usuários autenticados só podem visualizar (`SELECT`) e atualizar (`UPDATE`) sua própria linha de perfil.
* **Cria RPC de débito atômico (`decrement_profile_credits`)**: Função em PL/pgSQL executada com `SECURITY DEFINER` para realizar o débito direto no banco com integridade transacional.
* **Backfill automático**: Copia todos os dados de usuários e saldos da antiga tabela `users` para `profiles` automaticamente.

### 2. Trava Server-Side na API de Geração
Atualizamos a rota em [route.ts](file:///c:/Users/Guilherme%20Gutil%C3%A3o/Desktop/Meus%20Desenvolvimentos/AetherNetwork/src/app/api/video/generate/route.ts) para aplicar o fluxo de verificação:
* Recupera o usuário atual logado via `supabase.auth.getUser()`.
* Busca seu registro em `profiles` (se for novo usuário, auto-cria um com 5 créditos).
* **Verificação de saldo**: Realiza um curto-circuito e retorna um erro `403 Forbidden` se o saldo for `<= 0`.
* **Inserção e Integração**: Insere o job na tabela `video_jobs` com status `pending` e dispara a integração com o n8n.
* **Débito pós-sucesso**: Caso a requisição ao n8n seja bem-sucedida, invoca a RPC `decrement_profile_credits` para debitar atomicamente 1 crédito. Se a requisição falhar, o job é atualizado para `failed` e nenhum crédito é debitado.

### 3. Ajuste de Fallback nos Componentes e Rotas
Ajustamos as referências da tabela antiga `users` para a nova tabela `profiles` nos fluxos de fallback local de desenvolvimento:
* Na rota de download em [route.ts](file:///c:/Users/Guilherme%20Gutil%C3%A3o/Desktop/Meus%20Desenvolvimentos/AetherNetwork/src/app/api/video/download/route.ts#L45)
* Na página de histórico de vídeos em [page.tsx](file:///c:/Users/Guilherme%20Gutil%C3%A3o/Desktop/Meus%20Desenvolvimentos/AetherNetwork/src/app/%28dashboard%29/history/page.tsx#L70)

---

## 🧪 Resultados da Validação

Executamos o analisador estático para garantir que não restaram erros de tipagem no projeto:
* **Comando executado**: `npx tsc --noEmit`
* **Resultado**: Concluído com absoluto sucesso. O código do backend e frontend do Next.js compila limpo e sem avisos de tipagem.
