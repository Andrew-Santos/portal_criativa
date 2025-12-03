// approval.actions.js - Gerencia ações e lógica do painel (Estilo Instagram)
import { ApprovalRenderer } from './approval.renderer.js';
import { AgendadosActions } from '../agendados/agendados.actions.js';
import { CalendarioActions } from '../calendario/calendario.actions.js';
import { DriveActions } from '../drive/drive.actions.js';
import { RejectionChat } from './rejection.chat.js';

export class ApprovalActions {
    constructor(panel, authData) {
        this.panel = panel;
        this.authData = authData;
        this.renderer = new ApprovalRenderer(this);
        this.agendadosActions = null;
        this.calendarioActions = null;
        this.driveActions = null;
        this.posts = [];
        this.currentTab = 'aprovacao';
        this.clientIds = authData.clients.map(c => c.id);
        this.carouselStates = new Map();
        this.currentModal = null;
    }

    async init() {
        console.log('[ApprovalActions] Inicializando painel...');
        this.renderer.renderBase();
        await this.loadApprovalTab();
        this.attachEvents();
    }

    attachEvents() {
        document.addEventListener('click', (e) => {
            // Tabs
            const tab = e.target.closest('[data-tab]');
            if (tab) {
                this.handleTabClick(tab.dataset.tab);
                return;
            }

            // Logout
            if (e.target.closest('#btn-logout')) {
                this.handleLogout();
                return;
            }

            // Abrir modal do post (thumbnail)
            const postItem = e.target.closest('.post-item');
            if (postItem && !e.target.closest('.post-modal')) {
                const postId = postItem.dataset.postId;
                this.openPostModal(postId);
                return;
            }

            // Fechar modal
            const closeBtn = e.target.closest('.post-modal-close');
            const overlay = e.target.closest('.post-modal-overlay');
            if (closeBtn || overlay) {
                this.closePostModal();
                return;
            }

            // Ações do modal
            if (e.target.closest('.post-modal')) {
                // Ações estilo Instagram (ícones)
                const actionBtn = e.target.closest('.action-btn[data-action]');
                if (actionBtn) {
                    e.stopPropagation();
                    const action = actionBtn.dataset.action;
                    const postId = actionBtn.dataset.postId;
                    
                    switch(action) {
                        case 'approve':
                            this.handleApprove(actionBtn);
                            break;
                        case 'reject':
                            this.handleReject(actionBtn);
                            break;
                        case 'download':
                            this.handleDownload(actionBtn);
                            break;
                        case 'share':
                            this.handleShare(actionBtn);
                            break;
                    }
                    return;
                }

                // Botões principais (footer)
                const approveBtn = e.target.closest('.btn-approve');
                if (approveBtn) {
                    e.stopPropagation();
                    this.handleApprove(approveBtn);
                    return;
                }

                const rejectBtn = e.target.closest('.btn-reject');
                if (rejectBtn) {
                    e.stopPropagation();
                    this.handleReject(rejectBtn);
                    return;
                }

                // Carousel
                const carouselBtn = e.target.closest('.carousel-btn');
                if (carouselBtn) {
                    e.stopPropagation();
                    this.handleCarouselNavigation(carouselBtn);
                    return;
                }

                // Play/pause de vídeo
                const videoOverlay = e.target.closest('.video-play-overlay');
                if (videoOverlay) {
                    e.stopPropagation();
                    this.handleVideoClick(videoOverlay);
                    return;
                }
            }
        });

        // Evento de rejeição do chat
        document.addEventListener('post-rejected', (e) => {
            this.handlePostRejectedFromChat(e.detail.postId);
        });

        // ESC para fechar modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.currentModal) {
                this.closePostModal();
            }
        });
    }

    handleVideoClick(overlay) {
        const video = overlay.previousElementSibling;
        if (!video || video.tagName !== 'VIDEO') return;

        if (video.paused) {
            // Pausar outros vídeos
            document.querySelectorAll('.post-modal video').forEach(v => {
                if (v !== video && !v.paused) {
                    v.pause();
                    v.currentTime = 0;
                    const otherOverlay = v.nextElementSibling;
                    if (otherOverlay) otherOverlay.style.display = 'flex';
                }
            });
            
            video.play();
            overlay.style.display = 'none';
        } else {
            video.pause();
            overlay.style.display = 'flex';
        }
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
            case 'drive':
                this.loadDriveTab();
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
                        order,
                        url_capa
                    )
                `)
                .in('id_client', this.clientIds)
                .neq('status', 'APROVADO')
                .neq('status', 'REPROVADO')
                .neq('status', 'PUBLICADO')
                .neq('status', 'AGENDADO')
                .order('agendamento', { ascending: true });

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('[ApprovalActions] Erro ao buscar posts:', error);
            throw error;
        }
    }

    openPostModal(postId) {
        const post = this.posts.find(p => p.id == postId);
        if (!post) {
            console.error('[ApprovalActions] Post não encontrado:', postId);
            return;
        }

        console.log('[ApprovalActions] Abrindo modal para post:', postId);
        this.renderer.createPostModal(post);
        this.currentModal = postId;

        // Attach carousel events após criar o modal
        setTimeout(() => {
            this.attachCarouselSwipeEvents();
        }, 100);
    }

    closePostModal() {
        const modal = document.querySelector('.post-modal');
        if (!modal) return;

        // Pausar todos os vídeos
        modal.querySelectorAll('video').forEach(video => {
            video.pause();
            video.currentTime = 0;
        });

        modal.style.animation = 'fadeOut 0.2s ease';
        setTimeout(() => {
            modal.remove();
            document.body.classList.remove('no-scroll');
            this.currentModal = null;
        }, 200);
    }

    loadCalendarioTab() {
        if (!this.calendarioActions) {
            this.calendarioActions = new CalendarioActions(this.panel, this.authData);
        }
        this.calendarioActions.init();
    }

    loadAgendadosTab() {
        if (!this.agendadosActions) {
            this.agendadosActions = new AgendadosActions(this.panel, this.authData);
        }
        this.agendadosActions.init();
    }

    loadDriveTab() {
        if (!this.driveActions) {
            this.driveActions = new DriveActions(this.panel, this.authData);
        }
        this.driveActions.init();
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
        
        let currentIndex = this.carouselStates.get(carouselId) || 0;
        
        let newIndex;
        if (button.classList.contains('carousel-prev')) {
            newIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
        } else {
            newIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
        }

        this.navigateToSlide(container, newIndex, items.length);
    }

    navigateToSlide(container, newIndex, totalItems) {
        const carouselId = container.dataset.carouselId;
        const track = container.querySelector('.carousel-track');
        const indicators = Array.from(container.querySelectorAll('.indicator'));
        const items = Array.from(track.querySelectorAll('.carousel-item'));
        
        this.carouselStates.set(carouselId, newIndex);
        container.dataset.currentIndex = newIndex;
        
        const translateX = -(newIndex * 100);
        track.style.transform = `translateX(${translateX}%)`;
        
        indicators.forEach((ind, i) => {
            ind.classList.toggle('active', i === newIndex);
        });

        // Pausar todos os vídeos e esconder overlay
        items.forEach((item, i) => {
            const video = item.querySelector('video');
            const overlay = item.querySelector('.video-play-overlay');
            
            if (video) {
                video.pause();
                video.currentTime = 0;
            }
            
            // Mostrar overlay apenas no slide ativo
            if (overlay) {
                overlay.style.display = i === newIndex ? 'flex' : 'none';
            }
        });

        console.log(`[ApprovalActions] Navegado para slide ${newIndex + 1} de ${totalItems}`);
    }

    attachCarouselSwipeEvents() {
        document.querySelectorAll('.post-modal .carousel-container').forEach(container => {
            const carouselId = container.dataset.carouselId;
            const currentIndexFromDOM = parseInt(container.dataset.currentIndex) || 0;
            
            if (!this.carouselStates.has(carouselId)) {
                this.carouselStates.set(carouselId, currentIndexFromDOM);
            }

            let touchStartX = 0;
            let touchEndX = 0;
            let isDragging = false;

            const touchStartHandler = (e) => {
                touchStartX = e.changedTouches[0].screenX;
                touchEndX = touchStartX;
                isDragging = true;
            };

            const touchMoveHandler = (e) => {
                if (!isDragging) return;
                touchEndX = e.changedTouches[0].screenX;
            };

            const touchEndHandler = (e) => {
                if (!isDragging) return;
                isDragging = false;
                
                const threshold = 50;
                const diff = touchStartX - touchEndX;

                if (Math.abs(diff) < threshold) return;

                const currentIndex = this.carouselStates.get(carouselId) || 0;
                const items = container.querySelectorAll('.carousel-item');
                const totalItems = items.length;
                
                let newIndex;
                if (diff > 0) {
                    newIndex = (currentIndex + 1) % totalItems;
                } else {
                    newIndex = currentIndex > 0 ? currentIndex - 1 : totalItems - 1;
                }

                this.navigateToSlide(container, newIndex, totalItems);
            };

            container.addEventListener('touchstart', touchStartHandler, { passive: true });
            container.addEventListener('touchmove', touchMoveHandler, { passive: true });
            container.addEventListener('touchend', touchEndHandler, { passive: true });
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
                .update({ status: 'APROVADO', approval_date: now })
                .eq('id', postId);
            
            if (error) throw error;
            
            this.closePostModal();
            
            // Remover da lista
            this.posts = this.posts.filter(p => p.id != postId);
            
            // Remover thumbnail
            const thumbnail = document.querySelector(`.post-item[data-post-id="${postId}"]`);
            if (thumbnail) {
                thumbnail.style.animation = 'fadeOut 0.3s ease';
                setTimeout(() => {
                    thumbnail.remove();
                    if (document.querySelectorAll('.post-item').length === 0) {
                        this.renderer.renderPosts([]);
                    }
                }, 300);
            }
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
        if (!post) {
            alert('Post não encontrado.');
            return;
        }

        try {
            // Fechar modal antes de abrir chat
            this.closePostModal();
            
            const chat = new RejectionChat(postId, post);
            chat.open();
        } catch (error) {
            console.error('[ApprovalActions] Erro ao abrir chat:', error);
            alert('Erro ao abrir chat: ' + error.message);
        }
    }

    handlePostRejectedFromChat(postId) {
        // Remover da lista
        this.posts = this.posts.filter(p => p.id != postId);
        
        // Remover thumbnail
        const thumbnail = document.querySelector(`.post-item[data-post-id="${postId}"]`);
        if (thumbnail) {
            thumbnail.style.animation = 'fadeOut 0.3s ease';
            setTimeout(() => {
                thumbnail.remove();
                if (document.querySelectorAll('.post-item').length === 0) {
                    this.renderer.renderPosts([]);
                }
            }, 300);
        }
    }

    async handleDownload(button) {
        const postId = button.dataset.postId;
        const post = this.posts.find(p => p.id == postId);

        if (!post || !post.post_media || post.post_media.length === 0) {
            alert('Nenhuma mídia disponível para download.');
            return;
        }

        button.disabled = true;
        const originalHTML = button.innerHTML;
        button.innerHTML = '<i class="ph-fill ph-circle-notch" style="animation: spin 0.6s linear infinite;"></i>';

        try {
            const medias = post.post_media.sort((a, b) => (a.order || 0) - (b.order || 0));

            if (medias.length === 1) {
                const media = medias[0];
                const extension = media.type === 'video' ? 'mp4' : 'jpg';
                const filename = `post_${postId}_media.${extension}`;
                
                try {
                    await this.downloadMediaAsBlob(media.url_media, filename);
                } catch {
                    window.open(media.url_media, '_blank');
                }
            } else {
                try {
                    await this.downloadMultipleMediasAsZip(medias, postId);
                } catch (error) {
                    console.error('[ApprovalActions] Erro ao criar ZIP:', error);
                    medias.forEach(media => window.open(media.url_media, '_blank'));
                    alert('Não foi possível criar ZIP. As mídias foram abertas em novas abas.');
                }
            }
        } catch (error) {
            console.error('[ApprovalActions] Erro durante o download:', error);
            alert('Ocorreu um erro ao tentar baixar a mídia.');
        } finally {
            button.disabled = false;
            button.innerHTML = originalHTML;
        }
    }

    async downloadMediaAsBlob(url, filename) {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Falha na rede');
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(objectUrl);
    }

    async downloadMultipleMediasAsZip(medias, postId) {
        if (typeof JSZip === 'undefined') throw new Error("JSZip não está definido");

        const zip = new JSZip();
        const promises = medias.map(async (media) => {
            try {
                const response = await fetch(media.url_media);
                if (!response.ok) return null;
                return { blob: await response.blob(), type: media.type };
            } catch {
                return null;
            }
        });

        const results = await Promise.all(promises);
        results.forEach((result, index) => {
            if (result) {
                const extension = result.type === 'video' ? 'mp4' : 'png';
                zip.file(`midia_${String(index + 1).padStart(2, '0')}.${extension}`, result.blob);
            }
        });

        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const objectUrl = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = `post_${postId}_midias.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(objectUrl);
    }

    handleShare(button) {
        const postId = button.dataset.postId;
        const post = this.posts.find(p => p.id == postId);

        if (!post || !post.post_media || post.post_media.length === 0) {
            alert('Nenhuma mídia encontrada para compartilhar.');
            return;
        }

        let shareText = 'Segue a mídia do portal Criativa\n\n';
        const sortedMedias = post.post_media.sort((a, b) => (a.order || 0) - (b.order || 0));
        sortedMedias.forEach((media, index) => {
            shareText += `Link ${index + 1}: ${media.url_media}\n`;
        });
        
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(shareText.trim())
                .then(() => {
                    // Feedback visual
                    const originalHTML = button.innerHTML;
                    button.innerHTML = '<i class="ph-fill ph-check"></i>';
                    setTimeout(() => {
                        button.innerHTML = originalHTML;
                    }, 1500);
                })
                .catch(() => alert('Não foi possível copiar os links.'));
        } else {
            alert('Função de copiar não suportada neste ambiente.');
        }
    }
}
