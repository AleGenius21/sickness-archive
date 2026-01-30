/**
 * Detail Panel Component
 * Gestisce l'apertura e chiusura del pannello laterale di dettaglio con calendario mese per mese
 */

let detailPanelElement = null;
let listSectionElement = null;
let isInitialized = false;
let currentRequestData = null;
let allRequestsForCalendar = [];
let allCalendarData = []; // Tutti i dati disponibili per il calendario
let selectedDay = null; // Giorno selezionato nel calendario {year, month, day}
let selectedPeriodStart = null; // Data inizio periodo selezionato
let selectedPeriodEnd = null; // Data fine periodo selezionato
let defaultDateApplied = false; // Flag: applica periodo "oggi" solo al primo caricamento
let displayedCalendarYear = new Date().getFullYear(); // Anno visualizzato nel calendario (solo Gen-Dic)
let displayedCalendarYearEnd = null; // Secondo anno quando periodo a cavallo tra due anni (24 mesi)
let yearPickerWindowStart = null; // Inizio finestra 12 anni nel dropdown (per frecce prev/next)

/**
 * Inizializza il componente detail panel
 * @param {Array} calendarData - Dati opzionali per il calendario (se forniti, vengono caricati dopo l'inizializzazione)
 */
function initDetailPanel(calendarData = null) {
	if (isInitialized) {
		return;
	}

	detailPanelElement = document.getElementById('detail-panel');
	listSectionElement = document.getElementById('listSection');

	if (!detailPanelElement || !listSectionElement) {
		console.error('Detail panel: elementi non trovati');
		return;
	}

	// Carica il contenuto HTML del pannello
	loadPanelContent().then(() => {
		// Apri automaticamente il panel per mostrare sempre il calendario
		detailPanelElement.classList.add('panel-open');
		listSectionElement.classList.add('panel-open');

		// Se sono stati forniti dati per il calendario, caricali ora
		if (calendarData && Array.isArray(calendarData) && calendarData.length > 0) {
			loadCalendarData(calendarData);
		}
	});

	isInitialized = true;
}

/**
 * Carica il contenuto HTML del pannello
 */
function loadPanelContent() {
	return new Promise((resolve, reject) => {
		if (detailPanelElement) {
			// Carica il contenuto HTML
			fetch('components/detail-panel/detail-panel.html')
				.then(response => response.text())
				.then(html => {
					detailPanelElement.innerHTML = html;

					// Attach event listener al pulsante di chiusura
					const closeBtn = document.getElementById('btnClosePanel');
					if (closeBtn) {
						closeBtn.addEventListener('click', closeDetailPanel);
					}

					// Setup event listeners per i preset buttons e year picker
					setupPresetButtons();
					setupYearPicker();

					resolve();
				})
				.catch(error => {
					console.error('Errore nel caricamento del detail panel:', error);
					// Fallback: crea struttura base
					detailPanelElement.innerHTML = `
                        <button class="btn-close-panel" id="btnClosePanel" aria-label="Chiudi" type="button">
                            <i class="bi bi-x-lg"></i>
                        </button>
                        <div class="panel-content">
							<div class="periodo-presets-container" id="past_periodoPresetsContainer">
								<button type="button" class="preset-btn" data-preset="last-month">Mese scorso</button>
								<button type="button" class="preset-btn" data-preset="last-six-month">Ultimi 6 mesi</button>
								<button type="button" class="preset-btn" data-preset="last-year">Anno scorso</button>
							</div>
                            <div class="periodo-presets-container" id="future_periodoPresetsContainer">
                                <button type="button" class="preset-btn" data-preset="next-week">Prossima settimana</button>
                                <button type="button" class="preset-btn" data-preset="next-15-days">Prossimi 15 giorni</button>
                                <button type="button" class="preset-btn" data-preset="next-month">Prossimo mese</button>
                            </div>
                            <div class="calendar-year-header-wrapper">
                                <div class="calendar-year-input-wrapper" aria-expanded="false">
                                    <input type="text" id="calendarYearInput" class="calendar-year-input" inputmode="numeric" pattern="[0-9\s\-]*" aria-label="Anno" aria-haspopup="dialog" aria-controls="yearPicker" />
                                    <span class="calendar-year-range-suffix" id="calendarYearRangeSuffix" aria-hidden="true"></span>
                                </div>
                                <div class="year-picker" id="yearPicker" role="dialog" aria-label="Scegli anno" hidden>
                                </div>
                            </div>
                            <div class="calendar-container" id="calendarContainer">
                                <!-- I calendari mese per mese verranno generati dinamicamente qui -->
                            </div>
                        </div>
                    `;

					const closeBtn = document.getElementById('btnClosePanel');
					if (closeBtn) {
						closeBtn.addEventListener('click', closeDetailPanel);
					}

					// Setup event listeners per i preset buttons e year picker
					setupPresetButtons();
					setupYearPicker();

					resolve();
				});
		} else {
			reject('Detail panel element not found');
		}
	});
}

/**
 * Apre il pannello di dettaglio con i dati della richiesta
 * @param {Object} requestData - Dati della richiesta selezionata
 */
