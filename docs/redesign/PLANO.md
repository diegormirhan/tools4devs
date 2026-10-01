# Redesign do tools4devs: plano de implementação, casos de uso e design

Documento de referência para a reestruturação do app. Junto com as imagens e os vídeos desta pasta, ele descreve o que muda, por quê, como fazer em fases e como saber que ficou pronto.

- Status: **implementado (etapas 0 a 8)**, com duas pendências: as três formas de utilitário de vários campos aguardam aprovação dos mockups (etapa 4.8), e a operação real de ponta a ponta no `tauri:dev` não foi conferida. Detalhes em [`ETAPAS.md`](ETAPAS.md).
- Direção visual aprovada: **B2 em azul** (base Mist do shadcn, sidebar `inset`, títulos em serifa).
- Mockups: [`screens/png/`](screens/png/) (12 telas em claro e escuro). Clipes de hover: [`previews/out/`](previews/out/).
- Como regenerar os mockups e os vídeos: [`README.md`](README.md).
- Ordem de execução e checklist: [`ETAPAS.md`](ETAPAS.md).

---

## 1. Contexto e problema

O tools4devs reúne, numa janela do Windows, 25 ferramentas de código aberto (FFmpeg, yt-dlp, qpdf, ImageMagick, Tesseract e outras) e cerca de 90 utilitários embutidos (texto, hashes, datas, calculadoras, cores, CSS, QR codes, dados de teste, mockups de chat e post). Tudo roda localmente, em inglês ou português do Brasil.

Hoje a pessoa tem dificuldade para achar o que precisa. Pelo código atual:

| Sintoma | Causa no código |
|---|---|
| A barra lateral só troca de tela (Ferramentas, Fila, Histórico, Configurações); não mostra nenhuma ferramenta. | `App.tsx` ~:212-260: 4 itens fixos, estado em `activeNavigation`. |
| Toda a descoberta acontece numa grade de 39 cards com filtros de categoria. | `CategoryFilter.tsx`, `ToolSection.tsx`, `ToolCard.tsx`. |
| As sub-ferramentas (88 utilitários e ~62 operações de ferramentas externas) só aparecem depois de abrir o painel. | `UtilityPanel.tsx` (~:120, abas) e `ToolPanel.tsx` (`Select` sobre `tool.operations`). |
| Cada ferramenta abre num painel modal por cima do catálogo, com o estado de sub-ferramenta preso dentro dele. | `PanelShell.tsx`, `selectedTool` em `App.tsx`. Nada é endereçável. |
| Os cards se parecem entre si e o visual tem cara genérica de "gerado por IA": gradiente ciano, grade de pontinhos, barra de destaque, elevação no hover, entrada escalonada. | `ToolArtwork.tsx` (27 glifos; os 12 grupos de utilitários caem num glifo genérico) e `app.css`. |
| Não há nenhuma pista do que cada ferramenta faz sem abri-la. | O card mostra título, uma linha de descrição e um selo. |

### Números do catálogo atual

- 39 cards em 9 grupos: Vídeo e áudio (4), Downloads (2), Imagens (5), PDFs e documentos (4), Texto e dados (6), Ferramentas rápidas (6), Calculadoras (6), Arquivos e disco (4), Mockups (2).
- 24 cards são binários externos, 12 são grupos de utilitários embutidos e 3 são painéis especiais (busca reversa de imagem, mockup de chat, mockup de post).
- 88 utilitários em 12 grupos (`src/utilities/registry.ts`, cerca de 1700 linhas); cerca de 62 operações nas ferramentas externas (FFmpeg tem 14).
- Hierarquia real: **grupo → ferramenta (card) → utilitário ou operação**, isto é, três níveis.

## 2. Objetivos e não objetivos

### Objetivos

1. **Navegação em árvore na barra lateral** (grupo → ferramenta → sub-ferramenta), como no DevToys, para que tudo fique visível e alcançável em poucos cliques ou teclas.
2. **Cards que se diferenciam**: ícone próprio por ferramenta, cor por grupo e um **preview em vídeo curto no hover**, no estilo dos trailers do Netflix.
3. **shadcn/ui** (Tailwind + Radix) como base de componentes, seguindo os tokens e as medidas oficiais.
4. **Visual com personalidade própria** e menos genérico. Sem gradientes decorativos, sem grade de pontinhos e sem cards que se movem no hover.
5. **Tema claro e escuro** de primeira classe, com contraste verificado.
6. Manter o que já funciona: fila que continua rodando, histórico persistente, atualização assinada, inglês e português.

### Não objetivos (nesta rodada)

- Trocar o motor de execução das ferramentas, o instalador de componentes ou o sistema de atualização.
- Adicionar um roteador com URLs (ver §12.2).
- Novas ferramentas ou novos utilitários.
- Suporte a macOS ou Linux (o app continua só para Windows).
- Clipes de hover para as sub-ferramentas (a infraestrutura os prevê, mas só os 39 cards entram).

## 3. Decisões tomadas

| Tema | Decisão | Alternativas descartadas |
|---|---|---|
| Direção visual | B2 azul, base **Mist**, sidebar `inset`, títulos em Fraunces | Fluent puro (A), denso estilo IDE (C), B com acento laranja (lembra o Claude Desktop) |
| Estrutura da sidebar | Agrupada por resultado, igual às 9 categorias de hoje | Por tipo (externa vs embutida), reagrupar do zero |
| Tela da ferramenta | Página inline na área principal | Manter o painel modal |
| Migração para shadcn | Incremental, o app roda ao fim de cada fase | Reescrita completa do front |
| Preview do hover | Vídeo curto em **motion graphics** (WebM), só nos 39 cards | Gravação de tela, GIF, ilustração vetorial em CSS |
| Fundo e serifa | Fundo frio (Mist) e serifa mantida | Fundo creme (parece o Claude), títulos sem serifa |

