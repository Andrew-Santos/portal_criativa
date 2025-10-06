// approval.actions.js

// Approval Actions - Gerencia ações e lógica do painel
import { ApprovalRenderer } from './approval.renderer.js';

export class ApprovalActions {
    // ... (constructor, init, attachEvents, etc. - Mantenha tudo como estava)
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

            // Botões de aprovação
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
            
            // --- NOVO: Botões de download ---
            const downloadBtn = e.target.closest('.btn-download');
            if (downloadBtn) {
                e.stopPropagation();
                this.handleDownload(downloadBtn);
            }

            // --- NOVO: Botões de compartilhar ---
            const shareBtn = e.target.closest('.btn-compartilhar');
            if (shareBtn) {
                e.stopPropagation();
                this.handleShare(shareBtn);
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
            // Buscar posts pendentes
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
                .neq('status', 'REPROVADO')
                .order('agendamento', { ascending: false });

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
            .update({
                status: 'APROVADO',
                approval_date: now
            })
            .eq('id', postId);
        
        if (error) throw error;
        
        console.log('[ApprovalActions] Post aprovado:', postId);
        
        // Remover card da lista
        const card = button.closest('.post-card');
        card.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => {
            card.remove();
            
            // Verificar se ficou vazio
            const remaining = document.querySelectorAll('.post-card').length;
            if (remaining === 0) {
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
    
    if (!confirm('Deseja recusar este post?')) return;
    
    button.disabled = true;
    const originalHTML = button.innerHTML;
    button.innerHTML = '<div class="btn-spinner"></div> Recusando...';
    
    try {
        const now = new Date().toISOString();
        
        const { error } = await window.supabaseClient
            .from('post')
            .update({
                status: 'REPROVADO',
                reject_date: now
            })
            .eq('id', postId);
        
        if (error) throw error;
        
        console.log('[ApprovalActions] Post recusado:', postId);
        
        // Remover card da lista
        const card = button.closest('.post-card');
        card.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => {
            card.remove();
            
            // Verificar se ficou vazio
            const remaining = document.querySelectorAll('.post-card').length;
            if (remaining === 0) {
                this.renderer.renderPosts([]);
            }
        }, 300);
        
    } catch (error) {
        console.error('[ApprovalActions] Erro ao recusar:', error);
        alert('Erro ao recusar post. Tente novamente.');
        button.disabled = false;
        button.innerHTML = originalHTML;
    }
}
    async handleDownload(button) {
        const postId = button.dataset.postId;
        const post = this.posts.find(p => p.id == postId);

        if (!post || !post.post_media || post.post_media.length === 0) {
            alert('Nenhuma mídia disponível para download.');
            return;
        }

        console.log('[ApprovalActions] Iniciando download para o post:', postId);

        button.disabled = true;
        const originalHTML = button.innerHTML;
        button.innerHTML = '<div class="btn-spinner"></div> Baixando...';

        try {
            const medias = post.post_media.sort((a, b) => (a.order || 0) - (b.order || 0));

            if (medias.length === 1) {
                // Download único - tenta com fetch, se falhar usa link direto
                const media = medias[0];
                const extension = media.type === 'video' ? 'mp4' : 'png';
                const filename = `post_${postId}_media.${extension}`;
                
                try {
                    await this.downloadMediaAsBlob(media.url_media, filename);
                } catch (corsError) {
                    console.warn('[ApprovalActions] CORS bloqueou fetch, usando download direto');
                    this.downloadDirect(media.url_media, filename);
                }
            } else {
                // Múltiplas mídias - tenta ZIP, se falhar faz downloads separados
                try {
                    await this.downloadMultipleMediasAsZip(medias, postId);
                } catch (corsError) {
                    console.warn('[ApprovalActions] CORS bloqueou ZIP, usando downloads separados');
                    this.downloadMultipleDirect(medias, postId);
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
        try {
            // Este fetch agora deve funcionar após a configuração do CORS no servidor
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Falha na rede ao buscar a mídia: ${response.statusText}`);
            }
            const blob = await response.blob();
            const objectUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = objectUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(objectUrl);
        } catch (error) {
            console.error(`[ApprovalActions] Erro no fetch de ${url}:`, error);
            throw error;
        }
    }

    async downloadMultipleMediasAsZip(medias, postId) {
        if (typeof JSZip === 'undefined') {
            alert('Erro: A biblioteca JSZip não foi carregada.');
            throw new Error("JSZip não está definido");
        }

        const zip = new JSZip();
        const zipFilename = `post_${postId}_midias.zip`;

        const promises = medias.map(async (media) => {
            const response = await fetch(media.url_media);
            if (!response.ok) return null;
            return {
                blob: await response.blob(),
                type: media.type
            };
        });

        const results = await Promise.all(promises);

        results.forEach((result, index) => {
            if (result) {
                const extension = result.type === 'video' ? 'mp4' : 'png'; // ou jpg
                const filename = `midia_${String(index + 1).padStart(2, '0')}.${extension}`;
                zip.file(filename, result.blob);
            }
        });

        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const objectUrl = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = zipFilename;
        document.body.appendChild(a);
a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(objectUrl);
    }

    // --- NOVA FUNÇÃO AUXILIAR PARA DOWNLOAD ÚNICO ---
    downloadSingleMedia(url, filename) {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    // --- NOVA FUNÇÃO AUXILIAR PARA DOWNLOAD MÚLTIPLO ---
    async downloadMultipleMedias(medias, postId) {
        if (!confirm(`Baixar ${medias.length} mídias? Cada arquivo será baixado separadamente.`)) {
            return;
        }
        
        for (let i = 0; i < medias.length; i++) {
            const media = medias[i];
            const extension = media.type === 'video' ? 'mp4' : 'jpg';
            const filename = `post_${postId}_media_${i + 1}.${extension}`;
            
            // Delay entre downloads para não sobrecarregar
            await new Promise(resolve => setTimeout(resolve, 500));
            
            this.downloadSingleMedia(media.url_media, filename);
        }
    }

    // --- NOVA FUNÇÃO DE COMPARTILHAMENTO ---
    handleShare(button) {
        const postId = button.dataset.postId;
        const post = this.posts.find(p => p.id == postId);

        if (!post || !post.post_media || post.post_media.length === 0) {
            alert('Nenhuma mídia encontrada para compartilhar.');
            return;
        }

        console.log('[ApprovalActions] Preparando links para compartilhar do post:', postId);

        // Monta a string de texto com os links, como solicitado
        let shareText = 'Segue a mídia do portal Criativa\n\n';
        
        const sortedMedias = post.post_media.sort((a, b) => (a.order || 0) - (b.order || 0));
        
        sortedMedias.forEach((media, index) => {
            shareText += `Link ${index + 1}: ${media.url_media}\n`;
        });
        
        // Tenta copiar o texto para a área de transferência
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(shareText.trim())
                .then(() => {
                    alert('Links das mídias copiados para a área de transferência!');
                })
                .catch(err => {
                    console.error('[ApprovalActions] Erro ao copiar links:', err);
                    alert('Não foi possível copiar os links.');
                });
        } else {
            // Fallback para ambientes não seguros
            alert('A função de copiar não é suportada em ambientes não seguros (HTTP). Por favor, use HTTPS.');
            console.warn('[ApprovalActions] navigator.clipboard não está disponível. Ambiente não seguro.');
        }
    }

    // --- NOVA FUNÇÃO DE FALLBACK PARA COMPARTILHAMENTO ---
    fallbackShare(text) {
        // A API de Clipboard também requer um contexto seguro (HTTPS ou localhost)
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text)
                .then(() => {
                    alert('A API de compartilhamento não está disponível neste navegador.\nA legenda foi copiada para a área de transferência!');
                })
                .catch(err => {
                    console.error('[ApprovalActions] Erro ao copiar texto:', err);
                    alert('Não foi possível copiar o texto.');
                });
        } else {
            alert('A função de compartilhar/copiar não é suportada neste navegador ou em um ambiente não seguro (HTTP).');
        }
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








