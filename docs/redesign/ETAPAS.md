# Redesign: etapas de execução

Checklist para executar o [`PLANO.md`](PLANO.md). O plano diz **o quê e por quê**; este arquivo diz **em que ordem**, **o que bloqueia o quê** e **quando uma etapa está pronta**. Marque as caixas conforme avança.

Regras que valem para toda etapa:

- Uma branch e um PR por etapa. O app abre e funciona ao fim de cada uma.
- Teste primeiro para comportamento novo (TDD, ver `AGENTS.md`).
- Portão de saída: `npm test`, `npx tsc --noEmit -p apps/desktop` e `npm run build` verdes; conferência visual em {claro, escuro} × {EN, PT} a 1200×820 e 800×600.
- Todo texto novo com entrada em `pt.ts` ou `catalog-pt.ts`.

## Visão geral

| # | Etapa | Tamanho | Depende de | Casos de uso | Status |
|---|---|---|---|---|---|
| 0 | Decisões e ADR-0007 | P | — | — | ☑ |
| 1 | Fundação Tailwind + shadcn | M | 0 | — | ☑ |
| 2 | Modelo de dados (ícone, preview, árvore) | P | 1 | — | ☑ |
| 3 | Shell, sidebar em árvore e Ctrl+K | G | 2 | UC-01, 03, 10, 11 | ☑ |
| 4 | Páginas de ferramenta inline | G | 3 | UC-04, 05, 06, 09, 12, 13 | ☑ |
| 5 | Cards novos e preview no hover | G | 2 (4 recomendado) | UC-02 | ☑ |
| 6 | Clipes de preview | G | 0 (motor pronto) | UC-02 | ☑ |
| 7 | Primitivos restantes e limpeza do CSS | M | 4, 5 | UC-07, 08 | ☑ |
| 8 | Testes finais, docs e entrega | M | 1–7 | todos | ◐ falta o que é local ou do Windows |

```
0 ─► 1 ─► 2 ─► 3 ─► 4 ─┬─► 7 ─► 8
               │       │
               └─► 5 ──┘
0 ─► 6 (paralelo; entra no app junto com a 5)
```

Caminho crítico: 0 → 1 → 2 → 3 → 4 → 7 → 8. A etapa 6 é trabalho de conteúdo e pode correr desde o início.

---

## Etapa 0 · Decisões e ADR-0007 (P)

Fechar o que o `PLANO.md` §12 deixou em aberto antes de que vire suposição silenciosa no código.

- [x] Texto dos clipes (§12.1): mantido como está, em inglês dentro do vídeo; o texto do preview fora do vídeo é traduzido.
- [x] URL por hash (§12.2): não; só contexto.
- [x] Favoritos (§12.3): só fixar manual.
- [x] Sidebar em janela estreita (§12.4): recolhe sozinha abaixo de ~1000 px; a escolha manual prevalece e fica guardada.
- [x] Utilitários de vários campos (§12.5): layout repensado na etapa 4, com mockup aprovado antes.
- [x] Escrever `docs/decisions/ADR-0007-ui-stack.md` (local, fora do git): Tailwind v4, shadcn/ui (base Mist), fontes embarcadas, previews em WebM, sem roteador. O plano deixava para a Fase 8; entra antes porque as dependências da etapa 1 precisam de uma decisão registrada.
- [x] Registrar em `docs/LICENSING.md` (local, fora do git) as licenças das fontes (OFL-1.1) e das dependências novas, com versões.

**Pronto quando**: as cinco decisões estão escritas em §12 do plano (ou no ADR) e o ADR-0007 está aceito.

## Etapa 1 · Fundação Tailwind + shadcn (M)

Instalar sem mudar nenhum pixel. Detalhes: `PLANO.md` §8 Fase 1 e §7.5.

