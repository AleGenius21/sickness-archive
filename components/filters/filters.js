/**
 * Filter Bar Component - Logica di filtraggio e ordinamento
 */

// Configurazione API
const API_BASE_URL = 'https://my-genius.it/wp-json/genius/v1';
const API_ENDPOINT = '/get_leaves'; // Endpoint per recuperare i dati (può essere adattato)
const API_TIMEOUT = 30000; // 30 secondi
const API_BEARER_TOKEN = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpYXQiOjE3Njg5MDc0MjMsImV4cCI6MTc3MDYzNTQyMywidWlkIjoyNjg1LCJ1c2VybmFtZSI6IkdOR01aTzA0RTEzWjM1NEUifQ.3AV7DDRUf1AgRJyPh_cvDd3u9_Gf7-YOSEX-KfUIAEg';


// Riferimenti globali
let allRequestsData = [];
let filteredRequestsData = [];
let filterOptionsData = []; // Dati completi per popolare le opzioni dei filtri (immutabili)
let filterBarLoaded = false; // Flag per verificare se il componente è stato caricato
let cachedConfigData = null; // Cache della configurazione iniziale dei filtri
// Variabile globale per il periodo selezionato dal calendario
window.selectedPeriod = null;
// Variabile globale per debounce ricerca
let searchDebounceTimer = null;

// Esponi variabili globalmente per accesso da altri componenti
window.allRequestsData = allRequestsData;
window.filteredRequestsData = filteredRequestsData;

/**
 * Recupera la configurazione dello schermo admin per i certificati di malattia
 * @returns {Promise<Object>} Promise che risolve con l'oggetto di configurazione
 */
async function fetchLeaveAdminScreenConfig() {
    try {
        const url = `${API_BASE_URL}/leave_admin_screen_config`;
        console.log('[FILTERS] Chiamata a /leave_admin_screen_config:', url);
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_BEARER_TOKEN}`
            }
        });

        if (!response.ok) {
            throw new Error(`Errore HTTP: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();

        // Verifica struttura risposta API
        if (!result || typeof result !== 'object') {
            throw new Error('Risposta API non valida: formato non riconosciuto');
        }

        console.log('[FILTERS] Configurazione ricevuta:', result);
        return result;
    } catch (error) {
        console.error('[FILTERS] Errore nel recupero della configurazione:', error);
        throw error;
    }
}

/**
 * Carica dinamicamente il contenuto HTML del componente filter bar
 * @returns {Promise} Promise che si risolve quando il contenuto è stato caricato
 */
async function loadFilterBarHTML() {
    // Se il componente è già presente nel DOM, non ricaricarlo
    const existingContainer = document.querySelector('.filter-bar-container');
    if (existingContainer && filterBarLoaded) {
        return Promise.resolve();
    }

    const container = document.getElementById('filterBarContainer');
    if (!container) {
        console.error('FilterBarContainer non trovato nel DOM');
        return Promise.reject('FilterBarContainer non trovato');
    }

    try {
        const response = await fetch('components/filters/filters.html');
        if (!response.ok) {
            throw new Error(`Errore nel caricamento: ${response.status}`);
        }
        const html = await response.text();
        container.innerHTML = html;
        filterBarLoaded = true;
        return Promise.resolve();
    } catch (error) {
        console.error('Errore nel caricamento del componente filter bar:', error);
        return Promise.reject(error);
    }
}

/**
 * Costruisce i parametri API dai filtri UI
 * @returns {Object} Oggetto con i parametri per la chiamata API
 */
function buildApiParams() {
    const params = {};

    // Ricerca testuale (nome)
    const searchInput = document.getElementById('filterSearch');
    if (searchInput && searchInput.value.trim()) {
        params.nome = searchInput.value.trim();
    }

    // Tipo (type_id) - estrae da attributo data-type-id
    const typeSelect = document.getElementById('filterType');
    if (typeSelect && typeSelect.value) {
        const typeOption = typeSelect.selectedOptions[0];
        if (typeOption) {
            // Prova a leggere l'ID dall'attributo data-type-id
            const typeIdAttr = typeOption.getAttribute('data-type-id');
            if (typeIdAttr) {
                params.type_id = parseInt(typeIdAttr, 10);
            } else {
                // Fallback: mappa il nome all'ID
                const typeName = typeSelect.value;
                const typeMap = {
                    'Ferie': 1,
                    'FERIE': 1,
                    'Permessi': 2,
                    'Permesso': 2,
                    'PERMESSO': 2,
                    'PERMESSI': 2
                };
                const mappedId = typeMap[typeName];
                if (mappedId) {
                    params.type_id = mappedId;
                }
            }
        }
    }

    // Reparto (department_id) - estrae da attributo data-department-id
    const repartoSelect = document.getElementById('filterReparto');
    if (repartoSelect && repartoSelect.value) {
        const repartoOption = repartoSelect.selectedOptions[0];
        if (repartoOption) {
            const deptId = repartoOption.getAttribute('data-department-id');
            if (deptId) {
                params.department_id = parseInt(deptId, 10);
            } else {
                // Fallback: cerca l'ID nei dati iniziali
                const repartoName = repartoSelect.value;
                const repartoItem = allRequestsData.find(req => 
                    (req.department_name || req.reparto) === repartoName
                );
                if (repartoItem && repartoItem.department_id) {
                    params.department_id = repartoItem.department_id;
                }
            }
        }
    }

    // Mansione (task_id) - estrae da attributo data-task-id
    const mansioneSelect = document.getElementById('filterMansione');
    if (mansioneSelect && mansioneSelect.value) {
        const mansioneOption = mansioneSelect.selectedOptions[0];
        if (mansioneOption) {
            const taskId = mansioneOption.getAttribute('data-task-id');
            if (taskId) {
                params.task_id = parseInt(taskId, 10);
            } else {
                // Fallback: cerca l'ID nei dati iniziali
                const mansioneName = mansioneSelect.value;
                const mansioneItem = allRequestsData.find(req => 
                    (req.task_name || req.mansione) === mansioneName
                );
                if (mansioneItem && mansioneItem.task_id) {
                    params.task_id = mansioneItem.task_id;
                }
            }
        }
    }

    // Periodo (data_inizio e data_fine) - da window.selectedPeriod
    if (window.selectedPeriod && window.selectedPeriod.startDate && window.selectedPeriod.endDate) {
        const startDate = new Date(window.selectedPeriod.startDate);
        const endDate = new Date(window.selectedPeriod.endDate);
        
        // Formatta in YYYY-MM-DD
        const formatDate = (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };
        
        params.data_inizio = formatDate(startDate);
        params.data_fine = formatDate(endDate);
    }

    // Ordinamento
    const sortSelect = document.getElementById('filterSort');
    if (sortSelect && sortSelect.value) {
        const sortValue = sortSelect.value;
        if (sortValue === 'data-recente') {
            // Richiesta più recente: ordina per dataInizio desc
            params.sort_by = 'dataInizio';
            params.sort_order = 'desc';
        } else if (sortValue === 'urgenza-decrescente') {
            // Richiesta meno recente: ordina per dataInizio asc
            params.sort_by = 'dataInizio';
            params.sort_order = 'asc';
        }
    }

    return params;
}

/**
 * Esegue chiamata API per ottenere richieste filtrate
 * PER ORA USA MOCK DATA da window.allCalendarData
 * @param {Object} params - Parametri per la chiamata API
 * @returns {Promise<Array>} Promise che si risolve con array di richieste
 */
