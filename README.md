[🇺🇸 English version](README.en.md) | [🦎 Versió en català](README.ca.md)

# NotebookLM Organizer 🏷️

**NotebookLM Organizer** es una extensión de navegador diseñada para potenciar la organización de tu espacio de trabajo en [Gemini Notebook](https://notebook.google.com) (anteriormente NotebookLM). Mediante un sistema de etiquetas de colores y filtrado avanzado, permite gestionar tus cuadernos con una experiencia de usuario fluida y completamente integrada, que se siente como una funcionalidad nativa de la plataforma.

![notebookLM Organizer GIF](assets/overview.gif)

---

## 🔒 Privacidad y seguridad

La privacidad es el pilar fundamental de esta extensión. NotebookLM Organizer ha sido diseñada bajo el principio de **mínimo acceso necesario**:

- **Sin acceso al contenido:** la extensión **en ningún momento** lee, accede ni procesa el contenido del texto, documentos o fuentes que guardas dentro de tus cuadernos.
- **Solo metadatos organizativos:** únicamente detecta el **nombre del cuaderno, el número de fuentes y la fecha de creación**. Estos datos se utilizan exclusivamente para identificar el cuaderno y asociarle tus etiquetas.
- **Sin manipulación de datos:** la extensión no modifica ni manipula tus cuadernos de ninguna forma. Solo añade una capa visual de organización sobre la interfaz existente de Google.
- **Tus datos son tuyos:** toda la configuración se almacena en tu cuenta de Google (vía Chrome Sync) y solo tú tienes acceso a ella.

---

## ✨ Características destacadas

- 🏷️ **Etiquetado con colores:** crea etiquetas personalizadas con una paleta de colores vibrantes para categorizar tus proyectos visualmente.
- 🔍 **Filtrado avanzado:** localiza cuadernos al instante combinando búsqueda por texto y filtros de etiquetas con lógica **Y (AND)** u **O (OR)**.
- 🌓 **Modo oscuro automático:** la interfaz se adapta automáticamente al tema (claro u oscuro) que tengas configurado en Gemini Notebook, respetando tu preferencia visual al 100%.
- 🔄 **Sincronización automática:** tus etiquetas y preferencias se sincronizan automáticamente entre todos tus dispositivos mediante tu cuenta de Chrome.
- 💾 **Respaldo granular:** exporta e importa tu configuración en formato JSON, permitiendo elegir qué elementos restaurar.
- 🌐 **Soporte multi-idioma:** interfaz localizada íntegramente en **español, inglés y català**, con cambio de idioma instantáneo desde la interfaz.
- 💡 **Gestión de destacados:** por limpieza y conveniencia, la extensión oculta la vista previa limitada de cuadernos destacados en la pestaña principal "Todos" y se inhibe automáticamente en la pestaña de "Destacados".
- 🚀 **Acceso rápido:** haz clic en el icono de la extensión desde cualquier página para abrir Gemini Notebook en una nueva pestaña al instante.
- ⚡ **Interfaz nativa:** diseñada para ofrecer una experiencia de uso con funciones ampliadas que se sientan como nativas de Gemini Notebook, sin romper tu flujo de trabajo.

---

## ⚠️ Nota importante sobre la vista de lista

Debido a que Gemini Notebook no expone identificadores únicos internos en todas sus vistas, la extensión utiliza una "huella digital" basada en metadatos para identificar cada cuaderno. 

Si tienes varios cuadernos con el **mismo nombre, mismo número de fuentes y misma fecha**, la extensión detectará una **colisión** en la vista de lista y bloqueará el etiquetado por seguridad para evitar errores de asociación. En estos casos, aparecerá un icono de aviso (⚠️) y deberás utilizar la **vista de miniaturas** (cuadrícula) para etiquetarlos, ya que en esa vista sí es posible obtener un identificador único real.

---

## ⚙️ Detalles técnicos

*   **Sin frameworks ni dependencias externas:** desarrollada íntegramente con **Vanilla JS** y **CSS estándar** para garantizar la máxima ligereza, velocidad y compatibilidad.
*   **Manifest V3:** la extensión utiliza la última versión del manifiesto de Chrome para garantizar la máxima seguridad y rendimiento.
*   **Chrome Storage Sync:** utiliza la API de almacenamiento para mantener las etiquetas sincronizadas entre dispositivos.
*   **Dynamic i18n:** implementa un sistema de localización propio que permite el cambio de idioma instantáneo sin necesidad de recargar la página.
*   **MutationObserver:** se utiliza para detectar de forma eficiente y reactiva cuándo se añaden nuevos cuadernos a la lista o se producen cambios en la navegación.
*   **Data Fragmentation (Chunking):** sistema avanzado para superar el límite de 8 KB de Chrome Sync mediante la división de datos en fragmentos.
*   **ID de extensión predefinido:** el `manifest.json` incluye una clave pública (`key`) para asegurar que el ID de la extensión sea idéntico en todas las instalaciones manuales.
*   **Permisos:**
    *   `storage`: para guardar y sincronizar tus etiquetas y preferencias.

---

## 💾 Gestión de datos y seguridad

NotebookLM Organizer utiliza la infraestructura de **Google Chrome Sync** para mantener tu organización sincronizada entre dispositivos. El comportamiento de esta sincronización varía según el método de instalación:

### 🛠️ Instalación manual (Modo de desarrollo)
Cuando la extensión se instala manualmente desde una carpeta, Chrome aplica una política estricta: al desinstalar la extensión de un dispositivo, los datos vinculados a tu cuenta de Google para esta extensión **pueden ser eliminados de forma inmediata y definitiva**.

-   **Sin respaldo local:** En este modo, la extensión no mantiene copias de seguridad automáticas en tu disco duro para maximizar la compatibilidad con el sistema nativo.
-   **Responsabilidad del usuario:** Es **imprescindible** realizar una exportación manual antes de desinstalar la extensión si deseas conservar tus etiquetas.
-   **Aviso persistente:** Verás un banner de advertencia en el modal de gestión de etiquetas mientras este modo esté activo.

### 🏪 Instalación oficial (Modo Store)
Si la extensión se instala desde la Chrome Web Store, la persistencia de los datos en tu cuenta de Google es gestionada de forma oficial y es mucho más estable ante desinstalaciones.

### ⚠️ Recomendaciones de seguridad
-   **Exportación manual (💾):** Realiza copias de seguridad periódicas descargando tu configuración en formato JSON. Es tu única garantía absoluta de recuperación ante cambios en las políticas de Google. *Shit happens* 😅.
-   **Actualizaciones:** Para instalar una nueva versión del código en modo dev, no desinstales la extensión. Sobreescribe los archivos en tu carpeta y pulsa el botón de recarga en `chrome://extensions`.

---

## 🛠️ Instalación (en modo desarrollador)

Sigue estos pasos para instalar la extensión de forma local:

1. Descarga y descomprime el archivo zip o clona este repositorio en tu equipo.
2. Abre Google Chrome y dirígete a la página de extensiones: `chrome://extensions`.
3. Activa el **"Modo de desarrollador"** en la parte superior derecha.
4. Haz clic en el botón **"Cargar descomprimida"**.
5. Selecciona la carpeta **extension** dentro de la carpeta del proyecto que has descargado o clonado.
6. ¡Listo! La extensión aparecerá en tu listado de extensiones y estará activa en `notebook.google.com` (y `notebooklm.google.com`).

---

## 📝 Nota sobre la publicación en la Chrome Web Store

Dado que la extensión se basa en el análisis de la estructura del DOM de la aplicación Gemini Notebook (NotebookLM), y esta puede cambiar en cualquier momento sin previo aviso, el autor prefiere no publicarla por ahora en la Chrome Web Store. El coste de mantenimiento y la necesidad de adaptarla a cambios frecuentes hacen que sea más práctico distribuirla como un proyecto de código abierto para su instalación manual.

> **Important para la publicación:** Si deseas publicar tu propia versión en la Store, se ha incluido el archivo **`extension/manifest.webstore.json`**. Este archivo es una versión "limpia" que **no incluye la propiedad `key`**, requisito indispensable para que Google asigne un ID oficial a tu publicación. 
> 
> Para usarlo, simplemente renombra `manifest.webstore.json` a `manifest.json` (sobrescribiendo el original) justo antes de comprimir la carpeta `extension` en un archivo `.zip` para su subida a la consola de desarrolladores.

---

## 🤝 Créditos

Este proyecto ha sido creado y es mantenido por **Pablo Felip** ([LinkedIn](https://www.linkedin.com/in/pfelipm/) | [GitHub](https://github.com/pfelipm)).

---

## 📄 Licencia

Este proyecto se distribuye bajo los términos del archivo [LICENSE](LICENSE).