function openDetailPanel(requestData) {
	if (!detailPanelElement || !listSectionElement) {
		console.error('Detail panel: elementi non trovati');
		return;
	}

	currentRequestData = requestData;

	// Ottieni tutte le richieste filtrate dalla lista corrente
	// Usa filteredRequestsData se disponibile globalmente, altrimenti usa allRequestsData
	if (typeof window.filteredRequestsData !== 'undefined' && window.filteredRequestsData && window.filteredRequestsData.length > 0) {
		allRequestsForCalendar = [...window.filteredRequestsData];
	} else if (typeof window.allRequestsData !== 'undefined' && window.allRequestsData && window.allRequestsData.length > 0) {
		allRequestsForCalendar = [...window.allRequestsData];
	} else {
		allRequestsForCalendar = [];
	}

	// Aggiungi classe per aprire il pannello
	detailPanelElement.classList.add('panel-open');
	listSectionElement.classList.add('panel-open');

	// Renderizza il calendario
	renderCalendar();
}

/**
 * Chiude il pannello di dettaglio
 * Nota: Il panel rimane sempre aperto, questa funzione può essere usata per altri scopi
 */
function closeDetailPanel() {
	if (!detailPanelElement || !listSectionElement) {
		return;
	}

	// Non chiudere completamente il panel, mantienilo sempre visibile
	// Rimuovi solo la selezione corrente
	currentRequestData = null;
	selectedDay = null;

	// Rimuovi evidenziazione giorno selezionato
	const selectedDayElements = document.querySelectorAll('.calendar-day.selected-day');
	selectedDayElements.forEach(el => el.classList.remove('selected-day'));
}

/**
 * Carica i dati per il calendario
 * @param {Array} data - Array di dati delle richieste (per ora sampleData, in futuro sarà da API)
 */
function loadCalendarData(data) {
	if (!Array.isArray(data)) {
		console.error('loadCalendarData: data deve essere un array');
		return;
	}

	allCalendarData = [...data];
	window.allCalendarData = allCalendarData; // Esponi globalmente per accesso da filters.js
	allRequestsForCalendar = [...data];

	// Renderizza il calendario
	renderCalendar();

	// Al primo caricamento: seleziona oggi di default ed esegui la chiamata di filtraggio
	applyDefaultTodaySelection();
}

/**
 * Renderizza il calendario mese per mese con tutte le richieste
 * @param {Array} data - Dati opzionali da usare (se non forniti, usa allCalendarData o allRequestsForCalendar)
 */
function renderCalendar(data = null) {
	const calendarContainer = document.getElementById('calendarContainer');
	if (!calendarContainer) {
		console.warn('renderCalendar: calendarContainer non trovato nel DOM');
		return;
	}

	// Svuota il container
	calendarContainer.innerHTML = '';

	// Usa i dati forniti, altrimenti usa allCalendarData se disponibile, altrimenti allRequestsForCalendar
	const requestsToUse = data || allCalendarData || allRequestsForCalendar || [];

	// Non mostrare più il messaggio "Nessuna richiesta" perché mostreremo sempre i 12 mesi

	// Estrai tutti i mesi unici dalle richieste
	const monthsMap = new Map();

	requestsToUse.forEach(request => {
		if (!request.moorea_obj || !request.moorea_obj.certificates || !Array.isArray(request.moorea_obj.certificates)) {
			return;
		}

		request.moorea_obj.certificates.forEach(cert => {
			const dateStr = cert.dataInizio || cert.dataFine;
			if (!dateStr) return;

			const date = new Date(dateStr + 'T00:00:00');
			if (isNaN(date.getTime())) return;

			const year = date.getFullYear();
			const month = date.getMonth(); // 0-11

			const monthKey = `${year}-${month}`;

			if (!monthsMap.has(monthKey)) {
				monthsMap.set(monthKey, {
					year: year,
					month: month,
					requests: []
				});
			}

			// Aggiungi la richiesta al mese se non è già presente
			const monthData = monthsMap.get(monthKey);
			if (!monthData.requests.find(r => r.id === request.id)) {
				monthData.requests.push(request);
			}
		});
	});

	// Anni da mostrare: due anni se periodo a cavallo (displayedCalendarYearEnd), altrimenti uno
	const yearsToDisplay = displayedCalendarYearEnd != null
		? [Math.min(displayedCalendarYear, displayedCalendarYearEnd), Math.max(displayedCalendarYear, displayedCalendarYearEnd)]
		: [displayedCalendarYear];

	// Popola monthsMap con i 12 mesi per ogni anno da mostrare
	yearsToDisplay.forEach(year => {
		for (let month = 0; month < 12; month++) {
			const monthKey = `${year}-${month}`;
			if (!monthsMap.has(monthKey)) {
				monthsMap.set(monthKey, {
					year: year,
					month: month,
					requests: []
				});
			}
		}
	});

	// Se c'è un periodo selezionato, assicurati che i suoi mesi negli anni visualizzati siano inclusi
	if (selectedPeriodStart && selectedPeriodEnd) {
		const startDate = new Date(selectedPeriodStart);
		const endDate = new Date(selectedPeriodEnd);
		startDate.setHours(0, 0, 0, 0);
		endDate.setHours(0, 0, 0, 0);

		const currentDate = new Date(startDate);
		while (currentDate <= endDate) {
			const year = currentDate.getFullYear();
			const month = currentDate.getMonth();
			if (!yearsToDisplay.includes(year)) {
				currentDate.setMonth(currentDate.getMonth() + 1);
				currentDate.setDate(1);
				continue;
			}
			const monthKey = `${year}-${month}`;
			if (!monthsMap.has(monthKey)) {
				monthsMap.set(monthKey, {
					year: year,
					month: month,
					requests: []
				});
			}
			currentDate.setMonth(currentDate.getMonth() + 1);
			currentDate.setDate(1);
		}
	}

	// Mesi degli anni visualizzati, ordinati cronologicamente (12 o 24 mesi)
	const sortedMonths = Array.from(monthsMap.values())
		.filter(m => yearsToDisplay.includes(m.year))
		.sort((a, b) => {
			if (a.year !== b.year) {
				return a.year - b.year;
			}
			return a.month - b.month;
		});

	// Genera calendario per ogni mese in ordine cronologico
	sortedMonths.forEach(monthData => {
		const monthCalendar = generateMonthCalendar(monthData.year, monthData.month, monthData.requests, currentRequestData);
		calendarContainer.appendChild(monthCalendar);
	});

	// Scrolla automaticamente al mese corrente (solo al primo rendering, se l'anno corrente è tra quelli visualizzati)
	const today = new Date();
	if (!window.calendarInitialized && yearsToDisplay.includes(today.getFullYear())) {
		window.calendarInitialized = true;
		setTimeout(() => {
			scrollToDate(today, true); // true = senza animazione al primo rendering
		}, 100);
	}

	updateCalendarYearInput();
}