async function fetchLeavesRequestsWithFilters(params) {
    try {
        // COMMENTATO PER ORA - USA MOCK DATA
        /*
        // Costruisce query string con URLSearchParams
        const queryParams = new URLSearchParams();
        
        // Aggiunge altri parametri
        if (params.nome) {
            queryParams.append('nome', params.nome);
        }
        if (params.type_id !== undefined) {
            queryParams.append('type_id', params.type_id.toString());
        }
        if (params.department_id !== undefined) {
            queryParams.append('department_id', params.department_id.toString());
        }
        if (params.task_id !== undefined) {
            queryParams.append('task_id', params.task_id.toString());
        }
        if (params.data_inizio) {
            queryParams.append('data_inizio', params.data_inizio);
        }
        if (params.data_fine) {
            queryParams.append('data_fine', params.data_fine);
        }
        if (params.sort_by) {
            queryParams.append('sort_by', params.sort_by);
        }
        if (params.sort_order) {
            queryParams.append('sort_order', params.sort_order);
        }
        
        // Costruisce URL completo
        const url = `${API_BASE_URL}${API_ENDPOINT}?${queryParams.toString()}`;
        
        // Log URL chiamato
        console.log('🔵 API Request URL:', url);
        
        // Esegue fetch con timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_BEARER_TOKEN}`
            },
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`Errore API: ${response.status} ${response.statusText}`);
        }
        
        const result = await response.json();
        
        // Log risposta API
        console.log('🟢 API Response:', result);

        
        // Gestisce nuova struttura API con items, filters e meta
        let finalData = [];
        if (result && typeof result === 'object') {
            // Nuova struttura: { items: [...], filters: {...}, meta: {...} }
            if (result.items && Array.isArray(result.items)) {
                finalData = result.items;
            }
            // Fallback per compatibilità con vecchia struttura
            else if (result.success !== undefined && result.data) {
                finalData = Array.isArray(result.data) ? result.data : [];
            } else if (Array.isArray(result)) {
                finalData = result;
            } else {
                throw new Error('Formato risposta API non riconosciuto');
            }
        }

        
        return finalData;
        */
        
        // ===== USA MOCK DATA =====
        console.log('[FILTERS] Usando mock data da window.allCalendarData');
        
        // Ottieni tutti i dati dal mockdata caricato
        let data = window.allCalendarData || [];
        
        if (data.length === 0) {
            console.warn('[FILTERS] Nessun dato disponibile in window.allCalendarData');
            return [];
        }
        
        // 1. FILTRA SOLO MALATTIA
        data = data.filter(item => {
            const isMalattia = item.type_name === 'MALATTIA' || 
                              item.tipo_richiesta === 'MALATTIA' ||
                              item.type === 1;
            return isMalattia;
        });
        
        console.log('[FILTERS] Dopo filtro MALATTIA:', data.length, 'items');
        
        // 2. FILTRA PER NOME (se specificato)
        if (params.nome && params.nome.trim()) {
            const searchTerm = params.nome.trim().toLowerCase();
            data = data.filter(item => {
                const nominativo = (item.nominativo || '').toLowerCase();
                return nominativo.includes(searchTerm);
            });
        }
        
        // 3. FILTRA PER TYPE_ID (se specificato)
        if (params.type_id !== undefined) {
            data = data.filter(item => item.type === params.type_id || item.type_id === params.type_id);
        }
        
        // 4. FILTRA PER DEPARTMENT_ID (se specificato)
        if (params.department_id !== undefined) {
            data = data.filter(item => item.department_id === params.department_id);
        }
        
        // 5. FILTRA PER TASK_ID (se specificato)
        if (params.task_id !== undefined) {
            data = data.filter(item => item.task_id === params.task_id);
        }
        
        // 6. FILTRA PER PERIODO (se specificato)
        if (params.data_inizio && params.data_fine) {
            const startDate = new Date(params.data_inizio + 'T00:00:00');
            const endDate = new Date(params.data_fine + 'T23:59:59');
            startDate.setHours(0, 0, 0, 0);
            endDate.setHours(23, 59, 59, 999);
            
            data = data.filter(item => {
                // Controlla dataInizio e dataFine
                const itemStartDate = item.dataInizio ? new Date(item.dataInizio + 'T00:00:00') : null;
                const itemEndDate = item.dataFine ? new Date(item.dataFine + 'T00:00:00') : null;
                
                if (itemStartDate && !isNaN(itemStartDate.getTime())) {
                    itemStartDate.setHours(0, 0, 0, 0);
                    
                    // Se c'è solo dataInizio, controlla se cade nel periodo
                    if (!itemEndDate || isNaN(itemEndDate.getTime())) {
                        if (itemStartDate >= startDate && itemStartDate <= endDate) {
                            return true;
                        }
                    } else {
                        // Se c'è un range, controlla se si sovrappone al periodo selezionato
                        itemEndDate.setHours(23, 59, 59, 999);
                        // Sovrapposizione: inizio item <= fine periodo E fine item >= inizio periodo
                        if (itemStartDate <= endDate && itemEndDate >= startDate) {
                            return true;
                        }
                    }
                }
                
                return false;
            });
        }
        
        // 7. ORDINAMENTO
        if (params.sort_by === 'dataInizio') {
            data.sort((a, b) => {
                const dateA = new Date(a.dataInizio || '1970-01-01');
                const dateB = new Date(b.dataInizio || '1970-01-01');
                
                if (params.sort_order === 'desc') {
                    return dateB - dateA; // Più recente prima
                } else {
                    return dateA - dateB; // Meno recente prima
                }
            });
        }
        
        console.log('[FILTERS] Risultati finali:', data.length, 'items');
        
        return data;
        
    } catch (error) {
        console.error('[FILTERS] Errore nel filtraggio mock data:', error);
        throw error;
    }
}

/**
 * Inizializza il componente Filter Bar
 * @param {Array} requestsData - Array completo dei dati delle richieste (deprecato - non più utilizzato)
 */
async function initFilterBar(requestsData = []) {
    // Carica il contenuto HTML
    try {
        await loadFilterBarHTML();
    } catch (error) {
        console.error('Impossibile caricare il componente filter bar:', error);
        return;
    }

    // Setup event listeners
    setupFilterListeners();

    // 1. DISABILITA TUTTO ALL'AVVIO
    setFiltersEnabled(false);

    // Carica configurazione filtri
    let configData = null;
    try {
        showFilterSpinner();
        configData = await fetchLeaveAdminScreenConfig();
        
        if (configData && typeof configData === 'object') {
            cachedConfigData = configData; // Cache config per successivi reset
            buildFiltersFromConfig(configData);
        } else {
            // Fallback se config fallisce
            if (allRequestsData.length > 0) {
                updateFilterOptions(allRequestsData);
            }
        }
    } catch (error) {
        console.warn('Errore config, uso fallback:', error);
        if (allRequestsData.length > 0) {
            updateFilterOptions(allRequestsData);
        }
    } finally {
        hideFilterSpinner();
        
        // 2. CRUCIALE: Assicura che i filtri rimangano disabilitati dopo il caricamento della config
        // Verranno abilitati SOLO se c'è un periodo selezionato E i dati sono stati caricati
        if (!window.selectedPeriod || !window.selectedPeriod.startDate) {
            setFiltersEnabled(false); 
            showPeriodSelectionMessage();
            return;
        }
    }

    // Se arriviamo qui, c'era già un periodo selezionato (es. ricaricamento stato)
    try {
        handleFilterChange(); // Questo abiliterà i filtri solo a successo avvenuto
    } catch (error) {
        console.error('Errore init:', error);
        showEmptyStateMessage();
    }
}

/**
 * Estrae valori univoci da un array di oggetti per una chiave specificata
 * @param {Array} data - Array di oggetti da analizzare
 * @param {string} key - Chiave dell'oggetto da cui estrarre i valori
 * @returns {Array} Array di valori univoci ordinati alfabeticamente
 */
function getUniqueValues(data, key) {
    if (!Array.isArray(data) || data.length === 0) {
        return [];
    }

    // Estrae tutti i valori per la chiave specificata
    const values = data
        .map(item => item[key])
        .filter(value => value !== null && value !== undefined && value !== '') // Filtra null, undefined e stringhe vuote
        .map(value => String(value).trim()) // Converte in stringa e rimuove spazi
        .filter(value => value !== ''); // Filtra stringhe vuote dopo il trim

    // Rimuove duplicati usando Set e ordina alfabeticamente
    const uniqueValues = [...new Set(values)].sort((a, b) => {
        return a.localeCompare(b, 'it', { sensitivity: 'base' });
    });

    return uniqueValues;
}

/**
 * Estrae valori univoci con i loro ID corrispondenti
 * @param {Array} data - Array di oggetti da analizzare
 * @param {string} nameKey - Chiave del nome (es. 'department_name')
 * @param {string} idKey - Chiave dell'ID (es. 'department_id')
 * @param {string} fallbackNameKey - Chiave fallback per il nome (retrocompatibilità)
 * @returns {Array} Array di oggetti {name: string, id: number|null} ordinati alfabeticamente
 */
