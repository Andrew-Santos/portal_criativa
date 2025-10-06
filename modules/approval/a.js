// approval.actions.js

// Approval Actions - Gerencia ações e lógica do painel
import { ApprovalRenderer } from './approval.renderer.js';

export class ApprovalActions {
    // ... (constructor, init, attachEvents, etc. - Mantenha tudo como estava)
    constructor(panel, authData) {
        this.panel = panel;
        this.authData = authData;
        this.renderer = new ApprovalRenderer(this);
        this.posts = [];
        this.currentTab = 'aprovacao';
        this.clientIds = authData.clients.map(c => c.id);
    }

    async init() {
        console.log('[ApprovalActions] Inicializando painel...');
        console.log('[ApprovalActions] IDs dos clientes:', this.clientIds);
        
        // Renderizar estrutura base
        this.renderer.renderBase();
        
        // Carregar aba de aprovação (padrão)
        await this.loadApprovalTab();
        
        // Attach eventos
        this.attachEvents();
    }

    attachEvents() {
        // Eventos das tabs
        document.addEventListener('click', (e) => {
            const tab = e.target.closest('[data-tab]');
            if (tab) {
                const tabName = tab.dataset.tab;
                this.handleTabClick(tabName);
            }

            // Logout
            const logoutBtn = e.target.closest('#btn-logout');
            if (logoutBtn) {
                this.handleLogout();
            }

            // Navegação carousel
            const carouselBtn = e.target.closest('.carousel-btn');
            if (carouselBtn) {
                e.stopPropagation();
                this.handleCarouselNavigation(carouselBtn);
            }

            // Botões de aprovação
            const approveBtn = e.target.closest('.btn-approve');
            if (approveBtn) {
                e.stopPropagation();
                this.handleApprove(approveBtn);
            }

            const rejectBtn = e.target.closest('.btn-reject');
            if (rejectBtn) {
                e.stopPropagation();
                this.handleReject(rejectBtn);
            }
            
            // --- NOVO: Botões de download ---
            const downloadBtn = e.target.closest('.btn-download');
            if (downloadBtn) {
                e.stopPropagation();
                this.handleDownload(downloadBtn);
            }

            // --- NOVO: Botões de compartilhar ---
            const shareBtn = e.target.closest('.btn-compartilhar');
            if (shareBtn) {
                e.stopPropagation();
                this.handleShare(shareBtn);
            }

            // Expandir/recolher legenda
            const expandBtn = e.target.closest('.btn-expand-caption');
            if (expandBtn) {
                e.stopPropagation();
                this.handleExpandCaption(expandBtn);
            }

            // Toggle de áudio em vídeos
            const video = e.target.closest('.media-video');
            if (video) {
                e.stopPropagation();
                this.handleVideoToggleMute(video);
            }
        });

        // Swipe para carousel
        this.attachCarouselSwipeEvents();
    }

    // --- MANTENHA SUAS OUTRAS FUNÇÕES AQUI (handleTabClick, loadApprovalTab, etc.) ---
    // ... (cole todas as suas outras funções que não foram modificadas aqui)

    // ====================================================================
    // ===== SEÇÃO DE DOWNLOAD (depende da correção do CORS no servidor) ===
    // ====================================================================

    async handleDownload(button) {
        const postId = button.dataset.postId;
        const post = this.posts.find(p => p.id == postId);

        if (!post || !post.post_media || post.post_media.length === 0) {
            alert('Nenhuma mídia disponível para download.');
            return;
        }

        console.log('[ApprovalActions] Iniciando download para o post:', postId);

        button.disabled = true;
        const originalHTML = button.innerHTML;
        button.innerHTML = '<div class="btn-spinner"></div> Baixando...';

        try {
            const medias = post.post_media.sort((a, b) => (a.order || 0) - (b.order || 0));

            if (medias.length === 1) {
                const media = medias[0];
                const extension = media.type === 'video' ? 'mp4' : 'jpg';
                const filename = `post_${postId}_media.${extension}`;
                await this.downloadMediaAsBlob(media.url_media, filename);
            } else {
                await this.downloadMultipleMediasAsZip(medias, postId);
            }
        } catch (error) {
            console.error('[ApprovalActions] Erro durante o download:', error);
            alert('Ocorreu um erro ao tentar baixar a mídia. Verifique se o CORS está configurado no servidor.');
        } finally {
            button.disabled = false;
            button.innerHTML = originalHTML;
        }
    }

    async downloadMediaAsBlob(url, filename) {
        try {
            // Este fetch agora deve funcionar após a configuração do CORS no servidor
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Falha na rede ao buscar a mídia: ${response.statusText}`);
            }
            const blob = await response.blob();
            const objectUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = objectUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(objectUrl);
        } catch (error) {
            console.error(`[ApprovalActions] Erro no fetch de ${url}:`, error);
            throw error;
        }
    }

    async downloadMultipleMediasAsZip(medias, postId) {
        if (typeof JSZip === 'undefined') {
            alert('Erro: A biblioteca JSZip não foi carregada.');
            throw new Error("JSZip não está definido");
        }

        const zip = new JSZip();
        const zipFilename = `post_${postId}_midias.zip`;

        const promises = medias.map(async (media) => {
            const response = await fetch(media.url_media);
            if (!response.ok) return null;
            return {
                blob: await response.blob(),
                type: media.type
            };
        });

        const results = await Promise.all(promises);

        results.forEach((result, index) => {
            if (result) {
                const extension = result.type === 'video' ? 'mp4' : 'png'; // ou jpg
                const filename = `midia_${String(index + 1).padStart(2, '0')}.${extension}`;
                zip.file(filename, result.blob);
            }
        });

        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const objectUrl = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = zipFilename;
        document.body.appendChild(a);
a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(objectUrl);
    }

    // ====================================================================
    // ===== SEÇÃO DE COMPARTILHAMENTO (NOVA LÓGICA) ======================
    // ====================================================================

    handleShare(button) {
        const postId = button.dataset.postId;
        const post = this.posts.find(p => p.id == postId);

        if (!post || !post.post_media || post.post_media.length === 0) {
            alert('Nenhuma mídia encontrada para compartilhar.');
            return;
        }

        console.log('[ApprovalActions] Preparando links para compartilhar do post:', postId);

        // Monta a string de texto com os links, como solicitado
        let shareText = 'Segue a mídia do portal Criativa\n\n';
        
        const sortedMedias = post.post_media.sort((a, b) => (a.order || 0) - (b.order || 0));
        
        sortedMedias.forEach((media, index) => {
            shareText += `Link ${index + 1}: ${media.url_media}\n`;
        });
        
        // Tenta copiar o texto para a área de transferência
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(shareText.trim())
                .then(() => {
                    alert('Links das mídias copiados para a área de transferência!');
                })
                .catch(err => {
                    console.error('[ApprovalActions] Erro ao copiar links:', err);
                    alert('Não foi possível copiar os links.');
                });
        } else {
            // Fallback para ambientes não seguros
            alert('A função de copiar não é suportada em ambientes não seguros (HTTP). Por favor, use HTTPS.');
            console.warn('[ApprovalActions] navigator.clipboard não está disponível. Ambiente não seguro.');
        }
    }
    
    // --- MANTENHA O RESTANTE DAS SUAS FUNÇÕES AQUI (handleApprove, handleReject, etc.) ---
    // ...
}