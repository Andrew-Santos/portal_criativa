// drive.actions.js
// Drive Actions - Gerencia a galeria de mídias com scroll infinito
import { DriveRenderer } from './drive.renderer.js';

export class DriveActions {
    constructor(panel, authData) {
        this.panel = panel;
        this.authData = authData;
        this.renderer = new DriveRenderer(this);
        this.files = [];
        this.clientIds = authData.clients.map(c => c.id);
        this.currentPreview = null;
        this.previewEventHandlers = null;
        
        // Paginação
        this.PAGE_SIZE = 30;
        this.currentPage = 0;
        this.hasMore = true;
        this.isLoading = false;
        this.totalCount = 0;
        
        // Cache
        this.CACHE_KEY = 'drive_media_cache';
        this.CACHE_DURATION = 24 * 60 * 60 * 1000;
        
        // Scroll observer
        this.scrollObserver = null;
        this.sentinelEl = null;
    }

    async init() {
        console.log('[DriveActions] Inicializando drive...');
        this.resetPagination();
        await this.loadInitialFiles();
        this.attachEvents();
        this.setupInfiniteScroll();
    }

    resetPagination() {
        this.files = [];
        this.currentPage = 0;
        this.hasMore = true;
        this.isLoading = false;
    }

    async loadInitialFiles() {
        const content = document.getElementById('tab-content');
        if (!content) return;

        content.innerHTML = `
            <div class="loading-container">
                <div class="loading-spinner"></div>
                <p>Carregando arquivos...</p>
            </div>
        `;

        try {
            // Buscar contagem total primeiro
            await this.fetchTotalCount();
            
            // Carregar primeira página
            const newFiles = await this.fetchFiles(0);
            this.files = newFiles;
            this.currentPage = 1;
            this.hasMore = newFiles.length === this.PAGE_SIZE;
            
            console.log('[DriveActions] Arquivos carregados:', newFiles.length, '| Total:', this.totalCount);
            
            const groupedFiles = this.groupFilesByDate(this.files);
            this.renderer.renderGallery(groupedFiles, this.hasMore);
        } catch (error) {
            console.error('[DriveActions] Erro ao carregar arquivos:', error);
            content.innerHTML = `
                <div class="error-container">
                    <i class="ph ph-warning-circle"></i>
                    <h3>Erro ao carregar arquivos</h3>
                    <p>${error.message}</p>
                </div>
            `;
        }
    }

    async fetchTotalCount() {
        const { count, error } = await window.supabaseClient
            .from('drive_files')
            .select('*', { count: 'exact', head: true })
            .in('id_client', this.clientIds);
        
        if (error) throw error;
        this.totalCount = count || 0;
    }

    async fetchFiles(page) {
        const from = page * this.PAGE_SIZE;
        const to = from + this.PAGE_SIZE - 1;

        const { data, error } = await window.supabaseClient
            .from('drive_files')
            .select('*')
            .in('id_client', this.clientIds)
            .order('data_de_captura', { ascending: false, nullsFirst: false })
            .range(from, to);

        if (error) throw error;
        return data || [];
    }

    async loadMoreFiles() {
        if (this.isLoading || !this.hasMore) return;
        
        this.isLoading = true;
        this.renderer.showLoadingMore();

        try {
            const newFiles = await this.fetchFiles(this.currentPage);
            
            if (newFiles.length === 0) {
                this.hasMore = false;
                this.renderer.hideLoadingMore();
                this.renderer.removeScrollSentinel();
                return;
            }

            this.files = [...this.files, ...newFiles];
            this.currentPage++;
            this.hasMore = newFiles.length === this.PAGE_SIZE;

            console.log('[DriveActions] Mais arquivos carregados:', newFiles.length, '| Total agora:', this.files.length);

            // Re-renderizar com todos os arquivos
            const groupedFiles = this.groupFilesByDate(this.files);
            this.renderer.renderGallery(groupedFiles, this.hasMore);
            
            // Reconfigurar observer após re-render
            this.setupInfiniteScroll();
        } catch (error) {
            console.error('[DriveActions] Erro ao carregar mais:', error);
        } finally {
            this.isLoading = false;
            this.renderer.hideLoadingMore();
        }
    }

