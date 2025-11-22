// agendados.actions.js

// Agendados Actions - Gerencia posts aprovados
import { AgendadosRenderer } from './agendados.renderer.js';

export class AgendadosActions {
    constructor(panel, authData) {
        this.panel = panel;
        this.authData = authData;
        this.renderer = new AgendadosRenderer(this);
        this.posts = [];
        this.clientIds = authData.clients.map(c => c.id);
        this.currentPreview = null;
        this.previewEventHandlers = null;
    }

    async init() {
        console.log('[AgendadosActions] Inicializando...');
        await this.loadApprovedPosts();
        this.attachListEvents();
    }

    async loadApprovedPosts() {
        const content = document.getElementById('tab-content');
        if (!content) return;

        content.innerHTML = `
            <div class="loading-container">
                <div class="loading-spinner"></div>
                <p>Carregando posts agendados...</p>
            </div>
        `;

        try {
            this.posts = await this.fetchApprovedPosts();
            console.log('[AgendadosActions] Posts aprovados encontrados:', this.posts.length);
            this.renderer.renderPosts(this.posts);
        } catch (error) {
            console.error('[AgendadosActions] Erro ao carregar posts:', error);
            content.innerHTML = `
                <div class="error-container">
                    <i class="ph ph-warning-circle"></i>
                    <h3>Erro ao carregar posts</h3>
                    <p>${error.message}</p>
                </div>
            `;
        }
    }

    async fetchApprovedPosts() {
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
                .in('status', ['APROVADO', 'AGENDADO'])
                .order('agendamento', { ascending: false });

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('[AgendadosActions] Erro ao buscar posts:', error);
            throw error;
        }
    }

    attachListEvents() {
        // Delegação de eventos na lista
        const content = document.getElementById('tab-content');
        if (!content) return;

        content.addEventListener('click', (e) => {
            const listItem = e.target.closest('.agendado-item');
            if (listItem) {
                e.preventDefault();
                e.stopPropagation();
                const postId = listItem.dataset.postId;
                this.openPreview(postId);
            }
        });
    }

    openPreview(postId) {
        const post = this.posts.find(p => p.id == postId);
        if (!post) return;

        console.log('[AgendadosActions] Abrindo preview do post:', postId);

        // Limpar preview anterior se existir
        this.closePreview();

        this.currentPreview = post;
        this.renderer.renderPreview(post);

        // Bloquear scroll do body
        document.body.style.overflow = 'hidden';

        // Aguardar renderização e então anexar eventos
        setTimeout(() => {
            this.attachPreviewEvents();
        }, 100);
    }

    attachPreviewEvents() {
        const preview = document.getElementById('post-preview');
        if (!preview) return;

        console.log('[AgendadosActions] Anexando eventos do preview');

        // Guardar referências dos handlers
        this.previewEventHandlers = {
            handleClose: (e) => {
                const closeBtn = e.target.closest('.preview-close');
                const overlay = e.target.closest('.preview-overlay');
                
                if (closeBtn || overlay) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.closePreview();
                }
            },

            handleCarousel: (e) => {
                const carouselBtn = e.target.closest('.preview-carousel-btn');
                
                if (carouselBtn) {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    const isPrev = carouselBtn.classList.contains('preview-carousel-prev');
                    this.navigateCarousel(isPrev ? -1 : 1);
                }
            },

            handleKeydown: (e) => {
                if (e.key === 'Escape') {
                    this.closePreview();
                }
            }
        };

        // Adicionar eventos
        preview.addEventListener('click', this.previewEventHandlers.handleClose);
        preview.addEventListener('click', this.previewEventHandlers.handleCarousel);
        document.addEventListener('keydown', this.previewEventHandlers.handleKeydown);

        // Swipe events
        this.attachPreviewSwipe();
    }

    navigateCarousel(direction) {
        const container = document.querySelector('.preview-carousel-container');
        if (!container) return;

        const track = container.querySelector('.preview-carousel-track');
        const items = Array.from(track.querySelectorAll('.preview-carousel-item'));
        const indicators = Array.from(container.querySelectorAll('.preview-indicator'));
        const currentIndex = items.findIndex(item => item.classList.contains('active'));

        if (currentIndex === -1) return;

        let newIndex;
        if (direction > 0) {
            // Próxima
            newIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
        } else {
            // Anterior
            newIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
        }

        console.log('[AgendadosActions] Navegando de', currentIndex, 'para', newIndex);

        // Atualizar active
        items.forEach((item, idx) => {
            item.classList.toggle('active', idx === newIndex);
        });
        
        indicators.forEach((ind, idx) => {
            ind.classList.toggle('active', idx === newIndex);
        });

        // Gerenciar vídeos
        items.forEach((item, index) => {
            const video = item.querySelector('video');
            if (video) {
                if (index === newIndex) {
                    video.currentTime = 0;
                    video.play().catch(e => console.log('Autoplay bloqueado:', e));
                } else {
                    video.pause();
                    video.currentTime = 0;
                }
            }
        });
    }

    attachPreviewSwipe() {
        const container = document.querySelector('.preview-carousel-container');
        if (!container) return;

        let touchStartX = 0;
        let touchEndX = 0;

        const handleTouchStart = (e) => {
            touchStartX = e.changedTouches[0].screenX;
        };

        const handleTouchEnd = (e) => {
            touchEndX = e.changedTouches[0].screenX;
            this.handlePreviewSwipe(touchStartX, touchEndX);
        };

        // Remover listeners antigos se existirem
        container.removeEventListener('touchstart', handleTouchStart);
        container.removeEventListener('touchend', handleTouchEnd);

        // Adicionar novos listeners
        container.addEventListener('touchstart', handleTouchStart, { passive: true });
        container.addEventListener('touchend', handleTouchEnd, { passive: true });

        console.log('[AgendadosActions] Swipe events anexados');
    }

    handlePreviewSwipe(startX, endX) {
        const threshold = 50;
        const diff = startX - endX;

        if (Math.abs(diff) < threshold) return;

        console.log('[AgendadosActions] Swipe detectado:', diff > 0 ? 'esquerda' : 'direita');

        if (diff > 0) {
            // Swipe para esquerda = próxima
            this.navigateCarousel(1);
        } else {
            // Swipe para direita = anterior
            this.navigateCarousel(-1);
        }
    }

    closePreview() {
        console.log('[AgendadosActions] Fechando preview');

        const preview = document.getElementById('post-preview');
        if (!preview) return;

        // Remover event listeners
        if (this.previewEventHandlers) {
            preview.removeEventListener('click', this.previewEventHandlers.handleClose);
            preview.removeEventListener('click', this.previewEventHandlers.handleCarousel);
            document.removeEventListener('keydown', this.previewEventHandlers.handleKeydown);
            this.previewEventHandlers = null;
        }

        // Pausar todos os vídeos
        preview.querySelectorAll('video').forEach(video => {
            video.pause();
            video.currentTime = 0;
        });

        // Animação de saída
        preview.style.animation = 'fadeOut 0.3s ease';
        
        setTimeout(() => {
            preview.remove();
            this.currentPreview = null;
            document.body.style.overflow = '';
        }, 300);
    }

    destroy() {
        // Cleanup quando trocar de aba
        this.closePreview();
        const content = document.getElementById('tab-content');
        if (content) {
            content.innerHTML = '';
        }
    }

}
