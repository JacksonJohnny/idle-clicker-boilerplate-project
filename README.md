# Mobile Idle Clicker Boilerplate

Boilerplate mobile-first para jogos clicker/idle com **Phaser 4**, **Vite**, **Decimal.js** e **Capacitor 8**.

Resolução base: `540×960`. App id Capacitor: `com.clickergame.app`.

Guia curto de fork/rebrand: [`BOILERPLATE.md`](BOILERPLATE.md).

## Stack

| Camada | Tecnologia |
| --- | --- |
| Runtime do jogo | Phaser `^4.2.1` |
| Bundler | Vite `^8.1.4` |
| Números grandes | decimal.js `^10.6.0` |
| Mobile | Capacitor `^8.4.2` (Android / iOS) |
| Testes | Vitest `^4.1.10` |

## Recursos

- Economia Decimal.js com custos exponenciais e formatação estilo Cookie Clicker.
- Clique manual + 20 geradores idle encadeados + Auto Tap (cursores em órbita).
- Aba **UPGRADE**: meta-upgrades genéricos (efficiency ×2, global, tap-%-of-idle, BASE MULTIPLIER 1…20); lista disponível ordenada por **preço crescente**.
- Aba **STORE**: compra **×1 / ×10 / ×25 / MAX** (sem hold-to-buy); ordem de **liberação**; catálogo progressivo com `???`; geradores idle mostram **% da produção**.
- Idle por **relógio de parede** + ganhos offline (cap opcional; padrão **sem teto**).
- Achievements com bônus permanente de idle % (bloqueados: `○ ???`).
- Prestige → **Ascension Tokens** (quadrado roxo) com confirm **vermelho** e countdown **5s**.
- Abas: UPGRADE → STORE → TAP → STATUS → PRESTIGE (+ settings); labels **completos** na nav (≥44px; overflow `…` só se passar de 5 abas).
- Save versionado (`SAVE_VERSION = 10`) com migrações e checksum.
- Build web / Android / iOS; testes Vitest (economia, prestige, achievements, save).

## Glossário de naming (importante para forks)

| Conceito | Código / UI | Persistência |
| --- | --- | --- |
| Meta-upgrades (aba UPGRADE) | Catálogo `META_UPGRADES`, UI `meta*` (`metaCamera`, `metaScroll`, `metaUpgradesView`) | Campo legado **`boosts`** — não renomear sem migração |
| Ascension Tokens | `ascensionTokens`, badge roxo | `ascensionTokens` (ex-`stars` na v8) |
| ★ amarelas na STORE | Efficiency pips | Derivadas de efficiency compradas em `boosts` |

**Regra:** renomeie UI/cena à vontade; o campo de save `boosts` fica estável para não quebrar progresso antigo.

## Requisitos

- Node.js 20+
- Android Studio (Android)
- macOS + Xcode (iOS)

## Desenvolvimento

```bash
npm install
npm run dev
```

Validação:

```bash
npm test
npm run build
npm run test:coverage
```

| Script | Função |
| --- | --- |
| `npm run dev` | Servidor Vite |
| `npm run build` / `preview` | Build e preview |
| `npm test` / `test:watch` / `test:coverage` | Vitest |
| `npm run lint` / `format` / `format:check` | ESLint / Prettier |
| `npm run android` / `ios` | Build + sync + abrir IDE |
| `npm run cap:doctor` | Diagnóstico Capacitor |

## Estrutura

```text
src/
  config/          Resolução, loops, tema, textos, buy amounts, SAVE_*
  controllers/     ListScrollController
  data/            Geradores, upgrades, metaUpgrades, achievements
  lib/             Fórmulas (clickerMath), sessão (clickerController), prestige, Auto Tap, save shape
  scenes/          ClickerScene (orquestra)
    clicker/       Page builders, listas, overlays, nav, cameras, wall-clock
  services/        Save, migrações, settings, feedback, storage
  ui/              Builders Phaser (sem regras de compra)
```

Arquivos-chave:

