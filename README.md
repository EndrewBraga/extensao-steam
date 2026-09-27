# Gastos em Jogos

Extensão do Chrome (Manifest V3) que mostra o preço dos jogos na loja da Steam e um resumo dos gastos da sua conta. Nasceu como projeto de estudo sobre como criar extensões.

> Não é afiliada, endossada ou patrocinada por nenhuma das lojas citadas. Steam (Valve), Nuuvem, Epic Games, PlayStation Store, Xbox (Microsoft) e demais nomes são marcas dos seus donos.

## O que faz

- **Preço do jogo**: aviso no topo das páginas de jogos (trata jogo gratuito, em promoção e conjuntos).
- **Resumo geral** (popup da extensão): total gasto somando todas as lojas, compras, média por compra, maior compra, e o gasto por loja e por ano.
- **Uma página por loja**, com total, dois cartões e a lista de todas as compras, da mais cara para a mais barata. Na Steam: economia com descontos e presentes que você deu, com os reembolsos já descontados.
- **Atualização automática**: o resumo da Steam se atualiza sozinho enquanto você navega na loja, sem precisar abrir o histórico.
- **Outras lojas**: hoje a **Nuuvem**, a **Epic Games** (compras e assinatura Clube Fortnite) a **PlayStation Store** e o **Xbox** (compras e Game Pass da conta Microsoft) (a Epic e a PlayStation mostram também quantos jogos grátis você resgatou). Cada loja é opcional: você ativa no popup (uma vez, o Chrome pede permissão) e a extensão passa a atualizar sozinha (a Nuuvem a cada 30 minutos, a Epic, a PlayStation e o Xbox a cada 6 horas). O botão **Atualizar** (no canto de cima: em cada loja, ou **Atualizar todas as lojas** no Resumo) abre a página da loja em segundo plano, espera carregar (a loja renova a sessão), busca os pedidos e fecha a aba; se você não estiver logado, a aba fica aberta para você entrar. Na Steam ele abre o histórico de compras, que recalcula o resumo na hora.

Tudo roda no seu navegador. Nada é enviado para servidores. Veja a [Política de Privacidade](PRIVACIDADE.md).

## Limitações

- Só entende a Steam em **português do Brasil** e valores em **R$**. Em outro idioma, avisa que não reconheceu o histórico.
- Depende do HTML da Steam e das APIs internas das outras lojas: se uma loja mudar, algo pode quebrar.
- **Loja que não dá para suportar**: a **Green Man Gaming** só mostra os jogos e as chaves, sem preço nem data.
- **PlayStation**: a consulta usa um identificador (hash) fixo que o site da Sony define; se a Sony trocar, a loja passa a mostrar erro até a extensão ser atualizada. Reembolsos ainda não foram testados com dados reais (por segurança, compras com reembolso ficam fora da conta e aparecem no aviso).
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
| `resumo.js` | Cálculo dos gastos da Steam a partir da tabela do histórico, usado pelos scripts abaixo |
| `gastos.js` | Roda na página de histórico: carrega todas as transações e guarda o resumo |
| `atualizar.js` | Roda na loja da Steam: baixa o histórico em segundo plano e mantém o resumo atualizado |
| `background.js` | Service worker: atualiza as lojas ativadas em segundo plano (alarme a cada 30 minutos) |
| `lojas/` | Um módulo por loja (`steam.js`, `nuuvem.js`, `epic.js`), todos no mesmo formato, e `comum.js` com o que é compartilhado |
| `geral.js` | Junta os dados de todas as lojas no resumo geral |
| `popup.html`, `popup.css`, `popup.js` | O popup: uma aba de Resumo geral e uma por loja |
| `icons/` | Ícones da extensão |
| `docs/publicacao.md` | Guia e textos para publicar na Chrome Web Store |

## Como adicionar uma loja

1. Descubra como a loja entrega os pedidos da conta (páginas, ou a API JSON que o próprio site usa) com o Chrome logado.
2. Crie `lojas/<loja>.js`, seguindo `lojas/nuuvem.js`: exporte `LOJA` (`id`, `nome`, `origem`) e `sincronizar()`, que devolve as compras no formato padrão.
3. Importe o módulo em `background.js` (lista `LOJAS`) e em `popup.js` (lista `LOJAS`).
4. Coloque o site em `optional_host_permissions` no `manifest.json`. O popup cria a aba e o botão de ativar sozinho.
5. Atualize a política de privacidade.
