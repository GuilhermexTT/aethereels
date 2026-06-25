import { NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Client = new S3Client({
  credentials: {
    accessKeyId: process.env.REMOTION_AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.REMOTION_AWS_SECRET_ACCESS_KEY || '',
  },
  region: process.env.REMOTION_AWS_REGION || 'us-east-2',
});

export async function POST(request: Request) {
  try {
    const { filename, contentType } = await request.json();

    if (!filename || !contentType) {
      return NextResponse.json(
        { error: 'Os campos filename e contentType são obrigatórios no corpo da requisição.' }, 
        { status: 400 }
      );
    }

    const bucketName = process.env.REMOTION_AWS_BUCKET;
    if (!bucketName) {
      return NextResponse.json(
        { error: 'Configuração do S3Bucket ausente no servidor (REMOTION_AWS_BUCKET).' }, 
        { status: 500 }
      );
    }

    // Higieniza o nome do arquivo para evitar caracteres especiais problemáticos no S3
    const sanitizedFilename = `${Date.now()}-${filename.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const key = `user-uploads/${sanitizedFilename}`;

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      ContentType: contentType,
      ACL: 'public-read', // Permite leitura pública para reprodução no player e renderizadores Remotion Lambda
    });

    // Gerar URL pré-assinada de upload (HTTP PUT)
    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

    // URL final pública de acesso ao arquivo após o upload ser concluído
    const fileUrl = `https://${bucketName}.s3.${process.env.REMOTION_AWS_REGION || 'us-east-2'}.amazonaws.com/${key}`;

    return NextResponse.json({
      success: true,
      uploadUrl,
      fileUrl,
      key
    });

  } catch (error: any) {
    console.error('Erro na API de geração de Presigned URL S3:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
