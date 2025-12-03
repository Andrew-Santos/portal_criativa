// post.edit.js - Editor de legenda e data do post
export class PostEditor {
    constructor(post, onSave) {
        this.post = post;
        this.onSave = onSave;
        this.modal = null;
    }

    open() {
        this.createModal();
        this.attachEvents();
    }

    createModal() {
        const modalHTML = `
            <div class="edit-modal-overlay">
                <div class="edit-modal">
                    <div class="edit-modal-header">
                        <h2>
                            <i class="ph-fill ph-pencil-simple"></i>
                            Editar Post
                        </h2>
                        <button class="edit-modal-close" type="button">
                            <i class="ph ph-x"></i>
                        </button>
                    </div>

                    <form class="edit-modal-form" id="edit-post-form">
                        <div class="edit-form-group">
                            <label for="edit-caption">
                                <i class="ph ph-text-align-left"></i>
                                Legenda
                            </label>
                            <textarea 
                                id="edit-caption" 
                                rows="6"
                                placeholder="Digite a legenda do post..."
                            >${this.post.caption || ''}</textarea>
                            <small class="edit-hint">
                                <span id="caption-counter">0</span> caracteres
                            </small>
                        </div>

                        <div class="edit-form-group">
                            <label for="edit-date">
                                <i class="ph ph-calendar"></i>
                                Data de Agendamento
                            </label>
                            <input 
                                type="datetime-local" 
                                id="edit-date"
                                value="${this.formatDateForInput(this.post.agendamento)}"
                                required>
                            <small class="edit-hint">Data e hora da publicação</small>
                        </div>

                        <div class="edit-modal-actions">
                            <button type="button" class="edit-btn edit-btn-cancel">
                                Cancelar
                            </button>
                            <button type="submit" class="edit-btn edit-btn-save">
                                <i class="ph-fill ph-floppy-disk"></i>
                                Salvar Alterações
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.modal = document.querySelector('.edit-modal-overlay');
        document.body.classList.add('no-scroll');

        // Animar entrada
        setTimeout(() => {
            this.modal.classList.add('active');
        }, 10);

        // Atualizar contador
        this.updateCharCounter();
    }

    attachEvents() {
        const closeBtn = this.modal.querySelector('.edit-modal-close');
        const cancelBtn = this.modal.querySelector('.edit-btn-cancel');
        const form = document.getElementById('edit-post-form');
        const captionInput = document.getElementById('edit-caption');

        // Fechar modal
        const closeModal = () => this.close();
        closeBtn.addEventListener('click', closeModal);
        cancelBtn.addEventListener('click', closeModal);
        
        // Fechar ao clicar no overlay
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) closeModal();
        });

        // ESC para fechar
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);

        // Contador de caracteres
        captionInput.addEventListener('input', () => {
            this.updateCharCounter();
        });

        // Submit do formulário
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleSave();
        });
    }

    updateCharCounter() {
        const captionInput = document.getElementById('edit-caption');
        const counter = document.getElementById('caption-counter');
        if (captionInput && counter) {
            counter.textContent = captionInput.value.length;
        }
    }

    async handleSave() {
        const captionInput = document.getElementById('edit-caption');
        const dateInput = document.getElementById('edit-date');
        const saveBtn = this.modal.querySelector('.edit-btn-save');

        const newCaption = captionInput.value.trim();
        const newDate = dateInput.value;

        if (!newDate) {
            alert('Por favor, selecione uma data de agendamento');
            return;
        }

        // Validar data futura
        const selectedDate = new Date(newDate);
        const now = new Date();
        if (selectedDate < now) {
            alert('A data de agendamento deve ser futura');
            return;
        }

        // Mostrar loading
        const originalHTML = saveBtn.innerHTML;
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<div class="btn-spinner"></div> Salvando...';

        try {
            console.log('[PostEditor] Salvando alterações do post:', this.post.id);

            // Atualizar no Supabase
            const { error } = await window.supabaseClient
                .from('post')
                .update({
                    caption: newCaption,
                    agendamento: newDate
                })
                .eq('id', this.post.id);

            if (error) throw error;

            console.log('[PostEditor] Post atualizado com sucesso');

            // Atualizar objeto local
            this.post.caption = newCaption;
            this.post.agendamento = newDate;

            // Callback de sucesso
            if (this.onSave) {
                this.onSave(this.post);
            }

            // Fechar modal
            this.close();

            // Mostrar feedback
            this.showSuccessToast();

        } catch (error) {
            console.error('[PostEditor] Erro ao salvar:', error);
            alert('Erro ao salvar alterações. Tente novamente.');
            saveBtn.disabled = false;
            saveBtn.innerHTML = originalHTML;
        }
    }

    showSuccessToast() {
        const toast = document.createElement('div');
        toast.className = 'edit-success-toast';
        toast.innerHTML = `
            <i class="ph-fill ph-check-circle"></i>
            <span>Alterações salvas com sucesso!</span>
        `;
        document.body.appendChild(toast);

        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    formatDateForInput(dateString) {
        if (!dateString) return '';
        try {
            const date = new Date(dateString);
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            return `${year}-${month}-${day}T${hours}:${minutes}`;
        } catch {
            return '';
        }
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