| Área | Arquivo |
| --- | --- |
| Economia (fórmulas) | [`src/lib/clickerMath.js`](src/lib/clickerMath.js) |
| Sessão / buy / save hydrate | [`src/lib/clickerController.js`](src/lib/clickerController.js) |
| Prestige | [`src/lib/prestige.js`](src/lib/prestige.js) |
| Auto Tap | [`src/lib/autoTapProgress.js`](src/lib/autoTapProgress.js) |
| Save shape | [`src/lib/saveState.js`](src/lib/saveState.js) |
| Cena | [`src/scenes/ClickerScene.js`](src/scenes/ClickerScene.js) + [`src/scenes/clicker/`](src/scenes/clicker/) |
| Page builders | [`src/scenes/clicker/createPages.js`](src/scenes/clicker/createPages.js) |
| Tema / copy | [`theme.js`](src/config/theme.js), [`uiText.js`](src/config/uiText.js) |
| Buy modes | [`src/config/buyAmounts.js`](src/config/buyAmounts.js) |
| Save | [`gameConfig.js`](src/config/gameConfig.js), [`saveStorage.js`](src/services/saveStorage.js), [`saveMigrations.js`](src/services/saveMigrations.js) |
| Catálogos | [`generators.js`](src/data/generators.js), [`upgrades.js`](src/data/upgrades.js), [`metaUpgrades.js`](src/data/metaUpgrades.js), [`achievements.js`](src/data/achievements.js) |
| Meta UI | [`src/ui/metaUpgradesView.js`](src/ui/metaUpgradesView.js), [`metaUpgradeCopy.js`](src/ui/metaUpgradeCopy.js) |

---

## Gameplay

### Economia

- Moeda: `coins` (`Decimal`).
- Tap: `1` + upgrades `type: 'click'` (+ share de idle via meta).
- Idle: geradores `type: 'auto'` × meta × achievements × Ascension Tokens.
- Custo: `baseCost * growth^level` (floor).
- Meta-upgrades (compra única; somem da lista ao comprar; na UI ordenados por preço, independente da STORE):
  - `generator` — own **5 / 25 / 50 / 100 / 200** → produção daquele gerador ×2 (compra na UPGRADE; **não** é auto-granted por owned no load)
  - `global` — own N total → produção global ×M
  - `click_per_second` — N taps → tap +% da produção idle
  - `base_multiplier` — lifetime coins (unlocks **únicos** e progressivos em `baseMultiplierTiers.json`) → produção global ×(1+%)
- Prestige: soft reset → Ascension Tokens (+1% idle cada).
- Achievements: milestones → idle % permanente.

Catálogo padrão: `tap-power` + `auto-tap`, geradores `upgrade-1`…`upgrade-20`, `META_UPGRADES` (**130**: 100 efficiency + 5 global + 5 tap-% + 20 BASE MULTIPLIER). Unlock encadeado (`unlockAfter`); UI mostra liberados + próximo como `???`.

### Prestige (Ascension Tokens)

- Ganho ≈ `floor(sqrt(coinsThisAscension / 1e6))` (mínimo ~1M nesta run).
- Soft reset limpa: coins, níveis da STORE, meta-upgrades comprados (`boosts`).
- Mantém: tokens, achievements, stats all-time.
- ★ amarelas na STORE = efficiency pips, **não** Ascension Tokens.
- Confirmação obrigatória: botão bloqueado com countdown **5 → 1**, depois **vermelho** + `PRESTIGE` clicável (CANCEL sempre livre).

### Auto Tap

- +1 clique / 10s por level (onda).
- Até **63** cursores em **2 anéis**; depois recolore (tier+1 de poder).
- Visual derivado do `level` de `auto-tap` — sem campo extra no save.

### Idle e offline

- Progresso por `Date.now` (wall-clock), não só pelo timer do Phaser.
- Hide / `pagehide` / `beforeunload`: aplica pendente e salva.
- Volta à aba: se ausente ≥ **60s**, modal “Welcome back”.
- Load: `hydrate` aplica desde `savedAt` em um passo.
- Cap: `LOOP_CONFIG.maxOfflineSeconds` (`null` = sem teto).

### Interface

Ordem das abas: **UPGRADE → STORE → TAP → STATUS → PRESTIGE** (+ settings).

| Aba | Conteúdo |
| --- | --- |
| UPGRADE | Meta-upgrades disponíveis, ordenados por preço crescente (`meta*` UI / cameras) |
| STORE | Geradores na ordem de liberação + buy bar ×1/×10/×25/MAX + % idle por gerador |
| TAP | Botão central + Auto Tap |
| STATUS | Stats, multiplicadores, achievements (`○ ???` se bloqueado) |
| PRESTIGE | Tokens + soft reset (confirm com countdown) |

Swipe horizontal entre páginas; scroll vertical nas listas. Nav inferior com nomes completos (`UPGRADE`, `STORE`, …). Overlay “Click to start” em save novo. List cameras escondidas enquanto modal está aberto.

### Compra na STORE

- Preferência salva em settings (`buyAmount`).
- BUY aplica o modo ativo; `MAX` = máximo acessível com coins atuais.
- Geradores `type: 'auto'`: linha de efeito inclui share do idle (`+8 coins / sec (80%)`); Lv.0 / idle zerado / tap-power / auto-tap → sem `%`.
- Compras da STORE/UPGRADE disparam save imediato (além do autosave).
- Sem hold-to-buy.

