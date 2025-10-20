// Auth Handler - Gerencia login com CPF/CNPJ

export class AuthHandler {
    constructor(panel) {
        this.panel = panel;
        this.container = panel.container;
    }

    render() {
        this.container.innerHTML = `
            <div class="auth-screen">
                <div class="auth-header">
                    <img id="logo" src="./assets/images/logo.webp" alt="Logo">
                    <h1>Portal do Cliente</h1>
                    <p>Insira seu CPF ou CNPJ para continuar</p>
                </div>

                <form class="auth-form" id="auth-form">
                    <div class="form-group">
                        <label for="cpf-cnpj">
                            <i class="ph ph-identification-card"></i>
                            CPF ou CNPJ
                        </label>
                        <input 
                            type="text" 
                            id="cpf-cnpj" 
                            placeholder="Digite apenas números"
                            maxlength="14"
                            inputmode="numeric"
                            autocomplete="off"
                            required>
                        <small class="input-hint">Apenas números, sem pontos ou traços</small>
                    </div>

                    <button type="submit" class="btn-primary" id="btn-login">
                        <i class="ph ph-sign-in"></i>
                        Entrar
                    </button>

                    <div id="auth-error" class="auth-error" style="display: none;"></div>
                </form>
            </div>
        `;

        this.attachEvents();
    }

    attachEvents() {
        const form = document.getElementById('auth-form');
        const input = document.getElementById('cpf-cnpj');

        // Permitir apenas números no input
        input.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/\D/g, '');
        });

        // Submit do formulário
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleLogin();
        });
    }

    async handleLogin() {
        const input = document.getElementById('cpf-cnpj');
        const btnLogin = document.getElementById('btn-login');
        const errorDiv = document.getElementById('auth-error');
        
        const cpfCnpj = input.value.trim();

        // Validação básica
        if (!cpfCnpj) {
            this.showError('Por favor, insira um CPF ou CNPJ');
            return;
        }

        if (cpfCnpj.length < 11) {
            this.showError('CPF ou CNPJ inválido');
            return;
        }

        // Mostrar loading
        const originalHTML = btnLogin.innerHTML;
        btnLogin.disabled = true;
        btnLogin.innerHTML = '<div class="btn-spinner"></div> Verificando...';
        errorDiv.style.display = 'none';

        try {
            console.log('[AuthHandler] Validando CPF/CNPJ:', cpfCnpj);

            // Buscar clientes com esse CPF/CNPJ
            const clients = await this.validateCpfCnpj(cpfCnpj);

            if (!clients || clients.length === 0) {
                this.showError('CPF ou CNPJ não encontrado no sistema');
                btnLogin.disabled = false;
                btnLogin.innerHTML = originalHTML;
                return;
            }

            console.log('[AuthHandler] Cliente(s) encontrado(s):', clients.length);

            // Sucesso - notificar o painel
            await this.panel.onLoginSuccess(cpfCnpj, clients);

        } catch (error) {
            console.error('[AuthHandler] Erro ao validar:', error);
            this.showError('Erro ao validar. Tente novamente.');
            btnLogin.disabled = false;
            btnLogin.innerHTML = originalHTML;
        }
    }

    async validateCpfCnpj(cpfCnpj) {
        try {
            const { data, error } = await window.supabaseClient
                .from('client')
                .select('*')
                .eq('CPF_CNPJ', cpfCnpj);

            if (error) {
                console.error('[AuthHandler] Erro no Supabase:', error);
                throw error;
            }

            return data;
        } catch (error) {
            console.error('[AuthHandler] Erro na validação:', error);
            throw error;
        }
    }

    showError(message) {
        const errorDiv = document.getElementById('auth-error');
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
            
            // Animar entrada
            errorDiv.style.animation = 'none';
            setTimeout(() => {
                errorDiv.style.animation = 'slideDown 0.3s ease';
            }, 10);
        }
    }
}