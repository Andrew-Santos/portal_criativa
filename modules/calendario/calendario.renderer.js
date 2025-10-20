// calendario.renderer.js

// Calendario Renderer - Renderização do calendário
export class CalendarioRenderer {
    constructor(actions) {
        this.actions = actions;
    }

    renderCalendar(month, year, posts) {
        const content = document.getElementById('tab-content');
        if (!content) return;

        const monthName = this.getMonthName(month);
        const firstDay = new Date(year, month, 1).getDay(); // 0 = Domingo
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const today = new Date();
        const isCurrentMonth = today.getMonth() === month && today.getFullYear() === year;
        const currentDay = isCurrentMonth ? today.getDate() : null;

        // Contar posts por status
        const stats = this.getMonthStats(month, year, posts);

        content.innerHTML = `
            <div class="calendar-container">
                <!-- Header do Calendário -->
                <div class="calendar-header">
                    <button class="calendar-nav-btn calendar-nav-prev">
                        <i class="ph ph-caret-left"></i>
                    </button>
                    
                    <div class="calendar-title">
                        <h2>${monthName} ${year}</h2>
                        <button class="calendar-nav-today">Hoje</button>
                    </div>
                    
                    <button class="calendar-nav-btn calendar-nav-next">
                        <i class="ph ph-caret-right"></i>
                    </button>
                </div>

                <!-- Estatísticas do Mês -->
                <div class="calendar-stats">
                    <div class="stat-item">
                        <div class="stat-dot stat-dot-pending"></div>
                        <span>Pendentes: ${stats.pending}</span>
                    </div>
                    <div class="stat-item">
                        <div class="stat-dot stat-dot-approved"></div>
                        <span>Aprovados: ${stats.approved}</span>
                    </div>
                    <div class="stat-item">
                        <div class="stat-dot stat-dot-rejected"></div>
                        <span>Recusados: ${stats.rejected}</span>
                    </div>
                    <div class="stat-item">
                        <div class="stat-dot stat-dot-published"></div>
                        <span>Publicados: ${stats.published}</span>
                    </div>
                </div>

                <!-- Grid do Calendário -->
                <div class="calendar-grid">
                    <!-- Cabeçalho dos dias da semana -->
                    <div class="calendar-weekday">Dom</div>
                    <div class="calendar-weekday">Seg</div>
                    <div class="calendar-weekday">Ter</div>
                    <div class="calendar-weekday">Qua</div>
                    <div class="calendar-weekday">Qui</div>
                    <div class="calendar-weekday">Sex</div>
                    <div class="calendar-weekday">Sáb</div>

                    <!-- Dias vazios no início -->
                    ${this.renderEmptyDays(firstDay)}

                    <!-- Dias do mês -->
                    ${this.renderDays(month, year, daysInMonth, currentDay, posts)}
                </div>
            </div>
        `;
    }

    renderEmptyDays(firstDay) {
        let html = '';
        for (let i = 0; i < firstDay; i++) {
            html += '<div class="calendar-day calendar-day-empty"></div>';
        }
        return html;
    }

    renderDays(month, year, daysInMonth, currentDay, posts) {
        let html = '';

        for (let day = 1; day <= daysInMonth; day++) {
            const dayPosts = this.actions.getPostsForDate(year, month, day);
            const isToday = day === currentDay;
            const hasPost = dayPosts.length > 0;

            html += `
                <div class="calendar-day ${isToday ? 'calendar-day-today' : ''} ${hasPost ? 'calendar-day-has-posts' : ''}">
                    <div class="calendar-day-number">${day}</div>
                    ${hasPost ? this.renderDayIndicators(dayPosts) : ''}
                </div>
            `;
        }

        return html;
    }

    renderDayIndicators(posts) {
        // Agrupar posts por status
        const statusGroups = {
            'PENDENTE': [],
            'APROVADO': [],
            'REPROVADO': [],
            'PUBLICADO': []
        };

        posts.forEach(post => {
            if (statusGroups[post.status]) {
                statusGroups[post.status].push(post);
            } else {
                // Status desconhecido vai para pendentes
                statusGroups['PENDENTE'].push(post);
            }
        });

        let html = '<div class="calendar-day-indicators">';

        // Renderizar indicadores por status
        if (statusGroups['PENDENTE'].length > 0) {
            html += `<div class="calendar-indicator calendar-indicator-pending" title="${statusGroups['PENDENTE'].length} pendente(s)"></div>`;
        }
        if (statusGroups['APROVADO'].length > 0) {
            html += `<div class="calendar-indicator calendar-indicator-approved" title="${statusGroups['APROVADO'].length} aprovado(s)"></div>`;
        }
        if (statusGroups['REPROVADO'].length > 0) {
            html += `<div class="calendar-indicator calendar-indicator-rejected" title="${statusGroups['REPROVADO'].length} recusado(s)"></div>`;
        }
        if (statusGroups['PUBLICADO'].length > 0) {
            html += `<div class="calendar-indicator calendar-indicator-published" title="${statusGroups['PUBLICADO'].length} publicado(s)"></div>`;
        }

        html += '</div>';

        // Contador total
        html += `<div class="calendar-day-count">${posts.length}</div>`;

        return html;
    }

    getMonthStats(month, year, posts) {
        const stats = {
            pending: 0,
            approved: 0,
            rejected: 0,
            published: 0
        };

        posts.forEach(post => {
            if (!post.effectiveDate) return;

            const postDate = new Date(post.effectiveDate);
            if (postDate.getMonth() === month && postDate.getFullYear() === year) {
                switch (post.status) {
                    case 'APROVADO':
                        stats.approved++;
                        break;
                    case 'REPROVADO':
                        stats.rejected++;
                        break;
                    case 'PUBLICADO':
                        stats.published++;
                        break;
                    default:
                        stats.pending++;
                }
            }
        });

        return stats;
    }

    getMonthName(month) {
        const months = [
            'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
            'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
        ];
        return months[month];
    }
}