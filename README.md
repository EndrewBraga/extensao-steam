# Gastos para Steam

Extensão do Chrome (Manifest V3) que mostra o preço dos jogos na loja da Steam e um resumo dos gastos da sua conta. Nasceu como projeto de estudo sobre como criar extensões.

> Não é afiliada, endossada ou patrocinada pela Valve. Steam é marca registrada da Valve.

## O que faz

- **Preço do jogo**: aviso no topo das páginas de jogos (trata jogo gratuito, em promoção e conjuntos).
- **Resumo de gastos** (popup da extensão): total gasto já descontando reembolsos, média por compra, presentes que você deu, economia com descontos, primeira compra e gasto por ano.
- **Ranking**: todas as suas compras, da mais cara para a mais barata.
- **Atualização automática**: o resumo se atualiza sozinho enquanto você navega na loja, sem precisar abrir o histórico.

Tudo roda no seu navegador. Nada é enviado para servidores. Veja a [Política de Privacidade](PRIVACIDADE.md).

## Limitações

- Só entende a Steam em **português do Brasil** e valores em **R$**. Em outro idioma, avisa que não reconheceu o histórico.
- Depende do HTML da Steam: se a Valve mudar o layout, algo pode quebrar.
- Cada linha do ranking é uma **compra**. Quando ela tem vários itens, a Steam informa só o valor total.

## Como instalar (modo desenvolvedor)

1. Abra `chrome://extensions` e ative o **Modo do desenvolvedor**.
2. Clique em **Carregar sem compactação** e escolha a pasta deste projeto.
3. Ao mexer no código, clique em **recarregar** no card da extensão.

## Estrutura

| Arquivo | Função |
|---|---|
| `manifest.json` | Declara a extensão, as permissões e quais scripts rodam onde |
| `content.js` | Aviso de preço nas páginas de jogos |
| `resumo.js` | Cálculo dos gastos a partir da tabela do histórico (usado pelos dois scripts abaixo) |
| `gastos.js` | Roda na página de histórico: carrega todas as transações e guarda o resumo |
| `atualizar.js` | Roda na loja: baixa o histórico em segundo plano e mantém o resumo atualizado |
| `popup.html`, `popup.css`, `popup.js` | O popup, com as abas Resumo e Ranking |
| `icons/` | Ícones da extensão |
| `docs/publicacao.md` | Guia e textos para publicar na Chrome Web Store |
