// Vercel Serverless Function - Instagram API
// Arquivo: api/instagram.js
// URL: https://portal.teamcriativa.com/api/instagram

/**
 * Endpoint para operações do Instagram
 * POST /api/instagram
 * 
 * Body esperado:
 * {
 *   "action": "delete_media",
 *   "mediaId": "18082156952493912",
 *   "accessToken": "EAA..."
 * }
 */
export default async function handler(req, res) {
    // Configurar CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    // Responder OPTIONS (preflight)
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Apenas POST é permitido
    if (req.method !== 'POST') {
        return res.status(405).json({
            success: false,
            error: 'Método não permitido. Use POST.'
        });
    }

    try {
        const { action, mediaId, accessToken } = req.body;

        // Validação da action
        if (!action) {
            return res.status(400).json({
                success: false,
                error: 'Parâmetro "action" é obrigatório'
            });
        }

        // Roteamento de ações
        switch (action) {
            case 'delete_media':
                return await handleDeleteMedia(req, res, mediaId, accessToken);
            
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
}

/**
 * Função para excluir mídia do Instagram
 */
async function handleDeleteMedia(req, res, mediaId, accessToken) {
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
            
            return res.status(200).json({
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
