# OSTERIE EXTREME SURVIVAL — Game Design e architettura

## 1. Visione

OSTERIE EXTREME SURVIVAL è un party game competitivo 18+ per Android TV controllato dagli smartphone. I giocatori affrontano un percorso generato tra osterie reali di Padova, amministrando denaro, alterazione, stomaco, energia, dignità e sospetto. La comicità è adulta, demenziale e volutamente eccessiva; le scelte rischiose producono vantaggi immediati e conseguenze imprevedibili.

Il gioco offre due esperienze:

- **Divano:** l'intera serata è simulata sulla TV.
- **Osteria:** il gioco accompagna un percorso reale; il telefono dell'host diventa lo schermo principale portatile e le informazioni pubbliche importanti vengono replicate sugli altri telefoni.

La prima release valida il gioco da salotto. La modalità Osteria completa è prevista nell'architettura e viene completata in un aggiornamento successivo.

## 2. Principi di prodotto

- Accesso immediato tramite QR e browser, senza installazione obbligatoria sui telefoni.
- Capienza dinamica senza un limite arbitrario imposto dal regolamento; il servizio applica limiti tecnici misurati e gestisce gruppi numerosi con azioni simultanee e batterie.
- Regole e condizioni di vittoria configurabili dall'host.
- Informazioni pubbliche sulla TV e informazioni segrete sul controller personale.
- Percorsi costruiti con dati reali delle osterie e con tre modalità temporali.
- Comicità rivolta ai personaggi e alle disavventure, non ai locali reali.
- Nessuna prova reale obbliga a bere alcol: in modalità Osteria esiste sempre un'alternativa non alcolica o puramente comica.

## 3. Identità visiva

La direzione fonde il cartoon demenziale con l'immaginario dell'osteria padovana:

- colori forti, espressioni esagerate e animazioni elastiche;
- cartine di Padova simili a tovagliette illustrate e macchiate;
- menu scritti a mano, timbri, ricevute, vino, cicchetti e insegne;
- eventi presentati come vignette tragicomiche;
- avatar che si degradano visivamente con il procedere della serata;
- leggibilità da TV mantenuta con gerarchie grandi e contenuto essenziale.

## 4. Architettura

### 4.1 Client Android TV

Applicazione Unity responsabile di mappa, avatar, animazioni, audio, eventi, classifiche e minigiochi collettivi. Non contiene segreti individuali che possano essere osservati dagli altri partecipanti.

### 4.2 Controller web dei giocatori

Web app mobile aperta tramite QR. Gestisce ingresso, avatar, statistiche private, obiettivi, carte, ordinazioni, scelte segrete, votazioni, sabotaggi e input dei minigiochi. Usa sensori, microfono o movimento solo quando disponibili e autorizzati; ogni prova dispone di un fallback.

### 4.3 Controller dell'host

Estende il controller standard con creazione della stanza, configurazione, pausa, moderazione, espulsione, riconnessione, modifica del percorso e regolazione del caos. In modalità Osteria diventa anche display principale, mentre gli eventi pubblici essenziali vengono replicati sui telefoni dei partecipanti.

### 4.4 Server di sessione

Mantiene lo stato autorevole della partita e sincronizza client TV e web in tempo reale. Gestisce stanza, autenticazione temporanea, timer, azioni simultanee, riconnessione, salvataggi, risoluzione degli eventi e classifica. Le decisioni sensibili e i calcoli dei vincitori non dipendono dal client.

### 4.5 Servizi dati

Archiviano osterie, coordinate, orari, prezzi indicativi, tag, archetipi, oggetti, eventi, minigiochi e regole. I dati variabili sono aggiornabili senza pubblicare una nuova build Unity.

## 5. Configurazione della partita

L'host può scegliere:

- Divano oppure Osteria;
- durata rapida, standard, maratona o personalizzata;
- budget iniziale;
- zona e distanza massima;
- difficoltà e intensità del caos;
- modalità temporale;
- condizioni di vittoria e relativi pesi;
- archetipi, abilità e difetti;
- assegnazione libera, casuale o tramite draft;
- presenza di obiettivi segreti;
- eliminazione oppure penalità non eliminanti;
- livello di volgarità ed eventi ammessi;
- timeout e gestione degli assenti.

## 6. Personaggi

