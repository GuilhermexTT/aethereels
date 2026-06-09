import crypto from 'crypto';

// Derivar uma chave estável de 32 bytes (256 bits) para o AES-256 usando SHA-256
const getEncryptionKey = (): Buffer => {
  const rawKey = process.env.ENCRYPTION_KEY;
  if (!rawKey) {
    // Para ambientes de teste/desenvolvimento que não definiram a chave, levantamos erro ou geramos fallback
    throw new Error('A variável de ambiente ENCRYPTION_KEY não está configurada.');
  }
  return crypto.createHash('sha256').update(rawKey).digest();
};

/**
 * Criptografa uma string usando AES-256-CBC com um IV gerado aleatoriamente.
 * Retorna o resultado no formato 'iv:ciphertext' (ambos em hexadecimal).
 */
export function encryptToken(token: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16); // IV de 16 bytes para CBC
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  
  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return `${iv.toString('hex')}:${encrypted}`;
}

/**
 * Descriptografa uma string no formato 'iv:ciphertext' usando AES-256-CBC.
 */
export function decryptToken(encryptedText: string): string {
  const key = getEncryptionKey();
  const parts = encryptedText.split(':');
  
  if (parts.length !== 2) {
    throw new Error('Formato de token criptografado inválido.');
  }
  
  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = parts[1];
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Gera a assinatura HMAC-SHA256 de um determinado payload usando a chave secreta.
 */
export function generateHmacSignature(payload: string): string {
  const secret = process.env.REELSFLOW_SIGNATURE_SECRET;
  if (!secret) {
    throw new Error('A variável de ambiente REELSFLOW_SIGNATURE_SECRET não está configurada.');
  }
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
}

/**
 * Verifica se a assinatura enviada corresponde ao HMAC esperado do payload,
 * usando comparação segura para prevenir ataques de tempo (Timing Attacks).
 */
export function verifyHmacSignature(payload: string, signature: string): boolean {
  const secret = process.env.REELSFLOW_SIGNATURE_SECRET;
  if (!secret || !signature) {
    return false;
  }
  
  try {
    const expectedSignature = generateHmacSignature(payload);
    
    const signatureBuffer = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');
    
    if (signatureBuffer.length !== expectedBuffer.length) {
      return false;
    }
    
    return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
  } catch (error) {
    // Se falhar a decodificação hex ou qualquer outra coisa, falha a validação
    return false;
  }
}
