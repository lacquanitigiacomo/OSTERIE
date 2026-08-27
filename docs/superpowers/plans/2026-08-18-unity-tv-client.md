# Unity Android TV Client Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Creare un client Unity Android TV che sostituisca la TV web senza modificare server, controller o regole.

**Architecture:** Unity è una proiezione del solo stato pubblico. NativeWebSocket trasporta gli stessi envelope JSON della vertical slice web; un adapter C# converte i messaggi in modelli immutabili e aggiorna scene prive di logica autorevole.

**Tech Stack:** Unity LTS compatibile con Android TV, C#, Unity Test Framework, NativeWebSocket, Newtonsoft Json for Unity.

## Global Constraints

- Iniziare dopo il completamento del protocollo condiviso della Task 1 web.
- Nessuna regola di gioco o dato privato viene implementato nel client Unity.
- Il client deve funzionare con telecomando Android TV e risoluzione 1920x1080.
- Connessione, perdita di rete e riconnessione devono essere visibili e recuperabili.

---

### Task 1: Progetto Unity e modelli di protocollo

**Files:**
- Create: `apps/tv-unity/Assets/Scripts/Protocol/ProtocolModels.cs`
- Create: `apps/tv-unity/Assets/Tests/EditMode/ProtocolModelsTests.cs`
- Create: `apps/tv-unity/Packages/manifest.json`

**Interfaces:**
- Produces: `ServerEnvelope`, `PublicGameState`, `PublicPlayer`, `ProtocolParser.Parse(string)`.

- [ ] **Step 1: Scrivere test EditMode**

```csharp
[Test]
public void ParsesPublicSnapshot() {
    var json = "{\"type\":\"state.public\",\"protocolVersion\":1,\"roomCode\":\"ABCD\",\"phase\":\"lobby\",\"players\":[]}";
    Assert.AreEqual("ABCD", ProtocolParser.Parse(json).RoomCode);
}
```

- [ ] **Step 2: Eseguire test e verificare il fallimento**

- [ ] **Step 3: Implementare DTO aderenti ai nomi JSON del package TypeScript**

Rifiutare `protocolVersion` diverso da 1 e tipi di messaggio sconosciuti con `ProtocolException`.

- [ ] **Step 4: Eseguire test EditMode e commit**

```bash
git add apps/tv-unity
git commit -m "feat: add Unity protocol models"
```

### Task 2: Connessione WebSocket e riconnessione

**Files:**
- Create: `apps/tv-unity/Assets/Scripts/Networking/GameSocketClient.cs`
- Create: `apps/tv-unity/Assets/Scripts/Networking/ReconnectPolicy.cs`
- Test: `apps/tv-unity/Assets/Tests/EditMode/ReconnectPolicyTests.cs`

**Interfaces:**
- Produces: `ConnectAsync(uri)`, `DisconnectAsync()`, `PublicStateChanged`, `ConnectionStateChanged`.

- [ ] **Step 1: Testare backoff deterministico**

```csharp
[TestCase(0, 1f)] [TestCase(1, 2f)] [TestCase(2, 4f)] [TestCase(8, 10f)]
public void DelayIsCapped(int attempt, float seconds) {
    Assert.AreEqual(seconds, ReconnectPolicy.DelaySeconds(attempt));
}
```

- [ ] **Step 2: Implementare NativeWebSocket**

Registrare `OnOpen`, `OnError`, `OnClose`, `OnMessage`; usare `SendText` per la registrazione TV e `Close` in `OnApplicationQuit`. Gli eventi devono rientrare sul main thread tramite synchronization context, con `DispatchMessageQueue()` come fallback per versioni che lo richiedono.

- [ ] **Step 3: Implementare riconnessione 1, 2, 4, 8, 10 secondi**

Alla riconnessione reinviare ruolo TV e codice stanza; non creare una nuova partita.

- [ ] **Step 4: Eseguire test e commit**

```bash
git add apps/tv-unity/Assets/Scripts/Networking apps/tv-unity/Assets/Tests
git commit -m "feat: connect Unity TV to game server"
```

### Task 3: Scene lobby e tabellone

**Files:**
- Create: `apps/tv-unity/Assets/Scenes/Lobby.unity`
- Create: `apps/tv-unity/Assets/Scenes/Board.unity`
- Create: `apps/tv-unity/Assets/Scripts/Presentation/LobbyPresenter.cs`
- Create: `apps/tv-unity/Assets/Scripts/Presentation/BoardPresenter.cs`
- Test: `apps/tv-unity/Assets/Tests/PlayMode/PresentationTests.cs`

**Interfaces:**
- Consumes: `PublicStateChanged`.
- Produces: QR/codice stanza, elenco giocatori, turno, dado e posizioni.

- [ ] **Step 1: Testare la proiezione della lobby**

```csharp
[UnityTest]
public IEnumerator LobbyShowsRoomAndPlayers() {
    presenter.Render(Fixtures.Lobby("ABCD", "Gino"));
    yield return null;
    Assert.AreEqual("ABCD", presenter.RoomCode.text);
    StringAssert.Contains("Gino", presenter.PlayerList.text);
}
```

- [ ] **Step 2: Costruire scene 16:9 con safe area TV**

Mantenere contenuti essenziali nel 90% centrale, testo minimo equivalente a 28px a 1080p e contrasto WCAG AA.

- [ ] **Step 3: Collegare fase server alle scene**

`lobby` apre Lobby; `playing` apre Board. Gli snapshot aggiornano presenter esistenti senza ricaricare la scena a ogni messaggio.

- [ ] **Step 4: Test PlayMode e commit**

```bash
git add apps/tv-unity/Assets
git commit -m "feat: render lobby and board on Android TV"
```

### Task 4: Build Android TV e compatibilità server

**Files:**
- Create: `apps/tv-unity/Assets/Editor/AndroidTvBuild.cs`
- Create: `apps/tv-unity/ProjectSettings/ProjectSettings.asset`
- Create: `apps/tv-unity/Assets/Tests/PlayMode/ServerCompatibilityTests.cs`

**Interfaces:**
- Produces: APK Android TV installabile e testato contro il server web.

- [ ] **Step 1: Configurare landscape, gamepad/remote e Android TV manifest**

Impostare orientamento landscape, input D-pad/submit/back, banner TV, launcher Leanback e assenza di touchscreen obbligatorio.

- [ ] **Step 2: Testare contro una stanza reale locale**

Avviare server, collegare Unity come TV e browser come controller; verificare ingresso, start, dado, movimento ed evento.

- [ ] **Step 3: Generare APK Development**

Usare `AndroidTvBuild.BuildDevelopment()` con output `artifacts/osterie-tv-development.apk` e fallire il processo se Unity restituisce errori.

- [ ] **Step 4: Installare sulla Xiaomi Android TV e verificare**

Controllare lancio da home, leggibilità a distanza, D-pad, sospensione/ripresa, perdita Wi-Fi e riconnessione.

- [ ] **Step 5: Commit**

```bash
git add apps/tv-unity
git commit -m "build: add Android TV development package"
```
