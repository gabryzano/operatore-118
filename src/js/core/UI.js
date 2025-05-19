// Helper: map mission code to color
function getColoreCodice(codice) {
    switch (codice) {
        case 'Rosso': return '#e53935';
        case 'Giallo': return '#ffeb3b';
        case 'Verde': return '#4caf50';
        default: return '#888';
    }
}

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
            // Exclude vehicles that have returned to base (state 7)
            const mezzi = (this.game.mezzi||[])
                .filter(m => mezziAssegnati.includes(m.nome_radio) && m.stato !== 7);
            const ospedali = (window.game && window.game.hospitals) ? window.game.hospitals : (this.game.hospitals||[]);

            // Se non ci sono ospedali, mostra messaggio di caricamento
            if (!ospedali.length) {
                if(!dettagli.innerHTML.includes('Caricamento ospedali in corso')) {
                    dettagli.innerHTML += `<div style='color:#d32f2f;font-weight:bold;'>Caricamento ospedali in corso...</div>`;
                }
                setTimeout(()=>{
                    this.updateMissioneInCorso(call);
                    if ((window.game && window.game.hospitals) ? window.game.hospedali.length > 0 : (this.game.hospitals||[]).length > 0 && window.game && window.game.calls) {
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
                // Highlight vehicles arrived at hospital (stato 6)
                const highlightStyle = m.stato === 6 ? 'background:#fff9c4;padding:4px;border-radius:4px;' : '';
                html += `<div style='margin-bottom:6px;${highlightStyle}'><b>${m.nome_radio}</b>`;
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
                // Mostra il menu solo dopo il report del singolo mezzo e se non confermato
                const showMenu = !m._trasportoConfermato && hasReportPronto;
                if (showMenu) {
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

                    // Ordina ospedali per distanza aerea e calcola distanza in km
                    let ospedaliOrdinati = ospedali.slice();
                    if (call && call.lat && call.lon) {
                        ospedaliOrdinati = ospedaliOrdinati
                            .map(o => {
                                const d = (o.lat && o.lon)
                                    ? distanzaKm(call.lat, call.lon, o.lat, o.lon)
                                    : Infinity;
                                return { ...o, _dist: d };
                            })
                            .sort((a, b) => a._dist - b._dist);
                    }

                    // Per veicoli MSA1 e MSA2 mostriamo solo rientro o accompagna
                    if (m.tipo_mezzo === 'MSA1' || m.tipo_mezzo === 'MSA2') {
                        const selectOsp = `<select class='select-ospedale' data-nome='${m.nome_radio}'>`+
                            `<option value="__rientro__">Rientro in sede</option>`+
                            `<option value="__accompagna__">Accompagna in ospedale</option>`+
                            `</select>`;
                        html += `<br>Ospedale: ${selectOsp} <button class='btn-conferma-trasporto' data-nome='${m.nome_radio}'>Conferma</button>`;
                    } else {
                        // Genera il menu ospedali
                        const selectOsp = `<select class='select-ospedale' data-nome='${m.nome_radio}'>`+
                            `<option value="__rientro__">Rientro in sede</option>`+
                            ospedaliOrdinati.map(o => {
                                const distText = (o._dist !== undefined && isFinite(o._dist))
                                    ? ` (${o._dist.toFixed(1)} km)`
                                    : '';
                                return `<option value="${o.nome.trim()}">${o.nome.trim()}${distText}</option>`;
                            }).join('')+
                            `</select>`;
                        // Genera il menu codice trasporto
                        const selectCod = `<select class='select-codice-trasporto' data-nome='${m.nome_radio}'>`+
                            ['Rosso','Giallo','Verde'].map(c=>`<option value="${c}">${c}</option>`).join('')+
                            `</select>`;
                        html += `<br>Ospedale: ${selectOsp} Codice: ${selectCod} <button class='btn-conferma-trasporto' data-nome='${m.nome_radio}'>Conferma</button>`;
                    }
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
            setTimeout(() => {
                dettagli.querySelectorAll('.btn-conferma-trasporto').forEach(btn => {
                    btn.onclick = () => {
                        const nome = btn.getAttribute('data-nome');
                        const ospedaleSel = dettagli.querySelector(`.select-ospedale[data-nome='${nome}']`).value;
                        const codiceSel = dettagli.querySelector(`.select-codice-trasporto[data-nome='${nome}']`)?.value;
                        const mezzo = mezzi.find(m => m.nome_radio === nome);
                        if (!mezzo) return;
                        // Escort for MSA1/MSA2: accompany confirmed transport to hospital in Verde
                        if ((mezzo.tipo_mezzo === 'MSA1' || mezzo.tipo_mezzo === 'MSA2') && ospedaleSel === '__accompagna__') {
                            const lead = mezzi.find(x =>
                                (call.mezziAssegnati || []).includes(x.nome_radio) &&
                                (x.tipo_mezzo.startsWith('MSB') || x.tipo_mezzo.endsWith('_A') || x.tipo_mezzo === 'ELI') &&
                                x._trasportoConfermato
                            );
                            if (lead && lead.ospedale) {
                                mezzo.ospedale = lead.ospedale;
                                mezzo.codice_trasporto = 'Verde';
                                mezzo._trasportoConfermato = true;
                                mezzo.comunicazioni = (mezzo.comunicazioni || []).concat([`Accompagna ${lead.nome_radio} in ospedale ${lead.ospedale.nome} (Codice Verde)`]);
                                aggiornaMissioniPerMezzo(mezzo);
                                if (window.avanzaMezzoAStato4DopoConferma) window.avanzaMezzoAStato4DopoConferma(mezzo);
                            }
                            return;
                        }
                        // Return to base
                        if (ospedaleSel === '__rientro__') {
                            mezzo.ospedale = null;
                            mezzo.codice_trasporto = null;
                            mezzo._trasportoConfermato = false;
                            mezzo._trasportoAvviato = false;
                            mezzo.comunicazioni = (mezzo.comunicazioni || []).concat([`Rientro in sede richiesto`]);
                            setStatoMezzo(mezzo, 7);
                            aggiornaMissioniPerMezzo(mezzo);
                            if (window.game && window.game.postazioniMap && mezzo.postazione) {
                                const postazione = Object.values(window.game.postazioniMap).find(p => p.nome === mezzo.postazione);
                                if (postazione) {
                                    const dist = distanzaKm(mezzo.lat, mezzo.lon, postazione.lat, postazione.lon);
                                    getVelocitaMezzo(mezzo.tipo_mezzo).then(vel => {
                                        const tempo = Math.round((dist / vel) * 60);
                                        window.game.moveMezzoGradualmente(mezzo, mezzo.lat, mezzo.lon, postazione.lat, postazione.lon, Math.max(tempo, 2), 1, () => {
                                            mezzo.comunicazioni = [];
                                            window.game.ui.updateStatoMezzi(mezzo);
                                        });
                                    });
                                }
                            }
                            return;
                        }
                        // Normal transport for MSB, MSA1_A, MSA2_A, ELI
                        mezzo.ospedale = ospedali.find(o => o.nome.trim() === ospedaleSel) || mezzo.ospedale;
                        if (codiceSel) mezzo.codice_trasporto = codiceSel;
                        mezzo._trasportoConfermato = true;
                        mezzo.comunicazioni = (mezzo.comunicazioni || []).concat([`Destinazione: ${ospedaleSel}, Codice: ${codiceSel}`]);
                        aggiornaMissioniPerMezzo(mezzo);
                        if (window.avanzaMezzoAStato4DopoConferma) window.avanzaMezzoAStato4DopoConferma(mezzo);
                    };
                });
            }, 100);
        }
    }
    
    // Close mission entry when no vehicles remain assigned
    closeMissioneInCorso(call) {
        // Remove mission element from UI
        const elem = document.getElementById(`evento-${call.missioneId}`);
        if (elem) elem.remove();
        // Remove call marker from map
        if (call._marker && this.game && this.game.map) {
            this.game.map.removeLayer(call._marker);
        }
        // Remove call from game data
        if (this.game && this.game.calls) {
            this.game.calls.delete(call.id);
        }
    }
}
