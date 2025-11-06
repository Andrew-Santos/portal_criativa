// Approval Renderer - Renderização da interface (CSS Masonry)
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
                            <i class="ph ph-users"></i>
                            Portal do Cliente
                        </h1>
                        <div class="header-usernames">
                            ${this.getUsernames()}
                        </div>
                    </div>
                    <img id="logo" src="./assets/images/logo.webp" alt="Logo">
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
        const usernames = clients.flatMap(c => Array.isArray(c.users) ? c.users : [c.users]);
        return usernames.map(u => `<div>@${u}</div>`).join('');
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

        console.log('[ApprovalRenderer] Posts renderizados com CSS Masonry:', posts.length);
    }

    createPostCard(post) {
        const medias = post.post_media || [];
        const hasMultipleMedia = medias.length > 1;
        const isCarousel = post.type === 'carousel';
        
        const aspectRatio = (post.type === 'reels' || post.type === 'story') ? '9/16' : '3/4';
        const scheduledDate = this.formatScheduledDate(post.agendamento);
        
        return `
            <article class="post-card" data-post-id="${post.id}" data-post-type="${post.type}">
                ${hasMultipleMedia || isCarousel ? 
                    this.createCarouselPreview(medias, post.id, aspectRatio, post.type) : 
                    this.createSinglePreview(medias[0], aspectRatio, post.type)
                }

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
                            <div class="post-date">
                                <i class="ph ph-calendar"></i>
                                ${scheduledDate}
                            </div>
                        </div>
                    </div>
                </div>

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

                <div class="post-actions">
                    <button class="btn-action btn-compartilhar" data-post-id="${post.id}">
                        <i class="ph ph-export"></i>
                        Compartilhar
                    </button>

                    <button class="btn-action btn-download" data-post-id="${post.id}">
                        <i class="ph ph-download"></i>
                        Download
                    </button>

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

    createSinglePreview(media, aspectRatio, postType) {
        if (!media) {
            return `
                <div class="media-preview" style="aspect-ratio: ${aspectRatio};">
                    <div class="media-placeholder">
                        <i class="ph ph-image"></i>
                        <p>Sem mídia</p>
                    </div>
                    <span class="post-type-label">${this.getPostTypeLabel(postType)}</span>
                </div>
            `;
        }

        const isVideo = media.type === 'video';
        
        // Usar url_capa se disponível, senão usar #t=0.001 para primeiro frame
        const posterAttr = media.url_capa 
            ? `poster="${media.url_capa}"` 
            : '';
        
        const videoSrc = media.url_capa 
            ? media.url_media 
            : `${media.url_media}#t=0.001`;
        
        return `
            <div class="media-preview" style="aspect-ratio: ${aspectRatio};">
                ${isVideo ? `
                    <video 
                        src="${videoSrc}" 
                        class="media-video" 
                        playsinline
                        loop
                        preload="metadata"
                        ${posterAttr}>
                        Seu navegador não suporta vídeo.
                    </video>
                    
                    <div class="video-play-overlay">
                        <i class="ph-fill ph-play"></i>
                    </div>
                ` : `
                    <img 
                        src="${media.url_media}" 
                        alt="Mídia" 
                        class="media-image"
                        loading="lazy">
                `}

                <span class="post-type-label">${this.getPostTypeLabel(postType)}</span>
            </div>
        `;
    }

    createCarouselPreview(medias, postId, aspectRatio, postType) {
        if (!medias || medias.length === 0) {
            return this.createSinglePreview(null, aspectRatio, postType);
        }

        const sortedMedias = [...medias].sort((a, b) => (a.order || 0) - (b.order || 0));

        return `
            <div class="media-preview carousel-container" data-carousel-id="${postId}" data-current-index="0" style="aspect-ratio: ${aspectRatio};">
                <div class="carousel-track" style="transform: translateX(0%);">
                    ${sortedMedias.map((media, index) => {
                        const isVideo = media.type === 'video';
                        
                        // Usar url_capa se disponível, senão usar #t=0.001 para primeiro frame
                        const posterAttr = media.url_capa 
                            ? `poster="${media.url_capa}"` 
                            : '';
                        
                        const videoSrc = media.url_capa 
                            ? media.url_media 
                            : `${media.url_media}#t=0.001`;
                        
                        return `
                            <div class="carousel-item ${index === 0 ? 'active' : ''}" data-index="${index}">
                                ${isVideo ? `
                                    <video 
                                        src="${videoSrc}" 
                                        class="media-video" 
                                        controls
                                        playsinline
                                        preload="metadata"
                                        ${posterAttr}>
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
                        <i class="ph ph-caret-left"></i>
                    </button>
                    <button class="carousel-btn carousel-next" data-carousel="${postId}">
                        <i class="ph ph-caret-right"></i>
                    </button>
                    
                    <div class="carousel-indicators">
                        ${sortedMedias.map((_, index) => `
                            <span class="indicator ${index === 0 ? 'active' : ''}" data-index="${index}"></span>
                        `).join('')}
                    </div>
                ` : ''}

                <span class="post-type-label">${this.getPostTypeLabel(postType)}</span>
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

            if (diffDays === 0) {
                return `Hoje às ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
            }

            if (diffDays === 1) {
                return `Amanhã às ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
            }

            if (diffDays > 0 && diffDays <= 7) {
                const weekday = date.toLocaleDateString('pt-BR', { weekday: 'long' });
                return `${weekday.charAt(0).toUpperCase() + weekday.slice(1)} às ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
            }

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
        
        return text
            .replace(/\n/g, '<br>')
            .trim();
    }

    isLongCaption(text) {
        if (!text) return false;
        
        const lines = text.split('\n').length;
        return text.length > 150 || lines > 3;
    }
}