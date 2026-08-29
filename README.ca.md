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
*   **Chrome Storage Sync:** utilitza l'API d'emmagatzematge per mantenir les etiquetes sincronitzades entre dispositius.
*   **Dynamic i18n:** implementa un sistema de localització propi que permet el canvi d'idioma instantani sense necessitat de recarregar la pàgina.
*   **MutationObserver:** s'utilitza per detectar de forma eficient i reactiva quan s'afegeixen nous quaderns a la llista o es produeixen canvis en la navegació.
*   **Fragmentació de dades (chunking):** sistema avançat per superar el límit de 8 KB de Chrome Sync mitjançant la divisió de dades en fragments.
*   **ID d'extensió predefinit:** el `manifest.json` inclou una clau pública (`key`) per assegurar que l'ID de l'extensió sigui idèntic en totes les instal·lacions manuals.
*   **Permisos:**
    *   `storage`: per guardar i sincronitzar les teves etiquetes i preferències.

---

## 💾 Gestió de dades i seguretat

NotebookLM Organizer utilitza la infraestructura de **Google Chrome Sync** per mantenir la teva organització sincronitzada entre dispositius. El comportament d'aquesta sincronització varia segons el mètode d'instal·lació:

### 🛠️ Instal·lació manual (Mode de desenvolupament)
Quan l'extensió s'instal·la manualment des d'una carpeta, Chrome aplica una política estricta: en desinstal·lar l'extensió d'un dispositiu, les dades vinculades al teu compte de Google per a aquesta extensió **poden ser eliminades de forma immediata i definitiva**.

-   **Sense respatller local:** En aquest mode, l'extensió no manté còpies de seguretat automàtiques al teu disc dur per maximitzar la compatibilitat amb el sistema natiu.
-   **Responsabilitat de l'usuari:** És **imprescindible** realitzar una exportació manual abans de desinstal·lar l'extensió si desitges conservar les teves etiquetes.
-   **Avís persistent:** Veuràs un bàner d'advertència al modal de gestió d'etiquetes mentre aquest mode estigui actiu.

### 🏪 Instal·lació oficial (Mode Store)
Si l'extensió s'instal·la des de la Chrome Web Store, la persistència de les dades al teu compte de Google és gestionada de forma oficial i és molt més estable davant desinstal·lacions.

### ⚠️ Recomanacions de seguretat
-   **Exportació manual (💾):** Realitza còpies de seguretat periòdiques descarregant la teva configuració en format JSON. És la teva única garantia absoluta de recuperació davant canvis en les polítiques de Google. *Shit happens* 😅.
-   **Actualitzacions:** Per instal·lar una nova versió del codi en mode dev, no desinstal·lis l'extensió. Sobreescriu els fitxers a la teva carpeta i prem el botó de recàrrega a `chrome://extensions`.

---

## 🛠️ Instal·lació (en mode desenvolupador)

Segueix aquests passos per instal·lar l'extensió de forma local:

1. Descarrega i descomprimeix l'arxiu zip o clona aquest repositori al teu equip.
2. Obre Google Chrome i ves a la pàgina d'extensions: `chrome://extensions`.
3. Activa el **"Mode de desenvolupador"** a la part superior dreta.
4. Fes clic en el botó **"Carrega descomprimida"**.
5. Selecciona la carpeta **extension** dins de la carpeta del projecte que has descarregat o clonat.
6. Fet! L'extensió apareixerà al teu llistat d'extensions i estarà activa a `notebook.google.com` (i `notebooklm.google.com`).

---

## 📝 Nota sobre la publicació a la Chrome Web Store

Atès que l'extensió es basa en l'anàlisi de l'estructura del DOM de l'aplicació Gemini Notebook (NotebookLM), i aquesta pot canviar en qualsevol moment sense previ avís, l'autor prefereix no publicar-la per ara a la Chrome Web Store. El cost de manteniment i la necessitat d'adaptar-la a canvis freqüents fan que sigui més pràctic distribuir-la com un projecte de codi obert per a la seva instal·lació manual.

> **Important per a la publicació:** Si vols publicar la teva pròpia versió a la Store, s'ha inclòs l'arxiu **`extension/manifest.webstore.json`**. Aquest arxiu és una versió "neta" que **no inclou la propietat `key`**, requisit indispensable perquè Google assigni un ID oficial a la teva publicació. 
> 
> Per fer-lo servir, simplement canvia el nom de `manifest.webstore.json` a `manifest.json` (sobreescrivint l'original) just abans de comprimir la carpeta `extension` en un arxiu `.zip` per a la seva pujada a la consola de desenvolupadors.

---

## 🤝 Crèdits

Aquest projecte ha estat creat i és mantingut per **Pablo Felip** ([LinkedIn](https://www.linkedin.com/in/pfelipm/) | [GitHub](https://github.com/pfelipm)).

---

## 📄 Llicència

Aquest projecte es distribueix sota els termes de l'arxiu [LICENSE](LICENSE).
