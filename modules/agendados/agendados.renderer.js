// agendados.renderer.js

// Agendados Renderer - Renderização da lista e preview
export class AgendadosRenderer {
    constructor(actions) {
        this.actions = actions;
    }

    renderPosts(posts) {
        const content = document.getElementById('tab-content');
        if (!content) return;

        if (!posts || posts.length === 0) {
            content.innerHTML = `
                <div class="empty-state">
                    <i class="ph ph-check-circle"></i>
                    <h3>Nenhum post agendado</h3>
                    <p>Não há posts aprovados no momento</p>
                </div>
            `;
            return;
        }

        content.innerHTML = `
            <div class="agendados-list">
                ${posts.map(post => this.createListItem(post)).join('')}
            </div>
        `;
    }

    createListItem(post) {
        const medias = post.post_media || [];
        const firstMedia = medias.sort((a, b) => (a.order || 0) - (b.order || 0))[0];
        const scheduledDate = this.formatScheduledDate(post.agendamento);
        const mediaCount = medias.length;

        return `
            <div class="agendado-item" data-post-id="${post.id}">
                <div class="agendado-thumbnail">
                    ${firstMedia ? `
                        ${firstMedia.type === 'video' ? `
                            <video src="${firstMedia.url_media}" class="thumbnail-media"></video>
                            <div class="thumbnail-badge">
                                <i class="ph-fill ph-play-circle"></i>
                            </div>
                        ` : `
                            <img src="${firstMedia.url_media}" alt="Post" class="thumbnail-media">
                        `}
                        ${mediaCount > 1 ? `
                            <div class="thumbnail-count">
                                <i class="ph-fill ph-stack"></i>
                                ${mediaCount}
                            </div>
                        ` : ''}
                    ` : `
                        <div class="thumbnail-placeholder">
                            <i class="ph ph-image"></i>
                        </div>
                    `}
                </div>

                <div class="agendado-info">
                    <div class="agendado-header">
                        <div class="agendado-client">
                            ${post.client?.profile_photo ? `
                                <img src="${post.client.profile_photo}" alt="${post.client.users}" class="client-mini-avatar">
                            ` : `
                                <div class="client-mini-avatar-placeholder">
                                    <i class="ph-fill ph-user"></i>
                                </div>
                            `}
                            <span class="client-mini-name">@${post.client?.users || 'Desconhecido'}</span>
                        </div>
                        <span class="post-type-badge">${this.getPostTypeLabel(post.type)}</span>
                    </div>

                    <div class="agendado-date">
                        <i class="ph ph-calendar"></i>
                        ${scheduledDate}
                    </div>

                    ${post.caption ? `
                        <div class="agendado-caption">
                            ${this.truncateCaption(post.caption)}
                        </div>
                    ` : ''}
                </div>

                <div class="agendado-arrow">
                    <i class="ph-bold ph-caret-right"></i>
                </div>
            </div>
        `;
    }

