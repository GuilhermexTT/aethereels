-- Migração: Criar o bucket editor_temp_uploads para uploads temporários de mídia do editor
-- E configurar as políticas de acesso corretas

-- 1. Criar o bucket caso não exista
INSERT INTO storage.buckets (id, name, public)
VALUES ('editor_temp_uploads', 'editor_temp_uploads', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Habilitar políticas (se necessário)
-- Permitir acesso de leitura pública para que a AWS Lambda e o Player consigam ler os arquivos
CREATE POLICY "Leitura pública para arquivos do editor_temp_uploads"
ON storage.objects FOR SELECT
USING (bucket_id = 'editor_temp_uploads');

-- Permitir que usuários autenticados façam upload de mídias
CREATE POLICY "Upload permitido para usuários autenticados no editor_temp_uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'editor_temp_uploads');

-- Permitir que usuários autenticados removam seus próprios arquivos temporários (se necessário)
-- Nota: O backend (que usa o service_role) tem bypass automático de RLS e sempre poderá deletar.
CREATE POLICY "Deleção permitida para proprietários no editor_temp_uploads"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'editor_temp_uploads' AND (auth.uid()::text = (storage.foldername(name))[1]));
