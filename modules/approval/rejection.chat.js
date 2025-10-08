export class RejectionChat {
    constructor(postId, postData) {
        this.postId = postId;
        this.postData = postData;
        this.isRecording = false;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.recordingStartTime = null;
        this.messages = [];
        this.audioContext = null;
        this.analyser = null;
        this.dataArray = null;
        this.animationId = null;
    }

    open() {
        console.log('[RejectionChat] Abrindo chat para post:', this.postId);
        this.render();
        this.attachEvents();
        document.body.style.overflow = 'hidden';
    }

    render() {
        const modal = document.createElement('div');
        modal.id = 'rejection-chat-modal';
        modal.className = 'rejection-chat-modal';
        modal.innerHTML = `
            <div class="chat-overlay"></div>
            <div class="chat-container">
                <div class="chat-header">
                    <div class="chat-header-content">
                        <button class="chat-back-btn">
                            <i class="ph-bold ph-arrow-left"></i>
                        </button>
                        <div class="chat-header-info">
                            <h3>Motivo da Recusa</h3>
                            <p>Explique o motivo da rejeição</p>
                        </div>
                    </div>
                </div>

                <div class="chat-messages" id="chat-messages">
                    <div class="chat-date-divider">
                        <span>Hoje</span>
                    </div>
                </div>

                <div class="chat-input-area">
                    <div class="chat-input-wrapper" id="chat-input-wrapper">
                        <textarea 
                            class="chat-textarea" 
                            id="chat-textarea" 
                            placeholder="Digite sua mensagem..."
                            rows="1"
                            maxlength="500"></textarea>
                        
                        <button class="chat-mic-btn" id="chat-mic-btn" title="Gravar áudio">
                            <i class="ph-fill ph-microphone"></i>
                        </button>
                    </div>

                    <button class="chat-send-btn" id="chat-send-btn" disabled>
                        <i class="ph-fill ph-paper-plane-tilt"></i>
                    </button>

                    <div class="chat-recording-ui" id="chat-recording-ui" style="display: none;">
                        <div class="recording-content">
                            <button class="recording-cancel-btn" id="recording-cancel-btn">
                                <i class="ph-bold ph-x"></i>
                            </button>
                            <div class="audio-visualizer-container" id="audio-visualizer">
                                ${Array.from({ length: 20 }, () => '<div class="audio-bar"></div>').join('')}
                            </div>
                            <span class="recording-time" id="recording-time">0:00</span>
                            <button class="recording-send-btn" id="recording-send-btn">
                                <i class="ph-fill ph-check"></i>
                            </button>
                        </div>
                    </div>
                </div>

                <div class="chat-footer">
                    <button class="chat-reject-btn" id="final-reject-btn">
                        <i class="ph ph-x-circle"></i>
                        Confirmar Recusa
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        setTimeout(() => {
            modal.classList.add('active');
        }, 10);

        this.loadMessages();
    }

    attachEvents() {
        const modal = document.getElementById('rejection-chat-modal');
        
        modal.querySelector('.chat-back-btn').addEventListener('click', () => this.close());
        modal.querySelector('.chat-overlay').addEventListener('click', () => this.close());

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

        sendBtn.addEventListener('click', () => {
            if (textarea.value.trim()) {
                this.addTextMessage(textarea.value.trim());
            }
        });

        document.getElementById('chat-mic-btn').addEventListener('click', () => this.toggleRecording());
        document.getElementById('recording-cancel-btn').addEventListener('click', () => this.cancelRecording());
        document.getElementById('recording-send-btn').addEventListener('click', () => this.stopAndPreviewAudio());
        document.getElementById('final-reject-btn').addEventListener('click', () => this.confirmRejection());
    }

    autoResizeTextarea(textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 100) + 'px';
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
            }
        } catch (error) {
            console.error('[RejectionChat] Erro ao carregar mensagens:', error);
        }
    }

    addTextMessage(text) {
        const textarea = document.getElementById('chat-textarea');
        const sendBtn = document.getElementById('chat-send-btn');
        
        const messageObj = {
            id: Date.now(),
            message_type: 'text',
            message_or_url: text,
            created_by: 'client',
            created_at: new Date().toISOString(),
            temp: true
        };

        this.messages.push(messageObj);
        this.appendMessage(messageObj, true);

        textarea.value = '';
        this.autoResizeTextarea(textarea);
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
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: { 
                    echoCancellation: true, 
                    noiseSuppression: true,
                    autoGainControl: false
                }
            });
            
            // Configurar MediaRecorder
            const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
                ? 'audio/webm;codecs=opus'
                : MediaRecorder.isTypeSupported('audio/webm')
                ? 'audio/webm'
                : 'audio/mp4';

            this.mediaRecorder = new MediaRecorder(stream, { 
                mimeType,
                audioBitsPerSecond: 128000
            });
            
            this.audioChunks = [];
            this.recordingStartTime = Date.now();

            // Coletar dados durante a gravação
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    console.log('[RejectionChat] Chunk recebido:', event.data.size, 'bytes');
                    this.audioChunks.push(event.data);
                }
            };

            this.mediaRecorder.onstop = () => {
                console.log('[RejectionChat] Gravação finalizada. Total chunks:', this.audioChunks.length);
                stream.getTracks().forEach(track => track.stop());
            };

            this.mediaRecorder.onerror = (event) => {
                console.error('[RejectionChat] Erro no MediaRecorder:', event.error);
                alert('Erro ao gravar áudio: ' + event.error);
                this.cancelRecording();
            };

            // Iniciar gravação coletando dados a cada 100ms
            this.mediaRecorder.start(100);
            this.isRecording = true;

            // Configurar visualizador de áudio
            this.setupAudioVisualizer(stream);

            // Mostrar UI de gravação
            document.getElementById('chat-input-wrapper').style.display = 'none';
            document.getElementById('chat-send-btn').style.display = 'none';
            document.getElementById('chat-recording-ui').style.display = 'flex';

            this.startRecordingTimer();
            console.log('[RejectionChat] Gravação iniciada - MIME:', mimeType);
            
        } catch (error) {
            console.error('[RejectionChat] Erro ao iniciar gravação:', error);
            alert('Não foi possível acessar o microfone. Verifique as permissões.');
        }
    }

    setupAudioVisualizer(stream) {
        // Criar contexto de áudio
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const source = this.audioContext.createMediaStreamSource(stream);
        
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 64;
        this.analyser.smoothingTimeConstant = 0.8;
        
        source.connect(this.analyser);
        
        const bufferLength = this.analyser.frequencyBinCount;
        this.dataArray = new Uint8Array(bufferLength);
        
        this.visualizeAudio();
    }

    visualizeAudio() {
        if (!this.isRecording) return;

        this.animationId = requestAnimationFrame(() => this.visualizeAudio());
        
        this.analyser.getByteFrequencyData(this.dataArray);
        
        const bars = document.querySelectorAll('#audio-visualizer .audio-bar');
        const step = Math.floor(this.dataArray.length / bars.length);
        
        bars.forEach((bar, index) => {
            const value = this.dataArray[index * step] || 0;
            const heightPercent = (value / 255) * 100;
            const height = Math.max(8, (heightPercent / 100) * 40);
            bar.style.height = `${height}px`;
        });
    }

    stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.isRecording = false;
            
            // Parar animação
            if (this.animationId) {
                cancelAnimationFrame(this.animationId);
            }
            
            // Fechar contexto de áudio
            if (this.audioContext) {
                this.audioContext.close();
                this.audioContext = null;
            }
            
            // Parar timer
            this.stopRecordingTimer();
            
            // Parar MediaRecorder
            if (this.mediaRecorder.state !== 'inactive') {
                this.mediaRecorder.stop();
            }
            
            console.log('[RejectionChat] Gravação parada');
        }
    }

    stopAndPreviewAudio() {
        this.stopRecording();

        // Aguardar um pouco para garantir que todos os chunks foram coletados
        setTimeout(() => {
            if (this.audioChunks.length === 0) {
                console.error('[RejectionChat] Nenhum chunk de áudio!');
                alert('Nenhum áudio foi gravado. Tente novamente.');
                this.cancelRecording();
                return;
            }

            // Determinar o melhor tipo MIME
            const mimeType = this.mediaRecorder?.mimeType || 'audio/webm;codecs=opus';
            
            const audioBlob = new Blob(this.audioChunks, { type: mimeType });
            
            console.log('[RejectionChat] Blob criado:', audioBlob.size, 'bytes', 'tipo:', audioBlob.type);

            if (audioBlob.size === 0) {
                console.error('[RejectionChat] ERRO: Blob vazio!');
                alert('Áudio gravado mas está vazio. Tente novamente.');
                this.cancelRecording();
                return;
            }

            // Criar URL do blob
            const audioUrl = URL.createObjectURL(audioBlob);

            const messageObj = {
                id: Date.now(),
                message_type: 'audio',
                message_or_url: audioUrl,
                created_by: 'client',
                created_at: new Date().toISOString(),
                temp: true,
                audioBlob: audioBlob,
                mimeType: mimeType
            };

            this.messages.push(messageObj);
            this.appendMessage(messageObj, true);

            this.audioChunks = [];

            document.getElementById('chat-input-wrapper').style.display = 'flex';
            document.getElementById('chat-send-btn').style.display = 'flex';
            document.getElementById('chat-recording-ui').style.display = 'none';
        }, 300);
    }

    cancelRecording() {
        this.stopRecording();
        this.audioChunks = [];
        
        document.getElementById('chat-input-wrapper').style.display = 'flex';
        document.getElementById('chat-send-btn').style.display = 'flex';
        document.getElementById('chat-recording-ui').style.display = 'none';
        
        console.log('[RejectionChat] Gravação cancelada');
    }

    startRecordingTimer() {
        const timerEl = document.getElementById('recording-time');
        
        this.recordingInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - this.recordingStartTime) / 1000);
            const minutes = Math.floor(elapsed / 60);
            const seconds = elapsed % 60;
            timerEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }, 100);
    }

    stopRecordingTimer() {
        if (this.recordingInterval) {
            clearInterval(this.recordingInterval);
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
        } else if (message.message_type === 'audio') {
            const audioId = `audio-${message.id || Date.now()}`;
            const mimeType = message.mimeType || 'audio/webm';
            messageEl.innerHTML = `
                <div class="message-bubble audio-bubble">
                    <audio id="${audioId}" preload="metadata">
                        <source src="${message.message_or_url}" type="${mimeType}">
                    </audio>
                    <div class="audio-player">
                        <button class="audio-play-btn" data-audio-id="${audioId}">
                            <i class="ph-fill ph-play"></i>
                        </button>
                        <div class="audio-progress-container">
                            <div class="audio-progress-bar" data-audio-id="${audioId}">
                                <div class="audio-progress-fill"></div>
                            </div>
                            <div class="audio-times">
                                <span class="audio-current-time">0:00</span>
                                <span class="audio-duration">--:--</span>
                            </div>
                        </div>
                    </div>
                    <span class="message-time">${this.formatTime(message.created_at)}</span>
                </div>
            `;
            
            // Configurar player após adicionar ao DOM
            setTimeout(() => this.setupAudioPlayer(audioId), 100);
        }

        messagesContainer.appendChild(messageEl);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    setupAudioPlayer(audioId) {
        const audio = document.getElementById(audioId);
        if (!audio) return;

        const playerContainer = document.querySelector(`[data-audio-id="${audioId}"].audio-player`);
        const playBtn = document.querySelector(`[data-audio-id="${audioId}"].audio-play-btn`);
        const waveformContainer = document.querySelector(`[data-audio-id="${audioId}"].audio-waveform-container`);
        const progressOverlay = waveformContainer?.querySelector('.audio-progress-overlay');
        const waveformBars = waveformContainer?.querySelectorAll('.audio-waveform-bar');
        const currentTimeEl = playerContainer?.querySelector('.audio-current-time');
        const durationEl = playerContainer?.querySelector('.audio-duration');
        const playIcon = playBtn?.querySelector('.ph-play');
        const loadingSpinner = playBtn?.querySelector('.audio-loading-spinner');

        let isLoaded = false;
        let audioContext = null;
        let analyser = null;
        let source = null;
        let animationId = null;
        let waveformData = [];

        // Função para gerar waveform aleatório (simulado)
        const generateWaveform = () => {
            waveformData = Array.from({ length: waveformBars.length }, () => 
                Math.random() * 0.6 + 0.2 // Valores entre 0.2 e 0.8
            );
            waveformBars.forEach((bar, i) => {
                const height = waveformData[i] * 100;
                bar.style.height = `${height}%`;
            });
        };

        // Quando os metadados carregarem
        audio.addEventListener('loadedmetadata', () => {
            if (!isNaN(audio.duration) && isFinite(audio.duration)) {
                isLoaded = true;
                if (durationEl) durationEl.textContent = this.formatAudioTime(audio.duration);
                if (playBtn) {
                    playBtn.disabled = false;
                    if (loadingSpinner) loadingSpinner.style.display = 'none';
                    if (playIcon) playIcon.style.display = 'block';
                }
                if (playerContainer) playerContainer.classList.remove('loading');
                generateWaveform();
            }
        });

        // Quando o áudio estiver pronto para tocar
        audio.addEventListener('canplay', () => {
            if (!isLoaded && !isNaN(audio.duration) && isFinite(audio.duration)) {
                isLoaded = true;
                if (durationEl) durationEl.textContent = this.formatAudioTime(audio.duration);
                if (playBtn) {
                    playBtn.disabled = false;
                    if (loadingSpinner) loadingSpinner.style.display = 'none';
                    if (playIcon) playIcon.style.display = 'block';
                }
                if (playerContainer) playerContainer.classList.remove('loading');
                generateWaveform();
            }
        });

        // Fallback
        audio.addEventListener('durationchange', () => {
            if (!isLoaded && !isNaN(audio.duration) && isFinite(audio.duration)) {
                isLoaded = true;
                if (durationEl) durationEl.textContent = this.formatAudioTime(audio.duration);
                if (playBtn) {
                    playBtn.disabled = false;
                    if (loadingSpinner) loadingSpinner.style.display = 'none';
                    if (playIcon) playIcon.style.display = 'block';
                }
                if (playerContainer) playerContainer.classList.remove('loading');
                generateWaveform();
            }
        });

        // Tratamento de erro
        audio.addEventListener('error', (e) => {
            console.error('[AudioPlayer] Erro ao carregar áudio:', e);
            if (playBtn) {
                playBtn.disabled = true;
                playBtn.style.opacity = '0.5';
            }
            if (durationEl) durationEl.textContent = 'Erro';
            if (loadingSpinner) loadingSpinner.style.display = 'none';
        });

        // Configurar Web Audio API para análise de frequência
        const setupAudioContext = () => {
            try {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
                source = audioContext.createMediaElementSource(audio);
                analyser = audioContext.createAnalyser();
                analyser.fftSize = 128;
                analyser.smoothingTimeConstant = 0.8;
                
                source.connect(analyser);
                analyser.connect(audioContext.destination);
            } catch (error) {
                console.error('[AudioPlayer] Erro ao configurar AudioContext:', error);
            }
        };

        // Animar waveform durante reprodução
        const animateWaveform = () => {
            if (!audio.paused && analyser) {
                const dataArray = new Uint8Array(analyser.frequencyBinCount);
                analyser.getByteFrequencyData(dataArray);
                
                const step = Math.floor(dataArray.length / waveformBars.length);
                waveformBars.forEach((bar, index) => {
                    const value = dataArray[index * step] || 0;
                    const normalizedValue = value / 255;
                    const baseHeight = waveformData[index] || 0.3;
                    const animatedHeight = Math.max(baseHeight, normalizedValue) * 100;
                    bar.style.height = `${animatedHeight}%`;
                });
                
                animationId = requestAnimationFrame(animateWaveform);
            } else {
                // Resetar para waveform estático
                waveformBars.forEach((bar, i) => {
                    const height = waveformData[i] * 100;
                    bar.style.height = `${height}%`;
                });
            }
        };

        // Atualizar progresso durante reprodução
        audio.addEventListener('timeupdate', () => {
            if (!currentTimeEl || !isFinite(audio.duration)) return;
            
            const progress = (audio.currentTime / audio.duration) * 100;
            if (progressOverlay) progressOverlay.style.width = `${progress}%`;
            currentTimeEl.textContent = this.formatAudioTime(audio.currentTime);
            
            // Atualizar estado das barras
            const progressIndex = Math.floor((audio.currentTime / audio.duration) * waveformBars.length);
            waveformBars.forEach((bar, index) => {
                if (index <= progressIndex) {
                    bar.classList.add('active');
                } else {
                    bar.classList.remove('active');
                }
            });
        });

        // Quando terminar de tocar
        audio.addEventListener('ended', () => {
            if (playBtn) {
                const icon = playBtn.querySelector('i');
                if (icon) {
                    icon.className = 'ph-fill ph-play';
                }
            }
            if (progressOverlay) progressOverlay.style.width = '0%';
            if (currentTimeEl) currentTimeEl.textContent = '0:00';
            
            waveformBars.forEach(bar => bar.classList.remove('active'));
            
            if (animationId) {
                cancelAnimationFrame(animationId);
                animationId = null;
            }
        });

        // Botão play/pause
        if (playBtn) {
            playBtn.addEventListener('click', async () => {
                if (!isLoaded) return;
                
                try {
                    if (audio.paused) {
                        // Pausar outros áudios
                        document.querySelectorAll('audio').forEach(a => {
                            if (a !== audio && !a.paused) {
                                a.pause();
                                const otherBtn = document.querySelector(`[data-audio-id="${a.id}"].audio-play-btn`);
                                if (otherBtn) {
                                    const otherIcon = otherBtn.querySelector('i');
                                    if (otherIcon) otherIcon.className = 'ph-fill ph-play';
                                }
                            }
                        });
                        
                        // Configurar AudioContext na primeira reprodução
                        if (!audioContext) {
                            setupAudioContext();
                        }
                        
                        await audio.play();
                        const icon = playBtn.querySelector('i');
                        if (icon) icon.className = 'ph-fill ph-pause';
                        animateWaveform();
                    } else {
                        audio.pause();
                        const icon = playBtn.querySelector('i');
                        if (icon) icon.className = 'ph-fill ph-play';
                        if (animationId) {
                            cancelAnimationFrame(animationId);
                            animationId = null;
                        }
                    }
                } catch (error) {
                    console.error('[AudioPlayer] Erro ao reproduzir:', error);
                }
            });
        }

        // Clicar na barra de progresso para buscar
        if (waveformContainer) {
            waveformContainer.addEventListener('click', (e) => {
                if (!isFinite(audio.duration)) return;
                
                const rect = waveformContainer.getBoundingClientRect();
                const percent = (e.clientX - rect.left) / rect.width;
                audio.currentTime = percent * audio.duration;
            });
        }

        // Forçar carregamento do áudio
        audio.load();
    }    appendMessage(message, animate = false) {
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
        } else if (message.message_type === 'audio') {
            const audioId = `audio-${message.id || Date.now()}`;
            const mimeType = message.mimeType || 'audio/webm';
            messageEl.innerHTML = `
                <div class="message-bubble audio-bubble">
                    <audio id="${audioId}" preload="metadata">
                        <source src="${message.message_or_url}" type="${mimeType}">
                    </audio>
                    <div class="audio-player loading" data-audio-id="${audioId}">
                        <button class="audio-play-btn" data-audio-id="${audioId}" disabled>
                            <div class="audio-loading-spinner"></div>
                            <i class="ph-fill ph-play" style="display: none;"></i>
                        </button>
                        <div class="audio-progress-container">
                            <div class="audio-waveform-container" data-audio-id="${audioId}">
                                ${Array.from({ length: 40 }, () => '<div class="audio-waveform-bar"></div>').join('')}
                                <div class="audio-progress-overlay"></div>
                            </div>
                            <div class="audio-times">
                                <span class="audio-current-time">0:00</span>
                                <span class="audio-duration">Carregando...</span>
                            </div>
                        </div>
                    </div>
                    <span class="message-time">${this.formatTime(message.created_at)}</span>
                </div>
            `;
            
            setTimeout(() => this.setupAudioPlayer(audioId), 100);
        }

        messagesContainer.appendChild(messageEl);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    formatAudioTime(seconds) {
        if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
        
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    async confirmRejection() {
        const btn = document.getElementById('final-reject-btn');
        
        if (this.messages.length === 0) {
            alert('Adicione pelo menos uma mensagem antes de confirmar.');
            return;
        }

        if (!confirm('Confirmar recusa do post?')) {
            return;
        }

        btn.disabled = true;
        const originalHTML = btn.innerHTML;
        btn.innerHTML = '<div class="btn-spinner"></div> Processando...';

        try {
            for (const message of this.messages) {
                if (message.temp && message.message_type === 'text') {
                    const { error } = await window.supabaseClient
                        .from('rejection_chat')
                        .insert({
                            id_post: this.postId,
                            message_type: 'text',
                            message_or_url: message.message_or_url,
                            created_by: 'client'
                        });

                    if (error) throw error;
                    console.log('[RejectionChat] Texto salvo');
                } 
                else if (message.temp && message.message_type === 'audio' && message.audioBlob) {
                    console.log('[RejectionChat] Iniciando upload de áudio. Tamanho:', message.audioBlob.size);

                    const fileName = `${this.postId}_${Date.now()}.webm`;
                    
                    const { data: uploadData, error: uploadError } = await window.supabaseClient
                        .storage
                        .from('rejection-audios')
                        .upload(fileName, message.audioBlob, {
                            contentType: message.audioBlob.type,
                            upsert: false
                        });

                    if (uploadError) {
                        console.error('[RejectionChat] Erro upload:', uploadError);
                        throw uploadError;
                    }

                    console.log('[RejectionChat] Áudio salvo:', fileName);

                    const { data: urlData } = window.supabaseClient
                        .storage
                        .from('rejection-audios')
                        .getPublicUrl(fileName);

                    const { error: insertError } = await window.supabaseClient
                        .from('rejection_chat')
                        .insert({
                            id_post: this.postId,
                            message_type: 'audio',
                            message_or_url: urlData.publicUrl,
                            created_by: 'client'
                        });

                    if (insertError) throw insertError;
                    console.log('[RejectionChat] URL do áudio salva no BD');
                }
            }

            const now = new Date().toISOString();
            const { error: updateError } = await window.supabaseClient
                .from('post')
                .update({
                    status: 'REPROVADO',
                    reject_date: now
                })
                .eq('id', this.postId);
            
            if (updateError) throw updateError;
            
            console.log('[RejectionChat] Post marcado como reprovado');
            this.close();
            
            const event = new CustomEvent('post-rejected', { detail: { postId: this.postId } });
            document.dispatchEvent(event);
            
        } catch (error) {
            console.error('[RejectionChat] Erro:', error);
            alert('Erro ao processar rejeição: ' + error.message);
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
