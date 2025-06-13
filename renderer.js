/* style.css - Folha de estilos para o aplicativo */

/* Importa Tailwind via CDN (alternativa ao build process) */
@import url('https://cdnjs.cloudflare.com/ajax/libs/tailwindcss/2.2.19/tailwind.min.css');

/* Estilos personalizados */
body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    background-color: #111827; /* bg-gray-900 */
    color: #f9fafb; /* text-gray-50 */
}


/* Esconde a barra de rolagem mas permite rolar */
.overflow-y-auto::-webkit-scrollbar {
    width: 8px;
}
.overflow-y-auto::-webkit-scrollbar-track {
    background: #1f2937; /* bg-gray-800 */
}
.overflow-y-auto::-webkit-scrollbar-thumb {
    background: #4b5563; /* bg-gray-600 */
    border-radius: 4px;
}
.overflow-y-auto::-webkit-scrollbar-thumb:hover {
    background: #6b7280; /* bg-gray-500 */
}

/* --- Estilo da Sidebar para parecer mais com a imagem --- */
#category-sidebar {
    background-color: #1f2937; /* bg-gray-800 */
    flex-shrink: 0;
}

#category-list li {
    padding: 0.75rem 1.25rem;
    margin-bottom: 0.25rem;
    font-size: 0.875rem; /* text-sm */
    color: #d1d5db; /* text-gray-300 */
    border-radius: 6px;
    cursor: pointer;
    transition: background-color 0.2s ease-in-out, color 0.2s ease-in-out;
    display: flex;
    align-items: center;
}

#category-list li.bg-cyan-600, #category-list li.bg-cyan-600:hover {
    color: white;
    font-weight: 600;
}

#category-list li:hover {
    background-color: #374151; /* bg-gray-700 */
    color: white;
}

/* Botão de navegação ativo */
.nav-btn.active {
    background-color: #0891b2; /* bg-cyan-600 */
    color: white;
    font-weight: 600;
}
.nav-btn {
    transition: background-color 0.2s ease-in-out, color 0.2s ease-in-out;
}
.nav-btn:not(.active):hover {
    background-color: #374151; /* bg-gray-700 */
}

/* Foco visível para acessibilidade */
input:focus, button:focus {
    outline: none;
    box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.5); /* ring-cyan-500 com opacidade */
}

/* --- Estilos para Content Card (visuais da imagem) --- */
.content-card {
    background-color: #1f2937; /* bg-gray-800 */
    border-radius: 8px;
    overflow: hidden;
    transition: transform 0.3s ease, box-shadow 0.3s ease;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.content-card:hover {
    transform: translateY(-5px);
    box-shadow: 0 10px 15px rgba(0, 0, 0, 0.2);
}

.fav-button {
    background: rgba(0, 0, 0, 0.5);
    border-radius: 9999px;
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background-color 0.2s;
    text-shadow: 0 1px 3px rgba(0,0,0,0.5);
}

.fav-button:hover {
    background: rgba(0, 0, 0, 0.7);
}

/* --- Header e Grid --- */
header {
    background-color: #1f2937; /* bg-gray-800 */
}

/* --- Estilos de Grid de Conteúdo --- */

/* Estilos base para a grade */
#content-grid {
    padding: 1.5rem;
}

/* Layout para Filmes e Séries (agora como Banners) */
#content-grid.grid-view-detailed {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1.5rem;
}

/* Novo layout para Canais Ao Vivo (Lista) */
#content-grid.grid-view-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 0.75rem; /* Espaçamento menor para a lista */
}
