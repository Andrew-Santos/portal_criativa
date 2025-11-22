// drive.renderer.js
// Drive Renderer - Renderização da galeria com scroll infinito
export class DriveRenderer {
    constructor(actions) {
        this.actions = actions;
    }

    renderGallery(groupedFiles, hasMore) {
        const content = document.getElementById('tab-content');
        if (!content) return;

        const groups = Object.values(groupedFiles);
        
        if (groups.length === 0) {
            content.innerHTML = `
                <div class="empty-state">
                    <i class="ph ph-folder-open"></i>
                    <h3>Nenhum arquivo</h3>
                    <p>Não há arquivos disponíveis no momento</p>
                </div>
            `;
            return;
        }

        const totalFiles = groups.reduce((acc, g) => acc + g.files.length, 0);

        content.innerHTML = `
            <div class="drive-gallery">
                <div class="drive-stats">
                    <span>${totalFiles} arquivo${totalFiles !== 1 ? 's' : ''}</span>
                </div>
                
                ${groups.map(group => this.createDateGroup(group)).join('')}
                
                ${hasMore ? `
                    <div id="drive-scroll-sentinel" class="drive-scroll-sentinel">
                        <div class="drive-loading-more" style="display: none;">
                            <div class="loading-spinner-small"></div>
                            <span>Carregando mais...</span>
                        </div>
                    </div>
                ` : `
                    <div class="drive-end-message">
                        <span>Fim dos arquivos</span>
                    </div>
                `}
            </div>
        `;
    }

    createDateGroup(group) {
        return `
            <div class="drive-date-group">
                <div class="drive-date-header">
                    <span class="drive-date-title">${group.displayDate}</span>
                    <span class="drive-date-count">${group.files.length}</span>
                </div>
                <div class="drive-grid">
                    ${group.files.map(file => this.createThumbnail(file)).join('')}
                </div>
            </div>
        `;
    }

    createThumbnail(file) {
        const isVideo = file.file_type === 'video';
        const thumbnailUrl = file.url_thumbnail || file.url_media;
        const duration = isVideo ? this.formatDuration(file.duration) : null;

        return `
            <div class="drive-thumbnail" data-file-id="${file.id}">
                <div class="drive-thumbnail-inner">
                    <img 
                        src="${thumbnailUrl}" 
                        alt="${file.name || 'Arquivo'}"
                        loading="lazy"
                        class="drive-thumbnail-img"
                        onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%23f0f0f0%22 width=%22100%22 height=%22100%22/><text x=%2250%22 y=%2250%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23999%22 font-size=%2212%22>Erro</text></svg>'"
                    >
                    ${isVideo ? `
                        <div class="drive-video-badge">
                            <i class="ph-fill ph-play"></i>
                            ${duration ? `<span>${duration}</span>` : ''}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    formatDuration(seconds) {
        if (!seconds || isNaN(seconds)) return null;
        
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        
        if (mins >= 60) {
            const hrs = Math.floor(mins / 60);
            const remainMins = mins % 60;
            return `${hrs}:${String(remainMins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        }
        
        return `${mins}:${String(secs).padStart(2, '0')}`;
    }

    showLoadingMore() {
        const loader = document.querySelector('.drive-loading-more');
        if (loader) loader.style.display = 'flex';
    }

    hideLoadingMore() {
        const loader = document.querySelector('.drive-loading-more');
        if (loader) loader.style.display = 'none';
    }

    removeScrollSentinel() {
        const sentinel = document.getElementById('drive-scroll-sentinel');
        if (sentinel) {
            sentinel.innerHTML = '<div class="drive-end-message"><span>Fim dos arquivos</span></div>';
        }
    }

    renderPreview(file, cachedUrl) {
        const isVideo = file.file_type === 'video';
        const mediaUrl = cachedUrl || file.url_media;
        const isLoading = !cachedUrl;

        const previewHTML = `
            <div id="drive-preview" class="drive-preview">
                <div class="drive-preview-overlay"></div>
                
                <div class="drive-preview-container">
                    <div class="drive-preview-header">
                        <button class="drive-preview-close">
                            <i class="ph ph-x"></i>
                        </button>
                        <button class="drive-download-btn">
                            <i class="ph ph-download-simple"></i>
                        </button>
                    </div>

                    <div class="drive-preview-media">
                        ${isLoading ? `
                            <div class="drive-preview-loading">
                                <div class="loading-spinner"></div>
                            </div>
                        ` : ''}
                        
                        ${isVideo ? `
                            <video 
                                src="${mediaUrl}" 
                                class="drive-preview-video"
                                controls
                                playsinline
                                autoplay
                                ${isLoading ? 'style="opacity: 0;"' : ''}>
                            </video>
                        ` : `
                            <img 
                                src="${mediaUrl}" 
                                alt="${file.name || 'Arquivo'}"
                                class="drive-preview-image"
                                ${isLoading ? 'style="opacity: 0;"' : ''}>
                        `}
                    </div>

                    <div class="drive-preview-info">
                        <span class="drive-preview-name">${file.name || 'Arquivo'}</span>
                        ${file.dimensions ? `<span class="drive-preview-dimensions">${file.dimensions}</span>` : ''}
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', previewHTML);

        if (isLoading) {
            const media = document.querySelector(isVideo ? '.drive-preview-video' : '.drive-preview-image');
            const loading = document.querySelector('.drive-preview-loading');
            
            if (media) {
                const onLoad = () => {
                    if (loading) loading.style.display = 'none';
                    media.style.opacity = '1';
                };
                media.addEventListener(isVideo ? 'canplay' : 'load', onLoad, { once: true });
            }
        }
    }

    updatePreviewMedia(file) {
        const isVideo = file.file_type === 'video';
        const media = document.querySelector(isVideo ? '.drive-preview-video' : '.drive-preview-image');
        const loading = document.querySelector('.drive-preview-loading');

        if (media) media.style.opacity = '1';
        if (loading) loading.style.display = 'none';
    }
}