/**
 * Genera il calendario per un singolo mese
 * @param {number} year - Anno
 * @param {number} month - Mese (0-11)
 * @param {Array} requests - Array di richieste per questo mese
 * @param {Object} selectedRequest - Richiesta selezionata (opzionale, per evidenziarla)
 * @returns {HTMLElement} Elemento DOM del calendario del mese
 */
function generateMonthCalendar(year, month, requests, selectedRequest) {
	const monthContainer = document.createElement('div');
	monthContainer.className = 'month-calendar';

	// Header del mese
	const monthHeader = document.createElement('div');
	monthHeader.className = 'month-header';
	const monthNames = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
		'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
	monthHeader.textContent = `${monthNames[month]} ${year}`;
	monthContainer.appendChild(monthHeader);

	// Griglia calendario
	const calendarGrid = document.createElement('div');
	calendarGrid.className = 'calendar-grid';

	// Header giorni settimana
	// const weekdays = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
	// weekdays.forEach(day => {
	// 	const dayHeader = document.createElement('div');
	// 	dayHeader.className = 'calendar-weekday';
	// 	dayHeader.textContent = day;
	// 	calendarGrid.appendChild(dayHeader);
	// });

	// Calcola il primo giorno del mese e quanti giorni ci sono
	const firstDay = new Date(year, month, 1);
	const lastDay = new Date(year, month + 1, 0);
	const daysInMonth = lastDay.getDate();
	const startingDayOfWeek = firstDay.getDay(); // 0 = Domenica

	// Crea mappa delle date con richieste per questo mese
	const dateRequestsMap = new Map();

	requests.forEach(request => {
		if (!request.moorea_obj || !request.moorea_obj.certificates) return;

		request.moorea_obj.certificates.forEach(cert => {
			const dateStr = cert.dataInizio || cert.dataFine;
			if (!dateStr) return;

			const date = new Date(dateStr + 'T00:00:00');
			if (isNaN(date.getTime())) return;

			if (date.getFullYear() === year && date.getMonth() === month) {
				const day = date.getDate();
				const dateKey = `${year}-${month}-${day}`;

				if (!dateRequestsMap.has(dateKey)) {
					dateRequestsMap.set(dateKey, []);
				}

				dateRequestsMap.get(dateKey).push({
					request: request,
					certificate: cert
				});
			}
		});
	});

	// Aggiungi celle vuote per allineare il primo giorno
	for (let i = 0; i < startingDayOfWeek; i++) {
		const emptyCell = document.createElement('div');
		emptyCell.className = 'calendar-day empty';
		calendarGrid.appendChild(emptyCell);
	}

	// Aggiungi celle per ogni giorno del mese
	for (let day = 1; day <= daysInMonth; day++) {
		const dayCell = document.createElement('div');
		dayCell.className = 'calendar-day';
		// Aggiungi attributi data per identificare il giorno
		dayCell.setAttribute('data-year', year);
		dayCell.setAttribute('data-month', month);
		dayCell.setAttribute('data-day', day);

		// Numero del giorno
		const dayNumber = document.createElement('div');
		dayNumber.className = 'calendar-day-number';
		dayNumber.textContent = day;

		// Aggiungi classe sunday se è domenica
		const dayOfWeek = new Date(year, month, day).getDay();
		const isoDate = `${year}-${month}-${day}`;
		// Verifica se "isoDate" è dentro all'array delle HOLIDAYS preso da chiamata di config

//		if (isoDate è inclusa nell'array) { 
//			dayNumber.classList.add('holiday');
//		}
	
		if (dayOfWeek === 0) { // 0 = Domenica
			dayNumber.classList.add('sunday');
		}

		dayCell.appendChild(dayNumber);

		const dateKey = `${year}-${month}-${day}`;
		const dayRequests = dateRequestsMap.get(dateKey) || [];

		// Conta certificati di malattia (usando Set per evitare duplicati)
		const sicknessRequests = new Set();
		let hasSelectedRequest = false;

		if (dayRequests.length > 0) {

			// Conta certificati unici
			dayRequests.forEach(({ request, certificate }) => {
				// Mappatura nuovo JSON: type 1=MALATTIA
				const isMalattia = request.type === 1 || request.type_name === 'MALATTIA';

				if (isMalattia) {
					sicknessRequests.add(request.id);
				}

				// Se questa è la richiesta selezionata, evidenziala
				if (selectedRequest && request.id === selectedRequest.id) {
					hasSelectedRequest = true;
				}

			});


			// Crea container per i badge
			const badgesContainer = document.createElement('div');
			badgesContainer.className = 'calendar-day-badges';

			// Aggiungi badge per MALATTIA se ci sono certificati
			if (sicknessRequests.size > 0) {
				const sicknessBadge = document.createElement('div');
				sicknessBadge.className = 'calendar-badge calendar-badge-malattia';
				sicknessBadge.textContent = `${sicknessRequests.size} in Malattia`;
				badgesContainer.appendChild(sicknessBadge);
			}

			// Aggiungi il container dei badge solo se ci sono badge
			if (badgesContainer.children.length > 0) {
				dayCell.appendChild(badgesContainer);
			}
		}

		// Evidenzia oggi
		const today = new Date();
		if (year === today.getFullYear() && month === today.getMonth() && day === today.getDate()) {
			dayCell.classList.add('today');
		}

		// Evidenzia range periodo selezionato
		if (selectedPeriodStart || selectedPeriodEnd) {
			const currentDate = new Date(year, month, day);
			currentDate.setHours(0, 0, 0, 0);

			if (selectedPeriodStart && selectedPeriodEnd) {
				// Range completo
				const startDate = new Date(selectedPeriodStart);
				startDate.setHours(0, 0, 0, 0);
				const endDate = new Date(selectedPeriodEnd);
				endDate.setHours(0, 0, 0, 0);

				if (currentDate.getTime() === startDate.getTime()) {
					dayCell.classList.add('period-start');
					if (currentDate.getTime() === endDate.getTime()) {
						dayCell.classList.add('period-end');
					}
				} else if (currentDate.getTime() === endDate.getTime()) {
					dayCell.classList.add('period-end');
				} else if (currentDate > startDate && currentDate < endDate) {
					dayCell.classList.add('period-range');
				}
			} else if (selectedPeriodStart) {
				// Solo inizio selezionato
				const startDate = new Date(selectedPeriodStart);
				startDate.setHours(0, 0, 0, 0);
				if (currentDate.getTime() === startDate.getTime()) {
					dayCell.classList.add('period-start');
				}
			}
		}

		// Aggiungi click handler al giorno (solo se non è una cella vuota)
		if (!dayCell.classList.contains('empty')) {
			dayCell.style.cursor = 'pointer';
			dayCell.addEventListener('click', function (event) {
				// Rimuovi evidenziazione selected-day (per compatibilità con selezione singola)
				const previousSelected = document.querySelectorAll('.calendar-day.selected-day');
				previousSelected.forEach(el => el.classList.remove('selected-day'));

				handleDayClick(year, month, day);
			});
		}

		calendarGrid.appendChild(dayCell);
	}

	monthContainer.appendChild(calendarGrid);

	return monthContainer;
}

