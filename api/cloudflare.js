// api/cloudflare.js - Com debug detalhado
const { S3Client, PutObjectCommand, DeleteObjectCommand, DeleteObjectsCommand } = require('@aws-sdk/client-s3');
const Busboy = require('busboy');
const path = require('path');

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
const R2_PUBLIC_URL = 'https://49f4ed709618aaf0872d22b7370c4c2f.r2.cloudflarestorage.com/criativa';

const parseMultipartForm = (req) => {
    return new Promise((resolve, reject) => {
        try {
            console.log('Iniciando parse do multipart');
            console.log('Headers:', JSON.stringify(req.headers));
            
            const busboy = Busboy({ headers: req.headers });
            const fields = {};
            const files = {};

            busboy.on('field', (fieldname, value) => {
                console.log(`Campo recebido: ${fieldname} = ${value}`);
                fields[fieldname] = value;
            });

            busboy.on('file', (fieldname, file, info) => {
                console.log(`Arquivo recebido: ${fieldname}`, info);
                const { filename, mimeType } = info;
                const chunks = [];

                file.on('data', (chunk) => {
                    chunks.push(chunk);
                });

                file.on('end', () => {
                    const buffer = Buffer.concat(chunks);
                    console.log(`Arquivo completo: ${filename}, tamanho: ${buffer.length} bytes`);
                    files[fieldname] = {
                        filename: filename,
                        contentType: mimeType,
                        data: buffer
                    };
                });

                file.on('error', (err) => {
                    console.error('Erro no stream do arquivo:', err);
                });
            });

            busboy.on('finish', () => {
                console.log('Parse concluído. Campos:', Object.keys(fields), 'Arquivos:', Object.keys(files));
                resolve({ fields, files });
            });

            busboy.on('error', (err) => {
                console.error('Erro no busboy:', err);
                reject(err);
            });

            req.pipe(busboy);
            
        } catch (error) {
            console.error('Erro ao iniciar busboy:', error);
            reject(error);
        }
    });
};

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
    console.log('Content-Type:', req.headers['content-type']);

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
            service: 'Cloudflare R2 API', 
            timestamp: new Date().toISOString() 
        });
        return;
    }

    // Upload único
    if (req.method === 'POST' && req.url.includes('/upload') && !req.url.includes('multiple')) {
        try {
            console.log('Iniciando upload único');
            
            const { fields, files } = await parseMultipartForm(req);
            
            console.log('Parse concluído');
            console.log('Campos recebidos:', Object.keys(fields));
            console.log('Arquivos recebidos:', Object.keys(files));

            if (!files.file) {
                console.log('Nenhum arquivo "file" encontrado');
                return res.status(400).json({ 
                    error: 'Nenhum arquivo enviado',
                    availableFields: Object.keys(files)
                });
            }

            const file = files.file;
            const fileName = fields.fileName || file.filename;

            console.log('Nome do arquivo:', fileName);
            console.log('Tamanho:', file.data.length, 'bytes');

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

            console.log('Content-Type determinado:', contentType);
            console.log('Iniciando upload para R2...');

            // Upload para R2
            const command = new PutObjectCommand({
                Bucket: BUCKET_NAME,
                Key: fileName,
                Body: file.data,
                ContentType: contentType
            });

            await R2.send(command);

            console.log('Upload para R2 concluído com sucesso');

            const publicUrl = `${R2_PUBLIC_URL}/${fileName}`;

            res.status(200).json({
                success: true,
                path: fileName,
                publicUrl: publicUrl,
                size: file.data.length
            });

        } catch (error) {
            console.error('=== ERRO NO UPLOAD ===');
            console.error('Mensagem:', error.message);
            console.error('Stack:', error.stack);
            console.error('Tipo:', error.constructor.name);
            
            res.status(500).json({ 
                error: 'Erro ao fazer upload do arquivo',
                details: error.message,
                errorType: error.constructor.name,
                stack: error.stack
            });
        }
        return;
    }

    // Upload múltiplo
    if (req.method === 'POST' && req.url.includes('/upload-multiple')) {
        try {
            console.log('Iniciando upload múltiplo');
            const { fields, files } = await parseMultipartForm(req);
            
            const fileNames = fields.fileNames ? JSON.parse(fields.fileNames) : [];
            const uploadedFiles = [];

            let index = 0;
            for (const [fieldname, file] of Object.entries(files)) {
                const fileName = fileNames[index] || file.filename;
                console.log(`Upload arquivo ${index + 1}: ${fileName}`);

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

                index++;
            }

            console.log(`Upload múltiplo concluído: ${uploadedFiles.length} arquivos`);

            res.status(200).json({
                success: true,
                files: uploadedFiles
            });

        } catch (error) {
            console.error('Erro no upload múltiplo:', error);
            res.status(500).json({ 
                error: 'Erro ao fazer upload dos arquivos',
                details: error.message,
                stack: error.stack
            });
        }
        return;
    }

    // Delete
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
        url: req.url 
    });
};

