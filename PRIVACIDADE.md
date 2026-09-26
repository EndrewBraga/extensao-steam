# Política de Privacidade — Gastos para Steam

Última atualização: 26/09/2026

**Gastos para Steam** é uma extensão do Chrome que mostra o preço dos jogos na loja da Steam e um resumo dos gastos da sua própria conta. Esta política explica, sem rodeios, quais dados a extensão acessa e o que faz com eles.

> A extensão **não é afiliada, endossada ou patrocinada pela Valve Corporation**. Steam é uma marca registrada da Valve.

## Resumo

- Tudo é calculado e guardado **no seu computador**, dentro do seu navegador.
- **Nenhum dado é enviado** para o desenvolvedor, para servidores próprios ou para terceiros.
- Não há anúncios, análises de uso (analytics), rastreamento nem venda de dados.

## Quais dados a extensão acessa

A extensão só funciona em páginas de `https://store.steampowered.com/`.

1. **Páginas de jogos**: lê o nome e o preço exibidos na página para mostrar um aviso no topo. São informações públicas da loja.
2. **Histórico de compras da sua conta** (`/account/history/`): com você logado, lê as transações da tabela (data, itens, valor, tipo da transação e se foi presente). Para isso, a extensão pode baixar essa página em segundo plano, com a sua própria sessão, enquanto você navega na loja. Há um intervalo mínimo entre as consultas: 15 minutos, ou 1 minuto quando ainda não existe um resumo válido guardado.

## O que é guardado

Somente um **resumo calculado**, no armazenamento local da extensão (`chrome.storage.local`):

- totais de compras, reembolsos e presentes; economia com descontos; gasto por ano;
- a lista das compras, com o nome dos jogos, o valor pago e a data;
- a data da última atualização.

## O que NÃO é guardado

- Números de cartão, forma de pagamento ou qualquer dado de pagamento.
- Nome, e-mail, senha, identificador ou perfil da sua conta Steam.
- O **nome de quem recebeu** presentes que você comprou. A extensão só registra que a compra foi um presente.
- Cookies ou dados de sessão.

Os valores e nomes ficam apenas no popup da extensão. Eles não são escritos na página da Steam, para que scripts da página não consigam lê-los.

## Uso e compartilhamento

Os dados são usados **exclusivamente** para exibir o resumo no popup da extensão. Não são compartilhados, vendidos, transferidos a terceiros nem usados para publicidade, análise de crédito ou qualquer outra finalidade.

## Permissões

| Permissão | Para que serve |
|---|---|
| `storage` | Guardar o resumo calculado no seu navegador |
| Acesso a `store.steampowered.com` | Ler o preço dos jogos e o seu histórico de compras, e somente nesse site |

## Retenção e exclusão

Os dados permanecem no seu navegador até você **desinstalar a extensão**, o que apaga tudo o que ela guardou. Se você não abrir mais a loja da Steam, nada é atualizado.

## Limitações

A extensão só entende a Steam em **português do Brasil** e valores em **R$**. Em outro idioma ou moeda, ela avisa que não reconheceu o histórico em vez de mostrar valores incorretos.

## Alterações e contato

Se esta política mudar, a data acima será atualizada. Dúvidas ou pedidos: abra uma issue em https://github.com/EndrewBraga/extensao-steam/issues.
