// planejamento.actions.js - Gerencia planejamentos
import { PlanejamentoRenderer } from './planejamento.renderer.js';
import { PlanejamentoEditor } from './planejamento.editor.js';

export class PlanejamentoActions {
    constructor(panel, authData) {
        this.panel = panel;
        this.authData = authData;
        this.renderer = new PlanejamentoRenderer(this);
        this.planejamentos = [];
        this.clientIds = authData.clients.map(c => c.id);
        this.currentView = 'list'; // 'list' ou 'details'
        this.selectedPlanejamento = null;
    }

    async init() {
        console.log('[PlanejamentoActions] Inicializando...');
        await this.loadPlanejamentos();
        this.attachEvents();
    }

    async loadPlanejamentos() {
        const content = document.getElementById('tab-content');
        if (!content) return;

        content.innerHTML = `
            <div class="loading-container">
                <div class="loading-spinner"></div>
                <p>Carregando planejamentos...</p>
            </div>
        `;

        try {
            this.planejamentos = await this.fetchPlanejamentos();
            console.log('[PlanejamentoActions] Planejamentos encontrados:', this.planejamentos.length);
            this.renderer.renderList(this.planejamentos);
        } catch (error) {
            console.error('[PlanejamentoActions] Erro ao carregar:', error);
            content.innerHTML = `
                <div class="error-container">
                    <i class="ph ph-warning-circle"></i>
                    <h3>Erro ao carregar planejamentos</h3>
                    <p>${error.message}</p>
                </div>
            `;
        }
    }

    async fetchPlanejamentos() {
        try {
            const { data, error } = await window.supabaseClient
                .from('planejamento')
                .select(`
                    *,
                    client:id_client (
                        id,
                        users,
                        profile_photo
                    ),
                    topics:planejamento_topics (
                        id,
                        tittle,
                        briefing,
                        type_content,
                        script_tp,
                        caption,
                        order_position
                    )
                `)
                .in('id_client', this.clientIds)
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Ordenar tópicos dentro de cada planejamento
            return (data || []).map(p => ({
                ...p,
                topics: (p.topics || []).sort((a, b) => 
                    (a.order_position || 0) - (b.order_position || 0)
                )
            }));
        } catch (error) {
            console.error('[PlanejamentoActions] Erro ao buscar:', error);
            throw error;
        }
    }

    attachEvents() {
        const content = document.getElementById('tab-content');
        if (!content) return;

        content.addEventListener('click', async (e) => {
            // Criar novo planejamento
            if (e.target.closest('#btn-new-planejamento')) {
                this.createNewPlanejamento();
                return;
            }

            // Abrir detalhes
            const planejamentoCard = e.target.closest('.planejamento-card');
            if (planejamentoCard) {
                const id = parseInt(planejamentoCard.dataset.id);
                await this.openDetails(id);
                return;
            }

            // Voltar para lista
            if (e.target.closest('#btn-back-to-list')) {
                await this.loadPlanejamentos();
                return;
            }

            // Editar planejamento
            if (e.target.closest('#btn-edit-planejamento')) {
                this.editPlanejamento(this.selectedPlanejamento);
                return;
            }

            // Excluir planejamento
            if (e.target.closest('#btn-delete-planejamento')) {
                await this.deletePlanejamento(this.selectedPlanejamento.id);
                return;
            }

            // Adicionar tópico
            if (e.target.closest('#btn-add-topic')) {
                this.addTopic(this.selectedPlanejamento.id);
                return;
            }

            // Editar tópico
            const editTopicBtn = e.target.closest('.topic-edit-btn');
            if (editTopicBtn) {
                const topicId = parseInt(editTopicBtn.dataset.topicId);
                const topic = this.selectedPlanejamento.topics.find(t => t.id === topicId);
                if (topic) this.editTopic(topic);
                return;
            }

            // Excluir tópico
            const deleteTopicBtn = e.target.closest('.topic-delete-btn');
            if (deleteTopicBtn) {
                const topicId = parseInt(deleteTopicBtn.dataset.topicId);
                await this.deleteTopic(topicId);
                return;
            }

            // Mover tópico para cima
            const moveUpBtn = e.target.closest('.topic-move-up');
            if (moveUpBtn) {
                const topicId = parseInt(moveUpBtn.dataset.topicId);
                await this.moveTopicUp(topicId);
                return;
            }

            // Mover tópico para baixo
            const moveDownBtn = e.target.closest('.topic-move-down');
            if (moveDownBtn) {
                const topicId = parseInt(moveDownBtn.dataset.topicId);
                await this.moveTopicDown(topicId);
                return;
            }
        });
    }