## 4. Design do produto

### 4.1 Princípios

- **Descoberta antes de tudo**: qualquer ferramenta deve estar a no máximo dois cliques da tela inicial e a uma busca (Ctrl+K).
- **Mostrar o que a ferramenta faz**: título, motor, descrição, ações disponíveis e um clipe curto.
- **Tudo local, dito com clareza**: o selo "In-app download", o tamanho e a frase "Nothing leaves your computer" aparecem onde importam.
- **Calmo**: superfícies sólidas, bordas finas, um único acento, movimento só quando comunica algo (progresso, transição de clipe).

### 4.2 Sistema visual

Baseado nos tokens oficiais do shadcn (variáveis CSS `oklch`, pares `background`/`foreground`, `--radius: 0.625rem`).

- **Base**: Mist (cinza-azulado). Cópia em [`shadcn/mist.json`](shadcn/mist.json).
- **Acento (`--primary`)**: claro `oklch(0.52 0.19 258)`, escuro `oklch(0.74 0.13 258)`. A marca continua sendo o azul periwinkle do logo (`#88afff`) e o âmbar do "T".
- **Tema claro**: painel principal branco sobre sidebar levemente azulada (`--sidebar: oklch(0.962 0.008 245)`).
- **Tema escuro**: fundo azul-petróleo escuro (`--background: oklch(0.17 0.012 255)`, `--sidebar: oklch(0.14 0.012 255)`).
- **Tipografia**: Inter (texto e interface), **Fraunces** (títulos de página, de seção e de card), **JetBrains Mono** (rótulos do motor como `FFMPEG` e valores técnicos). Todas embarcadas, sem depender de fonte do sistema (hoje o app usa `Segoe UI Variable`, que só existe no Windows).
- **Raios** (do shadcn): `sm` 6 px, `md` 8 px, `lg` 10 px, `xl` 14 px. Cards usam `xl`, controles `md`.
- **Cor por grupo**: cada grupo tem um matiz próprio, sempre frio ou neutro, para diferenciar ícones e cards sem tons de terra.

| Grupo | Matiz (oklch) |
|---|---|
| Vídeo e áudio | 255 (azul) |
| Downloads | 165 (verde-água) |
| Imagens | 78 (âmbar) |
| PDFs e documentos | 285 (índigo) |
| Texto e dados | 322 (violeta) |
| Ferramentas rápidas | 215 (ciano) |
| Calculadoras | 12 (rosa) |
| Arquivos e disco | 195 (verde-azulado) |
| Mockups | 135 (verde) |

  O quadrado do ícone usa `oklch(0.93 0.045 H)` com ícone `oklch(0.45 0.12 H)` no claro, e `oklch(0.32 0.06 H)` com ícone `oklch(0.82 0.11 H)` no escuro.

- **Movimento**: transições curtas de cor e de opacidade. Nada de elevação nem escala no hover do card. O único movimento "rico" está nos clipes de preview. Respeita `prefers-reduced-motion`.

### 4.3 Estrutura da janela

```
┌────────────┬───────────────────────────────────────────────┐
│ Sidebar    │  Cabeçalho: [☰] │ Caminho (breadcrumb)        │
│  256 px    ├───────────────────────────────────────────────┤
│            │                                               │
│ Marca      │   Título da página (serifa) + descrição       │
│ Busca      │                                               │
│ Fixados    │   Conteúdo (grade de cards, página da         │
│ Árvore     │   ferramenta, fila, configurações…)           │
│ ───────    │                                               │
│ Fila       │                                               │
│ Histórico  │                                               │
│ Config.    │                                               │
└────────────┴───────────────────────────────────────────────┘
```

- Sidebar do shadcn com `variant="inset"`: largura 16 rem (256 px), 3 rem (48 px) quando recolhida em ícones (`collapsible="icon"`).
- Janela mínima do Tauri: 800×600. Nessa largura a sidebar vira a faixa de ícones e o conteúdo usa 2 colunas de cards.

### 4.4 Componentes shadcn e onde entram

| Componente shadcn | Uso no app | Substitui hoje |
|---|---|---|
| `Sidebar`, `SidebarMenu*`, `SidebarMenuSub*`, `SidebarMenuBadge`, `Collapsible` | Árvore, fixados, rodapé com Fila / Histórico / Configurações | `<aside className="sidebar">`, `nav-item` |
| `Command` (`CommandDialog`) | Busca Ctrl+K | campo de busca do topo + `filterCatalogRows` na tela |
| `Card` (header, content, footer, action) | Cards do catálogo, painéis de opções, resumo, linhas da fila | `.tool-card`, `.settings-card`, `.job-row` |
| `HoverCard` ou popover próprio | Preview com vídeo no hover | overlay `.tool-card__inside` |
| `Badge` | "In-app download", "14 actions", status de job | `.pill`, `.tool-card__badge` |
| `Button` | Todas as ações | `.button--primary/light/quiet/small`, `.icon-button` |
| `Input`, `Textarea`, `Select`, `Slider`, `Switch`, `ToggleGroup`, `Label` | Formulários dos painéis e das configurações | `Select.tsx` (combobox próprio), `NumberField.tsx`, `ThemeSwitch.tsx` |
| `Dialog`, `AlertDialog` | Instalação de componente, "descartar trabalho?" | `InstallDialog.tsx`, `confirm-card` em `App.tsx` |
| `Progress` | Downloads e jobs em andamento | `.progress-track` |
| `Tooltip` | Nomes dos grupos na sidebar recolhida | não existe |
| `Sonner` (toast) | Confirmações curtas ("Path copied") e avisos de atualização | `UpdateCard.tsx` (parcialmente) |
| `Separator`, `Breadcrumb`, `ScrollArea`, `Skeleton` | Cabeçalho, listas longas, estados de carregamento | — |