function getUniqueValuesWithIds(data, nameKey, idKey, fallbackNameKey = null) {
    if (!Array.isArray(data) || data.length === 0) {
        return [];
    }

    // Crea una mappa nome -> ID (usa il primo ID trovato per ogni nome)
    const nameToIdMap = new Map();

    data.forEach(item => {
        const name = item[nameKey] || (fallbackNameKey ? item[fallbackNameKey] : null);
        const id = item[idKey] || null;

        if (name !== null && name !== undefined && name !== '') {
            const nameStr = String(name).trim();
            if (nameStr !== '') {
                // Se non abbiamo ancora un ID per questo nome, salvalo
                if (!nameToIdMap.has(nameStr)) {
                    nameToIdMap.set(nameStr, id);
                } else {
                    // Se abbiamo già un ID ma questo è diverso e valido, preferisci quello valido
                    const existingId = nameToIdMap.get(nameStr);
                    if ((existingId === null || existingId === undefined) && id !== null && id !== undefined) {
                        nameToIdMap.set(nameStr, id);
                    }
                }
            }
        }
    });

    // Converti in array e ordina alfabeticamente
    const result = Array.from(nameToIdMap.entries())
        .map(([name, id]) => ({ name, id }))
        .sort((a, b) => a.name.localeCompare(b.name, 'it', { sensitivity: 'base' }));

    return result;
}

/**
 * Conta i reparti unici dai dati delle richieste
 * @param {Array} requestsData - Array di dati delle richieste
 * @returns {number} Numero di reparti unici (escludendo null/vuoti)
 */
function countUniqueReparti(requestsData) {
    if (!Array.isArray(requestsData) || requestsData.length === 0) {
        return 0;
    }
    const repartiSet = new Set();
    requestsData.forEach(item => {
        const reparto = item.department_name || item.reparto;
        if (reparto && String(reparto).trim() !== '') {
            repartiSet.add(String(reparto).trim());
        }
    });
    return repartiSet.size;
}

/**
 * Conta le mansioni uniche dai dati delle richieste
 * @param {Array} requestsData - Array di dati delle richieste
 * @returns {number} Numero di mansioni uniche (escludendo null/vuoti)
 */
function countUniqueMansioni(requestsData) {
    if (!Array.isArray(requestsData) || requestsData.length === 0) {
        return 0;
    }
    const mansioniSet = new Set();
    requestsData.forEach(item => {
        const mansione = item.task_name || item.mansione;
        if (mansione && String(mansione).trim() !== '') {
            mansioniSet.add(String(mansione).trim());
        }
    });
    return mansioniSet.size;
}

/**
 * Aggiorna i dati delle richieste e ricarica i filtri dinamici
 * @param {Array} requestsData - Array completo dei dati delle richieste aggiornati
 */
function updateFilterBarData(requestsData) {
    if (!Array.isArray(requestsData)) {
        console.error('updateFilterBarData: requestsData deve essere un array');
        return;
    }
    
    allRequestsData = [...requestsData];
    window.allRequestsData = allRequestsData; // Aggiorna anche la variabile globale
    
    // NON aggiornare le opzioni dei filtri se abbiamo già una configurazione cached
    // I filtri devono rimanere basati sulla configurazione iniziale da API
    if (!cachedConfigData && filterOptionsData.length === 0) {
        filterOptionsData = [...requestsData];
        updateFilterOptions(filterOptionsData);
    }
    
    handleFilterChange();
}


/**
 * Costruisce i filtri Tipo, Reparto e Mansione dai dati della configurazione
 * @param {Object} configData - Dati di configurazione da /leave_admin_screen_config
 *   - types: Array di {type_id, type_name}
 *   - blocks: Array di {code, pretty_name, color}
 *   - tasks: Array di oggetti con task_id, task_name/name/pretty_name
 * @returns {boolean} True se almeno un filtro è stato popolato con successo
 */
function buildFiltersFromConfig(configData) {
    if (!configData || typeof configData !== 'object') {
        console.warn('[FILTERS] buildFiltersFromConfig: configData non valido');
        return false;
    }

    let success = false;

    // Popola filtro Tipo
    const tipoSelect = document.getElementById('filterType');
    if (tipoSelect && Array.isArray(configData.types) && configData.types.length > 0) {
        const currentValue = tipoSelect.value;
        tipoSelect.innerHTML = '';
        const newDefaultOption = document.createElement('option');
        newDefaultOption.value = '';
        newDefaultOption.textContent = 'Tutti';
        tipoSelect.appendChild(newDefaultOption);

        configData.types.forEach(function(type) {
            if (type && type.type_id !== undefined && type.type_name) {
                const option = document.createElement('option');
                option.value = type.type_name;
                option.textContent = type.type_name;
                option.setAttribute('data-type-id', type.type_id.toString());
                tipoSelect.appendChild(option);
            }
        });

        if (currentValue && Array.from(tipoSelect.options).some(opt => opt.value === currentValue)) {
            tipoSelect.value = currentValue;
        } else {
            tipoSelect.value = '';
        }
        // RIMOSSO: tipoSelect.disabled = false;
        success = true;
    }

    // Popola filtro Reparto
    const repartoSelect = document.getElementById('filterReparto');
    if (repartoSelect && Array.isArray(configData.blocks) && configData.blocks.length > 0) {
        const currentValue = repartoSelect.value;
        repartoSelect.innerHTML = '';
        const newDefaultOption = document.createElement('option');
        newDefaultOption.value = '';
        newDefaultOption.textContent = 'Tutti';
        repartoSelect.appendChild(newDefaultOption);

        configData.blocks.forEach(function(block) {
            if (block && block.code !== undefined && block.pretty_name) {
                const option = document.createElement('option');
                option.value = block.pretty_name;
                option.textContent = block.pretty_name;
                option.setAttribute('data-department-id', block.code.toString());
                if (block.color) option.setAttribute('data-color', block.color);
                repartoSelect.appendChild(option);
            }
        });

        if (currentValue && Array.from(repartoSelect.options).some(opt => opt.value === currentValue)) {
            repartoSelect.value = currentValue;
        } else {
            repartoSelect.value = '';
        }
        // RIMOSSO: repartoSelect.disabled = false;
        success = true;
    }

    // Popola filtro Mansione
    const mansioneSelect = document.getElementById('filterMansione');
    if (mansioneSelect && Array.isArray(configData.tasks) && configData.tasks.length > 0) {
        const currentValue = mansioneSelect.value;
        mansioneSelect.innerHTML = '';
        const newDefaultOption = document.createElement('option');
        newDefaultOption.value = '';
        newDefaultOption.textContent = 'Tutti';
        mansioneSelect.appendChild(newDefaultOption);

        configData.tasks.forEach(function(task) {
            if (task) {
                const taskId = task.task_id !== undefined ? task.task_id : (task.id !== undefined ? task.id : null);
                const taskName = task.task_name || task.name || task.pretty_name || null;
                
                if (taskName) {
                    const option = document.createElement('option');
                    option.value = taskName;
                    option.textContent = taskName;
                    if (taskId !== null) option.setAttribute('data-task-id', taskId.toString());
                    if (task.color) option.setAttribute('data-color', task.color);
                    mansioneSelect.appendChild(option);
                }
            }
        });

        if (currentValue && Array.from(mansioneSelect.options).some(opt => opt.value === currentValue)) {
            mansioneSelect.value = currentValue;
        } else {
            mansioneSelect.value = '';
        }
        // RIMOSSO: mansioneSelect.disabled = false;
        success = true;
    }

    // Nascondi/mostra filtro REPARTO in base al numero di reparti da configData.blocks
    const repartoSelectFromConfig = document.getElementById('filterReparto');
    if (repartoSelectFromConfig) {
        const repartoFilterGroup = repartoSelectFromConfig.closest('.filter-group');
        if (repartoFilterGroup) {
            const repartiCount = Array.isArray(configData.blocks) ? configData.blocks.length : 0;
            if (repartiCount < 2) {
                repartoFilterGroup.classList.add('hidden');
                // Reset del filtro quando viene nascosto
                repartoSelectFromConfig.value = '';
            } else {
                repartoFilterGroup.classList.remove('hidden');
            }
        }
    }

    // Nascondi/mostra filtro MANSIONE in base al numero di mansioni da configData.tasks
    const mansioneSelectFromConfig = document.getElementById('filterMansione');
    if (mansioneSelectFromConfig) {
        const mansioneFilterGroup = mansioneSelectFromConfig.closest('.filter-group');
        if (mansioneFilterGroup) {
            const mansioniCount = Array.isArray(configData.tasks) ? configData.tasks.length : 0;
            if (mansioniCount < 2) {
                mansioneFilterGroup.classList.add('hidden');
                // Reset del filtro quando viene nascosto
                mansioneSelectFromConfig.value = '';
            } else {
                mansioneFilterGroup.classList.remove('hidden');
            }
        }
    }

    return success;
}

/**
 * Popola dinamicamente tutte le opzioni dei filtri basandosi sui dati delle richieste
 * @param {Array} requests - Array completo dei dati delle richieste
 */
