// Approval Renderer - Renderização da interface
export class ApprovalRenderer {
    constructor(actions) {
        this.actions = actions;
        this.container = actions.panel.container;
    }

    renderBase() {
        this.container.innerHTML = `
            <div class="approval-panel">
                <!-- Header -->
                <header class="panel-header">
                    <div class="header-content">
                        <h1>
                            <i class="ph ph-check-circle"></i>
                            Aprovação
                        </h1>
                        <p class="header-subtitle">@${this.getUsernames()}</p>
                    </div>
                </header>

                <!-- Tabs -->
                <nav class="tabs-nav">
                    <button class="tab-item" data-tab="calendario">
                        <i class="ph ph-calendar-blank"></i>
                        <span>Calendário</span>
                    </button>
                    <button class="tab-item" data-tab="agendados">
                        <i class="ph ph-clock"></i>
                        <span>Agendados</span>
                    </button>
                    <button class="tab-item active" data-tab="aprovacao">
                        <i class="ph ph-check-square"></i>
                        <span>Aprovação</span>
                    </button>
                    <button class="tab-item" id="btn-logout">
                        <i class="ph ph-sign-out"></i>
                        <span>Sair</span>
                    </button>
                </nav>

                <!-- Content -->
                <main class="tab-content" id="tab-content"></main>
            </div>
        `;
    }

    getUsernames() {
        const clients = this.actions.authData.clients;
        if (clients.length === 1) {
            return clients[0].users;
        }
        return clients.map(c => c.users).join(', ');
    }

    renderPosts(posts) {
        const content = document.getElementById('tab-content');
        if (!content) return;

        if (!posts || posts.length === 0) {
            content.innerHTML = `
                <div class="empty-state">
                    <i class="ph ph-check-circle"></i>
                    <h3>Nenhum post pendente</h3>
                    <p>Todos os posts foram aprovados!</p>
                </div>
            `;
            return;
        }

        content.innerHTML = `
            <div class="posts-list">
                ${posts.map(post => this.createPostCard(post)).join('')}
            </div>
        `;
    }

    createPostCard(post) {
        const medias = post.post_media || [];
        const hasMultipleMedia = medias.length > 1;
        const isCarousel = post.type === 'carousel';
        
        // Determinar proporção baseado no tipo
        const aspectRatio = (post.type === 'reels' || post.type === 'story') ? '9/16' : '3/4';
        
        // Formatar data de agendamento
        const scheduledDate = this.formatScheduledDate(post.agendamento);
        
        return `
            <article class="post-card" data-post-id="${post.id}">
                <!-- Header do post -->
                <div class="post-header">
                    <div class="post-client">
                        ${post.client?.profile_photo ? `
                            <img src="${post.client.profile_photo}" alt="${post.client.users}" class="client-avatar">
                        ` : `
                            <div class="client-avatar-placeholder">
                                <i class="ph-fill ph-user"></i>
                            </div>
                        `}
                        <div class="client-info">
                            <span class="client-name">@${post.client?.users || 'Desconhecido'}</span>
                            <span class="post-type-label">${this.getPostTypeLabel(post.type)}</span>
                        </div>
                    </div>
                    <div class="post-date">
                        <i class="ph ph-calendar"></i>
                        ${scheduledDate}
                    </div>
                </div>

                <!-- Preview da mídia -->
                ${hasMultipleMedia || isCarousel ? 
                    this.createCarouselPreview(medias, post.id, aspectRatio) : 
                    this.createSinglePreview(medias[0], aspectRatio)
                }

                <!-- Legenda -->
                ${post.caption ? `
                    <div class="post-caption-wrapper">
                        <div class="post-caption ${this.isLongCaption(post.caption) ? 'post-caption-collapsed' : ''}" data-post-id="${post.id}">
                            <p>${this.formatCaption(post.caption)}</p>
                        </div>
                        ${this.isLongCaption(post.caption) ? `
                            <button class="btn-expand-caption" data-post-id="${post.id}">
                                <i class="ph ph-caret-down"></i> Ver mais
                            </button>
                        ` : ''}
                    </div>
                ` : `
                    <div class="post-caption post-caption-empty">
                        <p><i class="ph ph-text-align-left"></i> Sem legenda</p>
                    </div>
                `}

                <!-- Ações -->
                <div class="post-actions">
                    <button class="btn-action btn-reject" data-post-id="${post.id}">
                        <i class="ph ph-x-circle"></i>
                        Recusar
                    </button>
                    <button class="btn-action btn-approve" data-post-id="${post.id}">
                        <i class="ph ph-check-circle"></i>
                        Aprovar
                    </button>
                </div>
            </article>
        `;
    }