## 5. Casos de uso

Cada caso lista o objetivo, o caminho na interface nova e o critério de aceite. Os IDs são usados nos testes.

### UC-01 · Achar a ferramenta certa sem saber o nome

- **Quem**: pessoa que quer "tirar o áudio de um vídeo" mas não conhece o FFmpeg.
- **Fluxo**: abre o app → Ctrl+K → digita "extrair au…" → vê "Extract audio · Convert media · FFmpeg" primeiro, depois ações parecidas em outros grupos → Enter.
- **Resultado**: abre a página da ferramenta já na sub-ferramenta certa; a árvore na sidebar expande e marca o item.
- **Aceite**: a busca é insensível a acento e maiúsculas (reaproveita `filterCatalogRows`); casa título, descrição, palavras-chave e nome do motor; mostra ações e ferramentas em grupos separados; funciona só com teclado; mostra também sub-ferramentas (hoje a busca só vê cards).
- **Mockup**: `b3-*-palette.png`.

### UC-02 · Explorar pelo catálogo

- **Quem**: pessoa que quer ver o que o app faz.
- **Fluxo**: tela inicial mostra os grupos como seções com cards. Passar o mouse sobre um card (ou focá-lo com Tab) abre o preview com o clipe, o motor, o tamanho do download e "What you can do".
- **Aceite**: o preview abre depois de ~300 ms, fecha ao sair; abre também no foco por teclado; só um vídeo toca por vez; com `prefers-reduced-motion` mostra o poster e a lista de ações, sem tocar.
- **Mockup**: `b3-*-home.png`, `b3-*-hover.png`.

### UC-03 · Navegar pela árvore

- **Quem**: pessoa que já sabe onde fica o que quer.
- **Fluxo**: clica em "Video and audio" → vê as 4 ferramentas → clica em "Convert media" → vê as 14 operações → clica em "Extract audio".
- **Aceite**: abrir um grupo recolhe os outros por padrão (acordeão) para a árvore caber; o grupo da ferramenta atual abre sozinho ao entrar por busca; setas ↑↓ percorrem, →/← expandem e recolhem, Enter abre; o estado aberto persiste entre sessões.
- **Mockup**: `b3-*-tool.png`, `b3-*-utility.png`.

### UC-04 · Converter um arquivo (primeiro uso, com instalação)

- **Quem**: pessoa que nunca instalou o FFmpeg.
- **Fluxo**: escolhe "Convert media" → página mostra o selo "In-app download · 84 MB" e o botão "Get it" → diálogo lista o plano (FFmpeg + dependências, tamanhos) com as garantias "SHA-256 checked" e "no administrator rights" → instala com barra de progresso → a página da ferramenta libera as opções → escolhe o arquivo, o formato e a qualidade → "Extract audio".
- **Aceite**: o diálogo mostra o total em MB antes de começar; nada é baixado sem confirmação; erro de download mostra a mensagem e "Try again"; ao terminar, a página atualiza sem recarregar.
- **Mockup**: `b3-*-install.png`, `b3-*-tool.png`.

### UC-05 · Usar um utilitário embutido

- **Quem**: pessoa que quer mudar a caixa de um texto.
- **Fluxo**: sidebar → "Quick tools" → "Work on text" → "Change case" → cola o texto → resultado aparece enquanto digita → "Copy".
- **Aceite**: sem botão de executar; o resultado atualiza ao digitar; erro de entrada mostra mensagem no lugar do resultado; "Clear" limpa; funciona sem nada instalado.
- **Mockup**: `b3-*-utility.png`.

### UC-06 · Acompanhar e parar operações

- **Quem**: pessoa com várias operações em andamento.
- **Fluxo**: começa uma operação, navega para outra ferramenta ou fecha a página; a operação continua. Abre "Queue" no rodapé (com o número de jobs no selo) → vê progresso, aguarda ou clica em "Stop".
- **Aceite**: trocar de ferramenta não interrompe jobs; "Stop" encerra a árvore de processos inteira (comportamento atual); o limite de operações simultâneas das Configurações é respeitado; jobs na espera mostram "Waiting".
- **Mockup**: `b3-*-queue.png`.

### UC-07 · Rever resultados

- **Quem**: pessoa que quer achar o arquivo que gerou ontem.
- **Fluxo**: "History" → lista com "Done / Failed / Stopped" → "Show in folder" ou "Copy path".
- **Aceite**: o histórico sobrevive a reinícios; falhas mostram a causa em vermelho; "Clear the history" pede confirmação; estado vazio explica o que aparece ali e leva de volta às ferramentas.
- **Mockup**: `b3-*-history.png`.

### UC-08 · Ajustar preferências