function updateFilterOptions(requests) {
    if (!Array.isArray(requests)) return;

    // Configurazione aggiornata per i nuovi campi
    const filterConfigs = [
        {
            id: 'filterReparto',
            nameKey: 'department_name',
            idKey: 'department_id',
            dataAttribute: 'data-department-id'
        },
        {
            id: 'filterMansione',
            nameKey: 'task_name',
            idKey: 'task_id',
            dataAttribute: 'data-task-id'
        },
        {
            id: 'filterType',
            nameKey: 'type_name', // Nuovo campo
            idKey: 'type',        // Nuovo campo ID
            dataAttribute: 'data-type-id'
        }
    ];

    filterConfigs.forEach(config => {
        const select = document.getElementById(config.id);
        if(!select) return;
        
        const currentVal = select.value;
        select.innerHTML = '<option value="">Tutti</option>';
        
        // Estrai valori unici
        const uniqueItems = new Map();
        requests.forEach(r => {
            const name = r[config.nameKey];
            const id = r[config.idKey];
            if(name) uniqueItems.set(name, id);
        });

        // Ordina e crea opzioni
        Array.from(uniqueItems.keys()).sort().forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            option.setAttribute(config.dataAttribute, uniqueItems.get(name));
            select.appendChild(option);
        });

        if(currentVal) select.value = currentVal;
    });

    // Nascondi/mostra filtro REPARTO in base al numero di reparti unici
    const repartoCount = countUniqueReparti(requests);
    const repartoSelect = document.getElementById('filterReparto');
    if (repartoSelect) {
        const repartoFilterGroup = repartoSelect.closest('.filter-group');
        if (repartoFilterGroup) {
            if (repartoCount < 2) {
                repartoFilterGroup.classList.add('hidden');
                // Reset del filtro quando viene nascosto
                repartoSelect.value = '';
            } else {
                repartoFilterGroup.classList.remove('hidden');
            }
        }
    }

    // Nascondi/mostra filtro MANSIONE in base al numero di mansioni uniche
    const mansioneCount = countUniqueMansioni(requests);
    const mansioneSelect = document.getElementById('filterMansione');
    if (mansioneSelect) {
        const mansioneFilterGroup = mansioneSelect.closest('.filter-group');
        if (mansioneFilterGroup) {
            if (mansioneCount < 2) {
                mansioneFilterGroup.classList.add('hidden');
                // Reset del filtro quando viene nascosto
                mansioneSelect.value = '';
            } else {
                mansioneFilterGroup.classList.remove('hidden');
            }
        }
    }
}

/**
 * Rimuove dinamicamente qualsiasi colore azzurro/blu dal calendario e forza nero
 */
function removeBlueColors(flatpickrInstance) {
    if (!flatpickrInstance || !flatpickrInstance.calendarContainer) return;
    
    // Rimuove qualsiasi colore azzurro/blu da tutti gli elementi del calendario
    const allElements = flatpickrInstance.calendarContainer.querySelectorAll('*');
    allElements.forEach(element => {
        const computed = window.getComputedStyle(element);
        const bgColor = computed.backgroundColor;
        
        // Controlla se il colore è azzurro/blu (RGB contiene valori blu alti)
        if (bgColor && bgColor !== 'transparent' && bgColor !== 'rgba(0, 0, 0, 0)') {
            // Converte il colore in RGB per verificare se è azzurro/blu
            const rgbMatch = bgColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
            if (rgbMatch) {
                const r = parseInt(rgbMatch[1]);
                const g = parseInt(rgbMatch[2]);
                const b = parseInt(rgbMatch[3]);
                // Se il blu è dominante rispetto al rosso e verde, è probabilmente azzurro/blu
                if (b > r && b > g && b > 100) {
                    // Rimuove lo stile inline se presente
                    if (element.hasAttribute('style')) {
                        const style = element.getAttribute('style');
                        const newStyle = style.replace(/background[^;]*/gi, '').replace(/;;+/g, ';').replace(/^;|;$/g, '');
                        if (newStyle) {
                            element.setAttribute('style', newStyle);
                        } else {
                            element.removeAttribute('style');
                        }
                    }
                }
            }
        }
    });
    
    // Forza nero per le date selezionate
    const startRange = flatpickrInstance.calendarContainer.querySelector('.flatpickr-day.startRange');
    const endRange = flatpickrInstance.calendarContainer.querySelector('.flatpickr-day.endRange');
    
    if (startRange) {
        startRange.style.backgroundColor = '#000000';
        startRange.style.borderColor = '#000000';
        startRange.style.color = '#ffffff';
    }
    
    if (endRange) {
        endRange.style.backgroundColor = '#000000';
        endRange.style.borderColor = '#000000';
        endRange.style.color = '#ffffff';
    }
    
    // Rimuove qualsiasi background azzurro/blu dai container
    const daysContainer = flatpickrInstance.calendarContainer.querySelector('.flatpickr-days');
    const dayContainer = flatpickrInstance.calendarContainer.querySelector('.flatpickr-dayContainer');
    
    if (daysContainer) {
        daysContainer.style.backgroundColor = 'transparent';
        daysContainer.style.backgroundImage = 'none';
    }
    
    if (dayContainer) {
        dayContainer.style.backgroundColor = 'transparent';
        dayContainer.style.backgroundImage = 'none';
    }
    
    // Rimuove qualsiasi elemento wrapper o pseudo-elemento che potrebbe creare la barra azzurra
    const startRangeDays = flatpickrInstance.calendarContainer.querySelectorAll('.flatpickr-day.startRange');
    const endRangeDays = flatpickrInstance.calendarContainer.querySelectorAll('.flatpickr-day.endRange');
    
    startRangeDays.forEach(day => {
        // Rimuove qualsiasi pseudo-elemento
        const before = window.getComputedStyle(day, '::before');
        const after = window.getComputedStyle(day, '::after');
        if (before.content && before.content !== 'none') {
            day.style.setProperty('--before-content', 'none');
        }
        if (after.content && after.content !== 'none') {
            day.style.setProperty('--after-content', 'none');
        }
    });
    
    endRangeDays.forEach(day => {
        // Rimuove qualsiasi pseudo-elemento
        const before = window.getComputedStyle(day, '::before');
        const after = window.getComputedStyle(day, '::after');
        if (before.content && before.content !== 'none') {
            day.style.setProperty('--before-content', 'none');
        }
        if (after.content && after.content !== 'none') {
            day.style.setProperty('--after-content', 'none');
        }
    });
    
    // Se startRange e endRange sono consecutivi, rimuove qualsiasi elemento tra di essi
    if (startRange && endRange) {
        const startRect = startRange.getBoundingClientRect();
        const endRect = endRange.getBoundingClientRect();
        const areConsecutive = Math.abs(startRect.right - endRect.left) < 50;
        
        if (areConsecutive) {
            // Rimuove qualsiasi elemento tra startRange e endRange
            let current = startRange.nextElementSibling;
            while (current && current !== endRange) {
                if (current.classList.contains('flatpickr-day')) {
                    const computed = window.getComputedStyle(current);
                    const bgColor = computed.backgroundColor;
                    const rgbMatch = bgColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
                    if (rgbMatch) {
                        const r = parseInt(rgbMatch[1]);
                        const g = parseInt(rgbMatch[2]);
                        const b = parseInt(rgbMatch[3]);
                        if (b > r && b > g && b > 100) {
                            current.style.backgroundColor = 'transparent';
                            current.style.backgroundImage = 'none';
                        }
                    }
                }
                current = current.nextElementSibling;
            }
        }
    }
}

/**
 * Setup observer per monitorare cambiamenti dinamici e rimuovere colori azzurri
 */
function setupColorObserver(flatpickrInstance) {
    if (!flatpickrInstance || !flatpickrInstance.calendarContainer) return;
    
    const observer = new MutationObserver(function(mutations) {
        let shouldRemoveBlue = false;
        
        mutations.forEach(function(mutation) {
            if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                const element = mutation.target;
                const computed = window.getComputedStyle(element);
                const bgColor = computed.backgroundColor;
                
                // Controlla se il colore è azzurro/blu
                if (bgColor && bgColor !== 'transparent' && bgColor !== 'rgba(0, 0, 0, 0)') {
                    const rgbMatch = bgColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
                    if (rgbMatch) {
                        const r = parseInt(rgbMatch[1]);
                        const g = parseInt(rgbMatch[2]);
                        const b = parseInt(rgbMatch[3]);
                        if (b > r && b > g && b > 100) {
                            shouldRemoveBlue = true;
                        }
                    }
                }
            }
            
            if (mutation.type === 'childList') {
                shouldRemoveBlue = true;
            }
        });
        
        if (shouldRemoveBlue) {
            setTimeout(() => {
                removeBlueColors(flatpickrInstance);
            }, 10);
        }
    });
    
    // Osserva cambiamenti nel container del calendario
    observer.observe(flatpickrInstance.calendarContainer, {
        attributes: true,
        attributeFilter: ['style', 'class'],
        childList: true,
        subtree: true
    });
}