- [x] Dependências em `package.json` da raiz, nas versões de `LICENSING.md` "Interface dependencies" (faixa `^` como as demais; o lockfile fixa).
- [x] Avisos de terceiros do frontend: `scripts/notices/frontend-notices.mjs` (`npm run notices:stage`, parte do `build`) grava `FRONTEND-NOTICES.txt` ao lado de `THIRD-PARTY-NOTICES.txt` com os 121 pacotes de produção e o texto da licença de cada um; pacote não permissivo quebra o build. Testes em `tests/notices/`.
- [x] OFL de cada família ao lado das fontes dos mockups (`fonts/*.OFL.txt`).
- [x] Plugin do Tailwind em `apps/desktop/vite.config.ts`; `paths` `@/*` em `apps/desktop/tsconfig.json`.
- [x] `apps/desktop/components.json` (`baseColor: "mist"`, `cssVariables: true`, alias `utils` → `@/lib/cn`).
- [x] `src/lib/cn.ts` com `cn()`.
- [x] Componentes em `src/components/ui/` (24, com `toggle`, `sheet` e `hooks/use-mobile.ts` puxados pela sidebar). O CLI `shadcn add` trava sem `package.json` em `apps/desktop`; os arquivos vieram do registro `new-york-v4` com os imports reescritos. `sonner.tsx` recebe `theme` por prop em vez de usar `next-themes`.
- [x] Arquivo de tokens `src/styles/theme.css`: Mist + ajustes do B2 azul, claro (`:root`) e escuro (`.dark`), fontes via Fontsource.
- [x] `useTheme` marca `data-theme` **e** `.dark` (`useTheme.test.tsx`).
- [x] ~~Unificar o bloco de tema claro duplicado em `app.css`~~: não é duplicação acidental. `:62` vale antes do JS (evita piscar em escuro no Windows claro) e `:97` vale quando a pessoa escolhe claro com o sistema escuro; CSS não junta media query e atributo num bloco. O arquivo sai na etapa 7.
- [x] Sem preflight. Utilitários gerados só a partir de `components/ui` (`source(none)` + `@source`); nenhuma das 523 classes geradas coincide com uma classe legada. O preflight escopado entra na etapa 3, junto do shell novo.
- [x] `tests/interface/theme.test.mjs`: sem preflight, cores só nos blocos de token, claro e escuro com os mesmos tokens. `stylesheet.test.mjs` continua cobrindo o `app.css` até a etapa 7.
- [x] `app.css:1034` usava `var(--font-mono, monospace)`, que passaria a pegar a JetBrains Mono quando o Tailwind emitir `--font-mono`; agora é `monospace` direto.

**Pronto quando**: capturas antes/depois idênticas nas quatro combinações; portão de saída verde.

Resultado (2026-09-30): estilos computados de todos os elementos, sem variáveis CSS, idênticos em catálogo, ferramenta, utilitário, configurações e histórico, claro e escuro, a 1280×860. 39 testes de domínio e 339 de interface verdes; `tsc` e build verdes. CSS de 56,7 kB para 136,9 kB (46 kB de utilitários ainda não usados, 25 kB de `@font-face`); ~400 kB de woff2 no `dist/`, baixados só quando usados.

## Etapa 2 · Modelo de dados (P)

Sem mudança visual. Detalhes: §7.2 e §8 Fase 2.

- [x] Testes primeiro em `catalog.test.ts`: cada ferramenta com ícone próprio (39 distintos); cada grupo com ícone e matiz distinto; ids de sub-ferramenta únicos dentro da ferramenta; todo `preview` aponta para clipe e poster existentes em `public/`, clipe < 200 KB. A contagem de 9 grupos e 39 ferramentas já existia.
- [x] `icon` (componente `LucideIcon`) e `preview?` em `CatalogTool` e `UtilityGroup`; ícones dos 39 cards conforme `data.mjs` dos mockups.
- [x] `icon` e `hue` em cada grupo, em `rowDefinitions` (matizes de §4.2).
- [x] ~~`buildNavigationTree(rows)`~~: `createCatalogRows()` já é a árvore (§7.2).
- [x] ~~Traduções de `caption` e `uses`~~: campos cortados; o hover usa descrição e operações, já traduzidas (§7.2).
- [x] Os 4 clipes prontos entraram em `apps/desktop/public/previews/` (`qr` renomeado para `qr-barcode`, o id do grupo), para o teste de preview ter dados reais.

Resultado (2026-09-30): 343 testes de interface e 44 de domínio verdes; `tsc` verde; comparação de estilos idêntica nas 10 combinações.

**Pronto quando**: testes novos verdes e o teste de 39 cards / máx. 6 por categoria continua passando.

## Etapa 3 · Shell, sidebar em árvore e Ctrl+K (G)

As ferramentas **ainda abrem no painel modal antigo**; só a navegação muda. Detalhes: §7.1, §7.3, §8 Fase 3.

Herdado da etapa 1 (resolvido):