- **Fluxo**: "Settings" → idioma, tema (System / Light / Dark), sidebar, pasta padrão, quantas operações ao mesmo tempo, o que fazer se o arquivo já existe, verificação de versão.
- **Aceite**: idioma e tema mudam na hora e persistem; o tema segue o Windows quando em "System"; nenhuma configuração exige reiniciar.
- **Mockup**: `b3-*-settings.png`.

### UC-09 · Não perder trabalho ao trocar de ferramenta

- **Fluxo**: com um arquivo e opções já escolhidos, clica em outra ferramenta na árvore → aparece "Discard this work?" → "Keep editing" volta; "Discard" troca de ferramenta.
- **Aceite**: só aparece se houver trabalho não salvo (mesma regra do `panelDirty` de hoje); Esc equivale a "Keep editing"; o foco vai para o botão seguro; o texto é traduzido (hoje está fixo em inglês).
- **Mockup**: `b3-*-discard.png`.

### UC-10 · Usar só o teclado

- **Aceite**: Ctrl+K abre a busca; Tab entra na sidebar; setas percorrem a árvore; Enter abre; Esc fecha diálogos e popovers; o anel de foco é visível nos dois temas; leitores de tela anunciam o item atual, o estado (expandido/recolhido) e o nível.

### UC-11 · Janela pequena

- **Aceite**: a 800×600 a sidebar vira a faixa de ícones com tooltip; a grade usa 2 colunas; nada rola na horizontal; a busca Ctrl+K continua disponível.
- **Mockup**: `b3-*-narrow.png`.

### UC-12 · Mockups de chat e post

- **Fluxo**: "Mockups" → "Chat mockup" → escolhe o app (WhatsApp, iMessage…), o contato e as mensagens → vê o celular ao lado → "Save image".
- **Aceite**: o editor e a prévia continuam lado a lado; trocar mensagem atualiza a prévia na hora; a imagem salva idêntica à prévia.
- **Mockup**: `b3-*-chat.png`.

### UC-13 · Soltar um arquivo na janela

- **Fluxo**: arrasta um arquivo para a janela → o app sugere as ferramentas que aceitam aquele formato (comportamento atual via `useFileDrop` e `formats.ts`).
- **Aceite**: a sugestão aparece como lista curta na tela inicial e na busca; o arquivo já vem selecionado ao abrir a ferramenta.

## 6. Telas (mockups)

Todas em `screens/png/` no formato `b3-<claro|escuro>-<tela>.png`.

| Tela | Arquivo | Notas de projeto |
|---|---|---|
| Início | `home` | Título "What do you want to do?", botão "Choose a file", seções por grupo com cards |
| Hover com preview | `hover` | Card expande sobre a grade com o vídeo 16:9, botão "Get it" ou "Open", lista de ações |
| Página da ferramenta | `tool` | Caminho no topo, arquivo escolhido, cartão "Options", cartão "Summary" com os botões |
| Fila | `queue` | Jobs em andamento e na espera; barra de progresso; "Stop" |
| Histórico | `history` | Jobs concluídos, falhos e parados; "Show in folder" e "Copy path"; "Clear the history" |
| Configurações | `settings` | Lista de uma coluna (duas colunas quebravam os textos) |
| Busca | `palette` | `CommandDialog` com grupos "Actions" e "Tools" e rodapé de atalhos |
| Instalação | `install` | Plano com etapas numeradas, progresso e garantias |
| Utilitário | `utility` | Entrada e resultado lado a lado; "It runs here, as you type." |
| Mockup de chat | `chat` | Editor de conversa + celular |
| Janela mínima | `narrow` | Faixa de ícones + 2 colunas |
| Descartar trabalho | `discard` | `AlertDialog` sobre a página da ferramenta |
| Calculadora | `calc` | Campos à esquerda, resposta grande e fatos à direita (Financing). Forma de 22 utilitários |
| Gerador CSS | `css` | Controles, prévia com superfícies e o CSS com Copy (Box shadow). Os 12 geradores CSS |
| Texto com opções | `textopts` | Opções em cima, entrada e resultado lado a lado (Find and replace). 15 utilitários |

O que os mockups mostraram e já entra no plano:

- Configurações em **uma coluna**.
- A árvore precisa **rolar** quando um grupo tem muitos itens; abrir só o grupo atual (acordeão) e lembrar o estado.
- Na janela mínima, os grupos precisam de **tooltip** com o nome.
- A Fila mostra o número de jobs ativos no selo do rodapé.

## 7. Arquitetura da interface

### 7.1 Estado de navegação

Hoje `activeNavigation` e `selectedTool` são `useState` em `App.tsx`, e a sub-ferramenta vive dentro de cada painel. O plano leva isso para um contexto:

```ts
type View = "catalog" | "tool" | "queue" | "history" | "settings";

interface Navigation {
  view: View;
  toolId?: string;   // id do card (ex.: "ffmpeg", "text-tools")
  subId?: string;    // operação ou utilitário (ex.: "extract-audio", "change-case")
}

interface NavigationApi extends Navigation {
  go(next: Navigation, opts?: { force?: boolean }): void; // respeita a guarda de trabalho não salvo
  dirty: boolean;
  setDirty(value: boolean): void;
}
```

- `go()` consulta `dirty`; se houver trabalho, abre o `AlertDialog` do UC-09 e só navega se a pessoa confirmar.
- `UtilityPanel` recebe `utilityId` controlado e `ToolPanel` recebe `selectedOperationId` controlado (hoje o estado é local a cada painel).
- Sem roteador e sem `location.hash` (§12.2).

### 7.2 Modelo de dados