Ogni giocatore configura aspetto, soprannome, abiti, accessori, animazione di vittoria e reazioni ai principali disastri. A questa parte estetica associa un archetipo configurabile che fornisce abilità, difetto e possibili missioni.

L'host può consentire scelta libera, generazione casuale o draft bilanciato. Può inoltre disattivare integralmente le abilità e mantenere gli archetipi come semplice elemento estetico.

## 7. Ciclo di gioco

1. L'host crea e configura la stanza.
2. I giocatori entrano via QR e preparano i personaggi.
3. Il sistema genera un percorso compatibile con regole, tempo e dati dei locali.
4. Durante il trasferimento risolve incontri, scorciatoie, ricompense e imprevisti.
5. All'ingresso in osteria i giocatori scelgono simultaneamente ordinazione, cibo, riposo, oggetti o sabotaggi.
6. Parte un minigioco individuale o collettivo influenzato dalle condizioni del personaggio.
7. Segue una fase sociale con bluff, votazioni, alleanze, accuse o sfide.
8. Il server applica conseguenze e aggiorna statistiche, condizioni e obiettivi.
9. Il ciclo prosegue fino a completamento, eliminazione o evento finale.
10. La classifica applica le condizioni di vittoria configurate.

## 8. Statistiche e stati combinati

| Statistica | Funzione |
| --- | --- |
| Budget | Acquisti, trasporti, scommesse, recupero e soluzioni agli eventi |
| Ubriachezza | Altera controlli, informazioni e probabilità |
| Stomaco | Determina capacità e rischio di vomito |
| Energia | Influenza movimento, resistenza e prestazioni |
| Dignità | Misura la reputazione sociale e alimenta diverse vittorie |
| Sospetto | Attira espulsioni, controlli ed eventi pericolosi |

Gli stati emergono dalle combinazioni: ubriachezza elevata e stomaco pieno aumentano il vomito; poca energia e molta ubriachezza possono causare blackout; sospetto elevato e dignità bassa facilitano controlli ed espulsioni.

Le scorciatoie estreme non cancellano magicamente l'alterazione. Una sostanza misteriosa può aumentare energia o percezione di lucidità senza ridurre l'ubriachezza, introducendo rischi come paranoia, collasso o perdita di controllo. Cibo, acqua, riposo e trasporto sono recuperi più sicuri ma consumano tempo o denaro.

Il fallimento non equivale sempre a eliminazione: vomitare può distruggere la dignità e alleggerire lo stomaco, aprendo una grottesca rimonta.

## 9. Eventi e ricompense

Le famiglie di eventi sono personali, sociali, ambientali, estreme e fortunate. Ogni evento offre da due a quattro risposte con costi, probabilità, conseguenze immediate o ritardate e interazioni con archetipi e statistiche.

Le ricompense comprendono denaro, oggetti, immunità, informazioni private, modificatori, carte sabotaggio e recuperi di dignità. Nessuna scelta deve essere universalmente corretta: la soluzione migliore dipende dal personaggio, dalla modalità di vittoria e dallo stato corrente.

## 10. Minigiochi e gioco sociale

La prima raccolta include equilibrio, mira, memoria alterata, riflessi, voce, disegno, bluff, votazioni, cooperazione temporanea e sabotaggio. La V1 ne implementa almeno sei con varianti.

Ubriachezza e condizioni temporanee possono invertire controlli, deformare tempi, nascondere elementi o mostrare informazioni false. Con molti giocatori le prove sono simultanee; la TV presenta risultati, fallimenti memorabili e replay. Le prove vocali o fisiche selezionano un numero ridotto di protagonisti tramite sorteggio, voto o classifica.

## 11. Condizioni di vittoria

L'host può attivare singolarmente o combinare con pesi:

- ultimo in piedi;
- dignità più alta;
- punteggio totale;
- budget residuo;
- maggior numero di osterie completate;
- obiettivi segreti;
- Extreme Survival, con eliminazione per collasso, arresto o bancarotta;
- Caos totale, con condizioni nascoste fino alla classifica finale.

## 12. Osterie reali e generazione del percorso

Ogni scheda locale contiene nome, indirizzo, coordinate, orari, fascia di prezzo, proposte caratteristiche, accessibilità, durata media e tag di gameplay. Prezzi e disponibilità sono dichiarati indicativi.

