# Demo V1

## Avvio

Prerequisiti: Node 20.20+ e dipendenze installate con `npm install`.

```bash
npm run demo
```

- TV: `http://localhost:5173/?room=ABCD`
- Smartphone: aprire il QR della TV oppure `http://IP-DEL-MAC:5174/join/ABCD`
- Health server: `http://localhost:8787/health`

Telefono e Mac devono essere sulla stessa rete. Per un telefono reale, sostituire `localhost` con l'indirizzo LAN del Mac e servire in HTTPS quando il browser lo richiede per `DeviceMotionEvent`; il pulsante “Lancia i dadi” resta disponibile.

## Flusso minimo

1. Aprire la TV e mostrare stanza e QR.
2. Entrare dal telefono con un nickname.
3. Avviare la partita dal controller.
4. Scuotere il telefono o premere il pulsante.
5. Verificare risultato e movimento sulla TV.
6. Risolvere il primo imprevisto dal telefono.

Questa demo usa memoria volatile: riavviando il server, le stanze vengono azzerate.
