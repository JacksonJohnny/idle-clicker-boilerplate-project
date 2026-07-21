# Mobile Idle Clicker Boilerplate

Boilerplate mobile-first para jogos clicker/idle construído com **Phaser 4**, **Vite**, **Decimal.js** e **Capacitor 8**.

Resolução base: `540×960`. App id Capacitor: `com.clickergame.app`.

## Stack

| Camada | Tecnologia |
| --- | --- |
| Runtime do jogo | Phaser `^4.2.1` |
| Bundler | Vite `^8.1.4` |
| Números grandes | decimal.js `^10.6.0` |
| Mobile | Capacitor `^8.4.2` (Android / iOS) |
| Testes | Vitest `^4.1.10` |

## Recursos

- Economia com números grandes e custos exponenciais.
- Clique manual + geradores idle encadeados.
- **Auto Tap:** cursores em órbita (até 2 anéis / 63 slots); depois disso cada level pinta uma cor (1×, 2×, 3×…).
- Aba UPGRADE com meta-upgrades estilo Cookie Clicker (genéricos, sem lore):
  - efficiency por gerador (×2 ao atingir owned N)
  - produção global
  - tap ganha % do CPS
  - synergies entre geradores vizinhos
- Catálogo progressivo: só o próximo item bloqueado aparece como `???`.
- Compra unitária ou acelerada por toque prolongado.
- Idle em tempo real por relógio de parede (continua ao voltar da aba).
- Ganhos offline com limite configurável e modal de retorno.
- Contador de coins atualizado a cada frame (sem floating verde de income).
- Formatação de números no estilo Cookie Clicker.
- Save versionado com migrações (`SAVE_VERSION`) — progresso antigo sobrevive a updates.
- Som e vibração configuráveis (OFF em vermelho fraco / ON em verde).
- Navegação por abas + swipe, pensada para mobile.
- Build web, Android e iOS.
- Testes automatizados da economia com Vitest.

## Requisitos

- Node.js 20 ou superior.
- Android Studio para Android.
- macOS com Xcode para iOS.

## Desenvolvimento

```bash
npm install
npm run dev
```

Validação completa:

```bash
npm test
npm run build
npm run test:coverage
```

| Script | Função |
| --- | --- |
| `npm run dev` | Servidor Vite local |
| `npm run build` | Build de produção em `dist/` |
| `npm run preview` | Preview do build |
| `npm test` | Suite Vitest uma vez |
| `npm run test:watch` | Vitest em watch |
| `npm run test:coverage` | Cobertura |
| `npm run android` / `npm run ios` | Build + sync + abrir IDE nativa |
| `npm run cap:doctor` | Diagnóstico do ambiente Capacitor |

## Estrutura

```text
src/
  config/       Resolução, loops, tema e textos
  controllers/  Interações com estado próprio (scroll)
  data/         Geradores, upgrades, boosts e factories
  lib/          Motor econômico puro + formatação
  scenes/       Orquestração da cena Phaser e ciclo de vida
  services/     Save, preferências e feedback do dispositivo
  ui/           Builders de interface sem regras econômicas
```

Responsabilidades principais:

- [`src/lib/clickerMath.js`](src/lib/clickerMath.js): economia, compras, produção, offline e formatação.
- [`src/lib/autoTapProgress.js`](src/lib/autoTapProgress.js): slots, cores e multiplicadores do Auto Tap.
- [`src/scenes/ClickerScene.js`](src/scenes/ClickerScene.js): motor + UI + idle por wall-clock + persistência.
- [`src/config/theme.js`](src/config/theme.js): cores, fontes e medidas.
- [`src/config/uiText.js`](src/config/uiText.js): textos da interface.
- [`src/config/gameConfig.js`](src/config/gameConfig.js): resolução, `SAVE_KEY`, `SAVE_VERSION` e loops.
- [`src/data/generators.js`](src/data/generators.js): catálogo de geradores.
- [`src/data/upgrades.js`](src/data/upgrades.js): upgrades de clique + Auto Tap.
- [`src/data/metaUpgrades.js`](src/data/metaUpgrades.js): catálogo `META_UPGRADES` (generator / global / click_cps / synergy).
- [`src/data/boosts.js`](src/data/boosts.js): re-export legado de `metaUpgrades.js`.
- [`src/services/saveStorage.js`](src/services/saveStorage.js): load/save com checksum e regravação canônica.
- [`src/services/saveMigrations.js`](src/services/saveMigrations.js): passos de migração entre versões de save.
- [`src/services/storageAdapter.js`](src/services/storageAdapter.js): localStorage + mirror Capacitor Preferences.
- [`src/controllers/ListScrollController.js`](src/controllers/ListScrollController.js): scroll por dedo (barra só visual).
- [`src/scenes/clicker/`](src/scenes/clicker/): helpers da cena (hold-buy, wall-clock, listas, overlays, nav).

