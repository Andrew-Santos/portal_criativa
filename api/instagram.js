// Backend API para Instagram - Exclusão de Mídias
// Arquivo: instagram.js
// URL: https://portal.teamcriativa.com/api/instagram.js

const express = require('express');
const router = express.Router();

/**
 * POST /api/instagram.js
 * Endpoint para excluir mídia do Instagram
 * 
 * Body esperado:
 * {
 *   "action": "delete_media",
 *   "mediaId": "18082156952493912",
 *   "accessToken": "EAA..."
 * }
 */
router.post('/', async (req, res) => {
    try {
        const { action, mediaId, accessToken } = req.body;

        // Validações básicas
        if (!action) {
            return res.status(400).json({
                success: false,
                error: 'Parâmetro "action" é obrigatório'
            });
        }

        // Roteamento de ações
        switch (action) {
            case 'delete_media':
                return await handleDeleteMedia(req, res);
            
            default:
                return res.status(400).json({
                    success: false,
                    error: `Ação "${action}" não reconhecida`
                });
        }

    } catch (error) {
        console.error('[Instagram API] Erro não tratado:', error);
        return res.status(500).json({
            success: false,
            error: 'Erro interno do servidor',
            details: error.message
        });
    }
});

/**
 * Função para excluir mídia do Instagram
 */
async function handleDeleteMedia(req, res) {
    const { mediaId, accessToken } = req.body;

    // Validações
    if (!mediaId) {
        return res.status(400).json({
            success: false,
            error: 'Parâmetro "mediaId" é obrigatório'
        });
    }

    if (!accessToken) {
        return res.status(400).json({
            success: false,
            error: 'Parâmetro "accessToken" é obrigatório'
        });
    }

    try {
        console.log(`[Instagram API] Excluindo mídia: ${mediaId}`);

        // Fazer requisição DELETE para a API do Instagram Graph
        const url = `https://graph.facebook.com/v21.0/${mediaId}?access_token=${accessToken}`;
        
        const response = await fetch(url, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const result = await response.json();

        // Verificar resposta
        if (!response.ok) {
            console.error('[Instagram API] Erro da Graph API:', result);
            
            return res.status(response.status).json({
                success: false,
                error: result.error?.message || 'Erro ao excluir mídia do Instagram',
                errorCode: result.error?.code,
                errorType: result.error?.type
            });
        }

        // Sucesso
        if (result.success === true) {
            console.log(`[Instagram API] Mídia ${mediaId} excluída com sucesso`);
            
            return res.json({
                success: true,
                message: 'Mídia excluída com sucesso do Instagram',
                mediaId: mediaId
            });
        }

        // Resposta inesperada
        console.warn('[Instagram API] Resposta inesperada:', result);
        return res.status(500).json({
            success: false,
            error: 'Resposta inesperada da API do Instagram',
            details: result
        });

    } catch (error) {
        console.error('[Instagram API] Erro ao excluir mídia:', error);
        
        return res.status(500).json({
            success: false,
            error: 'Erro ao comunicar com a API do Instagram',
            details: error.message
        });
    }
}

// Se estiver usando como módulo
module.exports = router;

// Se estiver usando como script standalone
if (require.main === module) {
    const express = require('express');
    const cors = require('cors');
    const app = express();
    
    // Middlewares
    app.use(cors());
    app.use(express.json());
    
    // Rota
    app.use('/api/instagram.js', router);
    
    // Iniciar servidor
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`[Instagram API] Servidor rodando na porta ${PORT}`);
        console.log(`[Instagram API] Endpoint: http://localhost:${PORT}/api/instagram.js`);
    });
}
