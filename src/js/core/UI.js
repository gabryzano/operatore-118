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
        
        // Stile per le chiamate in arrivo: bordo lampeggiante
        div.style.border = '2px solid #f44336';
        div.style.borderRadius = '5px';
        div.style.background = '#ffebee';
        div.style.animation = 'pulsate 2s infinite';
        
        // Aggiungi stile keyframe per l'animazione pulsante
        const style = document.createElement('style');
        style.innerHTML = `
            @keyframes pulsate {
                0% { box-shadow: 0 0 0 0 rgba(244, 67, 54, 0.7); }
                70% { box-shadow: 0 0 0 10px rgba(244, 67, 54, 0); }
                100% { box-shadow: 0 0 0 0 rgba(244, 67, 54, 0); }
            }
        `;
        document.head.appendChild(style);
        
        div.innerHTML = `
            <div class="call-header" style="cursor:pointer;display:flex;align-items:center;">
                <span style="display:flex;align-items:center;gap:8px;">
                    <span style="font-size:16px;">🚨</span>
                    <b>Nuova chiamata in arrivo</b>
                </span>
            </div>
            <div class="call-details" style="display:none;">
                <div class="call-sim-voice"><span class="sim-patologia">${call.simText || 'Paziente con sintomi da valutare...'}</span></div>
                <div class="call-indirizzo"><b>Indirizzo:</b> ${call.indirizzo || call.location || 'Indirizzo sconosciuto'}</div>
                <div class="call-actions" style="margin-top:10px;">
                    <button class="btn-crea-missione" style="background:#1976d2;color:white;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;">Crea missione</button>
                    <button class="btn-chiudi" style="background:#e53935;color:white;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;margin-left:10px;">Chiudi</button>
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
        
        // Imposta lo stile base in base alla presenza o meno di mezzi
        let missioneStyle = '';
        let missioneStatusIcon = '';
        let missioneStatusText = '';
        
        // Verifica se ci sono mezzi assegnati
        const hasMezziAssegnati = call.mezziAssegnati && call.mezziAssegnati.length > 0;
        
        if (!hasMezziAssegnati) {
            // Stile per missioni senza mezzi assegnati: bordo tratteggiato grigio
            missioneStyle = 'border: 2px dashed #999; border-radius: 5px;';
            missioneStatusText = '<span style="color:#999;font-size:12px;margin-left:10px;">■ Nessun mezzo assegnato</span>';
        } else if (window.game && window.game.mezzi) {
            const mezzi = window.game.mezzi.filter(m => (call.mezziAssegnati||[]).includes(m.nome_radio));
            
            // Verifica se c'è almeno un mezzo con report pronto
            const hasReportPronto = mezzi.some(m => (m.comunicazioni||[]).some(c => c.toLowerCase().includes('report pronto')));
            
            // Verifica se c'è almeno un mezzo in trasporto verso ospedale
            const hasOspedaleTransfer = mezzi.some(m => m.stato === 4);
            
            // Verifica se c'è almeno un mezzo in ospedale
            const hasOspedale = mezzi.some(m => m.stato === 5 || m.stato === 6);
            
            if (hasOspedale) {
                missioneStyle = 'border: 2px solid #ffca28; border-radius: 5px; background-color: #fff8e1;';
                missioneStatusIcon = '<span style="font-size:16px;margin-left:10px;">🏥</span>';
                missioneStatusText = '<span style="color:#e65100;font-size:12px;margin-left:5px;">■ Mezzo in ospedale</span>';
            } else if (hasOspedaleTransfer) {
                missioneStyle = 'border: 2px solid #66bb6a; border-radius: 5px; background-color: #e8f5e9;';
                missioneStatusIcon = '<span style="font-size:16px;margin-left:10px;">🚑</span>';
                missioneStatusText = '<span style="color:#1b5e20;font-size:12px;margin-left:5px;">■ In trasporto verso ospedale</span>';
            } else if (hasReportPronto) {
                missioneStyle = 'border: 2px solid #42a5f5; border-radius: 5px; background-color: #e3f2fd;';
                missioneStatusIcon = '<span style="font-size:16px;margin-left:10px;">📋</span>';
                missioneStatusText = '<span style="color:#0d47a1;font-size:12px;margin-left:5px;">■ Report pronto</span>';
            } else {
                // Missione con mezzi in stato normale
                missioneStyle = 'border: 2px solid #5c6bc0; border-radius: 5px;';
                missioneStatusText = '<span style="color:#3949ab;font-size:12px;margin-left:10px;">■ Mezzi assegnati</span>';
            }
        }
        
        // Aggiungi lo stile al div principale
        div.setAttribute('style', missioneStyle);
        
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
                    ${missioneStatusIcon}${missioneStatusText}
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
    }    // Aggiorna la visualizzazione di una missione già presente in Eventi in corso
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
        
        // Imposta lo stile in base alla presenza o meno di mezzi
        let missioneStyle = '';
        let missioneStatusIcon = '';
        let missioneStatusText = '';
        
        // Verifica se ci sono mezzi assegnati
        const hasMezziAssegnati = call.mezziAssegnati && call.mezziAssegnati.length > 0;
        
        if (!hasMezziAssegnati) {
            // Stile per missioni senza mezzi assegnati: bordo tratteggiato grigio
            missioneStyle = 'border: 2px dashed #999; border-radius: 5px;';
            missioneStatusText = '<span style="color:#999;font-size:12px;margin-left:10px;">■ Nessun mezzo assegnato</span>';
        } else if (this.game && this.game.mezzi) {
            const mezzi = this.game.mezzi.filter(m => (call.mezziAssegnati||[]).includes(m.nome_radio));
            
            // Verifica se c'è almeno un mezzo con report pronto
            const hasReportPronto = mezzi.some(m => (m.comunicazioni||[]).some(c => c.toLowerCase().includes('report pronto')));
            
            // Verifica se c'è almeno un mezzo in trasporto verso ospedale
            const hasOspedaleTransfer = mezzi.some(m => m.stato === 4);
            
            // Verifica se c'è almeno un mezzo in ospedale
            const hasOspedale = mezzi.some(m => m.stato === 5 || m.stato === 6);
            
            if (hasOspedale) {
                missioneStyle = 'border: 2px solid #ffca28; border-radius: 5px; background-color: #fff8e1;';
                missioneStatusIcon = '<span style="font-size:16px;margin-left:10px;">🏥</span>';
                missioneStatusText = '<span style="color:#e65100;font-size:12px;margin-left:5px;">■ Mezzo in ospedale</span>';
            } else if (hasOspedaleTransfer) {
                missioneStyle = 'border: 2px solid #66bb6a; border-radius: 5px; background-color: #e8f5e9;';
                missioneStatusIcon = '<span style="font-size:16px;margin-left:10px;">🚑</span>';
                missioneStatusText = '<span style="color:#1b5e20;font-size:12px;margin-left:5px;">■ In trasporto verso ospedale</span>';
            } else if (hasReportPronto) {
                missioneStyle = 'border: 2px solid #42a5f5; border-radius: 5px; background-color: #e3f2fd;';
                missioneStatusIcon = '<span style="font-size:16px;margin-left:10px;">📋</span>';
                missioneStatusText = '<span style="color:#0d47a1;font-size:12px;margin-left:5px;">■ Report pronto</span>';
            } else {
                // Missione con mezzi in stato normale
                missioneStyle = 'border: 2px solid #5c6bc0; border-radius: 5px;';
                missioneStatusText = '<span style="color:#3949ab;font-size:12px;margin-left:10px;">■ Mezzi assegnati</span>';
            }
        }
        
        // Aggiorna lo stile del div principale
        div.setAttribute('style', missioneStyle);

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
                ${missioneStatusIcon}${missioneStatusText}
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
                    if ((window.game && window.game.hospitals) ? window.game.hospedali.length > 0 : (this.game.hospedali||[]).length > 0 && window.game && window.game.calls) {
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
                
                // Verifica se il mezzo ha inviato un report pronto
                const hasReportPronto = (m.comunicazioni||[]).some(c => c.toLowerCase().includes('report pronto'));
                
                if (hasReportPronto && mostraReport) {
                    // Determina il tipo di mezzo per la ricerca del report
                    let tipo = '';
                    if (m.tipo_mezzo && m.tipo_mezzo.startsWith('MSB')) tipo = 'MSB';
                    else if (m.tipo_mezzo && m.tipo_mezzo.startsWith('MSA1')) tipo = 'MSA1';
                    else if (m.tipo_mezzo && m.tipo_mezzo.startsWith('MSA2')) tipo = 'MSA2';
                    else if (m.tipo_mezzo && m.tipo_mezzo.toUpperCase().includes('ELI')) tipo = 'MSA2'; // ELI usa sempre MSA2
                    
                    // Cerca il report nella struttura dati della chiamata
                    if (tipo && call.selectedChiamata) {
                        // Prima cerca nel caso selezionato
                        if (call.selectedCase && call.selectedChiamata[call.selectedCase] && 
                            call.selectedChiamata[call.selectedCase][tipo]) {
                            testoScheda = call.selectedChiamata[call.selectedCase][tipo];
                        } 
                        // Se non trova il report nel caso selezionato, usa caso_stabile come fallback
                        else if (call.selectedChiamata['caso_stabile'] && call.selectedChiamata['caso_stabile'][tipo]) {
                            testoScheda = call.selectedChiamata['caso_stabile'][tipo];
                        } 
                        // Solo se non trova niente in caso_stabile usa un messaggio generico
                        else {
                            // Report fallback se non troviamo un report specifico
                            const codiceColore = call.codice || 'Verde';
                            if (tipo === 'MSB') {
                                testoScheda = `Paziente soccorso, parametri vitali stabili. Codice ${codiceColore}. Nessun report dettagliato disponibile.`;
                            } else if (tipo === 'MSA1' || tipo === 'MSA2' || tipo.includes('ELI')) {
                                testoScheda = `Paziente soccorso, valutazione clinica completata. Parametri vitali monitorati. Codice ${codiceColore}. Nessun report dettagliato disponibile.`;
                            } else {
                                testoScheda = `Intervento completato. Codice ${codiceColore}. Nessun report dettagliato disponibile.`;
                            }
                        }
                    } else {
                        // Report fallback se non troviamo un report specifico
                        const codiceColore = call.codice || 'Verde';
                        if (tipo === 'MSB') {
                            testoScheda = `Paziente soccorso, parametri vitali stabili. Codice ${codiceColore}. Nessun report dettagliato disponibile.`;
                        } else if (tipo === 'MSA1' || tipo === 'MSA2' || tipo.includes('ELI')) {
                            testoScheda = `Paziente soccorso, valutazione clinica completata. Parametri vitali monitorati. Codice ${codiceColore}. Nessun report dettagliato disponibile.`;
                        } else {
                            testoScheda = `Intervento completato. Codice ${codiceColore}. Nessun report dettagliato disponibile.`;
                        }
                    }
                }
                // Highlight vehicles arrived at hospital (stato 6)
                const highlightStyle = m.stato === 6 ? 'background:#fff9c4;padding:4px;border-radius:4px;' : '';
                html += `<div style='margin-bottom:6px;${highlightStyle}'><b>${m.nome_radio}</b>`;
                if (testoScheda) {
                    html += `<br><span style='font-size:12px;color:#1976d2;white-space:pre-line;'>${testoScheda}</span>`;
                }

                // Aggiungi stato e comunicazioni del mezzo
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
    
    // Aggiorna la lista dei mezzi e i loro stati in tempo reale
    updateStatoMezzi(mezzoCambiato = null) {
        const div = document.getElementById('statoMezzi');
        if (!div || !window.game || !window.game.mezzi) return;

        // Ordina: prima i mezzi che hanno cambiato stato o ricevuto comunicazioni più di recente (escluso stato 8), poi tutti gli altri, poi quelli in stato 8 in fondo
        // Exclude SRL/SRP vehicles in state 1 or 8
        let mezzi = window.game.mezzi.filter(m => {
            if ((m.isSRL || m.isSRP) && (m.stato === 1 || m.stato === 8)) return false;
            return true;
        });
         
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
             <div class="mezzo-header-row" style="display:flex;align-items:center;font-weight:bold;background:#e3e3e3;border-bottom:1px solid #bbb;padding:2px 4px;">
                 <div style="flex:2;min-width:0;overflow:hidden;text-overflow:ellipsis;">Mezzo</div>
                 <div style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;">Tipo</div>
                 <div style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;">Convenzione</div>
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

        // Mostra i mezzi filtrati: prima altri, poi stato8
        [...altriMezzi, ...mezziStato8].forEach(m => {
            const statoLabel = getStatoLabel(m.stato) || m.stato;
            const comunicazione = Array.isArray(m.comunicazioni) && m.comunicazioni.length
                ? m.comunicazioni[m.comunicazioni.length - 1]
                : '';
            // Create a row with name, type, convention, state, and communications
            div.innerHTML += `
            <div class="mezzo-row" data-mezzo-id="${m.nome_radio}" style="display:flex;align-items:center;border-bottom:1px solid #ddd;padding:4px 0;">
                <div class="mezzo-cell" style="flex:2;min-width:0;overflow:hidden;text-overflow:ellipsis;">${m.nome_radio}</div>
                <div class="tipo-cell" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;">${m.tipo_mezzo || ''}</div>
                <div class="convenzione-cell" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;">${m.convenzione || ''}</div>
                <div class="stato-cell" style="flex:1;text-align:left;min-width:70px;">${statoLabel}</div>
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
    }
}