/**
 * Gestisce il click su un giorno del calendario
 * Comportamento: 1 click = inizio, 2 click = fine (può essere stesso giorno), 3 click = reset e nuovo inizio
 * @param {number} year - Anno
 * @param {number} month - Mese (0-11)
 * @param {number} day - Giorno
 */
async function handleDayClick(year, month, day) {
	// Crea oggetto Date per il giorno selezionato
	const selectedDate = new Date(year, month, day);
	selectedDate.setHours(0, 0, 0, 0);

	// Gestione selezione periodo (range) con comportamento a 3 click
	if (!selectedPeriodStart) {
		// 1° click: imposta inizio periodo
		selectedPeriodStart = new Date(selectedDate);
		selectedPeriodEnd = null;
		// Imposta window.selectedPeriod per una singola data (stesso giorno per inizio e fine)
		window.selectedPeriod = {
			startDate: selectedPeriodStart,
			endDate: new Date(selectedPeriodStart)
		};
	} else if (!selectedPeriodEnd) {
		// 2° click: imposta fine periodo (può essere lo stesso giorno)
		selectedPeriodEnd = new Date(selectedDate);
		// Se la data di fine è precedente alla data di inizio, scambia
		if (selectedPeriodEnd < selectedPeriodStart) {
			const temp = selectedPeriodStart;
			selectedPeriodStart = selectedPeriodEnd;
			selectedPeriodEnd = temp;
		}
		// Applica il filtro periodo
		await applyPeriodFilter(selectedPeriodStart, selectedPeriodEnd);
	} else {
		// 3° click: uguale al 1° — svuota range e imposta nuova start
		selectedPeriodStart = new Date(selectedDate);
		selectedPeriodEnd = null;
		window.selectedPeriod = {
			startDate: selectedPeriodStart,
			endDate: new Date(selectedPeriodStart)
		};
		displayedCalendarYear = selectedDate.getFullYear();
		displayedCalendarYearEnd = null;
	}

	// Aggiorna il rendering del calendario per mostrare il range
	renderCalendar();

	// Se abbiamo un range completo, non chiamare loadAndDisplayDayData
	// Altrimenti, mantieni il comportamento originale per selezione singola
	if (!selectedPeriodEnd) {
		// Salva il giorno selezionato per compatibilità
		selectedDay = { year, month, day };

		// Rimuovi evidenziazione da giorno precedentemente selezionato
		const previousSelected = document.querySelectorAll('.calendar-day.selected-day');
		previousSelected.forEach(el => el.classList.remove('selected-day'));

		// Chiama funzione per caricare e mostrare i dati del giorno
		if (typeof window.loadAndDisplayDayData === 'function') {
			window.loadAndDisplayDayData(selectedDate);
		} else {
			console.warn('loadAndDisplayDayData non disponibile. Assicurati che filters.js sia caricato.');
		}
	}
}

