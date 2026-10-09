// NotebookLM Organizer - Content Script

let notebookTags = {};
let globalTags = [];
let tagConfig = {}; // { tagName: { color: '#1a73e8' } }
let activeFilters = new Set();
let filterMode = 'AND'; // 'AND' o 'OR'
let uiLang = 'auto'; // 'auto', 'es', 'en', 'ca'
let searchQuery = '';
let currentPopover = null;
let lastClickedNotebookId = null;
let activeTooltip = null; 
let tooltipTimeout = null; 
let lastTooltipNotebookId = null;
let titleToIdMap = {}; 
let overriddenMessages = null; // Cache para traducciones manuales
let hasInteracted = false; // Flag para evitar guardados vacíos accidentales
let lastUpdated = 0; // Sello de tiempo para resolución de conflictos
let syncMode = 'heuristic'; // 'off', 'heuristic', 'always' (Solo en LocalStorage)

const IS_DEV_MODE = !chrome.runtime.getManifest().update_url;
const PRESET_COLORS = ['#1a73e8', '#d93025', '#188038', '#f9ab00', '#e37400', '#9334e6', '#0097a7', '#607d8b'];

// 1. UTILIDADES Y TRADUCCIÓN
function t(key, ...args) {
    let msg = "";
    if (uiLang === 'auto' || !overriddenMessages) {
        msg = chrome.i18n.getMessage(key, args);
    } else {
        msg = overriddenMessages[key]?.message || chrome.i18n.getMessage(key, args);
        // Reemplazo manual para el caso de idioma forzado
        args.forEach((val, i) => {
            msg = msg.replace(`$${i + 1}`, val);
        });
    }
    return msg || key;
}

async function loadLanguage(lang) {
    if (!lang || lang === 'auto') {
        overriddenMessages = null;
        return;
    }
    try {
        const url = chrome.runtime.getURL(`_locales/${lang}/messages.json`);
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        overriddenMessages = await res.json();
    } catch (e) {
        console.error("NBLM Organizer - Error cargando idioma:", e);
        overriddenMessages = null;
    }
}

function escapeHTML(str) {
    return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// 2. PERSISTENCIA Y DATOS
let saveTimeout = null;

// Chrome Sync limita cada elemento a 8192 bytes, medidos sobre JSON.stringify(valor) + clave.
// Al serializar de nuevo un texto JSON, las comillas y barras se escapan (2 bytes) y los
// caracteres no ASCII pueden ocupar hasta 6 bytes (\uXXXX), así que medimos el coste real.
const SYNC_CHUNK_BUDGET = 8000;

function splitIntoSyncChunks(str) {
    const chunks = [];
    let current = '';
    let cost = 2; // Comillas que envuelven el valor serializado
    for (const ch of str) { // Iteración por punto de código: nunca partimos pares sustitutos
        const code = ch.codePointAt(0);
        let chCost;
        if (ch === '"' || ch === '\\') chCost = 2;
        else if (code < 0x20) chCost = 6;
        else if (code < 0x80) chCost = 1;
        else chCost = 6 * ch.length;
        if (cost + chCost > SYNC_CHUNK_BUDGET) {
            chunks.push(current);
            current = '';
            cost = 2;
        }
        current += ch;
        cost += chCost;
    }
    chunks.push(current);
    return chunks;
}

function sanitizeData() {
    Object.keys(notebookTags).forEach(id => {
        notebookTags[id] = notebookTags[id].filter(tag => globalTags.includes(tag));
        if (notebookTags[id].length === 0) delete notebookTags[id];
    });
    Object.keys(tagConfig).forEach(tag => {
        if (!globalTags.includes(tag)) delete tagConfig[tag];
    });
}

function saveAllData() {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        sanitizeData();
        
        // CERRADURA DE SEGURIDAD: No permitimos borrar la nube (globalTags vacío)
        // a menos que el usuario haya hecho una acción explícita (hasInteracted).
        if (globalTags.length === 0 && !hasInteracted) {
            saveTimeout = null;
            return;
        }

        lastUpdated = Date.now();
        const fullData = { notebookTags, globalTags, titleToIdMap, tagConfig, filterMode, uiLang, lastUpdated };
        const jsonString = JSON.stringify(fullData);
        
        // En Modo Dev, la caché local es nuestra red de seguridad ante desinstalaciones.
        if (IS_DEV_MODE) {
            chrome.storage.local.set(fullData);
        }

        const chunkList = splitIntoSyncChunks(jsonString);
        const chunks = {};
        chunkList.forEach((chunk, i) => { chunks[`_chunk_${i}`] = chunk; });
        chunks['_chunk_count'] = chunkList.length;

        // Escribimos primero y solo después eliminamos los fragmentos sobrantes:
        // si la escritura falla (cuota), los datos anteriores de la nube quedan intactos.
        chrome.storage.sync.set(chunks, () => {
            if (chrome.runtime.lastError) {
                console.error("Error crítico en Sync:", chrome.runtime.lastError.message);
                return;
            }
            chrome.storage.sync.get(null, (allSyncData) => {
                const staleKeys = Object.keys(allSyncData).filter(k => /^_chunk_\d+$/.test(k) && !(k in chunks));
                if (staleKeys.length > 0) chrome.storage.sync.remove(staleKeys);
            });
        });
        saveTimeout = null;
    }, 1000);
}

function getTagColor(tagName) {
    const color = tagConfig[tagName]?.color;
    // Validamos el formato: el color se inserta en atributos HTML y puede venir de un JSON importado
    return /^#[0-9a-f]{6}$/i.test(color || '') ? color : '#1a73e8';
}

