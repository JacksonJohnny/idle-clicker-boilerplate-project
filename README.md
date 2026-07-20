# Mobile Idle Clicker Boilerplate

Boilerplate mobile-first para jogos clicker/idle construído com Phaser, Vite, Decimal.js e Capacitor.

## Recursos

- Economia com números grandes e custos exponenciais.
- Geradores encadeados, milestones e boosts permanentes.
- Apenas o próximo item bloqueado aparece como `???`.
- Compra unitária ou acelerada por toque prolongado.
- Ganhos offline com limite configurável.
- Save automático com checksum e compatibilidade entre versões.
- Som e vibração configuráveis.
- Navegação e gestos pensados para telas mobile.
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

## Estrutura

```text
src/
	config/       Configuração do jogo, tema e textos
	controllers/  Interações com estado próprio, como scroll
	data/         Geradores, upgrades, boosts e factories
	lib/          Motor econômico puro
	scenes/       Orquestração da cena Phaser
	services/     Save, preferências e feedback do dispositivo
	ui/           Builders de interface sem regras econômicas
```

Responsabilidades principais:

- [src/lib/clickerMath.js](src/lib/clickerMath.js): economia, compras, produção e serialização.
- [src/scenes/ClickerScene.js](src/scenes/ClickerScene.js): coordenação entre motor, UI e ciclo Phaser.
- [src/config/theme.js](src/config/theme.js): cores, fontes e medidas compartilhadas.
- [src/config/uiText.js](src/config/uiText.js): textos fixos da interface.
- [src/data/generators.js](src/data/generators.js): catálogo de geradores.
- [src/data/upgrades.js](src/data/upgrades.js): upgrades de clique, separados dos geradores.

## Customização

1. Altere identidade visual em `src/config/theme.js`.
2. Altere textos e idioma em `src/config/uiText.js`.
3. Configure dimensões e loops em `src/config/gameConfig.js`.
4. Edite geradores em `src/data/generators.js`.
5. Edite upgrades em `src/data/upgrades.js`.
6. Edite boosts em `src/data/boosts.js`.
7. Ajuste fórmulas centrais em `src/lib/clickerMath.js`.

## Android

Na primeira utilização:

```bash
npm run build
npm run cap:add:android
```

Depois disso:

```bash
npm run android
```

## iOS

No macOS, na primeira utilização:

```bash
npm run build
npm run cap:add:ios
```

Depois disso:

```bash
npm run ios
```

Use `npm run cap:doctor` para verificar o ambiente nativo.

## Deploy Web

```bash
npm run build
npm run preview
```

O workflow em `.github/workflows/deploy-pages.yml` executa testes, gera `dist/` e publica no GitHub Pages a cada push em `main`.

## Save

- Auto-save a cada 10 segundos.
- Ganhos offline limitados por `LOOP_CONFIG.maxOfflineSeconds`.
- Reset completo usando `?resetSave=1` na URL.
- Preferências de som e vibração armazenadas separadamente.

## Licença

ISC. Consulte [LICENSE](LICENSE).