/**
 * Personalizza l'anno nella vista mensile - ingrandisce e migliora lo stile
 * @param {Object} flatpickrInstance - Istanza di Flatpickr
 */
function customizeYearInMonthView(flatpickrInstance) {
    if (!flatpickrInstance || !flatpickrInstance.calendarContainer) return;
    
    const calendarContainer = flatpickrInstance.calendarContainer;
    const currentMonth = calendarContainer.querySelector('.flatpickr-current-month');
    
    if (!currentMonth) return;
    
    // Cerca l'elemento anno - potrebbe essere un span con classe cur-year o parte del testo
    let yearElement = currentMonth.querySelector('.cur-year');
    
    // Se non trova .cur-year, cerca l'ultimo span o elemento numerico
    if (!yearElement) {
        const spans = currentMonth.querySelectorAll('span');
        if (spans.length > 0) {
            yearElement = spans[spans.length - 1];
        }
    }
    
    // Se ancora non trova, cerca nel testo e crea un wrapper
    if (!yearElement) {
        const text = currentMonth.textContent || '';
        // Cerca un anno a 4 cifre (es. 2025)
        const yearMatch = text.match(/\b(19|20)\d{2}\b/);
        if (yearMatch) {
            // Crea un wrapper per l'anno se non esiste
            const yearText = yearMatch[0];
            const parts = text.split(yearText);
            
            // Se l'anno è separato dal mese, wrappa solo l'anno
            if (parts.length === 2) {
                currentMonth.innerHTML = parts[0] + '<span class="year-display">' + yearText + '</span>' + parts[1];
                yearElement = currentMonth.querySelector('.year-display');
            }
        }
    }
    
    // Applica stili all'anno se trovato
    if (yearElement) {
        yearElement.style.fontSize = '18px';
        yearElement.style.fontWeight = '600';
        yearElement.style.color = '#000000';
        yearElement.style.lineHeight = '1.2';
        yearElement.classList.add('year-display');
    } else {
        // Fallback: applica stili direttamente al current-month e aumenta solo la parte numerica
        const text = currentMonth.textContent || '';
        const yearMatch = text.match(/\b(19|20)\d{2}\b/);
        if (yearMatch) {
            const parts = text.split(yearMatch[0]);
            if (parts.length === 2) {
                currentMonth.innerHTML = parts[0] + '<span class="year-display" style="font-size: 18px !important; font-weight: 600 !important; color: #000000 !important; line-height: 1.2 !important;">' + yearMatch[0] + '</span>' + parts[1];
            }
        }
    }
}

/**
 * Setup observer per monitorare quando cambia il mese/anno e riapplicare gli stili
 * @param {Object} flatpickrInstance - Istanza di Flatpickr
 */
function setupYearDisplayObserver(flatpickrInstance) {
    if (!flatpickrInstance || !flatpickrInstance.calendarContainer) return;
    
    const calendarContainer = flatpickrInstance.calendarContainer;
    
    // Observer per monitorare quando cambia il contenuto del current-month
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.type === 'childList' || mutation.type === 'characterData') {
                // Riapplica gli stili all'anno quando cambia
                setTimeout(() => {
                    customizeYearInMonthView(flatpickrInstance);
                }, 50);
            }
        });
    });
    
    const currentMonth = calendarContainer.querySelector('.flatpickr-current-month');
    if (currentMonth) {
        observer.observe(currentMonth, {
            childList: true,
            subtree: true,
            characterData: true
        });
    }
    
    // Intercetta anche i click sulle frecce di navigazione mese
    const prevMonth = calendarContainer.querySelector('.flatpickr-prev-month');
    const nextMonth = calendarContainer.querySelector('.flatpickr-next-month');
    
    if (prevMonth) {
        prevMonth.addEventListener('click', function() {
            setTimeout(() => {
                customizeYearInMonthView(flatpickrInstance);
            }, 200);
        });
    }
    
    if (nextMonth) {
        nextMonth.addEventListener('click', function() {
            setTimeout(() => {
                customizeYearInMonthView(flatpickrInstance);
            }, 200);
        });
    }
}

/**
 * Setup event listeners per tutti i filtri
 */
function setupFilterListeners() {
    // Ricerca testuale (con debounce di 2 secondi)
    const searchInput = document.getElementById('filterSearch');
    if (searchInput) {
        searchInput.addEventListener('input', handleSearchChange);
    }

    // Filtro tipologia
    const typeSelect = document.getElementById('filterType');
    if (typeSelect) {
        typeSelect.addEventListener('change', handleFilterChange);
    }

    // Filtro reparto
    const repartoSelect = document.getElementById('filterReparto');
    if (repartoSelect) {
        repartoSelect.addEventListener('change', handleFilterChange);
    }

    // Filtro mansione
    const mansioneSelect = document.getElementById('filterMansione');
    if (mansioneSelect) {
        mansioneSelect.addEventListener('change', handleFilterChange);
    }

    // Ordinamento
    const sortSelect = document.getElementById('filterSort');
    if (sortSelect) {
        sortSelect.addEventListener('change', handleFilterChange);
    }

    // Reset button
    const resetButton = document.getElementById('filterReset');
    if (resetButton) {
        resetButton.addEventListener('click', clearAllFilters);
    }
}

/**
 * Abilita o disabilita tutti i filtri della barra filtri
 * @param {boolean} enabled - True per abilitare, false per disabilitare
 */
function setFiltersEnabled(enabled) {
    // Lista di tutti gli elementi da disabilitare/abilitare
    const filterElements = [
        'filterSearch',      // Input ricerca
        'filterType',        // Select tipo
        'filterReparto',     // Select reparto
        'filterMansione',    // Select mansione
        'filterSort',        // Select ordinamento
        'filterReset'        // Button reset
    ];
    
    // Gestisci lo stato disabled degli elementi
    filterElements.forEach(elementId => {
        const element = document.getElementById(elementId);
        if (element) {
            element.disabled = !enabled;
        }
    });
    
    // Aggiungi/rimuovi classe CSS al container per feedback visivo
    const filterBarContainer = document.querySelector('.filter-bar-container');
    if (filterBarContainer) {
        if (enabled) {
            filterBarContainer.classList.remove('filters-disabled');
        } else {
            filterBarContainer.classList.add('filters-disabled');
        }
    }
}

// Esponi setFiltersEnabled globalmente per accesso da altri componenti
window.setFiltersEnabled = setFiltersEnabled;

/**
 * Gestisce il cambiamento di qualsiasi filtro
 */
async function handleFilterChange() {
    // Se non c'è un periodo selezionato, disabilita e mostra messaggio
    if (!window.selectedPeriod || !window.selectedPeriod.startDate || !window.selectedPeriod.endDate) {
        setFiltersEnabled(false);
        showPeriodSelectionMessage();
        updateActiveFiltersChips();
        updateResetButtonState();
        return;
    }
    
    // Disabilita filtri durante il caricamento (opzionale, ma consigliato per UX)
    // setFiltersEnabled(false); 
    
    showFilterSpinner();
    showListSpinner();
    
    try {
        const params = buildApiParams();
        const apiData = await fetchLeavesRequestsWithFilters(params);
        
        allRequestsData = [...apiData];
        window.allRequestsData = allRequestsData;
        filteredRequestsData = [...apiData];
        window.filteredRequestsData = filteredRequestsData;
        
        renderList(filteredRequestsData);
        
        updateActiveFiltersChips();
        updateResetButtonState();
        
        // 3. ABILITAZIONE FILTRI: Solo qui, dopo aver ricevuto e mostrato i dati con successo
        setFiltersEnabled(true);
        
    } catch (error) {
        console.error('Errore nel caricamento dati:', error);
        setFiltersEnabled(false); // Mantieni disabilitato in caso di errore
        
        const approvalList = document.getElementById('approvalList');
        if (approvalList) {
            approvalList.innerHTML = '';
            const errorMessage = document.createElement('div');
            errorMessage.className = 'text-center py-4 text-danger';
            errorMessage.style.padding = '52.8px';
            errorMessage.textContent = `Errore nel caricamento: ${error.message}`;
            approvalList.appendChild(errorMessage);
        }
    } finally {
        hideFilterSpinner();
        hideListSpinner();
    }
}

/**
 * Gestisce il cambiamento del filtro ricerca con debounce
 */
