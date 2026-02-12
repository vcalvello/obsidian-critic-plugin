# Obsidian CriticMarkup Plugin - Spec detallado

## Objetivo

Replicar la experiencia de comentarios y modos de edicion de Google Docs dentro de Obsidian, usando CriticMarkup como formato de persistencia en plain text.

El plugin debe sentirse como Google Docs pero respetar la filosofia de Obsidian: archivos locales, Markdown puro, sin lock-in.

### Principio de diseno: Opinionated by default

Este plugin NO es un framework configurable. Es una replica fiel de Google Docs. Las decisiones de UX ya estan tomadas:

- **Colores, layout, comportamientos**: fijos, copiados de Google Docs. No hay color pickers ni opciones de posicion.
- **Settings minimos**: solo lo estrictamente necesario para funcionar (nombre del autor). Todo lo demas esta hardcodeado con los defaults correctos.
- **Si Google Docs lo hace de una forma, este plugin lo hace igual.** No hay variantes ni modos alternativos.
- **Menos opciones = menos bugs, menos decisiones para el usuario, mejor UX.** Si en el futuro se necesita flexibilidad, se agrega. Pero v1 es opinionated.

---

## 1. Referencia: Google Docs (observado)

### 1.1 Tres modos de edicion

| Modo | Icono | Comportamiento |
|------|-------|----------------|
| **Editing** | Lapiz | Edicion directa. Los cambios se aplican al documento inmediatamente. |
| **Suggesting** | Lapiz con corchetes | Cada edicion se convierte en una sugerencia. El texto original se preserva. Additions en verde con underline, deletions en verde con strikethrough. |
| **Viewing** | Ojo | Solo lectura. Muestra el documento limpio (sin comments, sin suggestions, sin toolbar de formato). |

**Detalle del modo Suggesting:**
- Escribir texto nuevo genera una **addition** (verde, underline)
- Borrar texto genera una **deletion** (verde, strikethrough)
- Seleccionar y reemplazar genera una **substitution** (deletion + addition combinados)
- Cada suggestion crea automaticamente un card en el sidebar

### 1.2 Comentarios

**Creacion:**
- Seleccionar texto > aparece mini-toolbar flotante a la derecha de la seleccion
- Mini-toolbar tiene iconos: agregar comentario, emoji reaction, sugerir edits
- Al clickear "agregar comentario", se abre un input inline para escribir el comentario
- El texto seleccionado queda como "anchor" del comentario (resaltado amarillo al hacer foco)

**Card de comentario (sidebar derecho):**

Estado colapsado:
- Avatar del autor
- Nombre + timestamp ("Victor Calvello, 5:55 PM Today")
- Preview del texto del comentario

Estado expandido (al hacer click):
- Avatar + nombre + timestamp
- Texto completo del comentario
- Input: "Reply or add others with @"
- Boton checkmark (Resolve)
- Menu tres puntos con: Edit, Delete, See emoji reaction details, Get link to this comment
- El texto anchor en el documento se resalta en amarillo

**Ciclo de vida:**
```
Open --> Resolved (via checkmark)
Resolved --> Re-opened (desde el panel de comentarios)
```

### 1.3 Sugerencias (Suggestions)

**Rendering inline:**
- **Additions**: texto en verde con underline
- **Deletions**: texto en verde con strikethrough
- **Substitutions**: deletion (strikethrough) seguida de addition (underline), ambas en verde

**Card de sugerencia (sidebar derecho):**

Estado colapsado:
- Avatar + nombre + timestamp
- Descripcion: "Replace: 'old' with 'new'" / "Add: 'text'" / "Delete: 'text'"

Estado expandido:
- Avatar + nombre + timestamp
- Descripcion completa de la sugerencia
- Boton checkmark (Accept) + boton X (Reject)
- Input: "Reply or add others with @"
- Menu tres puntos (para el autor: Edit, Delete)

**Diferencia clave vs comentarios:**
- Comentarios tienen solo checkmark (Resolve)
- Sugerencias tienen checkmark (Accept) + X (Reject)

### 1.4 Panel de comentarios (Comments Panel)

Se abre desde el icono de burbuja de chat en el header.

**Estructura:**
- Header: "Comments" + icono campana (notificaciones) + X (cerrar)
- Tabs: "All comments" | "For you"
- Filtros: "All types" dropdown (Open / Resolved) | "All tabs" dropdown
- Busqueda (icono lupa)