Arquivos: `src/catalog/catalog.ts`, `src/utilities/registry.ts`, `src/i18n/catalog-pt.ts`.

Implementado na Etapa 2:

```ts
// catalog.ts
type CatalogTool = {
  // …campos atuais…
  icon: LucideIcon;                // componente do lucide-react, não o nome
  preview?: ToolPreview;           // { src: "/previews/ffmpeg.webm", poster: "/previews/ffmpeg.jpg" }
};

type CatalogRow = {
  // …campos atuais…
  icon: LucideIcon;                // grupo na sidebar recolhida
  hue: number;                     // matiz OKLCH do grupo (§4.2)
};

// registry.ts: cada UtilityGroup também ganha `icon` e `preview?`
```

- `icon` guarda o componente, não o nome: um mapa de nome para componente puxaria o pacote inteiro de ícones para o bundle.
- `preview` não tem `caption` nem `uses`. O hover mostra a `description` e as operações da ferramenta ("What you can do"), que já existem e já são traduzidas. Sem texto novo, `translations.test.mjs` continua como está.
- Não existe `buildNavigationTree()`: `createCatalogRows()` já devolve grupo → ferramenta → `operations`, usando a **linha** (`rowDefinitions`) como grupo e não a string `category` (que não bate: `ffmpeg` diz `downloads` mas fica em Vídeo e áudio). O endereço de uma sub-ferramenta é `{toolId, subId}`, e um teste garante que os ids de sub-ferramenta são únicos dentro de cada ferramenta.
- `hue` e o ícone do grupo ficam em `rowDefinitions`, ao lado do resto da definição do grupo.

### 7.3 Componentes novos

| Componente | Responsabilidade |
|---|---|
| `AppShell` | Provedor da sidebar, contexto de navegação, atalhos globais |
| `AppSidebar` | Marca, busca, fixados, árvore, rodapé |
| `NavTree` | Renderiza `Group[]` com acordeão, roving tabindex, `aria-expanded` |
| `CommandPalette` | `CommandDialog` sobre ferramentas e sub-ferramentas |
| `ToolPage` | Cabeçalho, caminho e corpo; escolhe `ToolPanel`, `UtilityPanel` ou painel especial |
| `CatalogView` | Título, seções por grupo, grade de `ToolCard` |
| `ToolCard` | Card novo; expõe o gatilho do preview |
| `ToolPreview` | Vídeo do hover (ver §7.4) |
| `QueueView`, `HistoryView` | Extraídos de `JobView` |
| `SettingsView` | Extraído de `App.tsx`, em lista de uma coluna |
| `DiscardDialog` | `AlertDialog` da guarda de trabalho não salvo |

Os painéis `ToolPanel` (989 linhas), `UtilityPanel` (395), `MusicPanel`, `ChatMockupPanel`, `PostMockupPanel` e `ImageSearchPanel` mudam de **contêiner** (saem do `PanelShell` modal), mas a lógica interna fica.

### 7.4 Preview de hover

- Gatilho: `pointerenter` com atraso de ~300 ms ou `focus` por teclado; fecha no `pointerleave`/`blur`.
- Conteúdo: `<video muted loop playsinline preload="none" poster=…>`, o título, o motor, o selo de download, a descrição, as primeiras operações como badges ("What you can do", com "+N" para o restante) e o botão principal.
- Regras:
  - Um único vídeo toca por vez.
  - `IntersectionObserver` pausa o vídeo fora da tela.
  - Sem `autoplay` até o preview abrir; `preload="none"` para não custar largura de banda de disco no início.
  - `prefers-reduced-motion`: mostra o poster, nunca toca.
  - Card sem clipe: poster estático (ou só o ícone) e a lista de ações.
- Posição: sobrepõe a grade a partir do card, sem provocar reflow (posicionamento absoluto), como em `hover.png`.

### 7.5 Tema

- `tailwind.baseColor: "mist"`, `cssVariables: true`.
- Os tokens atuais (`--ground`, `--surface*`, `--action`…) são mapeados para os do shadcn (`--background`, `--card`, `--primary`…) e depois removidos.
- `src/hooks/useTheme.ts` passa a marcar `data-theme` **e** a classe `.dark` no `<html>` (o shadcn usa `@custom-variant dark (&:is(.dark *))`).
- O bloco de tema claro está duplicado em `app.css` (`:62` e `:97`); unificar.
- Preferências continuam em `tools4devs.theme-preference` (`system | light | dark`).

### 7.6 Internacionalização

O app usa um dicionário próprio: a **chave é a frase em inglês**, e `pt.ts` (868 entradas) e `catalog-pt.ts` (181) traduzem.

- Todo texto novo (busca, selos, "Nothing leaves your computer", "Discard this work?", "Keep editing") precisa de entrada em português. O texto gravado dentro dos vídeos fica em inglês (§12.1).
- O teste `translations.test.mjs` varre `t("…")` e campos `title|description|label|hint|downloadLabel`; ele deve continuar verde.
- O `AlertDialog` hoje está sem tradução; corrigir na Fase 4.

## 8. Plano de implementação por fases

Cada fase termina com o app funcionando, `npm test` e `npm run build` verdes, e um ou mais commits na branch. Os comandos partem da raiz do repositório (não há `package.json` em `apps/desktop`).

Tamanho: **P** ≈ meio dia, **M** ≈ 1 a 2 dias, **G** ≈ 3 a 5 dias.

### Fase 1 · Fundação Tailwind e shadcn (M)

