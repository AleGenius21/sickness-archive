/**
 * Mappatura codici INPS (Pagina 10-14 PDF)
 */
const SC_INPS_CODES = {
    tipoCertificato: {
        'I': 'Inizio',
        'C': 'Continuazione',
        'R': 'Ricaduta',
        'A': 'Annullato'
    },
    tipoVisita: {
        'A': 'Ambulatoriale',
        'D': 'Domiciliare',
        'P': 'Pronto Soccorso'
    },
    ruoloMedico: {
        'S': 'Medico SSN',
        'P': 'Libero Professionista'
    },
    agevolazioni: {
        'T': 'Terapia Salvavita',
        'C': 'Causa di Servizio',
        'I': 'Invalidità Riconosciuta'
    }
};

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
 * Calcola giorni tra due date
 * @param {string} start - Data inizio (YYYY-MM-DD)
 * @param {string} end - Data fine (YYYY-MM-DD)
 * @returns {number} Numero di giorni
 */
function calculateDaysDiff(start, end) {
    if (!start || !end) return 1;
    const d1 = new Date(start + 'T00:00:00');
    const d2 = new Date(end + 'T00:00:00');
    const diffTime = Math.abs(d2 - d1);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    return diffDays + 1; // Incluso l'ultimo giorno
}

/**
 * Formatta indirizzo da oggetto INPS
 * @param {Object} addrObj - Oggetto con via, civico, cap, comune, provincia
 * @returns {string} Indirizzo formattato
 */
function formatAddress(addrObj) {
    if (!addrObj) return 'Indirizzo non presente';
    // Supporta sia formato piatto che annidato
    const via = addrObj.via || '';
    const civ = addrObj.civico ? `, ${addrObj.civico}` : '';
    const cap = addrObj.cap || '';
    const com = addrObj.comune || '';
    const prov = addrObj.provincia || '';
    return `${via}${civ} - ${cap} ${com} (${prov})`;
}

/**
 * Crea una Card Malattia INPS Professionale con Accordion
 * @param {Object} data - L'oggetto dati contenente i campi specifici (mapping da XML)
 * @returns {HTMLElement} L'elemento DOM della card
 */
