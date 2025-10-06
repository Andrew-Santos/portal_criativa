// Entry point - Painel de Aprovação
import { AuthHandler } from './modules/approval/auth.handler.js';
import { ApprovalActions } from './modules/approval/approval.actions.js';

// Configurações Supabase
const SUPABASE_URL = 'https://owpboqevrtthsupugcrt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93cGJvcWV2cnR0aHN1cHVnY3J0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5MjY4MDQsImV4cCI6MjA2OTUwMjgwNH0.7RjkVOUT6ByewP0D6FgHQjZDCoi4GYnGT6BMj794MfQ';

// Configurações de cache
const CACHE_KEY = 'portal_approval_auth';
const CACHE_DAYS = 7;

class ApprovalPanel {
    constructor() {
        this.container = document.getElementById('app-container');
        this.loading = document.getElementById('initial-loading');
        this.authHandler = null;
        this.approvalActions = null;
        this.cachedAuth = null;
    }

    async init() {
        console.log('[ApprovalPanel] Inicializando...');

        // Aguardar carregamento do Supabase
        await this.waitForSupabase();

        // Inicializar cliente Supabase globalmente
        if (!window.supabaseClient) {
            const { createClient } = window.supabase;
            window.supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            console.log('[ApprovalPanel] Cliente Supabase inicializado');
        }

        // Verificar cache
        this.cachedAuth = this.checkCache();

        if (this.cachedAuth) {
            console.log('[ApprovalPanel] Usuário autenticado no cache:', this.cachedAuth.cpfCnpj);
            await this.loadPanel(this.cachedAuth);
        } else {
            console.log('[ApprovalPanel] Nenhum cache encontrado, mostrando login');
            this.showLogin();
        }

        // Remover loading inicial
        this.hideInitialLoading();
    }

    async waitForSupabase() {
        // Aguardar até que a biblioteca Supabase esteja disponível
        let attempts = 0;
        while (typeof window.supabase === 'undefined' && attempts < 50) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }

        if (typeof window.supabase === 'undefined') {
            throw new Error('Biblioteca Supabase não carregada');
        }

        console.log('[ApprovalPanel] Biblioteca Supabase carregada');
    }

    checkCache() {
        try {
            const cached = localStorage.getItem(CACHE_KEY);
            if (!cached) return null;

            const data = JSON.parse(cached);
            const now = new Date().getTime();
            const expiresAt = new Date(data.expiresAt).getTime();

            // Verificar se expirou
            if (now > expiresAt) {
                console.log('[ApprovalPanel] Cache expirado');
                localStorage.removeItem(CACHE_KEY);
                return null;
            }

            return data;
        } catch (error) {
            console.error('[ApprovalPanel] Erro ao verificar cache:', error);
            localStorage.removeItem(CACHE_KEY);
            return null;
        }
    }

    saveCache(cpfCnpj, clients) {
        try {
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + CACHE_DAYS);

            const data = {
                cpfCnpj,
                clients,
                expiresAt: expiresAt.toISOString()
            };

            localStorage.setItem(CACHE_KEY, JSON.stringify(data));
            console.log('[ApprovalPanel] Cache salvo até:', expiresAt.toLocaleString('pt-BR'));
        } catch (error) {
            console.error('[ApprovalPanel] Erro ao salvar cache:', error);
        }
    }

    clearCache() {
        localStorage.removeItem(CACHE_KEY);
        console.log('[ApprovalPanel] Cache limpo');
    }

    showLogin() {
        this.authHandler = new AuthHandler(this);
        this.authHandler.render();
    }

    async loadPanel(authData) {
        console.log('[ApprovalPanel] Carregando painel para', authData.clients.length, 'cliente(s)');
        
        this.approvalActions = new ApprovalActions(this, authData);
        await this.approvalActions.init();
    }

    async onLoginSuccess(cpfCnpj, clients) {
        console.log('[ApprovalPanel] Login bem-sucedido:', cpfCnpj);
        
        // Salvar no cache
        this.saveCache(cpfCnpj, clients);
        
        // Carregar painel
        const authData = { cpfCnpj, clients };
        await this.loadPanel(authData);
    }

    logout() {
        console.log('[ApprovalPanel] Fazendo logout...');
        this.clearCache();
        window.location.reload();
    }

    hideInitialLoading() {
        if (this.loading) {
            this.loading.style.opacity = '0';
            setTimeout(() => {
                this.loading.style.display = 'none';
            }, 300);
        }
    }

    showError(message) {
        this.hideInitialLoading();
        this.container.innerHTML = `
            <div class="error-screen">
                <i class="ph ph-warning-circle"></i>
                <h2>Erro</h2>
                <p>${message}</p>
                <button onclick="window.location.reload()" class="btn-primary">
                    Recarregar Página
                </button>
            </div>
        `;
    }
}

// Inicializar quando DOM estiver pronto
document.addEventListener('DOMContentLoaded', async () => {
    const panel = new ApprovalPanel();
    await panel.init();
});