### Feedback

- Compra: Web Audio (se habilitado).
- Settings (som, buy amount) em chave separada do save de progresso.

---

## Configuração

```js
// src/config/gameConfig.js
GAME_CONFIG = { width: 540, height: 960, backgroundColor: '#111822' }
LOOP_CONFIG = {
  autoSaveDelayMs: 10000,
  maxOfflineSeconds: null, // null = sem teto offline
}
SAVE_KEY = 'clicker-phaser-save-v1' // NUNCA renomear — use SAVE_VERSION + migrações
SAVE_VERSION = 10
```

Env opcional (`.env.example`): `VITE_SAVE_KEY`. App id nativo: `capacitor.config.json` → `appId`.

---

## Save e migrações

**Status: ok para publicar.** Saves antigos migram até `SAVE_VERSION = 10`.

### Persistido

`coins`, `totalCoinsEarned`, `coinsThisAscension`, `totalClicks`, `autoTapProgress`, `ascensionTokens`, `prestigeCount`, `unlockedAchievements`, níveis de upgrades, meta comprados (`boosts`), `savedAt`.

Hydrate faz merge **por `id`**: catálogo novo entra zerado; ids removidos são ignorados.

### Pipeline no load

1. Lê `SAVE_KEY` (+ `LEGACY_SAVE_KEYS` se necessário).
2. Aceita envelope `{ version, payload, checksum }` ou JSON legado.
3. Checksum inválido mas JSON válido → tenta recuperar.
4. `migrateSaveState` até a versão atual.
5. Regrava formato canônico (inclui limpeza de `stars` legado).

Autosave 10s + flush em blur / `pagehide` / `beforeunload`. Reset: `?resetSave=1`.

### Histórico

| Versão | Migração |
| --- | --- |
| **1** | Save legado |
| **2** | Normaliza shape |
| **3** | Milestones → efficiency; `first-surge` / etc. → globals |
| **4–5** | Ids `generator-N` ↔ `upgrade-N` + aliases |
| **6** | `totalCoinsEarned` + aliases cps-tap |
| **7** | Prestige/achievements (`stars`, …) |
| **8** | `stars` → `ascensionTokens` |
| **9** | Adiciona `ownedModifiers` (sistema temporário; removido na v10) |
| **10** | Remove `ownedModifiers` |

### Atualizar sem perder progresso

1. Não renomeie `SAVE_KEY` (ou liste a antiga em `LEGACY_SAVE_KEYS`).
2. Incremente `SAVE_VERSION`.
3. Adicione passo em `saveMigrations.js`.
4. Ids renomeados → `UPGRADE_ID_ALIASES` / `BOOST_ID_ALIASES`.
5. Só catálogo novo em geral **não** precisa de migração (merge por id).

### Limitações conscientes

- Globals antigos (`first-surge` etc.) mapeiam para globals atuais (multiplicadores menores); o progresso não some.
- Multipliers genéricos viraram `BASE MULTIPLIER 1…20` (sem lore).

---

## Customização

1. Visual — `src/config/theme.js`
2. Textos — `src/config/uiText.js`
3. Resolução / loops / save — `src/config/gameConfig.js`
4. Buy modes — `src/config/buyAmounts.js`
5. Geradores — `src/data/generators.js`
6. Clique / Auto Tap — `src/data/upgrades.js` + `src/lib/autoTapProgress.js`
7. Meta-upgrades — `src/data/metaUpgrades.js` (save continua em `boosts`)
8. BASE MULTIPLIER tiers — `src/data/baseMultiplierTiers.json`
9. Prestige — `src/lib/prestige.js`
10. Achievements — `src/data/achievements.js`
11. Fórmulas — `src/lib/clickerMath.js`; sessão — `src/lib/clickerController.js`
12. Migrações — `src/services/saveMigrations.js`

Depois: `npm test` && `npm run build`.

Extensões naturais: missões em `src/lib/objectivesEngine.js`.

---

## Android / iOS

```bash
# Android (primeira vez)
npm run build && npm run cap:add:android
npm run android

# iOS (macOS; primeira vez)
npm run build && npm run cap:add:ios
npm run ios
```

`npm run cap:doctor` verifica o ambiente nativo.

## Deploy Web

```bash
npm run build
npm run preview
```

[`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml) testa, builda e publica no GitHub Pages a cada push em `main`.

## Licença

ISC. Consulte [LICENSE](LICENSE).