    setupInfiniteScroll() {
        // Limpar observer anterior
        if (this.scrollObserver) {
            this.scrollObserver.disconnect();
        }

        this.sentinelEl = document.getElementById('drive-scroll-sentinel');
        if (!this.sentinelEl || !this.hasMore) return;

        this.scrollObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && this.hasMore && !this.isLoading) {
                    console.log('[DriveActions] Sentinel visível, carregando mais...');
                    this.loadMoreFiles();
                }
            });
        }, {
            root: null,
            rootMargin: '200px', // Carregar antes de chegar no fim
            threshold: 0
        });

        this.scrollObserver.observe(this.sentinelEl);
    }

    groupFilesByDate(files) {
        const groups = {};
        
        files.forEach(file => {
            const date = file.data_de_captura 
                ? new Date(file.data_de_captura) 
                : new Date(file.created_at);
            
            const dateKey = this.formatDateKey(date);
            const displayDate = this.formatDisplayDate(date);
            
            if (!groups[dateKey]) {
                groups[dateKey] = { displayDate, date, files: [] };
            }
            groups[dateKey].files.push(file);
        });

        // Ordenar por data
        const sortedKeys = Object.keys(groups).sort((a, b) => 
            new Date(groups[b].date) - new Date(groups[a].date)
        );

        const sortedGroups = {};
        sortedKeys.forEach(key => sortedGroups[key] = groups[key]);
        return sortedGroups;
    }

    formatDateKey(date) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }

    formatDisplayDate(date) {
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (date.toDateString() === today.toDateString()) return 'Hoje';
        if (date.toDateString() === yesterday.toDateString()) return 'Ontem';

        return date.toLocaleDateString('pt-BR', { 
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' 
        });
    }

    attachEvents() {
        const content = document.getElementById('tab-content');
        if (!content) return;

        // Remover listeners antigos
        if (this._clickHandler) {
            content.removeEventListener('click', this._clickHandler);
        }

        this._clickHandler = (e) => {
            const thumbnail = e.target.closest('.drive-thumbnail');
            if (thumbnail) {
                e.preventDefault();
                e.stopPropagation();
                this.openPreview(thumbnail.dataset.fileId);
            }
        };

        content.addEventListener('click', this._clickHandler);
    }

    async openPreview(fileId) {
        const file = this.files.find(f => f.id == fileId);
        if (!file) return;

        this.closePreview();
        this.currentPreview = file;

        const cachedUrl = this.getCachedMedia(fileId);
        this.renderer.renderPreview(file, cachedUrl);
        document.body.style.overflow = 'hidden';

        if (!cachedUrl) {
            await this.loadAndCacheMedia(file);
        }

        setTimeout(() => this.attachPreviewEvents(), 100);
    }

    getCachedMedia(fileId) {
        try {
            const cache = localStorage.getItem(`${this.CACHE_KEY}_${fileId}`);
            if (!cache) return null;
            const { url, expiry } = JSON.parse(cache);
            if (Date.now() > expiry) {
                localStorage.removeItem(`${this.CACHE_KEY}_${fileId}`);
                return null;
            }
            return url;
        } catch { return null; }
    }

    setCachedMedia(fileId, url) {
        try {
            localStorage.setItem(`${this.CACHE_KEY}_${fileId}`, JSON.stringify({
                url, expiry: Date.now() + this.CACHE_DURATION
            }));
        } catch (e) {
            console.warn('[DriveActions] Erro ao salvar cache:', e);
        }
    }

    async loadAndCacheMedia(file) {
        this.setCachedMedia(file.id, file.url_media);
        this.renderer.updatePreviewMedia(file);
    }

    attachPreviewEvents() {
        const preview = document.getElementById('drive-preview');
        if (!preview) return;

        this.previewEventHandlers = {
            handleClose: (e) => {
                if (e.target.closest('.drive-preview-close') || e.target.closest('.drive-preview-overlay')) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.closePreview();
                }
            },
            handleDownload: (e) => {
                if (e.target.closest('.drive-download-btn')) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.downloadCurrentFile();
                }
            },
            handleKeydown: (e) => {
                if (e.key === 'Escape') this.closePreview();
            }
        };

        preview.addEventListener('click', this.previewEventHandlers.handleClose);
        preview.addEventListener('click', this.previewEventHandlers.handleDownload);
        document.addEventListener('keydown', this.previewEventHandlers.handleKeydown);
    }

    async downloadCurrentFile() {
        if (!this.currentPreview) return;
        const file = this.currentPreview;

        try {
            const response = await fetch(file.url_media);
            if (!response.ok) throw new Error('Falha');
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = file.name || `arquivo_${file.id}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch {
            window.open(file.url_media, '_blank');
        }
    }

    closePreview() {
        const preview = document.getElementById('drive-preview');
        if (!preview) return;

        if (this.previewEventHandlers) {
            preview.removeEventListener('click', this.previewEventHandlers.handleClose);
            preview.removeEventListener('click', this.previewEventHandlers.handleDownload);
            document.removeEventListener('keydown', this.previewEventHandlers.handleKeydown);
            this.previewEventHandlers = null;
        }

        preview.querySelectorAll('video').forEach(v => { v.pause(); v.currentTime = 0; });
        preview.style.animation = 'fadeOut 0.3s ease';
        
        setTimeout(() => {
            preview.remove();
            this.currentPreview = null;
            document.body.style.overflow = '';
        }, 300);
    }

    destroy() {
        if (this.scrollObserver) {
            this.scrollObserver.disconnect();
            this.scrollObserver = null;
        }
        this.closePreview();
        const content = document.getElementById('tab-content');
        if (content) content.innerHTML = '';
    }
}