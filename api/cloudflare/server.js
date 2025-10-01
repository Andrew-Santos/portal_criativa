// server.js - Backend para integração com Cloudflare R2
// Deploy em: https://portal.teamcriativa.com/api/claudflare

const express = require('express');
const multer = require('multer');
const { S3Client, PutObjectCommand, DeleteObjectCommand, DeleteObjectsCommand } = require('@aws-sdk/client-s3');
const cors = require('cors');
const path = require('path');

const app = express();

// Configuração do CORS - ajuste conforme necessário
app.use(cors({
    origin: ['https://portal.teamcriativa.com', 'http://localhost:3000'],
    methods: ['GET', 'POST', 'DELETE'],
    credentials: true
}));

app.use(express.json());

// Configuração do Cloudflare R2
const R2 = new S3Client({
    region: 'auto',
    endpoint: 'https://49f4ed709618aaf0872d22b7370c4c2f.r2.cloudflarestorage.com',
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID, // Defina nas variáveis de ambiente
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY // Defina nas variáveis de ambiente
    }
});

const BUCKET_NAME = 'criativa';
const R2_PUBLIC_URL = 'https://49f4ed709618aaf0872d22b7370c4c2f.r2.cloudflarestorage.com/criativa';

// Configuração do Multer para upload em memória
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'video/mp4', 'video/quicktime', 'video/x-msvideo'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Tipo de arquivo não suportado'));
        }
    }
});

// Rota de health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'Cloudflare R2 API' });
});

// Rota para upload de arquivo
app.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Nenhum arquivo enviado' });
        }

        const { fileName } = req.body;
        if (!fileName) {
            return res.status(400).json({ error: 'Nome do arquivo não fornecido' });
        }

        // Determinar Content-Type baseado na extensão
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
        const contentType = contentTypeMap[ext] || req.file.mimetype;

        // Upload para R2
        const command = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: fileName,
            Body: req.file.buffer,
            ContentType: contentType
        });

        await R2.send(command);

        // Retornar URL pública
        const publicUrl = `${R2_PUBLIC_URL}/${fileName}`;

        res.json({
            success: true,
            path: fileName,
            publicUrl: publicUrl,
            size: req.file.size
        });

    } catch (error) {
        console.error('Erro no upload:', error);
        res.status(500).json({ 
            error: 'Erro ao fazer upload do arquivo',
            details: error.message 
        });
    }
});

// Rota para upload múltiplo
app.post('/upload-multiple', upload.array('files', 10), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'Nenhum arquivo enviado' });
        }

        const fileNames = JSON.parse(req.body.fileNames || '[]');
        if (fileNames.length !== req.files.length) {
            return res.status(400).json({ error: 'Número de arquivos e nomes não correspondem' });
        }

        const uploadPromises = req.files.map(async (file, index) => {
            const fileName = fileNames[index];
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
            const contentType = contentTypeMap[ext] || file.mimetype;

            const command = new PutObjectCommand({
                Bucket: BUCKET_NAME,
                Key: fileName,
                Body: file.buffer,
                ContentType: contentType
            });

            await R2.send(command);

            return {
                fileName: fileName,
                publicUrl: `${R2_PUBLIC_URL}/${fileName}`,
                size: file.size
            };
        });

        const results = await Promise.all(uploadPromises);

        res.json({
            success: true,
            files: results
        });

    } catch (error) {
        console.error('Erro no upload múltiplo:', error);
        res.status(500).json({ 
            error: 'Erro ao fazer upload dos arquivos',
            details: error.message 
        });
    }
});

// Rota para deletar arquivo
app.delete('/delete/:fileName(*)', async (req, res) => {
    try {
        const fileName = req.params.fileName;

        const command = new DeleteObjectCommand({
            Bucket: BUCKET_NAME,
            Key: fileName
        });

        await R2.send(command);

        res.json({
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
});

// Rota para deletar múltiplos arquivos
app.post('/delete-multiple', async (req, res) => {
    try {
        const { fileNames } = req.body;

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

        res.json({
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
});

// Tratamento de erros do Multer
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'Arquivo muito grande (máximo 100MB)' });
        }
        return res.status(400).json({ error: error.message });
    }
    next(error);
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});