/**
 * Applica il periodo "oggi" di default al primo caricamento e lancia la chiamata di filtraggio.
 * Eseguita una sola volta (flag defaultDateApplied).
 */
function applyDefaultTodaySelection() {
	if (defaultDateApplied) return;
	defaultDateApplied = true;

	const today = new Date();
	today.setHours(0, 0, 0, 0);
	applyPeriodFilter(today, today);
}

/**
 * Applica il filtro periodo e sincronizza con i filtri
 * @param {Date} startDate - Data inizio periodo
 * @param {Date} endDate - Data fine periodo
 */
async function applyPeriodFilter(startDate, endDate) {
	// Normalizza le date
	const normalizedStart = new Date(startDate);
	normalizedStart.setHours(0, 0, 0, 0);
	const normalizedEnd = new Date(endDate);
	normalizedEnd.setHours(23, 59, 59, 999);

	// Aggiorna le variabili globali
	selectedPeriodStart = normalizedStart;
	selectedPeriodEnd = normalizedEnd;

	// Allinea anni mostrati al periodo: due anni se a cavallo, altrimenti uno
	const startYear = normalizedStart.getFullYear();
	const endYear = normalizedEnd.getFullYear();
	if (startYear !== endYear) {
		displayedCalendarYear = startYear;
		displayedCalendarYearEnd = endYear;
	} else {
		displayedCalendarYear = startYear;
		displayedCalendarYearEnd = null;
	}

	// Aggiorna window.selectedPeriod per sincronizzazione con filtri
	window.selectedPeriod = {
		startDate: normalizedStart,
		endDate: normalizedEnd
	};

	// Ripristina allRequestsData con tutti i dati disponibili dal calendario
	// per assicurarsi che il filtro periodo abbia accesso a tutti i dati
	if (window.allCalendarData && Array.isArray(window.allCalendarData) && window.allCalendarData.length > 0) {
		window.allRequestsData = [...window.allCalendarData];
	}

	// Aggiorna il rendering del calendario PRIMA di applicare il filtro
	// per mostrare visivamente il periodo selezionato
	renderCalendar();

	// Nascondi lo spinner del filter-bar per assicurarsi che i filtri siano cliccabili
	if (typeof window.hideFilterSpinner === 'function') {
		window.hideFilterSpinner();
	}

	// Filtra le richieste per il periodo selezionato per generare le opzioni dei filtri
	// Le opzioni devono essere basate solo sulle richieste visibili nel periodo
	let periodFilteredData = [];
	if (window.allCalendarData && Array.isArray(window.allCalendarData) && window.allCalendarData.length > 0) {
		periodFilteredData = window.allCalendarData.filter(req => {
			// Controlla data_numerica (timestamp)
			if (req.data_numerica) {
				const reqDate = new Date(req.data_numerica);
				reqDate.setHours(0, 0, 0, 0);
				if (reqDate >= normalizedStart && reqDate <= normalizedEnd) {
					return true;
				}
			}

			// Controlla moorea_obj.certificates per range di date
			if (req.moorea_obj && req.moorea_obj.certificates && Array.isArray(req.moorea_obj.certificates)) {
				for (const cert of req.moorea_obj.certificates) {
					const certStartDate = cert.dataInizio ? new Date(cert.dataInizio + 'T00:00:00') : null;
					const certEndDate = cert.dataFine ? new Date(cert.dataFine + 'T00:00:00') : null;

					if (certStartDate && !isNaN(certStartDate.getTime())) {
						certStartDate.setHours(0, 0, 0, 0);
						// Se c'è solo dataInizio, controlla se cade nel periodo
						if (!certEndDate || isNaN(certEndDate.getTime())) {
							if (certStartDate >= normalizedStart && certStartDate <= normalizedEnd) {
								return true;
							}
						} else {
							// Se c'è un range, controlla se si sovrappone al periodo selezionato
							certEndDate.setHours(23, 59, 59, 999);
							// Sovrapposizione: inizio cert <= fine periodo E fine cert >= inizio periodo
							if (certStartDate <= normalizedEnd && certEndDate >= normalizedStart) {
								return true;
							}
						}
					}
				}
			}

			return false;
		});
	}

	// I filtri mantengono la configurazione cached iniziale, non serve ricaricarla
	// La configurazione è gestita dal sistema di cache in filters.js

	// Abilita i filtri solo se i dati sono stati caricati con successo
	// (periodFilteredData può essere vuoto ma i dati esistono in allCalendarData)
	if (typeof window.setFiltersEnabled === 'function') {
		// Abilita i filtri se ci sono dati disponibili (sia nel periodo che globalmente)
		const hasData = (periodFilteredData && periodFilteredData.length > 0) ||
			(window.allCalendarData && Array.isArray(window.allCalendarData) && window.allCalendarData.length > 0);
		window.setFiltersEnabled(hasData);
	}

	// Chiama handleFilterChange per applicare il filtro
	// Questo mostrerà le richieste che cadono nel periodo selezionato
	if (typeof window.handleFilterChange === 'function') {
		window.handleFilterChange();
	}
}

