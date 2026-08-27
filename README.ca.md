[🇪🇸 Versión en español](README.md) | [🇺🇸 English version](README.en.md)

# NotebookLM Organizer 🏷️

**NotebookLM Organizer** és una extensió de navegador dissenyada per potenciar l'organització del teu espai de treball a [Gemini Notebook](https://notebook.google.com) (anteriorment NotebookLM). Mitjançant un sistema d'etiquetes de colors i filtratge avançat, permet gestionar els teus quaderns amb una experiència d'usuari fluida i completament integrada, que se sent com una funcionalitat nativa de la plataforma.

![notebookLM Organizer GIF](assets/overview.gif)

---

## 🔒 Privadesa i seguretat

La privadesa és el pilar fonamental d'aquesta extensió. NotebookLM Organizer ha estat dissenyada sota el principi de **mínim accés necessari**:

- **Sense accés al contingut:** l'extensió **en cap moment** llegeix, accedeix ni processa el contingut del text, documents o fonts que guardes dins dels teus quaderns.
- **Només metadades organitzatives:** únicament detecta el **nom del quadern, el nombre de fonts i la data de creació**. Aquestes dades s'utilitzen exclusivament per identificar el quadern i associar-li les teves etiquetes.
- **Sense manipulació de dades:** l'extensió no modifica ni manipula els teus quaderns de cap forma. Només afegeix una capa visual d'organització sobre la interfície existent de Google.
- **Les teves dades són teves:** tota la configuració s'emmagatzema al teu compte de Google (via Chrome Sync) i només tu hi tens accés.

---

## ✨ Característiques destacades

- 🏷️ **Etiquetatge amb colors:** crea etiquetes personalitzades amb una paleta de colors vibrants per categoritzar els teus projectes visualment.
- 🔍 **Filtratge avançat:** localitza quaderns a l'instant combinant cerca per text i filtres d'etiquetes amb lògica **I (AND)** o **O (OR)**.
- 🌓 **Mode fosc automàtic:** la interfície s'adapta automàticament al tema (clar o fosc) que tinguis configurat a Gemini Notebook, respectant la teva preferència visual al 100%.
- 🔄 **Sincronització automàtica:** les teves etiquetes i preferències es sincronitzen automàticament entre tots els teus dispositius mitjançant el teu compte de Chrome.
- 💾 **Respatller granular:** exporta i importa la teva configuració en format JSON, permetent triar quins elements restaurar.
- 🌐 **Suport multi-idioma:** interfície localitzada íntegrament en **espanyol, anglès i català**, amb canvi d'idioma instantani des de la interfície.
- 💡 **Gestió de destacats:** per neteja i conveniència, l'extensió oculta la vista prèvia limitada de quaderns destacats a la pestanya principal "Tots" i s'inhibeix automàticament a la pestanya de "Destacats".
- 🚀 **Accés ràpid:** fes clic a la icona de l'extensió des de qualsevol pàgina per obrir Gemini Notebook en una pestanya nova a l'instant.
- ⚡ **Interfície nativa:** dissenyada per oferir una experiència d'ús amb funcions ampliades que se sentin com natives de Gemini Notebook, sense trencar el teu flux de treball.

---

## ⚠️ Nota important sobre la vista de llista

Atès que Gemini Notebook no exposa identificadors únics interns en totes les seves vistes, l'extensió utilitza una "petjada digital" basada en metadades per identificar cada quadern. 

Si tens diversos quaderns amb el **mateix nom, mateix nombre de fonts i mateixa data**, l'extensió detectarà una **col·lisió** a la vista de llista i bloquejarà l'etiquetatge per seguretat per evitar errors d'associació. En aquests casos, apareixerà una icona d'avís (⚠️) i hauràs d'utilitzar la **vista de miniatures** (quadrícula) per etiquetar-los, ja que en aquesta vista sí que és possible obtenir un identificador único real.

---

## ⚙️ Detalls tècnics

