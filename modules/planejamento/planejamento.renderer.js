// planejamento.renderer.js - Renderização da interface
export class PlanejamentoRenderer {
    constructor(actions) {
        this.actions = actions;
    }

    renderList(planejamentos) {
        const content = document.getElementById('tab-content');
        if (!content) return;

        if (!planejamentos || planejamentos.length === 0) {
            content.innerHTML = `
                <div class="planejamento-container">
                    <div class="planejamento-header">
                        <h2>Planejamentos</h2>
                        <button id="btn-new-planejamento">
                            <i class="ph-fill ph-plus"></i>
                            Novo Planejamento
                        </button>
                    </div>
                    <div class="empty-state">
                        <i class="ph ph-folder-notch-open"></i>
                        <h3>Nenhum planejamento</h3>
                        <p>Crie seu primeiro planejamento</p>
                    </div>
                </div>
            `;
            return;
        }

        content.innerHTML = `
            <div class="planejamento-container">
                <div class="planejamento-header">
                    <h2>Planejamentos</h2>
                    <button id="btn-new-planejamento">
                        <i class="ph-fill ph-plus"></i>
                        Novo
                    </button>
                </div>
                <div class="planejamento-grid">
                    ${planejamentos.map(p => this.createPlanejamentoCard(p)).join('')}
                </div>
            </div>
        `;
    }

    createPlanejamentoCard(planejamento) {
        const topicsCount = planejamento.topics?.length || 0;
        const captureDate = this.formatDate(planejamento.capture_in);
        const deliveryDate = this.formatDate(planejamento.delivery_in);
        
        return `
            <div class="planejamento-card" data-id="${planejamento.id}">
                <div class="planejamento-card-header">
                    <div class="planejamento-client">
                        ${planejamento.client?.profile_photo ? `
                            <img src="${planejamento.client.profile_photo}" alt="${planejamento.client.users}" class="client-mini-avatar">
                        ` : `
                            <div class="client-mini-avatar-placeholder">
                                <i class="ph-fill ph-user"></i>
                            </div>
                        `}
                        <span class="client-mini-name">@${planejamento.client?.users || 'Desconhecido'}</span>
                    </div>
                </div>
                
                <h3 class="planejamento-card-title">${this.escapeHtml(planejamento.name || 'Sem título')}</h3>
                
                <div class="planejamento-card-dates">
                    <div class="planejamento-date-item">
                        <i class="ph ph-camera"></i>
                        <span>Captação: ${captureDate}</span>
                    </div>
                    <div class="planejamento-date-item">
                        <i class="ph ph-package"></i>
                        <span>Entrega: ${deliveryDate}</span>
                    </div>
                </div>
                
                <div class="planejamento-card-footer">
                    <div class="planejamento-topics-count">
                        <i class="ph-fill ph-list-bullets"></i>
                        ${topicsCount} tópico${topicsCount !== 1 ? 's' : ''}
                    </div>
                    <i class="ph ph-caret-right"></i>
                </div>
            </div>
        `;
    }

