class GameUI {
    constructor(game) {
        this.game = game;
        this._mezziInAlto = []; // Persistenza dei mezzi in alto
    }

    showNewCall(call) {
        const arriviBox = document.querySelector('#chiamateInArrivo .box-content');
        if (!arriviBox) return;
        // Controlla se già presente
        if (document.getElementById(`call-${call.id}`)) return;
        // Forza sempre call.indirizzo valorizzato
        if (!call.indirizzo && call.location) call.indirizzo = call.location;
        if (!call.location && call.indirizzo) call.location = call.indirizzo;
        const div = document.createElement('div');
        div.className = 'evento chiamata-arrivo';
        div.id = `call-${call.id}`;
        div.innerHTML = `
            <div class="call-header" style="cursor:pointer;">
                <b>Nuova chiamata in arrivo</b>
            </div>
            <div class="call-details" style="display:none;">
                <div class="call-sim-voice">Simulazione chiamata 118: <br><span class="sim-patologia">${call.simText || 'Paziente con sintomi da valutare...'}</span></div>
                <div class="call-indirizzo"><b>Indirizzo:</b> ${call.indirizzo || call.location || 'Indirizzo sconosciuto'}</div>
                <div class="call-actions" style="margin-top:10px;">
                    <button class="btn-crea-missione">Crea missione</button>
                    <button class="btn-chiudi">Chiudi</button>
                </div>
            </div>
        `;
        // Espansione/collapse
        div.querySelector('.call-header').onclick = () => {
            const det = div.querySelector('.call-details');
            const expanded = det.style.display === 'none';
            det.style.display = expanded ? 'block' : 'none';
            // Mostra marker sulla mappa se espanso
            if (expanded && call._marker && window.game && window.game.map) {
                try {
                    window.game.map.setView([call.lat, call.lon], 16, { animate: true });
                    call._marker.openPopup && call._marker.openPopup();
                } catch (err) {}
            }
        };
        // Chiudi
        div.querySelector('.btn-chiudi').onclick = () => {
            div.remove();
            if (call._marker && window.game && window.game.map) window.game.map.removeLayer(call._marker);
            window.game.calls.delete(call.id);
        };
        // Crea missione
        div.querySelector('.btn-crea-missione').onclick = () => {
            window.game.openMissionPopup(call);
        };
        arriviBox.appendChild(div);
    }

