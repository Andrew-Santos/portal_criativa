// planejamento.editor.js - Editor de planejamentos e tópicos
export class PlanejamentoEditor {
    constructor(item, clients, onSave, mode = 'planejamento') {
        this.item = item; // null para novo, objeto para edição
        this.clients = clients;
        this.onSave = onSave;
        this.mode = mode; // 'planejamento' ou 'topic'
        this.modal = null;
    }

    open() {
        this.createModal();
        this.attachEvents();
    }

    createModal() {
        const isEdit = this.item !== null;
        const title = this.mode === 'planejamento' 
            ? (isEdit ? 'Editar Planejamento' : 'Novo Planejamento')
            : (isEdit ? 'Editar Tópico' : 'Novo Tópico');

        const icon = this.mode === 'planejamento' 
            ? 'ph-folder-notch-open' 
            : 'ph-list-bullets';

        const modalHTML = `
            <div class="edit-modal-overlay">
                <div class="edit-modal">
                    <div class="edit-modal-header">
                        <h2>
                            <i class="ph-fill ${icon}"></i>
                            ${title}
                        </h2>
                        <button class="edit-modal-close" type="button">
                            <i class="ph ph-x"></i>
                        </button>
                    </div>

                    <form class="edit-modal-form" id="planejamento-form">
                        ${this.mode === 'planejamento' ? this.renderPlanejamentoForm() : this.renderTopicForm()}

                        <div class="edit-modal-actions">
                            <button type="button" class="edit-btn edit-btn-cancel">
                                Cancelar
                            </button>
                            <button type="submit" class="edit-btn edit-btn-save">
                                <i class="ph-fill ph-floppy-disk"></i>
                                ${isEdit ? 'Salvar Alterações' : 'Criar'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.modal = document.querySelector('.edit-modal-overlay');
        document.body.classList.add('no-scroll');

        setTimeout(() => {
            this.modal.classList.add('active');
        }, 10);
    }

    renderPlanejamentoForm() {
        return `
            ${this.clients.length > 1 ? `
                <div class="edit-form-group">
                    <label for="edit-client">
                        <i class="ph ph-user"></i>
                        Cliente
                    </label>
                    <select id="edit-client" required>
                        <option value="">Selecione um cliente</option>
                        ${this.clients.map(client => `
                            <option value="${client.id}" ${this.item?.id_client === client.id ? 'selected' : ''}>
                                @${client.users}
                            </option>
                        `).join('')}
                    </select>
                </div>
            ` : `
                <input type="hidden" id="edit-client" value="${this.clients[0].id}">
            `}

            <div class="edit-form-group">
                <label for="edit-name">
                    <i class="ph ph-text-align-left"></i>
                    Nome do Planejamento
                </label>
                <input 
                    type="text" 
                    id="edit-name" 
                    placeholder="Ex: Planejamento Outubro 2024"
                    value="${this.item?.name || ''}"
                    required>
                <small class="edit-hint">Nome identificador do planejamento</small>
            </div>

            <div class="edit-form-group">
                <label for="edit-capture">
                    <i class="ph ph-camera"></i>
                    Data de Captação
                </label>
                <input 
                    type="date" 
                    id="edit-capture"
                    value="${this.item?.capture_in || ''}"
                    required>
                <small class="edit-hint">Quando será feita a captação do material</small>
            </div>

            <div class="edit-form-group">
                <label for="edit-delivery">
                    <i class="ph ph-package"></i>
                    Data de Entrega
                </label>
                <input 
                    type="date" 
                    id="edit-delivery"
                    value="${this.item?.delivery_in || ''}"
                    required>
                <small class="edit-hint">Prazo final para entrega do material</small>
            </div>
        `;
    }

    renderTopicForm() {
        return `
            <div class="edit-form-group">
                <label for="edit-title">
                    <i class="ph ph-text-align-left"></i>
                    Título do Tópico
                </label>
                <input 
                    type="text" 
                    id="edit-title" 
                    placeholder="Ex: Post sobre produto X"
                    value="${this.item?.tittle || ''}"
                    required>
            </div>

            <div class="edit-form-group">
                <label for="edit-type">
                    <i class="ph ph-tag"></i>
                    Tipo de Conteúdo
                </label>
                <input 
                    type="text" 
                    id="edit-type" 
                    placeholder="Ex: Feed, Reels, Story"
                    value="${this.item?.type_content || ''}">
                <small class="edit-hint">Formato do conteúdo</small>
            </div>

            <div class="edit-form-group">
                <label for="edit-briefing">
                    <i class="ph ph-file-text"></i>
                    Briefing
                </label>
                <textarea 
                    id="edit-briefing" 
                    rows="4"
                    placeholder="Descreva as informações e requisitos do conteúdo..."
                >${this.item?.briefing || ''}</textarea>
                <small class="edit-hint">Descrição detalhada do que deve ser feito</small>
            </div>

            <div class="edit-form-group">
                <label for="edit-script">
                    <i class="ph ph-scroll"></i>
                    Roteiro TP
                </label>
                <textarea 
                    id="edit-script" 
                    rows="3"
                    placeholder="Roteiro para terceira pessoa..."
                >${this.item?.script_tp || ''}</textarea>
                <small class="edit-hint">Roteiro na terceira pessoa para gravação</small>
            </div>

            <div class="edit-form-group">
                <label for="edit-caption">
                    <i class="ph ph-chat-text"></i>
                    Legenda
                </label>
                <textarea 
                    id="edit-caption" 
                    rows="3"
                    placeholder="Legenda para o post..."
                >${this.item?.caption || ''}</textarea>
                <small class="edit-hint">Texto que será usado na publicação</small>
            </div>
        `;
    }

    attachEvents() {
        const closeBtn = this.modal.querySelector('.edit-modal-close');
        const cancelBtn = this.modal.querySelector('.edit-btn-cancel');
        const form = document.getElementById('planejamento-form');

        const closeModal = () => this.close();
        closeBtn.addEventListener('click', closeModal);
        cancelBtn.addEventListener('click', closeModal);

        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) closeModal();
        });

        const escHandler = (e) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleSave();
        });
    }

    async handleSave() {
        const saveBtn = this.modal.querySelector('.edit-btn-save');
        const originalHTML = saveBtn.innerHTML;
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<div class="btn-spinner"></div> Salvando...';

        try {
            const data = this.mode === 'planejamento' 
                ? this.getPlanejamentoData() 
                : this.getTopicData();

            console.log('[PlanejamentoEditor] Salvando:', data);

            if (this.onSave) {
                await this.onSave(data);
            }

            this.close();
        } catch (error) {
            console.error('[PlanejamentoEditor] Erro ao salvar:', error);
            alert('Erro ao salvar: ' + error.message);
            saveBtn.disabled = false;
            saveBtn.innerHTML = originalHTML;
        }
    }

    getPlanejamentoData() {
        const clientId = parseInt(document.getElementById('edit-client').value);
        const name = document.getElementById('edit-name').value.trim();
        const captureIn = document.getElementById('edit-capture').value;
        const deliveryIn = document.getElementById('edit-delivery').value;

        if (!clientId || !name || !captureIn || !deliveryIn) {
            throw new Error('Preencha todos os campos obrigatórios');
        }

        // Validar datas
        const capture = new Date(captureIn);
        const delivery = new Date(deliveryIn);
        
        if (delivery < capture) {
            throw new Error('A data de entrega deve ser posterior à data de captação');
        }

        return {
            id_client: clientId,
            name,
            capture_in: captureIn,
            delivery_in: deliveryIn
        };
    }

    getTopicData() {
        const tittle = document.getElementById('edit-title').value.trim();
        const typeContent = document.getElementById('edit-type').value.trim();
        const briefing = document.getElementById('edit-briefing').value.trim();
        const scriptTp = document.getElementById('edit-script').value.trim();
        const caption = document.getElementById('edit-caption').value.trim();

        if (!tittle) {
            throw new Error('O título é obrigatório');
        }

        return {
            tittle,
            type_content: typeContent || null,
            briefing: briefing || null,
            script_tp: scriptTp || null,
            caption: caption || null
        };
    }

    close() {
        if (!this.modal) return;

        this.modal.classList.remove('active');
        setTimeout(() => {
            this.modal.remove();
            document.body.classList.remove('no-scroll');
        }, 300);
    }
}