**Contenido:**
- Lista de todos los comentarios y sugerencias del documento
- Agrupados por seccion/anchor text del documento
- Cada item muestra: avatar, nombre, timestamp, texto/descripcion
- Las sugerencias mantienen botones Accept/Reject inline
- Los comentarios mantienen boton Resolve inline

---

## 2. CriticMarkup como formato de persistencia

### 2.1 Sintaxis base

| Tipo | Sintaxis | Ejemplo |
|------|----------|---------|
| Addition | `{++text++}` | `{++nueva frase++}` |
| Deletion | `{--text--}` | `{--frase eliminada--}` |
| Substitution | `{~~old~>new~~}` | `{~~viejo~>nuevo~~}` |
| Comment | `{>>comment<<}` | `{>>esto necesita revision<<}` |
| Highlight | `{==text==}` | `{==texto destacado==}` |

### 2.2 Extensiones necesarias (metadata)

CriticMarkup base no soporta: author, timestamp, thread replies, ni estado (open/resolved). Se necesitan extensiones.

**Formato de metadata propuesto (compatible con propuesta community issue #50):**

```
{>>{"author":"Victor","time":1707753600,"status":"open","id":"c1"}@@Esto necesita revision<<}
```

Estructura: `{>>` + JSON metadata + `@@` + contenido + `<<}`

**Campos de metadata:**

| Campo | Tipo | Requerido | Descripcion |
|-------|------|-----------|-------------|
| `id` | string | Si | ID unico del comentario/sugerencia (nanoid o uuid corto) |
| `author` | string | Si | Nombre del autor |
| `time` | number | Si | Unix timestamp de creacion |
| `status` | string | No | `"open"` (default) o `"resolved"` |
| `replyTo` | string | No | ID del comentario padre (para threads) |

### 2.3 Mapeo Google Docs -> CriticMarkup

**Comentario simple:**
```markdown
Texto {==anchor del comentario==}{>>{"id":"c1","author":"Victor","time":1707753600}@@Esto necesita revision<<}
```

**Comentario con replies (thread):**
```markdown
Texto {==anchor==}{>>{"id":"c1","author":"Victor","time":1707753600}@@Primer comentario<<}{>>{"id":"c2","author":"Ana","time":1707754000,"replyTo":"c1"}@@De acuerdo, lo reviso<<}
```

**Comentario resuelto:**
```markdown
Texto {==anchor==}{>>{"id":"c1","author":"Victor","time":1707753600,"status":"resolved"}@@Ya no aplica<<}
```

**Sugerencia (addition):**
```markdown
Texto existente {++{"id":"s1","author":"Victor","time":1707753600}@@texto nuevo++}
```

**Sugerencia (deletion):**
```markdown
Texto {--{"id":"s2","author":"Victor","time":1707753600}@@a eliminar--} mas texto
```

**Sugerencia (substitution):**
```markdown
Texto {~~{"id":"s3","author":"Victor","time":1707753600}@@viejo~>nuevo~~} mas texto
```

**Sugerencia con comentario/reply:**
```markdown
{++{"id":"s1","author":"Victor","time":1707753600}@@texto nuevo++}{>>{"id":"c1","author":"Ana","time":1707754000,"replyTo":"s1"}@@Por que este cambio?<<}
```

### 2.4 Reglas de parsing

1. Metadata JSON es opcional. Si no hay `@@`, el contenido completo es el texto/comentario (backwards compatible con CriticMarkup estandar)
2. El parser debe tolerar CriticMarkup sin metadata (archivos legacy)
3. Los IDs se generan automaticamente al crear un comentario/sugerencia
4. El `@@` separator delimita metadata de contenido
5. Replies se encadenan como bloques CriticMarkup adyacentes con `replyTo` apuntando al `id` padre

---

## 3. Arquitectura del plugin

### 3.1 Componentes principales

```
obsidian-critic-plugin/
  src/
    main.ts                    # Plugin entry point
    modes/
      editing-mode.ts          # Modo Editing (bypass, no tracking)
      suggesting-mode.ts       # Modo Suggesting (intercept edits)
      viewing-mode.ts          # Modo Viewing (read-only, clean)
    parser/
      critic-parser.ts         # Parser de CriticMarkup + metadata
      critic-serializer.ts     # Serializar de vuelta a CriticMarkup
    editor/
      inline-decorations.ts    # Decoraciones CM6 para additions/deletions/highlights
      comment-widgets.ts       # Widgets CM6 para iconos de comentarios
      gutter-markers.ts        # Marcadores en el gutter (accept/reject)
      floating-toolbar.ts      # Mini-toolbar al seleccionar texto
    sidebar/
      comments-panel.ts        # Panel lateral de comentarios
      comment-card.ts          # Componente de card individual
      filters.ts               # Filtros (open/resolved, author, search)
    models/
      types.ts                 # Tipos: Comment, Suggestion, Thread, etc.
      store.ts                 # Estado reactivo del documento
    commands/
      accept-reject.ts         # Comandos accept/reject/resolve
      mode-toggle.ts           # Toggle entre modos
    settings/
      settings-tab.ts          # Configuracion del plugin
```

### 3.2 Stack tecnologico

- **Obsidian API** para el plugin lifecycle, settings, commands, sidebar views
- **CodeMirror 6** (CM6) para decoraciones inline, widgets, y state fields en el editor
- **ViewPlugin + Decoration** de CM6 para rendering en Live Preview
- **MarkdownPostProcessor** para rendering en Reading View

---

## 4. Funcionalidades detalladas

### 4.1 Mode Switcher

**UI:** Boton en la status bar de Obsidian (esquina inferior derecha)

```
[Pencil icon] Editing  |  [Pencil+brackets icon] Suggesting  |  [Eye icon] Viewing
```

**Comportamiento:**

| Accion del usuario | Editing | Suggesting | Viewing |
|--------------------|---------|------------|---------|
| Escribir texto | Inserta directamente | Genera `{++texto++}` con metadata | Bloqueado (read-only) |
| Borrar texto | Elimina directamente | Envuelve en `{--texto--}` con metadata | Bloqueado |
| Seleccionar y reemplazar | Reemplaza directamente | Genera `{~~viejo~>nuevo~~}` con metadata | Bloqueado |
| Ctrl+Z (undo) | Undo normal | Deshace la suggestion (elimina el markup) | N/A |
| Pegar texto | Pega directamente | Genera addition del texto pegado | Bloqueado |

**Modo Suggesting - detalles de intercepcion:**
- Se implementa como un CM6 `EditorView.inputHandler` que intercepta todos los inputs
- Antes de aplicar el cambio, envuelve el contenido en CriticMarkup
- El cursor se posiciona despues del markup insertado
- Si el usuario borra dentro de un `{++...++}` existente (su propia suggestion no guardada aun), edita directamente sin crear markup anidado

**Modo Viewing - detalles:**
- El editor se pone en `readOnly` mode
- Las decoraciones de CriticMarkup se ocultan
- Se muestra el texto "final" (como si todas las suggestions estuvieran rechazadas, texto original)
- Los highlights de comentarios se ocultan
- No se muestra el sidebar de comentarios

**Keyboard shortcut para cambiar modo:**
- `Ctrl/Cmd + Shift + E` -> Editing
- `Ctrl/Cmd + Shift + S` -> Suggesting
- `Ctrl/Cmd + Shift + W` -> Viewing

Shortcuts fijos, no configurables en v1. Se registran como Obsidian commands para que aparezcan en la command palette.

### 4.2 Inline Decorations (Live Preview)

**Additions `{++text++}`:**
- Texto renderizado con: color verde (#1e8e3e), underline
- Los delimitadores `{++` y `++}` se ocultan en Live Preview
- En Source mode, se muestran completos

**Deletions `{--text--}`:**
- Texto renderizado con: color verde (#1e8e3e), strikethrough
- Opacidad reducida (0.7) para indicar que sera removido
- Delimitadores ocultos en Live Preview

**Substitutions `{~~old~>new~~}`:**
- "old" renderizado como deletion (verde, strikethrough, opacidad 0.7)
- Separator `~>` oculto
- "new" renderizado como addition (verde, underline)
- Delimitadores ocultos en Live Preview

**Highlights `{==text==}`:**
- Texto con background-color amarillo (#fef7cd) cuando hay comentario anclado
- Amarillo mas intenso (#fde68a) cuando el comentario esta en foco (expandido)

**Comments `{>>...<<}`:**
- El texto del comentario se oculta completamente en Live Preview
- Se muestra un icono pequeno (burbuja de chat) inline o en el gutter
- Al hacer hover sobre el icono, muestra tooltip con preview del comentario
- Al hacer click, expande el card en el sidebar

### 4.3 Floating Toolbar (al seleccionar texto)

**Trigger:** Seleccionar texto en modo Editing o Suggesting.

**UI:** Barra flotante pequena que aparece arriba-derecha de la seleccion.

**Acciones disponibles:**

| Icono | Accion | Shortcut |
|-------|--------|----------|
| Burbuja de chat | Agregar comentario | `Ctrl/Cmd + Alt + M` |

Solo una accion. Igual que Google Docs donde la accion principal al seleccionar texto es comentar. No hay highlight standalone en v1.

**Flujo "Agregar comentario":**
1. Usuario selecciona texto
2. Aparece floating toolbar
3. Click en icono de comentario (o shortcut)
4. El texto seleccionado se envuelve en `{==...==}`
5. Se inserta `{>>...<<}` con metadata inmediatamente despues
6. Se abre el card de comentario en el sidebar con el input de texto en foco
7. El usuario escribe el comentario
8. Al presionar Enter o click fuera, se guarda
9. Si cancela (Escape sin texto), se remueve el markup

### 4.4 Comment Cards (sidebar)

**Layout del sidebar:**

```
+----------------------------------+
| Comments               [x close] |
|----------------------------------|
| [All v]  [Search icon]          |
|----------------------------------|
| Section: "texto anchor..."       |
|   +----------------------------+ |
|   | [avatar] Author    [v][:]  | |
|   | 2:30 PM Today              | |
|   |                            | |
|   | Texto del comentario       | |
|   |                            | |
|   | [Reply or add others...]   | |
|   +----------------------------+ |
|                                  |
| Section: "otro anchor..."       |
|   +----------------------------+ |
|   | [avatar] Author   [v][x]  | |
|   | 2:31 PM Today              | |
|   |                            | |
|   | Replace: "old" with "new"  | |
|   |                            | |
|   | [Reply or add others...]   | |
|   +----------------------------+ |
+----------------------------------+
```

**Card de comentario:**

| Elemento | Comportamiento |
|----------|----------------|
| Avatar + nombre | Muestra autor del comentario |
| Timestamp | Formato relativo ("Today", "Yesterday", "Feb 10") |
| Texto | Contenido del comentario |
| Checkmark [v] | **Comentario**: Resolve. **Sugerencia**: Accept. |
| X | Solo en sugerencias: Reject |
| Menu [:] | Solo en comentarios propios: Edit, Delete, Copy link |
| Reply input | "Reply or add others with @" - al tipear y Enter, crea reply |

**Threads (replies):**
- Los replies se muestran indentados debajo del comentario padre
- Cada reply tiene: avatar, nombre, timestamp, texto
- Los replies tienen su propio menu (Edit, Delete si es propio)
- No se puede resolver un reply individual, solo el thread completo

**Card de sugerencia:**

| Elemento | Comportamiento |
|----------|----------------|
| Avatar + nombre | Autor de la sugerencia |
| Descripcion | "Replace: 'old' with 'new'" / "Add: 'text'" / "Delete: 'text'" |
| Accept [v] | Aplica la sugerencia: remueve el markup, deja el texto resultante |
| Reject [x] | Rechaza: remueve el markup, restaura el texto original |
| Reply input | Permite discutir la sugerencia antes de aceptar/rechazar |

### 4.5 Accept / Reject / Resolve

**Accept suggestion:**
1. Click en checkmark del card de sugerencia
2. Resultado segun tipo:
   - Addition `{++text++}` -> queda solo `text`
   - Deletion `{--text--}` -> se elimina `text` y el markup
   - Substitution `{~~old~>new~~}` -> queda solo `new`
3. Se eliminan los replies asociados (o se mueven a un historial)
4. El card desaparece del sidebar
5. Accion deshacer disponible (Ctrl+Z)

**Reject suggestion:**
1. Click en X del card de sugerencia
2. Resultado segun tipo:
   - Addition `{++text++}` -> se elimina `text` y el markup
   - Deletion `{--text--}` -> queda solo `text`
   - Substitution `{~~old~>new~~}` -> queda solo `old`
3. Se eliminan los replies asociados
4. El card desaparece del sidebar
5. Accion deshacer disponible (Ctrl+Z)

**Resolve comment:**
1. Click en checkmark del card de comentario
2. El campo `status` en la metadata cambia a `"resolved"`
3. El card se mueve a la seccion "Resolved" (filtrable)
4. El highlight del anchor se vuelve gris tenue
5. El comentario se puede re-abrir desde el panel (filtro "Resolved")

**Batch operations (menu del panel):**
- "Accept all suggestions" - acepta todas las sugerencias del documento
- "Reject all suggestions" - rechaza todas
- "Resolve all comments" - resuelve todos los comentarios abiertos

### 4.6 Comments Panel

**Ubicacion:** Leaf panel en el sidebar derecho de Obsidian (como el Backlinks panel).

**Sin tabs en v1.** Google Docs tiene "All comments" y "For you", pero "For you" requiere sistema de menciones multi-author que no aplica a archivos locales. Se muestra una sola lista.

**Filtros (minimos):**

| Filtro | Opciones |
|--------|----------|
| Status | All / Open / Resolved |
| Search | Busqueda de texto libre en el contenido de comentarios |

Solo dos filtros. Sin filtro por tipo (comments vs suggestions) ni por tabs. Si se necesitan, se agregan despues.

**Comportamiento:**
- Se actualiza en real-time al editar el documento
- Click en un card scrollea al anchor correspondiente en el documento
- El anchor se resalta brevemente (flash amarillo) al navegar
- Ordenados por posicion en el documento (de arriba a abajo)
- Muestra un badge con el count de items abiertos

### 4.7 Gutter Markers

En el gutter izquierdo del editor, al lado de las lineas que contienen CriticMarkup:

| Marker | Significado | Click action |
|--------|-------------|--------------|
| Burbuja azul | Linea tiene comentario(s) | Abre el card del comentario en el sidebar |
| Barra verde | Linea tiene sugerencia(s) | Muestra mini-popup con Accept/Reject |
| Burbuja gris | Linea tiene comentario resuelto | Abre el card (estado resuelto) |

### 4.8 Reading View

En Reading View (no Live Preview), el plugin usa `MarkdownPostProcessor`:

- Additions: renderizadas como `<ins>` con estilo verde
- Deletions: renderizadas como `<del>` con estilo verde + strikethrough
- Substitutions: `<del>` + `<ins>`
- Comments: icono de burbuja con tooltip al hover
- Highlights: `<mark>` con estilo amarillo

---

## 5. Configuracion (Settings)

**Principio: configuracion minima e indispensable.** Solo lo que el plugin no puede inferir solo.

| Setting | Default | Descripcion |
|---------|---------|-------------|
| Author name | "" (obligatorio al primer uso) | Nombre que aparece en comentarios y sugerencias. El plugin pide configurarlo antes de crear el primer comentario. |

**Todo lo demas esta hardcodeado (v1):**

| Aspecto | Valor fijo | Justificacion |
|---------|------------|---------------|
| Suggestion color | #1e8e3e (verde Google Docs) | Consistencia con la referencia |
| Highlight color | #fef7cd / #fde68a (amarillo) | Consistencia con la referencia |
| Gutter markers | Siempre visibles | Core del UX, no opcional |
| Floating toolbar | Siempre visible al seleccionar | Core del UX, no opcional |
| Comment panel | Sidebar derecho | Igual que Google Docs |
| Metadata | Siempre generada | Necesaria para threads y resolve |
| Default mode | Editing | Igual que Google Docs |
| Resolved comments | Siempre visibles (filtrables en panel) | Igual que Google Docs |

**Nota:** Si en futuras versiones se necesita flexibilidad (ej: themes oscuros que necesitan otros colores), se agrega. Pero v1 no expone configuracion innecesaria.

---

## 6. Edge cases y decisiones de diseno

### 6.1 CriticMarkup sin metadata

Si el plugin encuentra CriticMarkup sin metadata (ej: `{++texto++}` sin JSON), debe:
- Renderizarlo normalmente (additions verdes, etc.)
- No mostrar author/timestamp en el card (mostrar "Unknown author")
- Permitir accept/reject normalmente
- Al agregar un reply, el reply SI tendra metadata

### 6.2 Nested CriticMarkup

No se soporta nesting. Si el usuario en modo Suggesting intenta editar dentro de un `{++...++}`:
- Si es su propia suggestion no resuelta: editar el contenido directamente (sin anidar)
- Si es suggestion de otro autor: crear una nueva suggestion que envuelve la existente (aplanar al resolver)

### 6.3 Multi-linea

CriticMarkup que cruza multiples lineas:
- El parser debe soportarlo
- Las decoraciones deben aplicarse correctamente en multiples lineas
- El gutter marker se muestra en todas las lineas afectadas

### 6.4 Conflictos con otro markup

Si CriticMarkup esta dentro de bold/italic/otros:
- El plugin parsea CriticMarkup ANTES que Markdown
- El renderizado respeta el estilo del texto subyacente (ej: addition en bold sigue siendo bold + verde)

### 6.5 Performance

- El parser debe ser incremental (no re-parsear todo el documento en cada keystroke)
- Usar CM6 `StateField` + `RangeSet` para decoraciones eficientes
- El sidebar solo renderiza los cards visibles (virtual scrolling si hay muchos)
- Limite sugerido: 500 comments/suggestions por documento antes de warning

### 6.6 Copy/paste

- Copiar texto que contiene CriticMarkup: copiar el texto plano sin markup (el resultado "aceptado")
- Pegar en modo Suggesting: el texto pegado se envuelve en `{++...++}`
- Export a PDF/HTML: renderizar sin markup visible (como modo Viewing)

### 6.7 Undo/Redo

- En modo Suggesting, Ctrl+Z deshace la creacion de la suggestion (elimina el markup)
- Accept/Reject de suggestions son operaciones en el undo stack
- Resolve de comentarios es operacion en el undo stack

---

## 7. Fases de implementacion

### Fase 1: Core (MVP)
- [ ] Parser de CriticMarkup con soporte de metadata
- [ ] Inline decorations en Live Preview (additions, deletions, substitutions, highlights)
- [ ] Modo Editing (pass-through, sin tracking)
- [ ] Modo Suggesting (interceptar edits, generar markup)
- [ ] Mode switcher en status bar
- [ ] Accept/Reject basico desde command palette

### Fase 2: Comments
- [ ] Comentarios con metadata (author, time, id)
- [ ] Floating toolbar al seleccionar texto
- [ ] Comment cards en sidebar panel
- [ ] Resolve/Re-open comentarios
- [ ] Reply threads

### Fase 3: Panel y UX
- [ ] Comments Panel completo con tabs y filtros
- [ ] Gutter markers
- [ ] Navegacion: click en card -> scroll al anchor
- [ ] Batch operations (accept all, reject all, resolve all)
- [ ] Reading View rendering
- [ ] Modo Viewing (read-only, clean)

### Fase 4: Polish
- [ ] Settings tab completo
- [ ] Keyboard shortcuts configurables
- [ ] Performance optimization (incremental parsing, virtual scroll)
- [ ] Backwards compatibility con CriticMarkup sin metadata
- [ ] Export limpio (strip markup)
- [ ] Documentacion

---

## 8. Referencia tecnica

### 8.1 CriticMarkup spec
- GitHub: https://github.com/CriticMarkup/CriticMarkup-toolkit
- MultiMarkdown docs: https://fletcher.github.io/MultiMarkdown-6/syntax/critic.html
- Extensions proposal: https://github.com/CriticMarkup/CriticMarkup-toolkit/issues/50

### 8.2 Plugin existente (referencia)
- Commentator by Fevol: https://github.com/Fevol/obsidian-criticmarkup
- Ultimo release: v0.2.6 (Dec 2024)
- Implementa: suggestion mode, accept/reject, replies, vault-wide sidebar
- No implementa: resolve/reopen, status indicators, per-document panel

### 8.3 Obsidian Plugin API
- API docs: https://docs.obsidian.md/
- CM6 decorations: ViewPlugin, Decoration, WidgetType
- Sidebar views: ItemView
- Settings: PluginSettingTab

### 8.4 Google Docs (observado Feb 2026)
- 3 modos: Editing, Suggesting, Viewing
- Comments: anchored to text, threaded replies, resolve/reopen, emoji reactions
- Suggestions: inline additions (green underline), deletions (green strikethrough), accept/reject
- Comments Panel: tabs (All/For you), filtros (Open/Resolved), search
