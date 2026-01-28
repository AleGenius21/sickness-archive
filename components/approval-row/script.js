/**
 * Formatta una data YYYY-MM-DD in formato "dd/MM/yy" (es. "22/01/25")
 * @param {string} dateString 
 * @returns {string}
 */
function formatDateDDMMYY(dateString) {
	if (!dateString) return '';
	const date = new Date(dateString + 'T00:00:00');
	if (isNaN(date.getTime())) return dateString;

	const day = String(date.getDate()).padStart(2, '0');
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const year = String(date.getFullYear()).slice(-2); // Ultime 2 cifre

	return `${day}/${month}/${year}`;
}

/**
 * Formatta una data YYYY-MM-DD in formato "Gio dd/MM/yy" (es. "Gio 28/01/26")
 * Restituisce HTML con span per il giorno della settimana
 * @param {string} dateString 
 * @returns {string}
 */
function formatDayDDMMYY(dateString) {
	if (!dateString) return '';
	const date = new Date(dateString + 'T00:00:00');
	if (isNaN(date.getTime())) return dateString;

	const giorniSettimana = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
	const giornoSettimana = giorniSettimana[date.getDay()];
	const day = String(date.getDate()).padStart(2, '0');
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const year = String(date.getFullYear()).slice(-2);

	return `<span class="day-name">${giornoSettimana}</span> ${day}/${month}/${year}`;
}

/**
 * Formatta un orario da HH:mm:ss a HH:mm (rimuove i secondi)
 * @param {string} timeString - Orario in formato HH:mm:ss o HH:mm
 * @returns {string} Orario formattato come HH:mm
 */
function formatTimeToHHMM(timeString) {
	if (!timeString || typeof timeString !== 'string') return timeString || '';
	// Se la stringa è lunga almeno 5 caratteri (es. 09:00 o 09:00:00), prendi i primi 5
	return timeString.length >= 5 ? timeString.substring(0, 5) : timeString;
}

/**
 * Formatta una data YYYY-MM-DD in formato italiano (es. "Gio 18 Dic")
 * @param {string} dateString - Data in formato YYYY-MM-DD
 * @returns {string} Data formattata in italiano
 */
function formatDateItalian(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString + 'T00:00:00');
    if (isNaN(date.getTime())) return dateString;
    
    const giorniSettimana = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
    const mesi = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
    
    return `${giorniSettimana[date.getDay()]} ${date.getDate()} ${mesi[date.getMonth()]}`;
}

/**
 * Normalizza una quantità di ore o giorni secondo le regole specificate
 * Per ORE: arrotonda a intero o step di 0.5 (1 = 1 ora, 2.5 = 2 ore 30 min, 2.77 → 3 = 3 ore)
 * Per GIORNI: arrotonda sempre ad un intero
 * @param {number} value - Valore da normalizzare
 * @param {string} unit - Unità: 'hours' per ore, 'days' per giorni
 * @returns {number} Valore normalizzato
 */
function normalizeQuantity(value, unit) {
	if (typeof value !== 'number' || isNaN(value)) {
		return value;
	}
	if (unit === 'hours') {
		const remainder = value % 1;
		if (remainder === 0 || remainder === 0.5) {
			return value;
		}
		if (remainder < 0.25) {
			return Math.floor(value);
		} else if (remainder < 0.75) {
			return Math.floor(value) + 0.5;
		} else {
			return Math.ceil(value);
		}
	} else if (unit === 'days') {
		return Math.round(value);
	}
	return value;
}


/**
 * Estrae e formatta la quantità di giorni di malattia da moorea_obj.meta
 * Per MALATTIA: estrae meta.days e formatta come "{days}g" (es. "3g")
 * Usa normalizeQuantity per normalizzare i valori
 * @param {Object} data - Oggetto contenente i dati del certificato
 * @returns {string} Stringa formattata con quantità (es. "3g")
 */