// Texto blanco u oscuro según cuál contraste más con el fondo (luminancia relativa WCAG)
const DARK_TEXT = '#202124';
function getContrastText(hex) {
    const luminance = (h) => {
        const [r, g, b] = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255)
            .map(c => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const bg = luminance(hex);
    const contrastWhite = 1.05 / (bg + 0.05);
    const contrastDark = (bg + 0.05) / (luminance(DARK_TEXT) + 0.05);
    return contrastWhite >= contrastDark ? '#ffffff' : DARK_TEXT;
}

const COLOR_NAME_KEYS = {
    '#1a73e8': 'color_blue', '#d93025': 'color_red', '#188038': 'color_green', '#f9ab00': 'color_yellow',
    '#e37400': 'color_orange', '#9334e6': 'color_purple', '#0097a7': 'color_teal', '#607d8b': 'color_grey'
};

// Iconos Material (Apache 2.0) en línea: se ven igual en todos los sistemas, a diferencia de los emojis
const ICON_PATHS = {
    download: 'M5 20h14v-2H5v2zM19 9h-4V3H9v6H5l7 7 7-7z',
    upload: 'M5 20h14v-2H5v2zm0-10h4v6h6v-6h4l-7-7-7 7z',
    close: 'M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
    edit: 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z',
    delete: 'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z',
    warning: 'M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z',
    expand: 'M16.59 8.59 12 13.17 7.41 8.59 6 10l6 6 6-6z',
    search: 'M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z'
};
function icon(name, size = 18) {
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" focusable="false"><path fill="currentColor" d="${ICON_PATHS[name]}"/></svg>`;
}

function countNotebooksWithTag(tag) {
    return Object.values(notebookTags).filter(tags => tags.includes(tag)).length;
}

function formatNotebookCount(n) {
    if (n === 0) return t('tag_count_zero');
    return n === 1 ? t('tag_count_one') : t('tag_count_other', n);
}

// Cierra un diálogo con Escape solo si es el que está encima del todo. El listener se
// retira solo cuando el diálogo ya no está en la página.
function closeOnEscape(overlay, onClose) {
    const handler = (e) => {
        if (!overlay.isConnected) { document.removeEventListener('keydown', handler, true); return; }
        if (e.key !== 'Escape') return;
        // En un nombre a medio editar, Escape deshace el cambio (lo gestiona el propio campo)
        const target = e.target;
        if (target.classList?.contains('nblm-tag-edit-input') && target.value !== target.defaultValue) return;
        const overlays = document.querySelectorAll('.nblm-modal-overlay');
        if (overlays[overlays.length - 1] !== overlay) return;
        e.stopPropagation();
        document.removeEventListener('keydown', handler, true);
        onClose();
    };
    document.addEventListener('keydown', handler, true);
}

function normalizeString(str) {
    if (!str) return "";
    return str.toLowerCase()
              .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
              .replace(/[^a-z0-9]/g, "")
              .trim();
}

// 3. METADATOS Y HUELLA
function getNotebookFingerprint(notebook) {
    const titleEl = notebook.querySelector('.project-button-title, .project-table-title');
    if (!titleEl) return null;
    const title = normalizeString(titleEl.innerText).substring(0, 30);
    const sourcesEl = notebook.querySelector('.project-button-subtitle-part-sources, .sources-column');
    const sources = (sourcesEl?.innerText || "").replace(/\D/g, "") || "0";
    return `${title}|${sources}`;
}

function extractNotebookId(element) {
    const mainBtn = element.querySelector('button[aria-labelledby*="project-"]');
    if (mainBtn) {
        const attr = mainBtn.getAttribute('aria-labelledby');
        const match = attr.match(/project-([a-f0-9-]+)-title/);
        if (match) return match[1];
    }
    const link = element.querySelector('a[href*="notebook/"]') || (element.tagName === 'A' && element.href.includes('notebook/') ? element : null);
    if (link) {
        const match = link.href.match(/notebook\/([a-f0-9-]+)/);
        if (match) return match[1];
    }
    const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
    const htmlMatch = element.outerHTML.match(uuidPattern);
    if (htmlMatch) return htmlMatch[0];
    return null;
}

function getResolvedId(notebook, isCollision = false) {
    const realId = extractNotebookId(notebook); 
    const fp = getNotebookFingerprint(notebook);
    if (!realId && isCollision) return `collision:${fp}`;
    if (realId) {
        if (fp && titleToIdMap[fp] !== realId) {
            titleToIdMap[fp] = realId;
            saveAllData();
        }
        if (fp && notebookTags[`fp:${fp}`]) {
            const existing = notebookTags[realId] || [];
            notebookTags[realId] = [...new Set([...existing, ...notebookTags[`fp:${fp}`]])];
            delete notebookTags[`fp:${fp}`];
            saveAllData();
        }
        return realId;
    }
    if (fp && titleToIdMap[fp]) return titleToIdMap[fp];
    return fp ? `fp:${fp}` : null;
}

// 4. LÓGICA DE PROCESAMIENTO
const NOTEBOOK_ROW_SELECTOR = 'project-button, tr, [role="row"]';

function isHeaderRow(node) {
    return node.querySelector('th') || node.classList.contains('mat-mdc-header-row');
}

// Recorre todos los cuadernos UNA sola vez y calcula su huella y cuántas veces aparece cada una.
// Solo lee del DOM (sin escrituras intercaladas), así el navegador maqueta la página una única vez.
function scanNotebooks() {
    const fpByNode = new Map();
    const fpCounts = new Map();
    document.querySelectorAll(NOTEBOOK_ROW_SELECTOR).forEach(node => {
        if (isHeaderRow(node)) return;
        const fp = getNotebookFingerprint(node);
        fpByNode.set(node, fp);
        if (fp) fpCounts.set(fp, (fpCounts.get(fp) || 0) + 1);
    });
    const isCollision = (node) => {
        const fp = fpByNode.has(node) ? fpByNode.get(node) : getNotebookFingerprint(node);
        return !!fp && fpCounts.get(fp) > 1;
    };
    return { fpByNode, isCollision };
}

function processNewNodes() {
  const newNodes = document.querySelectorAll('project-button:not(.nblm-processed), tr[mat-row]:not(.nblm-processed), [role="row"]:not(.nblm-processed)');
  if (newNodes.length === 0) return;

  const scan = scanNotebooks();

  // Fase de lectura: resolvemos los IDs de todos los nodos nuevos antes de tocar el DOM
  const toProcess = [];
  newNodes.forEach(node => {
    if (isHeaderRow(node) || node.innerText.trim() === "") return;
    const isCollision = scan.isCollision(node);
    const id = getResolvedId(node, isCollision);
    if (id) toProcess.push({ node, id, isCollision });
  });

  // Fase de escritura
  toProcess.forEach(({ node, id, isCollision }) => {
    node.classList.add('nblm-processed');
    if (isCollision) {
        const warnIcon = document.createElement('span');
        warnIcon.className = 'nblm-collision-warning';
        warnIcon.innerText = '⚠️';
        warnIcon.title = t('alert_collision_title');
        const titleEl = node.querySelector('.project-button-title, .project-table-title');
        if (titleEl) titleEl.appendChild(warnIcon);
    }
    const tagContainer = document.createElement('div');
    tagContainer.className = 'nblm-tag-container';
    const target = node.querySelector('mat-card') || node.querySelector('.mat-column-title') || node;
    target.appendChild(tagContainer);
    renderTags(tagContainer, id);
  });

  // Los cuadernos que aparecen después (al volver de un cuaderno, "Ver más"...) también deben
  // respetar los filtros y la búsqueda activos
  if (toProcess.length > 0 && (activeFilters.size > 0 || searchQuery)) applyFilters();
}

// 5. FUNCIONES DE INTERFAZ (UI)
function renderTags(container, id) {
  container.innerHTML = '';
  if (!id || id.startsWith('collision:')) return;
  const tags = notebookTags[id] || [];
  const isListView = container.closest('tr, [role="row"]') !== null;
  const limit = isListView ? 4 : 2;

  tags.slice(0, limit).forEach(tag => container.appendChild(createTagElement(tag, id)));
  if (tags.length > limit) {
      const moreEl = document.createElement('span');
      moreEl.className = 'nblm-more-tags';
      moreEl.innerText = `+${tags.length - limit}`;
      const isPinned = activeTooltip?.dataset.id === id && activeTooltip?.dataset.sticky === 'true';
      moreEl.title = isPinned ? t('tooltip_close_tags') : t('tooltip_more_tags');
      moreEl.onclick = (e) => { 
          e.stopPropagation(); 
          if (isPinned) closeTooltip(); else showFullTagsTooltip(moreEl, id, true);
          updateUI();
      };
      container.appendChild(moreEl);
  }
}

function createTagElement(tag, id, inTooltip = false) {
    const tagEl = document.createElement('span');
    tagEl.className = 'nblm-tag';
    tagEl.style.backgroundColor = getTagColor(tag);
    tagEl.style.color = getContrastText(getTagColor(tag));
    tagEl.innerHTML = `<span>${escapeHTML(tag)}</span><span class="remove-tag">×</span>`;
    tagEl.querySelector('.remove-tag').onclick = (e) => { e.stopPropagation(); removeTagFromNotebook(id, tag); };
    if (!inTooltip) {
        tagEl.onmouseenter = () => { if (tooltipTimeout) clearTimeout(tooltipTimeout); showFullTagsTooltip(tagEl, id, false); };
        tagEl.onmouseleave = () => { 
            tooltipTimeout = setTimeout(() => {
                if (activeTooltip && activeTooltip.dataset.sticky !== 'true' && activeTooltip.dataset.hovered !== 'true') closeTooltip();
            }, 150);
        };
    }
    return tagEl;
}

function injectMenuItem(overlay) {
    const menuContent = overlay.querySelector('.mat-mdc-menu-content');
    const isNotebookMenu = overlay.querySelector('.project-button-hamburger-menu') || overlay.classList.contains('project-button-hamburger-menu');
    
    if (menuContent && isNotebookMenu && !menuContent.querySelector('.nblm-menu-item')) {
        const item = document.createElement('button');
        item.className = 'mat-mdc-menu-item nblm-menu-item';
        item.innerHTML = `<span class="mat-mdc-menu-item-text">${t('menu_item_tag')}</span>`;
        item.onclick = (e) => {
            e.preventDefault(); e.stopPropagation();
            document.querySelector('.cdk-overlay-backdrop')?.click();
            if (lastClickedNotebookId?.startsWith('collision:')) showCollisionAlert();
            else if (lastClickedNotebookId) showTagPopover(lastClickedNotebookId);
        };
        menuContent.appendChild(item);
    }
}

function showAlertDialog(icon, title, message) {
    const overlay = document.createElement('div');
    overlay.className = 'nblm-modal-overlay';
    overlay.style.zIndex = '30000';
    overlay.innerHTML = `
        <div class="nblm-alert-modal">
            <div class="nblm-alert-icon">${icon}</div>
            <div class="nblm-alert-title">${title}</div>
            <div class="nblm-alert-message">${message}</div>
            <button class="nblm-alert-button">${t('alert_understood')}</button>
        </div>
    `;
    overlay.querySelector('.nblm-alert-button').onclick = () => overlay.remove();
    closeOnEscape(overlay, () => overlay.remove());
    document.body.appendChild(overlay);
}

function showCollisionAlert() {
    showAlertDialog('⚠️', t('alert_collision_title'), t('alert_collision_msg'));
}

function toggleTag(id, tag) {
    hasInteracted = true;
    if (!notebookTags[id]) notebookTags[id] = [];
    notebookTags[id] = notebookTags[id].includes(tag) ? notebookTags[id].filter(t => t !== tag) : [...notebookTags[id], tag];
    saveAllData();
    updateUI();
}

function removeTagFromNotebook(id, tag) {
    hasInteracted = true;
    if (notebookTags[id]) {
        notebookTags[id] = notebookTags[id].filter(t => t !== tag);
        saveAllData();
        updateUI();
    }
}

function updateUI() {
  const scan = scanNotebooks();
  // Fase de lectura: resolvemos los IDs de todos los cuadernos procesados
  const items = [];
  document.querySelectorAll('.nblm-processed').forEach(node => {
    const container = node.querySelector('.nblm-tag-container');
    if (container) items.push({ container, id: getResolvedId(node, scan.isCollision(node)) });
  });
  // Fase de escritura
  items.forEach(({ container, id }) => renderTags(container, id));
  refreshTooltip();
  renderFilterTags(); applyFilters(scan);
}

function updateTabContext() {
    const activeToggle = document.querySelector('.mat-button-toggle-checked');
    const activeBtn = activeToggle ? activeToggle.querySelector('button') : document.querySelector('button[aria-checked="true"]');
    if (!activeBtn) return;
    const text = activeBtn.innerText.toLowerCase();
    const isFeatured = text.includes('destacado') || text.includes('featured') || text.includes('picks') || text.includes('destacat');
    if (isFeatured) document.body.classList.add('nblm-in-featured-tab');
    else document.body.classList.remove('nblm-in-featured-tab');
    const tools = document.querySelector('.nblm-tools-container');
    if (tools) tools.style.display = isFeatured ? 'none' : 'flex';
}

function refreshInjectedTexts() {
    const tools = document.querySelector('.nblm-tools-container');
    if (tools) {
        const searchInput = tools.querySelector('.nblm-search-input');
        if (searchInput) searchInput.placeholder = t('search_placeholder');
        const manageBtn = tools.querySelector('.nblm-manage-btn');
        if (manageBtn) manageBtn.innerText = t('btn_manage_tags');
    }
}

// Sección principal de cuadernos ("Cuadernos recientes"): la barra va justo antes de ella.
// En vista de lista, "Fijados" también es un .my-projects-container, pero con cabecera de fijados.
function findToolsAnchor() {
  const container = document.querySelector('.all-projects-container');
  if (!container) return null;
  return [...container.querySelectorAll(':scope > .my-projects-container')]
      .find(section => !section.querySelector('.pinned-projects-header')) || null;
}

function injectSearchTools() {
  const existing = document.querySelector('.nblm-tools-container');
  // Dentro de un cuaderno no hay lista que organizar (y su selector de emojis es un <main>)
  if (location.pathname.includes('/notebook/')) {
      existing?.remove();
      return;
  }
  if (existing) {
      // Google reordena las secciones al cambiar entre cuadrícula y lista: recolocamos la barra
      const anchor = findToolsAnchor();
      if (anchor && existing.nextElementSibling !== anchor) anchor.before(existing);
      updateTabContext();
      return;
  }
  const featured = document.querySelector('.featured-projects-container');
  const listHeader = document.querySelector('.notebook-list-header') || document.querySelector('.projects-container-header');
  // Nunca dentro de menús o diálogos de Google (capa .cdk-overlay-container)
  const mainContent = document.querySelector('.all-projects-container') || document.querySelector('main:not(.cdk-overlay-container main)');
  if (!featured && !listHeader && !mainContent) return;
  const tools = document.createElement('div');
  tools.className = 'nblm-tools-container';
  tools.innerHTML = `
    <div class="nblm-header-row">
        <input type="text" class="nblm-search-input" style="flex:1; margin-right:12px;" placeholder="${t('search_placeholder')}">
        <button class="nblm-manage-btn">${t('btn_manage_tags')}</button>
    </div>
    <div class="nblm-filter-tags" id="nblm-filter-tags"></div>
  `;
  // Al volver de un cuaderno se crea una barra nueva: mantenemos la búsqueda que había
  tools.querySelector('input').value = searchQuery;
  let searchTimeout = null;
  tools.querySelector('input').oninput = (e) => {
      searchQuery = e.target.value.toLowerCase();
      // Agrupamos las pulsaciones: filtramos cuando el usuario hace una pausa al escribir
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => applyFilters(), 150);
  };
  tools.querySelector('.nblm-manage-btn').onclick = showManagementModal;
  const anchor = findToolsAnchor();
  if (anchor) anchor.before(tools);
  else if (featured) featured.insertAdjacentElement('afterend', tools);
  else if (listHeader) listHeader.insertAdjacentElement('afterend', tools);
  else if (mainContent) mainContent.prepend(tools);
  if (document.querySelector('.nblm-tools-container')) {
      updateTabContext();
      renderFilterTags();
  }
}