function handleSearchChange() {
    // Cancella timer precedente
    if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer);
    }
    
    // Imposta nuovo timer (2 secondi)
    searchDebounceTimer = setTimeout(() => {
        handleFilterChange();
    }, 2000);
}

// Esponi handleFilterChange globalmente per accesso da altri componenti
window.handleFilterChange = handleFilterChange;

/**
 * Applica tutti i filtri e restituisce l'array filtrato
 * @returns {Array} Array filtrato e ordinato
 * @deprecated Non più utilizzata - i filtri sono gestiti dal backend tramite API
 */
/*
function applyFilters() {
    // Sincronizza allRequestsData con window.allRequestsData se è stato aggiornato
    if (window.allRequestsData && Array.isArray(window.allRequestsData)) {
        allRequestsData = [...window.allRequestsData];
    }
    
    // Se c'è un filtro periodo attivo, usa tutti i dati disponibili dal calendario
    // altrimenti usa allRequestsData (che potrebbe contenere solo i dati del giorno selezionato)
    let sourceData = allRequestsData;
    if (window.selectedPeriod && window.selectedPeriod.startDate && window.selectedPeriod.endDate) {
        // Usa tutti i dati disponibili dal calendario per il filtro periodo
        if (window.allCalendarData && Array.isArray(window.allCalendarData) && window.allCalendarData.length > 0) {
            sourceData = window.allCalendarData;
        }
    }
    
    let filtered = [...sourceData];

    // Filtro ricerca testuale (nome)
    const searchValue = document.getElementById('filterSearch')?.value.trim().toLowerCase() || '';
    if (searchValue) {
        filtered = filtered.filter(req => 
            req.nome.toLowerCase().includes(searchValue)
        );
    }

    // Filtro tipologia
    const typeValue = document.getElementById('filterType')?.value || '';
    if (typeValue) {
        filtered = filtered.filter(req => req.tipo_richiesta === typeValue);
    }

    // Filtro stato
    const statoValue = document.getElementById('filterStato')?.value || '';
    if (statoValue) {
        filtered = filtered.filter(req => req.stato === statoValue);
    }

    // Filtro reparto (solo se il filtro non è nascosto)
    const repartoSelect = document.getElementById('filterReparto');
    const repartoFilterGroup = repartoSelect?.closest('.filter-group');
    if (repartoSelect && repartoFilterGroup && !repartoFilterGroup.classList.contains('hidden')) {
        const repartoValue = repartoSelect.value || '';
        if (repartoValue) {
            filtered = filtered.filter(req => {
                const reqReparto = req.department_name || req.reparto || '';
                return reqReparto === repartoValue;
            });
        }
    }

    // Filtro mansione (solo se il filtro non è nascosto)
    const mansioneSelect = document.getElementById('filterMansione');
    const mansioneFilterGroup = mansioneSelect?.closest('.filter-group');
    if (mansioneSelect && mansioneFilterGroup && !mansioneFilterGroup.classList.contains('hidden')) {
        const mansioneValue = mansioneSelect.value || '';
        if (mansioneValue) {
            filtered = filtered.filter(req => {
                const reqMansione = req.task_name || req.mansione || '';
                return reqMansione === mansioneValue;
            });
        }
    }

    // Filtro periodo (dal calendario di destra)
    if (window.selectedPeriod && window.selectedPeriod.startDate && window.selectedPeriod.endDate) {
        const startDate = new Date(window.selectedPeriod.startDate);
        const endDate = new Date(window.selectedPeriod.endDate);
        // Imposta l'ora a fine giornata per includere tutto il giorno finale
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        
        filtered = filtered.filter(req => {
            // Controlla dataInizio e dataFine direttamente dall'oggetto root
            const reqStartDate = req.dataInizio ? new Date(req.dataInizio + 'T00:00:00') : null;
            const reqEndDate = req.dataFine ? new Date(req.dataFine + 'T00:00:00') : null;
            
            if (reqStartDate && !isNaN(reqStartDate.getTime())) {
                reqStartDate.setHours(0, 0, 0, 0);
                
                // Se c'è solo dataInizio, controlla se cade nel periodo
                if (!reqEndDate || isNaN(reqEndDate.getTime())) {
                    if (reqStartDate >= startDate && reqStartDate <= endDate) {
                        return true;
                    }
                } else {
                    // Se c'è un range, controlla se si sovrappone al periodo selezionato
                    reqEndDate.setHours(23, 59, 59, 999);
                    // Sovrapposizione: inizio req <= fine periodo E fine req >= inizio periodo
                    if (reqStartDate <= endDate && reqEndDate >= startDate) {
                        return true;
                    }
                }
            }
            
            return false;
        });
    }

    // Ordinamento
    const sortValue = document.getElementById('filterSort')?.value || 'data-recente';
    filtered = sortRequests(filtered, sortValue);

    return filtered;
}
*/

/**
 * Ordina le richieste in base al criterio selezionato
 * @param {Array} requests - Array di richieste da ordinare
 * @param {string} sortType - Tipo di ordinamento ('data-recente' o 'urgenza-decrescente')
 * @returns {Array} Array ordinato
 * @deprecated Non più utilizzata - l'ordinamento è gestito dal backend tramite API
 */
/*
function sortRequests(requests, sortType) {
    const sorted = [...requests];

    if (sortType === 'urgenza-decrescente') {
        // Ordina per urgenza decrescente (true prima di false)
        sorted.sort((a, b) => {
            if (a.urgenza === b.urgenza) return 0;
            return a.urgenza ? -1 : 1;
        });
    } else {
        // Ordina per data più recente (default)
        sorted.sort((a, b) => {
            // Se c'è un campo data_numerica o timestamp, usalo
            if (a.data_numerica && b.data_numerica) {
                return b.data_numerica - a.data_numerica;
            }
            // Altrimenti mantieni l'ordine originale
            return 0;
        });
    }

    return sorted;
}
*/

/**
 * Renderizza la lista delle richieste filtrate raggruppate per reparto
 * @param {Array} data - Array di dati da renderizzare
 * Modifica renderList per gestire il raggruppamento con i nuovi campi
 */ 
function renderList(data) {
    const list = document.getElementById('approvalList');
    if (!list) return;
    list.innerHTML = '';

    if (data.length === 0) {
        list.innerHTML = '<div class="empty-state-container"><img src="assets/image/desert.png" alt="Nessuna richiesta trovata" class="empty-state-image"></div>';
        return;
    }

    // Conta i reparti unici per decidere se mostrare raggruppamento e intestazioni
    const repartiCount = countUniqueReparti(data);

    // Se ci sono meno di 2 reparti, renderizza senza raggruppamento e senza intestazioni
    if (repartiCount < 2) {
        // Renderizza direttamente tutte le richieste senza raggruppamento
        data.forEach(function(requestData) {
            const row = createApprovalRow(requestData);
            list.appendChild(row);
        });
    } else {
        // Raggruppa le richieste per reparto (logica esistente)
        const groups = {};
        data.forEach(req => {
            const rep = req.department_name || req.reparto || 'Nessun reparto';
            if (!groups[rep]) groups[rep] = [];
            groups[rep].push(req);
        });

        Object.keys(groups).sort().forEach(rep => {
            const label = document.createElement('div');
            label.className = 'reparto-section-label pt-4';
            label.textContent = rep.toUpperCase();
            list.appendChild(label);

            groups[rep].forEach(req => {
                list.appendChild(createApprovalRow(req));
            });
        });
    }
    
    if(typeof initHeaderShadows === 'function') initHeaderShadows();
}

/**
 * Inizializza gli observer per le ombre dinamiche degli header dei reparti
 */
function initHeaderShadows() {
    const approvalList = document.getElementById('approvalList');
    if (!approvalList) return;

    // Trova tutti gli header
    const headers = approvalList.querySelectorAll('.reparto-section-label');
    
    headers.forEach(function(header) {
        // Trova il primo elemento approval-row dopo l'header
        let firstRow = header.nextElementSibling;
        while (firstRow && !firstRow.classList.contains('approval-row')) {
            firstRow = firstRow.nextElementSibling;
        }

        // Se non c'è una riga, non c'è contenuto da osservare
        if (!firstRow) {
            return;
        }

        // Funzione per aggiornare lo stato dell'ombra basato sulla posizione
        const updateShadowState = function() {
            const headerRect = header.getBoundingClientRect();
            const rowRect = firstRow.getBoundingClientRect();
            
            // Se la riga è sopra il bordo inferiore dell'header (scorre sotto), attiva l'ombra
            if (rowRect.top < headerRect.bottom) {
                header.classList.add('has-shadow');
            } else {
                header.classList.remove('has-shadow');
            }
        };

        // Gestisci lo scroll per aggiornare lo stato in tempo reale
        const handleScroll = function() {
            updateShadowState();
        };

        // Aggiungi listener per lo scroll
        approvalList.addEventListener('scroll', handleScroll, { passive: true });
        
        // Crea IntersectionObserver per monitorare quando la riga entra/esce dalla viewport
        const observer = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
                updateShadowState();
            });
        }, {
            root: approvalList,
            threshold: [0, 0.1, 0.5, 1]
        });

        // Osserva la prima riga del gruppo
        observer.observe(firstRow);
        
        // Esegui un controllo iniziale
        updateShadowState();
    });
}