    async openDetails(planejamentoId) {
        const planejamento = this.planejamentos.find(p => p.id === planejamentoId);
        if (!planejamento) return;

        this.selectedPlanejamento = planejamento;
        this.currentView = 'details';
        this.renderer.renderDetails(planejamento);
    }

    createNewPlanejamento() {
        const editor = new PlanejamentoEditor(null, this.authData.clients, async (data) => {
            await this.savePlanejamento(data);
        });
        editor.open();
    }

    editPlanejamento(planejamento) {
        const editor = new PlanejamentoEditor(planejamento, this.authData.clients, async (data) => {
            await this.updatePlanejamento(planejamento.id, data);
        });
        editor.open();
    }

    async savePlanejamento(data) {
        try {
            const { data: newPlanejamento, error } = await window.supabaseClient
                .from('planejamento')
                .insert({
                    id_client: data.id_client,
                    name: data.name,
                    capture_in: data.capture_in,
                    delivery_in: data.delivery_in
                })
                .select()
                .single();

            if (error) throw error;

            console.log('[PlanejamentoActions] Planejamento criado:', newPlanejamento.id);
            await this.loadPlanejamentos();
            this.showSuccessToast('Planejamento criado com sucesso!');
        } catch (error) {
            console.error('[PlanejamentoActions] Erro ao criar:', error);
            alert('Erro ao criar planejamento: ' + error.message);
        }
    }

    async updatePlanejamento(id, data) {
        try {
            const { error } = await window.supabaseClient
                .from('planejamento')
                .update({
                    name: data.name,
                    capture_in: data.capture_in,
                    delivery_in: data.delivery_in
                })
                .eq('id', id);

            if (error) throw error;

            console.log('[PlanejamentoActions] Planejamento atualizado:', id);
            
            // Atualizar localmente
            const index = this.planejamentos.findIndex(p => p.id === id);
            if (index !== -1) {
                this.planejamentos[index] = { ...this.planejamentos[index], ...data };
                if (this.selectedPlanejamento && this.selectedPlanejamento.id === id) {
                    this.selectedPlanejamento = this.planejamentos[index];
                    this.renderer.renderDetails(this.selectedPlanejamento);
                }
            }

            this.showSuccessToast('Planejamento atualizado!');
        } catch (error) {
            console.error('[PlanejamentoActions] Erro ao atualizar:', error);
            alert('Erro ao atualizar planejamento: ' + error.message);
        }
    }

    async deletePlanejamento(id) {
        if (!confirm('Deseja realmente excluir este planejamento? Todos os tópicos serão excluídos.')) {
            return;
        }

        try {
            const { error } = await window.supabaseClient
                .from('planejamento')
                .delete()
                .eq('id', id);

            if (error) throw error;

            console.log('[PlanejamentoActions] Planejamento excluído:', id);
            await this.loadPlanejamentos();
            this.showSuccessToast('Planejamento excluído!');
        } catch (error) {
            console.error('[PlanejamentoActions] Erro ao excluir:', error);
            alert('Erro ao excluir planejamento: ' + error.message);
        }
    }

    addTopic(planejamentoId) {
        const editor = new PlanejamentoEditor(null, this.authData.clients, async (data) => {
            await this.saveTopic(planejamentoId, data);
        }, 'topic');
        editor.open();
    }

    editTopic(topic) {
        const editor = new PlanejamentoEditor(topic, this.authData.clients, async (data) => {
            await this.updateTopic(topic.id, data);
        }, 'topic');
        editor.open();
    }

    async saveTopic(planejamentoId, data) {
        try {
            // Obter próxima ordem
            const maxOrder = Math.max(0, ...this.selectedPlanejamento.topics.map(t => t.order_position || 0));

            const { data: newTopic, error } = await window.supabaseClient
                .from('planejamento_topics')
                .insert({
                    id_planejamento: planejamentoId,
                    id_client: this.selectedPlanejamento.id_client,
                    tittle: data.tittle,
                    briefing: data.briefing,
                    type_content: data.type_content,
                    script_tp: data.script_tp,
                    caption: data.caption,
                    order_position: maxOrder + 1
                })
                .select()
                .single();

            if (error) throw error;

            console.log('[PlanejamentoActions] Tópico criado:', newTopic.id);
            
            // Recarregar planejamento
            await this.reloadCurrentPlanejamento();
            this.showSuccessToast('Tópico adicionado!');
        } catch (error) {
            console.error('[PlanejamentoActions] Erro ao criar tópico:', error);
            alert('Erro ao criar tópico: ' + error.message);
        }
    }