- [x] `@source "../navigation"` em `theme.css`; o shell novo usa classes do Tailwind só dentro de `src/navigation/`, para não escanear o `App.tsx` cheio de classes legadas.
- [x] Preflight escopado: `@scope ([data-slot]) to ([data-legacy])` em `theme.css`. Toda peça do shadcn tem `data-slot` (os diálogos em portal inclusive); o conteúdo legado fica sob `data-legacy`, onde o reset para. As regras de elemento do `app.css` (`button`, `input`, foco de 2 px) foram para `@scope ([data-legacy])`, senão venceriam os utilitários e dariam anel de foco duplo nos botões novos. Testes nos dois arquivos.
- [x] Sem piscada de tema: script inline no `index.html` aplica `.dark` antes do React (a CSP do Tauri é `null`). Mesma chave e regra do `useTheme`.

Fatias:

1. [x] Contexto de navegação em `src/navigation/navigation.tsx` (`location`, `go`, `dirty`, `pending`), com testes da guarda.
2. [x] `JobView` (Fila e Histórico) e `SettingsView` foram para `src/views/`. `App.tsx` de 966 para ~410 linhas. O catálogo continua no `App.tsx` até a etapa 5, que o reescreve.
3. [x] `AppShell` + `AppSidebar` (`variant="inset"`, `collapsible="icon"`): marca, busca, fixados, árvore, rodapé com selo de jobs. Cabeçalho com botão da sidebar e breadcrumb. O seletor de tema saiu do topo (fica nas Configurações, como no mockup).
4. [x] `NavTree`: papéis `tree`/`treeitem` com `aria-level`, `aria-expanded` e `aria-current`; ↑↓ Home End, → abre ou entra, ← fecha ou sobe, Enter/Espaço vão; um grupo aberto por vez, guardado em `tools4devs.nav-open-group`; operações só da ferramenta atual, cinco e "N more…". Com a sidebar recolhida, as setas pulam o que está oculto e o Tab cai no grupo.
5. [x] Fixados em `tools4devs.pinned`, com estrela ao passar o mouse (e no Tab).
6. [x] `CommandPalette`: `searchCatalog()` substitui `filterCatalogRows()`; palavras em qualquer ordem, sem acento, casando o inglês e o texto traduzido. Ações primeiro (as que têm o termo no nome antes), ferramentas depois. Montada com `Dialog` + `Command`, porque o `CommandDialog` do shadcn deixa o título fora do conteúdo.
7. [x] Abaixo de 1000 px a sidebar recolhe sozinha (tooltip nos ícones). A escolha manual fica em `tools4devs.sidebar-choice`; quem tinha "collapsed" na chave antiga continua recolhido. A grade de 2 colunas é dos cards novos (etapa 5).
8. [x] `App.test.tsx`: 4 testes reescritos (busca, Ctrl+K, tema só nas Configurações) e 6 novos (UC-01, UC-03, UC-09, UC-10, "N more…", fixar).
9. [ ] ~~`scripts/screenshots.mjs`~~: os seletores que ele usa (`#section-data`, `Get yt-dlp`) ainda existem. Passa para a etapa 5, que troca seções e cards.

Os painéis ganharam `initialSubId` (abrem na operação ou utilitário escolhido); a troca por props controladas continua na etapa 4. A guarda usa o `confirm-card` antigo, ainda em inglês; a tradução e o `AlertDialog` são da etapa 4. CSS morto do shell antigo no `app.css` (`.app-shell`, `.sidebar`, `.topbar`, `.search-control`, `.nav-item`) fica para a etapa 7.

Resultado (2026-09-30): 46 testes de domínio e 357 de interface verdes; `tsc` e build verdes; conferido no navegador em claro e escuro, 1440×900 e 800×600 (sem rolagem horizontal). Observação: o redimensionamento emulado do painel de preview não dispara `resize` nem `change` de `matchMedia`; numa janela real a sidebar recolhe ao estreitar.

**Pronto quando**: UC-01, UC-03, UC-10 e UC-11 passam; o modal antigo abre a ferramenta certa a partir da árvore e da busca.

## Etapa 4 · Páginas de ferramenta inline (G)

Detalhes: §8 Fase 4.

