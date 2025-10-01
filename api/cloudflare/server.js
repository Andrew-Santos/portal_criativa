// Configuração do Supabase (apenas banco de dados)
const SUPABASE_URL = 'https://owpboqevrtthsupugcrt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93cGJvcWV2cnR0aHN1cHVnY3J0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5MjY4MDQsImV4cCI6MjA2OTUwMjgwNH0.7RjkVOUT6ByewP0D6FgHQjZDCoi4GYnGT6BMj794MfQ';

// Inicialização do cliente Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Configuração do Cloudflare R2
const R2_CONFIG = {
    API_URL: 'http://localhost:3001', // Para testes locais
    // API_URL: 'https://portal.teamcriativa.com/api/claudflare', // Para produção
    PUBLIC_URL: 'https://49f4ed709618aaf0872d22b7370c4c2f.r2.cloudflarestorage.com/criativa'
};

// Funções para interagir com o banco de dados (Supabase)
class SupabaseService {
    // Buscar todos os clientes
    static async getClients() {
        try {
            const { data, error } = await supabase
                .from('client')
                .select('*')
                .order('users', { ascending: true });
            
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Erro ao buscar clientes:', error);
            return [];
        }
    }

    // Buscar cliente por ID
    static async getClientById(id) {
        try {
            const { data, error } = await supabase
                .from('client')
                .select('*')
                .eq('id', id)
                .single();
            
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Erro ao buscar cliente:', error);
            return null;
        }
    }

    // Criar novo post
    static async createPost(postData) {
        try {
            const { data, error } = await supabase
                .from('post')
                .insert([postData])
                .select()
                .single();
            
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Erro ao criar post:', error);
            return null;
        }
    }

    // Criar mídia do post
    static async createPostMedia(mediaData) {
        try {
            const { data, error } = await supabase
                .from('post_media')
                .insert(mediaData)
                .select();
            
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Erro ao criar mídia do post:', error);
            return null;
        }
    }
}

// Serviço para gerenciar uploads no Cloudflare R2
class R2Service {
    /**
     * Upload de arquivo único para R2
     * @param {File} file - Arquivo a ser enviado
     * @param {string} fileName - Nome/caminho do arquivo no R2 (ex: "POST/123/arquivo.jpg")
     * @returns {Promise<Object>} Resultado do upload com URL pública
     */
    static async uploadFile(file, fileName) {
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('fileName', fileName);

            const response = await fetch(`${R2_CONFIG.API_URL}/upload`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Erro no upload');
            }

            const data = await response.json();
            return {
                path: data.path,
                publicUrl: data.publicUrl,
                success: true
            };

        } catch (error) {
            console.error('Erro no upload para R2:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Upload de múltiplos arquivos para R2
     * @param {Array<{file: File, fileName: string}>} files - Array de objetos com file e fileName
     * @returns {Promise<Array>} Array com resultados dos uploads
     */
    static async uploadMultipleFiles(files) {
        try {
            const formData = new FormData();
            const fileNames = [];

            files.forEach(({ file, fileName }) => {
                formData.append('files', file);
                fileNames.push(fileName);
            });

            formData.append('fileNames', JSON.stringify(fileNames));

            const response = await fetch(`${R2_CONFIG.API_URL}/upload-multiple`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Erro no upload múltiplo');
            }

            const data = await response.json();
            return data.files;

        } catch (error) {
            console.error('Erro no upload múltiplo para R2:', error);
            throw error;
        }
    }

    /**
     * Deletar arquivo do R2
     * @param {string} fileName - Nome/caminho do arquivo no R2
     * @returns {Promise<boolean>} Sucesso da operação
     */
    static async deleteFile(fileName) {
        try {
            const response = await fetch(`${R2_CONFIG.API_URL}/delete/${encodeURIComponent(fileName)}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Erro ao deletar arquivo');
            }

            return true;

        } catch (error) {
            console.error('Erro ao deletar arquivo do R2:', error);
            return false;
        }
    }

    /**
     * Deletar múltiplos arquivos do R2
     * @param {Array<string>} fileNames - Array com nomes/caminhos dos arquivos
     * @returns {Promise<boolean>} Sucesso da operação
     */
    static async deleteMultipleFiles(fileNames) {
        try {
            const response = await fetch(`${R2_CONFIG.API_URL}/delete-multiple`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ fileNames })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Erro ao deletar arquivos');
            }

            return true;

        } catch (error) {
            console.error('Erro ao deletar arquivos do R2:', error);
            return false;
        }
    }

    /**
     * Obter URL pública de um arquivo
     * @param {string} fileName - Nome/caminho do arquivo no R2
     * @returns {string} URL pública do arquivo
     */
    static getPublicUrl(fileName) {
        return `${R2_CONFIG.PUBLIC_URL}/${fileName}`;
    }

    /**
     * Verificar status da API
     * @returns {Promise<boolean>} Status da API
     */
    static async checkHealth() {
        try {
            const response = await fetch(`${R2_CONFIG.API_URL}/health`);
            return response.ok;
        } catch (error) {
            console.error('API R2 não está respondendo:', error);
            return false;
        }
    }
}

// Manter compatibilidade com código antigo (deprecated)
SupabaseService.uploadFile = async function(file, bucket, fileName) {
    console.warn('SupabaseService.uploadFile está deprecated. Use R2Service.uploadFile');
    return await R2Service.uploadFile(file, fileName);
};

SupabaseService.getPublicUrl = function(bucket, fileName) {
    console.warn('SupabaseService.getPublicUrl está deprecated. Use R2Service.getPublicUrl');
    return R2Service.getPublicUrl(fileName);
};