    renderPreview(post) {
        const medias = post.post_media || [];
        const sortedMedias = [...medias].sort((a, b) => (a.order || 0) - (b.order || 0));
        const hasMultiple = sortedMedias.length > 1;
        const aspectRatio = (post.type === 'reels' || post.type === 'story') ? '9/16' : '3/4';

        const previewHTML = `
            <div id="post-preview" class="post-preview">
                <div class="preview-overlay"></div>
                
                <div class="preview-container">
                    <button class="preview-close">
                        <i class="ph-bold ph-x"></i>
                    </button>

                    <div class="preview-content">
                        ${hasMultiple ? 
                            this.createPreviewCarousel(sortedMedias, aspectRatio) : 
                            this.createPreviewSingle(sortedMedias[0], aspectRatio)
                        }

                        <div class="preview-info">
                            <div class="preview-header">
                                <div class="preview-client">
                                    ${post.client?.profile_photo ? `
                                        <img src="${post.client.profile_photo}" alt="${post.client.users}" class="preview-client-avatar">
                                    ` : `
                                        <div class="preview-client-avatar-placeholder">
                                            <i class="ph-fill ph-user"></i>
                                        </div>
                                    `}
                                    <div class="preview-client-info">
                                        <span class="preview-client-name">@${post.client?.users || 'Desconhecido'}</span>
                                        <span class="preview-post-type">${this.getPostTypeLabel(post.type)}</span>
                                    </div>
                                </div>
                            </div>

                            ${post.caption ? `
                                <div class="preview-caption">
                                    <p>${this.formatCaption(post.caption)}</p>
                                </div>
                            ` : ''}

                            <div class="preview-date">
                                <i class="ph ph-calendar"></i>
                                ${this.formatScheduledDate(post.agendamento)}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', previewHTML);

        // Autoplay vídeos
        setTimeout(() => {
            const videos = document.querySelectorAll('.preview-carousel-item.active video, .preview-single-media video');
            videos.forEach(video => {
                video.play().catch(e => console.log('Autoplay bloqueado:', e));
            });
        }, 100);
    }

    createPreviewSingle(media, aspectRatio) {
        if (!media) {
            return `
                <div class="preview-media-container" style="aspect-ratio: ${aspectRatio};">
                    <div class="preview-placeholder">
                        <i class="ph ph-image"></i>
                    </div>
                </div>
            `;
        }

        const isVideo = media.type === 'video';

        return `
            <div class="preview-media-container" style="aspect-ratio: ${aspectRatio};">
                ${isVideo ? `
                    <video 
                        src="${media.url_media}" 
                        class="preview-single-media" 
                        playsinline
                        autoplay
                        loop
                        muted>
                    </video>
                ` : `
                    <img 
                        src="${media.url_media}" 
                        alt="Mídia" 
                        class="preview-single-media">
                `}
            </div>
        `;
    }

    createPreviewCarousel(medias, aspectRatio) {
        return `
            <div class="preview-media-container preview-carousel-container" style="aspect-ratio: ${aspectRatio};">
                <div class="preview-carousel-track">
                    ${medias.map((media, index) => {
                        const isVideo = media.type === 'video';
                        return `
                            <div class="preview-carousel-item ${index === 0 ? 'active' : ''}" data-index="${index}">
                                ${isVideo ? `
                                    <video 
                                        src="${media.url_media}" 
                                        class="preview-carousel-media" 
                                        playsinline
                                        autoplay
                                        loop
                                        muted>
                                    </video>
                                ` : `
                                    <img 
                                        src="${media.url_media}" 
                                        alt="Mídia ${index + 1}" 
                                        class="preview-carousel-media">
                                `}
                            </div>
                        `;
                    }).join('')}
                </div>

                ${medias.length > 1 ? `
                    <button class="preview-carousel-btn preview-carousel-prev">
                        <i class="ph-bold ph-caret-left"></i>
                    </button>
                    <button class="preview-carousel-btn preview-carousel-next">
                        <i class="ph-bold ph-caret-right"></i>
                    </button>

                    <div class="preview-carousel-indicators">
                        ${medias.map((_, index) => `
                            <span class="preview-indicator ${index === 0 ? 'active' : ''}" data-index="${index}"></span>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `;
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
            console.error('[AgendadosRenderer] Erro ao formatar data:', error);
            return dateString;
        }
    }

    formatCaption(text) {
        if (!text) return '';
        return text.replace(/\n/g, '<br>').trim();
    }

    truncateCaption(text, maxLength = 60) {
        if (!text) return '';
        const clean = text.replace(/\n/g, ' ').trim();
        if (clean.length <= maxLength) return clean;
        return clean.substring(0, maxLength) + '...';
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

    destroy() {
        // Limpar qualquer preview aberto
        const preview = document.getElementById('post-preview');
        if (preview) {
            preview.remove();
        }
    }
}