    moveCallToEventiInCorso(call) {
        // Forza sempre call.indirizzo valorizzato
        if (!call.indirizzo && call.location) call.indirizzo = call.location;
        if (!call.location && call.indirizzo) call.location = call.indirizzo;
        const eventiBox = document.querySelector('#eventiInCorso .box-content');
        if (!eventiBox) return;
        // Controlla se già presente
        if(document.getElementById(`evento-${call.missioneId}`)) return;
        const div = document.createElement('div');
        div.className = 'evento missione-corso';
        div.id = `evento-${call.missioneId}`;
        // Estrai via e comune senza CAP
        let indirizzo = call.indirizzo || call.location || 'Indirizzo sconosciuto';
        let via = '', comune = '';
        const viaMatch = indirizzo.match(/((Via|Viale|Piazza|Corso|Largo|Vicolo|Contrada|Borgo|Strada) [^,]+)/i);
        if(viaMatch) via = viaMatch[1];
        // Regex: cerca la parte dopo la virgola, elimina CAP e prende solo il nome del comune
        // Esempio: "Via Decò e Canetta, 24068 Seriate BG" => comune = "Seriate"
        const comuneMatch = indirizzo.match(/,\s*(?:\d{5}\s*)?([\w' ]+?)\s+[A-Z]{2}/);
        if(comuneMatch) comune = comuneMatch[1].replace(/\d+/g, '').trim();        let indirizzoSintetico = via;
        if(comune) indirizzoSintetico += ' - ' + comune;
        indirizzoSintetico = indirizzoSintetico.trim() || indirizzo;
        // Ospedale e codice trasporto SOLO se confermati
        let ospedaleHtml = '';
        if (call.mezziAssegnati && call.mezziAssegnati.length > 0 && window.game && window.game.mezzi) {
            const mezzi = window.game.mezzi.filter(m => (call.mezziAssegnati||[]).includes(m.nome_radio));
            const mezzoConOspedale = mezzi.find(m => m.ospedale && m.codice_trasporto && m._trasportoConfermato);
            if (mezzoConOspedale) {
                ospedaleHtml = ` <span style='margin-left:12px;'></span><span style='font-size:13px;'>Destinazione: <b>${mezzoConOspedale.ospedale.nome}</b></span> <span style='display:inline-block;width:5px;height:5px;margin-left:6px;vertical-align:middle;background:${getColoreCodice(mezzoConOspedale.codice_trasporto)};background-size:cover;'></span>`;
            }
        }
        div.innerHTML = `            <div class="missione-header" style="display:flex;align-items:center;justify-content:space-between;gap:8px;cursor:pointer;">
                <span>
                    <span class="missione-codice-box" style="display:inline-block;width:5px;height:5px;margin-right:8px;vertical-align:middle;background:${getColoreCodice(call.codice)};background-size:cover;"></span>
                    ${call.missioneId} - ${indirizzoSintetico}${ospedaleHtml}
                </span>
                <button class='btn-edit-missione'>Modifica</button>
            </div>
            <div class="missione-details" style="display:none;">
                <div><b>Mezzi assegnati:</b> ${(call.mezziAssegnati||[]).join(', ')||'Nessuno'}</div>
                <div class='report-section'></div>
            </div>
        `;
        // Espansione/collapse
        div.querySelector('.missione-header').onclick = (e) => {
            if(e.target.classList.contains('btn-edit-missione')) return;
            const det = div.querySelector('.missione-details');
            const expanded = det.style.display === 'none';
            det.style.display = expanded ? 'block' : 'none';
            // Mostra marker sulla mappa se espanso
            if (expanded && call._marker && window.game && window.game.map) {
                try {
                    window.game.map.setView([call.lat, call.lon], 16, { animate: true });
                    call._marker.openPopup && call._marker.openPopup();
                } catch (err) {}
            }
        };
        // Modifica missione
        div.querySelector('.btn-edit-missione').onclick = (e) => {
            e.stopPropagation();
            window.game.openMissionPopup(call);
        };
        eventiBox.appendChild(div);
        // Aggiorna subito la missione per mostrare correttamente il menù ospedali/codice se necessario
        this.updateMissioneInCorso(call);
    }

    // Aggiorna la visualizzazione di una missione già presente in Eventi in corso
    updateMissioneInCorso(call) {
        // Forza sempre call.indirizzo valorizzato
        if (!call.indirizzo && call.location) call.indirizzo = call.location;
        if (!call.location && call.indirizzo) call.location = call.indirizzo;
        const div = document.getElementById(`evento-${call.missioneId}`);
        if (!div) return;
        
        // Estrai via e comune senza CAP
        let indirizzo = call.indirizzo || call.location || 'Indirizzo sconosciuto';
        let via = '', comune = '';
        const viaMatch = indirizzo.match(/((Via|Viale|Piazza|Corso|Largo|Vicolo|Contrada|Borgo|Strada) [^,]+)/i);
        if(viaMatch) via = viaMatch[1];
        const comuneMatch = indirizzo.match(/,\s*(?:\d{5}\s*)?([\w' ]+?)\s+[A-Z]{2}/);
        if(comuneMatch) comune = comuneMatch[1].replace(/\d+/g, '').trim();
        let indirizzoSintetico = via;
        if(comune) indirizzoSintetico += ' - ' + comune;
        indirizzoSintetico = indirizzoSintetico.trim() || indirizzo;

        // Ospedale e codice trasporto SOLO se confermati
        let ospedaleHtml = '';
        if (call.mezziAssegnati && call.mezziAssegnati.length > 0 && this.game && this.game.mezzi) {
            const mezzi = this.game.mezzi.filter(m => (call.mezziAssegnati||[]).includes(m.nome_radio));
            const mezzoConOspedale = mezzi.find(m => m.ospedale && m.codice_trasporto && m._trasportoConfermato);
            if (mezzoConOspedale) {
                ospedaleHtml = ` <span style='margin-left:12px;'></span><span style='font-size:13px;'>Destinazione: <b>${mezzoConOspedale.ospedale.nome}</b></span> <span style='display:inline-block;width:16px;height:16px;border-radius:4px;margin-left:6px;vertical-align:middle;background:${getColoreCodice(mezzoConOspedale.codice_trasporto)};border:1px solid #888;'></span>`;
            }
        }

        // Aggiorna header e dettagli
        const header = div.querySelector('.missione-header');
        if(header) header.innerHTML = `
            <span style="display:flex;align-items:center;gap:8px;">
                <span class="missione-codice-box" style="display:inline-block;width:18px;height:18px;border-radius:4px;margin-right:8px;vertical-align:middle;background:${getColoreCodice(call.codice)};"></span>
                ${call.missioneId} - ${indirizzoSintetico}${ospedaleHtml}
            </span>
            <button class='btn-edit-missione'>Modifica</button>
        `;

        // Riaggancia il listener al pulsante Modifica
        const btnEdit = div.querySelector('.btn-edit-missione');
        if(btnEdit) {
            btnEdit.onclick = (e) => {
                e.stopPropagation();
                window.game.openMissionPopup(call);
            };
        }

        const dettagli = div.querySelector('.missione-details');
        if(dettagli) {
            // Blocca aggiornamento se l'utente sta interagendo con il menù ospedali/codice
            const active = document.activeElement;
            if (active && (active.classList.contains('select-ospedale') || active.classList.contains('select-codice-trasporto') || active.classList.contains('btn-conferma-trasporto'))) {
                return;
            }

            let html = '';
            const mezziAssegnati = (call.mezziAssegnati||[]);
            const mezzi = (this.game.mezzi||[]).filter(m=>mezziAssegnati.includes(m.nome_radio));
            const ospedali = (window.game && window.game.hospitals) ? window.game.hospitals : (this.game.hospitals||[]);

            // Se non ci sono ospedali, mostra messaggio di caricamento
            if (!ospedali.length) {
                if(!dettagli.innerHTML.includes('Caricamento ospedali in corso')) {
                    dettagli.innerHTML += `<div style='color:#d32f2f;font-weight:bold;'>Caricamento ospedali in corso...</div>`;
                }
                setTimeout(()=>{
                    this.updateMissioneInCorso(call);
                    if ((window.game && window.game.hospitals) ? window.game.hospitals.length > 0 : (this.game.hospitals||[]).length > 0 && window.game && window.game.calls) {
                        let callsArr = [];
                        if (typeof window.game.calls.forEach === 'function') {
                            window.game.calls.forEach(c => callsArr.push(c));
                        } else {
                            callsArr = Object.values(window.game.calls);
                        }
                        callsArr.forEach(c => this.updateMissioneInCorso(c));
                    }
                }, 500);
                return;
            }

            let almenoUnMezzoReportPronto = false;
            mezzi.forEach(m => {
                let testoScheda = '';
                const avanzati = mezzi.filter(x => (x.tipo_mezzo && (x.tipo_mezzo.startsWith('MSA1') || x.tipo_mezzo.startsWith('MSA2') || (x.tipo_mezzo.toUpperCase().includes('ELI')))) && (x.comunicazioni||[]).some(c => c.toLowerCase().includes('report pronto')));
                // Se c'è almeno un MSB in stato 3 e almeno un avanzato, non mostrare il report del MSB
                const isMSBStato3 = m.tipo_mezzo && m.tipo_mezzo.startsWith('MSB') && m.stato === 3;
                const altriAvanzatiPresenti = avanzati.length > 0;
                let mostraReport = true;
                if (isMSBStato3 && altriAvanzatiPresenti) {
                    mostraReport = false;
                }
                if ((m.comunicazioni||[]).some(c => c.toLowerCase().includes('report pronto')) && call.selectedChiamata && call.selectedCase && mostraReport) {
                    let tipo = '';
                    if (m.tipo_mezzo && m.tipo_mezzo.startsWith('MSB')) tipo = 'MSB';
                    else if (m.tipo_mezzo && m.tipo_mezzo.startsWith('MSA1')) tipo = 'MSA1';
                    else if (m.tipo_mezzo && m.tipo_mezzo.startsWith('MSA2')) tipo = 'MSA2';
                    else if (m.tipo_mezzo && m.tipo_mezzo.toUpperCase().includes('ELI')) tipo = 'MSA2'; // ELI usa sempre MSA2
                    if (tipo && call.selectedChiamata[call.selectedCase] && call.selectedChiamata[call.selectedCase][tipo]) {
                        testoScheda = call.selectedChiamata[call.selectedCase][tipo];
                    }
                }
                html += `<div style='margin-bottom:6px;'><b>${m.nome_radio}</b>`;
                if (testoScheda) {
                    html += `<br><span style='font-size:12px;color:#1976d2;white-space:pre-line;'>${testoScheda}</span>`;
                }

                // Aggiungi stato e comunicazioni del mezzo
                const hasReportPronto = (m.comunicazioni||[]).some(c => c.toLowerCase().includes('report pronto'));
                let comunicazioni = '';
                if (Array.isArray(m.comunicazioni) && m.comunicazioni.length > 0) {
                    comunicazioni = m.comunicazioni[m.comunicazioni.length - 1];
                    if (comunicazioni) {
                        html += ` - <span style='color:#555;'>${comunicazioni}</span>`;
                    }
                }

                // Gestione menu ospedali e codice trasporto
                if (hasReportPronto && (!m._trasportoConfermato || m._trasportoConfermato === false)) {
                    almenoUnMezzoReportPronto = true;
                    // Reset dei campi solo la prima volta che il menu appare
                    if (!m._menuOspedaliShown) {
                        m.ospedale = null;
                        m.codice_trasporto = null;
                        if (!m.comunicazioni || !m.comunicazioni.includes("Report pronto")) {
                            m.comunicazioni = ["Report pronto"];
                        }
                        m._menuOspedaliShown = true;
                    }

                    // Ordina ospedali per distanza
                    let ospedaliOrdinati = ospedali.slice();
                    if (call && call.lat && call.lon) {
                        ospedaliOrdinati.sort((a, b) => {
                            const da = distanzaKm(call.lat, call.lon, a.lat, a.lon);
                            const db = distanzaKm(call.lat, call.lon, b.lat, b.lon);
                            return da - db;
                        });
                    }

                    // Genera il menu ospedali
                    const selectOsp = `<select class='select-ospedale' data-nome='${m.nome_radio}'>`+
                        `<option value="__rientro__">Rientro in sede</option>`+
                        ospedaliOrdinati.map(o=>{
                            let dist = '';
                            if (call && call.lat && call.lon && o.lat && o.lon) {
                                dist = distanzaKm(call.lat, call.lon, o.lat, o.lon).toFixed(1) + ' km';
                            }
                            return `<option value="${o.nome.trim()}">${o.nome.trim()}${dist ? ' ('+dist+')' : ''}</option>`;
                        }).join('')+
                        `</select>`;

                    // Genera il menu codice trasporto
                    const selectCod = `<select class='select-codice-trasporto' data-nome='${m.nome_radio}'>`+
                        ['Rosso','Giallo','Verde'].map(c=>`<option value="${c}">${c}</option>`).join('')+
                        `</select>`;

                    html += `<br>Ospedale: ${selectOsp} Codice: ${selectCod} <button class='btn-conferma-trasporto' data-nome='${m.nome_radio}'>Conferma</button>`;
                } else if(m.ospedale && m.codice_trasporto) {
                    html += `<br><span style='color:#333;'>Destinazione: <b>${m.ospedale.nome}</b> (${m.codice_trasporto})</span>`;
                }
                html += '</div>';
            });

            dettagli.innerHTML = `<div><b>Mezzi assegnati:</b></div>${html}<div class='report-section'></div>`;
            
            // Mostra i dettagli se almeno un mezzo ha inviato report pronto
            if(almenoUnMezzoReportPronto) {
                dettagli.style.display = 'block';
            }

            // Gestione conferma trasporto
            setTimeout(()=>{
                dettagli.querySelectorAll('.btn-conferma-trasporto').forEach(btn=>{
                    btn.onclick = ()=>{
                        const nome = btn.getAttribute('data-nome');
                        const ospedaleSel = dettagli.querySelector(`.select-ospedale[data-nome='${nome}']`).value;
                        const codice = dettagli.querySelector(`.select-codice-trasporto[data-nome='${nome}']`).value;
                        const mezzo = mezzi.find(m=>m.nome_radio===nome);
                        if(mezzo) {
                            if(ospedaleSel === "__rientro__") {
                                mezzo.ospedale = null;
                                mezzo.codice_trasporto = null;
                                mezzo._trasportoConfermato = false;
                                mezzo._trasportoAvviato = false;
                                mezzo.comunicazioni = (mezzo.comunicazioni||[]).concat([`Rientro in sede richiesto`]);
                                mezzo.stato = 7;
                                aggiornaMissioniPerMezzo(mezzo);
                                if(window.game && window.game.postazioniMap && mezzo.postazione) {
                                    const postazione = Object.values(window.game.postazioniMap).find(p=>p.nome===mezzo.postazione);
                                    if(postazione) {
                                        const distRientro = distanzaKm(mezzo.lat, mezzo.lon, postazione.lat, postazione.lon);
                                        getVelocitaMezzo(mezzo.tipo_mezzo).then(velRientro => {
                                            const tempoRientro = Math.round((distRientro/velRientro)*60);
                                            window.game.moveMezzoGradualmente(mezzo, mezzo.lat, mezzo.lon, postazione.lat, postazione.lon, Math.max(tempoRientro,2), 1, () => {
                                                mezzo.ospedale = null;
                                                mezzo.codice_trasporto = null;
                                                mezzo._trasportoAvviato = false;
                                                mezzo._trasportoConfermato = false;
                                                mezzo.comunicazioni = [];
                                                window.game.ui.updateStatoMezzi(mezzo);
                                            });
                                        });
                                        return;
                                    }
                                }
                                mezzo.stato = 1;
                                aggiornaMissioniPerMezzo(mezzo);
                                window.game.ui.updateStatoMezzi(mezzo);
                            } else {
                                mezzo.ospedale = ospedali.find(o=>o.nome.trim()===ospedaleSel);
                                mezzo.codice_trasporto = codice;
                                mezzo._trasportoConfermato = true;
                                mezzo.comunicazioni = (mezzo.comunicazioni||[]).concat([`Destinazione: ${ospedaleSel}, Codice: ${codice}`]);
                                aggiornaMissioniPerMezzo(mezzo);
                                if(window.avanzaMezzoAStato4DopoConferma) window.avanzaMezzoAStato4DopoConferma(mezzo);
                            }
                        }
                    };
                });
            },100);
        }
    }

    // Chiude la missione in corso e la rimuove dal pannello Eventi in corso
    closeMissioneInCorso(call) {
        const div = document.getElementById(`evento-${call.missioneId}`);
        if (div) div.remove();
        // Puoi aggiungere qui eventuali logiche di log, notifiche, ecc.
    }

    // Aggiorna la tabella Stato Mezzi usando dati da stati_mezzi.json
    updateStatoMezzi(changedMezzo = null) {
        const box = document.querySelector('#statoMezzi .box-content');
        if (!box) return;
        box.innerHTML = '';
        let mezzi = (this.game.mezzi || []).slice();
        // Calcola timestamp ultimo evento (stato o comunicazione)
        mezzi.forEach(m => {
            let lastCom = 0;
            if (m.comunicazioni && m.comunicazioni.length) {
                let last = m.comunicazioni[m.comunicazioni.length-1];
                let match = last && last.match && last.match(/\[(\d{2}):(\d{2}):(\d{2})\]/);
                if(match) {
                    const now = new Date();
                    lastCom = new Date(now.getFullYear(), now.getMonth(), now.getDate(), +match[1], +match[2], +match[3]).getTime();
                } else if(m._lastComTime) {
                    lastCom = m._lastComTime;
                } else {
                    lastCom = 0;
                }
            }
            m._lastEvent = Math.max(m._lastComTime||0, m._lastStatoTime||0, lastCom, m._lastEvent||0, m._statoEnterTime||0);
        });
        // Ordina: prima chi ha comunicazioni/eventi più recenti
        mezzi.sort((a, b) => (b._lastEvent||0) - (a._lastEvent||0));
        // Mezzi in stato 8 in fondo
        const mezziStato8 = mezzi.filter(m => m.stato === 8);
        const altriMezzi = mezzi.filter(m => m.stato !== 8);
        // Layout a 3 colonne
        box.innerHTML = '';
        box.style.maxHeight = '350px';
        box.style.overflowY = 'auto';
        box.style.display = 'flex';
        box.style.flexDirection = 'column';
        // HEADER: aggiungi la riga di intestazione
        box.innerHTML += `
            <div class="mezzo-header-row" style="display:flex;align-items:center;font-weight:bold;background:#e3e3e3;border-bottom:1px solid #bbb;padding:2px 0 2px 0;">
                <div style="flex:2;min-width:0;overflow:hidden;text-overflow:ellipsis;">Mezzo</div>
                <div style="flex:1;text-align:left;min-width:70px;">Stato</div>
                <div style="flex:2;min-width:0;overflow:hidden;text-overflow:ellipsis;">Comunicazioni</div>
            </div>
        `;
        // Funzione per etichetta stato
        function getStatoLabel(stato) {
            if (window.game && window.game.statiMezzi && Array.isArray(window.game.statiMezzi.Sheet1)) {
                const found = window.game.statiMezzi.Sheet1.find(s => s.Stato === stato);
                return found ? found.Significato : '';
            }
            return '';
        }
        // Mezzi diversi da stato 8
        altriMezzi.forEach(m => {
            const stato = m.stato;
            const statoLabel = getStatoLabel(stato);
            // Colonna 3: solo "Report pronto" se presente
            let comunicazione = '';
            if (Array.isArray(m.comunicazioni)) {
                // Mostra solo "Report pronto" se presente, altrimenti stringa vuota
                const report = m.comunicazioni.find(c => c.toLowerCase().includes('report pronto'));
                comunicazione = report ? report : '';
            }
            // Evidenzia se il mezzo ha un nuovo messaggio non letto
            const lampeggia = m._msgLampeggia ? 'animation: mezzo-lamp 1s linear infinite alternate;' : '';
            box.innerHTML += `                <div class="mezzo-row" style="display:flex;align-items:center;margin-bottom:4px;cursor:pointer;${lampeggia}" data-mezzo-id="${m.nome_radio}">
                    <div style="flex:2;min-width:0;overflow:hidden;text-overflow:ellipsis;">
                        <b class="nome-radio-link" style="cursor:pointer;text-decoration:underline;">${m.nome_radio}</b> <span style='color:#888;'>${m.tipo_mezzo || ''}</span> <span style='color:#1976d2;'>${m.convenzione || ''}</span>
                    </div>
                    <div style="flex:1;text-align:left;min-width:70px;">
                        <span style='font-weight:bold;'>${stato}</span> - <span style='color:${stato === 8 ? '#d32f2f' : '#388e3c'};'>${statoLabel}</span>
                    </div>
                    <div style="flex:2;min-width:0;overflow:hidden;text-overflow:ellipsis;color:#555;" ${comunicazione ? 'class="comunicazione-link" style="cursor:pointer;text-decoration:underline;"' : ''}>${comunicazione}</div>
                </div>
            `;
        });
        // Mezzi stato 8 in fondo
        if (mezziStato8.length > 0) {
            box.innerHTML += `<div style="margin:8px 0 4px 0;border-top:1px solid #ccc;"></div>`;
            mezziStato8.forEach(m => {
                const stato = m.stato;
                const statoLabel = getStatoLabel(stato);
                let comunicazione = '';
                if (Array.isArray(m.comunicazioni)) {
                    const report = m.comunicazioni.find(c => c.toLowerCase().includes('report pronto'));
                    comunicazione = report ? report : '';
                }
                box.innerHTML += `
                    <div class="mezzo-row" style="display:flex;align-items:center;margin-bottom:4px;background:#fbe9e7;cursor:pointer;" data-mezzo-id="${m.nome_radio}">
                        <div style="flex:2;min-width:0;overflow:hidden;text-overflow:ellipsis;">
                            <b>${m.nome_radio}</b> <span style='color:#888;'>${m.tipo_mezzo || ''}</span> <span style='color:#1976d2;'>${m.convenzione || ''}</span>
                        </div>
                        <div style="flex:1;text-align:left;min-width:70px;">
                            <span style='font-weight:bold;'>${stato}</span> - <span style='color:#d32f2f;'>${statoLabel}</span>
                        </div>
                        <div style="flex:2;min-width:0;overflow:hidden;text-overflow:ellipsis;color:#555;">${comunicazione}</div>
                    </div>
                `;
            });
        }        // Gestione click handlers
        setTimeout(() => {
            document.querySelectorAll('.mezzo-row').forEach(row => {
                // Remove flashing on any click
                row.onclick = function() {
                    const id = row.getAttribute('data-mezzo-id');
                    const mezzo = window.game.mezzi.find(m => m.nome_radio === id);
                    if (mezzo && mezzo._msgLampeggia) {
                        mezzo._msgLampeggia = false;
                    }
                };

                // Center map on vehicle when clicking nome_radio
                const nomeRadioLink = row.querySelector('.nome-radio-link');
                if (nomeRadioLink) {
                    nomeRadioLink.onclick = function(e) {
                        e.stopPropagation();
                        const id = row.getAttribute('data-mezzo-id');
                        const mezzo = window.game.mezzi.find(m => m.nome_radio === id);
                        if (mezzo && mezzo.lat && mezzo.lon && window.game && window.game.map) {
                            window.game.map.setView([mezzo.lat, mezzo.lon], 16, { animate: true });
                        }
                    };
                }

                // Open mission when clicking communication
                const comunicazioneLink = row.querySelector('.comunicazione-link');
                if (comunicazioneLink) {
                    comunicazioneLink.onclick = function(e) {
                        e.stopPropagation();
                        const id = row.getAttribute('data-mezzo-id');
                        const mezzo = window.game.mezzi.find(m => m.nome_radio === id);
                        if (mezzo && mezzo.chiamata) {
                            window.game.openMissionPopup(mezzo.chiamata);
                        }
                    };
                }
            });
        }, 10);
    }

    getStatoMezzoLabel(stato) {
        // ...existing code...
    }
    getStatoMezzoDesc(stato) {
        // ...existing code...
    }
}

// Funzione helper per colore codice
function getColoreCodice(codice) {
    if (!codice) return 'transparent';
    if (codice === 'Rosso') return '#d32f2f';
    if (codice === 'Giallo') return '#fdd835';
    if (codice === 'Verde') return '#43a047';
    return 'transparent';
}

// Utility per distanza (km)
function distanzaKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2-lat1)*Math.PI/180;
    const dLon = (lon2-lon1)*Math.PI/180;
    const a = Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)*Math.sin(dLon/2);
    return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

// Utility: trova velocità media per tipo mezzo
async function getVelocitaMezzo(tipo) {
    if(!window.tabellaMezzi118){
        const res = await fetch('src/data/tabella_mezzi_118.json');
        window.tabellaMezzi118 = (await res.json()).Sheet1;
    }
    const entry = window.tabellaMezzi118.find(e=>e.Tipo===tipo);
    if(!entry) return 60;
    return parseInt(entry["Velocità media"].split(' ')[0])||60;
}

// Utility: random tra min e max (minuti simulati -> secondi reali)
function randomMinuti(min, max) {
    return (Math.floor(Math.random()*(max-min+1))+min);
}

// Utility: lampeggia cella mezzo
function lampeggiaMezzo(nome_radio) {
    const box = document.querySelector('#statoMezzi .box-content');
    if(!box) return;
    const td = Array.from(box.querySelectorAll('td')).find(td=>td.textContent.includes(nome_radio));
    if(!td) return;
    let count = 0;
    const interval = setInterval(()=>{
        td.parentElement.classList.toggle('mezzo-lampeggia');
        count++;
        if(count>=30){
            clearInterval(interval);
            td.parentElement.classList.remove('mezzo-lampeggia');
        }
    }, 1000);
}

// CSS lampeggio
if(!document.getElementById('mezzo-lampeggia-style')){
    const style = document.createElement('style');
    style.id = 'mezzo-lampeggia-style';
    style.innerHTML = `.mezzo-lampeggia { background: #ffd600 !important; animation: lampeggiaMezzo 1s steps(1) infinite; }
    @keyframes lampeggiaMezzo { 50% { background: #fff !important; } }`;
    document.head.appendChild(style);
}

// Expose GameUI to window scope
if (typeof window !== 'undefined') {
    window.GameUI = GameUI;
}
