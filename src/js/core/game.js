// DEBUG: Verifica presenza variabili globali fondamentali
if (!window.indirizziReali || !window.categorizzaIndirizzi) {
    console.error('[EMERGENZA SIM] Errore: indirizziReali o categorizzaIndirizzi NON disponibili!\nControlla che src/data/indirizzi.js sia caricato PRIMA di game.js.');
    // Mostra anche un messaggio visibile a schermo per debug online
    const warn = document.createElement('div');
    warn.style = 'background:#fdd;color:#900;padding:12px;font-weight:bold;position:fixed;top:0;left:0;z-index:9999;width:100vw;text-align:center;';
    warn.textContent = 'ERRORE: indirizziReali o categorizzaIndirizzi NON disponibili! Controlla la console.';
    document.body.appendChild(warn);
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
    if(el) el.textContent = formatSimTime(window.simTime);
    const btn = document.getElementById('sim-startstop');
    if(btn) btn.textContent = window.simRunning ? '⏸️' : '▶️';
}

function simTick() {
    if(window.simRunning) {
        window.simTime += getSimSpeed(); // Avanza di X secondi simulati ogni secondo reale
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

        if (nuovoStato === 6 || nuovoStato === 7 || nuovoStato === 1) {
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
            const response = await fetch('src/data/chiamate.json');
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
        } catch (e) {
            console.error("Error during initialization:", e);
        }
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

    getPostazioneIcon(hasLiberi) {
        const bg = hasLiberi ? "#43a047" : "#d32f2f";
        return L.divIcon({
            className: 'postazione-marker',
            html: `<div style="font-size:22px;background:${bg};border-radius:8px;width:32px;height:32px;display:flex;align-items:center;justify-content:center;">🏠</div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 32],
            popupAnchor: [0, -32]
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
                icon: this.getPostazioneIcon(hasLiberi) 
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
                marker.setIcon(this.getPostazioneIcon(hasLiberiNow));
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
        this.mezzi.forEach(m => {            if (![2, 4, 7].includes(m.stato)) return;            let emoji = "❓";
            if (["MSB", "MSA1_A", "MSA2_A"].includes(m.tipo_mezzo)) emoji = "🚑";
            else if (["MSA1", "MSA2"].includes(m.tipo_mezzo)) emoji = "🚗";
            else if (m.tipo_mezzo === "ELI") emoji = "🚁";
            const icon = L.divIcon({
                className: 'mezzo-marker',
                html: `<div style="font-size:22px;">${emoji}</div>`,
                iconSize: [28, 28],
                iconAnchor: [14, 28],
                popupAnchor: [0, -28]
            });
            m._marker = L.marker([m.lat, m.lon], { icon }).addTo(this.map)
                .bindPopup(`<b>${m.nome_radio}</b><br>${m.postazione}<br>Stato: ${m.stato}`);
        });
    }

    moveMezzoGradualmente(mezzo, lat1, lon1, lat2, lon2, durataMinuti, statoFinale, callback) {
        console.log('[DEBUG] moveMezzoGradualmente chiamata per', mezzo.nome_radio, 'da', lat1, lon1, 'a', lat2, lon2, 'durata:', durataMinuti, 'min, stato finale:', statoFinale);
        const stepTotali = durataMinuti * 60;
        let stepAttuale = 0;
        const deltaLat = (lat2 - lat1) / stepTotali;
        const deltaLon = (lon2 - lon1) / stepTotali;
        const intervalId = simInterval(() => {
            if (!window.simRunning) return;
            stepAttuale++;
            mezzo.lat += deltaLat;
            mezzo.lon += deltaLon;
            if (this.updateMezzoMarkers) this.updateMezzoMarkers();
            if (stepAttuale >= stepTotali) {
                mezzo.lat = lat2;
                mezzo.lon = lon2;
                setStatoMezzo(mezzo, statoFinale);
                if (this.updateMezzoMarkers) this.updateMezzoMarkers();
                clearInterval(intervalId);
                if (typeof callback === 'function') callback();
            }
        }, 1000);
    }

    async creaChiamataSimulata(id, missioneId, testo_chiamata, patologia, codice, indirizzo, chiamataTemplate, selectedCase) {
        // Sostituisci i segnaposto nel testo della chiamata
        if (testo_chiamata && chiamataTemplate && chiamataTemplate[selectedCase]) {
            let testoTemplate = chiamataTemplate[selectedCase];
            // Sostituzione segnaposto indirizzo
            testo_chiamata = testoTemplate.testo || testo_chiamata;
            indirizzo = testoTemplate.indirizzo || indirizzo;
            // Altri segnaposto possono essere gestiti qui se necessario
        }
        // Dopo la sostituzione dei segnaposto, aggiorna indirizzo/lat/lon se nel testo è stato inserito un indirizzo reale
        let indirizzoEffettivo = indirizzo;
        // Cerca il primo indirizzo reale presente nel testo della chiamata
        if (window.indirizziReali && Array.isArray(window.indirizziReali)) {
            for (const i of window.indirizziReali) {
                if (testo_chiamata && testo_chiamata.includes(i.indirizzo)) {
                    indirizzoEffettivo = i;
                    break;
                }
            }
        }
        // Rimuovi la scritta "Simulazione chiamata 118:" dal testo chiamata
        if (testo_chiamata) {
            testo_chiamata = testo_chiamata.replace(/^Simulazione chiamata 118:\s*/i, '');
        }
        const call = {
            id,
            missioneId,
            location: indirizzoEffettivo.indirizzo,
            indirizzo: indirizzoEffettivo.indirizzo,
            lat: indirizzoEffettivo.lat,
            lon: indirizzoEffettivo.lon,
            simText: testo_chiamata || `Paziente con ${patologia}`,
            patologia,
            codice,
            mezziAssegnati: [],
            selectedChiamata: chiamataTemplate,
            selectedCase: selectedCase
        };

        // Logica per assegnare mezzi alla chiamata basata su regole personalizzate
        const mezziDisponibili = (window.game.mezzi || []).filter(m => m.stato === 1); // Solo mezzi disponibili
        const mezziAssegnati = [];

        // Esempio di logica di assegnazione: assegna il primo mezzo disponibile che soddisfa i criteri
        for (const mezzo of mezziDisponibili) {
            if (mezzo.tipo_mezzo === 'MSB' && mezziAssegnati.length < 1) {
                mezziAssegnati.push(mezzo.nome_radio);
            } else if (mezzo.tipo_mezzo === 'MSA1' && mezziAssegnati.length < 2) {
                mezziAssegnati.push(mezzo.nome_radio);
            } else if (mezzo.tipo_mezzo === 'MSA2' && mezziAssegnati.length < 3) {
                mezziAssegnati.push(mezzo.nome_radio);
            }
            // Esci dal ciclo se abbiamo già assegnato abbastanza mezzi
            if (mezziAssegnati.length === 3) break;
        }

        call.mezziAssegnati = mezziAssegnati;

        // Aggiungi la chiamata alla lista delle chiamate attive
        window.game.calls.set(call.id, call);

        // Aggiorna l'interfaccia utente se necessario
        if (window.game.ui && typeof window.game.ui.updateMissioneInCorso === 'function') {
            window.game.ui.updateMissioneInCorso(call);
        }

        return call;
    }
}

window.addEventListener('load', async () => {
    // Avvia la simulazione solo se non è già in corso
    if (!window.simRunning) {
        window.simRunning = true;
        const game = new EmergencyDispatchGame();
        window.game = game;
        await game.initialize();
        // Avvia il loop di simulazione
        setInterval(() => {
            if (window.simRunning) {
                window.simTime += 1;
                game.updateMezzoMarkers();
                game.updatePostazioneMarkers();
            }
        }, 1000);
    }
});