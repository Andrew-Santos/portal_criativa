// api/claudflare.js - Serverless Function para Vercel
const { S3Client, PutObjectCommand, DeleteObjectCommand, DeleteObjectsCommand } = require('@aws-sdk/client-s3');
const { Readable } = require('stream');

// Configuração do Cloudflare R2
const R2 = new S3Client({
    region: 'auto',
    endpoint: 'https://49f4ed709618aaf0872d22b7370c4c2f.r2.cloudflarestorage.com',
    credentials: {
        accessKeyId: '0955274574591da5706e683d223c2cd2',
        secretAccessKey: '2d573aa41d1e0870c6a022caffahc4e370bcba0b553ffbe651b236c62bbd96c6'
    }
});

const BUCKET_NAME = 'criativa';
const R2_PUBLIC_URL = 'https://49f4ed709618aaf0872d22b7370c4c2f.r2.cloudflarestorage.com/criativa';

// Parse multipart form data manualmente
function parseMultipartForm(buffer, boundary) {
    const parts = [];
    const boundaryBuffer = Buffer.from('--' + boundary);
    
    let start = 0;
    while (true) {
        const boundaryIndex = buffer.indexOf(boundaryBuffer, start);
        if (boundaryIndex === -1) break;
        
        const nextBoundaryIndex = buffer.indexOf(boundaryBuffer, boundaryIndex + boundaryBuffer.length);
        if (nextBoundaryIndex === -1) break;
        
        const partData = buffer.slice(boundaryIndex + boundaryBuffer.length, nextBoundaryIndex);
        
        // Separar headers do body
        const headerEndIndex = partData.indexOf(Buffer.from('\r\n\r\n'));
        if (headerEndIndex === -1) {
            start = nextBoundaryIndex;
            continue;
        }
        
        const headersBuffer = partData.slice(0, headerEndIndex);
        const bodyBuffer = partData.slice(headerEndIndex + 4, partData.length - 2); // Remove \r\n no final
        
        const headers = headersBuffer.toString('utf-8');
        
        // Extrair name e filename
        const nameMatch = headers.match(/name="([^"]+)"/);
        const filenameMatch = headers.match(/filename="([^"]+)"/);
        
        if (nameMatch) {
            parts.push({
                name: nameMatch[1],
                filename: filenameMatch ? filenameMatch[1] : null,
                data: bodyBuffer,
                isFile: !!filenameMatch
            });
        }
        
        start = nextBoundaryIndex;
    }
    
    return parts;
}

// Helper para ler body como buffer
async function getRawBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', chunk => chunks.push(chunk));
        req.on('end', () => resolve(Buffer.concat(chunks)));
        req.on('error', reject);
    });
}

module.exports = async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Normalizar URL (remover /api/claudflare se existir)
    const normalizedUrl = req.url.replace('/api/cloudflare', '') || '/';

    // Health check - aceita todas as variações de GET
    if (req.method === 'GET') {
        // Aceita: /, /health
        if (normalizedUrl === '/' || normalizedUrl.includes('/health')) {
            res.status(200).json({ 
                status: 'ok', 
                service: 'Cloudflare R2 API', 
                method: req.method, 
                url: req.url,
                normalizedUrl: normalizedUrl 
            });
            return;
        }
    }

    // Upload único
    if (req.method === 'POST' && (normalizedUrl.includes('/upload') && !normalizedUrl.includes('multiple'))) {
        try {
            const contentType = req.headers['content-type'] || '';
            
            if (!contentType.includes('multipart/form-data')) {
                return res.status(400).json({ 
                    error: 'Content-Type deve ser multipart/form-data',
                    received: contentType 
                });
            }
            
            // Extrair boundary
            const boundaryMatch = contentType.match(/boundary=([^;]+)/);
            if (!boundaryMatch) {
                return res.status(400).json({ error: 'Boundary não encontrado' });
            }
            
            const boundary = boundaryMatch[1];
            
            // Ler body
            const bodyBuffer = await getRawBody(req);
            
            // Parse multipart
            const parts = parseMultipartForm(bodyBuffer, boundary);
            
            // Encontrar arquivo e fileName
            const filePart = parts.find(p => p.isFile);
            const fileNamePart = parts.find(p => p.name === 'fileName');
            
            if (!filePart) {
                return res.status(400).json({ 
                    error: 'Nenhum arquivo enviado',
                    parts: parts.map(p => ({ name: p.name, isFile: p.isFile }))
                });
            }
            
            const fileName = fileNamePart ? fileNamePart.data.toString('utf-8') : filePart.filename;
            
            if (!fileName) {
                return res.status(400).json({ error: 'Nome do arquivo não fornecido' });
            }
            
            // Determinar Content-Type
            const ext = fileName.toLowerCase().match(/\.([^.]+)$/)?.[1];
            const contentTypeMap = {
                'jpg': 'image/jpeg',
                'jpeg': 'image/jpeg',
                'png': 'image/png',
                'gif': 'image/gif',
                'mp4': 'video/mp4',
                'mov': 'video/quicktime',
                'avi': 'video/x-msvideo'
            };
            const fileContentType = contentTypeMap[ext] || 'application/octet-stream';
            
            // Upload para R2
            const command = new PutObjectCommand({
                Bucket: BUCKET_NAME,
                Key: fileName,
                Body: filePart.data,
                ContentType: fileContentType
            });
            
            await R2.send(command);
            
            const publicUrl = `${R2_PUBLIC_URL}/${fileName}`;
            
            res.status(200).json({
                success: true,
                path: fileName,
                publicUrl: publicUrl,
                size: filePart.data.length
            });
            
        } catch (error) {
            console.error('Erro no upload:', error);
            res.status(500).json({ 
                error: 'Erro ao fazer upload do arquivo',
                details: error.message,
                stack: error.stack
            });
        }
        return;
    }

    // Delete
    if (req.method === 'DELETE' && normalizedUrl.includes('/delete/')) {
        try {
            const fileName = normalizedUrl.split('/delete/')[1];

            const command = new DeleteObjectCommand({
                Bucket: BUCKET_NAME,
                Key: fileName
            });

            await R2.send(command);

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

    // Delete múltiplo
    if (req.method === 'POST' && normalizedUrl.includes('/delete-multiple')) {
        try {
            const bodyBuffer = await getRawBody(req);
            const body = JSON.parse(bodyBuffer.toString('utf-8'));
            const { fileNames } = body;

            if (!fileNames || !Array.isArray(fileNames) || fileNames.length === 0) {
                return res.status(400).json({ error: 'Lista de arquivos inválida' });
            }

            const command = new DeleteObjectsCommand({
                Bucket: BUCKET_NAME,
                Delete: {
                    Objects: fileNames.map(fileName => ({ Key: fileName }))
                }
            });

            await R2.send(command);

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
    res.status(404).json({ 
        error: 'Rota não encontrada', 
        method: req.method, 
        url: req.url,
        normalizedUrl: normalizedUrl 
    });
};