*   **Sense frameworks ni dependències externes:** desenvolupada íntegrament amb **Vanilla JS** i **CSS estàndard** per garantir la màxima lleugeresa, velocitat i compatibilitat.
*   **Manifest V3:** l'extensió utilitza l'última versió del manifest de Chrome per garantir la màxima seguretat i rendiment.
*   **Chrome Storage Sync & Local:** utilitza l'API d'emmagatzematge per mantenir les etiquetes sincronitzades entre dispositius i realitzar cachè local de seguretat.
*   **Dynamic i18n:** implementa un sistema de localització propi que permet el canvi d'idioma instantani sense necessitat de recarregar la pàgina.
*   **MutationObserver:** s'utilitza per detectar de forma eficient i reactiva quan s'afegeixen nous quaderns a la llista o es produeixen canvis en la navegació.
*   **Fragmentació de dades (chunking):** sistema avançat per superar el límit de 8 KB de Chrome Sync mitjançant la divisió de dades en fragments.
*   **ID d'extensió predefinit:** el `manifest.json` inclou una clau pública (`key`) per assegurar que l'ID de l'extensió sigui idèntic en totes les instal·lacions manuals. Això és indispensable perquè Chrome Sync reconegui que es tracta de la mateixa extensió i permeti la sincronització. **Important:** tot i que l'ID sigui el mateix per a tots els usuaris d'aquest repositori, les teves dades estan vinculades exclusivament al teu compte de Google i ningú més pot accedir-hi.
*   **Permisos:**
    *   `storage`: per guardar i sincronitzar les teves etiquetes i preferències.

---

## 💾 Gestió de dades i seguretat avançada

NotebookLM Organizer integra un motor de sincronització adaptatiu que detecta automàticament l'entorn d'instal·lació per garantir la màxima seguretat de la teva organització.

Atès que Google Chrome pot eliminar les dades de sincronització en desinstal·lar una extensió carregada manualment (Mode Dev), s'ha implementat un sistema de **redundància dual** i un **assistent de resolució de conflictes**.

### 🛠️ Modes de seguretat en desenvolupament (instal·lació manual)
Mentre l'extensió s'utilitzi en mode de desenvolupament, disposaràs de tres nivells de protecció configurables des del modal de gestió d'etiquetes:

<p align="center">
  <img src="assets/modos-sync-dev-ca.png" alt="Modes de sincronització">
</p>

1.  **Intel·ligent (recomanat):** utilitza una **heurística de confiança**. Si detecta una pèrdua massiva de dades al núvol (tenint almenys 3 etiquetes en local i detectant-ne menys de la meitat al núvol), el sistema activa l'assistent de recuperació.
2.  **Validació manual:** el mode més estricte. Sempre que hi hagi una discrepància en les mètriques entre aquest equip i el núvol, l'extensió et demanarà confirmar quina versió vols mantenir.
3.  **Només núvol:** desactiva la redundància local i es comporta de forma minimalista, confiant exclusivament en Google Sync (comportament idèntic a la versió de la botiga).

### 🔄 Assistent de recuperació
Quan es detecta una inconsistència, l'extensió mostra un diàleg detallat amb mètriques comparatives perquè prenguis una decisió informada:

<p align="center">
  <img src="assets/alerta-fusión-ca.png" alt="Diàleg de conflicte">
</p>

---

## 🧠 Filosofia de disseny: independència i resiliència

Durant el desenvolupament d'aquesta extensió, es va plantejar una decisió de disseny crítica: com evitar que Google esborri les dades de sincronització en desinstal·lar la versió de desenvolupament?

Una solució ràpida hauria estat registrar l'extensió a la Chrome Web Store per obtenir un **ID oficial**. En utilitzar aquest identificador en la versió de desenvolupament, les dades al núvol quedarien "ancorades" a la versió de la botiga, de manera que el navegador deixaria d'eliminar-les automàticament en desinstal·lar una instància local. No obstant això, es va optar per **no fer-ho** per prioritzar els següents principis:

1.  **Sobirania i codi obert:** en no dependre d'un ID assignat per una botiga propietària, el projecte és 100% independent i portable. Qualsevol persona pot clonar el repositori i tenir un sistema funcional i segur sense passar pel control d'una plataforma externa.
2.  **Arquitectura de resiliència:** en lloc de confiar en una política de base de datos de tercers (que pot canviar), s'ha construït una infraestructura de seguretat pròpia. L'extensió és ara un sistema autònom capaç d'autoreparar-se.
3.  **Transparència:** aquest camí va obligar a crear l'**assistent de conflictes**, la qual cosa dona a l'usuari un control total i una visibilitat absoluta sobre la seva informació, quelcom que el sistema "invisible" de Google no proporciona.