    createSinglePreview(media, aspectRatio) {
        if (!media) {
            return `
                <div class="media-preview" style="aspect-ratio: ${aspectRatio};">
                    <div class="media-placeholder">
                        <i class="ph ph-image"></i>
                        <p>Sem mídia</p>
                    </div>
                </div>
            `;
        }

        const isVideo = media.type === 'video';
        
        return `
            <div class="media-preview" style="aspect-ratio: ${aspectRatio};">
                ${isVideo ? `
                    <video 
                        src="${media.url_media}" 
                        class="media-video" 
                        playsinline
                        autoplay
                        loop
                        muted
                        preload="metadata">
                        Seu navegador não suporta vídeo.
                    </video>
                    <div class="media-badge video">
                        <i class="ph-fill ph-play-circle"></i>
                    </div>
                    <div class="video-sound-indicator muted">
                        <i class="ph-fill ph-speaker-slash"></i>
                    </div>
                ` : `
                    <img 
                        src="${media.url_media}" 
                        alt="Mídia" 
                        class="media-image"
                        loading="lazy">
                    <div class="media-badge image">
                        <i class="ph-fill ph-image"></i>
                    </div>
                `}
            </div>
        `;
    }

    createCarouselPreview(medias, postId, aspectRatio) {
        if (!medias || medias.length === 0) {
            return this.createSinglePreview(null, aspectRatio);
        }

        // Ordenar mídias por order
        const sortedMedias = [...medias].sort((a, b) => (a.order || 0) - (b.order || 0));

        return `
            <div class="media-preview carousel-container" data-carousel-id="${postId}" style="aspect-ratio: ${aspectRatio};">
                <div class="carousel-track">
                    ${sortedMedias.map((media, index) => {
                        const isVideo = media.type === 'video';
                        
                        return `
                            <div class="carousel-item ${index === 0 ? 'active' : ''}" data-index="${index}">
                                ${isVideo ? `
                                    <video 
                                        src="${media.url_media}" 
                                        class="media-video" 
                                        controls
                                        playsinline
                                        preload="metadata">
                                        Seu navegador não suporta vídeo.
                                    </video>
                                ` : `
                                    <img 
                                        src="${media.url_media}" 
                                        alt="Mídia ${index + 1}" 
                                        class="media-image"
                                        loading="lazy">
                                `}
                            </div>
                        `;
                    }).join('')}
                </div>
                
                ${sortedMedias.length > 1 ? `
                    <button class="carousel-btn carousel-prev" data-carousel="${postId}">
                        <i class="ph-bold ph-caret-left"></i>
                    </button>
                    <button class="carousel-btn carousel-next" data-carousel="${postId}">
                        <i class="ph-bold ph-caret-right"></i>
                    </button>
                    
                    <div class="carousel-indicators">
                        ${sortedMedias.map((_, index) => `
                            <span class="indicator ${index === 0 ? 'active' : ''}" data-index="${index}"></span>
                        `).join('')}
                    </div>
                ` : ''}
                
                <div class="media-badge carousel">
                    <i class="ph-fill ph-images"></i>
                    <span>${sortedMedias.length}</span>
                </div>
            </div>
        `;
    }

    getPostTypeLabel(type) {
        const labels = {
            'feed': 'Feed',
            'reels': 'Reels',
            'story': 'Story',
            'carousel': 'Carrossel'
        };
        return labels[type] || type;
    }

    formatScheduledDate(dateString) {
        if (!dateString) return 'Sem data';

        try {
            const date = new Date(dateString);
            const now = new Date();
            const diffTime = date - now;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            // Se for hoje
            if (diffDays === 0) {
                return `Hoje às ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
            }

            // Se for amanhã
            if (diffDays === 1) {
                return `Amanhã às ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
            }

            // Se for nos próximos 7 dias
            if (diffDays > 0 && diffDays <= 7) {
                const weekday = date.toLocaleDateString('pt-BR', { weekday: 'long' });
                return `${weekday.charAt(0).toUpperCase() + weekday.slice(1)} às ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
            }

            // Formato padrão
            return date.toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (error) {
            console.error('[ApprovalRenderer] Erro ao formatar data:', error);
            return dateString;
        }
    }

    formatCaption(text) {
        if (!text) return '';
        
        // Preservar quebras de linha
        return text
            .replace(/\n/g, '<br>')
            .trim();
    }

    isLongCaption(text) {
        if (!text) return false;
        
        // Considera longa se tiver mais de 150 caracteres ou mais de 3 linhas
        const lines = text.split('\n').length;
        return text.length > 150 || lines > 3;
    }
}