**Objetivo**: instalar as ferramentas sem mudar o visual.

- Dependências: `tailwindcss`, `@tailwindcss/vite`, `class-variance-authority`, `clsx`, `tailwind-merge`, `tw-animate-css`, `radix-ui` (ou os pacotes `@radix-ui/*` que os componentes pedirem), `cmdk`, `sonner`, `@fontsource-variable/inter`, `@fontsource-variable/fraunces`, `@fontsource/jetbrains-mono`.
- `apps/desktop/vite.config.ts`: adicionar o plugin do Tailwind (o alias `@` → `./src` já existe).
- `apps/desktop/tsconfig.json`: adicionar `paths: { "@/*": ["./src/*"] }` (hoje só o Vite conhece o alias).
- Criar `apps/desktop/components.json` (`baseColor: "mist"`, `cssVariables: true`, aliases apontando para `src/`).
- `src/lib/utils.ts` com `cn()`.
- Gerar em `src/components/ui/`: `button`, `input`, `textarea`, `label`, `badge`, `card`, `select`, `slider`, `switch`, `toggle-group`, `tooltip`, `hover-card`, `collapsible`, `sidebar`, `command`, `dialog`, `alert-dialog`, `progress`, `separator`, `breadcrumb`, `scroll-area`, `skeleton`, `sonner`.
- Tema (§7.5): variáveis do Mist + ajustes de `--primary`, `--sidebar*` e do fundo; `useTheme` marca também `.dark`.
- Convivência com o CSS legado: importar `tailwindcss/theme` e `tailwindcss/utilities`, e aplicar o preflight escopado ao shell novo (ou validar visualmente tela por tela). O Tailwind não deve alterar as telas que ainda usam `app.css`.
- Reescrever `tests/interface/stylesheet.test.mjs`, que lê `app.css` por caminho e proíbe hex fora dos blocos de tokens; deve passar a olhar o novo arquivo de tokens e continuar proibindo cores soltas.
- **Aceite**: o app abre idêntico ao de hoje; `npm test` e `npm run build` verdes; `npx tsc --noEmit` sem erros com o alias novo.

### Fase 2 · Modelo de dados (P)

- Adicionar `icon` e `preview?` a `ToolPresentation` e `UtilityGroup`; preencher os 39 ícones (tabela no mockup: `clapperboard`, `scan-search`, `music`, `layers`, `download`, `images`…).
- Matiz e ícone por grupo (sem `buildNavigationTree()`, ver §7.2).
- Testes em `catalog.test.ts`: todo card tem `icon`; todo `preview.src` e `poster` existem em `public/previews/`; a árvore tem 9 grupos, 39 ferramentas e todas as sub-ferramentas; a soma bate com o número de operações e utilitários.
- **Aceite**: nenhuma mudança visual; testes novos verdes; o teste que exige 39 cards e no máximo 6 por categoria continua passando.

### Fase 3 · Shell e sidebar em árvore (G)

- Quebrar `App.tsx` (966 linhas): `AppShell`, `AppSidebar`, `CatalogView`, `QueueView`, `HistoryView`, `SettingsView`.
- Criar o contexto de navegação (§7.1).
- Sidebar: `SidebarProvider` com `variant="inset"` e `collapsible="icon"`; marca, campo de busca que abre a paleta, "Pinned" (favoritos), árvore, rodapé fixo.
- `CommandPalette` com ferramentas e sub-ferramentas; Ctrl+K continua sendo o atalho; reaproveitar `filterCatalogRows` (sem acento).
- Persistir em `localStorage` com prefixo `tools4devs.*`: grupo aberto, favoritos e estado recolhido. Ver ADR-0006 e `migratePreferences` (roda antes de montar o app) para não quebrar quem atualiza.
- Manter landmarks e nomes acessíveis que os testes consultam (`complementary`, `searchbox`, imagem "tools4devs").
- **Aceite**: UC-01, UC-03, UC-10 e UC-11 funcionando com o painel modal antigo ainda abrindo as ferramentas; `App.test.tsx` atualizado.

### Fase 4 · Páginas de ferramenta inline (G)

- Substituir `PanelShell` (modal, scrim, animação de saída, retorno de foco via `toolTriggerRef`) por `ToolPage` na área principal.
- `UtilityPanel` e `ToolPanel` passam a receber a sub-ferramenta por props.
- `DiscardDialog` com `AlertDialog` (UC-09), traduzido; a guarda usa `dirty` do contexto.
- `InstallDialog` → shadcn `Dialog` (UC-04), com o mesmo conteúdo.
- Painéis especiais (`MusicPanel`, `ChatMockupPanel`, `PostMockupPanel`, `ImageSearchPanel`) só mudam de contêiner.
- Atualizar `App.test.tsx`, `App.native.test.tsx`, `ToolPanel.native.test.tsx`, `RecognitionPanels.native.test.tsx`.
- **Aceite**: UC-04, UC-05, UC-09, UC-12 funcionando; fluxo completo de uma operação real (qpdf ou uma conversão curta) passando de ponta a ponta; foco e Esc corretos.

### Fase 5 · Cards novos e preview no hover (G)

- `ToolCard` novo (§4.4 e mockup): ícone tingido por grupo, título em serifa, motor em mono, selo de ações, selo de download, rodapé. Preservar os estados de erro e de progresso e os nomes acessíveis dos botões (`Open {name}`, `Get {name}`), que os testes usam.
- Remover a grade de pontinhos, a barra de destaque, a elevação no hover e a animação `card-arrive`.
- `ToolPreview` (§7.4).
- Decidir o destino de `ToolArtwork.tsx` (27 glifos, 295 linhas): sai junto com os cards antigos; se algum glifo servir de poster de reserva, extrair.
- **Aceite**: UC-02; preview abre e fecha sem tremer a grade; testes de `ToolCard` atualizados.

