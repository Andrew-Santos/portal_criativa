// Approval Actions - Gerencia ações e lógica do painel
import { ApprovalRenderer } from './approval.renderer.js';

export class ApprovalActions {
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

            // Botões de aprovação (preparado para futura implementação)
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

    handleTabClick(tabName) {
        console.log('[ApprovalActions] Tab clicada:', tabName);
        
        // Atualizar tab ativa
        document.querySelectorAll('.tab-item').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`)?.classList.add('active');
        
        this.currentTab = tabName;

        // Carregar conteúdo da tab
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

        // Mostrar loading
        content.innerHTML = `
            <div class="loading-container">
                <div class="loading-spinner"></div>
                <p>Carregando posts...</p>
            </div>
        `;

        try {
            // Buscar posts pendentes (status != 'APROVADO')
            this.posts = await this.fetchPendingPosts();
            
            console.log('[ApprovalActions] Posts pendentes encontrados:', this.posts.length);

            // Renderizar posts
            this.renderer.renderPosts(this.posts);

            // Reattach swipe events após renderização
            setTimeout(() => this.attachCarouselSwipeEvents(), 100);

            // Attach video observers
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
            // Buscar posts de todos os clientes do usuário
            // Filtrar por status != 'APROVADO'
            // Ordenar por data de agendamento (mais antigo primeiro)
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
                .order('agendamento', { ascending: true });

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
        const content = document.getElementById('tab-content');
        if (!content) return;

        content.innerHTML = `
            <div class="empty-tab">
                <i class="ph ph-clock"></i>
                <h3>Posts Agendados</h3>
                <p>Funcionalidade em desenvolvimento</p>
            </div>
        `;
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

        // Atualizar active
        items.forEach(item => item.classList.remove('active'));
        indicators.forEach(ind => ind.classList.remove('active'));
        items[newIndex].classList.add('active');
        indicators[newIndex].classList.add('active');

        // Pausar vídeos
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

    handleApprove(button) {
        const postId = button.dataset.postId;
        console.log('[ApprovalActions] Aprovar post:', postId);
        
        // TODO: Implementar aprovação futuramente
        alert('Funcionalidade de aprovação será implementada em breve');
    }

    handleReject(button) {
        const postId = button.dataset.postId;
        console.log('[ApprovalActions] Recusar post:', postId);
        
        // TODO: Implementar recusa futuramente
        alert('Funcionalidade de recusa será implementada em breve');
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
        // Observar quando vídeos saem do viewport para mutar automaticamente
        const observerOptions = {
            root: null,
            rootMargin: '0px',
            threshold: 0.5 // 50% visível
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const video = entry.target;
                const indicator = video.parentElement.querySelector('.video-sound-indicator');
                
                // Se sair do viewport e estiver com som, mutar
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

        // Observar todos os vídeos
        document.querySelectorAll('.media-video').forEach(video => {
            observer.observe(video);
        });
    }
}