/**
 * Resetta la selezione del periodo
 */
function clearPeriodSelection() {
	// #region agent log
	const yearNow = new Date().getFullYear();
	fetch('http://127.0.0.1:7245/ingest/57d28e5c-5163-4687-8f30-5523f43df14d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'detail-panel.js:clearPeriodSelection:entry',message:'clearPeriodSelection sets displayedCalendarYear to today',data:{displayedCalendarYearSetTo:yearNow},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1,H2'})}).catch(()=>{});
	// #endregion
	selectedPeriodStart = null;
	selectedPeriodEnd = null;
	window.selectedPeriod = null;
	displayedCalendarYearEnd = null;
	displayedCalendarYear = new Date().getFullYear();

	// Rimuovi evidenziazione visiva dal calendario
	const periodDays = document.querySelectorAll('.calendar-day.period-start, .calendar-day.period-end, .calendar-day.period-range');
	periodDays.forEach(el => {
		el.classList.remove('period-start', 'period-end', 'period-range');
	});

	// Rimuovi classe active dai preset buttons
	const presetButtons = document.querySelectorAll('.preset-btn');
	presetButtons.forEach(btn => btn.classList.remove('active'));

	// Nascondi lo spinner del filter-bar per assicurarsi che i filtri siano cliccabili
	if (typeof window.hideFilterSpinner === 'function') {
		window.hideFilterSpinner();
	}

	// Disabilita i filtri quando il periodo viene rimosso
	if (typeof window.setFiltersEnabled === 'function') {
		window.setFiltersEnabled(false);
	}

	// Chiama handleFilterChange per rimuovere il filtro
	if (typeof window.handleFilterChange === 'function') {
		window.handleFilterChange();
	}

	// Aggiorna il rendering del calendario
	renderCalendar();
}

/**
 * Applica un preset al periodo
 * @param {string} preset - Nome del preset ('next-week', 'next-15-days', 'next-month', ecc.)
 */
async function applyPeriodoPreset(preset) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let startDate, endDate;

    switch (preset) {
        // --- NUOVI PRESET (PAST) ---
        case 'last-month':
            // Mese scorso: dal primo all'ultimo giorno del mese precedente
            startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            endDate = new Date(today.getFullYear(), today.getMonth(), 0);
            break;

        case 'last-six-month':
            // Ultimi 6 mesi: da 6 mesi fa ad oggi
            startDate = new Date(today);
            startDate.setMonth(today.getMonth() - 6);
            endDate = new Date(today);
            break;

        case 'last-year':
            // Anno scorso: dal 1° Gennaio al 31 Dicembre dell'anno precedente
            const lastYear = today.getFullYear() - 1;
            startDate = new Date(lastYear, 0, 1);
            endDate = new Date(lastYear, 11, 31);
            break;

        // --- PRESET ESISTENTI (FUTURE) ---
        case 'next-week':
            const daysUntilMonday = (8 - today.getDay()) % 7 || 7;
            startDate = new Date(today);
            startDate.setDate(today.getDate() + daysUntilMonday);
            endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + 6);
            break;

        case 'next-15-days':
            startDate = new Date(today);
            endDate = new Date(today);
            endDate.setDate(today.getDate() + 14);
            break;

        case 'next-month':
            startDate = new Date(today.getFullYear(), today.getMonth() + 1, 1);
            endDate = new Date(today.getFullYear(), today.getMonth() + 2, 0);
            break;

        default:
            return;
    }

    // Normalizza le date
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    // Mostra uno o due anni nel calendario a seconda che il periodo sia a cavallo
    const startYear = startDate.getFullYear();
    const endYear = endDate.getFullYear();
    if (startYear !== endYear) {
        displayedCalendarYear = startYear;
        displayedCalendarYearEnd = endYear;
    } else {
        displayedCalendarYear = startYear;
        displayedCalendarYearEnd = null;
    }
    updateCalendarYearInput();

    // Applica il filtro periodo
    await applyPeriodFilter(startDate, endDate);

    // Scrolla il calendario alla data di inizio se necessario
    setTimeout(() => {
        scrollToDate(startDate);
    }, 100);
}

