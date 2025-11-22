// approval.actions.js - Gerencia ações e lógica do painel
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

            const videoOverlay = e.target.closest('.video-play-overlay');
            const video = e.target.closest('.media-video');
            
            if (videoOverlay || video) {
                e.stopPropagation();
                const videoElement = videoOverlay 
                    ? videoOverlay.previousElementSibling 
                    : video;
                this.handleVideoClick(videoElement);
            }
        });

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
            
            setTimeout(() => {
                this.attachCarouselSwipeEvents();
                this.attachVideoObservers();
            }, 100);
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

    loadCalendarioTab() {
        console.log('[ApprovalActions] Carregando aba de calendário...');
        
        if (!this.calendarioActions) {
            this.calendarioActions = new CalendarioActions(this.panel, this.authData);
        }
        
        this.calendarioActions.init();
    }

    loadAgendadosTab() {
        console.log('[ApprovalActions] Carregando aba de agendados...');
        
        if (!this.agendadosActions) {
            this.agendadosActions = new AgendadosActions(this.panel, this.authData);
        }
        
        this.agendadosActions.init();
    }

    loadDriveTab() {
        console.log('[ApprovalActions] Carregando aba de drive...');
        
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
        
        this.carouselStates.set(carouselId, newIndex);
        container.dataset.currentIndex = newIndex;
        
        const translateX = -(newIndex * 100);
        track.style.transform = `translateX(${translateX}%)`;
        
        indicators.forEach((ind, i) => {
            ind.classList.toggle('active', i === newIndex);
        });

        const videos = track.querySelectorAll('video');
        videos.forEach(video => {
            video.pause();
            video.currentTime = 0;
            const overlay = video.parentElement?.querySelector('.video-play-overlay');
            if (overlay) overlay.style.display = 'flex';
        });

        console.log(`[ApprovalActions] Navegado para slide ${newIndex + 1} de ${totalItems}`);
    }

    attachCarouselSwipeEvents() {
        setTimeout(() => {
            document.querySelectorAll('.carousel-container').forEach(container => {
                const carouselId = container.dataset.carouselId;
                const currentIndexFromDOM = parseInt(container.dataset.currentIndex) || 0;
                
                if (!this.carouselStates.has(carouselId)) {
                    this.carouselStates.set(carouselId, currentIndexFromDOM);
                }

                let touchStartX = 0;
                let touchEndX = 0;
                let isDragging = false;

                const oldStartHandler = container._touchStartHandler;
                const oldMoveHandler = container._touchMoveHandler;
                const oldEndHandler = container._touchEndHandler;
                
                if (oldStartHandler) container.removeEventListener('touchstart', oldStartHandler);
                if (oldMoveHandler) container.removeEventListener('touchmove', oldMoveHandler);
                if (oldEndHandler) container.removeEventListener('touchend', oldEndHandler);

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

                container._touchStartHandler = touchStartHandler;
                container._touchMoveHandler = touchMoveHandler;
                container._touchEndHandler = touchEndHandler;
            });
        }, 100);
    }

    handleVideoClick(video) {
        if (!video) return;
        const overlay = video.parentElement.querySelector('.video-play-overlay');
        
        if (video.paused) {
            document.querySelectorAll('.media-video').forEach(v => {
                if (v !== video && !v.paused) {
                    v.pause();
                    v.currentTime = 0;
                    const otherOverlay = v.parentElement.querySelector('.video-play-overlay');
                    if (otherOverlay) otherOverlay.style.display = 'flex';
                }
            });
            video.play();
            if (overlay) overlay.style.display = 'none';
        } else {
            video.pause();
            video.currentTime = 0;
            if (overlay) overlay.style.display = 'flex';
        }
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
            
            const card = button.closest('.post-card');
            card.style.animation = 'fadeOut 0.3s ease';
            setTimeout(() => {
                card.remove();
                if (document.querySelectorAll('.post-card').length === 0) {
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
        if (!post) { alert('Post não encontrado.'); return; }

        try {
            const chat = new RejectionChat(postId, post);
            chat.open();
        } catch (error) {
            console.error('[ApprovalActions] Erro ao abrir chat:', error);
            alert('Erro ao abrir chat: ' + error.message);
        }
    }

    handlePostRejectedFromChat(postId) {
        const card = document.querySelector(`.post-card[data-post-id="${postId}"]`);
        if (card) {
            card.style.animation = 'fadeOut 0.3s ease';
            setTimeout(() => {
                card.remove();
                if (document.querySelectorAll('.post-card').length === 0) {
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
        button.innerHTML = '<div class="btn-spinner"></div> Baixando...';

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
                    alert('Download bloqueado por CORS. A mídia foi aberta em nova aba.');
                }
            } else {
                try {
                    await this.downloadMultipleMediasAsZip(medias, postId);
                } catch {
                    this.showMediaLinksModal(medias, postId);
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
            const response = await fetch(media.url_media);
            if (!response.ok) return null;
            return { blob: await response.blob(), type: media.type };
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

    showMediaLinksModal(medias, postId) {
        const modal = document.createElement('div');
        modal.className = 'media-links-modal';
        modal.innerHTML = `
            <div class="modal-overlay"></div>
            <div class="modal-content">
                <h3>📥 Mídias para Download</h3>
                <p>Toque em cada link para baixar:</p>
                <div class="media-links-list">
                    ${medias.map((media, i) => `
                        <a href="${media.url_media}" download target="_blank" class="media-link-item">
                            ${media.type === 'video' ? 'Vídeo' : 'Imagem'} ${i + 1}
                            <i class="ph ph-download-simple"></i>
                        </a>
                    `).join('')}
                </div>
                <button class="btn-close-modal">Fechar</button>
            </div>
        `;
        document.body.appendChild(modal);
        modal.querySelector('.btn-close-modal').addEventListener('click', () => modal.remove());
        modal.querySelector('.modal-overlay').addEventListener('click', () => modal.remove());
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
                .then(() => alert('Links das mídias copiados!'))
                .catch(() => alert('Não foi possível copiar os links.'));
        } else {
            alert('Função de copiar não suportada neste ambiente.');
        }
    }

    handleExpandCaption(button) {
        const postId = button.dataset.postId;
        const caption = document.querySelector(`.post-caption[data-post-id="${postId}"]`);
        if (!caption) return;

        const isCollapsed = caption.classList.contains('post-caption-collapsed');
        if (isCollapsed) {
            caption.classList.remove('post-caption-collapsed');
            button.innerHTML = '<i class="ph ph-caret-up"></i> Ver menos';
        } else {
            caption.classList.add('post-caption-collapsed');
            button.innerHTML = '<i class="ph ph-caret-down"></i> Ver mais';
        }
    }

    attachVideoObservers() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const video = entry.target;
                const overlay = video.parentElement.querySelector('.video-play-overlay');
                if (!entry.isIntersecting && !video.paused) {
                    video.pause();
                    video.currentTime = 0;
                    if (overlay) overlay.style.display = 'flex';
                }
            });
        }, { threshold: 0.5 });

        document.querySelectorAll('.media-video').forEach(video => observer.observe(video));
    }
}