    async updateTopic(topicId, data) {
        try {
            const { error } = await window.supabaseClient
                .from('planejamento_topics')
                .update({
                    tittle: data.tittle,
                    briefing: data.briefing,
                    type_content: data.type_content,
                    script_tp: data.script_tp,
                    caption: data.caption
                })
                .eq('id', topicId);

            if (error) throw error;

            console.log('[PlanejamentoActions] Tópico atualizado:', topicId);
            await this.reloadCurrentPlanejamento();
            this.showSuccessToast('Tópico atualizado!');
        } catch (error) {
            console.error('[PlanejamentoActions] Erro ao atualizar tópico:', error);
            alert('Erro ao atualizar tópico: ' + error.message);
        }
    }

    async deleteTopic(topicId) {
        if (!confirm('Deseja realmente excluir este tópico?')) return;

        try {
            const { error } = await window.supabaseClient
                .from('planejamento_topics')
                .delete()
                .eq('id', topicId);

            if (error) throw error;

            console.log('[PlanejamentoActions] Tópico excluído:', topicId);
            await this.reloadCurrentPlanejamento();
            this.showSuccessToast('Tópico excluído!');
        } catch (error) {
            console.error('[PlanejamentoActions] Erro ao excluir tópico:', error);
            alert('Erro ao excluir tópico: ' + error.message);
        }
    }

    async moveTopicUp(topicId) {
        const topics = this.selectedPlanejamento.topics;
        const index = topics.findIndex(t => t.id === topicId);
        
        if (index <= 0) return; // Já está no topo

        const currentTopic = topics[index];
        const previousTopic = topics[index - 1];

        await this.swapTopicPositions(currentTopic, previousTopic);
    }

    async moveTopicDown(topicId) {
        const topics = this.selectedPlanejamento.topics;
        const index = topics.findIndex(t => t.id === topicId);
        
        if (index < 0 || index >= topics.length - 1) return; // Já está no final

        const currentTopic = topics[index];
        const nextTopic = topics[index + 1];

        await this.swapTopicPositions(currentTopic, nextTopic);
    }

    async swapTopicPositions(topic1, topic2) {
        try {
            const pos1 = topic1.order_position;
            const pos2 = topic2.order_position;

            // Atualizar no banco
            const { error: error1 } = await window.supabaseClient
                .from('planejamento_topics')
                .update({ order_position: pos2 })
                .eq('id', topic1.id);

            const { error: error2 } = await window.supabaseClient
                .from('planejamento_topics')
                .update({ order_position: pos1 })
                .eq('id', topic2.id);

            if (error1 || error2) throw error1 || error2;

            console.log('[PlanejamentoActions] Posições trocadas');
            await this.reloadCurrentPlanejamento();
        } catch (error) {
            console.error('[PlanejamentoActions] Erro ao trocar posições:', error);
            alert('Erro ao reordenar tópicos: ' + error.message);
        }
    }

    async reloadCurrentPlanejamento() {
        if (!this.selectedPlanejamento) return;

        try {
            const { data, error } = await window.supabaseClient
                .from('planejamento')
                .select(`
                    *,
                    client:id_client (
                        id,
                        users,
                        profile_photo
                    ),
                    topics:planejamento_topics (
                        id,
                        tittle,
                        briefing,
                        type_content,
                        script_tp,
                        caption,
                        order_position
                    )
                `)
                .eq('id', this.selectedPlanejamento.id)
                .single();

            if (error) throw error;

            // Ordenar tópicos
            data.topics = (data.topics || []).sort((a, b) => 
                (a.order_position || 0) - (b.order_position || 0)
            );

            this.selectedPlanejamento = data;
            
            // Atualizar na lista também
            const index = this.planejamentos.findIndex(p => p.id === data.id);
            if (index !== -1) {
                this.planejamentos[index] = data;
            }

            this.renderer.renderDetails(this.selectedPlanejamento);
        } catch (error) {
            console.error('[PlanejamentoActions] Erro ao recarregar:', error);
        }
    }

    showSuccessToast(message) {
        const toast = document.createElement('div');
        toast.className = 'edit-success-toast';
        toast.innerHTML = `
            <i class="ph-fill ph-check-circle"></i>
            <span>${message}</span>
        `;
        document.body.appendChild(toast);

        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    destroy() {
        const content = document.getElementById('tab-content');
        if (content) {
            content.innerHTML = '';
        }
    }
}