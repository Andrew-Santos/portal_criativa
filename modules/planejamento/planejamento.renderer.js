// planejamento.renderer.js - Edição Inline de Tópicos (Corrigido)
export class PlanejamentoRenderer {
    constructor(actions) {
        this.actions = actions;
        this.editingTopicId = null;
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

        this.editingTopicId = null;

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
        const isEditing = this.editingTopicId === topic.id;

        return `
            <div class="topic-card" data-topic-id="${topic.id}">
                <div class="topic-card-header">
                    <div class="topic-order">#${index + 1}</div>
                    <h3 class="topic-title" ${isEditing ? 'contenteditable="true"' : ''} data-field="tittle">${this.escapeHtml(topic.tittle || 'Sem título')}</h3>
                    
                    <div class="topic-actions topic-actions-normal" style="display: ${isEditing ? 'none' : 'flex'}">
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
                    
                    <div class="topic-actions-editing" style="display: ${isEditing ? 'flex' : 'none'}">
                        <button class="topic-cancel-btn" data-topic-id="${topic.id}" title="Cancelar">
                            <i class="ph ph-x"></i>
                        </button>
                        <button class="topic-save-btn" data-topic-id="${topic.id}" title="Salvar">
                            <i class="ph-fill ph-check"></i>
                        </button>
                    </div>
                </div>

                ${topic.type_content || isEditing ? `
                    <div class="topic-type">
                        <i class="ph-fill ph-tag"></i>
                        <span ${isEditing ? 'contenteditable="true"' : ''} data-field="type_content">${this.escapeHtml(topic.type_content || (isEditing ? 'Tipo de conteúdo...' : ''))}</span>
                    </div>
                ` : ''}

                ${topic.briefing || isEditing ? `
                    <div class="topic-section">
                        <div class="topic-section-label">
                            <i class="ph ph-file-text"></i>
                            Briefing
                        </div>
                        <p class="topic-section-text" ${isEditing ? 'contenteditable="true"' : ''} data-field="briefing">${topic.briefing ? topic.briefing.replace(/\n/g, '<br>') : (isEditing ? 'Digite o briefing...' : '')}</p>
                    </div>
                ` : ''}

                ${topic.script_tp || isEditing ? `
                    <div class="topic-section">
                        <div class="topic-section-label">
                            <i class="ph ph-scroll"></i>
                            Roteiro TP
                        </div>
                        <p class="topic-section-text" ${isEditing ? 'contenteditable="true"' : ''} data-field="script_tp">${topic.script_tp ? topic.script_tp.replace(/\n/g, '<br>') : (isEditing ? 'Digite o roteiro...' : '')}</p>
                    </div>
                ` : ''}

                ${topic.caption || isEditing ? `
                    <div class="topic-section">
                        <div class="topic-section-label">
                            <i class="ph ph-chat-text"></i>
                            Legenda
                        </div>
                        <p class="topic-section-text" ${isEditing ? 'contenteditable="true"' : ''} data-field="caption">${topic.caption ? topic.caption.replace(/\n/g, '<br>') : (isEditing ? 'Digite a legenda...' : '')}</p>
                    </div>
                ` : ''}
            </div>
        `;
    }

    enableTopicEditMode(topicId) {
        console.log('[PlanejamentoRenderer] Ativando edição do tópico:', topicId);
        this.editingTopicId = topicId;
        
        const card = document.querySelector(`[data-topic-id="${topicId}"]`);
        if (!card) return;

        // Trocar botões
        const normalActions = card.querySelector('.topic-actions-normal');
        const editingActions = card.querySelector('.topic-actions-editing');
        
        if (normalActions) normalActions.style.display = 'none';
        if (editingActions) editingActions.style.display = 'flex';

        // Habilitar contenteditable
        card.querySelectorAll('[data-field]').forEach(el => {
            el.contentEditable = 'true';
            const text = el.textContent.trim();
            if (!text || text.includes('Digite') || text.includes('Tipo de conteúdo')) {
                el.textContent = '';
                el.style.color = '#aaa';
            }
        });

        // Focar no título
        const titleElement = card.querySelector('.topic-title');
        if (titleElement) {
            titleElement.focus();
            const range = document.createRange();
            range.selectNodeContents(titleElement);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        }
    }

    disableTopicEditMode(topicId) {
        console.log('[PlanejamentoRenderer] Desativando edição do tópico:', topicId);
        this.editingTopicId = null;
        
        const card = document.querySelector(`[data-topic-id="${topicId}"]`);
        if (!card) return;

        // Trocar botões
        const normalActions = card.querySelector('.topic-actions-normal');
        const editingActions = card.querySelector('.topic-actions-editing');
        
        if (normalActions) normalActions.style.display = 'flex';
        if (editingActions) editingActions.style.display = 'none';

        // Desabilitar contenteditable
        card.querySelectorAll('[data-field]').forEach(el => {
            el.contentEditable = 'false';
            el.style.color = '';
        });
    }

    getTopicEditData(topicId) {
        const card = document.querySelector(`[data-topic-id="${topicId}"]`);
        if (!card) return null;

        const data = {};
        
        card.querySelectorAll('[data-field]').forEach(element => {
            const field = element.dataset.field;
            let value = '';
            
            if (element.tagName === 'H3' || element.tagName === 'SPAN') {
                // Para título e tipo: usar textContent
                value = element.textContent.trim();
            } else if (element.tagName === 'P') {
                // Para textos longos: preservar quebras de linha
                value = element.innerHTML
                    .replace(/<br\s*\/?>/gi, '\n')
                    .replace(/<div>/gi, '\n')
                    .replace(/<\/div>/gi, '')
                    .replace(/<[^>]+>/g, '')
                    .trim();
            }
            
            // Remover placeholders
            if (!value || value.includes('Digite') || value.includes('Tipo de conteúdo')) {
                value = '';
            }
            
            data[field] = value;
        });

        return data;
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
        return div.innerHTML;
    }
    
    unescapeHtml(html) {
        const div = document.createElement('div');
        div.innerHTML = html;
        return div.textContent;
    }
}