### Fase 6 · Clipes de preview (G, pode correr em paralelo à Fase 5)

- Os 4 clipes prontos (`previews/out/`) entram em `apps/desktop/public/previews/`.
- Gerar os outros 35 com o motor de `previews/clip.html`: uma entrada por ferramenta com matiz, três legendas e uma cena para cada. Cada cena é um bloco de código curto que usa `put()`, `seg()` e as curvas `E.*`.
- Padrão de cada clipe: 6 s, 30 fps, 960×540, VP9 (`-crf 36`), sem áudio, ~100 KB; poster JPG do quadro de 1,6 s.
- Orçamento total: ~4 MB (39 × ~100 KB).
- Automatizar: `scripts/previews.mjs` chama o renderizador e o `ffmpeg`, e um teste confere que cada `preview.src` existe e pesa menos de 200 KB.
- Ordem sugerida: primeiro os mais usados (FFmpeg, yt-dlp, qpdf, Tesseract, jq, ImageMagick, os utilitários de texto e de código), depois o restante.
- **Aceite**: cada card tem clipe ou poster; nenhum clipe passa de 200 KB; o loop não tem salto visível.

### Fase 7 · Demais primitivos e limpeza (M)

- `Select.tsx` → shadcn `Select`; `NumberField.tsx` → `Input`; `ThemeSwitch.tsx` → `ToggleGroup`; `UpdateCard.tsx` → `Sonner`/`Alert`; botões `.button--*` → `Button`.
- Apagar do `app.css` as regras que sobrarem; meta: de 1399 linhas para o mínimo dos mockups de chat e post (que têm hex próprios permitidos: `.mockup-phone`, `.mockup-post`).
- **Aceite**: nenhum componente usa mais as classes antigas; `stylesheet.test.mjs` verde.

### Fase 8 · Testes, documentação e entrega (M)

- Adaptar `scripts/screenshots.mjs` (seletores `#section-data` e `[aria-label="Get yt-dlp"]` quebram) e regenerar `docs/screenshots/*` (inglês e `pt/`).
- Atualizar `README.md` e `CHANGELOG.md`; revisar `docs/decisions/ADR-0007-ui-stack.md` (escrito na Etapa 0) com o que mudou na execução.
- Revisar contraste nos dois temas (há `docs/brand/CONTRAST.md` como referência).
- **Aceite**: checklist de §10 completo.

## 9. Estratégia de testes

| Camada | O que cobrir | Onde |
|---|---|---|
| Unidade (Vitest) | ícones, matiz por grupo, ids de sub-ferramenta, previews, busca, contexto de navegação, guarda de `dirty` | `src/catalog/*.test.ts`, `src/navigation/*.test.tsx` |
| Componentes (Testing Library) | `NavTree` (teclado e ARIA), `CommandPalette`, `ToolCard` (estados), `ToolPreview` (reduced motion, um vídeo por vez), `DiscardDialog` | ao lado de cada componente |
| Integração (App) | UC-01, UC-03, UC-04 (com Tauri mockado), UC-06, UC-09 | `App.test.tsx`, `App.native.test.tsx` |
| Node (`tests/**/*.test.mjs`) | Tradução de todos os textos novos, tokens de cor, existência e tamanho dos clipes | `tests/interface/` |
| Visual (manual guiado) | Capturas em 1440×900 e 800×600, claro e escuro, EN e PT, comparadas com `screens/png/` | `scripts/screenshots.mjs` |
| Acessibilidade | Tab, setas, Esc, anel de foco, `aria-expanded`, leitura da árvore; contraste ≥ 4,5:1 no texto | manual + checagem de contraste |

Matriz mínima por fase: {claro, escuro} × {inglês, português}. Janela 1200×820 e 800×600.

## 10. Critérios de conclusão

- [ ] Todos os UC-01 a UC-13 atendem ao aceite. Cobertos por testes com o host simulado; falta rodar uma operação real no `tauri:dev` (UC-04) e as três formas de vários campos de UC-05 (etapa 4.8).
- [x] A árvore da sidebar mostra as 39 ferramentas e todas as sub-ferramentas; a busca as encontra.
- [x] Cada card tem ícone, cor de grupo e preview (clipe ou poster).
- [x] Nenhum modal para abrir ferramentas; a guarda de trabalho não salvo funciona ao trocar pela árvore.
- [x] Claro e escuro corretos; sem cores soltas fora dos tokens (exceto os mockups de chat e post). Contraste do texto ≥ 4,5:1 (3:1 no texto grande) medido em 13 telas nos dois temas.
- [x] Textos novos traduzidos; `translations.test.mjs` verde.
- [ ] `npm test`, `npx tsc --noEmit` e `npm run build` verdes. Os dois primeiros e o `vite build` estão verdes; o `npm run build` completo baixa binários do Windows por PowerShell e precisa rodar no Windows.
- [x] Tamanho do `dist/` e dos clipes dentro do orçamento (clipes ≤ 4 MB no total): clipes e posters 3,76 MB; `dist/` 5,3 MB; JS 808 kB (246 kB gzip), CSS 111 kB.
- [ ] README, CHANGELOG, screenshots e ADR-0007 atualizados. Os três primeiros sim; o ADR-0007 é local, fora do git.

