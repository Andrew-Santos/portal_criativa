// Approval Renderer - Estilo Instagram Grid
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
                    <button class="tab-item" data-tab="drive">
                        <i class="ph ph-cloud"></i>
                        <span>Drive</span>
                    </button>
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

        // Renderizar apenas thumbnails
        content.innerHTML = `
            <div class="posts-list">
                ${posts.map(post => this.createPostThumbnail(post)).join('')}
            </div>
        `;
    }

    createPostThumbnail(post) {
        const medias = post.post_media || [];
        const firstMedia = medias.sort((a, b) => (a.order || 0) - (b.order || 0))[0];
        const isCarousel = medias.length > 1;
        const isVideo = firstMedia?.type === 'video';
        
        // Usar capa se disponível, senão usar a própria mídia
        let thumbnailUrl = firstMedia?.url_capa || firstMedia?.url_media;
        
        // Para vídeos sem capa, adicionar #t=0.001 para mostrar primeiro frame
        if (isVideo && !firstMedia?.url_capa) {
            thumbnailUrl = `${firstMedia.url_media}#t=0.001`;
        }

        // Ícones para cada tipo de post
        const typeIcon = this.getPostTypeIcon(post.type);

        return `
            <div class="post-item" data-post-id="${post.id}">
                ${thumbnailUrl ? `
                    ${isVideo && !firstMedia?.url_capa ? `
                        <video class="post-item-thumbnail" preload="metadata" muted>
                            <source src="${thumbnailUrl}" type="video/mp4">
                        </video>
                    ` : `
                        <img src="${thumbnailUrl}" alt="Post" class="post-item-thumbnail" loading="lazy">
                    `}
                ` : `
                    <div class="post-item-thumbnail" style="background: #f0f0f0; display: flex; align-items: center; justify-content: center;">
                        <i class="ph ph-image" style="font-size: 32px; color: #ccc;"></i>
                    </div>
                `}
                
                ${isCarousel ? `
                    <i class="ph-fill ph-copy post-carousel-indicator"></i>
                ` : ''}
                
                <div class="post-type-badge">
                    <i class="${typeIcon}"></i>
                </div>
                
                <div class="post-item-overlay">
                    <i class="ph-fill ph-play-circle" style="font-size: 48px; color: white;"></i>
                </div>
            </div>
        `;
    }

    createPostModal(post) {
        const medias = post.post_media || [];
        const hasMultipleMedia = medias.length > 1;

        const modalHTML = `
            <div class="post-modal" data-post-id="${post.id}">
                <div class="post-modal-overlay"></div>
                <div class="post-modal-content">
                    <button class="post-modal-close">
                        <i class="ph ph-x"></i>
                    </button>

                    <!-- Header -->
                    <div class="post-modal-header">
                        ${post.client?.profile_photo ? `
                            <img src="${post.client.profile_photo}" alt="${post.client.users}" class="client-avatar">
                        ` : `
                            <div class="client-avatar-placeholder">
                                <i class="ph-fill ph-user"></i>
                            </div>
                        `}
                        <div class="client-info">
                            <div class="client-name">@${post.client?.users || 'Desconhecido'}</div>
                            <div class="post-date">
                                <i class="ph ph-calendar"></i>
                                ${this.formatScheduledDate(post.agendamento)}
                            </div>
                        </div>
                    </div>

                    <!-- Media -->
                    <div class="post-modal-media">
                        ${hasMultipleMedia ? 
                            this.createCarouselPreview(medias, post.id) : 
                            this.createSinglePreview(medias[0])
                        }
                    </div>

                    <div class="post-modal-body">
                        <!-- Actions estilo Instagram -->
                        <div class="post-modal-actions">
                            <button class="action-btn action-btn-approve" data-post-id="${post.id}" data-action="approve" title="Aprovar">
                                <i class="ph-fill ph-heart"></i>
                            </button>
                            <button class="action-btn" data-post-id="${post.id}" data-action="share" title="Compartilhar">
                                <i class="ph-fill ph-paper-plane-tilt"></i>
                            </button>
                            <button class="action-btn" data-post-id="${post.id}" data-action="download" title="Download">
                                <i class="ph-fill ph-download-simple"></i>
                            </button>
                            <button class="action-btn action-btn-reject" data-post-id="${post.id}" data-action="reject" title="Recusar">
                                <i class="ph-fill ph-x-circle"></i>
                            </button>
                        </div>

                        <!-- Caption -->
                        <div class="post-modal-caption">
                            ${post.caption ? `
                                <div class="post-caption">
                                    <strong>@${post.client?.users || 'Desconhecido'}</strong> ${this.formatCaption(post.caption)}
                                </div>
                            ` : `
                                <div class="post-caption-empty">
                                    <i class="ph ph-text-align-left"></i> Sem legenda
                                </div>
                            `}
                        </div>

                        <!-- Footer com botões principais -->
                        <div class="post-modal-footer">
                            <button class="btn-action btn-reject" data-post-id="${post.id}">
                                <i class="ph ph-x-circle"></i>
                                Recusar
                            </button>
                            <button class="btn-action btn-approve" data-post-id="${post.id}">
                                <i class="ph ph-check-circle"></i>
                                Aprovar
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        document.body.classList.add('no-scroll');
    }

    createSinglePreview(media) {
        if (!media) {
            return `
                <div style="display: flex; align-items: center; justify-content: center; height: 100%; background: #000;">
                    <i class="ph ph-image" style="font-size: 48px; color: #444;"></i>
                </div>
            `;
        }

        const isVideo = media.type === 'video';
        const posterAttr = media.url_capa ? `poster="${media.url_capa}"` : '';
        const videoSrc = media.url_capa ? media.url_media : `${media.url_media}#t=0.001`;
        
        return isVideo ? `
            <video src="${videoSrc}" class="media-video" playsinline preload="metadata" ${posterAttr}></video>
            <div class="video-play-overlay">
                <i class="ph-fill ph-play-circle"></i>
            </div>
        ` : `
            <img src="${media.url_media}" alt="Mídia" class="media-image" loading="lazy">
        `;
    }

    createCarouselPreview(medias, postId) {
        if (!medias || medias.length === 0) {
            return this.createSinglePreview(null);
        }

        const sortedMedias = [...medias].sort((a, b) => (a.order || 0) - (b.order || 0));

        return `
            <div class="carousel-container" data-carousel-id="${postId}" data-current-index="0">
                <div class="carousel-track">
                    ${sortedMedias.map((media, index) => {
                        const isVideo = media.type === 'video';
                        const posterAttr = media.url_capa ? `poster="${media.url_capa}"` : '';
                        const videoSrc = media.url_capa ? media.url_media : `${media.url_media}#t=0.001`;
                        
                        return `
                            <div class="carousel-item ${index === 0 ? 'active' : ''}" data-index="${index}">
                                ${isVideo ? `
                                    <video src="${videoSrc}" class="media-video" playsinline preload="metadata" ${posterAttr}></video>
                                    ${index === 0 ? `
                                        <div class="video-play-overlay">
                                            <i class="ph-fill ph-play-circle"></i>
                                        </div>
                                    ` : ''}
                                ` : `
                                    <img src="${media.url_media}" alt="Mídia ${index + 1}" class="media-image" loading="lazy">
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
            </div>
        `;
    }

    getPostTypeIcon(type) {
        const icons = {
            'feed': 'ph-fill ph-square',
            'reels': 'ph-fill ph-film-strip',
            'story': 'ph-fill ph-circle',
            'carousel': 'ph-fill ph-copy'
        };
        return icons[type] || 'ph-fill ph-image';
    }

    formatScheduledDate(dateString) {
        if (!dateString) return 'Sem data';
        try {
            const date = new Date(dateString);
            const now = new Date();
            const diffDays = Math.ceil((date - now) / (1000 * 60 * 60 * 24));

            if (diffDays === 0) return `Hoje às ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
            if (diffDays === 1) return `Amanhã às ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
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
        } catch { 
            return dateString; 
        }
    }

    formatCaption(text) {
        if (!text) return '';
        return text.replace(/\n/g, '<br>').trim();
    }
}