Detalhes de extensão também em [`BOILERPLATE.md`](BOILERPLATE.md).

---

## Especificação de gameplay

### Economia

- Moeda: `coins` (`Decimal`).
- Clique base: `1` + soma dos upgrades `type: 'click'`.
- Idle: soma dos geradores `type: 'auto'` × multiplicadores de meta-upgrades.
- Custo de upgrade/gerador: `baseCost * growth^level` (floor).
- Meta-upgrades (aba UPGRADE, compra única, somem da lista ao comprar):
  - `generator`: own N daquele gerador → produção dele ×2
  - `global`: own N geradores no total → produção global ×M
  - `click_cps`: N taps → tap +% do CPS
  - `synergy`: own N em dois geradores vizinhos → bônus cruzado genérico
- Sem sistemas temáticos (leite/kittens, grandma types, research, prestige).

Catálogo padrão:

- Upgrades de clique: `tap-power` + `auto-tap` (1 clique / 10s por level; visual de cursores na aba TAP).
- 9 geradores encadeados (`upgrade-1` … `upgrade-9`) via `createGeneratorChain`.
- Meta-upgrades gerados em `META_UPGRADES` (tiers por gerador + globais + CPS tap + synergies).

Desbloqueio: cada gerador exige o anterior (`unlockAfter`). A UI mostra todos os liberados + apenas o próximo como `???`.

### Auto Tap

- Cada level: +1 clique a cada 10s (onda).
- Visual: até **63** cursores em **2 anéis**; levels seguintes **recolorem** um cursor por vez (branco → azul → …).
- Multiplicador por cor: **tier + 1** (branco 1×, azul 2×, menta 3×, …). A tint pode repetir a paleta; o poder continua subindo.
- Cada jab do cursor mostra `+ganho` individual (já com o multiplicador da cor).
- Cores/slots derivados do level — **não precisam de campo extra no save**.

### Idle e offline

- Produção idle aplicada por **relógio real** (`Date.now`) a cada frame, não só pelo timer do Phaser.
- Ao ocultar a aba / `pagehide` / `beforeunload`: aplica progresso pendente e salva.
- Ao voltar para a aba: recupera o tempo parado; se ≥ 60s, mostra modal de offline.
- No load: `hydrate` aplica progresso desde `savedAt` em um único passo matemático (sem simular frame a frame).
- Teto offline: `LOOP_CONFIG.maxOfflineSeconds` (padrão **8 horas**).

### Formatação de números (estilo Cookie Clicker)

Implementada em `formatCoins`:

| Faixa | Exemplo |
| --- | --- |
| &lt; 1.000.000 | `705,026` (separador de milhar); fração com 1 casa se necessário (`999.4`) |
| ≥ 1.000.000 | `1.014 billion`, `1 million`, … até `decillion` |
| Contador ao vivo | casas decimais caem conforme o `perSecond` (se a unidade da escala já muda ~2x/s, mostra inteiro) |
| Acima da escala nomeada | notação científica (`1.00e40`) |

O contador principal sobe em tempo real; não há texto flutuante verde de income idle. Feedback flutuante permanece para tap e compras.

### Interface e navegação

Abas: **STORE** | **TAP** | **UPGRADE** (+ settings).

- Tap: botão central de clique + anéis de Auto Tap.
- Store: lista scrollável de geradores/upgrades de clique.
- Upgrade: fila de meta-upgrades disponíveis (estilo Cookie Clicker; scroll na roda do mouse).
- Settings: som e vibração on/off.
- Swipe horizontal entre páginas; scroll vertical na store.
- Overlay inicial “Click to start” em save novo.
- Modal “Welcome back” com tempo ausente e coins ganhos.

### Compra mobile

- Toque curto: compra 1.
- Segurar (~550 ms): compra acelerada, até ~10/s.
- Scroll, swipe, sair do jogo ou soltar fora cancela o hold.

### Feedback

- Compra: Web Audio + vibração leve (se suportado e habilitado).
- Preferências salvas à parte do save de progresso.

---

## Configuração (`LOOP_CONFIG` / `GAME_CONFIG`)