/**
 * Scrolla il calendario alla data specificata
 * @param {Date} date - Data a cui scrollare
 * @param {boolean} instant - Se true, usa behavior: 'auto' (senza animazione), altrimenti 'smooth'
 */
function scrollToDate(date, instant = false) {
	const calendarContainer = document.getElementById('calendarContainer');
	if (!calendarContainer) return;

	const year = date.getFullYear();
	const month = date.getMonth();

	// Trova il mese corrispondente nel calendario
	const monthCalendars = calendarContainer.querySelectorAll('.month-calendar');
	monthCalendars.forEach(monthCalendar => {
		const monthHeader = monthCalendar.querySelector('.month-header');
		if (monthHeader) {
			const monthNames = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
				'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
			const headerText = `${monthNames[month]} ${year}`;
			if (monthHeader.textContent === headerText) {
				// Usa 'center' per mostrare il mese interamente visibile, 'auto' per il primo rendering senza animazione
				monthCalendar.scrollIntoView({ 
					behavior: instant ? 'auto' : 'smooth', 
					block: 'center' 
				});
			}
		}
	});
}

/**
 * Aggiorna il valore dell'input anno: un anno (es. "2025") o due anni (es. "2025 - 2026") dentro calendarYearInput.
 */
function updateCalendarYearInput() {
	const input = document.getElementById('calendarYearInput');
	const suffix = document.getElementById('calendarYearRangeSuffix');
	if (!input) return;
	if (displayedCalendarYearEnd != null) {
		input.value = displayedCalendarYear + ' - ' + displayedCalendarYearEnd;
	} else {
		input.value = String(displayedCalendarYear);
	}
	if (suffix) {
		suffix.textContent = '';
		suffix.style.display = 'none';
	}
}

const YEAR_PICKER_MIN = 1900;
const YEAR_PICKER_MAX = 2100;
const YEAR_PICKER_WINDOW_SIZE = 12;

/**
 * Ripopola il year-picker: header (prev/next + range) + griglia 4x3 di 12 anni.
 * yearPickerWindowStart definisce il primo anno della finestra; se null viene centrata su displayedCalendarYear.
 */
function populateYearPicker() {
	const yearPicker = document.getElementById('yearPicker');
	if (!yearPicker) return;

	if (yearPickerWindowStart == null) {
		// Centra la finestra su displayedCalendarYear (5 prima, 6 dopo)
		yearPickerWindowStart = Math.max(YEAR_PICKER_MIN, displayedCalendarYear - 5);
		yearPickerWindowStart = Math.min(yearPickerWindowStart, YEAR_PICKER_MAX - YEAR_PICKER_WINDOW_SIZE + 1);
	}
	const startYear = yearPickerWindowStart;
	const endYear = Math.min(startYear + YEAR_PICKER_WINDOW_SIZE - 1, YEAR_PICKER_MAX);

	yearPicker.innerHTML = '';

	// Header: prev, label range, next
	const header = document.createElement('div');
	header.className = 'year-picker-header';
	const btnPrev = document.createElement('button');
	btnPrev.type = 'button';
	btnPrev.className = 'year-picker-nav-btn';
	btnPrev.setAttribute('aria-label', 'Anni precedenti');
	btnPrev.textContent = '\u2039'; // single left-pointing angle
	const labelCenter = document.createElement('span');
	labelCenter.className = 'year-picker-header-label';
	labelCenter.textContent = startYear === endYear ? String(startYear) : startYear + ' – ' + endYear;
	const btnNext = document.createElement('button');
	btnNext.type = 'button';
	btnNext.className = 'year-picker-nav-btn';
	btnNext.setAttribute('aria-label', 'Anni successivi');
	btnNext.textContent = '\u203A'; // single right-pointing angle

	btnPrev.addEventListener('click', function (e) {
		e.stopPropagation();
		yearPickerWindowStart = Math.max(YEAR_PICKER_MIN, startYear - YEAR_PICKER_WINDOW_SIZE);
		populateYearPicker();
	});
	btnNext.addEventListener('click', function (e) {
		e.stopPropagation();
		yearPickerWindowStart = Math.min(YEAR_PICKER_MAX - YEAR_PICKER_WINDOW_SIZE + 1, startYear + YEAR_PICKER_WINDOW_SIZE);
		populateYearPicker();
	});

	header.appendChild(btnPrev);
	header.appendChild(labelCenter);
	header.appendChild(btnNext);
	yearPicker.appendChild(header);

	// Griglia 4x3
	const grid = document.createElement('div');
	grid.className = 'year-picker-grid';
	for (let y = startYear; y <= endYear; y++) {
		const btn = document.createElement('button');
		btn.type = 'button';
		btn.className = 'year-picker-btn' + (y === displayedCalendarYear ? ' selected' : '');
		btn.textContent = y;
		btn.setAttribute('data-year', y);
		if (y === displayedCalendarYear) btn.setAttribute('aria-pressed', 'true');
		btn.addEventListener('click', function (e) {
			e.stopPropagation();
			displayedCalendarYear = parseInt(this.getAttribute('data-year'), 10);
			displayedCalendarYearEnd = null;
			closeYearPicker();
			updateCalendarYearInput();
			renderCalendar();
			setTimeout(() => {
				scrollToDate(new Date(displayedCalendarYear, 0, 1), true);
			}, 50);
		});
		grid.appendChild(btn);
	}
	yearPicker.appendChild(grid);
}

