// api/claudflare.js - Serverless Function para Vercel
const { S3Client, PutObjectCommand, DeleteObjectCommand, DeleteObjectsCommand } = require('@aws-sdk/client-s3');
const multiparty = require('multiparty');
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

// Parse multipart form data
const parseForm = (req) => {
    return new Promise((resolve, reject) => {
        const form = new multiparty.Form();
        form.parse(req, (err, fields, files) => {
            if (err) reject(err);
            else resolve({ fields, files });
        });
    });
};

// Helper para ler arquivo
const readFile = (file) => {
    return new Promise((resolve, reject) => {
        const fs = require('fs');
        fs.readFile(file.path, (err, data) => {
            if (err) reject(err);
            else resolve(data);
        });
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

    // Health check - aceita raiz, /health, e query params
    const urlPath = req.url.split('?')[0]; // Remove query params
    if (req.method === 'GET' && (urlPath === '/' || urlPath === '' || urlPath.includes('/health'))) {
        res.status(200).json({ status: 'ok', service: 'Cloudflare R2 API', method: req.method, url: req.url });
        return;
    }

    // Upload único
    if (req.method === 'POST' && (req.url.includes('/upload') && !req.url.includes('multiple'))) {
        try {
            const { fields, files } = await parseForm(req);
            
            if (!files.file || !files.file[0]) {
                return res.status(400).json({ error: 'Nenhum arquivo enviado' });
            }

            const file = files.file[0];
            const fileName = fields.fileName ? fields.fileName[0] : file.originalFilename;

            if (!fileName) {
                return res.status(400).json({ error: 'Nome do arquivo não fornecido' });
            }

            // Ler o arquivo
            const fileBuffer = await readFile(file);

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
            const contentType = contentTypeMap[ext] || 'application/octet-stream';

            // Upload para R2
            const command = new PutObjectCommand({
                Bucket: BUCKET_NAME,
                Key: fileName,
                Body: fileBuffer,
                ContentType: contentType
            });

            await R2.send(command);

            const publicUrl = `${R2_PUBLIC_URL}/${fileName}`;

            res.status(200).json({
                success: true,
                path: fileName,
                publicUrl: publicUrl,
                size: file.size
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

    // Delete
    if (req.method === 'DELETE' && req.url.includes('/delete/')) {
        try {
            const fileName = req.url.split('/delete/')[1];

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
            const body = JSON.parse(req.body);
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
    res.status(404).json({ error: 'Rota não encontrada', method: req.method, url: req.url });
};