function extractQuantityFromMoorea(data) {
	if (data.moorea_obj && data.moorea_obj.meta) {
		const meta = data.moorea_obj.meta;
		
		if (typeof meta.days === 'number') {
			// MALATTIA: usa meta.days e normalizza, poi formatta come "3g"
			const normalizedDays = normalizeQuantity(meta.days, 'days');
			return normalizedDays + 'g';
		}
	}
	// Default: restituisci stringa vuota se non ci sono dati
	return '';
}

/**
 * Estrae le informazioni di data da dataInizio/dataFine per certificati di malattia
 * Per MALATTIA: mostra range "Da X a Y" se date diverse, altrimenti solo data (sempre giornata intera)
 * @param {Object} data - Oggetto contenente i dati del certificato
 * @returns {Object} Oggetto con { dateText: string, timeText: null }
 */
function extractDateInfoFromMoorea(data) {
	// Prova a usare dataInizio/dataFine (struttura root level)
	if (data.dataInizio) {
		let dateText = '';
		let timeText = null; // Malattia sempre giornata intera, nessun orario

		// MALATTIA: gestisci range date
		if (data.dataFine && data.dataFine !== data.dataInizio) {
			// Date diverse: formatta come "Da Mer 18 Dic a Mar 24 Dic"
			dateText = 'Da ' + formatDateItalian(data.dataInizio) + ' a ' + formatDateItalian(data.dataFine);
		} else {
			// Date uguali: mostra solo dataInizio
			dateText = formatDateItalian(data.dataInizio);
		}

		return { dateText, timeText };
	}

	// Fallback: prova a estrarre da moorea_obj.certificates
	if (data.moorea_obj && data.moorea_obj.certificates && Array.isArray(data.moorea_obj.certificates) && data.moorea_obj.certificates.length > 0) {
		const certificates = data.moorea_obj.certificates;

		// Ordina i certificates per dataInizio
		const sortedCerts = [...certificates].sort((a, b) => {
			const dateA = new Date(a.dataInizio || a.dataFine || '');
			const dateB = new Date(b.dataInizio || b.dataFine || '');
			return dateA - dateB;
		});

		// Prendi la prima e ultima data
		const firstCert = sortedCerts[0];
		const lastCert = sortedCerts[sortedCerts.length - 1];

		const firstDate = firstCert.dataInizio || firstCert.dataFine || '';
		const lastDate = lastCert.dataFine || lastCert.dataInizio || '';

		let dateText = '';
		let timeText = null; // Malattia sempre giornata intera

		// MALATTIA: gestisci range date
		if (firstDate === lastDate || sortedCerts.length === 1) {
			dateText = formatDateItalian(firstDate);
		} else {
			// Date diverse: formatta come "Da X a Y"
			dateText = 'Da ' + formatDateItalian(firstDate) + ' a ' + formatDateItalian(lastDate);
		}

		return { dateText, timeText };
	}

	// Fallback
	let dateText = data.data || '';
	let timeText = null;

	return { dateText, timeText };
}

/**
 * Converte colore in RGB (Helper)
 * Supporta hex (#RRGGBB), rgb(), hsl(), nomi CSS
 */