function showConfirmDialog(title, message, onConfirm, confirmBtnClass = 'nblm-btn-primary') {
    const overlay = document.createElement('div');
    overlay.className = 'nblm-modal-overlay';
    overlay.style.zIndex = '30000';
    overlay.innerHTML = `
        <div class="nblm-confirm-modal" role="alertdialog" aria-modal="true">
            <div class="nblm-confirm-title">${title}</div>
            <div class="nblm-confirm-message">${message}</div>
            <div class="nblm-confirm-actions">
                <button class="nblm-btn-cancel">${t('btn_cancel')}</button>
                <button class="${confirmBtnClass}">${t('btn_confirm')}</button>
            </div>
        </div>
    `;
    overlay.querySelector('.nblm-btn-cancel').onclick = () => overlay.remove();
    closeOnEscape(overlay, () => overlay.remove());
    overlay.querySelector(`.${confirmBtnClass}`).onclick = () => { onConfirm(); overlay.remove(); };
    document.body.appendChild(overlay);
    overlay.querySelector('.nblm-btn-cancel').focus(); // Opción segura por defecto
}

// Paleta accesible: botones (alcanzables con Tab) con nombre de color y estado pulsado
function colorPaletteHTML(current, dataAttr) {
    const isCustom = !PRESET_COLORS.includes(current);
    return PRESET_COLORS.map(c => {
        const name = t(COLOR_NAME_KEYS[c]);
        return `<button type="button" class="nblm-color-swatch ${c === current ? 'active' : ''}" style="background:${c}; --nblm-on:${getContrastText(c)}" data-${dataAttr}="${c}" aria-label="${name}" aria-pressed="${c === current}" title="${name}"></button>`;
    }).join('') + `
        <label class="nblm-custom-color-btn ${isCustom ? 'active' : ''}" style="${isCustom ? `background:${current}; color:${getContrastText(current)}` : ''}" title="${t('color_custom')}">
            <span aria-hidden="true">+</span>
            <input type="color" class="nblm-custom-color-input" value="${current}" data-${dataAttr}-custom aria-label="${t('color_custom')}">
        </label>`;
}

