
export class RejectionChat {
    constructor(postId, postData) {
        this.postId = postId;
        this.postData = postData;
        this.isRecording = false;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.recordingStartTime = null;
        this.messages = []; // Armazenar mensagens em memória até confirmação
    }

    open() {
        console.log('[RejectionChat] Abrindo chat para post:', this.postId);
        this.render();
        this.attachEvents();
        
        // Bloquear scroll
        document.body.style.overflow = 'hidden';
    }

    render() {
        const modal = document.createElement('div');
        modal.id = 'rejection-chat-modal';
        modal.className = 'rejection-chat-modal';
        modal.innerHTML = `
            <div class="chat-overlay"></div>
            <div class="chat-container">
                <!-- Header -->
                <div class="chat-header">
                    <div class="chat-header-content">
                        <button class="chat-back-btn">
                            <i class="ph-bold ph-arrow-left"></i>
                        </button>
                        <div class="chat-header-info">
                            <h3>Motivo da Recusa</h3>
                            <p>Explique por que o post foi recusado</p>
                        </div>
                    </div>
                </div>

                <!-- Messages Area -->
                <div class="chat-messages" id="chat-messages">
                    <div class="chat-date-divider">
                        <span>Hoje</span>
                    </div>
                    <!-- Mensagens serão carregadas aqui -->
                </div>

                <!-- Input Area -->
                <div class="chat-input-area">
                    <div class="chat-input-wrapper" id="chat-input-wrapper">
                        <button class="chat-emoji-btn" id="chat-emoji-btn" title="Emoji">
                            <i class="ph ph-smiley"></i>
                        </button>
                        
                        <textarea 
                            class="chat-textarea" 
                            id="chat-textarea" 
                            placeholder="Digite uma mensagem..."
                            rows="1"
                            maxlength="1000"></textarea>
                        
                        <button class="chat-attach-btn" id="chat-mic-btn" title="Gravar áudio">
                            <i class="ph-fill ph-microphone"></i>
                        </button>
                    </div>

                    <button class="chat-send-btn" id="chat-send-btn" disabled>
                        <i class="ph-fill ph-paper-plane-tilt"></i>
                    </button>

                    <!-- Recording UI (hidden by default) -->
                    <div class="chat-recording-ui" id="chat-recording-ui" style="display: none;">
                        <div class="recording-content">
                            <button class="recording-cancel-btn" id="recording-cancel-btn">
                                <i class="ph-bold ph-x"></i>
                            </button>
                            <div class="recording-indicator">
                                <div class="recording-dot"></div>
                                <span class="recording-time" id="recording-time">0:00</span>
                            </div>
                            <button class="recording-send-btn" id="recording-send-btn">
                                <i class="ph-fill ph-check"></i>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Footer com botão de rejeitar -->
                <div class="chat-footer">
                    <button class="chat-reject-btn" id="final-reject-btn">
                        <i class="ph ph-x-circle"></i>
                        Confirmar Recusa do Post
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Animar entrada
        setTimeout(() => {
            modal.classList.add('active');
        }, 10);

        // Carregar mensagens existentes
        this.loadMessages();
    }

    attachEvents() {
        const modal = document.getElementById('rejection-chat-modal');
        
        // Fechar
        modal.querySelector('.chat-back-btn').addEventListener('click', () => this.close());
        modal.querySelector('.chat-overlay').addEventListener('click', () => this.close());

        // Textarea auto-resize e envio
        const textarea = document.getElementById('chat-textarea');
        const sendBtn = document.getElementById('chat-send-btn');

        textarea.addEventListener('input', (e) => {
            this.autoResizeTextarea(e.target);
            sendBtn.disabled = e.target.value.trim().length === 0;
        });

        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (textarea.value.trim()) {
                    this.addTextMessage(textarea.value.trim());
                }
            }
        });

        // Enviar texto (apenas salvar em memória)
        sendBtn.addEventListener('click', () => {
            if (textarea.value.trim()) {
                this.addTextMessage(textarea.value.trim());
            }
        });

        // Botão de microfone
        const micBtn = document.getElementById('chat-mic-btn');
        micBtn.addEventListener('click', () => this.toggleRecording());

        // Botões de gravação
        document.getElementById('recording-cancel-btn').addEventListener('click', () => this.cancelRecording());
        document.getElementById('recording-send-btn').addEventListener('click', () => this.addAudioMessage());

        // Botão de rejeitar final (salva tudo no banco)
        document.getElementById('final-reject-btn').addEventListener('click', () => this.confirmRejection());
    }

    autoResizeTextarea(textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }

    async loadMessages() {
        try {
            const { data, error } = await window.supabaseClient
                .from('rejection_chat')
                .select('*')
                .eq('id_post', this.postId)
                .order('created_at', { ascending: true });

            if (error) throw error;

            if (data && data.length > 0) {
                this.messages = data;
                data.forEach(msg => this.appendMessage(msg, false));
                const messagesContainer = document.getElementById('chat-messages');
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }
        } catch (error) {
            console.error('[RejectionChat] Erro ao carregar mensagens:', error);
        }
    }

    addTextMessage(text) {
        const textarea = document.getElementById('chat-textarea');
        const sendBtn = document.getElementById('chat-send-btn');
        
        textarea.disabled = true;
        sendBtn.disabled = true;

        // Simular mensagem localmente
        const messageObj = {
            id: Date.now(),
            message_type: 'text',
            message_or_url: text,
            created_by: 'client',
            created_at: new Date().toISOString(),
            temp: true // Marcar como temporária
        };

        this.messages.push(messageObj);
        this.appendMessage(messageObj, true);

        textarea.value = '';
        this.autoResizeTextarea(textarea);
        textarea.disabled = false;
        sendBtn.disabled = true;
        textarea.focus();
    }

    async toggleRecording() {
        if (this.isRecording) {
            this.stopRecording();
        } else {
            await this.startRecording();
        }
    }

    async startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            this.mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm;codecs=opus'
            });
            
            this.audioChunks = [];
            this.recordingStartTime = Date.now();

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };

            this.mediaRecorder.onstop = () => {
                stream.getTracks().forEach(track => track.stop());
            };

            this.mediaRecorder.start();
            this.isRecording = true;

            // Mostrar UI de gravação
            document.getElementById('chat-input-wrapper').style.display = 'none';
            document.getElementById('chat-send-btn').style.display = 'none';
            document.getElementById('chat-recording-ui').style.display = 'flex';

            // Iniciar contador
            this.startRecordingTimer();

            console.log('[RejectionChat] Gravação iniciada');
            
        } catch (error) {
            console.error('[RejectionChat] Erro ao iniciar gravação:', error);
            alert('Não foi possível acessar o microfone. Verifique as permissões.');
        }
    }

    stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
            this.stopRecordingTimer();
            console.log('[RejectionChat] Gravação parada');
        }
    }

    cancelRecording() {
        this.stopRecording();
        this.audioChunks = [];
        
        // Voltar UI normal
        document.getElementById('chat-input-wrapper').style.display = 'flex';
        document.getElementById('chat-send-btn').style.display = 'flex';
        document.getElementById('chat-recording-ui').style.display = 'none';
        
        console.log('[RejectionChat] Gravação cancelada');
    }

    addAudioMessage() {
        this.stopRecording();

        // Criar blob do áudio
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        
        // Criar URL local para reprodução
        const audioUrl = URL.createObjectURL(audioBlob);

        // Adicionar mensagem de áudio localmente
        const messageObj = {
            id: Date.now(),
            message_type: 'audio',
            message_or_url: audioUrl,
            created_by: 'client',
            created_at: new Date().toISOString(),
            temp: true,
            audioBlob: audioBlob // Armazenar o blob para envio posterior
        };

        this.messages.push(messageObj);
        this.appendMessage(messageObj, true);

        // Limpar
        this.audioChunks = [];
        
        // Voltar UI normal
        document.getElementById('chat-input-wrapper').style.display = 'flex';
        document.getElementById('chat-send-btn').style.display = 'flex';
        document.getElementById('chat-recording-ui').style.display = 'none';
    }

    startRecordingTimer() {
        const timerEl = document.getElementById('recording-time');
        
        this.recordingInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - this.recordingStartTime) / 1000);
            const minutes = Math.floor(elapsed / 60);
            const seconds = elapsed % 60;
            timerEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }, 1000);
    }

    stopRecordingTimer() {
        if (this.recordingInterval) {
            clearInterval(this.recordingInterval);
            this.recordingInterval = null;
        }
    }

    appendMessage(message, animate = false) {
        const messagesContainer = document.getElementById('chat-messages');
        const isOwnMessage = message.created_by === 'client';
        
        const messageEl = document.createElement('div');
        messageEl.className = `chat-message ${isOwnMessage ? 'own-message' : 'other-message'}`;
        
        if (animate) {
            messageEl.classList.add('message-enter');
        }

        if (message.message_type === 'text') {
            messageEl.innerHTML = `
                <div class="message-bubble">
                    <p>${this.escapeHtml(message.message_or_url)}</p>
                    <span class="message-time">${this.formatTime(message.created_at)}</span>
                </div>
            `;
        } else {
            // Áudio
            messageEl.innerHTML = `
                <div class="message-bubble audio-bubble">
                    <audio controls src="${message.message_or_url}"></audio>
                    <span class="message-time">${this.formatTime(message.created_at)}</span>
                </div>
            `;
        }

        messagesContainer.appendChild(messageEl);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    async confirmRejection() {
        const btn = document.getElementById('final-reject-btn');
        
        if (!confirm('Confirmar a recusa deste post? Esta ação não pode ser desfeita.')) {
            return;
        }

        btn.disabled = true;
        const originalHTML = btn.innerHTML;
        btn.innerHTML = '<div class="btn-spinner"></div> Processando...';

        try {
            // Enviar todas as mensagens para o banco
            for (const message of this.messages) {
                if (message.message_type === 'text') {
                    // Texto - enviar direto
                    await window.supabaseClient
                        .from('rejection_chat')
                        .insert({
                            id_post: this.postId,
                            message_type: 'text',
                            message_or_url: message.message_or_url,
                            created_by: 'client'
                        });
                } else if (message.message_type === 'audio' && message.audioBlob) {
                    // Áudio - fazer upload e obter URL
                    const fileName = `${this.postId}_${Date.now()}.webm`;
                    
                    const { data: uploadData, error: uploadError } = await window.supabaseClient
                        .storage
                        .from('rejection-audios')
                        .upload(fileName, message.audioBlob, {
                            contentType: 'audio/webm',
                            cacheControl: '3600'
                        });

                    if (uploadError) throw uploadError;

                    const { data: urlData } = window.supabaseClient
                        .storage
                        .from('rejection-audios')
                        .getPublicUrl(fileName);

                    // Salvar referência no banco
                    await window.supabaseClient
                        .from('rejection_chat')
                        .insert({
                            id_post: this.postId,
                            message_type: 'audio',
                            message_or_url: urlData.publicUrl,
                            created_by: 'client'
                        });
                }
            }

            // Atualizar status do post para REPROVADO
            const now = new Date().toISOString();
            
            const { error: updateError } = await window.supabaseClient
                .from('post')
                .update({
                    status: 'REPROVADO',
                    reject_date: now
                })
                .eq('id', this.postId);
            
            if (updateError) throw updateError;
            
            console.log('[RejectionChat] Post recusado com sucesso');
            
            // Fechar modal
            this.close();
            
            // Disparar evento customizado para remover o card
            const event = new CustomEvent('post-rejected', { detail: { postId: this.postId } });
            document.dispatchEvent(event);
            
        } catch (error) {
            console.error('[RejectionChat] Erro ao rejeitar post:', error);
            alert('Erro ao rejeitar post. Tente novamente.');
            btn.disabled = false;
            btn.innerHTML = originalHTML;
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML.replace(/\n/g, '<br>');
    }

    formatTime(dateString) {
        const date = new Date(dateString);
        return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }

    close() {
        const modal = document.getElementById('rejection-chat-modal');
        if (!modal) return;

        // Parar gravação se estiver ativa
        if (this.isRecording) {
            this.cancelRecording();
        }

        modal.classList.remove('active');
        
        setTimeout(() => {
            modal.remove();
            document.body.style.overflow = '';
        }, 300);
    }
}
