# Redesign do tools4devs: mockups e vídeos definitivos

Material de referência para a reestruturação do app (sidebar em árvore, cards com preview no hover, shadcn/ui). Nada aqui é importado pelo app: são imagens, vídeos e os scripts que os geram.
As rodadas de exploração (outras direções e variações) ficam em [`../mockups/`](../mockups/).

## Direção escolhida

**B2 em azul**, base **Mist** do shadcn (cinza-azulado), tema claro e escuro.

- Sidebar `inset` do shadcn: o conteúdo é um painel arredondado sobre a sidebar.
- Árvore de navegação: 9 grupos → ferramentas → sub-ferramentas, com favoritos no topo e Fila / Histórico / Configurações no rodapé.
- Cards com ícone lucide num quadrado tingido por grupo, rótulo do motor (`FFMPEG`) e selo de download.
- Títulos em serifa (Fraunces), texto em Inter, rótulos técnicos em JetBrains Mono.
- Acento azul (`--primary`); o resto vem dos tokens oficiais do shadcn.
- Sem gradiente, sem grade de pontinhos e sem cards que sobem no hover.

## O que tem aqui

| Pasta | Conteúdo |
|---|---|
| `screens/png/` | 24 telas em 1440×900 (12 telas × claro e escuro), `b3-<tema>-<tela>.png` |
| `screens/html/` | as mesmas telas em HTML estático |
| `previews/out/` | 4 clipes de hover em WebM (VP9, 960×540, 6 s, loop) e os posters `.jpg` |
| `previews/sheets/` | linha do tempo de cada clipe (1 quadro a cada 0,4 s) |
| `previews/demo.html` | toca os 4 clipes lado a lado |
| `previews/clip.html`, `previews/render.mjs` | motor de motion graphics e o renderizador quadro a quadro |
| `build-shadcn.mjs`, `data.mjs`, `render.mjs` | geram as telas |
| `fonts/`, `shadcn/` | fontes usadas e tokens copiados do registro oficial do shadcn (Mist, Zinc, Stone) |

Telas: `home`, `hover` (com o clipe do FFmpeg), `tool`, `queue`, `history`, `settings`, `palette` (Ctrl+K), `install`, `utility`, `chat`, `narrow` (janela mínima 800×600, sidebar só com ícones) e `discard` ("Descartar este trabalho?").

Clipes: `ffmpeg` (Converter · Comprimir · Cortar), `qpdf` (Juntar · Dividir · Girar), `jq` (Formatar · Consultar · Validar) e `qr` (Codificar · Estilo · Salvar). Cada um tem 3 cenas com transição em faixa, legenda em serifa e um matiz próprio.

## Como regenerar

Precisa de Node, `playwright-core`, um Chromium, os ícones do pacote npm `lucide-static` e, para os vídeos, um `ffmpeg` com `libvpx-vp9`.

```bash
# telas (HTML + PNG)
LUCIDE=<caminho>/lucide-static/icons node build-shadcn.mjs
node render.mjs screens

# clipes (mesmas variáveis; FRAMES é uma pasta temporária)
cd previews
LUCIDE=<caminho>/lucide-static/icons FFMPEG=<caminho>/ffmpeg FRAMES=/tmp/frames node render.mjs
```

`render.mjs` usa `/opt/pw-browsers/chromium` por padrão; aponte outro com `CHROMIUM=<caminho>`.

## Fontes dos tokens e do estilo

Tokens e classes dos componentes seguem o repositório oficial `shadcn-ui/ui` (`apps/v4/public/r/colors/*.json`, `apps/v4/registry/new-york-v4/ui/*.tsx` e o guia de tema). O `--primary` azul e os tons da sidebar e do fundo são ajustes nossos por cima do Mist.

## Limitações

- São mockups estáticos: o hover de cada card, a rolagem da sidebar e os estados de erro são só ilustrados.
- Só 4 dos 39 cards têm clipe. Os demais precisam de uma cena cada (o motor já está pronto).
- Os textos estão em inglês (idioma-base do app); o português entra na implementação.