```js
// src/config/gameConfig.js
GAME_CONFIG = { width: 540, height: 960, backgroundColor: '#111822' }
LOOP_CONFIG = {
  autoSaveDelayMs: 10000,        // autosave a cada 10s
  maxOfflineSeconds: 8 * 60 * 60 // teto de 8h de progresso offline
}
SAVE_KEY = 'clicker-phaser-save-v1' // NUNCA renomear — use SAVE_VERSION + migrações
SAVE_VERSION = 5
```

Optional Vite env (`.env.example`): `VITE_APP_ID`, `VITE_SAVE_KEY`.

---

## Save e migrações

**Status atual: ok para publicar.** Saves antigos sobem automaticamente até `SAVE_VERSION = 5`.

### O que é persistido

Snapshot: `coins`, `totalClicks`, `autoTapProgress`, níveis de upgrades (inclui Auto Tap), boosts comprados, `savedAt`.

Hydrate faz merge **por `id`**: itens novos no catálogo entram em 0 / não comprados; itens removidos do catálogo são ignorados sem apagar o resto.

### Pipeline no load

1. Lê `SAVE_KEY` (e `LEGACY_SAVE_KEYS` se a chave já tiver mudado no passado).
2. Aceita envelope `{ version, payload, checksum }` ou JSON legado sem envelope.
3. Se o checksum falhar mas o JSON for um save válido, **tenta recuperar** (não descarta o progresso à toa).
4. Roda `migrateSaveState` até a versão atual.
5. Regrava no formato canônico atual.

Autosave a cada 10s + flush em blur / `pagehide` / `beforeunload`.  
Reset total: `?resetSave=1`. Settings (som/vibração) ficam em chave separada.

### Histórico de versões

| Versão | O que a migração faz |
| --- | --- |
| **1** | Save legado (JSON puro ou envelope antigo). |
| **2** | Normaliza shape (`coins`, arrays, `autoTapProgress`, etc.). |
| **3** | Compensa **estrelas/milestones** removidos → efficiency já comprados. Boosts `first-surge` / `power-grid` / `overdrive` → globals. |
| **4** | (breve) tentativa `upgrade-N` → `generator-N`. |
| **5** | Reverte `generator-N` → `upgrade-N` (ids estáveis) + merge com aliases. |

Auto Tap (cores, anéis, multiplicadores) **não exige migração**: tudo deriva do `level` de `auto-tap` já salvo.

### Como atualizar o jogo sem perder progresso

1. **Não renomeie** `SAVE_KEY`. Se for inevitável, coloque a chave antiga em `LEGACY_SAVE_KEYS`.
2. Incremente `SAVE_VERSION` em `gameConfig.js`.
3. Em `saveMigrations.js`, adicione `{ from: N, to: N+1, migrate(state) { … } }`.
4. Se renomear um `id` de upgrade/boost, registre em `UPGRADE_ID_ALIASES` / `BOOST_ID_ALIASES`.
5. Mudanças só de catálogo (novo gerador, novo meta-upgrade) em geral **não** precisam de passo novo — o merge por `id` basta.

### Limitações conscientes

- Boosts globais antigos (`first-surge` etc. eram ×2) mapeiam para globals atuais (multiplicadores menores). O progresso não some; o poder daqueles itens específicos fica mais próximo do balance novo.
- A 5ª estrela antiga (owned 200) só tem 4 efficiency tiers no catálogo atual — o 5º ×2 não tem equivalente 1:1.

---

## Customização

1. Identidade visual: `src/config/theme.js`
2. Textos/idioma: `src/config/uiText.js`
3. Resolução e loops: `src/config/gameConfig.js`
4. Geradores: `src/data/generators.js`
5. Upgrades de clique / Auto Tap: `src/data/upgrades.js` + `src/lib/autoTapProgress.js`
6. Meta-upgrades: `src/data/boosts.js`
7. Fórmulas e formatação: `src/lib/clickerMath.js`
8. Migrações de save: `src/services/saveMigrations.js`

Depois: `npm test` e `npm run build`.

### Pontos de extensão sugeridos

- Prestige: `src/lib/prestigeMath.js`
- Modificadores extras: `src/data/modifiers.js`
- Missões/achievements: `src/lib/objectivesEngine.js`

---

## Android

Primeira vez:

```bash
npm run build
npm run cap:add:android
```

Depois:

```bash
npm run android
```

## iOS

No macOS, primeira vez:

```bash
npm run build
npm run cap:add:ios
```

Depois:

```bash
npm run ios
```

Use `npm run cap:doctor` para verificar o ambiente nativo.

## Deploy Web

```bash
npm run build
npm run preview
```

O workflow [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml) roda testes, gera `dist/` e publica no GitHub Pages a cada push em `main`.

## Licença

ISC. Consulte [LICENSE](LICENSE).