function createInpsSicknessCard(data) {
    // 1. Setup dei dati e fallback
    const id = data.id || 'N/A';
    const nomeDipendente = data.nominativo || (data.lavoratore ? `${data.lavoratore.cognome} ${data.lavoratore.nome}` : 'Dipendente Sconosciuto');
    const avatarUrl = data.profile_pic || `https://ui-avatars.com/api/?name=${encodeURIComponent(nomeDipendente)}&background=random`;
    const mansione = data.task_name || 'Impiegato';
    const reparto = data.department_name || 'Generale';
    
    // Date
    const dataInizio = data.dataInizio ? formatDateDDMMYY(data.dataInizio) : '--/--/--';
    const dataFine = data.dataFine ? formatDateDDMMYY(data.dataFine) : '--/--/--';
    const daysDiff = data.moorea_obj?.meta?.days || calculateDaysDiff(data.dataInizio, data.dataFine);

    // Decodifica Codici INPS
    const tipoCertLabel = SC_INPS_CODES.tipoCertificato[data.tipoCertificato] || 'Malattia';
    const tipoVisitaLabel = SC_INPS_CODES.tipoVisita[data.tipoVisita] || 'N/D';
    const ruoloMedicoLabel = SC_INPS_CODES.ruoloMedico[data.ruoloMedico] || 'N/D';
    
    // Dati Medico
    const nomeMedico = data.medico ? `${data.medico.cognome} ${data.medico.nome}` : (data.medico_nome || 'N/D');
    const idCertificato = data.idCertificato || data.idCertificatoRettificato || '---';

    // Indirizzi (Logica Pagina 3 PDF: Reperibilità vs Residenza)
    const indResidenza = formatAddress(data.residenza);
    // Se reperibilità è presente, usala, altrimenti "Come residenza"
    const hasReperibilita = data.reperibilita && data.reperibilita.indirizzo;
    const indReperibilita = hasReperibilita ? formatAddress(data.reperibilita.indirizzo) : '<span style="opacity:0.6">Coincide con residenza</span>';
    const presso = hasReperibilita && data.reperibilita.cognome ? `(Presso: ${data.reperibilita.cognome})` : '';

    // Wrapper
    const card = document.createElement('div');
    card.className = 'sc-pro-card-wrapper';
    card.setAttribute('data-id', id);

    // --- HEADER (Parte Visibile) ---
    const header = document.createElement('div');
    header.className = 'sc-pro-header';
    header.innerHTML = `
        <div class="sc-pro-user-section">
            <img src="${avatarUrl}" alt="${nomeDipendente}" class="sc-pro-avatar">
            <div class="sc-pro-user-info">
                <p>${nomeDipendente}</p>
                <div class="sc-pro-badges">
                    <span class="sc-pro-badge dept">${reparto}</span>
                    <span class="sc-pro-badge role">${mansione}</span>
                </div>
            </div>
        </div>

        <div class="sc-pro-main-info">
            <div class="sc-pro-type-box">
                <span class="sc-pro-type-label">Tipo Certificato</span>
                <span class="sc-pro-type-value">${tipoCertLabel}</span>
            </div>
            <div class="sc-pro-date-box">
                <span class="sc-pro-date-main">dal ${dataInizio} al ${dataFine}</span>
                <span class="sc-pro-duration">${daysDiff} giorni</span>
            </div>
        </div>

        <div class="sc-pro-actions">
            <div class="sc-pro-arrow">
                <i class="bi bi-chevron-down"></i>
            </div>
        </div>
    `;

    // --- BODY (Parte Accordion) ---
    const body = document.createElement('div');
    body.className = 'sc-pro-body';
    
    // Costruzione badge flags (Page 14 PDF: giornataLavorata, trauma, agevolazioni)
    let flagsHtml = '';
    if (data.giornataLavorata) flagsHtml += `<span class="sc-pro-tag tag-privato">Giornata Lavorata</span> `;
    if (data.trauma) flagsHtml += `<span class="sc-pro-tag tag-dom">Trauma</span> `;
    if (data.agevolazioni) {
        const agv = SC_INPS_CODES.agevolazioni[data.agevolazioni] || data.agevolazioni;
        flagsHtml += `<span class="sc-pro-tag tag-ssn">${agv}</span>`;
    }
    if (flagsHtml === '') flagsHtml = '<span class="sc-pro-value">-</span>';

    body.innerHTML = `
        <div class="sc-pro-details-grid">
            <!-- Colonna 1: Dati Protocollo & Medico -->
            <div class="sc-pro-detail-group">
                <h5>Dati Certificato</h5>
                <div class="sc-pro-field">
                    <span class="sc-pro-label">Protocollo (PUC):</span>
                    <span class="sc-pro-value" style="font-family:monospace">${idCertificato}</span>
                </div>
                <div class="sc-pro-field">
                    <span class="sc-pro-label">Medico:</span>
                    <span class="sc-pro-value">${nomeMedico}</span>
                </div>
                <div class="sc-pro-field">
                    <span class="sc-pro-label">Ruolo:</span>
                    <span class="sc-pro-value">${ruoloMedicoLabel}</span>
                </div>
                <div class="sc-pro-field">
                    <span class="sc-pro-label">Visita:</span>
                    <span class="sc-pro-tag tag-amb">${tipoVisitaLabel}</span>
                </div>
            </div>

            <!-- Colonna 2: Luoghi (Residenza e Reperibilità) -->
            <div class="sc-pro-detail-group">
                <h5>Luoghi di controllo</h5>
                <div class="sc-pro-field">
                    <span class="sc-pro-label">Residenza:</span>
                    <div class="sc-pro-value">${indResidenza}</div>
                </div>
                <div class="sc-pro-field" style="margin-top:8px;">
                    <span class="sc-pro-label">Reperibilità durante malattia:</span>
                    <div class="sc-pro-value" style="font-weight:600; color:#111;">${indReperibilita} ${presso}</div>
                </div>
            </div>

            <!-- Colonna 3: Info Aggiuntive e Note -->
            <div class="sc-pro-detail-group">
                <h5>Note & Indicatori</h5>
                <div class="sc-pro-field">
                    <span class="sc-pro-label">Indicatori:</span>
                    <div style="margin-top:4px;">${flagsHtml}</div>
                </div>
                <div class="sc-pro-field">
                    <span class="sc-pro-label">Data Rilascio:</span>
                    <span class="sc-pro-value">${data.dataRilascio ? formatDateDDMMYY(data.dataRilascio) : '-'}</span>
                </div>
            </div>
        </div>
    `;

    // Evento Click per Accordion
    header.addEventListener('click', (e) => {
        // Previeni se si clicca su pulsanti azione specifici se ce ne fossero
        card.classList.toggle('open');
    });

    card.appendChild(header);
    card.appendChild(body);

    return card;
}

/**
 * Funzione wrapper per creare le card (compatibilità con il sistema esistente)
 * Questa funzione decide quale tipo di card creare in base ai dati disponibili
 * @param {Object} data - Oggetto contenente i dati del certificato
 * @returns {HTMLElement} Elemento DOM della card certificato
 */
function createSicknessCard(data) {
    // Se i dati contengono gli oggetti strutturati (residenza, medico, ecc.)
    // usa la nuova card professionale con accordion
    if (data.residenza || data.medico || data.idCertificato) {
        return createInpsSicknessCard(data);
    }
    
    // Altrimenti usa la vecchia card come fallback (se necessario)
    // Questo assicura la retrocompatibilità
    console.warn('Dati non sufficienti per card professionale, uso fallback');
    return createInpsSicknessCard(data); // Usa comunque la nuova card
}