function closeYearPicker() {
	const yearPicker = document.getElementById('yearPicker');
	const wrapper = document.querySelector('.calendar-year-input-wrapper');
	if (yearPicker) yearPicker.hidden = true;
	if (wrapper) wrapper.setAttribute('aria-expanded', 'false');
}

/**
 * Setup event listeners del year-picker (toggle su input, click outside). Popolamento fatto da populateYearPicker.
 */
function setupYearPicker() {
	const yearInput = document.getElementById('calendarYearInput');
	const yearPicker = document.getElementById('yearPicker');
	const wrapper = document.querySelector('.calendar-year-input-wrapper');
	if (!yearInput || !yearPicker) return;

	populateYearPicker();

	function openPicker() {
		yearPickerWindowStart = null; // Ricalcola finestra centrata su displayedCalendarYear
		populateYearPicker();
		yearPicker.hidden = false;
		if (wrapper) wrapper.setAttribute('aria-expanded', 'true');
	}

	yearInput.addEventListener('focus', function (e) {
		e.stopPropagation();
		openPicker();
	});
	yearInput.addEventListener('click', function (e) {
		e.stopPropagation();
		if (yearPicker.hidden) openPicker();
	});

	function parseYearInputValue(str) {
		const s = String(str).trim();
		const single = /^\s*(\d{4})\s*$/;
		const range = /^\s*(\d{4})\s*-\s*(\d{4})\s*$/;
		let m = s.match(range);
		if (m) {
			const a = parseInt(m[1], 10);
			const b = parseInt(m[2], 10);
			if (a >= YEAR_PICKER_MIN && a <= YEAR_PICKER_MAX && b >= YEAR_PICKER_MIN && b <= YEAR_PICKER_MAX)
				return { single: false, start: Math.min(a, b), end: Math.max(a, b) };
		}
		m = s.match(single);
		if (m) {
			const val = parseInt(m[1], 10);
			if (val >= YEAR_PICKER_MIN && val <= YEAR_PICKER_MAX)
				return { single: true, start: val, end: null };
		}
		return null;
	}

	yearInput.addEventListener('change', function () {
		const parsed = parseYearInputValue(yearInput.value);
		if (parsed) {
			displayedCalendarYear = parsed.start;
			displayedCalendarYearEnd = parsed.single ? null : parsed.end;
			updateCalendarYearInput();
			renderCalendar();
			setTimeout(() => scrollToDate(new Date(displayedCalendarYear, 0, 1), true), 50);
		} else {
			updateCalendarYearInput();
		}
	});
	yearInput.addEventListener('blur', function () {
		const parsed = parseYearInputValue(yearInput.value);
		if (!parsed) {
			updateCalendarYearInput();
		}
	});

	document.addEventListener('click', function closeOnOutsideClick(e) {
		if (yearPicker.hidden) return;
		if (!yearPicker.contains(e.target) && e.target !== yearInput && !wrapper.contains(e.target)) {
			closeYearPicker();
		}
	});

	updateCalendarYearInput();
}

/**
 * Setup event listeners per i preset buttons.
 * Un solo preset alla volta può essere attivo (1 di 6): rimuoviamo active da tutti i preset,
 * poi lo assegniamo solo al bottone cliccato.
 */
function setupPresetButtons() {
    const presetContainers = document.querySelectorAll('.periodo-presets-container');

    presetContainers.forEach(container => {
        const presetButtons = container.querySelectorAll('.preset-btn');

        presetButtons.forEach(btn => {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();

                // Rimuovi active da TUTTI i preset (tutti i container), così solo uno resta attivo
                document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));

                this.classList.add('active');

                const preset = this.getAttribute('data-preset');
                applyPeriodoPreset(preset);
            });
        });
    });
}

// Esponi funzioni globalmente per accesso da altri componenti
window.loadCalendarData = loadCalendarData;
window.clearPeriodSelection = clearPeriodSelection;

