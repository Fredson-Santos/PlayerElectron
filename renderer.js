// renderer.js - Lógica do Frontend (Processo de Renderização)

document.addEventListener('DOMContentLoaded', () => {
    // Referências aos elementos da UI
    const loginScreen = document.getElementById('login-screen');
    const mainScreen = document.getElementById('main-screen');
    const playerScreen = document.getElementById('player-screen');
    const loadingSpinner = document.getElementById('loading-spinner');
    const loginForm = document.getElementById('login-form');
    const hostInput = document.getElementById('host');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const rememberMeCheckbox = document.getElementById('remember-me');
    const loginError = document.getElementById('login-error');
    const logoutBtn = document.getElementById('logout-btn');
    const categoryList = document.getElementById('category-list');
    const contentGrid = document.getElementById('content-grid');
    const searchBox = document.getElementById('search-box');
    const navBtns = document.querySelectorAll('.nav-btn');
    const videoPlayer = document.getElementById('video-player');
    const backToMainBtn = document.getElementById('back-to-main');
    const playerFeedback = document.getElementById('player-feedback');

    // Estado da aplicação
    let state = {
        api: null,
        userInfo: null,
        liveStreams: [],
        movies: [],
        series: [],
        favorites: JSON.parse(localStorage.getItem('iptv_favorites')) || {},
        currentSection: 'live',
        allContent: [],
        currentStream: null,
        hls: null,
    };

    // --- LÓGICA DE LOGIN E SESSÃO ---

    /**
     * Tenta fazer login automático se as credenciais estiverem salvas
     */
    const autoLogin = () => {
        const savedCreds = localStorage.getItem('iptv_credentials');
        if (savedCreds) {
            const { host, username, password } = JSON.parse(savedCreds);
            hostInput.value = host;
            usernameInput.value = username;
            passwordInput.value = password;
            rememberMeCheckbox.checked = true;
            handleLogin();
        }
    };

    /**
     * Lida com o processo de login
     * @param {Event} e - O evento de submit do formulário
     */
    const handleLogin = async (e) => {
        if (e) e.preventDefault();
        showLoading(true);
        loginError.textContent = '';
        
        const host = hostInput.value.trim();
        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();

        if (!host || !username || !password) {
            loginError.textContent = 'Todos os campos são obrigatórios.';
            showLoading(false);
            return;
        }

        state.api = axios.create({ baseURL: host });
        
        try {
            // Autenticação
            const response = await state.api.get('/player_api.php', {
                params: { username, password }
            });

            if (response.data.user_info.auth === 0) {
                throw new Error('Usuário ou senha inválidos.');
            }
            state.userInfo = response.data.user_info;

            // Salvar credenciais se "Lembrar-me" estiver marcado
            if (rememberMeCheckbox.checked) {
                localStorage.setItem('iptv_credentials', JSON.stringify({ host, username, password }));
            } else {
                localStorage.removeItem('iptv_credentials');
            }
            
            await fetchAllContent();
            
            // Transição para a tela principal
            loginScreen.classList.add('hidden');
            mainScreen.classList.remove('hidden');
            
            // Inicia na seção 'Ao Vivo'
            renderContent();

        } catch (error) {
            console.error('Erro no login:', error);
            loginError.textContent = 'Falha no login. Verifique o host e as credenciais.';
        } finally {
            showLoading(false);
        }
    };

    /**
     * Lida com o logout do usuário
     */
    const handleLogout = () => {
        // Limpa o estado da aplicação
        state = { ...state, api: null, userInfo: null, liveStreams: [], movies: [], series: [], currentSection: 'live' };
        
        // Não apaga os favoritos, mas limpa as credenciais se não estiverem salvas
        if (!rememberMeCheckbox.checked) {
            localStorage.removeItem('iptv_credentials');
            hostInput.value = '';
            usernameInput.value = '';
            passwordInput.value = '';
            rememberMeCheckbox.checked = false;
        }

        // Retorna para a tela de login
        mainScreen.classList.add('hidden');
        loginScreen.classList.remove('hidden');
        playerScreen.classList.add('hidden');
        stopPlayer();
    };


    // --- BUSCA E RENDERIZAÇÃO DE CONTEÚDO ---

    /**
     * Busca todo o conteúdo da API (canais, filmes, séries)
     */
    const fetchAllContent = async () => {
        showLoading(true);
        const { username, password } = JSON.parse(localStorage.getItem('iptv_credentials')) || {
             username: usernameInput.value, password: passwordInput.value
        };

        try {
            // Busca Canais Ao Vivo
            const liveRes = await state.api.get('/player_api.php', { params: { username, password, action: 'get_live_streams' } });
            state.liveStreams = liveRes.data || [];

            // Busca Filmes
            const movieRes = await state.api.get('/player_api.php', { params: { username, password, action: 'get_vod_streams' } });
            state.movies = movieRes.data || [];
            
            // Busca Séries
            const seriesRes = await state.api.get('/player_api.php', { params: { username, password, action: 'get_series' } });
            state.series = seriesRes.data || [];

        } catch (error) {
            console.error('Erro ao buscar conteúdo:', error);
            loginError.textContent = 'Falha ao carregar conteúdo do servidor.';
            handleLogout(); // Desloga se não conseguir carregar
        } finally {
            showLoading(false);
        }
    };

    /**
     * Renderiza categorias e conteúdo com base na seção atual e no filtro de busca
     * @param {string} filter - Termo de busca opcional
     */
    const renderContent = (filter = '') => {
        let items = [];
        let categories = new Set();
        filter = filter.toLowerCase();

        switch (state.currentSection) {
            case 'live':
                items = state.liveStreams;
                items.forEach(item => categories.add(item.category_name || 'Geral'));
                break;
            case 'movie':
                items = state.movies;
                items.forEach(item => categories.add(item.category_name || 'Geral'));
                break;
            case 'series':
                items = state.series;
                items.forEach(item => categories.add(item.category_name || 'Geral'));
                break;
        }
        
        // Armazena todos os itens da seção atual para a busca
        state.allContent = items;
        
        let filteredItems = items;
        if (filter) {
            filteredItems = items.filter(item => item.name.toLowerCase().includes(filter));
            // Na busca, não filtramos por categoria, então mostramos todas
        }
        
        renderCategories(Array.from(categories).sort(), filter ? '' : 'all'); // Se houver filtro, nenhuma categoria fica ativa
        renderItems(filteredItems);
    };

    /**
     * Renderiza a lista de categorias na barra lateral
     * @param {string[]} categories - Array de nomes de categorias
     * @param {string} activeCategory - A categoria atualmente ativa
     */
    const renderCategories = (categories, activeCategory = 'all') => {
        categoryList.innerHTML = '';
        
        // Adiciona a categoria "Todos"
        const allLi = createCategoryElement('Todos', 'all', activeCategory === 'all');
        categoryList.appendChild(allLi);

        // Adiciona a categoria "Favoritos"
        const favLi = createCategoryElement('⭐ Favoritos', 'favorites', activeCategory === 'favorites');
        categoryList.appendChild(favLi);

        // Adiciona outras categorias
        categories.forEach(cat => {
            const catLi = createCategoryElement(cat, cat, activeCategory === cat);
            categoryList.appendChild(catLi);
        });
    };
    
    /**
     * Cria um elemento de lista para uma categoria
     */
    function createCategoryElement(name, id, isActive) {
        const li = document.createElement('li');
        li.textContent = name;
        li.dataset.category = id;
        li.className = `p-2 rounded cursor-pointer mb-1 text-sm ${isActive ? 'bg-cyan-600' : 'hover:bg-gray-700'}`;
        li.addEventListener('click', () => handleCategoryClick(id));
        return li;
    }


    /**
     * Renderiza os itens (canais/filmes/séries) na grid principal
     * @param {object[]} items - Array de itens para renderizar
     */
    const renderItems = (items) => {
        contentGrid.innerHTML = '';
        if (!items || items.length === 0) {
            contentGrid.innerHTML = '<p class="col-span-full text-center text-gray-400">Nenhum item encontrado.</p>';
            return;
        }

        items.forEach(item => {
            const isFav = isFavorite(item);
            const card = document.createElement('div');
            card.className = 'content-card bg-gray-800 rounded-lg overflow-hidden cursor-pointer transform hover:scale-105 transition-transform duration-200';
            card.dataset.id = item.stream_id || item.series_id;
            card.dataset.type = state.currentSection;
            
            const iconUrl = item.stream_icon || item.cover || 'https://placehold.co/200x300/181818/FFF?text=?';

            card.innerHTML = `
                <img src="${iconUrl}" alt="${item.name}" class="w-full h-40 object-cover" onerror="this.onerror=null;this.src='https://placehold.co/200x300/181818/FFF?text=${encodeURIComponent(item.name[0])}';">
                <div class="p-2">
                    <h3 class="text-xs font-semibold truncate">${item.name}</h3>
                </div>
                ${isFav ? '<div class="fav-indicator absolute top-1 right-1 text-yellow-400 text-lg">⭐</div>' : ''}
            `;
            
            card.addEventListener('click', () => handleItemClick(item));
            contentGrid.appendChild(card);
        });
    };

    /**
     * Lida com o clique em uma categoria
     * @param {string} categoryName - O nome da categoria clicada
     */
    const handleCategoryClick = (categoryName) => {
        searchBox.value = ''; // Limpa a busca ao mudar de categoria
        document.querySelectorAll('#category-list li').forEach(li => {
            li.classList.toggle('bg-cyan-600', li.dataset.category === categoryName);
            if(li.dataset.category !== categoryName) li.classList.remove('bg-cyan-600');
        });
        
        let itemsToRender;
        if (categoryName === 'all') {
            itemsToRender = state.allContent;
        } else if (categoryName === 'favorites') {
            itemsToRender = state.allContent.filter(item => isFavorite(item));
        } else {
            itemsToRender = state.allContent.filter(item => item.category_name === categoryName);
        }
        renderItems(itemsToRender);
    };

    /**
     * Lida com a mudança de seção (Ao Vivo, Filmes, Séries)
     */
    const handleSectionChange = (e) => {
        const section = e.target.dataset.section;
        if (section) {
            state.currentSection = section;
            navBtns.forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            searchBox.value = ''; // Limpa busca
            renderContent();
        }
    };

    // --- LÓGICA DO PLAYER DE VÍDEO ---

    /**
     * Lida com o clique em um item para iniciar a reprodução
     * @param {object} item - O item a ser reproduzido
     */
    const handleItemClick = (item) => {
        // Para séries, precisaríamos de uma tela de episódios.
        // Por simplicidade, isso não está implementado.
        if (state.currentSection === 'series') {
            alert('A reprodução de séries requer uma tela de seleção de episódios (não implementada nesta versão simplificada).');
            return;
        }

        const { username, password } = JSON.parse(localStorage.getItem('iptv_credentials')) || {
             username: usernameInput.value, password: passwordInput.value
        };
        const streamId = item.stream_id;
        const extension = item.container_extension || 'mp4'; // Padrão para filmes, canais usam m3u8
        
        let streamUrl;
        if(state.currentSection === 'live') {
            streamUrl = `${hostInput.value.trim()}/live/${username}/${password}/${streamId}.m3u8`;
        } else { // Movie
            streamUrl = `${hostInput.value.trim()}/movie/${username}/${password}/${streamId}.${extension}`;
        }
        
        state.currentStream = item;
        playStream(streamUrl);
    };
    
    /**
     * Inicia a reprodução do stream no player de vídeo
     * @param {string} url - A URL do stream
     */
    const playStream = (url) => {
        stopPlayer(); // Garante que o player anterior seja limpo
        mainScreen.classList.add('hidden');
        playerScreen.classList.remove('hidden');
        showLoading(true);

        // Usa HLS.js para streams HLS (m3u8)
        if (url.includes('.m3u8')) {
            if (Hls.isSupported()) {
                state.hls = new Hls();
                state.hls.loadSource(url);
                state.hls.attachMedia(videoPlayer);
                state.hls.on(Hls.Events.MANIFEST_PARSED, () => {
                    videoPlayer.play();
                    showLoading(false);
                });
                 state.hls.on(Hls.Events.ERROR, (event, data) => {
                    if (data.fatal) {
                        console.error('Erro fatal no HLS:', data);
                        showLoading(false);
                        alert("Não foi possível carregar o stream.");
                        closePlayer();
                    }
                });
            } else if (videoPlayer.canPlayType('application/vnd.apple.mpegurl')) {
                // Suporte nativo em alguns navegadores (ex: Safari)
                videoPlayer.src = url;
                videoPlayer.addEventListener('loadedmetadata', () => {
                    videoPlayer.play();
                    showLoading(false);
                });
            }
        } else {
            // Para outros formatos (ex: mp4)
            videoPlayer.src = url;
            videoPlayer.play();
            showLoading(false);
        }

        videoPlayer.focus();
    };

    /**
     * Para a reprodução atual e limpa os recursos
     */
    const stopPlayer = () => {
        if (state.hls) {
            state.hls.destroy();
            state.hls = null;
        }
        videoPlayer.pause();
        videoPlayer.removeAttribute('src');
        videoPlayer.load();
        state.currentStream = null;
    };
    
    /**
     * Fecha o player e volta para a tela principal
     */
    const closePlayer = () => {
        stopPlayer();
        playerScreen.classList.add('hidden');
        mainScreen.classList.remove('hidden');
        renderContent(searchBox.value); // Re-renderiza para atualizar indicador de favorito
    };
    
    /**
     * Controla o player com o teclado
     */
    const handlePlayerKeys = (e) => {
        e.preventDefault();
        switch (e.key) {
            case ' ': // Barra de espaço
                if (videoPlayer.paused) {
                    videoPlayer.play();
                    showFeedback('▶');
                } else {
                    videoPlayer.pause();
                    showFeedback('❚❚');
                }
                break;
            case 'ArrowRight':
                videoPlayer.currentTime += 10;
                showFeedback('» +10s');
                break;
            case 'ArrowLeft':
                videoPlayer.currentTime -= 10;
                showFeedback('« -10s');
                break;
            case 't':
            case 'T':
                 // Usa a API exposta pelo preload.js para alternar tela cheia
                window.electronAPI.toggleFullscreen();
                break;
            case 'f':
            case 'F':
                toggleFavorite(state.currentStream);
                const isFav = isFavorite(state.currentStream);
                showFeedback(isFav ? '⭐ Adicionado' : '⭐ Removido');
                break;
            case 'Escape': // <--- NOVO CÓDIGO AQUI
                closePlayer();
                break;
        }
    };
    
    /**
     * Mostra feedback visual na tela do player
     */
    let feedbackTimeout;
    const showFeedback = (text) => {
        clearTimeout(feedbackTimeout);
        playerFeedback.textContent = text;
        playerFeedback.style.opacity = '1';
        feedbackTimeout = setTimeout(() => {
            playerFeedback.style.opacity = '0';
        }, 1000);
    };


    // --- LÓGICA DE FAVORITOS ---
    
    /**
     * Verifica se um item é favorito
     */
    const isFavorite = (item) => {
        if(!item) return false;
        const id = item.stream_id || item.series_id;
        const type = state.currentSection;
        return state.favorites[type] && state.favorites[type].includes(id);
    };

    /**
     * Alterna o estado de favorito de um item
     */
    const toggleFavorite = (item) => {
        if(!item) return;
        const id = item.stream_id || item.series_id;
        const type = state.currentSection;
        
        if (!state.favorites[type]) {
            state.favorites[type] = [];
        }

        const index = state.favorites[type].indexOf(id);
        if (index > -1) {
            state.favorites[type].splice(index, 1); // Remove
        } else {
            state.favorites[type].push(id); // Adiciona
        }
        
        // Salva no localStorage
        localStorage.setItem('iptv_favorites', JSON.stringify(state.favorites));
        
        // Atualiza a UI se não estiver no player
        if(playerScreen.classList.contains('hidden')){
           handleCategoryClick(document.querySelector('#category-list .bg-cyan-600').dataset.category);
        }
    };
    
    /**
     * Lida com a tecla 'F' na tela principal para favoritar
     */
    const handleGridKeys = (e) => {
        if ((e.key === 'f' || e.key === 'F') && document.activeElement.classList.contains('content-card')) {
            const card = document.activeElement;
            const id = parseInt(card.dataset.id);
            const type = card.dataset.type;
            const item = state.allContent.find(i => (i.stream_id || i.series_id) === id && type === state.currentSection);
            if (item) {
                toggleFavorite(item);
            }
        }
    };
    
    // --- FUNÇÕES UTILITÁRIAS ---

    /**
     * Mostra ou esconde o spinner de carregamento
     * @param {boolean} show - True para mostrar, false para esconder
     */
    const showLoading = (show) => {
        loadingSpinner.classList.toggle('hidden', !show);
    };


    // --- EVENT LISTENERS ---
    
    loginForm.addEventListener('submit', handleLogin);
    logoutBtn.addEventListener('click', handleLogout);
    navBtns.forEach(btn => btn.addEventListener('click', handleSectionChange));
    searchBox.addEventListener('input', (e) => renderContent(e.target.value));
    backToMainBtn.addEventListener('click', closePlayer);
    
    // Listeners de teclado
    playerScreen.addEventListener('keydown', handlePlayerKeys);
    mainScreen.addEventListener('keydown', handleGridKeys);
    
    // Impede o comportamento padrão da barra de espaço (scroll)
    window.addEventListener('keydown', (e) => {
        if (e.key === ' ' && e.target === document.body) {
            e.preventDefault();
        }
    });

    // Inicia a aplicação
    autoLogin();
});
