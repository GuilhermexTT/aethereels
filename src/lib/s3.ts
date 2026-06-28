import { S3Client, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';

const s3Client = new S3Client({
  credentials: {
    accessKeyId: process.env.REMOTION_AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.REMOTION_AWS_SECRET_ACCESS_KEY || '',
  },
  region: process.env.REMOTION_AWS_REGION || 'us-east-2',
});

const bucketName = process.env.REMOTION_AWS_BUCKET || '';

/**
 * Garante que a URL do vídeo esteja hospedada no nosso bucket S3.
 * Se for uma URL externa (ex: Mixkit, Pexels), faz o download do vídeo e o envia para o S3,
 * utilizando o hash MD5 da URL como chave de cache.
 * Se a URL já for do S3 ou um caminho local, retorna-a inalterada.
 */
export async function ensureS3VideoUrl(url: string): Promise<string> {
  if (!url) return url;

  // 1. Verificar se é uma URL HTTP/HTTPS externa
  const isHttp = url.startsWith('http://') || url.startsWith('https://');
  if (!isHttp) {
    return url;
  }

  // Se a URL já contiver o nome do nosso bucket ou amazonaws.com, já está no S3
  if (url.includes('amazonaws.com') || (bucketName && url.includes(bucketName))) {
    return url;
  }

  if (!bucketName) {
    console.warn('[S3 Cache] REMOTION_AWS_BUCKET não está configurado. Pulando upload para o S3.');
    return url;
  }

  // 2. Gerar um hash único para a URL externa para usar como chave de cache
  const hash = crypto.createHash('md5').update(url).digest('hex');
  
  // Tentar extrair a extensão da URL, com fallback para mp4
  let ext = 'mp4';
  try {
    const parsedUrl = new URL(url);
    const pathname = parsedUrl.pathname;
    const match = pathname.match(/\.([a-zA-Z0-9]+)$/);
    if (match && match[1]) {
      ext = match[1].toLowerCase();
    }
  } catch (e) {
    // Ignora erros de parsing da URL
  }

  const s3Key = `cached-assets/${hash}.${ext}`;
  const s3Url = `https://${bucketName}.s3.${process.env.REMOTION_AWS_REGION || 'us-east-2'}.amazonaws.com/${s3Key}`;

  // 3. Verificar se o arquivo já existe no S3 (Cache Hit)
  try {
    const headCommand = new HeadObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
    });
    await s3Client.send(headCommand);
    console.log(`[S3 Cache] Hit! Usando vídeo em cache para a URL: ${url} -> ${s3Url}`);
    return s3Url;
  } catch (error: any) {
    // Se o erro for 404 (NotFound), precisamos fazer o upload. Caso contrário, logamos.
    if (error.name !== 'NotFound' && error.$metadata?.httpStatusCode !== 404) {
      console.warn(`[S3 Cache] Erro ao verificar cache para ${s3Key}:`, error.message);
    }
  }

  // 4. Cache Miss: Baixar e enviar para o S3
  console.log(`[S3 Cache] Miss. Baixando vídeo externo: ${url}`);
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Falha ao baixar vídeo externo. Status: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const contentType = response.headers.get('content-type') || `video/${ext}`;

  console.log(`[S3 Cache] Enviando para o S3: ${s3Key} (${buffer.length} bytes, tipo: ${contentType})`);

  const putCommand = new PutObjectCommand({
    Bucket: bucketName,
    Key: s3Key,
    Body: buffer,
    ContentType: contentType,
    ACL: 'public-read',
  });

  await s3Client.send(putCommand);
  console.log(`[S3 Cache] Vídeo enviado e cacheado com sucesso: ${s3Url}`);

  return s3Url;
}