1. [x] A ferramenta abre na área principal. Em vez de um `ToolPage` novo, o próprio `PanelShell` (e o contêiner do `ToolPanel`) virou página: uma `section` nomeada pelo título, que recebe o foco ao abrir, sem botão de fechar, scrim ou animação de saída. O miolo dos painéis não mudou; `.tool-panel--page` no fim do `app.css` desfaz o posicionamento de modal até a etapa 7. A rolagem volta ao topo a cada página.
2. [x] `UtilityPanel` e `ToolPanel` recebem `subId` e avisam a troca por `onSubChange`: o que se escolhe no painel aparece na árvore e no caminho, e o que se escolhe na árvore muda o painel sem remontá-lo. Trocar de sub-ferramenta na mesma ferramenta não pergunta nada, porque o arquivo e o texto ficam.
3. [x] `DiscardDialog` com `AlertDialog`, traduzido; foco em "Keep editing", Esc responde o mesmo.
4. [x] `InstallDialog` com `Dialog`, `Button` e `Progress`, como no mockup `install`. Não fecha com download em andamento. Terminada a instalação, oferece "Open {name}". O "X" do shadcn (com "Close" fixo em inglês) ficou desligado; o botão "Close" do rodapé basta.
5. [x] Painéis especiais só trocaram de contêiner (UC-12).
6. [x] `suggestToolsFor()` em `formats.ts` (ferramentas que aceitam qualquer arquivo ficam de fora). Sugestões na tela inicial e no grupo "For {arquivo}" da busca; a ferramenta abre com o arquivo já escolhido (UC-13).
7. [x] Jobs continuam ao sair da página (UC-06): os testes nativos saem pela sidebar em vez do antigo "Close tool".
8. [ ] Utilitários de vários campos (§12.5):
   - [x] Levantamento: 49 dos 88 utilitários, em três formas. **Calculadora** (números → resposta e fatos): math-finance 9, everyday 7, dates-time 4, e test-card, color-mixer. **Gerador com prévia** (campos → prévia e código): css-tools 12. **Texto com opções** (texto + campos → resultado): text-tools 5, codes-hashes 4, qr-barcode 3, random-picks 3.
   - [x] Mockups claro/escuro das três formas: `screens/png/b3-*-calc.png` (Financing), `b3-*-css.png` (Box shadow) e `b3-*-textopts.png` (Find and replace). Nas três, a fileira de abas do painel sai: os outros utilitários do grupo estão na árvore.
   - [x] **Aprovação dos mockups antes de implementar** (2026-10-01).
   - [x] Implementado só na apresentação, escolhendo a forma pelos dados: com `preview` é gerador (opções com sliders à esquerda, prévia com Box/Text/Button/Card e card do CSS); sem entrada de texto e sem imagem é calculadora ("Your numbers" à esquerda, a primeira resposta em destaque à direita, as outras em lista); o resto é texto com opções. Escolhas sim/não viram chaves em todas. A contagem "2 replaced" do mockup ficou de fora: pediria mudar a lógica do utilitário.
9. [x] Testes atualizados: painéis procurados como `region`, não `dialog`; 5 novos (foco na página, operação refletida na árvore, troca sem perder texto, diálogo em português, sugestões de arquivo).

Não verificado: a operação real de ponta a ponta no `tauri:dev` (exige compilar o host Rust). Os testes nativos cobrem o fluxo com o host simulado.

**Pronto quando**: UC-04, 05, 06, 09, 12 e 13 passam; uma operação real (qpdf ou conversão curta) roda de ponta a ponta no `tauri:dev`.

## Etapa 5 · Cards novos e preview no hover (G)

Detalhes: §4.2, §7.4, §8 Fase 5.