    renderDetails(planejamento) {
        const content = document.getElementById('tab-content');
        if (!content) return;

        const captureDate = this.formatDate(planejamento.capture_in);
        const deliveryDate = this.formatDate(planejamento.delivery_in);
        const topics = planejamento.topics || [];

        content.innerHTML = `
            <div class="planejamento-details">
                <div class="details-header">
                    <button id="btn-back-to-list" class="btn-back">
                        <i class="ph ph-arrow-left"></i>
                    </button>
                    <div class="details-header-info">
                        <div class="details-client">
                            ${planejamento.client?.profile_photo ? `
                                <img src="${planejamento.client.profile_photo}" alt="${planejamento.client.users}" class="client-avatar">
                            ` : `
                                <div class="client-avatar-placeholder">
                                    <i class="ph-fill ph-user"></i>
                                </div>
                            `}
                            <span class="client-name">@${planejamento.client?.users || 'Desconhecido'}</span>
                        </div>
                        <h1>${this.escapeHtml(planejamento.name || 'Sem título')}</h1>
                    </div>
                    <div class="details-actions">
                        <button id="btn-edit-planejamento" class="btn-icon" title="Editar planejamento">
                            <i class="ph-fill ph-pencil-simple"></i>
                        </button>
                        <button id="btn-delete-planejamento" class="btn-icon btn-icon-danger" title="Excluir planejamento">
                            <i class="ph-fill ph-trash"></i>
                        </button>
                    </div>
                </div>

                <div class="details-info">
                    <div class="info-card">
                        <i class="ph-fill ph-camera"></i>
                        <div>
                            <span class="info-label">Captação</span>
                            <span class="info-value">${captureDate}</span>
                        </div>
                    </div>
                    <div class="info-card">
                        <i class="ph-fill ph-package"></i>
                        <div>
                            <span class="info-label">Entrega</span>
                            <span class="info-value">${deliveryDate}</span>
                        </div>
                    </div>
                    <div class="info-card">
                        <i class="ph-fill ph-list-bullets"></i>
                        <div>
                            <span class="info-label">Tópicos</span>
                            <span class="info-value">${topics.length}</span>
                        </div>
                    </div>
                </div>

                <div class="topics-section">
                    <div class="topics-section-header">
                        <h2>Tópicos</h2>
                        <button id="btn-add-topic">
                            <i class="ph-fill ph-plus"></i>
                            Adicionar Tópico
                        </button>
                    </div>

                    ${topics.length === 0 ? `
                        <div class="empty-state">
                            <i class="ph ph-list-bullets"></i>
                            <h3>Nenhum tópico</h3>
                            <p>Adicione tópicos ao planejamento</p>
                        </div>
                    ` : `
                        <div class="topics-list">
                            ${topics.map((topic, index) => this.createTopicCard(topic, index, topics.length)).join('')}
                        </div>
                    `}
                </div>
            </div>
        `;
    }

    createTopicCard(topic, index, total) {
        const canMoveUp = index > 0;
        const canMoveDown = index < total - 1;

        return `
            <div class="topic-card">
                <div class="topic-card-header">
                    <div class="topic-order">#${index + 1}</div>
                    <h3 class="topic-title">${this.escapeHtml(topic.tittle || 'Sem título')}</h3>
                    <div class="topic-actions">
                        ${canMoveUp ? `
                            <button class="topic-move-btn topic-move-up" data-topic-id="${topic.id}" title="Mover para cima">
                                <i class="ph ph-caret-up"></i>
                            </button>
                        ` : ''}
                        ${canMoveDown ? `
                            <button class="topic-move-btn topic-move-down" data-topic-id="${topic.id}" title="Mover para baixo">
                                <i class="ph ph-caret-down"></i>
                            </button>
                        ` : ''}
                        <button class="topic-edit-btn" data-topic-id="${topic.id}" title="Editar">
                            <i class="ph-fill ph-pencil-simple"></i>
                        </button>
                        <button class="topic-delete-btn" data-topic-id="${topic.id}" title="Excluir">
                            <i class="ph-fill ph-trash"></i>
                        </button>
                    </div>
                </div>

                ${topic.type_content ? `
                    <div class="topic-type">
                        <i class="ph-fill ph-tag"></i>
                        ${this.escapeHtml(topic.type_content)}
                    </div>
                ` : ''}

                ${topic.briefing ? `
                    <div class="topic-section">
                        <div class="topic-section-label">
                            <i class="ph ph-file-text"></i>
                            Briefing
                        </div>
                        <p class="topic-section-text">${this.escapeHtml(topic.briefing)}</p>
                    </div>
                ` : ''}

                ${topic.script_tp ? `
                    <div class="topic-section">
                        <div class="topic-section-label">
                            <i class="ph ph-scroll"></i>
                            Roteiro TP
                        </div>
                        <p class="topic-section-text">${this.escapeHtml(topic.script_tp)}</p>
                    </div>
                ` : ''}

                ${topic.caption ? `
                    <div class="topic-section">
                        <div class="topic-section-label">
                            <i class="ph ph-chat-text"></i>
                            Legenda
                        </div>
                        <p class="topic-section-text">${this.escapeHtml(topic.caption)}</p>
                    </div>
                ` : ''}
            </div>
        `;
    }

    formatDate(dateString) {
        if (!dateString) return 'Não definida';
        
        try {
            const date = new Date(dateString + 'T00:00:00');
            return date.toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            });
        } catch {
            return dateString;
        }
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML.replace(/\n/g, '<br>');
    }
}