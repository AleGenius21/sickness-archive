// Funzione helper per convertire timestamp in YYYY-MM-DD
function timestampToDateString(timestamp) {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Funzione helper per formattare la data in formato leggibile (es. "Lun 22 Gen")
function formatDateString(date) {
    const days = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
    const months = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
    const dayName = days[date.getDay()];
    const day = date.getDate();
    const month = months[date.getMonth()];
    return `${dayName} ${day} ${month}`;
}

/**
 * Trasforma i dati del certificato di malattia in un formato compatibile con l'UI
 * @param {Object} cert - Certificato di malattia dal mockdata
 * @param {number} index - Indice progressivo per generare ID univoci
 * @returns {Object} Oggetto formattato per l'UI
 */
function transformCertificateData(cert, index) {
    // Determina lo status: in questo caso tutti sono approvati (status: 1) perché sono certificati INPS validi
    const status = 1; // Approvato
    
    // Calcola i giorni di malattia
    const dataInizio = new Date(cert.dataInizio + 'T00:00:00');
    const dataFine = new Date(cert.dataFine + 'T00:00:00');
    const diffTime = Math.abs(dataFine - dataInizio);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 per includere il giorno finale
    
    // Determina il tipo di certificato (descrizione leggibile)
    let tipoCertificatoDesc = '';
    switch(cert.tipoCertificato) {
        case 'C':
            tipoCertificatoDesc = 'Continuativo';
            break;
        case 'I':
            tipoCertificatoDesc = 'Iniziale';
            break;
        case 'P':
            tipoCertificatoDesc = 'Prolungamento';
            break;
        case 'R':
            tipoCertificatoDesc = 'Ricaduta';
            break;
        default:
            tipoCertificatoDesc = cert.tipoCertificato;
    }
    
    // Determina il tipo di visita
    let tipoVisitaDesc = '';
    switch(cert.tipoVisita) {
        case 'A':
            tipoVisitaDesc = 'Ambulatoriale';
            break;
        case 'D':
            tipoVisitaDesc = 'Domiciliare';
            break;
        default:
            tipoVisitaDesc = cert.tipoVisita;
    }
    
    // Crea moorea_obj per compatibilità con il sistema esistente
    const moorea_obj = {
        meta: {
            days: diffDays,
            hours: diffDays * 8, // Convenzione: 8 ore per giorno
            certificate_details_txt: `${diffDays} giorni di malattia - ${tipoCertificatoDesc}`
        },
        certificates: [{
            idCertificato: cert.idCertificato,
            dataInizio: cert.dataInizio,
            dataFine: cert.dataFine,
            tipoCertificato: cert.tipoCertificato,
            tipoCertificatoDesc: tipoCertificatoDesc,
            tipoVisita: cert.tipoVisita,
            tipoVisitaDesc: tipoVisitaDesc,
            dataRilascio: cert.dataRilascio,
            giorni: diffDays
        }]
    };
    
    return {
        id: index + 1000, // Genera ID univoco
        cf: cert.lav_cf,
        created_at: cert.created_at,
        updated_at: cert.updated_at,
        dataInizio: cert.dataInizio,
        dataFine: cert.dataFine,
        giornataIntera: 1, // Malattia sempre giornata intera
        oraInizio: null,
        oraFine: null,
        quantitaOre: diffDays * 480, // 480 minuti = 8 ore per giorno
        note: `Certificato INPS ${cert.idCertificato}`,
        status: status,
        type: 1, // Usa type: 1 per malattia (riutilizziamo la logica delle ferie per consistenza)
        type_name: 'MALATTIA',
        tipo_richiesta: 'MALATTIA',
        nominativo: `${cert.lav_nome} ${cert.lav_cognome}`,
        department_id: null,
        department_name: 'Nessun reparto',
        department_color: '#E1E5E9',
        task_id: null,
        task_name: null,
        task_color: null,
        profile_pic: null, // Verrà generato automaticamente dal component
        moorea_obj: moorea_obj,
        moorea_id: cert.idCertificato,
        // Dati specifici del certificato
        medico_cf: cert.medico_cf,
        medico_nome: `${cert.medico_nome} ${cert.medico_cognome}`,
        medico_codiceRegione: cert.medico_codiceRegione,
        medico_codiceAsl: cert.medico_codiceAsl,
        matricolaINPS: cert.matricolaINPS,
        tipoCertificato: cert.tipoCertificato,
        tipoCertificatoDesc: tipoCertificatoDesc,
        tipoVisita: cert.tipoVisita,
        tipoVisitaDesc: tipoVisitaDesc,
        dataRilascio: cert.dataRilascio
    };
}

/**
 * Carica i dati dei certificati di malattia dal mockdata.JSON
 * @returns {Promise<Array>} Array di certificati trasformati
 */
async function loadSicknessData() {
    try {
        const response = await fetch('mockdata/mockdata.JSON');
        if (!response.ok) {
            throw new Error(`Errore nel caricamento: ${response.status}`);
        }
        const data = await response.json();
        
        if (!data.items || !Array.isArray(data.items)) {
            throw new Error('Formato dati non valido: manca array items');
        }
        
        // Trasforma i certificati in formato compatibile con l'UI
        const transformedData = data.items.map((cert, index) => transformCertificateData(cert, index));
        
        console.log('[MAIN] Certificati di malattia caricati:', transformedData.length);
        return transformedData;
    } catch (error) {
        console.error('[MAIN] Errore nel caricamento dei certificati:', error);
        return [];
    }
}

// Inizializzazione quando il DOM è pronto
document.addEventListener("DOMContentLoaded", async function () {
    // Carica i dati dei certificati di malattia
    const sicknessData = await loadSicknessData();
    
    // Inizializza Filter Bar con i dati caricati
    if (typeof initFilterBar === "function") {
        try {
            await initFilterBar(sicknessData);
        } catch (error) {
            console.error(
                "Errore nell'inizializzazione del Filter Bar:",
                error
            );
        }
    }

    // Inizializza Detail Panel e carica calendario con tutti i dati disponibili
    if (typeof initDetailPanel === "function") {
        // Passa i dati del calendario direttamente a initDetailPanel
        // che li caricherà dopo che il contenuto HTML è stato caricato
        initDetailPanel(sicknessData);
    }
});