En resum: s'ha triat el camí del **maestratge tècnic** sobre el camí curt, garantint que NotebookLM Organizer sigui una eina tan robusta com independent.

---

## 🏪 Funcionament en mode oficial (Chrome Web Store)

Si l'extensió s'instal·la des de la botiga oficial, detecta l'entorn i simplifica la seva lògica al màxim. En aquest mode, confia plenament en la infraestructura nativa de Google Sync i opera de forma lleugera sense necessitat de mantenir backups locals redundants ni mostrar diàlegs de conflicte.

**Important:** en desinstal·lar l'extensió oficial, Google elimina automàticament totes les dades sincronitzades associades al teu compte per a aquesta extensió. Si vols conservar la teva organització per a una instal·lació futura, realitza sempre una exportació manual abans d'eliminar-la.

---

## ⚠️ Recomanacions de seguretat

-   **Exportació manual (💾):** independentment del mode d'instal·lació, es recomana realitzar còpies de seguretat periòdiques descarregant la configuració en format JSON. És la xarxa de seguretat definitiva per si tota la resta falla. *Shit happens* 😅.
-   **Conserva sempre un "guardià" (només mode dev):** mentre mantinguis l'extensió instal·lada en almenys un dispositiu, les teves dades es podran recuperar automàticament en els altres gràcies a la redundància local.
-   **Actualitzacions (només mode dev):** per instal·lar una nova versió del codi, no cal desinstal·lar l'extensió. Simplement sobreescriu els fitxers a la teva carpeta local i prem el botó de recàrrega a `chrome://extensions`.

---


## 🛠️ Instal·lació

La forma més senzilla i recomanada d'instal·lar l'extensió és a través de la **Chrome Web Store**:

👉 [**Instal·la des de la Chrome Web Store**](https://chromewebstore.google.com/detail/bolafachcnffchfenddbfpbfcfhgahen?utm_source=item-share-cb)

### Instal·lació manual (mode desenvolupador)
Si prefereixes instal·lar-la manualment per fer proves o contribuir al codi, segueix aquests passos:

1. Descarrega i descomprimeix l'arxiu zip o clona aquest repositori al teu equip.
2. Obre Google Chrome i ves a la pàgina d'extensions: `chrome://extensions`.
3. Activa el **"Mode de desenvolupador"** a la part superior dreta.
4. Fes clic en el botó **"Carrega descomprimida"**.
5. Selecciona la carpeta **extension** dins de la carpeta del projecte que has descarregat o clonat.
6. Fet! L'extensió apareixerà al teu llistat d'extensions i estarà activa a `notebook.google.com` (i `notebooklm.google.com`).

---

## 📝 Nota sobre el manteniment

Aquesta extensió està disponible de forma oficial a la **Chrome Web Store**. No obstant això, atès que el seu funcionament es basa en l'anàlisi de l'estructura del DOM de l'aplicació Gemini Notebook (NotebookLM), i aquesta pot canviar en qualsevol moment sense previ avís, l'autor adverteix que el manteniment davant canvis estructurals de Google es realitzarà de forma voluntària. El cost de manteniment i la necessitat d'adaptar-la a canvis freqüents fan que sigui un projecte impulsat per la comunitat i el codi obert.

> **Important per a desenvolupadors:** Si vols publicar la teva pròpia versió a la Store, s'ha inclòs l'arxiu **`extension/manifest.webstore.json`**. Aquest arxiu és una versió "neta" que **no inclou la propietat `key`** (obligatòria per obtenir un ID oficial nou). Per fer-lo servir, simplement canvia el nom de `manifest.webstore.json` a `manifest.json` just abans d'empaquetar la carpeta `extension` per a la seva pujada a la consola de desenvolupadors.

---

## 🤝 Crèdits

Aquest projecte ha estat creat i és mantingut per **Pablo Felip** ([LinkedIn](https://www.linkedin.com/in/pfelipm/) | [GitHub](https://github.com/pfelipm)).

---

## 📄 Llicència

Aquest projecte es distribueix sota els termes de l'arxiu [LICENSE](LICENSE).
