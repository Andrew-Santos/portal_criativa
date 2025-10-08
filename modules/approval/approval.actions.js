// approval.actions.js

// Approval Actions - Gerencia ações e lógica do painel
import { ApprovalRenderer } from './approval.renderer.js';
import { AgendadosActions } from '../agendados/agendados.actions.js';
import { RejectionChat } from './rejection.chat.js';

export class ApprovalActions {
    constructor(panel, authData) {
        this.panel = panel;
        this.authData = authData;
        this.renderer = new ApprovalRenderer(this);
        this.agendadosActions = null;
        this.posts = [];
        this.currentTab = 'aprovacao';
        this.clientIds = authData.clients.map(c => c.id);
    }

    async init() {
        console.log('[ApprovalActions] Inicializando painel...');
        console.log('[ApprovalActions] IDs dos clientes:', this.clientIds);
        
        this.renderer.renderBase();
        await this.loadApprovalTab();
        this.attachEvents();
    }

    attachEvents() {
        document.addEventListener('click', (e) => {
            const tab = e.target.closest('[data-tab]');
            if (tab) {
                const tabName = tab.dataset.tab;
                this.handleTabClick(tabName);
            }

            const logoutBtn = e.target.closest('#btn-logout');
            if (logoutBtn) {
                this.handleLogout();
            }

            const carouselBtn = e.target.closest('.carousel-btn');
            if (carouselBtn) {
                e.stopPropagation();
                this.handleCarouselNavigation(carouselBtn);
            }

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
            
            const downloadBtn = e.target.closest('.btn-download');
            if (downloadBtn) {
                e.stopPropagation();
                this.handleDownload(downloadBtn);
            }

            const shareBtn = e.target.closest('.btn-compartilhar');
            if (shareBtn) {
                e.stopPropagation();
                this.handleShare(shareBtn);
            }

            const expandBtn = e.target.closest('.btn-expand-caption');
            if (expandBtn) {
                e.stopPropagation();
                this.handleExpandCaption(expandBtn);
            }

            const video = e.target.closest('.media-video');
            if (video) {
                e.stopPropagation();
                this.handleVideoToggleMute(video);
            }
        });

        // Listener para evento de post rejeitado via chat
        document.addEventListener('post-rejected', (e) => {
            this.handlePostRejectedFromChat(e.detail.postId);
        });

        this.attachCarouselSwipeEvents();
    }