- [x] Testes primeiro (`src/home/ToolCard.test.tsx`, 10): nomes `Open {name}` / `Get {name}`, motor, ações e tamanho no card, erro com "Try again", progresso com `aria-valuenow`; preview abre após a pausa e fecha ao sair, abre no foco, toca o clipe mudo com `preload="none"`, mostra só o poster com movimento reduzido, cai no ícone sem clipe.
- [x] `ToolCard` novo em `src/home/`: o card inteiro é o botão (a ação do card antigo vira o nome dele), quadrado tingido pelo grupo (`bg-group-tile`, tokens `--group-tile-l/c` em `theme.css`), título em serifa, motor em mono, selos de ações e de download.
- [x] `ToolPreview` sobre a grade, a partir do card, sem mover nada; 300 ms de pausa; só um aberto por vez (o estado fica na `CatalogView`), logo um vídeo por vez. O preview repete o botão do card, por isso é `aria-hidden` e o botão dele fica fora do Tab. Sem `IntersectionObserver`: o vídeo só existe enquanto o preview está aberto, debaixo do ponteiro ou do foco.
- [x] `CatalogView` nova (tela inicial do mockup): título, "Choose a file", área do arquivo (arrastando, escolhido, sugestões, erro) e seções por grupo. A página tem `data-slot` e entra no reset escopado; as páginas antigas (painéis, Fila/Histórico, Configurações) passaram a se marcar `data-legacy` uma a uma.
- [x] Removidos `ToolArtwork.tsx`, `CategoryFilter.tsx`, `ToolSection.tsx` e o `ToolCard` antigo, com a grade de pontinhos, a barra de destaque, a elevação e o `card-arrive` que eram deles. O CSS deles no `app.css` vira lixo para a etapa 7.
- [x] `scripts/screenshots.mjs` não precisou mudar: `#section-data` e `Get yt-dlp` continuam. `skills/app-demo-media/record.mjs` foi ajustado (card, hover e "fechar painel" agora voltam pela marca da sidebar).
- [x] `components/ui/progress.tsx` passa o `value` ao Radix: a cópia do registro só desenhava a barra, sem anunciar a porcentagem (afetava também o diálogo de instalação).

Ficou de fora do mockup: o escurecimento dos outros cards enquanto um preview está aberto.

Resultado (2026-10-01): 46 testes de domínio e 372 de interface verdes; `tsc` e build verdes; tela inicial e preview do FFmpeg conferidos no navegador. O JS do app passou de 604 kB (antes da etapa 1) para 755 kB, por Radix, cmdk e sonner.

**Pronto quando**: UC-02 passa; a grade não treme ao abrir/fechar o preview; cards sem clipe mostram poster ou ícone.

## Etapa 6 · Clipes de preview (G, paralela)

Detalhes: §8 Fase 6. Motor em `previews/clip.html`.

- [x] ~~`scripts/previews.mjs`~~: o `previews/render.mjs` já renderiza e codifica (6 s, 30 fps, 960×540, VP9 `-crf 36`, poster do quadro de 1,6 s). Ganhou `OUT` (aponte para `apps/desktop/public/previews`) e passou a abrir o `clip.html` por `pathToFileURL`, o que faz funcionar no Windows. Usado com o Chrome local (`CHROMIUM`), o `ffmpeg` do WinGet (`FFMPEG`) e `playwright-core` instalado com `--no-save`.
- [x] Teste: cada `preview.src` existe e pesa < 200 KB (etapa 2); clipes e posters somam < 4 MB (`catalog.test.ts`).
- [x] Copiar os 4 prontos (`ffmpeg`, `qpdf`, `jq`, `qr` → `qr-barcode`) para `apps/desktop/public/previews/` (feito na etapa 2).
- [x] Lote 1 (2026-10-01): yt-dlp (Paste · Download · Extract), Tesseract (Scan · Read · Search), ImageMagick (Convert · Grey · Inspect), Work on text (Case · Sort · Count), Minify and format (Minify · Format · Indent). 61 a 96 KB cada; 9 ferramentas com clipe somam 1,2 MB. Conferidos em folhas de quadros antes de entrar.
- [x] Lote 2 (2026-10-01), em quatro grupos conferidos em folhas de quadros: vídeo, download e imagem (8); documentos e dados (7); utilitários e calculadoras (9); arquivos e mockups (6). Cada clipe tem 3 cenas e 3 legendas que mostram operações reais da ferramenta.
- [x] Posters a 640×360 (q 5): só aparecem com movimento reduzido ou antes do vídeo carregar, numa prévia de ~320 px. Caíram de ~25 KB para ~12 KB e abriram espaço para os 39 caberem no orçamento.
- [x] Teste novo: todo card tem `preview`.

**Pronto quando**: cada card tem clipe ou poster; nenhum clipe passa de 200 KB; loop sem salto.

Resultado (2026-10-01): 39 de 39 com clipe; o maior tem 115 KB; clipes e posters somam 3,76 MB (teto 4 MB). O loop não salta porque toda cena termina na faixa de transição, como nos quatro originais.

## Etapa 7 · Primitivos restantes e limpeza (M)

Detalhes: §8 Fase 7. Feita em sete fatias, um commit cada.