function showManagementModal() {
    const overlay = document.createElement('div');
    overlay.className = 'nblm-modal-overlay';
    let selectedNewColor = '#1a73e8';
    let expandedTag = null; // Etiqueta con la paleta desplegada
    let filterText = '';
    const FILTER_THRESHOLD = 6; // A partir de cuántas etiquetas se muestra el filtro

    const closeModal = () => overlay.remove();

    const showFieldError = (el, message) => {
        el.textContent = message;
        el.hidden = !message;
        clearTimeout(el._timer);
        if (message) el._timer = setTimeout(() => { el.textContent = ''; el.hidden = true; }, 4000);
    };

    const renderCreatePalette = () => {
        const palette = overlay.querySelector('.nblm-create-palette');
        palette.innerHTML = colorPaletteHTML(selectedNewColor, 'new-color');
        palette.querySelectorAll('[data-new-color]').forEach(sw => {
            sw.onclick = () => { selectedNewColor = sw.dataset.newColor; renderCreatePalette(); palette.querySelector(`[data-new-color="${selectedNewColor}"]`)?.focus(); };
        });
        palette.querySelector('[data-new-color-custom]').onchange = (e) => { selectedNewColor = e.target.value; renderCreatePalette(); };
    };

    const renderList = (tagToHighlight = null) => {
        const filterRow = overlay.querySelector('.nblm-manage-filter-row');
        filterRow.hidden = globalTags.length <= FILTER_THRESHOLD;
        if (filterRow.hidden) filterText = '';
        const query = normalizeString(filterText);
        const visibleTags = globalTags.filter(tag => !query || normalizeString(tag).includes(query));

        const list = overlay.querySelector('.nblm-manage-list');
        list.innerHTML = '';
        if (globalTags.length > 0 && visibleTags.length === 0) {
            list.innerHTML = `<div class="nblm-manage-empty">${t('modal_no_matches')}</div>`;
            return;
        }
        visibleTags.forEach(tag => {
            const item = document.createElement('div');
            item.className = 'nblm-manage-item' + (tag === tagToHighlight ? ' newly-created' : '');
            const color = getTagColor(tag);
            const count = countNotebooksWithTag(tag);
            const isExpanded = expandedTag === tag;
            item.innerHTML = `
                <div class="nblm-manage-row">
                    <button type="button" class="nblm-color-dot" style="background:${color}" aria-label="${t('modal_edit_color')}: ${escapeHTML(tag)}" aria-expanded="${isExpanded}" title="${t('modal_edit_color')}"></button>
                    <div class="nblm-tag-name-wrap">
                        <input type="text" class="nblm-tag-edit-input" value="${escapeHTML(tag)}" title="${t('modal_rename_hint')}" aria-label="${t('modal_rename_hint')}: ${escapeHTML(tag)}">
                        <span class="nblm-edit-icon">${icon('edit', 14)}</span>
                    </div>
                    <span class="nblm-tag-count">${formatNotebookCount(count)}</span>
                    <button type="button" class="nblm-btn-icon danger" title="${t('modal_btn_delete_hint')}" aria-label="${t('modal_btn_delete_hint')}: ${escapeHTML(tag)}">${icon('delete', 18)}</button>
                </div>
                <div class="nblm-field-error" role="alert" hidden></div>
                ${isExpanded ? `<div class="nblm-color-picker-container">${colorPaletteHTML(color, 'color')}</div>` : ''}
            `;
            if (tag === tagToHighlight) setTimeout(() => item.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);

            const errorEl = item.querySelector('.nblm-field-error');
            const input = item.querySelector('.nblm-tag-edit-input');
            item.querySelector('.nblm-edit-icon').onclick = () => input.focus();
            input.onblur = () => {
                const result = renameTag(tag, input.value.trim());
                if (result === 'renamed') { if (expandedTag === tag) expandedTag = input.value.trim(); renderList(); }
                else if (result !== 'unchanged') {
                    input.value = tag;
                    showFieldError(errorEl, t(result === 'empty' ? 'error_tag_empty' : 'error_tag_exists'));
                }
            };
            input.onkeydown = (e) => {
                if (e.key === 'Enter') input.blur();
                else if (e.key === 'Escape') { input.value = tag; input.blur(); }
            };

            const dot = item.querySelector('.nblm-color-dot');
            dot.onclick = () => {
                expandedTag = isExpanded ? null : tag;
                renderList();
                // Al abrir, el foco salta al color actual de la paleta; al cerrar, vuelve al punto
                const row = [...overlay.querySelectorAll('.nblm-manage-item')].find(i => i.querySelector('.nblm-tag-edit-input').defaultValue === tag);
                (isExpanded ? row?.querySelector('.nblm-color-dot') : row?.querySelector('.nblm-color-swatch.active, .nblm-custom-color-input'))?.focus();
            };
            if (isExpanded) {
                const refocus = (selector) => overlay.querySelector(selector)?.focus();
                item.querySelectorAll('[data-color]').forEach(sw => {
                    sw.onclick = () => { setTagColor(tag, sw.dataset.color); renderList(); refocus(`.nblm-manage-item [data-color="${sw.dataset.color}"]`); };
                });
                item.querySelector('[data-color-custom]').onchange = (e) => { setTagColor(tag, e.target.value); renderList(); };
            }

            item.querySelector('.danger').onclick = () => {
                const affects = count === 0 ? '' : `<br><strong>${count === 1 ? t('modal_delete_affects_one') : t('modal_delete_affects_other', count)}</strong>`;
                showConfirmDialog(t('modal_delete_confirm_title'), t('modal_delete_confirm_msg', escapeHTML(tag)) + affects, () => {
                    hasInteracted = true;
                    globalTags = globalTags.filter(t => t !== tag);
                    delete tagConfig[tag];
                    Object.keys(notebookTags).forEach(id => { notebookTags[id] = notebookTags[id].filter(t => t !== tag); });
                    if (expandedTag === tag) expandedTag = null;
                    saveAllData(); updateUI(); renderList();
                }, 'nblm-btn-danger');
            };
            list.appendChild(item);
        });
    };

    const modeLabel = { off: t('sync_mode_off'), heuristic: t('sync_mode_heuristic'), always: t('sync_mode_always') }[syncMode];
    const langOpt = (lang, label, title) =>
        `<button type="button" class="nblm-lang-opt ${uiLang === lang ? 'active' : ''}" data-lang="${lang}" aria-pressed="${uiLang === lang}" title="${title}">${label}</button>`;

    overlay.innerHTML = `
        <div class="nblm-modal" role="dialog" aria-modal="true" aria-labelledby="nblm-modal-title">
            <div class="nblm-modal-header">
                <h2 id="nblm-modal-title">${t('modal_manage_title')}</h2>
                <div class="nblm-modal-header-actions">
                    <div class="nblm-lang-selector" role="group" aria-label="${t('lang_auto')}">
                        ${langOpt('auto', '🌐', t('lang_auto'))}
                        ${langOpt('es', 'ES', t('lang_es'))}
                        ${langOpt('en', 'EN', t('lang_en'))}
                        ${langOpt('ca', 'CA', t('lang_ca'))}
                    </div>
                    <button type="button" class="nblm-btn-icon" id="nblm-export" title="${t('modal_export_help')}" aria-label="${t('modal_export_help')}">${icon('download', 20)}</button>
                    <button type="button" class="nblm-btn-icon" id="nblm-import" title="${t('modal_import_help')}" aria-label="${t('modal_import_help')}">${icon('upload', 20)}</button>
                    <button type="button" class="nblm-btn-icon nblm-modal-close" title="${t('modal_close')}" aria-label="${t('modal_close')}">${icon('close', 22)}</button>
                </div>
            </div>
            <div class="nblm-modal-body">
                <div class="nblm-manage-create-row">
                    <div class="nblm-manage-create-fields">
                        <input type="text" class="nblm-manage-create-input" placeholder="${t('modal_create_placeholder')}" aria-label="${t('modal_create_placeholder')}">
                        <button type="button" class="nblm-btn-primary">${t('modal_btn_create')}</button>
                    </div>
                    <div class="nblm-field-error" role="alert" hidden></div>
                    <div class="nblm-color-picker-container nblm-create-palette" role="group" aria-label="${t('color_custom')}"></div>
                </div>
                <div class="nblm-manage-filter-row" hidden>
                    <span class="nblm-filter-icon">${icon('search', 18)}</span>
                    <input type="text" class="nblm-manage-filter-input" placeholder="${t('modal_filter_placeholder')}" aria-label="${t('modal_filter_placeholder')}">
                </div>
                <div class="nblm-manage-list"></div>
            </div>

            ${IS_DEV_MODE ? `
                <details class="nblm-advanced ${syncMode === 'off' ? 'danger' : ''}" ${syncMode === 'off' ? 'open' : ''}>
                    <summary title="${t('modal_advanced')}">
                        <span class="nblm-advanced-icon">${icon('warning', 16)}</span>
                        <span class="nblm-advanced-text"><strong>${t('dev_mode_warning_title')}</strong> <span class="nblm-advanced-mode">· ${modeLabel}</span></span>
                        <span class="nblm-advanced-chevron">${icon('expand', 20)}</span>
                    </summary>
                    <div class="nblm-sync-settings">
                        <label class="nblm-sync-label" for="nblm-sync-mode-select">${t('settings_sync_mode_label')}</label>
                        <select id="nblm-sync-mode-select">
                            <option value="off" ${syncMode === 'off' ? 'selected' : ''}>${t('sync_mode_off')}</option>
                            <option value="heuristic" ${syncMode === 'heuristic' ? 'selected' : ''}>${t('sync_mode_heuristic')}</option>
                            <option value="always" ${syncMode === 'always' ? 'selected' : ''}>${t('sync_mode_always')}</option>
                        </select>
                    </div>
                    <div class="nblm-dev-banner ${syncMode === 'off' ? 'danger' : ''}">
                        ${syncMode === 'off' ? t('dev_mode_warning_main_msg') : t('dev_mode_warning_msg')}
                    </div>
                </details>
            ` : ''}

            <div class="nblm-modal-footer">
                ${t('attribution_created_by')} <a href="https://www.linkedin.com/in/pfelipm/" target="_blank">Pablo Felip</a> | <a href="https://github.com/pfelipm/notebooklm-organizer" target="_blank">GitHub</a>
            </div>
        </div>
    `;

    // Crear etiquetas: errores visibles y el foco se queda en el campo para crear varias seguidas
    const createInput = overlay.querySelector('.nblm-manage-create-input');
    const createError = overlay.querySelector('.nblm-manage-create-row .nblm-field-error');
    const handleCreate = () => {
        const val = createInput.value.trim();
        if (!val) { showFieldError(createError, t('error_tag_empty')); createInput.focus(); return; }
        if (globalTags.some(g => g.toLowerCase() === val.toLowerCase())) {
            showFieldError(createError, t('error_tag_exists'));
            createInput.select();
            return;
        }
        addGlobalTag(val); setTagColor(val, selectedNewColor);
        createInput.value = '';
        showFieldError(createError, '');
        const filterInput = overlay.querySelector('.nblm-manage-filter-input');
        filterText = ''; filterInput.value = '';
        renderList(val);
        createInput.focus();
    };
    overlay.querySelector('.nblm-manage-create-fields .nblm-btn-primary').onclick = handleCreate;
    createInput.onkeydown = (e) => { if (e.key === 'Enter') handleCreate(); };
    createInput.oninput = () => showFieldError(createError, '');

    overlay.querySelector('.nblm-manage-filter-input').oninput = (e) => { filterText = e.target.value; renderList(); };

    if (IS_DEV_MODE) {
        const select = overlay.querySelector('#nblm-sync-mode-select');
        const updateTooltip = (val) => {
            if (val === 'off') select.title = t('sync_mode_off_tooltip');
            else if (val === 'heuristic') select.title = t('sync_mode_heuristic_tooltip');
            else if (val === 'always') select.title = t('sync_mode_always_tooltip');
        };
        updateTooltip(syncMode);
        select.onchange = (e) => {
            syncMode = e.target.value;
            chrome.storage.local.set({ syncMode });
            // Refrescamos el modal para actualizar el aviso y el resumen de la sección avanzada
            closeModal();
            showManagementModal();
            document.querySelector('.nblm-advanced')?.setAttribute('open', '');
            document.querySelector('#nblm-sync-mode-select')?.focus();
        };
    }
    overlay.querySelectorAll('.nblm-lang-opt').forEach(opt => {
        opt.onclick = async () => {
            uiLang = opt.dataset.lang; await loadLanguage(uiLang); saveAllData();
            closeModal(); showManagementModal(); refreshInjectedTexts(); updateUI();
        };
    });
    overlay.querySelector('#nblm-export').onclick = () => {
        const data = { notebookTags, globalTags, titleToIdMap, tagConfig, filterMode };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `nblm-backup-${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(url);
    };
    overlay.querySelector('#nblm-import').onclick = () => {
        const fileInput = document.createElement('input'); fileInput.type = 'file'; fileInput.accept = '.json';
        fileInput.onchange = (e) => {
            const file = e.target.files[0]; if (!file) return;
            const reader = new FileReader();
            reader.onload = (re) => {
                try {
                    const imported = JSON.parse(re.target.result);
                    if (!imported.globalTags || !Array.isArray(imported.globalTags)) { showAlertDialog('❌', t('import_error_format_title'), t('import_error_format_msg')); return; }
                    showImportGranularModal(imported, () => { saveAllData(); updateUI(); renderList(); });
                } catch (err) { showAlertDialog('❌', t('import_error_read_title'), t('import_error_read_msg')); }
            };
            reader.readAsText(file);
        };
        fileInput.click();
    };
    overlay.querySelector('.nblm-modal-close').onclick = closeModal;
    overlay.onclick = (e) => { if (e.target === overlay) closeModal(); };
    closeOnEscape(overlay, closeModal);
    document.body.appendChild(overlay);
    renderCreatePalette();
    renderList();
    createInput.focus();
}

function showImportGranularModal(data, onComplete) {
    const overlay = document.createElement('div');
    overlay.className = 'nblm-modal-overlay';
    overlay.style.zIndex = '30001';
    overlay.innerHTML = `
        <div class="nblm-confirm-modal" style="width:400px;">
            <div class="nblm-confirm-title">${t('import_granular_title')}</div>
            <div class="nblm-confirm-message">${t('import_granular_msg')}</div>
            <div style="text-align:left; background:#f8f9fa; padding:16px; border-radius:8px; display:flex; flex-direction:column; gap:12px; margin-bottom:24px; width:100%; box-sizing:border-box;">
                <label style="display:flex; align-items:center; gap:10px; cursor:pointer; user-select:none;">
                    <input type="checkbox" id="import-opt-tags" checked style="width:16px; height:16px;">
                    <div style="display:flex; flex-direction:column;">
                        <span style="font-weight:500; font-size:13px;">${t('import_opt_tags')}</span>
                        <span style="font-size:11px; color:#5f6368;">${t('import_opt_tags_desc', data.globalTags.length)}</span>
                    </div>
                </label>
                <label style="display:flex; align-items:center; gap:10px; cursor:pointer; user-select:none;">
                    <input type="checkbox" id="import-opt-notebooks" checked style="width:16px; height:16px;">
                    <div style="display:flex; flex-direction:column;">
                        <span style="font-weight:500; font-size:13px;">${t('import_opt_notebooks')}</span>
                        <span style="font-size:11px; color:#5f6368;">${t('import_opt_notebooks_desc')}</span>
                    </div>
                </label>
            </div>
            <div class="nblm-confirm-actions">
                <button class="nblm-btn-cancel">${t('btn_cancel')}</button>
                <button class="nblm-btn-primary" id="nblm-confirm-import">${t('import_btn_confirm')}</button>
            </div>
        </div>
    `;
    overlay.querySelector('.nblm-btn-cancel').onclick = () => overlay.remove();
    closeOnEscape(overlay, () => overlay.remove());
    overlay.querySelector('#nblm-confirm-import').onclick = () => {
        hasInteracted = true;
        const importTags = overlay.querySelector('#import-opt-tags').checked;
        const importNotebooks = overlay.querySelector('#import-opt-notebooks').checked;
        if (importTags) { globalTags = data.globalTags; tagConfig = data.tagConfig || {}; }
        if (importNotebooks) { notebookTags = data.notebookTags || {}; titleToIdMap = data.titleToIdMap || {}; filterMode = data.filterMode || 'AND'; }
        overlay.remove(); onComplete(); showAlertDialog('✅', t('import_success_title'), t('import_success_msg'));
    };
    document.body.appendChild(overlay);
}

// Devuelve 'renamed', 'unchanged', 'empty' o 'duplicate' para que la interfaz pueda informar
function renameTag(oldName, newName) {
    if (oldName === newName) return 'unchanged';
    if (!newName) return 'empty';
    // Duplicado sin distinguir mayúsculas, salvo que solo cambie la capitalización de la propia etiqueta
    if (globalTags.some(g => g !== oldName && g.toLowerCase() === newName.toLowerCase())) return 'duplicate';
    hasInteracted = true;
    globalTags = globalTags.map(t => t === oldName ? newName : t);
    globalTags.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    if (tagConfig[oldName]) { tagConfig[newName] = { ...tagConfig[oldName] }; delete tagConfig[oldName]; }
    Object.keys(notebookTags).forEach(id => { notebookTags[id] = notebookTags[id].map(t => t === oldName ? newName : t); });
    if (activeFilters.has(oldName)) { activeFilters.delete(oldName); activeFilters.add(newName); }
    saveAllData(); updateUI();
    return 'renamed';
}

function setTagColor(tag, color) {
    hasInteracted = true;
    if (!tagConfig[tag]) tagConfig[tag] = {};
    tagConfig[tag].color = color;
    saveAllData(); updateUI();
}

function renderFilterTags() {
  const container = document.getElementById('nblm-filter-tags');
  if (!container) return;
  container.innerHTML = '';
  globalTags.forEach(tag => {
    const tagEl = document.createElement('span');
    const isActive = activeFilters.has(tag);
    tagEl.className = `nblm-filter-tag ${isActive ? 'active' : ''}`;
    if (isActive) { tagEl.style.backgroundColor = getTagColor(tag); tagEl.style.color = getContrastText(getTagColor(tag)); tagEl.style.borderColor = 'transparent'; }
    tagEl.innerText = tag;
    tagEl.onclick = () => { if (isActive) activeFilters.delete(tag); else activeFilters.add(tag); updateUI(); };
    container.appendChild(tagEl);
  });
  if (activeFilters.size > 0) {
      const modeToggle = document.createElement('div');
      modeToggle.className = 'nblm-filter-mode-toggle';
      modeToggle.innerHTML = `
          <div class="nblm-mode-btn ${filterMode === 'AND' ? 'active' : ''}" data-mode="AND">${t('filter_mode_and')}</div>
          <div class="nblm-mode-btn ${filterMode === 'OR' ? 'active' : ''}" data-mode="OR">${t('filter_mode_or')}</div>
      `;
      modeToggle.querySelectorAll('.nblm-mode-btn').forEach(btn => { btn.onclick = () => { filterMode = btn.dataset.mode; updateUI(); }; });
      container.appendChild(modeToggle);
      const clearBtn = document.createElement('div');
      clearBtn.className = 'nblm-clear-filters';
      clearBtn.innerHTML = `<span>×</span> ${t('filter_clear')}`;
      clearBtn.onclick = () => { activeFilters.clear(); updateUI(); };
      container.appendChild(clearBtn);
  }
}

function applyFilters(scan = scanNotebooks()) {
  const filterArray = Array.from(activeFilters);
  // Fase de lectura: decidimos la visibilidad de todos los cuadernos sin modificar el DOM
  const decisions = [];
  document.querySelectorAll('.nblm-processed').forEach(node => {
    const id = getResolvedId(node, scan.isCollision(node));
    const tags = notebookTags[id] || [];
    const matchesSearch = !searchQuery || node.innerText.toLowerCase().includes(searchQuery);
    let matchesTags = true;
    if (filterArray.length > 0) {
        if (filterMode === 'AND') matchesTags = filterArray.every(f => tags.includes(f));
        else matchesTags = filterArray.some(f => tags.includes(f));
    }
    decisions.push({ node, display: (matchesSearch && matchesTags) ? '' : 'none' });
  });
  // Fase de escritura
  decisions.forEach(({ node, display }) => { if (node.style.display !== display) node.style.display = display; });
}

function showFullTagsTooltip(anchor, id, sticky) {
    if (id?.startsWith('collision:')) return;
    closeTooltip();
    const tooltip = document.createElement('div');
    tooltip.className = 'nblm-tags-tooltip';
    tooltip.dataset.id = id;
    if (sticky) tooltip.dataset.sticky = 'true';
    tooltip.onmouseenter = () => { tooltip.dataset.hovered = 'true'; };
    tooltip.onmouseleave = () => { tooltip.dataset.hovered = 'false'; if (tooltip.dataset.sticky !== 'true') closeTooltip(); };
    const rect = anchor.getBoundingClientRect();
    tooltip.style.top = `${rect.bottom + window.scrollY}px`;
    tooltip.style.left = `${rect.left + window.scrollX}px`;
    (notebookTags[id] || []).forEach(t => tooltip.appendChild(createTagElement(t, id, true)));
    document.body.appendChild(tooltip);
    activeTooltip = tooltip;
}

function closeTooltip() { if (activeTooltip) { activeTooltip.remove(); activeTooltip = null; } }

// Sincroniza la vista flotante tras un cambio de etiquetas. Al redibujar la tarjeta, la etiqueta
// bajo el puntero se sustituye y el navegador no dispara mouseleave sobre un elemento eliminado.
function refreshTooltip() {
    if (!activeTooltip) return;
    const id = activeTooltip.dataset.id;
    const tags = notebookTags[id] || [];
    const inUse = activeTooltip.dataset.sticky === 'true' || activeTooltip.dataset.hovered === 'true';
    // Vista de paso (hover) sobre una tarjeta redibujada: la cerramos; si otra etiqueta queda bajo
    // el puntero, su mouseenter la volverá a abrir con los datos actualizados
    if (tags.length === 0 || !inUse) { closeTooltip(); return; }
    activeTooltip.replaceChildren(...tags.map(tag => createTagElement(tag, id, true)));
}
function closePopover() { if (currentPopover) { currentPopover.remove(); currentPopover = null; } }
function addGlobalTag(tag) { 
    if (!globalTags.includes(tag)) { 
        hasInteracted = true;
        globalTags.push(tag); 
        globalTags.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })); 
        saveAllData(); renderFilterTags(); 
    } 
}

function showTagPopover(id) {
    closePopover();
    const overlay = document.createElement('div');
    overlay.className = 'nblm-modal-overlay';
    overlay.style.zIndex = '30000';
    const pop = document.createElement('div');
    pop.className = 'nblm-popover';
    pop.style.top = '50%'; pop.style.left = '50%'; pop.style.transform = 'translate(-50%, -50%)';
    pop.innerHTML = `
        <div class="nblm-popover-header">
             <div style="display:flex;justify-content:space-between;margin-bottom:12px;">
                <span class="nblm-popover-title">${t('popover_title')}</span>
                <span id="nblm-close" style="cursor:pointer;font-size:18px;">&times;</span>
             </div>
             <input type="text" id="nblm-in" placeholder="${t('popover_search_placeholder')}" autofocus style="width:100%; box-sizing:border-box;">
        </div>
        <div class="tag-list" id="nblm-list"></div>
        <div id="nblm-create"></div>
    `;
    const close = () => { overlay.remove(); currentPopover = null; };
    closeOnEscape(overlay, close);
    pop.querySelector('#nblm-close').onclick = close;
    overlay.onclick = (e) => { if (e.target === overlay) close(); };
    const input = pop.querySelector('#nblm-in');
    const render = () => {
        const q = input.value.toLowerCase();
        const listContainer = pop.querySelector('#nblm-list');
        listContainer.innerHTML = '';
        [...globalTags].filter(t => t.toLowerCase().includes(q))
            .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
            .forEach(t => {
                const item = document.createElement('div');
                const isChecked = (notebookTags[id] || []).includes(t);
                item.className = `nblm-check-item ${isChecked ? 'checked' : ''}`;
                const color = getTagColor(t);
                item.innerHTML = `
                    <div class="nblm-check-icon" style="border-color:${color}; background:${isChecked ? color : 'transparent'}"></div>
                    <span class="nblm-tag" style="background-color:${color}; color:${getContrastText(color)}; cursor:pointer; max-width:160px;">${escapeHTML(t)}</span>
                `;
                item.onclick = (e) => { e.stopPropagation(); toggleTag(id, t); render(); input.focus(); };
                listContainer.appendChild(item);
            });
        const showCreate = q && !globalTags.some(t => t.toLowerCase() === q);
        if (showCreate) {
            const createOpt = document.createElement('div');
            createOpt.className = 'nblm-create-option';
            createOpt.innerHTML = `<span>${t('popover_create_tag')}</span> <span class="nblm-tag" style="background-color:#1a73e8; color:${getContrastText('#1a73e8')}; margin-left:4px;">${escapeHTML(input.value)}</span>`;
            createOpt.onclick = () => { const newTag = input.value.trim(); addGlobalTag(newTag); toggleTag(id, newTag); input.value = ''; render(); };
            pop.querySelector('#nblm-create').innerHTML = ''; pop.querySelector('#nblm-create').appendChild(createOpt);
        } else pop.querySelector('#nblm-create').innerHTML = '';
    };
    input.oninput = render;
    input.onkeyup = (e) => { 
        if (e.key === 'Enter') {
            const val = input.value.trim(); if (!val) return;
            const existing = globalTags.find(t => t.toLowerCase() === val.toLowerCase());
            if (existing) { toggleTag(id, existing); input.value = ''; render(); }
            else { addGlobalTag(val); toggleTag(id, val); input.value = ''; render(); }
        }
    };
    overlay.appendChild(pop);
    document.body.appendChild(overlay);
    currentPopover = overlay;
    render();
    // `autofocus` no actúa en elementos insertados tras la carga: sin esto, lo tecleado iría a la página
    input.focus();
}

// 6. INICIALIZACIÓN
function init() {
  const observer = new MutationObserver((mutations) => {
    let shouldProcess = false;
    for (let m of mutations) { if (m.addedNodes.length > 0) { shouldProcess = true; break; } }
    if (shouldProcess) processNewNodes();
    injectSearchTools();
    for (let m of mutations) {
        for (let node of m.addedNodes) {
            if (node.nodeType === 1 && (node.classList.contains('cdk-overlay-pane') || node.querySelector('.mat-mdc-menu-content'))) injectMenuItem(node);
        }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  document.addEventListener('mousedown', (e) => {
      const btn = e.target.closest('.project-button-more, button[aria-haspopup="menu"], button[aria-label*="Menú"]');
      if (btn) {
          const row = btn.closest('project-button, tr, [role="row"]');
          if (row) lastClickedNotebookId = getResolvedId(row, scanNotebooks().isCollision(row));
      }
  });
  document.addEventListener('click', (e) => {
    if (activeTooltip && !activeTooltip.contains(e.target) && !e.target.closest('.nblm-tag-container')) closeTooltip();
  });
  processNewNodes(); injectSearchTools();
  setInterval(processNewNodes, 3000); setInterval(injectSearchTools, 5000);
}

function showConflictDialog(localRes, syncRes, onDecision) {
    const overlay = document.createElement('div');
    overlay.className = 'nblm-modal-overlay';
    overlay.style.zIndex = '40000';

    const getMetrics = (data) => {
        const globalTagsCount = data.globalTags?.length || 0;
        const notebookTags = data.notebookTags || {};
        const uniqueNotebooks = Object.keys(notebookTags).length;
        const totalAssignments = Object.values(notebookTags).reduce((sum, tags) => sum + (tags?.length || 0), 0);
        const lastDate = data.lastUpdated ? new Date(data.lastUpdated).toLocaleString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : t('conflict_no_data') || '---';
        return { globalTagsCount, uniqueNotebooks, totalAssignments, lastDate };
    };

    const localM = getMetrics(localRes);
    const syncM = getMetrics(syncRes);
    const hasCloudData = syncM.globalTagsCount > 0;

    overlay.innerHTML = `
        <div class="nblm-confirm-modal" style="width: 500px; max-width: 90vw;">
            <div class="nblm-alert-icon" style="margin-bottom: 16px;">⚠️</div>
            <div class="nblm-confirm-title" style="margin-bottom: 12px;">${t('conflict_title')}</div>
            <div class="nblm-confirm-message" style="margin-bottom: 20px; text-align: left;">${t('conflict_msg')}</div>
            
            <table class="nblm-conflict-table" style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px;">
                <thead>
                    <tr style="border-bottom: 2px solid #e0e0e0;">
                        <th style="text-align: left; padding: 8px;">${t('conflict_metric_label')}</th>
                        <th style="text-align: right; padding: 8px;">${t('conflict_local_label')}</th>
                        <th style="text-align: right; padding: 8px;">${t('conflict_cloud_label')}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr style="border-bottom: 1px solid #f0f0f0;">
                        <td style="padding: 8px;">${t('conflict_global_tags')}</td>
                        <td style="text-align: right; padding: 8px; font-weight: 500;">${localM.globalTagsCount}</td>
                        <td style="text-align: right; padding: 8px; font-weight: 500;">${syncM.globalTagsCount}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #f0f0f0;">
                        <td style="padding: 8px;">${t('conflict_unique_notebooks')}</td>
                        <td style="text-align: right; padding: 8px; font-weight: 500;">${localM.uniqueNotebooks}</td>
                        <td style="text-align: right; padding: 8px; font-weight: 500;">${syncM.uniqueNotebooks}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #f0f0f0;">
                        <td style="padding: 8px;">${t('conflict_total_assignments')}</td>
                        <td style="text-align: right; padding: 8px; font-weight: 500;">${localM.totalAssignments}</td>
                        <td style="text-align: right; padding: 8px; font-weight: 500;">${syncM.totalAssignments}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px;">${t('conflict_last_updated')}</td>
                        <td style="text-align: right; padding: 8px; font-size: 11px; color: #5f6368;">${localM.lastDate}</td>
                        <td style="text-align: right; padding: 8px; font-size: 11px; color: #5f6368;">${syncM.lastDate}</td>
                    </tr>
                </tbody>
            </table>

            <div class="nblm-confirm-actions" style="flex-direction: column; gap: 10px;">
                ${hasCloudData ? `<button class="nblm-btn-primary" id="merge-data" style="width: 100%;">${t('conflict_btn_merge')}</button>` : ''}
                <button class="${hasCloudData ? 'nblm-btn-cancel' : 'nblm-btn-primary'}" id="keep-local" style="width: 100%; border: 1px solid #dadce0;">${t('conflict_btn_keep_local_only')}</button>
                <button class="nblm-btn-cancel" id="accept-cloud" style="width: 100%; border: 1px solid #dadce0;">${t('conflict_btn_accept_cloud')}</button>
            </div>
        </div>
    `;

    if (hasCloudData) overlay.querySelector('#merge-data').onclick = () => { onDecision('merge'); overlay.remove(); };
    overlay.querySelector('#keep-local').onclick = () => { onDecision('local'); overlay.remove(); };
    overlay.querySelector('#accept-cloud').onclick = () => { onDecision('cloud'); overlay.remove(); };
    document.body.appendChild(overlay);
}

// 7. ARRANQUE
async function start() {
    // 1. Lectura simultánea de ambos almacenamientos
    const syncDataRaw = await new Promise(r => chrome.storage.sync.get(null, r));
    const localRes = await new Promise(r => chrome.storage.local.get(['notebookTags', 'globalTags', 'titleToIdMap', 'tagConfig', 'filterMode', 'uiLang', 'lastUpdated', 'syncMode'], r));

    // 2. Reconstrucción de datos de la nube
    let syncRes = {};
    if (syncDataRaw && syncDataRaw._chunk_count) {
        let fullJson = "";
        for (let i = 0; i < syncDataRaw._chunk_count; i++) fullJson += syncDataRaw[`_chunk_${i}`] || "";
        try { syncRes = JSON.parse(fullJson); } catch (e) { console.error("Error reconstruyendo datos de Sync:", e); }
    }

    const syncTS = syncRes.lastUpdated || 0;
    const localTS = localRes.lastUpdated || 0;
    syncMode = localRes.syncMode || 'heuristic'; // Recuperamos el modo persistido en local

    // 3. Lógica de resolución de conflictos y resurrección (Especial para Modo Dev)
    const applyData = (data, source) => {
        notebookTags = data.notebookTags || {};
        globalTags = data.globalTags || [];
        titleToIdMap = data.titleToIdMap || {};
        tagConfig = data.tagConfig || {};
        filterMode = data.filterMode || 'AND';
        uiLang = data.uiLang || 'auto';
        lastUpdated = data.lastUpdated || (source === 'local' ? localTS : syncTS);
    };

    if (IS_DEV_MODE && syncMode !== 'off') {
        const syncM = { 
            tags: syncRes.globalTags?.length || 0, 
            notes: Object.keys(syncRes.notebookTags || {}).length,
            assigns: Object.values(syncRes.notebookTags || {}).reduce((s, t) => s + (t?.length || 0), 0)
        };
        const localM = { 
            tags: localRes.globalTags?.length || 0, 
            notes: Object.keys(localRes.notebookTags || {}).length,
            assigns: Object.values(localRes.notebookTags || {}).reduce((s, t) => s + (t?.length || 0), 0)
        };
        
        const hasMassiveLoss = (localM.tags >= 3) && (syncM.tags <= localM.tags / 2);
        const isCloudSuspect = (syncTS > localTS) && hasMassiveLoss;
        const isCloudEmpty = (syncM.tags === 0) && (localM.tags > 0);
        
        // Condición para el modo "always": cualquier discrepancia en las métricas principales
        const hasDiscrepancy = syncM.tags !== localM.tags || syncM.notes !== localM.notes || syncM.assigns !== localM.assigns;
        const forceDialog = (syncMode === 'always' && hasDiscrepancy);

        if (isCloudSuspect || isCloudEmpty || forceDialog) {
            // CONFLICTO DETECTADO (o modo Manual activado)
            showConflictDialog(localRes, syncRes, (decision) => {
                if (decision === 'merge') {
                    // UNIÓN: Fusionamos ambos
                    globalTags = [...new Set([...(syncRes.globalTags || []), ...(localRes.globalTags || [])])].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
                    notebookTags = { ...(localRes.notebookTags || {}) };
                    Object.keys(syncRes.notebookTags || {}).forEach(id => {
                        notebookTags[id] = [...new Set([...(notebookTags[id] || []), ...syncRes.notebookTags[id]])];
                    });
                    titleToIdMap = { ...(localRes.titleToIdMap || {}), ...(syncRes.titleToIdMap || {}) };
                    tagConfig = { ...(localRes.tagConfig || {}), ...(syncRes.tagConfig || {}) };
                    filterMode = localRes.filterMode || syncRes.filterMode || 'AND';
                    uiLang = localRes.uiLang || 'auto';
                    lastUpdated = Math.max(syncTS, localTS);
                    hasInteracted = true; 
                    saveAllData(); 
                } else if (decision === 'local') {
                    // RECUPERAR: El local machaca a la nube
                    applyData(localRes, 'local');
                    hasInteracted = true;
                    saveAllData();
                } else {
                    // BORRADO: La nube machaca a local
                    applyData(syncRes, 'cloud');
                    chrome.storage.local.set({ notebookTags, globalTags, titleToIdMap, tagConfig, filterMode, uiLang, lastUpdated });
                }
                loadLanguage(uiLang).then(() => init());
            });
            return; // Detenemos start normal mientras se decide
        } else if (localTS > syncTS) {
            applyData(localRes, 'local');
            hasInteracted = true; 
            saveAllData(); 
        } else {
            applyData(syncRes, 'cloud');
        }
    } else {
        applyData(syncRes, 'cloud');
    }

    await loadLanguage(uiLang);
    init();
}

start();
