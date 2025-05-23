// Calcola la distanza tra due coordinate geografiche in km
window.distanzaKm = function(lat1, lon1, lat2, lon2) {
    const R = 6371; // Raggio della Terra in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// Funzione per ottenere la velocità attuale
function getSimSpeed() {
    return window.simSpeed || 1;
}

// Definizione variabili globali per i timer simulati (devono essere PRIMA di ogni uso)
window._simIntervals = [];
window._simTimeouts = [];

// Variabili globali per ora simulata e stato running
window.simTime = window.simTime || 0; // secondi simulati
if (typeof defaultSimStart === "undefined") {
    var defaultSimStart = 8*3600; // 08:00:00
}
window.simRunning = (typeof window.simRunning === 'undefined') ? true : window.simRunning;

function formatSimTime(sec) {
    const h = Math.floor(sec/3600).toString().padStart(2,'0');
    const m = Math.floor((sec%3600)/60).toString().padStart(2,'0');
    return h+":"+m;
}

function updateSimClock() {
    const el = document.getElementById('sim-clock');
    if(el) {
        let t = window.simDay + ' ';
        let sec = window.simTime||0;
        // --- FIX: mostra sempre orario 00:00:00 dopo le 23:59:59 ---
        if (sec >= 24*3600) sec = 0;
        const h = Math.floor(sec/3600).toString().padStart(2,'0');
        const m = Math.floor((sec%3600)/60).toString().padStart(2,'0');
        const s = (sec%60).toString().padStart(2,'0');
        t += h+":"+m+":"+s;
        el.textContent = t;
    }
    const btn = document.getElementById('sim-startstop');
    if(btn) btn.textContent = window.simRunning ? '⏸️' : '▶️';
}

function simTick() {
    if(window.simRunning) {
        const giorniSettimanaIT = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
        let sec = window.simTime || 0;
        let dayIdx = typeof window.simDay !== 'undefined' ? giorniSettimanaIT.indexOf(window.simDay) : new Date().getDay();
        if(dayIdx === -1) dayIdx = new Date().getDay();
        
        // Incrementa il tempo simulato
        const nextSec = sec + getSimSpeed();
        
        // Gestisci il rollover giorno e orario
        if (nextSec >= 24*3600) {
            sec = 0; // Reset a mezzanotte
            dayIdx = (dayIdx + 1) % 7;
            window.simDay = giorniSettimanaIT[dayIdx];
        } else {
            sec = nextSec;
        }
        
        window.simTime = sec;
        updateSimClock();
    }
}

// Funzione per gestire intervalli simulati
function simInterval(fn, sec) {
    const id = setInterval(fn, sec * 1000 / getSimSpeed());
    window._simIntervals.push(id);
    return id;
}

// Funzione per gestire timeout simulati
function simTimeout(fn, sec) {
    const id = setTimeout(fn, sec * 1000 / getSimSpeed());
    window._simTimeouts.push(id);
    return id;
}

// Listener per il cambio velocità
if (typeof window !== 'undefined') {
    document.addEventListener('DOMContentLoaded', function() {
        const sel = document.getElementById('sim-speed');
        if (sel) {
            sel.addEventListener('change', function() {
                window.simSpeed = Number(sel.value) || 1;
            });
            // Imposta la velocità iniziale
            window.simSpeed = Number(sel.value) || 1;
        }
        // Inizializza ora simulata
        if(typeof window.simTimeInit === 'undefined') {
            window.simTime = defaultSimStart;
            window.simTimeInit = true;
        }
        updateSimClock();
        setInterval(simTick, 1000);
        // Gestione start/stop
        const btn = document.getElementById('sim-startstop');
        if(btn) {
            btn.onclick = function() {
                window.simRunning = !window.simRunning;
                updateSimClock();
                btn.textContent = window.simRunning ? '⏸️' : '▶️';
            };
        }
    });
}

// Funzione centralizzata per avanzamento stato mezzo
function setStatoMezzo(mezzo, nuovoStato) {
    const statoAttuale = mezzo.stato;
    if (
        nuovoStato === 7 || nuovoStato === 1 ||
        (nuovoStato > statoAttuale && nuovoStato <= 7)
    ) {
        mezzo.stato = nuovoStato;

        // Clear previous communications and keep only Report pronto if in appropriate state
        if (Array.isArray(mezzo.comunicazioni)) {
            const reportPronto = mezzo.comunicazioni.find(msg => msg.includes('Report pronto'));
            mezzo.comunicazioni = [];
            if (reportPronto && mezzo.stato === 3) {
                mezzo.comunicazioni.push(reportPronto);
            }
        }
        
        // At state 4, clear the report pronto and reset related flags
        if (nuovoStato === 4) {
            mezzo._reportProntoInviato = false;
            mezzo._menuOspedaliShown = false;
            mezzo.comunicazioni = []; // Clear all messages including Report pronto
        }

        mezzo._lastEvent = Date.now();
        aggiornaMissioniPerMezzo(mezzo);

        // Only remove mezzo from mission on states 1 and 7
        if (nuovoStato === 7 || nuovoStato === 1) {
            mezzo.chiamata = null;
            if (window.game && window.game.calls) {
                const calls = Array.from(window.game.calls.values());
                calls.forEach(call => {
                    if (call.mezziAssegnati && call.mezziAssegnati.includes(mezzo.nome_radio)) {
                        call.mezziAssegnati = call.mezziAssegnati.filter(n => n !== mezzo.nome_radio);
                        if (call.mezziAssegnati.length === 0 && window.game.ui && typeof window.game.ui.closeMissioneInCorso === 'function') {
                            window.game.ui.closeMissioneInCorso(call);
                        } else if(window.game.ui && typeof window.game.ui.updateMissioneInCorso === 'function') {
                            window.game.ui.updateMissioneInCorso(call);
                        }
                    }
                });
            }
        }

        if(window.game && window.game.ui && window.game.ui.updateStatoMezzi) window.game.ui.updateStatoMezzi(mezzo);
        if(window.game && window.game.updateMezzoMarkers) window.game.updateMezzoMarkers();
        if(window.game && window.game.updatePostazioneMarkers) window.game.updatePostazioneMarkers();
        gestisciAvanzamentoAutomaticoStati(mezzo);
        return true;
    }
    return false;
}

// Funzione per aggiungere una comunicazione a un mezzo e gestire lampeggio e ordinamento
function aggiungiComunicazioneMezzo(mezzo, messaggio) {
    if (!mezzo.comunicazioni) mezzo.comunicazioni = [];
    mezzo.comunicazioni.push(messaggio);
    mezzo._lastMsgTime = Date.now();
    mezzo._msgLampeggia = true;
    if (window.game && window.game.ui && window.game.ui.updateStatoMezzi) {
        window.game.ui.updateStatoMezzi();
    }
}

// Patch: quando il mezzo cambia stato, rimuovi il lampeggio e il messaggio
const _oldSetStatoMezzo = setStatoMezzo;
setStatoMezzo = function(mezzo, nuovoStato) {
    const prevStato = mezzo.stato;
    const res = _oldSetStatoMezzo.apply(this, arguments);
    if (res && mezzo._msgLampeggia && nuovoStato !== prevStato) {
        mezzo._msgLampeggia = false;
        if (mezzo.comunicazioni && mezzo.comunicazioni.length > 0) {
            mezzo.comunicazioni.pop();
        }
        if (window.game && window.game.ui && window.game.ui.updateStatoMezzi) {
            window.game.ui.updateStatoMezzi();
        }
    }
    return res;
};

function randomMinuti(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// --- GESTIONE AVANZAMENTO STATI AUTOMATICI MEZZO ---
function gestisciAvanzamentoAutomaticoStati(mezzo) {
    // Stato 1 -> 2: dopo 2-3 minuti simulati
    if (mezzo.stato === 1 && mezzo.chiamata && !mezzo._timerStato2) {
        mezzo._timerStato2 = simTimeout(() => {
            setStatoMezzo(mezzo, 2);
            mezzo._timerStato2 = null;
        }, randomMinuti(2, 3) * 60);    }
    // Stato 3: dopo 20-30 minuti simulati manda "report pronto"    
    if (mezzo.stato === 3 && !mezzo._timerReportPronto && !mezzo._reportProntoInviato) {
        mezzo._timerReportPronto = simTimeout(() => {
            mezzo.comunicazioni = (mezzo.comunicazioni || []).concat([`Report pronto`]);
            console.log('[DEBUG] Mezzo', mezzo.nome_radio, 'ha inviato REPORT PRONTO');
            mezzo._reportProntoInviato = true;
            if(window.game && window.game.ui && window.game.ui.updateStatoMezzi) window.game.ui.updateStatoMezzi(mezzo);
            aggiornaMissioniPerMezzo(mezzo);
            mezzo._timerReportPronto = null;
        }, randomMinuti(20, 30) * 60);
    }
    // Stato 4: timer parte solo DOPO conferma utente (vedi nota sotto)
}

// Per il passaggio a stato 4: chiamare questa funzione DOPO la conferma utente
function avanzaMezzoAStato4DopoConferma(mezzo) {
    if (mezzo.stato === 3 && mezzo._reportProntoInviato && !mezzo._timerStato4) {
        mezzo._timerStato4 = simTimeout(() => {
            setStatoMezzo(mezzo, 4);
            mezzo._timerStato4 = null;
        }, randomMinuti(5, 10) * 60);
    }
}

function gestisciStato3(mezzo, call) {
    // Use report text from chiamate template if available
    let reportText = 'Report pronto';
    if (call && call.selectedChiamata && call.selectedCase) {
        const reportOptions = call.selectedChiamata[call.selectedCase];
        if (reportOptions) {
            const mezzoType = mezzo.tipo_mezzo || '';
            // Map vehicle type to report type
            let reportKey = null;
            if (mezzoType.startsWith('MSB')) {
                reportKey = 'MSB';
            } else if (mezzoType.startsWith('MSA1')) {
                reportKey = 'MSA1';
            } else if (mezzoType.startsWith('MSA2')) {
                reportKey = 'MSA2';
            }
            if (reportKey && reportOptions[reportKey]) {
                reportText = reportOptions[reportKey];
            }
        }
    }

    // Automatically send report after 20-30 minutes
    if (mezzo.stato === 3 && !mezzo._timerReportPronto && !mezzo._reportProntoInviato) {
        mezzo._timerReportPronto = simTimeout(() => {
            mezzo.comunicazioni = (mezzo.comunicazioni || []).concat([reportText]);
            console.log('[DEBUG] Mezzo', mezzo.nome_radio, 'ha inviato report:', reportText);
            mezzo._reportProntoInviato = true;
            if(window.game && window.game.ui && window.game.ui.updateStatoMezzi) {
                window.game.ui.updateStatoMezzi(mezzo);
            }
            aggiornaMissioniPerMezzo(mezzo);
            mezzo._timerReportPronto = null;
        }, randomMinuti(20, 30) * 60);
    }
}

function aggiornaMissioniPerMezzo(mezzo) {
    if (!window.game || !window.game.calls) return;
    const calls = Array.from(window.game.calls.values());
    const call = calls.find(c => (c.mezziAssegnati||[]).includes(mezzo.nome_radio));
    if (call && window.game.ui && typeof window.game.ui.updateMissioneInCorso === 'function') {
        window.game.ui.updateMissioneInCorso(call);
    }
}

// --- AGGIORNA DISPONIBILITÀ MEZZI IN BASE ALLA CONVENZIONE/ORARIO ---
function aggiornaDisponibilitaMezzi() {
    const now = window.simTime
        ? (() => { 
            const d = new Date(); 
            d.setHours(Math.floor(window.simTime/3600), Math.floor((window.simTime%3600)/60), 0, 0); 
            return d; 
        })()
        : new Date();

    if (!window.game || !window.game.mezzi) return;

    const ora = now.getHours();
    const minuti = now.getMinutes();
    const giorno = now.getDay();

    if (!window._lastAvailabilityCheck) {
        window._lastAvailabilityCheck = { ora: -1, giorno: -1 };
    }

    const shouldUpdate = window._lastAvailabilityCheck.ora !== ora || 
                         window._lastAvailabilityCheck.giorno !== giorno;

    if (shouldUpdate) {
        console.log(`[INFO] Aggiornamento disponibilità mezzi - Ora: ${ora}:${minuti.toString().padStart(2, '0')}, Giorno: ${['DOM','LUN','MAR','MER','GIO','VEN','SAB'][giorno]}`);

        window.game.mezzi.forEach(m => {
            if (!m.chiamata) {
                // Usa solo la funzione isMezzoOperativo per determinare la disponibilità
                const orarioSimulato = ora.toString().padStart(2, '0') + ':' + minuti.toString().padStart(2, '0');
                // --- FIX: fallback se window.isMezzoOperativo non è ancora definita ---
                const isMezzoOperativoFn = window.isMezzoOperativo || (window.jsUtils && window.jsUtils.isMezzoOperativo);
                if (typeof isMezzoOperativoFn !== "function") {
                    console.error("Funzione isMezzoOperativo non trovata su window. Assicurati che orariMezzi.js sia caricato PRIMA di game.js");
                    return;
                }
                const disponibile = isMezzoOperativoFn(m, orarioSimulato, now);

                if (disponibile) {
                    if (m.stato === 8) {
                        console.log(`[INFO] Mezzo ${m.nome_radio || 'sconosciuto'} passa a disponibile (stato 1)`);
                        m.stato = 1;
                    }
                } else {
                    if (m.stato === 1) {
                        console.log(`[INFO] Mezzo ${m.nome_radio || 'sconosciuto'} passa a non disponibile (stato 8)`);
                        m.stato = 8;
                    }
                }
            }
        });

        if (window.game.updatePostazioneMarkers) {
            window.game.updatePostazioneMarkers();
        }
        // Aggiorna anche la tabella Stato Mezzi
        if (window.game.ui && typeof window.game.ui.updateStatoMezzi === 'function') {
            window.game.ui.updateStatoMezzi();
        }

        window._lastAvailabilityCheck.ora = ora;
        window._lastAvailabilityCheck.giorno = giorno;
    }
}

class EmergencyDispatchGame {
    constructor() {
        this.ui = new GameUI(this);
        this.calls = new Map();
        this.hospitals = [];
        this.indirizziReali = window.indirizziReali || [];
        this.chiamateTemplate = null;
        this.categorieIndirizzi = window.categorizzaIndirizzi ? window.categorizzaIndirizzi() : {
            abitazione: [],
            strada: [],
            azienda: [],
            scuola: [], 
            luogo_pubblico: [],
            rsa: []
        };

        simInterval(() => {
            aggiornaDisponibilitaMezzi();
            const now = window.simTime
                ? (() => { const d = new Date(); d.setHours(Math.floor(window.simTime/3600), Math.floor((window.simTime%3600)/60), 0, 0); return d; })()
                : new Date();

            (this.mezzi || []).forEach(async m => {
                if (m.stato === 2 && m.chiamata && !m._inMovimentoMissione) {
                    console.log('[DEBUG] Mezzo in stato 2:', m.nome_radio, 'chiamata:', m.chiamata);
                    m._inMovimentoMissione = true;
                    const call = Array.from(this.calls.values()).find(c => (c.mezziAssegnati||[]).includes(m.nome_radio));
                    if (!call) return;
                    const dist = distanzaKm(m.lat, m.lon, call.lat, call.lon);
                    let vel = await getVelocitaMezzo(m.tipo_mezzo);
                    let riduzione = 0;
                    if (call.codice === 'Rosso') riduzione = 0.15;
                    else if (call.codice === 'Giallo') riduzione = 0.10;
                    if (m.tipo_mezzo !== 'ELI') {
                        const traffico = 1 + (Math.random() * 0.2 - 0.1);
                        vel = vel * traffico;
                    }
                    vel = vel * (1 + riduzione);
                    const tempoArrivo = Math.round((dist / vel) * 60);
                    this.moveMezzoGradualmente(m, m.lat, m.lon, call.lat, call.lon, Math.max(tempoArrivo, 2), 3, () => {
                        this.ui.updateStatoMezzi(m);
                        this.updateMezzoMarkers();
                        m._inMovimentoMissione = false;
                        gestisciStato3.call(this, m, call);
                    });
                }
                if (m.stato === 4 && m.ospedale && !m._inMovimentoOspedale) {
                    m._inMovimentoOspedale = true;
                    const dist = distanzaKm(m.lat, m.lon, m.ospedale.lat, m.ospedale.lon);
                    let vel = await getVelocitaMezzo(m.tipo_mezzo);
                    let riduzione = 0;
                    if (m.codice_trasporto === 'Rosso') riduzione = 0.15;
                    else if (m.codice_trasporto === 'Giallo') riduzione = 0.10;
                    if (m.tipo_mezzo !== 'ELI') {
                        const traffico = 1 + (Math.random() * 0.2 - 0.1);
                        vel = vel * traffico;
                    }
                    vel = vel * (1 + riduzione);
                    const tempoArrivo = Math.round((dist / vel) * 60);                    this.moveMezzoGradualmente(m, m.lat, m.lon, m.ospedale.lat, m.ospedale.lon, Math.max(tempoArrivo, 2), 5, () => {
                        this.ui.updateStatoMezzi(m);
                        this.updateMezzoMarkers();
                        m._inMovimentoOspedale = false;
                        simTimeout(() => {
                            setStatoMezzo(m, 6);
                            aggiornaMissioniPerMezzo(m);
                            this.ui.updateStatoMezzi(m);
                            this.updateMezzoMarkers();
                            simTimeout(() => {
                                setStatoMezzo(m, 7);
                                if (window.game && window.game.gestisciStato7) window.game.gestisciStato7(m);
                            }, randomMinuti(5, 10) * 60);
                        }, randomMinuti(10, 20) * 60);
                    });
                }
            });
        }, 2);

        simInterval(() => {
            if (!window.game || !window.game.mezzi) return;
            const now = window.simTime || 0;
            window.game.mezzi.forEach(m => {
                if ([5,6,7].includes(m.stato)) {
                    if (!m._statoEnterTime || m._statoEnterTimeStato !== m.stato) {
                        m._statoEnterTime = now;
                        m._statoEnterTimeStato = m.stato;
                    }
                } else {
                    m._statoEnterTime = null;
                    m._statoEnterTimeStato = null;
                }
                if (m.stato === 5 && m._statoEnterTime && now - m._statoEnterTime > 25*60) {
                    setStatoMezzo(m, 6);
                    aggiornaMissioniPerMezzo(m);
                    m.comunicazioni = (m.comunicazioni||[]).concat([`[FORZATO] Libero in ospedale`]);
                    if(window.game.ui) window.game.ui.updateStatoMezzi(m);
                    if(window.game.updateMezzoMarkers) window.game.updateMezzoMarkers();
                }
                if (m.stato === 6 && m._statoEnterTime && now - m._statoEnterTime > 15*60) {
                    setStatoMezzo(m, 7);
                    if (window.game && window.game.gestisciStato7) window.game.gestisciStato7(m);
                }
            });
        }, 5);
    }

    async loadStatiMezzi() {
        if (this.statiMezzi) return;
        const res = await fetch('src/data/stati_mezzi.json');
        const json = await res.json();
        this.statiMezzi = {};
        (json.Sheet1 || []).forEach(s => {
            this.statiMezzi[s.Stato] = s;
        });
    }

    async loadChiamate() {
        try {
            // Prova prima con il path minuscolo (compatibile GitHub Pages)
            let response = await fetch('src/data/chiamate.json');
            if (!response.ok) {
                // Se fallisce, prova con la variante maiuscola (compatibilità locale)
                response = await fetch('src/data/Chiamate.json');
            }
            this.chiamateTemplate = await response.json();
        } catch (e) {
            console.error("Error loading chiamate:", e);
            this.chiamateTemplate = null;
        }
    }

    async initialize() {
        try {
            await this.loadChiamate();
            await this.loadStatiMezzi();
            await this.loadMezzi();
            this.initializeMap();
            await this.loadHospitals();
            // Start automatic call generation
            if (window.simTimeInit) {
                this.scheduleNextCall();
            }
        } catch (e) {
            console.error("Error during initialization:", e);
        }
    }

    // Schedule automatic new calls at random intervals based on simulated time
    scheduleNextCall() {
        // Determine current simulated hour
        const sec = window.simTime || 0;
        const hour = Math.floor(sec / 3600);
        // Daytime 7-19: shorter intervals, night: longer intervals
        let minInterval = 45; // seconds
        let maxInterval = 300; // seconds
        if (hour >= 7 && hour < 19) {
            minInterval = 45;
            maxInterval = 180;
        } else {
            minInterval = 180;
            maxInterval = 300;
        }
        const interval = Math.floor(Math.random() * (maxInterval - minInterval + 1)) + minInterval;
        simTimeout(() => {
            this.generateNewCall();
            this.scheduleNextCall();
        }, interval);
    }

    initializeMap() {
        if (this.map) {
            this.map.remove();
        }
        this.map = L.map('game-map').setView([45.685783, 9.636633], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(this.map);
        this.updatePostazioneMarkers();
        this.updateMezzoMarkers();
    }

    async loadMezzi() {
        try {
            const response = await fetch('src/data/mezzi_sra.json');
            let mezzi = await response.json();

            // Se il file JSON esporta un oggetto con una proprietà (es: { Sheet1: [...] }), estrai l'array
            if (!Array.isArray(mezzi)) {
                // Prova a prendere la prima proprietà array trovata
                const firstArray = Object.values(mezzi).find(v => Array.isArray(v));
                if (firstArray) mezzi = firstArray;
                else throw new Error("Il file mezzi_sra.json non contiene un array di mezzi valido.");
            }

            // Ogni riga del file è un mezzo distinto, nessuna manipolazione
            mezzi = mezzi.map(m => {
                let lat = m.lat ?? null;
                let lon = m.lon ?? null;
                if ((!lat || !lon) && m["Coordinate Postazione"]) {
                    const coords = m["Coordinate Postazione"].split(',').map(s => Number(s.trim()));
                    lat = coords[0];
                    lon = coords[1];
                }
                return {
                    nome_radio: m.nome_radio || m["Nome radio"] || "",
                    postazione: m.postazione || m["Nome Postazione"] || "",
                    tipo_mezzo: m.tipo_mezzo || m.Mezzo || "",
                    convenzione: m.convenzione || m["Convenzione"] || "",
                    "Orario di lavoro": m["Orario di lavoro"] || "",
                    lat: lat,
                    lon: lon,
                    stato: 1,
                    _marker: null,
                    _callMarker: null,
                    _ospedaleMarker: null
                };
            });

            this.mezzi = mezzi;

            // Una postazione può ospitare più mezzi (anche con stesso nome_radio)
            this.postazioniMap = {};
            mezzi.forEach(m => {
                if (!m.postazione || m.postazione.trim() === "" || !m.lat || !m.lon) return;
                const key = m.postazione.trim() + '_' + m.lat + '_' + m.lon;
                if (!this.postazioniMap[key]) {
                    this.postazioniMap[key] = {
                        nome: m.postazione.trim(),
                        lat: m.lat,
                        lon: m.lon,
                        mezzi: []
                    };
                }
                this.postazioniMap[key].mezzi.push(m);
            });

            // Load Creli dispatch center vehicles  
            try {  
                const resCreli = await fetch('src/data/Creli.json');  
                let creli = await resCreli.json();  
                if (!Array.isArray(creli)) {  
                    const arr = Object.values(creli).find(v => Array.isArray(v));  
                    creli = arr || [];  
                }  
                creli.forEach(item => {  
                    const nomePost = (item['Nome Postazione'] || '').trim();  
                    if (!nomePost) return;  
                    const coords = item['Coordinate Postazione']?.split(',').map(s => Number(s.trim())) || [];  
                    const lat = coords[0], lon = coords[1];  
                    if (lat == null || lon == null) return;  
                    // build mezzo object  
                    const mezzo = {  
                        nome_radio: (item['Nome radio'] || '').trim(),  
                        postazione: nomePost,  
                        tipo_mezzo: item['Mezzo'] || '',  
                        convenzione: item['Convenzione'] || '',  
                        'Orario di lavoro': item['Orario di lavoro'] || '',  
                        lat,  lon,  stato: 1,  isCreli: true,  _marker: null,  _callMarker: null,  _ospedaleMarker: null  
                    };  
                    // register in this.mezzi and postazioniMap  
                    this.mezzi.push(mezzo);  
                    const key = nomePost + '_' + lat + '_' + lon;  
                    if (!this.postazioniMap[key]) {  
                        this.postazioniMap[key] = { nome: nomePost, lat, lon, mezzi: [], isCreli: true };  
                    }  
                    this.postazioniMap[key].mezzi.push(mezzo);  
                });  
            } catch(e) { console.error('Error loading Creli.json:', e); }  

            aggiornaDisponibilitaMezzi();
            this.updatePostazioneMarkers();
            this.updateMezzoMarkers();
            this.updateActiveMissionMezzi();

            if (this.ui && typeof this.ui.updateStatoMezzi === 'function') {
                this.ui.updateStatoMezzi();
            }
        } catch (e) {
            console.error("Errore nel caricamento dei mezzi:", e);
        }
    }

    async loadHospitals() {
        try {
            const response = await fetch('src/data/ospedali.json');
            let hospitals = await response.json();

            hospitals = hospitals.map(hosp => {
                let lat = null, lon = null;
                if (hosp.COORDINATE) {
                    const coords = hosp.COORDINATE.split(',').map(s => Number(s.trim()));
                    lat = coords[0];
                    lon = coords[1];
                }
                return {
                    nome: hosp.OSPEDALE?.trim() || "",
                    lat,
                    lon,
                    indirizzo: hosp.INDIRIZZO || ""
                };
            }).filter(h => h.lat !== null && h.lon !== null && !isNaN(h.lat) && !isNaN(h.lon));

            // Add PS SOREU Laghi hospitals (prefix SRL)
            try {
                const resSRL = await fetch('src/data/PS SOREU laghi.json');
                let srlList = await resSRL.json();
                (Array.isArray(srlList) ? srlList : []).forEach(h => {
                    const coords = (h.COORDINATE||'').split(',').map(s => Number(s.trim()));
                    const lat = coords[0], lon = coords[1];
                    if (lat != null && lon != null) hospitals.push({ nome: `(SRL) ${h.OSPEDALE?.trim()||''}`, lat, lon, indirizzo: '' });
                });
            } catch(e) { console.error('Error loading PS SOREU laghi:', e); }

            // Add PS SOREU Metro hospitals (prefix SRM)
            try {
                const resSRM = await fetch('src/data/PS SOREU Metro.json');
                let srmList = await resSRM.json();
                (Array.isArray(srmList) ? srmList : []).forEach(h => {
                    const coords = (h.COORDINATE||'').split(',').map(s => Number(s.trim()));
                    const lat = coords[0], lon = coords[1];
                    if (lat != null && lon != null) hospitals.push({ nome: `(SRM) ${h.OSPEDALE?.trim()||''}`, lat, lon, indirizzo: '' });
                });
            } catch(e) { console.error('Error loading PS SOREU Metro:', e); }

            // Add PS SOREU Pianura hospitals (prefix SRP)
            try {
                const resSRP = await fetch('src/data/PS SOREU pianura.json');
                let srpList = await resSRP.json();
                (Array.isArray(srpList) ? srpList : []).forEach(h => {
                    const coords = (h.COORDINATE||'').split(',').map(s => Number(s.trim()));
                    const lat = coords[0], lon = coords[1];
                    if (lat != null && lon != null) hospitals.push({ nome: `(SRP) ${h.OSPEDALE?.trim()||''}`, lat, lon, indirizzo: '' });
                });
            } catch(e) { console.error('Error loading PS SOREU pianura:', e); }

            this.hospitals = hospitals;
            hospitals.forEach(hosp => {
                const marker = L.marker([hosp.lat, hosp.lon], { icon: this.getHospitalIcon() }).addTo(this.map)
                    .bindPopup(`<b>${hosp.nome}</b><br>${hosp.indirizzo || ""}`);
                hosp._marker = marker;
            });
            if (this.calls && this.ui && typeof this.ui.updateMissioneInCorso === 'function') {
                Array.from(this.calls.values()).forEach(call => {
                    this.ui.updateMissioneInCorso(call);
                });
            }
        } catch (e) {
            console.error("Errore nel caricamento degli ospedali:", e);
        }
    }

    updateActiveMissionMezzi() {
        if (!this.mezzi) return;
        this.mezzi.forEach(m => {
            if (m.chiamata || m.ospedale) {
                this.ui.updateStatoMezzi(m);
            }
        });
    }

    getHospitalIcon() {
        return L.divIcon({
            className: 'hospital-marker',
            html: `<div class="hospital-icon">H</div>`,
            iconSize: [28, 28],
            iconAnchor: [14, 28],
            popupAnchor: [0, -28]
        });
    }

    getPostazioneIcon(hasLiberi, isCreli = false) {
        const bg = isCreli ? "#ffffff" : (hasLiberi ? "#43a047" : "#d32f2f");
        return L.divIcon({
            className: 'postazione-marker',
            html: `<div style="font-size:18px;background:${bg};border-radius:6px;width:24px;height:24px;display:flex;align-items:center;justify-content:center;">🏠</div>`,
            iconSize: [24, 24],
            iconAnchor: [12, 24],
            popupAnchor: [0, -24]
        });
    }

    updatePostazioneMarkers() {
        if (!this.map || !this.postazioniMap) return;
        if (!this._postazioneMarkers) this._postazioneMarkers = [];
        this._postazioneMarkers.forEach(m => this.map.removeLayer(m));
        this._postazioneMarkers = [];
        
        Object.values(this.postazioniMap).forEach(postazione => {
            const mezziLiberi = (this.mezzi || []).filter(m => {
                const isDisponibile = m.stato === 1; // è in stato disponibile
                const inThisPostazione = m.postazione === postazione.nome; // appartiene alla postazione
                const correctCoordinates = Math.abs(m.lat - postazione.lat) < 0.0001 && 
                                         Math.abs(m.lon - postazione.lon) < 0.0001; // coordinate corrette
                
                return isDisponibile && inThisPostazione && correctCoordinates;
            });
            
            const hasLiberi = mezziLiberi.length > 0;
            
            const mezziPostazione = (this.mezzi || []).filter(m =>
                m.stato !== 8 &&
                m.postazione === postazione.nome &&
                Math.abs(m.lat - postazione.lat) < 0.0001 &&
                Math.abs(m.lon - postazione.lon) < 0.0001
            );
            
            let mezziHtml = '';
            if (mezziPostazione.length > 0) {
                mezziHtml = mezziPostazione.map(m => {
                    // Aggiungi un identificatore data per facilitare gli aggiornamenti tramite DOM
                    return `<div data-mezzo-id="${m.nome_radio}">
                        <b>${m.nome_radio}</b>
                        <span style="color:#555;">(${m.tipo_mezzo || '-'}</span>
                        <span style="color:#888;">${m.convenzione ? m.convenzione : ''}</span>)
                    </div>`;
                }).join('');
            } else {
                mezziHtml = `<div style="color:#d32f2f;"><i>Nessun mezzo</i></div>`;
            }
            
            const marker = L.marker([postazione.lat, postazione.lon], { 
                icon: this.getPostazioneIcon(hasLiberi, postazione.isCreli) 
            }).addTo(this.map)
            .bindPopup(`<div style="font-weight:bold;font-size:15px;">${postazione.nome}</div>${mezziHtml}`);
            
            marker.on('popupopen', () => {
                const mezziLiberiNow = (this.mezzi || []).filter(m =>
                    m.stato === 1 &&
                    m.postazione === postazione.nome &&
                    Math.abs(m.lat - postazione.lat) < 0.0001 &&
                    Math.abs(m.lon - postazione.lon) < 0.0001
                );
                const hasLiberiNow = mezziLiberiNow.length > 0;
                
                const mezziPostazioneNow = (this.mezzi || []).filter(m =>
                    m.stato !== 8 &&
                    m.postazione === postazione.nome &&
                    Math.abs(m.lat - postazione.lat) < 0.0001 &&
                    Math.abs(m.lon - postazione.lon) < 0.0001
                );
                
                let mezziHtmlNow = '';
                if (mezziPostazioneNow.length > 0) {
                    mezziHtmlNow = mezziPostazioneNow.map(m => {
                        return `<div data-mezzo-id="${m.nome_radio}">
                            <b>${m.nome_radio}</b>
                            <span style="color:#555;">(${m.tipo_mezzo || '-'}</span>
                            <span style="color:#888;">${m.convenzione ? m.convenzione : ''}</span>)
                        </div>`;
                    }).join('');
                } else {
                    mezziHtmlNow = `<div style="color:#d32f2f;"><i>Nessun mezzo</i></div>`;
                }
                
                marker.setPopupContent(
                    `<div style="font-weight:bold;font-size:15px;">${postazione.nome}</div>${mezziHtmlNow}`
                );
                marker.setIcon(this.getPostazioneIcon(hasLiberiNow, postazione.isCreli));
            });
            
            this._postazioneMarkers.push(marker);
        });
    }

    updateMezzoMarkers() {
        if (!this.map || !this.mezzi) return;
        this.mezzi.forEach(m => {
            if (m._marker) {
                this.map.removeLayer(m._marker);
                m._marker = null;
            }
        });
        this.mezzi.forEach(m => {            if (![2, 4, 7].includes(m.stato)) return;            // Usa immagini PNG invece delle emoji
            let iconUrl;
            if (["MSB", "MSA1_A", "MSA2_A"].includes(m.tipo_mezzo)) iconUrl = 'src/assets/MSB.png';
            else if (["MSA1", "MSA2"].includes(m.tipo_mezzo)) iconUrl = 'src/assets/MSA.png';
            else if (m.tipo_mezzo === "ELI") iconUrl = 'src/assets/ELI.png';
            else iconUrl = 'src/assets/marker-rosso.png';
            const icon = L.icon({
                iconUrl,
                iconSize: [36, 36],        // increased size
                iconAnchor: [18, 36],      // center bottom
                popupAnchor: [0, -36]
            });
            m._marker = L.marker([m.lat, m.lon], { icon }).addTo(this.map)
                .bindPopup(`<b>${m.nome_radio}</b><br>${m.postazione}<br>Stato: ${m.stato}`);
        });
    }

    async moveMezzoGradualmente(mezzo, lat1, lon1, lat2, lon2, durataMinuti, statoFinale, callback) {
        // Se non è ELI, usa percorso stradale
        let percorso = [[lat1, lon1], [lat2, lon2]];
        if (mezzo.tipo_mezzo !== 'ELI') {
            percorso = await getPercorsoStradaleOSRM(lat1, lon1, lat2, lon2);
        }
        // Calcola quanti step totali (1 step al secondo simulato)
        const stepTotali = durataMinuti * 60;
        let stepAttuale = 0;
        // Suddividi il percorso in stepTotali punti
        let puntiPercorso = [];
        if (percorso.length <= 2) {
            // fallback: linea retta
            for (let i = 0; i <= stepTotali; i++) {
                const frac = i / stepTotali;
                puntiPercorso.push([
                    lat1 + (lat2 - lat1) * frac,
                    lon1 + (lon2 - lon1) * frac
                ]);
            }
        } else {
            // Interpola i punti del percorso OSRM per avere stepTotali punti
            for (let i = 0; i < stepTotali; i++) {
                const t = i / stepTotali * (percorso.length - 1);
                const idx = Math.floor(t);
                const frac = t - idx;
                const p1 = percorso[idx];
                const p2 = percorso[Math.min(idx + 1, percorso.length - 1)];
                puntiPercorso.push([
                    p1[0] + (p2[0] - p1[0]) * frac,
                    p1[1] + (p2[1] - p1[1]) * frac
                ]);
            }
            puntiPercorso.push([lat2, lon2]);
        }
        const self = this;
        let canceled = false;
        function step() {
            if (!window.simRunning) {
                simTimeout(step, 1);
                return;
            }
            if (stepAttuale < puntiPercorso.length) {
                mezzo.lat = puntiPercorso[stepAttuale][0];
                mezzo.lon = puntiPercorso[stepAttuale][1];
                if (self.updateMezzoMarkers) self.updateMezzoMarkers();
                stepAttuale++;
                if (stepAttuale < puntiPercorso.length) {
                    simTimeout(step, 1);
                } else {
                    mezzo.lat = lat2;
                    mezzo.lon = lon2;
                    setStatoMezzo(mezzo, statoFinale);
                    if (self.updateMezzoMarkers) self.updateMezzoMarkers();
                    if (typeof callback === 'function') callback();
                }
            }
        }
        simTimeout(step, 1);
        mezzo._cancelMove = () => { canceled = true; };
    }

    generateNewCall() {
        // Seleziona prima il template di chiamata casuale
        let chiamataTemplate = null;
        let testo_chiamata = '';
        if (this.chiamateTemplate) {
            const keys = Object.keys(this.chiamateTemplate);
            const sel = keys[Math.floor(Math.random() * keys.length)];
            chiamataTemplate = this.chiamateTemplate[sel];
            testo_chiamata = chiamataTemplate.testo_chiamata;
        }
        // Determina lista indirizzi in base al placeholder nel testo
        const rawText = testo_chiamata || '';
        const match = rawText.match(/\(indirizzo ([^)]+)\)/i);
        let sourceList = window.indirizziReali || [];
        if (match) {
            const key = match[1].toLowerCase().trim().replace(/\s+/g, '_');
            if (this.categorieIndirizzi[key] && this.categorieIndirizzi[key].length) {
                sourceList = this.categorieIndirizzi[key];
            }
        }
        const idx = Math.floor(Math.random() * sourceList.length);
        const indirizzo = sourceList[idx] || { indirizzo: 'Indirizzo sconosciuto', lat: 45.68, lon: 9.67 };
        // Sostituisci ogni placeholder con l'indirizzo selezionato
        testo_chiamata = (testo_chiamata || '').replace(/\(indirizzo [^)]+\)/gi, indirizzo.indirizzo);
         
        // Randomly select case type (stabile/poco_stabile/critico)
        const caseTypes = ['caso_stabile', 'caso_poco_stabile', 'caso_critico'];
        const weights = [0.5, 0.3, 0.2]; // 50% stable, 30% less stable, 20% critical
        let selectedCase = null;

        const rand = Math.random();
        let sum = 0;
        for (let i = 0; i < weights.length; i++) {
            sum += weights[i];
            if (rand < sum) {
                selectedCase = caseTypes[i];
                break;
            }
        }

        const patologie = ['Trauma', 'Malore', 'Incidente', 'Dolore toracico', 'Dispnea', 'Altro'];
        const codici = ['Rosso', 'Giallo', 'Verde'];
        const patologia = patologie[Math.floor(Math.random() * patologie.length)];
        const codice = codici[Math.floor(Math.random() * codici.length)];

        const now = new Date();
        const year = now.getFullYear();
        const decina = Math.floor(year % 100 / 10);
        const unita = year % 10;
        if (!window._missioneProgressivo) window._missioneProgressivo = 0;
        window._missioneProgressivo++;
        const progressivo = window._missioneProgressivo.toString().padStart(6, '0');
        const missioneId = `${decina}${unita}1${progressivo}`;
        const id = 'C' + Date.now() + Math.floor(Math.random()*1000);
        const call = {
            id,
            missioneId,
            location: indirizzo.indirizzo,
            indirizzo: indirizzo.indirizzo,
            lat: indirizzo.lat,
            lon: indirizzo.lon,
            simText: testo_chiamata || `Paziente con ${patologia}`,
            patologia,
            codice,
            mezziAssegnati: [],
            selectedChiamata: chiamataTemplate,
            selectedCase: selectedCase
        };
        this.calls.set(id, call);
        this.ui.showNewCall(call);
        if (this.map) {
            const marker = L.marker([call.lat, call.lon], {
                icon: L.icon({
                    iconUrl: 'src/assets/marker-rosso.png',
                    iconSize: [36, 36],    // increased size
                    iconAnchor: [18, 36],  // center bottom
                    popupAnchor: [0, -36]
                })
            }).addTo(this.map).bindPopup(`<b>Chiamata</b><br>${call.indirizzo || call.location || 'Indirizzo sconosciuto'}`);
            call._marker = marker;
        }
    }

    openMissionPopup(call) {
        const popup = document.getElementById('popupMissione');
        if (!popup) return;
        // Centra il popup ogni volta che si apre
        popup.style.left = '50%';
        popup.style.top = '50%';
        popup.style.transform = 'translate(-50%, -50%)';
        popup.classList.remove('hidden');
        // Salva l'id della chiamata come attributo sul popup per referenza sicura
        popup.setAttribute('data-call-id', call.id);
        const mezzi = (this.mezzi || []).map(m => {
            const dist = (call.lat && call.lon && m.lat && m.lon)
                ? distanzaKm(m.lat, m.lon, call.lat, call.lon)
                : Infinity;
            return { ...m, _dist: dist };
        }).sort((a, b) => (a._dist || 0) - (b._dist || 0));

        // Funzione per aggiornare la tabella dei mezzi nel popup missione
        this.updateMissionPopupTable = function(call) {
            const mezziFiltrati = this.mezzi.filter(m => [1,2,6,7].includes(m.stato) || (call.mezziAssegnati||[]).includes(m.nome_radio));
            let html = `<table class='stato-mezzi-table' style='width:100%;margin-bottom:0;'>
                <thead><tr>
                    <th style='width:38%;text-align:left;'>Nome</th>
                    <th style='width:22%;text-align:left;'>Tipo</th>
                    <th style='width:24%;text-align:left;'>Convenzione</th>
                    <th style='width:16%;text-align:left;'>Distanza</th>
                </tr></thead>
                <tbody>`;
            mezziFiltrati.forEach(m => {
                const checked = (call.mezziAssegnati||[]).includes(m.nome_radio) ? 'checked' : '';
                let distanza = m._dist !== undefined && isFinite(m._dist)
                    ? `${m._dist.toFixed(1)} km`
                    : `<span data-mezzo-dist="${m.nome_radio}">...</span>`;
                let evidenzia = m.stato === 2 ? "background:#ffcdd2;" :
                               m.stato === 6 ? "background:#fff9c4;" :
                               "";
                html += `<tr style='${evidenzia}'>`+
                    `<td style='white-space:nowrap;padding:2px 4px;text-align:left;'><label style='display:flex;align-items:center;gap:4px;'><input type='checkbox' name='mezzi' value='${m.nome_radio}' ${checked} style='margin:0 2px 0 0;vertical-align:middle;'><span style='vertical-align:middle;'>${m.nome_radio}</span></label></td>`+
                    `<td style='padding:2px 4px;text-align:left;'>${m.tipo_mezzo || ''}</td>`+
                    `<td style='padding:2px 4px;text-align:left;'>${m.convenzione || ''}</td>`+
                    `<td style='padding:2px 4px;text-align:left;'>${distanza}</td>`+
                `</tr>`;
            });
            html += `</tbody></table>`;

            const mezziAssegnatiDiv = document.getElementById('mezziAssegnatiScroll');
            if (mezziAssegnatiDiv) mezziAssegnatiDiv.innerHTML = html;
        };

        const indirizzoSpan = document.getElementById('missione-indirizzo');
        if (indirizzoSpan) indirizzoSpan.textContent = call.location || call.indirizzo || '';
        const indirizzoInput = document.getElementById('indirizzo');
        if (indirizzoInput) {
            indirizzoInput.value = call.location || '';
            indirizzoInput.readOnly = true;
        }
        const luogoSelect = document.getElementById('luogo');
        if (luogoSelect) {
            luogoSelect.innerHTML = '';
            const opzioniLuogo = ['Casa', 'Strada', 'Esercizi pubblici', 'Impianto lavorativo', 'Impianto sportivo', 'Scuola', 'Altro'];
            opzioniLuogo.forEach(opt => {
                const option = document.createElement('option');
                option.value = opt;
                option.textContent = opt;
                if (call.luogo === opt) option.selected = true;
                luogoSelect.appendChild(option);
            });
        }
        const patologiaSelect = document.getElementById('patologia');
        if (patologiaSelect) {
            patologiaSelect.innerHTML = '';
            const opzioniPatologia = [
                'Traumatica','Cardiocircolatoria','Respiratoria','Neurologica','Psichiatrica','Tossicologica','Metabolica','Gastroenterologica','Urologica','Oculistica','Otorinolaringoiatrica','Dermatologica','Ostetrico-ginecologica','Infettiva','Neoplastica','Altra patologia','Non identificata'
            ];
            opzioniPatologia.forEach(opt => {
                const option = document.createElement('option');
                option.value = opt;
                option.textContent = opt;
                if (call.patologia === opt) option.selected = true;
                patologiaSelect.appendChild(option);
            });
        }
        const codiceSelect = document.getElementById('codice');
        if (codiceSelect) {
            codiceSelect.innerHTML = '';
            ['Rosso','Giallo','Verde'].forEach(opt => {
                const option = document.createElement('option');
                option.value = opt;
                option.textContent = opt;
                if (call.codice === opt) option.selected = true;
                codiceSelect.appendChild(option);
            });
        }
        const note1 = document.getElementById('note1');
        if (note1) note1.value = call.note1 || '';
        const note2 = document.getElementById('note2');
        if (note2) note2.value = call.note2 || '';

        const btnsRapidi = [
            {tipo:'MSB', label:'MSB'},
            {tipo:'MSA1', label:'MSA1'},
            {tipo:'MSA2', label:'MSA2'},
            {tipo:'ELI', label:'ELI'}
        ];
        const btnsRapidiDiv = document.getElementById('btnsRapidiMezzi');
        if (btnsRapidiDiv) {
            btnsRapidiDiv.innerHTML = btnsRapidi.map(b =>
                `<button type='button' class='btn-rapido-mezzo' data-tipo='${b.tipo}' style='font-size:15px;padding:2px 10px 2px 10px;border-radius:4px;background:#1976d2;color:#fff;border:none;line-height:1.2;min-width:44px;'>${b.label}</button>`
            ).join('');
        }

        // Mostra mezzi in stato 1, 2, 6, 7 oppure già assegnati
        const mezziFiltrati = mezzi.filter(m => [1,2,6,7].includes(m.stato) || (call.mezziAssegnati||[]).includes(m.nome_radio));
        let html = `<table class='stato-mezzi-table' style='width:100%;margin-bottom:0;'>
            <thead><tr>
                <th style='width:38%;text-align:left;'>Nome</th>
                <th style='width:22%;text-align:left;'>Tipo</th>
                <th style='width:24%;text-align:left;'>Convenzione</th>
                <th style='width:16%;text-align:left;'>Distanza</th>
            </tr></thead>
            <tbody>`;
        mezziFiltrati.forEach(m => {
            const checked = (call.mezziAssegnati||[]).includes(m.nome_radio) ? 'checked' : '';
            let distanza = (m._dist !== undefined && isFinite(m._dist))
                ? `${m._dist.toFixed(1)} km`
                : `<span data-mezzo-dist="${m.nome_radio}">...</span>`;
            let evidenzia = m.stato === 2 ? "background:#ffcdd2;" :
                           m.stato === 6 ? "background:#fff9c4;" :
                           "";
            html += `<tr style='${evidenzia}'>`+
                `<td style='white-space:nowrap;padding:2px 4px;text-align:left;'><label style='display:flex;align-items:center;gap:4px;'><input type='checkbox' name='mezzi' value='${m.nome_radio}' ${checked} style='margin:0 2px 0 0;vertical-align:middle;'><span style='vertical-align:middle;'>${m.nome_radio}</span></label></td>`+
                `<td style='padding:2px 4px;text-align:left;'>${m.tipo_mezzo || ''}</td>`+
                `<td style='padding:2px 4px;text-align:left;'>${m.convenzione || ''}</td>`+
                `<td style='padding:2px 4px;text-align:left;'>${distanza}</td>`+
            `</tr>`;
        });
        html += `</tbody></table>`;

        const mezziAssegnatiDiv = document.getElementById('mezziAssegnatiScroll');
        if (mezziAssegnatiDiv) mezziAssegnatiDiv.innerHTML = html;
        attachBtnListeners();

        function attachBtnListeners() {
            document.querySelectorAll('.btn-rapido-mezzo').forEach(btn => {
                btn.onclick = function() {
                    const tipo = btn.getAttribute('data-tipo');
                    // Seleziona solo il primo mezzo non ancora selezionato di quel tipo
                    const checkboxes = Array.from(document.querySelectorAll('#mezziAssegnatiScroll input[type=checkbox]'));
                    const mezziTipo = mezziFiltrati.filter(m => m.tipo_mezzo && m.tipo_mezzo.startsWith(tipo));
                    for (const m of mezziTipo) {
                        const cb = checkboxes.find(c => c.value === m.nome_radio);
                        if (cb && !cb.checked) {
                            cb.checked = true;
                            break;
                        }
                    }
                };
            });
        }
    }

    chiudiPopup() {
        const popup = document.getElementById('popupMissione');
        if (popup) popup.classList.add('hidden');
    }

    confirmCall() {
        const popup = document.getElementById('popupMissione');
        // Recupera l'id della chiamata dal popup
        const callId = popup?.getAttribute('data-call-id');
        const call = callId ? this.calls.get(callId) : null;
        if (!call) return;
        const luogo = document.getElementById('luogo')?.value || '';
        const patologia = document.getElementById('patologia')?.value || '';
        const codice = document.getElementById('codice')?.value || '';
        const note1 = document.getElementById('note1')?.value || '';
        const note2 = document.getElementById('note2')?.value || '';
        call.luogo = luogo;
        call.patologia = patologia;
        call.codice = codice;
        call.note1 = note1;
        call.note2 = note2;
        // Query robusta per i mezzi selezionati
        const mezziChecked = Array.from(document.querySelectorAll('#popupMissione input[type=checkbox][name=mezzi]:checked')).map(cb => cb.value);
        call.mezziAssegnati = mezziChecked;
        if (window.game && window.game.mezzi) {
            window.game.mezzi.forEach(m => {
                if (mezziChecked.includes(m.nome_radio)) {
                    m.chiamata = call;
                    // Reset report and menu flags for new mission assignment
                    m._reportProntoInviato = false;
                    m._timerReportPronto = null;
                    m._menuOspedaliShown = false;
                    if (m.stato === 1) setStatoMezzo(m, 2);
                }
            });
        }        // If mission already exists, update it; otherwise create new in Eventi in corso
        const missionElem = document.getElementById(`evento-${call.missioneId}`);
        if (missionElem) {
            this.ui.updateMissioneInCorso(call);
        } else {
            this.ui.moveCallToEventiInCorso(call);
        }
        popup?.classList.add('hidden');
        const callDiv = document.getElementById(`call-${call.id}`);
        if (callDiv) callDiv.remove();
        if (call._marker) call._marker.setIcon(L.icon({
            iconUrl: 'src/assets/marker-rosso.png',
            iconSize: [36, 36],    // increased size
            iconAnchor: [18, 36],  // center bottom
            popupAnchor: [0, -36]
        }));
    }

    gestisciStato7(mezzo) {
        const postazione = Object.values(this.postazioniMap).find(p => p.nome === mezzo.postazione);
        if (!postazione) return;
        if (Math.abs(mezzo.lat - postazione.lat) < 0.0001 && Math.abs(mezzo.lon - postazione.lon) < 0.0001) {
            setStatoMezzo(mezzo, 1);
            return;
        }
        const dist = distanzaKm(mezzo.lat, mezzo.lon, postazione.lat, postazione.lon);
        getVelocitaMezzo(mezzo.tipo_mezzo).then(vel => {
            const tempoRientro = Math.round((dist / vel) * 60);
            this.moveMezzoGradualmente(
                mezzo,
                mezzo.lat, mezzo.lon,
                postazione.lat, postazione.lon,
                Math.max(tempoRientro, 2),
                1,
                () => {
                    mezzo.comunicazioni = (mezzo.comunicazioni || []).concat([`Rientrato in postazione`]);
                    this.ui.updateStatoMezzi(mezzo);
                    this.updateMezzoMarkers();
                    this.updatePostazioneMarkers();
                }
            );
        });
    }
}

// Esportazione della classe EmergencyDispatchGame
if (typeof window !== 'undefined') {
    // Non ridefinire la classe se già presente
    if (!window.hasOwnProperty('EmergencyDispatchGame')) {
        window.EmergencyDispatchGame = EmergencyDispatchGame;
        console.log("EmergencyDispatchGame class initialized and exposed to global scope");
    }
}

// Funzione per ottenere un percorso stradale da OSRM tra due coordinate (ritorna array di [lat,lon])
async function getPercorsoStradaleOSRM(lat1, lon1, lat2, lon2) {
    const url = `https://router.project-osrm.org/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=full&geometries=geojson`;
    try {
        const resp = await fetch(url);
        const data = await resp.json();
        if (data.routes && data.routes[0] && data.routes[0].geometry && data.routes[0].geometry.coordinates) {
            // OSRM restituisce [lon,lat], convertiamo in [lat,lon]
            return data.routes[0].geometry.coordinates.map(([lon, lat]) => [lat, lon]);
        }
    } catch (e) {
        console.error('Errore richiesta OSRM:', e);
    }
    // fallback: linea retta
    return [[lat1, lon1], [lat2, lon2]];
}

// Funzione asincrona per ottenere la distanza su strada tramite OSRM (in km)
window.getDistanzaStradaleOSRM = async function(lat1, lon1, lat2, lon2, tipoMezzo = '') {
    if (tipoMezzo === 'ELI') {
        // Per ELI usa distanza in linea d'aria
        return distanzaKm(lat1, lon1, lat2, lon2);
    }
    const url = `https://router.project-osrm.org/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=false`;
    try {
        const resp = await fetch(url);
        const data = await resp.json();
        if (data.routes && data.routes[0] && typeof data.routes[0].distance === 'number') {
            return data.routes[0].distance / 1000; // metri -> km
        }
    } catch (e) {
        console.error('Errore richiesta OSRM per distanza:', e);
    }
    // fallback: linea retta
    return distanzaKm(lat1, lon1, lat2, lon2);
};

// Aggiorna la lista dei mezzi e i loro stati in tempo reale
GameUI.prototype.updateStatoMezzi = function(mezzoCambiato = null) {
    const div = document.getElementById('statoMezzi');
    if (!div || !window.game || !window.game.mezzi) return;

    // Ordina: prima i mezzi che hanno cambiato stato o ricevuto comunicazioni più di recente (escluso stato 8), poi tutti gli altri, poi quelli in stato 8 in fondo
    let mezzi = [...window.game.mezzi];

    // Mezzi in stato 8 separati
    const mezziStato8 = mezzi.filter(m => m.stato === 8);
    let altriMezzi = mezzi.filter(m => m.stato !== 8);

    // Calcola il timestamp più recente tra _lastEvent e ultimo messaggio
    altriMezzi.forEach(m => {
        let lastMsg = 0;
        if (Array.isArray(m.comunicazioni) && m.comunicazioni.length > 0) {
            // Consider only Report pronto messages for timestamp
            const reportMsg = m.comunicazioni.find(c => c.includes('Report pronto'));
            if (reportMsg) {
                lastMsg = m._lastMsgTime || 0;
            }
        }
        m._sortKey = Math.max(m._lastEvent || 0, lastMsg);
    });
    altriMezzi = altriMezzi.sort((a, b) => (b._sortKey || 0) - (a._sortKey || 0));
    mezziStato8.sort((a, b) => (a.nome_radio || '').localeCompare(b.nome_radio || ''));

    // Layout a 3 colonne
    div.innerHTML = '';
    div.style.maxHeight = '350px';
    div.style.overflowY = 'auto';
    div.style.display = 'flex';
    div.style.flexDirection = 'column';

    // HEADER: aggiungi la riga di intestazione
    div.innerHTML += `
        <div class="mezzo-header-row" style="display:flex;align-items:center;font-weight:bold;background:#e3e3e3;border-bottom:1px solid #bbb;padding:2px 0 2px 0;">
            <div style="flex:2;min-width:0;overflow:hidden;text-overflow:ellipsis;">Mezzo</div>
            <div style="flex:1;text-align:left;min-width:70px;">Stato</div>
            <div style="flex:2;min-width:0;overflow:hidden;text-overflow:ellipsis;">Comunicazioni</div>
        </div>
    `;

    // Funzione robusta per etichetta stato
    function getStatoLabel(stato) {
        if (window.game && window.game.statiMezzi && window.game.statiMezzi[stato] && window.game.statiMezzi[stato].Descrizione) {
            return window.game.statiMezzi[stato].Descrizione;
        }
        return '';
    }

    // Mostra TUTTI i mezzi: prima gli altri, poi quelli in stato 8
    [...altriMezzi, ...mezziStato8].forEach(m => {
        const stato = m.stato;
        const statoLabel = getStatoLabel(stato);
        const comunicazione = Array.isArray(m.comunicazioni) ?
            (m.comunicazioni.find(c => c.includes('Report pronto')) || '') : '';
        const lampeggia = (m._msgLampeggia && comunicazione.includes('Report pronto')) ?
            'animation: mezzo-lamp 1s linear infinite alternate;' : '';
        div.innerHTML += `
            <div class="mezzo-row" style="display:flex;align-items:center;margin-bottom:4px;cursor:pointer;${lampeggia}" data-mezzo-id="${m.nome_radio}">
                <div class="mezzo-cell" style="flex:2;min-width:0;overflow:hidden;text-overflow:ellipsis;">
                    <b>${m.nome_radio}</b> <span style='color:#888;'>${m.tipo_mezzo || ''}</span> <span style='color:#1976d2;'>${m.convenzione || ''}</span>
                </div>
                <div class="stato-cell" style="flex:1;text-align:left;min-width:70px;">
                    <span style='font-weight:bold;'>${stato}</span> <span style='color:${stato === 8 ? '#d32f2f' : '#388e3c'};'>${statoLabel}</span>
                </div>
                <div class="comunicazione-cell" style="flex:2;min-width:0;overflow:hidden;text-overflow:ellipsis;color:#555;">${comunicazione}</div>
            </div>
        `;
    });
    // Attach click handlers to new rows
    const rows = div.querySelectorAll('.mezzo-row');
    rows.forEach(row => {
        const mezzoId = row.getAttribute('data-mezzo-id');
        // Click on mezzo name to center map
        const cellMezzo = row.querySelector('.mezzo-cell');
        if (cellMezzo) {
            cellMezzo.addEventListener('click', e => {
                e.stopPropagation();
                const mezzo = window.game.mezzi.find(x => x.nome_radio === mezzoId);
                if (mezzo && mezzo._marker && window.game.map) {
                    window.game.map.setView([mezzo.lat, mezzo.lon], 16, { animate: true });
                    mezzo._marker.openPopup && mezzo._marker.openPopup();
                }
            });
        }
        // Click on Report pronto to show mission report
        const cellComm = row.querySelector('.comunicazione-cell');
        if (cellComm) {
            cellComm.addEventListener('click', e => {
                e.stopPropagation();
                if (cellComm.textContent.includes('Report pronto')) {
                    const calls = Array.from(window.game.calls.values())
                        .filter(call => (call.mezziAssegnati||[]).includes(mezzoId));
                    calls.forEach(call => {
                        window.game.ui.updateMissioneInCorso(call);
                        const elem = document.getElementById(`evento-${call.missioneId}`);
                        if (elem) {
                            const det = elem.querySelector('.missione-details');
                            if (det) det.style.display = 'block';
                            elem.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                    });
                }
            });
        }
    });
};

// Restituisce la velocità media (in km/h) di un mezzo dato il tipo
async function getVelocitaMezzo(tipoMezzo) {
    // Carica la tabella solo una volta
    if (!window._tabellaMezzi118) {
        const response = await fetch('src/data/tabella_mezzi_118.json');
        const data = await response.json();
        window._tabellaMezzi118 = (data.Sheet1 || data.sheet1 || []);
    }
    const tab = window._tabellaMezzi118;
    // Cerca la voce corrispondente
    const entry = tab.find(e => (e.Tipo || '').toUpperCase() === (tipoMezzo || '').toUpperCase());
    if (entry && entry["Velocità media"]) {
        // Estrae il numero dalla stringa (es: "80 km/h")
        const match = entry["Velocità media"].toString().match(/\d+/);
        if (match) return Number(match[0]);
    }
    // Default: 60 km/h
    return 60;
}