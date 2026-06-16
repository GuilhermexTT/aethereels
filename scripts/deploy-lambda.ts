import { loadEnvConfig } from '@next/env';
import { deployFunction, deploySite, getOrCreateBucket } from '@remotion/lambda';
import path from 'path';

// Carregar variáveis do arquivo .env.local
loadEnvConfig(process.cwd());

// Mapear credenciais AWS customizadas para as padrão do SDK se necessário
const awsAccessKeyId = process.env.REMOTION_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
const awsSecretAccessKey = process.env.REMOTION_AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;
const awsRegion = process.env.REMOTION_AWS_REGION || process.env.AWS_REGION || 'us-east-2';

if (!awsAccessKeyId || !awsSecretAccessKey) {
  console.error('❌ Erro: Credenciais AWS não encontradas.');
  console.error('Certifique-se de configurar REMOTION_AWS_ACCESS_KEY_ID e REMOTION_AWS_SECRET_ACCESS_KEY no seu arquivo .env.local.');
  process.exit(1);
}

// Configurar variáveis globais para o AWS SDK interno do Remotion
process.env.AWS_ACCESS_KEY_ID = awsAccessKeyId;
process.env.AWS_SECRET_ACCESS_KEY = awsSecretAccessKey;
process.env.AWS_REGION = awsRegion;

const region = awsRegion as any;

async function run() {
  console.log('🚀 Iniciando deploy da composição de Reels para o AWS Lambda via Remotion...');
  console.log(`📍 Região AWS: ${region}`);

  // 1. Obter ou criar o bucket S3
  console.log('📦 Configurando Bucket S3 na AWS...');
  const { bucketName, alreadyExisted: bucketExisted } = await getOrCreateBucket({ region });
  console.log(`✅ Bucket S3: ${bucketName} (${bucketExisted ? 'já existia' : 'criado com sucesso'})`);

  // 1.5. Configurar ou obter a Role do IAM
  const customRoleArn = process.env.REMOTION_AWS_ROLE_ARN;
  if (customRoleArn) {
    console.log(`🔑 Usando Role do IAM fornecida no .env.local: ${customRoleArn}`);
  } else {
    console.warn('⚠️ REMOTION_AWS_ROLE_ARN não foi definida no .env.local.');
    console.warn('O Remotion usará o comportamento padrão tentando encontrar a role "remotion-lambda-role".');
    console.warn('Se o deploy falhar com erro de permissão da Role, certifique-se de criá-la manualmente na AWS');
    console.warn('e fornecer a chave REMOTION_AWS_ROLE_ARN no seu arquivo .env.local.');
  }

  // 2. Fazer deploy da função Lambda do Remotion
  console.log('⚡ Fazendo deploy/atualização da função Lambda...');
  const { functionName, alreadyExisted: funcExisted } = await deployFunction({
    createCloudWatchLogGroup: true,
    region,
    timeoutInSeconds: 240, // Timeout estendido para renderização de reels
    memorySizeInMb: 2048,  // Tamanho de memória recomendado para boa performance/custo
    diskSizeInMb: 512,
    customRoleArn,
  });
  console.log(`✅ Função Lambda: ${functionName} (${funcExisted ? 'já existia' : 'criada/atualizada com sucesso'})`);

  // 3. Fazer deploy do bundle da composição de vídeo (Site)
  const entryPoint = path.resolve(process.cwd(), 'src/video/index.ts');
  console.log(`📦 Compilando e enviando composição a partir de: ${entryPoint}...`);
  
  const { siteName } = await deploySite({
    bucketName,
    entryPoint,
    region,
    options: {
      onBundleProgress: (progress) => {
        console.log(`   Progresso do empacotamento: ${progress.toFixed(0)}%`);
      },
    },
  });

  console.log('\n🎉 Deploy realizado com sucesso!');
  console.log('==================================================');
  console.log(`Bucket S3:        ${bucketName}`);
  console.log(`Função Lambda:    ${functionName}`);
  console.log(`ID do Site/Bundle: ${siteName}`);
  console.log('==================================================\n');
  console.log('💡 Para utilizar no seu backend do ReelsFlow, adicione os seguintes valores ao seu .env.local:');
  console.log(`REMOTION_AWS_BUCKET=${bucketName}`);
  console.log(`REMOTION_AWS_FUNCTION=${functionName}`);
  console.log(`REMOTION_AWS_SITE=${siteName}`);
  console.log('\n🚀 Seu motor de Reels está pronto para renderizar vídeos na AWS!');
}

run().catch((error) => {
  console.error('❌ Falha no deploy:', error);
  process.exit(1);
});