/**
 * Aggiorna lo stato del bottone reset (disabilitato se non ci sono filtri attivi)
 */
function updateResetButtonState() {
    const resetButton = document.getElementById('filterReset');
    if (!resetButton) return;

    // Verifica se ci sono filtri attivi
    const hasActiveFilters = hasAnyActiveFilters();
    
    // Abilita/disabilita il bottone
    resetButton.disabled = !hasActiveFilters;
}

/**
 * Verifica se ci sono filtri attivi
 * @returns {boolean} True se ci sono filtri attivi, altrimenti false
 */
function hasAnyActiveFilters() {
    // Verifica ricerca testuale
    const searchValue = document.getElementById('filterSearch')?.value.trim() || '';
    if (searchValue) return true;

    // Verifica tipologia
    const typeValue = document.getElementById('filterType')?.value || '';
    if (typeValue) return true;

    // Verifica reparto (solo se il filtro non è nascosto)
    const repartoSelect = document.getElementById('filterReparto');
    const repartoFilterGroup = repartoSelect?.closest('.filter-group');
    if (repartoSelect && repartoFilterGroup && !repartoFilterGroup.classList.contains('hidden')) {
        const repartoValue = repartoSelect.value || '';
        if (repartoValue) return true;
    }

    // Verifica mansione (solo se il filtro non è nascosto)
    const mansioneSelect = document.getElementById('filterMansione');
    const mansioneFilterGroup = mansioneSelect?.closest('.filter-group');
    if (mansioneSelect && mansioneFilterGroup && !mansioneFilterGroup.classList.contains('hidden')) {
        const mansioneValue = mansioneSelect.value || '';
        if (mansioneValue) return true;
    }

    // Verifica periodo (dal calendario di destra)
    if (window.selectedPeriod && window.selectedPeriod.startDate && window.selectedPeriod.endDate) {
        return true;
    }

    // Verifica ordinamento (solo se diverso dal default)
    const sortValue = document.getElementById('filterSort')?.value || 'data-recente';
    if (sortValue !== 'data-recente') return true;

    return false;
}

/**
 * Aggiorna le chips dei filtri attivi
 */
function updateActiveFiltersChips() {
    const container = document.getElementById('activeFiltersContainer');
    if (!container) return;

    // Pulisci container
    container.innerHTML = '';

    const activeFilters = [];

    // Ricerca testuale
    const searchValue = document.getElementById('filterSearch')?.value.trim() || '';
    if (searchValue) {
        activeFilters.push({
            key: 'search',
            label: 'Ricerca',
            value: searchValue,
            remove: () => {
                document.getElementById('filterSearch').value = '';
                handleFilterChange();
            }
        });
    }

    // Tipologia
    const typeValue = document.getElementById('filterType')?.value || '';
    if (typeValue) {
        activeFilters.push({
            key: 'type',
            label: 'Tipologia',
            value: typeValue,
            remove: () => {
                document.getElementById('filterType').value = '';
                handleFilterChange();
            }
        });
    }

    // Reparto (solo se il filtro non è nascosto)
    const repartoSelect = document.getElementById('filterReparto');
    const repartoFilterGroup = repartoSelect?.closest('.filter-group');
    if (repartoSelect && repartoFilterGroup && !repartoFilterGroup.classList.contains('hidden')) {
        const repartoValue = repartoSelect.value || '';
        if (repartoValue) {
            activeFilters.push({
                key: 'reparto',
                label: 'Reparto',
                value: repartoValue,
                remove: () => {
                    repartoSelect.value = '';
                    handleFilterChange();
                }
            });
        }
    }

    // Mansione (solo se il filtro non è nascosto)
    const mansioneSelect = document.getElementById('filterMansione');
    const mansioneFilterGroup = mansioneSelect?.closest('.filter-group');
    if (mansioneSelect && mansioneFilterGroup && !mansioneFilterGroup.classList.contains('hidden')) {
        const mansioneValue = mansioneSelect.value || '';
        if (mansioneValue) {
            activeFilters.push({
                key: 'mansione',
                label: 'Mansione',
                value: mansioneValue,
                remove: () => {
                    mansioneSelect.value = '';
                    handleFilterChange();
                }
            });
        }
    }

    // Periodo (dal calendario di destra)
    if (window.selectedPeriod && window.selectedPeriod.startDate && window.selectedPeriod.endDate) {
        const startDate = new Date(window.selectedPeriod.startDate);
        const endDate = new Date(window.selectedPeriod.endDate);
        const formatDate = (date) => {
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            return `${day}/${month}/${year}`;
        };
        activeFilters.push({
            key: 'periodo',
            label: 'Periodo',
            value: `${formatDate(startDate)} al ${formatDate(endDate)}`,
            remove: () => {
                // Chiama la funzione per resettare il periodo nel calendario
                if (typeof window.clearPeriodSelection === 'function') {
                    window.clearPeriodSelection();
                }
                handleFilterChange();
            }
        });
    }

    // Ordinamento (solo se diverso dal default)
    const sortValue = document.getElementById('filterSort')?.value || 'data-recente';
    if (sortValue !== 'data-recente') {
        activeFilters.push({
            key: 'sort',
            label: 'Ordinamento',
            value: sortValue === 'urgenza-decrescente' ? 'Richiesta meno recente' : sortValue,
            remove: () => {
                document.getElementById('filterSort').value = 'data-recente';
                handleFilterChange();
            }
        });
    }

    // Renderizza chips
    activeFilters.forEach(filter => {
        const chip = document.createElement('div');
        chip.className = 'filter-chip';
        
        const label = document.createElement('span');
        label.className = 'filter-chip-label';
        label.textContent = filter.label + ': ';
        
        const value = document.createElement('span');
        value.className = 'filter-chip-value';
        value.textContent = filter.value;
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'filter-chip-remove';
        removeBtn.setAttribute('aria-label', 'Rimuovi filtro ' + filter.label);
        removeBtn.setAttribute('type', 'button');
        const icon = document.createElement('i');
        icon.className = 'bi bi-x';
        removeBtn.appendChild(icon);
        removeBtn.addEventListener('click', filter.remove);
        
        chip.appendChild(label);
        chip.appendChild(value);
        chip.appendChild(removeBtn);
        
        container.appendChild(chip);
    });
}

/**
 * Mostra spinner nella sezione filtri
 */
function showFilterSpinner() {
    const filterBarContainer = document.querySelector('.filter-bar-container');
    if (!filterBarContainer) return;

    // Rimuovi spinner esistente se presente
    const existingSpinner = filterBarContainer.querySelector('.filter-spinner-container');
    if (existingSpinner) {
        existingSpinner.remove();
    }

    // Crea nuovo spinner
    const spinnerContainer = document.createElement('div');
    spinnerContainer.className = 'filter-spinner-container';
    spinnerContainer.innerHTML = `
        <div class="spinner-border spinner-border-sm" role="status">
            <span class="visually-hidden">Caricamento...</span>
        </div>
    `;
    
    filterBarContainer.appendChild(spinnerContainer);
}

/**
 * Nasconde spinner nella sezione filtri
 */
function hideFilterSpinner() {
    const filterBarContainer = document.querySelector('.filter-bar-container');
    if (!filterBarContainer) return;

    const spinnerContainer = filterBarContainer.querySelector('.filter-spinner-container');
    if (spinnerContainer) {
        spinnerContainer.remove();
    }
}

// Esponi hideFilterSpinner globalmente per accesso da altri componenti
window.hideFilterSpinner = hideFilterSpinner;

// Esponi updateFilterOptions globalmente per accesso da altri componenti
window.updateFilterOptions = updateFilterOptions;

// Esponi fetchLeaveAdminScreenConfig globalmente per accesso da altri componenti
window.fetchLeaveAdminScreenConfig = fetchLeaveAdminScreenConfig;

// Esponi buildFiltersFromConfig globalmente per accesso da altri componenti
window.buildFiltersFromConfig = buildFiltersFromConfig;