- [x] 7a. Fila, Histórico e Configurações como nos mockups: ícone da ferramenta por job, selos de estado, barra de progresso; Configurações em uma coluna com `Select`, `Switch` e o grupo de rádio do tema. "Clear the history" pede confirmação, no Histórico e nas Configurações (UC-07). Tema e idioma mudam sem reiniciar (UC-08).
- [x] 7b. `UpdateCard` redesenhado com os tokens novos. O `sonner` saiu: não havia toast nenhum, e ele deixou o bundle e os avisos.
- [x] 7c. Página da ferramenta externa: título e motor em cima, arquivo ou URL, card de Opções e card de Resumo com progresso e Executar/Parar. `Select.tsx` e `NumberField.tsx` continuam nossos (papéis acessíveis e testes) com os tokens novos; `ThemeSwitch` ficou como `radiogroup` em vez de `ToggleGroup`, que não anuncia uma escolha única como rádio.
- [x] 7d. Busca por imagem e Reconhecer música no mesmo `ToolPage` (cabeçalho, foco ao chegar). Quatro frases que só existiam em inglês entraram no dicionário.
- [x] 7e. Página do utilitário como no mockup `utility`: nome do utilitário como título, sem a fileira de abas, Opções em cima, Entrada e Resultado lado a lado. Era a única página sem testes de interface; `UtilityPanel.test.tsx` traz 8. As amostras dos geradores de CSS foram para `styles/utility-previews.css`; a amostra "caixa" ganhou tamanho próprio (antes sombra e raio não desenhavam nada).
- [x] 7f. Mockups de chat e post: formulário com os primitivos novos (quem enviou como alternância de duas posições). O telefone e o post imitam cada app e continuam no `app.css`. `MockupPanels.test.tsx` traz 7 testes, onde não havia nenhum.
- [x] 7g. `app.css` de 1.412 linhas para 176: só o quadro da janela e as imitações de chat e post. A prévia de arquivo usa utilitários; o retângulo de recorte foi para `styles/crop-overlay.css`. O preflight do Tailwind entra inteiro e o `@scope` com `data-legacy` sai; `@source` por pastas. `useTheme` deixou de gravar `data-theme`.

Fica para a etapa 4.8: as três formas de vários campos (calculadora, gerador com prévia, texto com opções). Até a aprovação, esses utilitários usam a página genérica da 7e.

Resultado (2026-10-01): 42 testes de domínio e 392 de interface verdes; `tsc` e `vite build` verdes (o `npm run build` completo baixa binários do Windows por PowerShell e não roda num contêiner Linux). Conferido no navegador em claro e escuro, 1440×900 e 800×600, sem rolagem horizontal; recorte conferido com o host simulado. CSS de 136,9 kB para 110,1 kB.

**Pronto quando**: nenhum componente usa classes antigas; `stylesheet.test.mjs` verde.

## Etapa 8 · Testes finais, docs e entrega (M)

- [x] `docs/screenshots/*` (EN e `pt/`) regenerados com `scripts/screenshots.mjs`. As capturas mostraram a busca da sidebar quebrando em duas linhas em português; corrigido.
- [x] Acessibilidade. Contraste medido no navegador, texto a texto contra o fundo pintado, em 13 telas (início, preview, paleta, instalação, descarte, ferramenta, utilitário, música, busca por imagem, chat, Fila, Histórico, Configurações) nos dois temas: só o aviso de envio para fora ficava abaixo (4,33:1) e foi corrigido. Teclado: Tab por 7 páginas, ~75 paradas cada; as caixas de texto dos utilitários não tinham anel de foco e passaram a ter. A leitura da árvore está coberta pelos testes de `NavTree`.
- [x] Orçamento: clipes e posters 3,76 MB (teto 4 MB); `dist/` 5,3 MB; JS 808 kB (era 604 kB antes da etapa 1), CSS 111 kB.
- [x] `README.md` (busca, árvore, preview no hover; stack) e `CHANGELOG.md` (seção Unreleased).
- [ ] ADR-0007 revisado com o que mudou na execução: o arquivo é local (`docs/decisions/` fica fora do git). Pontos a registrar: `sonner` saiu; preflight inteiro no lugar do escopado; `Select`, `NumberField` e `ThemeSwitch` continuaram próprios.
- [x] Checklist de `PLANO.md` §10 marcado, com o que falta dito em cada item.
- [x] Status no topo do `PLANO.md`. `docs/PROGRESS.md` é local e fica para atualizar fora do git.

Falta, e não dá para fazer daqui: `npm run build` completo e uma operação real no `tauri:dev`, ambos no Windows; a aprovação dos mockups da etapa 4.8.
