// api/cloudflare.js - Com Presigned URLs
const { S3Client, PutObjectCommand, DeleteObjectCommand, DeleteObjectsCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

// Configuração do Cloudflare R2
const R2 = new S3Client({
    region: 'auto',
    endpoint: 'https://49f4ed709618aaf0872d22b7370c4c2f.r2.cloudflarestorage.com',
    credentials: {
        accessKeyId: '0955274574591da5706e683d223c2cd2',
        secretAccessKey: 'bb14b0bcde4af05da96322e2164781826871cbef8597526aa63781f24027fea2'
    }
});

const BUCKET_NAME = 'criativa';
const R2_PUBLIC_URL = 'https://pub-4371349196374d9dae204ee83a635609.r2.dev';

// Tipos de arquivos permitidos
const ALLOWED_TYPES = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'video/mp4': '.mp4',
    'video/quicktime': '.mov',
    'video/x-msvideo': '.avi'
};

const MAX_FILE_SIZE = 290 * 1024 * 1024; // 100MB

const readBody = (req) => {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                resolve(JSON.parse(body));
            } catch (e) {
                resolve({});
            }
        });
        req.on('error', reject);
    });
};

module.exports = async (req, res) => {
    console.log(`\n=== Nova requisição ===`);
    console.log('Método:', req.method);
    console.log('URL:', req.url);

    // CORS
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        console.log('Respondendo OPTIONS');
        res.status(200).end();
        return;
    }

    // Health check
    if (req.method === 'GET' && (req.url === '/' || req.url.includes('/health'))) {
        console.log('Health check OK');
        res.status(200).json({ 
            status: 'ok', 
            service: 'Cloudflare R2 API with Presigned URLs', 
            timestamp: new Date().toISOString() 
        });
        return;
    }

    // ============================================
    // NOVO: Gerar Presigned URL para upload único
    // ============================================
    if (req.method === 'POST' && req.url.includes('/generate-upload-url')) {
        try {
            console.log('Gerando presigned URL para upload único');
            const body = await readBody(req);
            const { fileName, contentType, fileSize } = body;

            // Validações
            if (!fileName) {
                return res.status(400).json({ error: 'Nome do arquivo não fornecido' });
            }

            if (!contentType) {
                return res.status(400).json({ error: 'Tipo de arquivo não fornecido' });
            }

            if (!ALLOWED_TYPES[contentType]) {
                return res.status(400).json({ 
                    error: 'Tipo de arquivo não permitido',
                    allowedTypes: Object.keys(ALLOWED_TYPES)
                });
            }

            if (fileSize && fileSize > MAX_FILE_SIZE) {
                return res.status(400).json({ 
                    error: `Arquivo muito grande. Máximo: ${MAX_FILE_SIZE / 1024 / 1024}MB`
                });
            }

            console.log('Arquivo:', fileName);
            console.log('Tipo:', contentType);
            console.log('Tamanho:', fileSize ? `${(fileSize / 1024 / 1024).toFixed(2)}MB` : 'não informado');

            // Criar comando para upload
            const command = new PutObjectCommand({
                Bucket: BUCKET_NAME,
                Key: fileName,
                ContentType: contentType
            });

            // Gerar URL assinada (válida por 15 minutos)
            const uploadUrl = await getSignedUrl(R2, command, { 
                expiresIn: 900 
            });

            console.log('Presigned URL gerada com sucesso');

            res.status(200).json({
                success: true,
                uploadUrl: uploadUrl,
                publicUrl: `${R2_PUBLIC_URL}/${fileName}`,
                fileName: fileName,
                expiresIn: 900
            });

        } catch (error) {
            console.error('Erro ao gerar presigned URL:', error);
            res.status(500).json({ 
                error: 'Erro ao gerar URL de upload',
                details: error.message
            });
        }
        return;
    }

    // ============================================
    // NOVO: Gerar Presigned URLs para múltiplos uploads
    // ============================================
    if (req.method === 'POST' && req.url.includes('/generate-upload-urls')) {
        try {
            console.log('Gerando presigned URLs para múltiplos uploads');
            const body = await readBody(req);
            const { files } = body;

            if (!files || !Array.isArray(files) || files.length === 0) {
                return res.status(400).json({ error: 'Lista de arquivos inválida' });
            }

            console.log(`Gerando URLs para ${files.length} arquivo(s)`);

            const uploadUrls = [];

            for (const file of files) {
                const { fileName, contentType, fileSize } = file;

                // Validações
                if (!fileName || !contentType) {
                    return res.status(400).json({ 
                        error: 'Arquivo inválido',
                        file: file
                    });
                }

                if (!ALLOWED_TYPES[contentType]) {
                    return res.status(400).json({ 
                        error: `Tipo de arquivo não permitido: ${contentType}`,
                        fileName: fileName
                    });
                }

                if (fileSize && fileSize > MAX_FILE_SIZE) {
                    return res.status(400).json({ 
                        error: `Arquivo muito grande: ${fileName}`,
                        maxSize: `${MAX_FILE_SIZE / 1024 / 1024}MB`
                    });
                }

                // Criar comando para upload
                const command = new PutObjectCommand({
                    Bucket: BUCKET_NAME,
                    Key: fileName,
                    ContentType: contentType
                });

                // Gerar URL assinada
                const uploadUrl = await getSignedUrl(R2, command, { 
                    expiresIn: 900 
                });

                uploadUrls.push({
                    fileName: fileName,
                    uploadUrl: uploadUrl,
                    publicUrl: `${R2_PUBLIC_URL}/${fileName}`
                });
            }

            console.log(`${uploadUrls.length} presigned URLs geradas com sucesso`);

            res.status(200).json({
                success: true,
                files: uploadUrls,
                expiresIn: 900
            });

        } catch (error) {
            console.error('Erro ao gerar presigned URLs múltiplas:', error);
            res.status(500).json({ 
                error: 'Erro ao gerar URLs de upload',
                details: error.message
            });
        }
        return;
    }

    // ============================================
    // NOVO: Verificar se arquivo existe no R2
    // ============================================
    if (req.method === 'POST' && req.url.includes('/verify-upload')) {
        try {
            console.log('Verificando se arquivo existe no R2');
            const body = await readBody(req);
            const { fileName } = body;

            if (!fileName) {
                return res.status(400).json({ error: 'Nome do arquivo não fornecido' });
            }

            const command = new HeadObjectCommand({
                Bucket: BUCKET_NAME,
                Key: fileName
            });

            const result = await R2.send(command);

            console.log('Arquivo verificado:', fileName);
            console.log('Tamanho:', result.ContentLength, 'bytes');

            res.status(200).json({
                success: true,
                exists: true,
                fileName: fileName,
                size: result.ContentLength,
                contentType: result.ContentType,
                lastModified: result.LastModified
            });

        } catch (error) {
            if (error.name === 'NotFound') {
                console.log('Arquivo não encontrado:', error);
                res.status(404).json({ 
                    success: false,
                    exists: false,
                    error: 'Arquivo não encontrado'
                });
            } else {
                console.error('Erro ao verificar arquivo:', error);
                res.status(500).json({ 
                    error: 'Erro ao verificar arquivo',
                    details: error.message
                });
            }
        }
        return;
    }

    // ============================================
    // Delete único
    // ============================================
    if (req.method === 'DELETE' && req.url.includes('/delete/')) {
        try {
            const urlParts = req.url.split('/delete/');
            const fileName = decodeURIComponent(urlParts[1]);
            console.log('Deletando arquivo:', fileName);

            const command = new DeleteObjectCommand({
                Bucket: BUCKET_NAME,
                Key: fileName
            });

            await R2.send(command);

            console.log('Arquivo deletado com sucesso');

            res.status(200).json({
                success: true,
                message: 'Arquivo deletado com sucesso',
                fileName: fileName
            });

        } catch (error) {
            console.error('Erro ao deletar arquivo:', error);
            res.status(500).json({ 
                error: 'Erro ao deletar arquivo',
                details: error.message
            });
        }
        return;
    }

    // ============================================
    // Delete múltiplo
    // ============================================
    if (req.method === 'POST' && req.url.includes('/delete-multiple')) {
        try {
            const body = await readBody(req);
            const { fileNames } = body;

            if (!fileNames || !Array.isArray(fileNames) || fileNames.length === 0) {
                return res.status(400).json({ error: 'Lista de arquivos inválida' });
            }

            console.log('Deletando múltiplos arquivos:', fileNames.length);

            const command = new DeleteObjectsCommand({
                Bucket: BUCKET_NAME,
                Delete: {
                    Objects: fileNames.map(fileName => ({ Key: fileName }))
                }
            });

            await R2.send(command);

            console.log(`${fileNames.length} arquivo(s) deletado(s) com sucesso`);

            res.status(200).json({
                success: true,
                message: `${fileNames.length} arquivo(s) deletado(s) com sucesso`
            });

        } catch (error) {
            console.error('Erro ao deletar arquivos:', error);
            res.status(500).json({ 
                error: 'Erro ao deletar arquivos',
                details: error.message
            });
        }
        return;
    }

    // Rota não encontrada
    console.log('Rota não encontrada');
    res.status(404).json({ 
        error: 'Rota não encontrada', 
        method: req.method, 
        url: req.url,
        availableRoutes: [
            'POST /generate-upload-url',
            'POST /generate-upload-urls',
            'POST /verify-upload',
            'DELETE /delete/:fileName',
            'POST /delete-multiple',
            'GET /health'
        ]
    });

};