    handleTabClick(tabName) {
        console.log('[ApprovalActions] Tab clicada:', tabName);
        
        document.querySelectorAll('.tab-item').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`)?.classList.add('active');
        
        this.currentTab = tabName;

        switch (tabName) {
            case 'calendario':
                this.loadCalendarioTab();
                break;
            case 'agendados':
                this.loadAgendadosTab();
                break;
            case 'aprovacao':
                this.loadApprovalTab();
                break;
        }
    }

    async loadApprovalTab() {
        const content = document.getElementById('tab-content');
        if (!content) return;

        content.innerHTML = `
            <div class="loading-container">
                <div class="loading-spinner"></div>
                <p>Carregando posts...</p>
            </div>
        `;

        try {
            this.posts = await this.fetchPendingPosts();
            console.log('[ApprovalActions] Posts pendentes encontrados:', this.posts.length);
            this.renderer.renderPosts(this.posts);
            setTimeout(() => this.attachCarouselSwipeEvents(), 100);
            this.attachVideoObservers();
        } catch (error) {
            console.error('[ApprovalActions] Erro ao carregar posts:', error);
            content.innerHTML = `
                <div class="error-container">
                    <i class="ph ph-warning-circle"></i>
                    <h3>Erro ao carregar posts</h3>
                    <p>${error.message}</p>
                </div>
            `;
        }
    }

    async fetchPendingPosts() {
        try {
            const { data, error } = await window.supabaseClient
                .from('post')
                .select(`
                    *,
                    client:id_client (
                        id,
                        users,
                        profile_photo
                    ),
                    post_media (
                        id,
                        type,
                        url_media,
                        order
                    )
                `)
                .in('id_client', this.clientIds)
                .neq('status', 'APROVADO')
                .neq('status', 'REPROVADO')
                .order('agendamento', { ascending: false });

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('[ApprovalActions] Erro ao buscar posts:', error);
            throw error;
        }
    }

    loadCalendarioTab() {
        const content = document.getElementById('tab-content');
        if (!content) return;

        content.innerHTML = `
            <div class="empty-tab">
                <i class="ph ph-calendar-blank"></i>
                <h3>Calendário</h3>
                <p>Funcionalidade em desenvolvimento</p>
            </div>
        `;
    }

    loadAgendadosTab() {
        console.log('[ApprovalActions] Carregando aba de agendados...');
        
        if (!this.agendadosActions) {
            this.agendadosActions = new AgendadosActions(this.panel, this.authData);
        }
        
        this.agendadosActions.init();
    }

    handleLogout() {
        if (confirm('Deseja realmente sair?')) {
            this.panel.logout();
        }
    }

    handleCarouselNavigation(button) {
        const carouselId = button.dataset.carousel;
        const container = document.querySelector(`[data-carousel-id="${carouselId}"]`);
        if (!container) return;

        const track = container.querySelector('.carousel-track');
        const items = Array.from(track.querySelectorAll('.carousel-item'));
        const indicators = Array.from(container.querySelectorAll('.indicator'));
        const currentIndex = items.findIndex(item => item.classList.contains('active'));
        
        let newIndex;
        if (button.classList.contains('carousel-prev')) {
            newIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
        } else {
            newIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
        }

        items.forEach(item => item.classList.remove('active'));
        indicators.forEach(ind => ind.classList.remove('active'));
        items[newIndex].classList.add('active');
        indicators[newIndex].classList.add('active');

        items.forEach((item, index) => {
            const video = item.querySelector('video');
            if (video) {
                if (index === newIndex) {
                    video.currentTime = 0;
                } else {
                    video.pause();
                    video.currentTime = 0;
                }
            }
        });
    }

    attachCarouselSwipeEvents() {
        document.querySelectorAll('.carousel-container').forEach(container => {
            const clone = container.cloneNode(true);
            container.parentNode.replaceChild(clone, container);
        });

        setTimeout(() => {
            document.querySelectorAll('.carousel-container').forEach(container => {
                let touchStartX = 0;
                let touchEndX = 0;

                container.addEventListener('touchstart', (e) => {
                    touchStartX = e.changedTouches[0].screenX;
                }, { passive: true });

                container.addEventListener('touchend', (e) => {
                    touchEndX = e.changedTouches[0].screenX;
                    this.handleCarouselSwipe(container, touchStartX, touchEndX);
                }, { passive: true });
            });
        }, 100);
    }

    handleCarouselSwipe(container, startX, endX) {
        const threshold = 50;
        const diff = startX - endX;

        if (Math.abs(diff) < threshold) return;

        const track = container.querySelector('.carousel-track');
        const items = Array.from(track.querySelectorAll('.carousel-item'));
        const indicators = Array.from(container.querySelectorAll('.indicator'));
        const currentIndex = items.findIndex(item => item.classList.contains('active'));

        let newIndex;
        if (diff > 0) {
            newIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
        } else {
            newIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
        }

        items.forEach(item => item.classList.remove('active'));
        indicators.forEach(ind => ind.classList.remove('active'));
        items[newIndex].classList.add('active');
        indicators[newIndex].classList.add('active');

        items.forEach((item, index) => {
            const video = item.querySelector('video');
            if (video) {
                if (index === newIndex) {
                    video.currentTime = 0;
                } else {
                    video.pause();
                    video.currentTime = 0;
                }
            }
        });
    }

    async handleApprove(button) {
        const postId = button.dataset.postId;
        
        if (!confirm('Deseja aprovar este post?')) return;
        
        button.disabled = true;
        const originalHTML = button.innerHTML;
        button.innerHTML = '<div class="btn-spinner"></div> Aprovando...';
        
        try {
            const now = new Date().toISOString();
            
            const { error } = await window.supabaseClient
                .from('post')
                .update({
                    status: 'APROVADO',
                    approval_date: now
                })
                .eq('id', postId);
            
            if (error) throw error;
            
            console.log('[ApprovalActions] Post aprovado:', postId);
            
            const card = button.closest('.post-card');
            card.style.animation = 'fadeOut 0.3s ease';
            setTimeout(() => {
                card.remove();
                const remaining = document.querySelectorAll('.post-card').length;
                if (remaining === 0) {
                    this.renderer.renderPosts([]);
                }
            }, 300);
            
        } catch (error) {
            console.error('[ApprovalActions] Erro ao aprovar:', error);
            alert('Erro ao aprovar post. Tente novamente.');
            button.disabled = false;
            button.innerHTML = originalHTML;
        }
    }

    async handleReject(button) {
        const postId = button.dataset.postId;
        const post = this.posts.find(p => p.id == postId);
        
        console.log('[ApprovalActions] handleReject chamado para post:', postId);
        console.log('[ApprovalActions] Post encontrado:', post);
        console.log('[ApprovalActions] RejectionChat disponível?', typeof RejectionChat);
        
        if (!post) {
            alert('Post não encontrado.');
            return;
        }

        try {
            // Abrir modal de chat
            const chat = new RejectionChat(postId, post);
            console.log('[ApprovalActions] Instância do chat criada:', chat);
            chat.open();
        } catch (error) {
            console.error('[ApprovalActions] Erro ao abrir chat:', error);
            alert('Erro ao abrir chat de rejeição. Verifique o console: ' + error.message);
        }
    }

    handlePostRejectedFromChat(postId) {
        console.log('[ApprovalActions] Post rejeitado via chat:', postId);
        
        // Remover card da lista
        const card = document.querySelector(`.post-card[data-post-id="${postId}"]`);
        if (card) {
            card.style.animation = 'fadeOut 0.3s ease';
            setTimeout(() => {
                card.remove();
                
                // Verificar se ficou vazio
                const remaining = document.querySelectorAll('.post-card').length;
                if (remaining === 0) {
                    this.renderer.renderPosts([]);
                }
            }, 300);
        }
    }

    /**
     * Gerencia o download de mídias de um post
     * @param {HTMLElement} button - Botão de download clicado
     * 
     * Fluxo:
     * 1. Identifica o post e valida se possui mídias
     * 2. Desabilita o botão e mostra feedback visual
     * 3. Ordena as mídias pela ordem correta
     * 4. Para UMA mídia: tenta baixar via blob (bypass CORS)
     * 5. Para MÚLTIPLAS mídias: tenta criar ZIP com todas
     * 6. Se CORS bloquear: fallback para abrir em nova aba ou modal com links
     * 7. Restaura o botão ao estado original
     */
    async handleDownload(button) {
        // 1. IDENTIFICAR POST E VALIDAR MÍDIAS
        const postId = button.dataset.postId; // Pega o ID do post do atributo data-post-id
        const post = this.posts.find(p => p.id == postId); // Busca o post completo na lista

        // Se não encontrou o post ou não tem mídias, aborta
        if (!post || !post.post_media || post.post_media.length === 0) {
            alert('Nenhuma mídia disponível para download.');
            return;
        }

        console.log('[ApprovalActions] Iniciando download para o post:', postId);

        // 2. DESABILITAR BOTÃO E MOSTRAR FEEDBACK VISUAL
        button.disabled = true; // Impede cliques múltiplos
        const originalHTML = button.innerHTML; // Salva conteúdo original para restaurar depois
        button.innerHTML = '<div class="btn-spinner"></div> Baixando...'; // Mostra spinner animado

        try {
            // 3. ORDENAR MÍDIAS PELA ORDEM CORRETA
            // Ordena as mídias pelo campo 'order' (mídias sem order ficam no início)
            const medias = post.post_media.sort((a, b) => (a.order || 0) - (b.order || 0));

            // 4. DOWNLOAD DE UMA ÚNICA MÍDIA
            if (medias.length === 1) {
                const media = medias[0];
                // Define extensão baseada no tipo (video = mp4, imagem = jpg)
                const extension = media.type === 'video' ? 'mp4' : 'jpg';
                const filename = `post_${postId}_media.${extension}`;
                
                try {
                    // TENTA BAIXAR VIA BLOB (método mais confiável)
                    // Faz fetch da mídia, converte para blob e força download
                    await this.downloadMediaAsBlob(media.url_media, filename);
                } catch (corsError) {
                    // SE CORS BLOQUEAR: abre em nova aba como fallback
                    console.warn('[ApprovalActions] CORS bloqueou fetch, abrindo em nova aba');
                    window.open(media.url_media, '_blank');
                    alert('Download bloqueado por CORS. A mídia foi aberta em nova aba. Use "Salvar como..." para baixar.');
                }
            } 
            // 5. DOWNLOAD DE MÚLTIPLAS MÍDIAS
            else {
                try {
                    // TENTA CRIAR UM ARQUIVO ZIP com todas as mídias
                    // Usa a biblioteca JSZip para empacotar tudo
                    await this.downloadMultipleMediasAsZip(medias, postId);
                } catch (corsError) {
                    // SE CORS BLOQUEAR: mostra modal com links individuais
                    console.warn('[ApprovalActions] CORS bloqueou ZIP, mostrando links');
                    this.showMediaLinksModal(medias, postId);
                }
            }
        } catch (error) {
            // TRATAMENTO DE ERRO GERAL
            console.error('[ApprovalActions] Erro durante o download:', error);
            alert('Ocorreu um erro ao tentar baixar a mídia.');
        } finally {
            // 7. SEMPRE RESTAURAR O BOTÃO (mesmo se der erro)
            button.disabled = false; // Reabilita o botão
            button.innerHTML = originalHTML; // Restaura texto/ícone original
        }
    }

    /**
     * Baixa uma mídia individual usando fetch + blob
     * Este método tenta fazer bypass de CORS convertendo a resposta para blob
     * @param {string} url - URL da mídia
     * @param {string} filename - Nome do arquivo para download
     */
    async downloadMediaAsBlob(url, filename) {
        try {
            // Faz requisição para buscar a mídia
            const response = await fetch(url);
            
            // Se a resposta não for OK (200-299), lança erro
            if (!response.ok) {
                throw new Error(`Falha na rede ao buscar a mídia: ${response.statusText}`);
            }
            
            // Converte a resposta para blob (Binary Large Object)
            const blob = await response.blob();
            
            // Cria uma URL temporária do blob
            const objectUrl = URL.createObjectURL(blob);
            
            // Cria elemento <a> invisível para forçar download
            const a = document.createElement('a');
            a.href = objectUrl;
            a.download = filename; // Nome do arquivo
            document.body.appendChild(a);
            a.click(); // Simula clique para iniciar download
            document.body.removeChild(a);
            
            // Libera a memória da URL temporária
            URL.revokeObjectURL(objectUrl);
        } catch (error) {
            console.error(`[ApprovalActions] Erro no fetch de ${url}:`, error);
            throw error; // Repassa o erro para tratamento superior
        }
    }

    /**
     * Baixa múltiplas mídias em um arquivo ZIP
     * @param {Array} medias - Array de objetos de mídia
     * @param {string} postId - ID do post
     */
    async downloadMultipleMediasAsZip(medias, postId) {
        // Verifica se a biblioteca JSZip está carregada
        if (typeof JSZip === 'undefined') {
            alert('Erro: A biblioteca JSZip não foi carregada.');
            throw new Error("JSZip não está definido");
        }

        // Cria nova instância do ZIP
        const zip = new JSZip();
        const zipFilename = `post_${postId}_midias.zip`;

        // Cria array de promises para baixar todas as mídias em paralelo
        const promises = medias.map(async (media) => {
            const response = await fetch(media.url_media);
            if (!response.ok) return null; // Se falhar, retorna null
            return {
                blob: await response.blob(),
                type: media.type
            };
        });

        // Aguarda todas as promises resolverem
        const results = await Promise.all(promises);

        // Adiciona cada mídia ao ZIP
        results.forEach((result, index) => {
            if (result) {
                const extension = result.type === 'video' ? 'mp4' : 'png';
                const filename = `midia_${String(index + 1).padStart(2, '0')}.${extension}`;
                zip.file(filename, result.blob);
            }
        });

        // Gera o arquivo ZIP
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        
        // Cria URL temporária e força download
        const objectUrl = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = zipFilename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(objectUrl);
    }

    /**
     * Mostra modal com links para download manual (usado no mobile quando CORS bloqueia)
     * @param {Array} medias - Array de mídias
     * @param {string} postId - ID do post
     */
    showMediaLinksModal(medias, postId) {
        const modal = document.createElement('div');
        modal.className = 'media-links-modal';
        modal.innerHTML = `
            <div class="modal-overlay"></div>
            <div class="modal-content">
                <h3>📥 Mídias para Download</h3>
                <p>Toque em cada link para baixar:</p>
                <div class="media-links-list">
                    ${medias.map((media, i) => {
                        const extension = media.type === 'video' ? 'Vídeo' : 'Imagem';
                        return `
                            <a href="${media.url_media}" 
                               download="post_${postId}_media_${i + 1}" 
                               target="_blank"
                               rel="noopener noreferrer"
                               class="media-link-item">
                                ${extension} ${i + 1}
                                <i class="ph ph-download-simple"></i>
                            </a>
                        `;
                    }).join('')}
                </div>
                <button class="btn-close-modal">Fechar</button>
            </div>
        `;

        document.body.appendChild(modal);

        // Fechar modal ao clicar no botão
        modal.querySelector('.btn-close-modal').addEventListener('click', () => {
            modal.remove();
        });

        // Fechar modal ao clicar no overlay
        modal.querySelector('.modal-overlay').addEventListener('click', () => {
            modal.remove();
        });
    }

    handleShare(button) {
        const postId = button.dataset.postId;
        const post = this.posts.find(p => p.id == postId);

        if (!post || !post.post_media || post.post_media.length === 0) {
            alert('Nenhuma mídia encontrada para compartilhar.');
            return;
        }

        console.log('[ApprovalActions] Preparando links para compartilhar do post:', postId);

        let shareText = 'Segue a mídia do portal Criativa\n\n';
        
        const sortedMedias = post.post_media.sort((a, b) => (a.order || 0) - (b.order || 0));
        
        sortedMedias.forEach((media, index) => {
            shareText += `Link ${index + 1}: ${media.url_media}\n`;
        });
        
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
            alert('A função de copiar não é suportada em ambientes não seguros (HTTP). Por favor, use HTTPS ou Informe ao Administrador do sistema.');
            console.warn('[ApprovalActions] navigator.clipboard não está disponível. Ambiente não seguro.');
        }
    }

    handleExpandCaption(button) {
        const postId = button.dataset.postId;
        console.log('[ApprovalActions] Expandir legenda do post:', postId);
        
        const caption = document.querySelector(`.post-caption[data-post-id="${postId}"]`);
        
        if (!caption) {
            console.error('[ApprovalActions] Legenda não encontrada para post:', postId);
            return;
        }

        const isCollapsed = caption.classList.contains('post-caption-collapsed');
        
        if (isCollapsed) {
            caption.classList.remove('post-caption-collapsed');
            button.innerHTML = '<i class="ph ph-caret-up"></i> Ver menos';
        } else {
            caption.classList.add('post-caption-collapsed');
            button.innerHTML = '<i class="ph ph-caret-down"></i> Ver mais';
        }
    }

    handleVideoToggleMute(video) {
        const indicator = video.parentElement.querySelector('.video-sound-indicator');
        
        if (video.muted) {
            video.muted = false;
            if (indicator) {
                indicator.classList.remove('muted');
                indicator.innerHTML = '<i class="ph-fill ph-speaker-high"></i>';
            }
            console.log('[ApprovalActions] Vídeo com som');
        } else {
            video.muted = true;
            if (indicator) {
                indicator.classList.add('muted');
                indicator.innerHTML = '<i class="ph-fill ph-speaker-slash"></i>';
            }
            console.log('[ApprovalActions] Vídeo mutado');
        }
    }

    attachVideoObservers() {
        const observerOptions = {
            root: null,
            rootMargin: '0px',
            threshold: 0.5
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const video = entry.target;
                const indicator = video.parentElement.querySelector('.video-sound-indicator');
                
                if (!entry.isIntersecting && !video.muted) {
                    video.muted = true;
                    if (indicator) {
                        indicator.classList.add('muted');
                        indicator.innerHTML = '<i class="ph-fill ph-speaker-slash"></i>';
                    }
                    console.log('[ApprovalActions] Vídeo saiu do viewport - mutado');
                }
            });
        }, observerOptions);

        document.querySelectorAll('.media-video').forEach(video => {
            observer.observe(video);
        });
    }
}