Il generatore evita locali incompatibili, tragitti irrealistici e sequenze monotone. In Divano costruisce una Padova caricaturale usando gli stessi dati; in Osteria propone spostamenti reali.

Il gioco non inventa recensioni, problemi o comportamenti attribuiti ai locali. Gli eventi negativi appartengono alla simulazione e ai personaggi. In futuro un locale può verificare la scheda, proporre missioni ufficiali o sponsorizzare ricompense senza influenzare la correttezza della gara.

## 13. Sistemi temporali

### Orario reale

Sincronizza data e ora della partita con aperture, chiusure, giorno della settimana, festività, tempi di sosta e percorrenza. Esclude le tappe impossibili e ricalcola il percorso quando la partita accumula ritardo. L'host può correggere eccezioni dal vivo, come locale pieno, chiuso o con orario errato.

### Orario simulato

L'host sceglie giorno, ora di partenza e velocità. Il tempo interno governa aperture, trasporti ed eventi e consente di simulare una serata completa in una sessione più breve.

### Tempo anarchico

Ignora gli orari e rende disponibili tutte le tappe idonee. Serve per partite rapide, dimostrative o puramente comiche.

## 14. Esperienza pubblica e privata

La TV mostra mappa, percorso, avatar, eventi, risultati e classifiche parziali. Il telefono conserva statistiche complete, obiettivi, carte, oggetti, scelte e informazioni alterate. La classifica completa può restare nascosta fino al finale.

In modalità Osteria, il telefono dell'host assume il ruolo della TV; i telefoni dei giocatori ricevono anche gli annunci pubblici essenziali senza rivelare segreti.

## 15. Affidabilità e casi di errore

- Riconnessione con ripristino di identità e progressi.
- Bot temporaneo opzionale per un giocatore disconnesso.
- Timeout configurabile e scelta predefinita sicura.
- Salvataggio dello stato dopo ogni fase.
- Rigenerazione del percorso se una tappa diventa incompatibile.
- Cache dei dati delle osterie quando i servizi esterni non rispondono.
- Moderazione di nomi, avatar e partecipanti.
- Fallback dei minigiochi per sensori o permessi mancanti.
- Stato autorevole sul server per impedire discrepanze tra client.
- Idempotenza delle azioni inviate più volte dopo una riconnessione.

## 16. Strategia di verifica

- Test unitari per statistiche, eventi, vincitori e combinazioni di regole.
- Test generativi per percorsi validi nei tre sistemi temporali.
- Test di integrazione per protocollo TV, controller e server.
- Test di carico per partecipanti simultanei e batterie di minigiochi.
- Test di disconnessione, riconnessione e ripristino.
- Profilazione su dispositivi Android TV economici.
- Test di leggibilità a distanza e accessibilità dei controller.
- Partite automatiche con bot per individuare blocchi e sbilanciamenti.
- Playtest con gruppi piccoli e numerosi.

## 17. Perimetro di rilascio

### V1

- Android TV Unity e controller web via QR;
- modalità Divano;
- tre sistemi temporali;
- primo catalogo di osterie reali;
- generatore di percorso;
- avatar, archetipi e configurazione completa;
- sei statistiche e stati combinati;
- 30–40 eventi;
- almeno sei minigiochi con varianti;
- scelte, bluff, votazioni e sabotaggi;
- condizioni di vittoria configurabili;
- riconnessione e salvataggio;
- stile cartoon demenziale e osteria illustrata.

### Aggiornamento Osteria

- modalità reale completa;
- posizione e spostamenti dal vivo;
- sincronizzazione avanzata di orari e aperture;
- segnalazioni e correzioni dell'host;
- prove fisiche opzionali;
- più quartieri, locali, archetipi ed eventi;
- verifica delle schede da parte dei locali.

## 18. Criteri di successo della V1

- Un nuovo giocatore entra via QR e completa la configurazione senza assistenza.
- Una partita può essere terminata senza blocchi anche dopo disconnessioni.
- Il percorso generato rispetta configurazione e modalità temporale.
- I giocatori comprendono le informazioni principali guardando la TV da distanza da salotto.
- Le diverse condizioni di vittoria producono strategie differenti.
- Eventi, minigiochi e interazioni sociali generano variazione sufficiente tra partite.
- La struttura consente l'aggiunta della modalità Osteria senza riscrivere il motore di sessione.
