// api/cloudflare.js - Serverless Function para Vercel (CORRIGIDO)
const { S3Client, PutObjectCommand, DeleteObjectCommand, DeleteObjectsCommand } = require('@aws-sdk/client-s3');
const path = require('path');

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

// Helper para parsear multipart/form-data manualmente
const parseMultipartForm = async (req) => {
    return new Promise((resolve, reject) => {
        let data = [];
        
        req.on('data', chunk => {
            data.push(chunk);
        });
        
        req.on('end', () => {
            try {
                const buffer = Buffer.concat(data);
                const boundary = req.headers['content-type'].split('boundary=')[1];
                
                if (!boundary) {
                    reject(new Error('Boundary não encontrado'));
                    return;
                }
                
                const parts = buffer.toString('binary').split(`--${boundary}`);
                const files = {};
                const fields = {};
                
                parts.forEach(part => {
                    if (part.includes('Content-Disposition')) {
                        const nameMatch = part.match(/name="([^"]+)"/);
                        const filenameMatch = part.match(/filename="([^"]+)"/);
                        
                        if (nameMatch) {
                            const fieldName = nameMatch[1];
                            const headerEnd = part.indexOf('\r\n\r\n');
                            
                            if (headerEnd !== -1) {
                                const content = part.substring(headerEnd + 4);
                                const contentEnd = content.lastIndexOf('\r\n');
                                const value = content.substring(0, contentEnd);
                                
                                if (filenameMatch) {
                                    // É um arquivo
                                    const filename = filenameMatch[1];
                                    const contentTypeMatch = part.match(/Content-Type: ([^\r\n]+)/);
                                    const contentType = contentTypeMatch ? contentTypeMatch[1] : 'application/octet-stream';
                                    
                                    files[fieldName] = {
                                        filename: filename,
                                        contentType: contentType,
                                        data: Buffer.from(value, 'binary')
                                    };
                                } else {
                                    // É um campo de texto
                                    fields[fieldName] = value;
                                }
                            }
                        }
                    }
                });
                
                resolve({ fields, files });
            } catch (error) {
                reject(error);
            }
        });
        
        req.on('error', reject);
    });
};

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

    // Health check
    if (req.method === 'GET' && (req.url === '/' || req.url.includes('/health'))) {
        res.status(200).json({ 
            status: 'ok', 
            service: 'Cloudflare R2 API', 
            timestamp: new Date().toISOString() 
        });
        return;
    }

    // Upload único
    if (req.method === 'POST' && req.url.includes('/upload') && !req.url.includes('multiple')) {
        try {
            const { fields, files } = await parseMultipartForm(req);
            
            if (!files.file) {
                return res.status(400).json({ error: 'Nenhum arquivo enviado' });
            }

            const file = files.file;
            const fileName = fields.fileName || file.filename;

            if (!fileName) {
                return res.status(400).json({ error: 'Nome do arquivo não fornecido' });
            }

            // Determinar Content-Type
            const ext = path.extname(fileName).toLowerCase();
            const contentTypeMap = {
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.png': 'image/png',
                '.gif': 'image/gif',
                '.mp4': 'video/mp4',
                '.mov': 'video/quicktime',
                '.avi': 'video/x-msvideo'
            };
            const contentType = contentTypeMap[ext] || file.contentType || 'application/octet-stream';

            // Upload para R2
            const command = new PutObjectCommand({
                Bucket: BUCKET_NAME,
                Key: fileName,
                Body: file.data,
                ContentType: contentType
            });

            await R2.send(command);

            const publicUrl = `${R2_PUBLIC_URL}/${fileName}`;

            res.status(200).json({
                success: true,
                path: fileName,
                publicUrl: publicUrl,
                size: file.data.length
            });

        } catch (error) {
            console.error('Erro no upload:', error);
            res.status(500).json({ 
                error: 'Erro ao fazer upload do arquivo',
                details: error.message 
            });
        }
        return;
    }

    // Upload múltiplo
    if (req.method === 'POST' && req.url.includes('/upload-multiple')) {
        try {
            const { fields, files } = await parseMultipartForm(req);
            
            if (!files.files) {
                return res.status(400).json({ error: 'Nenhum arquivo enviado' });
            }

            const fileNames = fields.fileNames ? JSON.parse(fields.fileNames) : [];
            const uploadedFiles = [];

            // Se files.files é um array
            const filesArray = Array.isArray(files.files) ? files.files : [files.files];

            for (let i = 0; i < filesArray.length; i++) {
                const file = filesArray[i];
                const fileName = fileNames[i] || file.filename;

                const ext = path.extname(fileName).toLowerCase();
                const contentTypeMap = {
                    '.jpg': 'image/jpeg',
                    '.jpeg': 'image/jpeg',
                    '.png': 'image/png',
                    '.gif': 'image/gif',
                    '.mp4': 'video/mp4',
                    '.mov': 'video/quicktime',
                    '.avi': 'video/x-msvideo'
                };
                const contentType = contentTypeMap[ext] || file.contentType || 'application/octet-stream';

                const command = new PutObjectCommand({
                    Bucket: BUCKET_NAME,
                    Key: fileName,
                    Body: file.data,
                    ContentType: contentType
                });

                await R2.send(command);

                uploadedFiles.push({
                    path: fileName,
                    publicUrl: `${R2_PUBLIC_URL}/${fileName}`,
                    size: file.data.length
                });
            }

            res.status(200).json({
                success: true,
                files: uploadedFiles
            });

        } catch (error) {
            console.error('Erro no upload múltiplo:', error);
            res.status(500).json({ 
                error: 'Erro ao fazer upload dos arquivos',
                details: error.message 
            });
        }
        return;
    }

    // Delete
    if (req.method === 'DELETE' && req.url.includes('/delete/')) {
        try {
            const urlParts = req.url.split('/delete/');
            const fileName = decodeURIComponent(urlParts[1]);

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
    if (req.method === 'POST' && req.url.includes('/delete-multiple')) {
        try {
            // Ler body da requisição
            let body = '';
            for await (const chunk of req) {
                body += chunk.toString();
            }
            
            const { fileNames } = JSON.parse(body);

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
        url: req.url 
    });
};
