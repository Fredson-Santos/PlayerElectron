// renderer.js - Lógica do Frontend (Processo de Renderização) - ATUALIZADO

document.addEventListener('DOMContentLoaded', () => {
    // Referências aos elementos da UI (sem alteração)
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

    // Estado da aplicação (sem alteração)
    let state = {
        api: null,
        userInfo: null,
        categories: [],
        currentContent: [],
        favorites: JSON.parse(localStorage.getItem('iptv_favorites')) || {},
        currentSection: 'live',
        currentCategory: null,
        currentStream: null,
        hls: null,
        debounceTimeout: null,
    };

    // --- LÓGICA DE LOGIN E SESSÃO (sem alteração) ---
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
            await handleSectionChange({ target: { dataset: { section: 'live' } } }, true);
        } catch (error) {
            console.error('Erro no login:', error);
            loginError.textContent = 'Falha no login. Verifique o host e as credenciais.';
            showLoading(false);
        }
    };

    const handleLogout = () => {
        state = { ...state, api: null, userInfo: null, categories: [], currentContent: [], currentSection: 'live', currentCategory: null };
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

    // --- BUSCA E RENDERIZAÇÃO DE CONTEÚDO (sem alteração na lógica, apenas na renderItems) ---
    const fetchAndRenderCategories = async () => {
        showLoading(true);
        state.currentContent = [];
        state.currentCategory = null;
        renderItems([]);
        contentGrid.innerHTML = '<p class="col-span-full text-center text-gray-400">Selecione uma categoria para começar.</p>';
        updateActiveCategoryUI();
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
        } catch (error) {
            console.error('Erro ao buscar categorias:', error);
            categoryList.innerHTML = '<li>Falha ao carregar.</li>'
        } finally {
            showLoading(false);
        }
    };

    const fetchContentForCategory = async (categoryId) => {
        showLoading(true);
        state.currentCategory = categoryId;
        updateActiveCategoryUI();
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
    
    const renderCategories = () => {
        categoryList.innerHTML = '';
        const createCategoryElement = (name, id) => {
            const li = document.createElement('li');
            li.textContent = name;
            li.dataset.category = id;
            li.addEventListener('click', () => handleCategoryClick(id));
            return li;
        };
        categoryList.appendChild(createCategoryElement('Todos', 'all'));
        categoryList.appendChild(createCategoryElement('⭐ Favoritos', 'favorites'));
        (state.categories || []).forEach(cat => {
            categoryList.appendChild(createCategoryElement(cat.category_name, cat.category_id));
        });
    };

    // ===== FUNÇÃO MODIFICADA PARA A NOVA INTERFACE =====
    const renderItems = (items) => {
        contentGrid.innerHTML = '';
        if (!items || items.length === 0) {
            if (state.currentCategory) {
                contentGrid.innerHTML = '<p class="col-span-full text-center text-gray-400">Nenhum item encontrado nesta categoria.</p>';
            }
            return;
        }

        const fragment = document.createDocumentFragment();
        items.forEach(item => {
            const card = document.createElement('div');
            card.dataset.id = item.stream_id || item.series_id;
            
            // Seção "Ao Vivo" continua com o layout de lista com imagens
            if (state.currentSection === 'live') {
                card.className = 'flex items-center bg-gray-800 rounded-lg p-2 cursor-pointer transition-colors hover:bg-gray-700';
                const iconUrl = item.stream_icon || 'https://placehold.co/160x90/1f2937/FFF?text=?';
                card.innerHTML = `
                    <img src="${iconUrl}" alt="${item.name}" class="w-20 h-12 object-contain mr-4 flex-shrink-0 bg-black/20 rounded-md" onerror="this.onerror=null;this.src='https://placehold.co/160x90/1f2937/FFF?text=${encodeURIComponent(item.name ? item.name[0] : '?')}';">
                    <h3 class="text-sm font-semibold text-white truncate">${item.name}</h3>
                `;
                card.addEventListener('click', () => handleItemClick(item));

            } else { 
                // NOVO: Layout de banner SOMENTE TEXTO para Filmes e Séries
                card.className = 'flex items-center justify-center text-center bg-gray-800 rounded-lg p-3 cursor-pointer h-36 transition-colors hover:bg-gray-700';
                
                // Exibe apenas o nome do item. Toda a lógica de imagens, notas e favoritos foi removida temporariamente.
                card.innerHTML = `
                    <h3 class="text-sm font-semibold text-white">${item.name || 'Sem nome'}</h3>
                `;
                card.addEventListener('click', () => handleItemClick(item));
            }
            
            fragment.appendChild(card);
        });
        contentGrid.appendChild(fragment);
    };

    const handleCategoryClick = async (categoryId) => {
        searchBox.value = '';
        if (categoryId === 'favorites') {
            await showFavorites();
        } else {
            await fetchContentForCategory(categoryId);
        }
    };
    
    const updateActiveCategoryUI = () => {
         document.querySelectorAll('#category-list li').forEach(li => {
            li.classList.remove('bg-cyan-600');
            if (li.dataset.category === state.currentCategory) {
                li.classList.add('bg-cyan-600');
            }
        });
    };

    const handleSectionChange = async (e, isInitialLoad = false) => {
        const section = e.target.dataset.section;
        if (section && (section !== state.currentSection || isInitialLoad)) {
            state.currentSection = section;
            navBtns.forEach(btn => btn.classList.remove('active'));
            document.querySelector(`button[data-section="${section}"]`).classList.add('active');
            searchBox.value = '';

            // Adiciona a classe correta ao contêiner da grade
            contentGrid.classList.remove('grid-view-detailed', 'grid-view-list');
            if (section === 'live') {
                contentGrid.classList.add('grid-view-list');
            } else {
                contentGrid.classList.add('grid-view-detailed'); // Classe renomeada de 'grid-view-posters'
            }
            
            if (state.currentSection === 'live') {
                showLoading(true);
                const { username, password } = state.userInfo;
                try {
                    const catRes = await state.api.get('/player_api.php', { params: { username, password, action: 'get_live_categories' } });
                    state.categories = catRes.data || [];
                    renderCategories();
                    await fetchContentForCategory('all');
                } catch (error) {
                    console.error("Erro ao carregar seção Ao Vivo:", error);
                    contentGrid.innerHTML = '<p class="col-span-full text-center text-gray-400">Falha ao carregar canais.</p>';
                } finally {
                    showLoading(false);
                }
            } else {
                await fetchAndRenderCategories();
            }
        }
    };
    
    const handleSearch = (e) => {
        clearTimeout(state.debounceTimeout);
        const filter = e.target.value.toLowerCase().trim();
        if (state.currentContent.length === 0 && filter) {
            return;
        }
        state.debounceTimeout = setTimeout(() => {
            if (!filter) {
                renderItems(state.currentContent);
                return;
            }
            const filteredItems = state.currentContent.filter(item => 
                item.name && item.name.toLowerCase().includes(filter)
            );
            renderItems(filteredItems);
        }, 300);
    };

    // --- LÓGICA DO PLAYER (sem alteração) ---
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
        } else {
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
                state.hls.on(Hls.Events.MANIFEST_PARSED, () => { videoPlayer.play(); showLoading(false); });
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
                videoPlayer.addEventListener('loadedmetadata', () => { videoPlayer.play(); showLoading(false); });
            }
        } else {
            videoPlayer.src = url;
            videoPlayer.play();
            showLoading(false);
        }
        playerScreen.focus();
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

    // --- LÓGICA DE FAVORITOS (com atualização da UI) ---
    
    const isFavorite = (item) => {
        if (!item) return false;
        const id = item.stream_id || item.series_id;
        const type = state.currentSection;
        return state.favorites[type] && state.favorites[type].includes(id);
    };
    
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
            state.currentContent = favoriteItems;
            renderItems(favoriteItems);
        } catch (error) {
            console.error('Erro ao buscar favoritos:', error);
        } finally {
            showLoading(false);
        }
    };
    
    // ===== FUNÇÃO MODIFICADA PARA A NOVA INTERFACE =====
    const toggleFavorite = (item) => {
        if (!item) return;
        const id = item.stream_id || item.series_id;
        const type = state.currentSection;
        
        if (!state.favorites[type]) {
            state.favorites[type] = [];
        }

        let isNowFavorite = false;
        const index = state.favorites[type].indexOf(id);
        if (index > -1) {
            state.favorites[type].splice(index, 1);
            isNowFavorite = false;
        } else {
            state.favorites[type].push(id);
            isNowFavorite = true;
        }
        
        localStorage.setItem('iptv_favorites', JSON.stringify(state.favorites));
        
        // Atualiza apenas o ícone do card clicado, sem recarregar tudo
        const card = contentGrid.querySelector(`.content-card[data-id='${id}']`);
        if (card) {
            const favButton = card.querySelector('.fav-button');
            if (favButton) {
                favButton.innerHTML = isNowFavorite 
                    ? '<span class="text-red-500">♥</span>' 
                    : '<span class="text-white">♡</span>';
            }
        }

        // Se estiver na tela de favoritos, recarrega para remover o item
        if (state.currentCategory === 'favorites' && playerScreen.classList.contains('hidden')) {
            showFavorites();
        }
    };
    
    const showLoading = (show) => {
        loadingSpinner.classList.toggle('hidden', !show);
    };

    // --- EVENT LISTENERS ---
    
    loginForm.addEventListener('submit', handleLogin);
    logoutBtn.addEventListener('click', handleLogout);
    navBtns.forEach(btn => btn.addEventListener('click', (e) => handleSectionChange(e)));
    searchBox.addEventListener('input', handleSearch);
    backToMainBtn.addEventListener('click', closePlayer);
    playerScreen.addEventListener('keydown', handlePlayerKeys);
    
    window.addEventListener('keydown', (e) => {
        if (e.key === ' ' && e.target === document.body) e.preventDefault();
    });

    // Inicia a aplicação
    autoLogin();
});