/**
 * Mostra spinner nella lista
 */
function showListSpinner() {
    const approvalList = document.getElementById('approvalList');
    if (!approvalList) return;

    // Svuota la lista e mostra spinner
    approvalList.innerHTML = '';
    
    const spinnerContainer = document.createElement('div');
    spinnerContainer.className = 'list-spinner-container';
    spinnerContainer.innerHTML = `
        <div class="spinner-border" role="status">
            <span class="visually-hidden">Caricamento...</span>
        </div>
    `;
    
    approvalList.appendChild(spinnerContainer);
}

/**
 * Nasconde spinner nella lista
 */
function hideListSpinner() {
    const approvalList = document.getElementById('approvalList');
    if (!approvalList) return;

    const spinnerContainer = approvalList.querySelector('.list-spinner-container');
    if (spinnerContainer) {
        spinnerContainer.remove();
    }
}

/**
 * Mostra messaggio di stato vuoto nella lista
 */
function showEmptyStateMessage() {
    const approvalList = document.getElementById('approvalList');
    if (!approvalList) return;

    approvalList.innerHTML = '';
    
    const emptyMessage = document.createElement('div');
    emptyMessage.className = 'text-center py-4 text-muted';
    emptyMessage.style.fontSize = '0.917rem';
    emptyMessage.style.padding = '52.8px';
    emptyMessage.style.color = '#666666';
    emptyMessage.textContent = 'Seleziona un periodo dal calendario per visualizzare i giustificativi.';
    approvalList.appendChild(emptyMessage);
}

/**
 * Mostra messaggio per selezionare un periodo dal calendario
 */
function showPeriodSelectionMessage() {
    const approvalList = document.getElementById('approvalList');
    if (!approvalList) return;

    approvalList.innerHTML = '';
    
    const emptyMessage = document.createElement('div');
    emptyMessage.className = 'text-center py-4 text-muted';
    emptyMessage.style.fontSize = '0.917rem';
    emptyMessage.style.padding = '52.8px';
    emptyMessage.style.color = '#666666';
    emptyMessage.textContent = 'Seleziona un periodo dal calendario per visualizzare i giustificativi.';
    approvalList.appendChild(emptyMessage);
}

/**
 * Carica e mostra i dati per un giorno specifico
 * @param {Date} selectedDate - Data selezionata
 */
async function loadAndDisplayDayData(selectedDate) {
    // Se c'è un filtro periodo attivo, non sovrascrivere i dati
    // perché il filtro periodo deve usare tutti i dati disponibili
    if (window.selectedPeriod && window.selectedPeriod.startDate && window.selectedPeriod.endDate) {
        return;
    }
    
    // Mostra spinner (solo se non c'è un filtro periodo attivo)
    showFilterSpinner();
    showListSpinner();

    try {
        // Carica dati del giorno (simula chiamata API con delay)
        const dayRequests = await loadDayData(selectedDate);

        // Controlla di nuovo se nel frattempo è stato selezionato un periodo
        // (per evitare race condition)
        if (window.selectedPeriod && window.selectedPeriod.startDate && window.selectedPeriod.endDate) {
            return;
        }

        // Aggiorna allRequestsData e filteredRequestsData
        allRequestsData = [...dayRequests];
        window.allRequestsData = allRequestsData;
        filteredRequestsData = [...dayRequests];
        window.filteredRequestsData = filteredRequestsData;

        // NON aggiornare le opzioni dei filtri se abbiamo già una configurazione cached
        // I filtri devono rimanere basati sulla configurazione iniziale da API
        if (!cachedConfigData && filterOptionsData.length === 0) {
            filterOptionsData = [...dayRequests];
            updateFilterOptions(filterOptionsData);
        }

        // Abilita i filtri solo se i dati sono stati caricati con successo
        if (dayRequests && dayRequests.length > 0) {
            setFiltersEnabled(true);
        } else {
            // Se non ci sono dati, mantieni i filtri disabilitati
            setFiltersEnabled(false);
        }

        // Renderizza la lista con i dati filtrati
        renderList(filteredRequestsData);

        // Aggiorna chips filtri attivi
        updateActiveFiltersChips();
        updateResetButtonState();

    } catch (error) {
        console.error('Errore nel caricamento dati del giorno:', error);
        
        // In caso di errore, mantieni i filtri disabilitati
        setFiltersEnabled(false);
        
        // Mostra messaggio di errore
        const approvalList = document.getElementById('approvalList');
        if (approvalList) {
            approvalList.innerHTML = '';
            const errorMessage = document.createElement('div');
            errorMessage.className = 'text-center py-4 text-danger';
            errorMessage.style.fontSize = '0.917rem';
            errorMessage.style.padding = '52.8px';
            errorMessage.textContent = 'Errore nel caricamento dei dati. Riprova.';
            approvalList.appendChild(errorMessage);
        }
    } finally {
        // Nascondi sempre lo spinner quando la funzione completa
        // (anche se è stata interrotta a causa di un filtro periodo)
        hideFilterSpinner();
        hideListSpinner();
    }
}

/**
 * Carica i dati per un giorno specifico
 * @param {Date} selectedDate - Data selezionata
 * @returns {Promise<Array>} Promise che si risolve con array di richieste per quel giorno
 */
async function loadDayData(selectedDate) {
    // Simula chiamata API con delay di 2 secondi
    return new Promise((resolve) => {
        setTimeout(() => {
            // Normalizza la data (solo giorno, mese, anno, senza ore)
            const normalizedDate = new Date(selectedDate);
            normalizedDate.setHours(0, 0, 0, 0);
            
            // Ottieni tutti i dati disponibili (da allCalendarData o da API futura)
            const allData = window.allCalendarData || [];
            
            // Filtra le richieste che includono la data selezionata
            const dayRequests = allData.filter(request => {
                // Controlla dataInizio e dataFine direttamente dall'oggetto root
                const reqStartDate = request.dataInizio ? new Date(request.dataInizio + 'T00:00:00') : null;
                const reqEndDate = request.dataFine ? new Date(request.dataFine + 'T00:00:00') : null;
                
                if (reqStartDate && !isNaN(reqStartDate.getTime())) {
                    reqStartDate.setHours(0, 0, 0, 0);
                    
                    // Se la data di inizio corrisponde esattamente
                    if (reqStartDate.getTime() === normalizedDate.getTime()) {
                        return true;
                    }
                    
                    // Se c'è un range di date, controlla se la data selezionata è nel range
                    if (reqEndDate && !isNaN(reqEndDate.getTime())) {
                        reqEndDate.setHours(23, 59, 59, 999);
                        if (normalizedDate >= reqStartDate && normalizedDate <= reqEndDate) {
                            return true;
                        }
                    }
                }
                
                return false;
            });
            
            resolve(dayRequests);
        }, 2000); // 2 secondi di delay per simulare chiamata API
    });
}

// Esponi loadAndDisplayDayData globalmente per accesso da detail-panel.js
window.loadAndDisplayDayData = loadAndDisplayDayData;

/**
 * Resetta tutti i filtri e ricostruisce i filtri dalla configurazione (come all'inizializzazione)
 */
async function clearAllFilters() {
    // Reset ricerca
    const searchInput = document.getElementById('filterSearch');
    if (searchInput) searchInput.value = '';

    // Reset tipologia
    const typeSelect = document.getElementById('filterType');
    if (typeSelect) typeSelect.value = '';

    // Reset reparto
    const repartoSelect = document.getElementById('filterReparto');
    if (repartoSelect) repartoSelect.value = '';

    // Reset mansione
    const mansioneSelect = document.getElementById('filterMansione');
    if (mansioneSelect) mansioneSelect.value = '';

    // Reset periodo (dal calendario di destra)
    window.selectedPeriod = null;
    if (typeof window.clearPeriodSelection === 'function') {
        window.clearPeriodSelection();
    }

    // Reset ordinamento
    const sortSelect = document.getElementById('filterSort');
    if (sortSelect) sortSelect.value = 'data-recente';

    // Ricostruisci i filtri dalla configurazione cached (come all'inizializzazione)
    if (cachedConfigData && typeof cachedConfigData === 'object') {
        console.log('[FILTERS] Reset filtri: uso configurazione cached');
        buildFiltersFromConfig(cachedConfigData);
    } else {
        console.warn('[FILTERS] Reset filtri: configurazione cached non disponibile, uso fallback');
        // Fallback: usa updateFilterOptions se config non disponibile
        if (filterOptionsData && filterOptionsData.length > 0) {
            updateFilterOptions(filterOptionsData);
        }
    }

    // Applica filtri resettati
    handleFilterChange();
}

