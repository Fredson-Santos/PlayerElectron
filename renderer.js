// renderer.js - Lógica do Frontend (Processo de Renderização) - OTIMIZADA

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
        categories: [],
        currentContent: [], // Conteúdo da categoria ou busca atual
        favorites: JSON.parse(localStorage.getItem('iptv_favorites')) || {},
        currentSection: 'live', // Inicia em 'live'
        currentCategory: 'all',
        currentStream: null,
        hls: null,
        debounceTimeout: null,
    };

    // --- LÓGICA DE LOGIN E SESSÃO ---

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
            const response = await state.api.get('/player_api.php', { params: { username, password } });
            if (response.data.user_info.auth === 0) throw new Error('Usuário ou senha inválidos.');
            
            state.userInfo = response.data.user_info;

            if (rememberMeCheckbox.checked) {
                localStorage.setItem('iptv_credentials', JSON.stringify({ host, username, password }));
            } else {
                localStorage.removeItem('iptv_credentials');
            }
            
            loginScreen.classList.add('hidden');
            mainScreen.classList.remove('hidden');
            
            // Em vez de carregar TODO o conteúdo, carregamos apenas as categorias da primeira seção
            await fetchAndRenderCategories();

        } catch (error) {
            console.error('Erro no login:', error);
            loginError.textContent = 'Falha no login. Verifique o host e as credenciais.';
        } finally {
            showLoading(false);
        }
    };

    const handleLogout = () => {
        state = { ...state, api: null, userInfo: null, categories: [], currentContent: [], currentSection: 'live' };
        
        if (!rememberMeCheckbox.checked) {
            localStorage.removeItem('iptv_credentials');
            hostInput.value = '';
            usernameInput.value = '';
            passwordInput.value = '';
            rememberMeCheckbox.checked = false;
        }

        mainScreen.classList.add('hidden');
        loginScreen.classList.remove('hidden');
        playerScreen.classList.add('hidden');
        stopPlayer();
    };

    // --- BUSCA E RENDERIZAÇÃO DE CONTEÚDO OTIMIZADA ---

    /**
     * Busca as categorias para a seção atual (live, movie, series) e as renderiza.
     */
    const fetchAndRenderCategories = async () => {
        showLoading(true);
        contentGrid.innerHTML = '';
        const { username, password } = state.userInfo;
        const actionMap = {
            live: 'get_live_categories',
            movie: 'get_vod_categories',
            series: 'get_series_categories',
        };
        
        try {
            const res = await state.api.get('/player_api.php', { params: { username, password, action: actionMap[state.currentSection] } });
            state.categories = res.data || [];
            renderCategories();
            // Após renderizar as categorias, carrega o conteúdo da categoria "Todos"
            await fetchContentForCategory('all');
        } catch (error) {
            console.error('Erro ao buscar categorias:', error);
            contentGrid.innerHTML = '<p class="col-span-full text-center text-gray-400">Falha ao carregar categorias.</p>';
        } finally {
            showLoading(false);
        }
    };

    /**
     * Busca o conteúdo para uma categoria específica ou todos os itens da seção.
     * @param {string} categoryId - O ID da categoria ('all' para todas).
     */
    const fetchContentForCategory = async (categoryId) => {
        showLoading(true);
        state.currentCategory = categoryId;
        const { username, password } = state.userInfo;
        const actionMap = {
            live: 'get_live_streams',
            movie: 'get_vod_streams',
            series: 'get_series',
        };
        const params = { username, password, action: actionMap[state.currentSection] };
        if (categoryId !== 'all') {
            params.category_id = categoryId;
        }

        try {
            const res = await state.api.get('/player_api.php', { params });
            state.currentContent = res.data || [];
            renderItems(state.currentContent);
        } catch (error) {
            console.error(`Erro ao buscar conteúdo para categoria ${categoryId}:`, error);
            contentGrid.innerHTML = '<p class="col-span-full text-center text-gray-400">Falha ao carregar conteúdo.</p>';
        } finally {
            showLoading(false);
        }
    };
    
    /**
     * Renderiza a lista de categorias na barra lateral.
     */
    const renderCategories = () => {
        categoryList.innerHTML = '';
        
        const createCategoryElement = (name, id) => {
            const li = document.createElement('li');
            li.textContent = name;
            li.dataset.category = id;
            li.className = `p-2 rounded cursor-pointer mb-1 text-sm hover:bg-gray-700`;
            li.addEventListener('click', () => handleCategoryClick(id));
            return li;
        };

        categoryList.appendChild(createCategoryElement('Todos', 'all'));
        categoryList.appendChild(createCategoryElement('⭐ Favoritos', 'favorites'));
        
        state.categories.forEach(cat => {
            categoryList.appendChild(createCategoryElement(cat.category_name, cat.category_id));
        });
        
        // Ativa a categoria atual
        updateActiveCategoryUI();
    };

    /**
     * Renderiza os itens (canais/filmes/séries) na grid principal.
     * @param {object[]} items - Array de itens para renderizar.
     */
    const renderItems = (items) => {
        contentGrid.innerHTML = '';
        if (!items || items.length === 0) {
            contentGrid.innerHTML = '<p class="col-span-full text-center text-gray-400">Nenhum item encontrado.</p>';
            return;
        }

        const fragment = document.createDocumentFragment();
        items.forEach(item => {
            const isFav = isFavorite(item);
            const card = document.createElement('div');
            card.className = 'content-card bg-gray-800 rounded-lg overflow-hidden cursor-pointer transform hover:scale-105 transition-transform duration-200';
            card.dataset.id = item.stream_id || item.series_id;
            card.dataset.type = state.currentSection;
            
            const iconUrl = item.stream_icon || item.cover || 'https://placehold.co/200x300/181818/FFF?text=?';

            card.innerHTML = `
                <img src="${iconUrl}" alt="${item.name}" class="w-full h-40 object-cover" onerror="this.onerror=null;this.src='https://placehold.co/200x300/181818/FFF?text=${encodeURIComponent(item.name ? item.name[0] : '?')}';">
                <div class="p-2">
                    <h3 class="text-xs font-semibold truncate">${item.name || 'Sem nome'}</h3>
                </div>
                ${isFav ? '<div class="fav-indicator absolute top-1 right-1 text-yellow-400 text-lg">⭐</div>' : ''}
            `;
            
            card.addEventListener('click', () => handleItemClick(item));
            fragment.appendChild(card);
        });
        contentGrid.appendChild(fragment);
    };

    const handleCategoryClick = async (categoryId) => {
        searchBox.value = '';
        if (categoryId === 'favorites') {
            showFavorites();
        } else {
            await fetchContentForCategory(categoryId);
        }
        updateActiveCategoryUI();
    };
    
    const updateActiveCategoryUI = () => {
         document.querySelectorAll('#category-list li').forEach(li => {
            li.classList.toggle('bg-cyan-600', li.dataset.category === state.currentCategory);
            if(li.dataset.category !== state.currentCategory) li.classList.remove('bg-cyan-600');
        });
    };

    const handleSectionChange = async (e) => {
        const section = e.target.dataset.section;
        if (section && section !== state.currentSection) {
            state.currentSection = section;
            navBtns.forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            searchBox.value = '';
            await fetchAndRenderCategories();
        }
    };
    
    /**
     * Otimização de busca com Debounce para evitar excesso de renderizações.
     */
    const handleSearch = (e) => {
        clearTimeout(state.debounceTimeout);
        const filter = e.target.value.toLowerCase().trim();
        
        state.debounceTimeout = setTimeout(() => {
            if (!filter) {
                // Se a busca for limpa, volta para a categoria que estava ativa
                handleCategoryClick(state.currentCategory);
                return;
            }
            // A busca funciona no conteúdo já carregado na `state.currentContent`
            const filteredItems = state.currentContent.filter(item => 
                item.name && item.name.toLowerCase().includes(filter)
            );
            renderItems(filteredItems);
             // Desativa a seleção de categoria durante a busca
            document.querySelectorAll('#category-list li').forEach(li => li.classList.remove('bg-cyan-600'));
        }, 300); // Atraso de 300ms
    };

    // --- LÓGICA DO PLAYER DE VÍDEO (sem grandes alterações) ---

    const handleItemClick = (item) => {
        if (state.currentSection === 'series') {
            alert('A reprodução de séries requer uma tela de seleção de episódios (não implementada).');
            return;
        }

        const { username, password } = state.userInfo;
        const streamId = item.stream_id;
        const extension = item.container_extension || 'mp4';
        const host = hostInput.value.trim();
        
        let streamUrl;
        if (state.currentSection === 'live') {
            streamUrl = `${host}/live/${username}/${password}/${streamId}.m3u8`;
        } else { // Movie
            streamUrl = `${host}/movie/${username}/${password}/${streamId}.${extension}`;
        }
        
        state.currentStream = item;
        playStream(streamUrl);
    };
    
    const playStream = (url) => {
        stopPlayer();
        mainScreen.classList.add('hidden');
        playerScreen.classList.remove('hidden');
        showLoading(true);

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
                videoPlayer.src = url;
                videoPlayer.addEventListener('loadedmetadata', () => videoPlayer.play());
                videoPlayer.addEventListener('canplay', () => showLoading(false));
            }
        } else {
            videoPlayer.src = url;
            videoPlayer.play();
            videoPlayer.addEventListener('canplay', () => showLoading(false));
        }
        videoPlayer.focus();
    };

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
    
    const closePlayer = () => {
        stopPlayer();
        playerScreen.classList.add('hidden');
        mainScreen.classList.remove('hidden');
        // Re-renderiza para atualizar UI, como o indicador de favorito
        renderItems(state.currentContent);
    };
    
    const handlePlayerKeys = (e) => {
        e.preventDefault();
        switch (e.key) {
            case ' ': videoPlayer.paused ? (videoPlayer.play(), showFeedback('▶')) : (videoPlayer.pause(), showFeedback('❚❚')); break;
            case 'ArrowRight': videoPlayer.currentTime += 10; showFeedback('» +10s'); break;
            case 'ArrowLeft': videoPlayer.currentTime -= 10; showFeedback('« -10s'); break;
            case 't': case 'T': window.electronAPI.toggleFullscreen(); break;
            case 'f': case 'F':
                toggleFavorite(state.currentStream);
                showFeedback(isFavorite(state.currentStream) ? '⭐ Adicionado' : '⭐ Removido');
                break;
            case 'Escape': closePlayer(); break;
        }
    };
    
    let feedbackTimeout;
    const showFeedback = (text) => {
        clearTimeout(feedbackTimeout);
        playerFeedback.textContent = text;
        playerFeedback.style.opacity = '1';
        feedbackTimeout = setTimeout(() => { playerFeedback.style.opacity = '0'; }, 1000);
    };

    // --- LÓGICA DE FAVORITOS ---
    
    const isFavorite = (item) => {
        if (!item) return false;
        const id = item.stream_id || item.series_id;
        const type = state.currentSection;
        return state.favorites[type] && state.favorites[type].includes(id);
    };
    
    /**
     * Busca todos os itens da seção atual para poder filtrar os favoritos.
     * Esta é uma operação pesada, usada somente quando o usuário clica em "Favoritos".
     */
    const showFavorites = async () => {
        showLoading(true);
        state.currentCategory = 'favorites';
        updateActiveCategoryUI();
        const { username, password } = state.userInfo;
        const favIds = state.favorites[state.currentSection] || [];

        if (favIds.length === 0) {
            renderItems([]);
            showLoading(false);
            return;
        }
        
        // Para os favoritos, precisamos buscar a lista completa e depois filtrar.
        // Isso é menos eficiente, mas muitas APIs não oferecem um endpoint para buscar múltiplos IDs.
        const actionMap = {
            live: 'get_live_streams',
            movie: 'get_vod_streams',
            series: 'get_series',
        };
        const params = { username, password, action: actionMap[state.currentSection] };
        
        try {
            const res = await state.api.get('/player_api.php', { params });
            const allItems = res.data || [];
            const favoriteItems = allItems.filter(item => favIds.includes(item.stream_id || item.series_id));
            state.currentContent = favoriteItems; // Atualiza o conteúdo atual para a lista de favoritos
            renderItems(favoriteItems);
        } catch (error) {
            console.error('Erro ao buscar favoritos:', error);
        } finally {
            showLoading(false);
        }
    };


    const toggleFavorite = (item) => {
        if (!item) return;
        const id = item.stream_id || item.series_id;
        const type = state.currentSection;
        
        if (!state.favorites[type]) state.favorites[type] = [];

        const index = state.favorites[type].indexOf(id);
        if (index > -1) {
            state.favorites[type].splice(index, 1);
        } else {
            state.favorites[type].push(id);
        }
        
        localStorage.setItem('iptv_favorites', JSON.stringify(state.favorites));
        
        if (playerScreen.classList.contains('hidden')) {
           renderItems(state.currentContent); // Apenas re-renderiza os itens visíveis
        }
    };
    
    // --- FUNÇÕES UTILITÁRIAS ---

    const showLoading = (show) => {
        loadingSpinner.classList.toggle('hidden', !show);
    };

    // --- EVENT LISTENERS ---
    
    loginForm.addEventListener('submit', handleLogin);
    logoutBtn.addEventListener('click', handleLogout);
    navBtns.forEach(btn => btn.addEventListener('click', handleSectionChange));
    searchBox.addEventListener('input', handleSearch);
    backToMainBtn.addEventListener('click', closePlayer);
    playerScreen.addEventListener('keydown', handlePlayerKeys);
    
    window.addEventListener('keydown', (e) => {
        if (e.key === ' ' && e.target === document.body) e.preventDefault();
    });

    // Inicia a aplicação
    autoLogin();
});
