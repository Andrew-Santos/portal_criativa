// calendario.actions.js

// Calendario Actions - Gerencia o calendário de posts
import { CalendarioRenderer } from './calendario.renderer.js';

export class CalendarioActions {
    constructor(panel, authData) {
        this.panel = panel;
        this.authData = authData;
        this.renderer = new CalendarioRenderer(this);
        this.posts = [];
        this.clientIds = authData.clients.map(c => c.id);
        this.currentDate = new Date();
        this.currentMonth = this.currentDate.getMonth();
        this.currentYear = this.currentDate.getFullYear();
    }

    async init() {
        console.log('[CalendarioActions] Inicializando calendário...');
        await this.loadCalendar();
        this.attachEvents();
    }

    async loadCalendar() {
        const content = document.getElementById('tab-content');
        if (!content) return;

        content.innerHTML = `
            <div class="loading-container">
                <div class="loading-spinner"></div>
                <p>Carregando calendário...</p>
            </div>
        `;

        try {
            // Buscar todos os posts dos clientes
            this.posts = await this.fetchAllPosts();
            console.log('[CalendarioActions] Posts encontrados:', this.posts.length);
            
            // Renderizar calendário
            this.renderer.renderCalendar(this.currentMonth, this.currentYear, this.posts);
        } catch (error) {
            console.error('[CalendarioActions] Erro ao carregar calendário:', error);
            content.innerHTML = `
                <div class="error-container">
                    <i class="ph ph-warning-circle"></i>
                    <h3>Erro ao carregar calendário</h3>
                    <p>${error.message}</p>
                </div>
            `;
        }
    }

    async fetchAllPosts() {
        try {
            const { data, error } = await window.supabaseClient
                .from('post')
                .select(`
                    id,
                    status,
                    agendamento,
                    publicado_em,
                    id_client
                `)
                .in('id_client', this.clientIds)
                .order('agendamento', { ascending: true });

            if (error) throw error;

            // Processar posts para adicionar data efetiva
            return (data || []).map(post => ({
                ...post,
                effectiveDate: post.publicado_em || post.agendamento
            })).filter(post => post.effectiveDate); // Filtrar posts sem data

        } catch (error) {
            console.error('[CalendarioActions] Erro ao buscar posts:', error);
            throw error;
        }
    }

    attachEvents() {
        const content = document.getElementById('tab-content');
        if (!content) return;

        // Navegação entre meses
        content.addEventListener('click', (e) => {
            const prevBtn = e.target.closest('.calendar-nav-prev');
            const nextBtn = e.target.closest('.calendar-nav-next');
            const todayBtn = e.target.closest('.calendar-nav-today');

            if (prevBtn) {
                this.navigateMonth(-1);
            } else if (nextBtn) {
                this.navigateMonth(1);
            } else if (todayBtn) {
                this.goToToday();
            }
        });
    }

    navigateMonth(direction) {
        this.currentMonth += direction;

        if (this.currentMonth > 11) {
            this.currentMonth = 0;
            this.currentYear++;
        } else if (this.currentMonth < 0) {
            this.currentMonth = 11;
            this.currentYear--;
        }

        console.log('[CalendarioActions] Navegando para:', this.currentMonth + 1, '/', this.currentYear);
        this.renderer.renderCalendar(this.currentMonth, this.currentYear, this.posts);
    }

    goToToday() {
        const today = new Date();
        this.currentMonth = today.getMonth();
        this.currentYear = today.getFullYear();

        console.log('[CalendarioActions] Voltando para hoje:', this.currentMonth + 1, '/', this.currentYear);
        this.renderer.renderCalendar(this.currentMonth, this.currentYear, this.posts);
    }

    getPostsForDate(year, month, day) {
        return this.posts.filter(post => {
            if (!post.effectiveDate) return false;
            
            const postDate = new Date(post.effectiveDate);
            return postDate.getFullYear() === year &&
                   postDate.getMonth() === month &&
                   postDate.getDate() === day;
        });
    }

    destroy() {
        const content = document.getElementById('tab-content');
        if (content) {
            content.innerHTML = '';
        }
    }
}