function parseColorToRgb(color) {
	if (!color || typeof color !== 'string') return null;
	const trimmedColor = color.trim();
	
	// Hex color (#RRGGBB)
	if (trimmedColor.startsWith('#')) {
		const hex = trimmedColor.slice(1);
		if (hex.length === 6) {
			return {
				r: parseInt(hex.substring(0, 2), 16),
				g: parseInt(hex.substring(2, 4), 16),
				b: parseInt(hex.substring(4, 6), 16)
			};
		}
		if (hex.length === 3) {
			// Short hex (#RGB)
			return {
				r: parseInt(hex[0] + hex[0], 16),
				g: parseInt(hex[1] + hex[1], 16),
				b: parseInt(hex[2] + hex[2], 16)
			};
		}
	}
	
	// RGB color (rgb(r, g, b) or rgba(r, g, b, a))
	const rgbMatch = trimmedColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
	if (rgbMatch) {
		return {
			r: parseInt(rgbMatch[1], 10),
			g: parseInt(rgbMatch[2], 10),
			b: parseInt(rgbMatch[3], 10)
		};
	}
	
	// HSL color (hsl(h, s%, l%) or hsla(h, s%, l%, a))
	const hslMatch = trimmedColor.match(/hsla?\((\d+),\s*(\d+)%,\s*(\d+)%/i);
	if (hslMatch) {
		const h = parseInt(hslMatch[1], 10) / 360;
		const s = parseInt(hslMatch[2], 10) / 100;
		const l = parseInt(hslMatch[3], 10) / 100;
		
		const c = (1 - Math.abs(2 * l - 1)) * s;
		const x = c * (1 - Math.abs((h * 6) % 2 - 1));
		const m = l - c / 2;
		
		let r, g, b;
		if (h < 1/6) {
			r = c; g = x; b = 0;
		} else if (h < 2/6) {
			r = x; g = c; b = 0;
		} else if (h < 3/6) {
			r = 0; g = c; b = x;
		} else if (h < 4/6) {
			r = 0; g = x; b = c;
		} else if (h < 5/6) {
			r = x; g = 0; b = c;
		} else {
			r = c; g = 0; b = x;
		}
		
		return {
			r: Math.round((r + m) * 255),
			g: Math.round((g + m) * 255),
			b: Math.round((b + m) * 255)
		};
	}
	
	// CSS color names - mappatura base
	const colorNames = {
		'black': { r: 0, g: 0, b: 0 },
		'white': { r: 255, g: 255, b: 255 },
		'red': { r: 255, g: 0, b: 0 },
		'green': { r: 0, g: 128, b: 0 },
		'blue': { r: 0, g: 0, b: 255 },
		'yellow': { r: 255, g: 255, b: 0 },
		'cyan': { r: 0, g: 255, b: 255 },
		'magenta': { r: 255, g: 0, b: 255 },
		'orange': { r: 255, g: 165, b: 0 },
		'firebrick': { r: 178, g: 34, b: 34 }
	};
	
	const lowerColor = trimmedColor.toLowerCase();
	if (colorNames[lowerColor]) {
		return colorNames[lowerColor];
	}
	
	// Fallback: prova a usare un elemento temporaneo per ottenere il colore
	try {
		const tempEl = document.createElement('div');
		tempEl.style.color = trimmedColor;
		document.body.appendChild(tempEl);
		const computedColor = window.getComputedStyle(tempEl).color;
		document.body.removeChild(tempEl);
		
		const rgbComputed = computedColor.match(/\d+/g);
		if (rgbComputed && rgbComputed.length >= 3) {
			return {
				r: parseInt(rgbComputed[0], 10),
				g: parseInt(rgbComputed[1], 10),
				b: parseInt(rgbComputed[2], 10)
			};
		}
	} catch (e) {
		// Ignora errori
	}
	
	return null;
}

/**
 * Calcola luminosità relativa per colore testo (Helper)
 * Implementazione WCAG completa con gamma correction
 */
function getRelativeLuminance(color) {
	const rgb = parseColorToRgb(color);
	if (!rgb) return 0.5;
	
	// Normalizza valori RGB a 0-1
	const r = rgb.r / 255;
	const g = rgb.g / 255;
	const b = rgb.b / 255;
	
	// Applica gamma correction (linearizzazione)
	const linearize = (val) => {
		return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
	};
	
	const rLinear = linearize(r);
	const gLinear = linearize(g);
	const bLinear = linearize(b);
	
	// Calcola luminosità relativa secondo WCAG
	const luminance = 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear;
	
	return luminance;
}


/**
 * Applica lo stile al badge reparto con colore dinamico
 * Gestisce automaticamente il colore del testo per garantire leggibilità
 * @param {HTMLElement} badgeElement - Elemento DOM del badge reparto
 * @param {string} departmentColor - Colore del reparto (es. "#FF0000", "rgb(255,0,0)", "hsl(0,100%,50%)")
 */
function applyDepartmentBadgeStyle(badgeElement, departmentColor) {
	if (!badgeElement || !departmentColor) {
		// Se non c'è colore, mantieni lo stile CSS di default
		return;
	}

	// Applica il colore di sfondo
	badgeElement.style.backgroundColor = departmentColor;

	// Calcola la luminosità relativa per determinare il colore del testo
	const luminance = getRelativeLuminance(departmentColor);

	// Se il colore è chiaro (luminosità > 0.5), usa testo nero, altrimenti bianco
	// Usiamo una soglia leggermente più bassa (0.45) per garantire migliore leggibilità
	const textColor = luminance > 0.45 ? '#000000' : '#ffffff';
	badgeElement.style.color = textColor;
}

/**
 * Applica lo stile al badge mansione con colore dinamico
 * Gestisce automaticamente il colore del testo per garantire leggibilità
 * @param {HTMLElement} badgeElement - Elemento DOM del badge mansione
 * @param {string} taskColor - Colore della mansione (es. "#00FF00", "rgb(0,255,0)", "hsl(120,100%,50%)")
 */
function applyTaskBadgeStyle(badgeElement, taskColor) {
	if (!badgeElement || !taskColor) {
		// Se non c'è colore, mantieni lo stile CSS di default
		return;
	}
	
	// Applica il colore di sfondo
	badgeElement.style.backgroundColor = taskColor;
	
	// Calcola la luminosità relativa per determinare il colore del testo
	const luminance = getRelativeLuminance(taskColor);
	
	// Se il colore è chiaro (luminosità > 0.5), usa testo nero, altrimenti bianco
	// Usiamo una soglia leggermente più bassa (0.45) per garantire migliore leggibilità
	const textColor = luminance > 0.45 ? '#000000' : '#ffffff';
	badgeElement.style.color = textColor;
}

/**
 * Crea una riga di approvazione per certificati di malattia
 * @param {Object} data - Oggetto contenente i dati del certificato
 * @param {string} data.nominativo - Nome completo del dipendente
 * @param {string} data.profile_pic - URL o path dell'immagine profilo
 * @param {string} data.task_name - Ruolo/mansione del dipendente
 * @param {string} data.department_name - Reparto
 * @param {string} data.tipo_richiesta - Tipo di richiesta ("MALATTIA")
 * @param {string} data.dataInizio - Data inizio malattia (formato: YYYY-MM-DD)
 * @param {string} data.dataFine - Data fine malattia (formato: YYYY-MM-DD)
 * @param {Object} [data.moorea_obj] - Oggetto moorea con meta e certificates
 * @param {Object} [data.moorea_obj.meta] - Metadati con days, certificate_details_txt
 * @param {Array} [data.moorea_obj.certificates] - Array di certificati con dettagli
 * @param {string} [data.tipoCertificatoDesc] - Descrizione tipo certificato
 * @param {string} [data.tipoVisitaDesc] - Descrizione tipo visita
 * @param {string} [data.medico_nome] - Nome del medico
 * @param {string} [data.idCertificato] - ID certificato INPS
 * @returns {HTMLElement} Elemento DOM della riga di approvazione
*/


function createApprovalRow(data) {
	// Creazione elemento riga principale
	const row = document.createElement('div');
	row.className = 'approval-row ms-1 me-3 mt-1';
	row.setAttribute('data-request-id', data.id || Math.random().toString(36).substr(2, 9));

	// ---------------------------------------------------------
	// SEZIONE 1: Profilo Dipendente (Sinistra)
	// ---------------------------------------------------------
	const employeeProfile = document.createElement('div');
	employeeProfile.className = 'employee-profile';

	const avatar = document.createElement('img');
	avatar.className = 'employee-avatar';

	// Funzione interna per generare URL avatar
	function generateAvatarUrl(data) {
		if (data.profile_pic) return data.profile_pic;
		if (data.immagine) return data.immagine;

		let seed = data.id || 0;
		const nome = data.nominativo || data.nome || '';
		if (!seed && nome) {
			let hash = 0;
			for (let i = 0; i < nome.length; i++) {
				hash = ((hash << 5) - hash) + nome.charCodeAt(i);
				hash = hash & hash;
			}
			seed = Math.abs(hash % 70) + 1;
		}
		return `https://i.pravatar.cc/43?img=${seed || Math.floor(Math.random() * 70) + 1}`;
	}

	avatar.src = generateAvatarUrl(data);
	const nome = data.nominativo || data.nome || '';
	avatar.alt = nome;
	avatar.onerror = function () {
		this.src = `https://i.pravatar.cc/43?img=${Math.floor(Math.random() * 70) + 1}`;
	};

	const employeeInfo = document.createElement('div');
	employeeInfo.className = 'employee-info';

	const employeeName = document.createElement('p');
	employeeName.className = 'employee-name';
	employeeName.textContent = nome;

	const employeeBadges = document.createElement('div');
	employeeBadges.className = 'employee-badges';

	// Badge Mansione
	const taskName = data.task_name || data.mansione;
	if (taskName) {
		const badgeMansione = document.createElement('span');
		badgeMansione.className = 'badge-mansione';
		badgeMansione.textContent = taskName;
		if (data.task_color) {
			applyTaskBadgeStyle(badgeMansione, data.task_color);
		}
		employeeBadges.appendChild(badgeMansione);
	}

	// Badge Reparto
	const badgeReparto = document.createElement('span');
	badgeReparto.className = 'badge-reparto';
	const deptName = data.department_name || data.reparto;
	const deptId = data.department_id;
	const deptColor = data.department_color;

	if (!deptId || !deptName || !deptColor) {
		badgeReparto.textContent = 'Nessun reparto';
		badgeReparto.style.backgroundColor = '#E1E5E9';
		badgeReparto.style.color = '#666666';
	} else {
		badgeReparto.textContent = deptName;
		applyDepartmentBadgeStyle(badgeReparto, deptColor);
	}

	employeeBadges.appendChild(badgeReparto);
	employeeInfo.appendChild(employeeName);
	employeeInfo.appendChild(employeeBadges);
	employeeProfile.appendChild(avatar);
	employeeProfile.appendChild(employeeInfo);

	// ---------------------------------------------------------
	// SEZIONE 2: Dettagli Richiesta (Centro) con WRAPPER
	// ---------------------------------------------------------
	const requestDetails = document.createElement('div');
	requestDetails.className = 'request-details';

	// Determina tipo
	const typeValue = data.type !== undefined ? data.type : (data.type_id !== undefined ? data.type_id : null);

	// --- 2.1 Tipo Richiesta (Wrapper min-width: 85px) ---
	const typeWrapper = document.createElement('div');
	typeWrapper.className = 'rd-wrapper-type'; // CSS include position: relative

	const typeBadge = document.createElement('span');
	typeBadge.className = 'request-type-badge';

	const tipoRichiesta = data.type_name || '';

	if (tipoRichiesta === 'MALATTIA' || typeValue === 1) {
		typeBadge.classList.add('badge-malattia');
	}
	typeBadge.textContent = tipoRichiesta || 'MALATTIA';

	typeWrapper.appendChild(typeBadge);

	// --- 2.2 Quantità (Wrapper min-width: 40px) ---
	const quantityWrapper = document.createElement('div');
	quantityWrapper.className = 'rd-wrapper-quantity mb-2';

	const quantitySpan = document.createElement('span');
	quantitySpan.className = 'request-quantity px-2';

	// Logica per visualizzazione quantità giorni di malattia
	const quantityText = extractQuantityFromMoorea(data); // Restituisce es. "3g"

	if (quantityText && quantityText.length > 0) {
		// Estrai l'ultimo carattere per capire l'unità (g)
		const unitChar = quantityText.slice(-1).toLowerCase();
		// Estrai la parte numerica
		const numberVal = quantityText.slice(0, -1);

		if (unitChar === 'g') {
			// GIORNI di malattia
			const label = (numberVal === '1') ? 'giorno' : 'giorni';
			quantitySpan.innerHTML = `
                <span class="qty-number">${numberVal}</span>
                <span class="qty-label pt-1">${label}</span>
            `;
		} else {
			// Fallback per formati non standard
			quantitySpan.textContent = quantityText;
		}
	} else {
		quantitySpan.textContent = '';
	}

	quantityWrapper.appendChild(quantitySpan);

	// --- 2.3 Data e Ora (Wrapper min-width: 200px) ---
	const datetimeWrapper = document.createElement('div');
	datetimeWrapper.className = 'rd-wrapper-datetime'; // CSS include position: relative

	// Logica per formattazione date malattia (sempre sola data, nessun orario)
	const dateInfo = extractDateInfoFromMoorea(data);
	
	const textContainer = document.createElement('div');
	textContainer.style.display = 'flex';
	textContainer.style.flexDirection = 'column';
	textContainer.style.alignItems = 'flex-start';

	// --- MALATTIA: Solo una riga "Da X a Y", testo normale ---
	
	let start = '', end = '';
	if (data.dataInizio) {
		start = formatDateDDMMYY(data.dataInizio);
		end = data.dataFine ? formatDateDDMMYY(data.dataFine) : start;
	} 
	else if (data.moorea_obj && data.moorea_obj.certificates && data.moorea_obj.certificates.length > 0) {
		const certificates = data.moorea_obj.certificates;
		const sortedCerts = [...certificates].sort((a, b) => new Date(a.dataInizio) - new Date(b.dataInizio));
		start = formatDateDDMMYY(sortedCerts[0].dataInizio);
		end = formatDateDDMMYY(sortedCerts[sortedCerts.length - 1].dataFine || sortedCerts[sortedCerts.length - 1].dataInizio);
	}

	if (start) {
		let htmlText;
		if (start === end) {
			htmlText = `Il ${start}`;
		} else {
			htmlText = `<span class="date-preposition">Da</span> ${start} <span class="date-preposition">a</span> ${end}`;
		}
		
		const simpleSpan = document.createElement('span');
		simpleSpan.className = 'date-range-normal'; // CSS per testo normale
		simpleSpan.innerHTML = htmlText;
		textContainer.appendChild(simpleSpan);
	}

	datetimeWrapper.appendChild(textContainer);

	// Appendere i wrapper al contenitore principale
	requestDetails.appendChild(typeWrapper);
	requestDetails.appendChild(quantityWrapper);
	requestDetails.appendChild(datetimeWrapper);

	// ---------------------------------------------------------
	// SEZIONE 3: Icona Stato (Destra)
	// ---------------------------------------------------------
	const statusIcon = document.createElement('div');
	statusIcon.className = 'approval-row-status-icon';
	
	// status: 1=Approvato, 2=Rifiutato
	if (data.status === 1) {
		statusIcon.innerHTML = '<i class="bi bi-check-lg"></i>';
		statusIcon.classList.add('status-approved');
	} else if (data.status === 2) {
		statusIcon.innerHTML = '<i class="bi bi-x-lg"></i>';
		statusIcon.classList.add('status-rejected');
	}

	// ---------------------------------------------------------
	// Assemblaggio Finale
	// ---------------------------------------------------------
	row.appendChild(employeeProfile);
	row.appendChild(requestDetails);
	row.appendChild(statusIcon);

	// Click event
	row.addEventListener('click', function (e) {
		if (typeof openDetailPanel === 'function') {
			openDetailPanel(data);
		}
	});

	return row;
}
