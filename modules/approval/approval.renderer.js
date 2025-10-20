// Approval Renderer - Renderização da interface com Masonry Layout
export class ApprovalRenderer {
    constructor(actions) {
        this.actions = actions;
        this.container = actions.panel.container;
        this.resizeTimeout = null;
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
            <div class="posts-list" style="opacity: 0; transition: opacity 0.3s ease;">
                ${posts.map(post => this.createPostCard(post)).join('')}
            </div>
        `;

        // Inicializar Masonry após renderizar
        const container = content.querySelector('.posts-list');
        
        setTimeout(() => {
            this.initMasonry();
            
            // Mostrar container após Masonry aplicado
            setTimeout(() => {
                if (container) {
                    container.style.opacity = '1';
                }
            }, 150);
        }, 50);
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
                ${hasMultipleMedia || isCarousel ? 
                    this.createCarouselPreview(medias, post.id, aspectRatio, post.type) : 
                    this.createSinglePreview(medias[0], aspectRatio, post.type)
                }

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
                            <div class="post-date">
                                <i class="ph ph-calendar"></i>
                                ${scheduledDate}
                            </div>
                        </div>
                    </div>
                </div>

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
        
        return `
            <div class="media-preview" style="aspect-ratio: ${aspectRatio};">
                ${isVideo ? `
                    <video 
                        src="${media.url_media}#t=0.001" 
                        class="media-video" 
                        playsinline
                        loop
                        preload="metadata"
                        poster="">
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
            <div class="media-preview carousel-container" data-carousel-id="${postId}" style="aspect-ratio: ${aspectRatio};">
                <div class="carousel-track">
                    ${sortedMedias.map((media, index) => {
                        const isVideo = media.type === 'video';
                        
                        return `
                            <div class="carousel-item ${index === 0 ? 'active' : ''}" data-index="${index}">
                                ${isVideo ? `
                                    <video 
                                        src="${media.url_media}#t=0.001" 
                                        class="media-video" 
                                        controls
                                        playsinline
                                        preload="metadata"
                                        poster="">
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

    // ===== MASONRY LAYOUT =====
    initMasonry() {
        const container = document.querySelector('.posts-list');
        if (!container) return;

        const cards = Array.from(container.querySelectorAll('.post-card'));
        if (cards.length === 0) return;

        console.log('[ApprovalRenderer] Inicializando Masonry com', cards.length, 'cards');

        // Determinar número de colunas baseado na largura da tela
        const getColumnCount = () => {
            const width = window.innerWidth;
            if (width >= 1440) return 5;
            if (width >= 1024) return 4;
            if (width >= 768) return 2;
            return 1;
        };

        const layoutMasonry = () => {
            const columnCount = getColumnCount();
            
            console.log('[ApprovalRenderer] Aplicando layout com', columnCount, 'colunas');

            if (columnCount === 1) {
                // Mobile: layout normal
                container.classList.remove('masonry-initialized');
                cards.forEach(card => {
                    card.style.position = '';
                    card.style.top = '';
                    card.style.left = '';
                    card.style.width = '';
                });
                container.style.height = '';
                return;
            }

            container.classList.add('masonry-initialized');

            const containerWidth = container.offsetWidth;
            const gap = window.innerWidth >= 1024 ? 18 : 16;
            const columnWidth = (containerWidth - (gap * (columnCount - 1))) / columnCount;

            // Array para armazenar a altura atual de cada coluna
            const columnHeights = new Array(columnCount).fill(0);

            cards.forEach((card, index) => {
                // Forçar recalculo de altura
                card.style.width = `${columnWidth}px`;
                
                // Aguardar um frame para garantir que a largura foi aplicada
                requestAnimationFrame(() => {
                    // Encontrar a coluna mais curta
                    const shortestColumn = columnHeights.indexOf(Math.min(...columnHeights));

                    // Calcular posição
                    const left = shortestColumn * (columnWidth + gap);
                    const top = columnHeights[shortestColumn];

                    // Aplicar posição
                    card.style.position = 'absolute';
                    card.style.left = `${left}px`;
                    card.style.top = `${top}px`;

                    // Atualizar altura da coluna com a altura real do card
                    const cardHeight = card.offsetHeight;
                    columnHeights[shortestColumn] += cardHeight + gap;

                    // Se for o último card, definir altura do container
                    if (index === cards.length - 1) {
                        requestAnimationFrame(() => {
                            const maxHeight = Math.max(...columnHeights);
                            container.style.height = `${maxHeight}px`;
                            console.log('[ApprovalRenderer] Layout Masonry aplicado. Altura:', maxHeight);
                        });
                    }
                });
            });
        };

        // Função para aguardar carregamento de TODAS as imagens e vídeos
        const waitForMediaLoad = () => {
            return new Promise((resolve) => {
                const medias = container.querySelectorAll('img, video');
                
                if (medias.length === 0) {
                    resolve();
                    return;
                }

                let loadedCount = 0;
                const totalMedia = medias.length;

                const checkComplete = () => {
                    loadedCount++;
                    console.log(`[ApprovalRenderer] Mídia carregada: ${loadedCount}/${totalMedia}`);
                    
                    if (loadedCount === totalMedia) {
                        console.log('[ApprovalRenderer] Todas as mídias carregadas!');
                        resolve();
                    }
                };

                medias.forEach((media) => {
                    if (media.tagName === 'IMG') {
                        if (media.complete && media.naturalHeight !== 0) {
                            checkComplete();
                        } else {
                            media.addEventListener('load', checkComplete, { once: true });
                            media.addEventListener('error', checkComplete, { once: true });
                        }
                    } else if (media.tagName === 'VIDEO') {
                        if (media.readyState >= 2) {
                            checkComplete();
                        } else {
                            media.addEventListener('loadeddata', checkComplete, { once: true });
                            media.addEventListener('error', checkComplete, { once: true });
                        }
                    }
                });
            });
        };

        // Aguardar carregamento e então aplicar layout
        waitForMediaLoad().then(() => {
            // Aguardar mais um frame para garantir renderização completa
            requestAnimationFrame(() => {
                setTimeout(layoutMasonry, 100);
            });
        });

        // Recriar layout ao redimensionar janela
        window.removeEventListener('resize', this.handleResize);
        this.handleResize = () => {
            clearTimeout(this.resizeTimeout);
            this.resizeTimeout = setTimeout(layoutMasonry, 200);
        };
        window.addEventListener('resize', this.handleResize);
    }
}