## 11. Riscos e mitigação

| Risco | Impacto | Mitigação |
|---|---|---|
| O preflight do Tailwind altera o CSS legado | Telas antigas quebram durante a migração | Escopar o reset ao shell novo; revisão visual por fase; migrar tela a tela |
| Sidebar cheia (9 grupos, ~150 itens) | Árvore difícil de usar | Acordeão, rolagem, favoritos, busca, lembrar o estado; começar só com o grupo atual aberto |
| Vídeos ficam repetitivos ou pesados | O efeito do hover perde valor; instalador cresce | Motor único com identidade consistente; limite de 200 KB por clipe; poster de reserva |
| Ferramentas sem cena viável | Cards sem clipe | Poster estático + lista de ações (já previsto) |
| Muitos testes de UI dependem do modal e da sidebar antiga | Retrabalho grande | Atualizar por fase; preservar landmarks e nomes acessíveis |
| O visual ficar "mais um app shadcn" | Perda de identidade | Manter o azul da marca, a serifa, o ícone por grupo e os clipes; revisar contra os mockups a cada fase |
| Mudança de estado global (contexto de navegação) | Bugs de foco e de guarda de trabalho | Testes de integração dedicados (UC-09, UC-10); migrar sem roteador |
| Persistência antiga de preferências | Perder configuração ao atualizar | Reaproveitar `migratePreferences`; novas chaves com prefixo `tools4devs.*` |
| Documentação do shadcn indisponível na rede do ambiente | Detalhes de CLI podem ter mudado | Conferir o CLI (`npx shadcn@latest init`) na hora; os tokens e componentes usados aqui vêm do repositório oficial |

## 12. Decisões da Etapa 0

Fechadas em 2026-09-30.

1. **Texto dos clipes**: os clipes são motion design e ficam como estão, com o texto gravado em inglês ("Convert.", "Compress.", o rótulo do motor, nomes de arquivo). Não há versão por idioma nem legenda sobreposta em HTML. O texto em volta do vídeo (descrição e operações) já é traduzido. Os 35 clipes novos seguem o mesmo padrão.
2. **URL por hash**: não. A navegação vive só no contexto React (§7.1). Os testes navegam pelo contexto.
3. **Favoritos**: só "fixar" manual. Sem seção de recentes.
4. **Sidebar em janela estreita**: recolhe sozinha para a faixa de ícones abaixo de ~1000 px de largura. Se a pessoa abrir ou recolher manualmente, a escolha dela prevalece e fica guardada.
5. **Utilitários de vários campos** (CSS, cores, calculadoras): o layout é repensado dentro do redesign. Antes de implementar, esses painéis ganham mockups no mesmo sistema visual (`screens/`), que precisam ser aprovados. A lógica de cálculo não muda; muda a apresentação.

## 13. Mapa de arquivos

| Área | Arquivos atuais | Mudança |
|---|---|---|
| Shell | `src/App.tsx` (966 linhas), `src/main.tsx` | Dividir em `AppShell`, `AppSidebar` e views |
| Catálogo | `src/catalog/catalog.ts`, `sizes.ts`, `formats.ts` | Novos campos `icon`, `preview`, `hue` |
| Utilitários | `src/utilities/registry.ts` | `icon` e `preview` por grupo |
| Cards e seções | `ToolCard.tsx`, `ToolSection.tsx`, `CategoryFilter.tsx`, `ToolArtwork.tsx` | Novo `ToolCard`; filtros de categoria saem (a sidebar assume); artwork sai |
| Painéis | `PanelShell.tsx`, `ToolPanel.tsx`, `UtilityPanel.tsx`, painéis especiais | Sai o modal; sub-ferramenta controlada |
| Primitivos | `Select.tsx`, `NumberField.tsx`, `ThemeSwitch.tsx`, `UpdateCard.tsx`, `InstallDialog.tsx` | Trocados por shadcn |
| Estilo | `src/styles/app.css` (1399 linhas) | Reduzido a quase nada |
| i18n | `src/i18n/pt.ts`, `catalog-pt.ts` | Entradas novas |
| Assets | `apps/desktop/public/` | `previews/` novo; fontes embarcadas |
| Testes | `App.test.tsx`, `ToolCard.test.tsx`, `catalog.test.ts`, `tests/interface/*` | Atualizados; novos testes de árvore e preview |
| Ferramentas | `scripts/screenshots.mjs`, `skills/app-demo-media/` | Seletores atualizados; motor de clipes novo em `scripts/previews.mjs` |
| Docs | `README.md`, `CHANGELOG.md`, `docs/decisions/` | ADR-0007 |

## 14. Glossário

- **Árvore**: a lista hierárquica da sidebar (grupo → ferramenta → sub-ferramenta).
- **Grupo** (ou linha): uma das 9 categorias do catálogo (Vídeo e áudio, Downloads…).
- **Ferramenta** (ou card): uma entrada do catálogo, como "Convert media".
- **Sub-ferramenta**: uma operação de uma ferramenta externa ("Extract audio") ou um utilitário embutido ("Change case").
- **Motor**: o programa por baixo de uma ferramenta (FFmpeg, qpdf…), mostrado em mono no card.
- **Preview**: o clipe curto que aparece no hover.
- **Inset**: variante da sidebar do shadcn em que o conteúdo é um painel arredondado sobre a sidebar.
- **Mist**: cor base do shadcn, um cinza-azulado.
