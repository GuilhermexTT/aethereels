import { NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  credentials: {
    accessKeyId: process.env.REMOTION_AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.REMOTION_AWS_SECRET_ACCESS_KEY || '',
  },
  region: process.env.REMOTION_AWS_REGION || 'us-east-2',
});

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo foi fornecido.' }, { status: 400 });
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    
    // Higieniza o nome do arquivo para evitar caracteres especiais problemáticos no S3
    const sanitizedFilename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

    const bucketName = process.env.REMOTION_AWS_BUCKET;
    if (!bucketName) {
      return NextResponse.json({ error: 'Configuração do S3Bucket ausente no servidor (REMOTION_AWS_BUCKET).' }, { status: 500 });
    }

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: `user-uploads/${sanitizedFilename}`,
      Body: fileBuffer,
      ContentType: file.type,
      ACL: 'public-read', // Permite leitura pública para reprodução do player e lambda
    });

    await s3Client.send(command);

    const fileUrl = `https://${bucketName}.s3.${process.env.REMOTION_AWS_REGION || 'us-east-2'}.amazonaws.com/user-uploads/${sanitizedFilename}`;

    return NextResponse.json({
      success: true,
      url: fileUrl,
      name: file.name
    });

  } catch (error: any) {
    console.error('Erro na API de Upload S3:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
