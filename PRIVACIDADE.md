# Política de Privacidade — Gastos em Jogos

Última atualização: 26/09/2026

**Gastos em Jogos** é uma extensão do Chrome que mostra o preço dos jogos na loja da Steam e um resumo dos gastos da sua própria conta, na Steam e em outras lojas de jogos que você escolher ativar. Esta política explica, sem rodeios, quais dados a extensão acessa e o que faz com eles.

> A extensão **não é afiliada, endossada ou patrocinada por nenhuma das lojas citadas** (Valve/Steam, Nuuvem, Epic Games, PlayStation/Sony e outras). Os nomes são marcas dos seus respectivos donos.

## Resumo

- Tudo é calculado e guardado **no seu computador**, dentro do seu navegador.
- **Nenhum dado é enviado** para o desenvolvedor, para servidores próprios ou para terceiros.
- Não há anúncios, análises de uso (analytics), rastreamento nem venda de dados.

## Quais dados a extensão acessa

Na Steam, a extensão só funciona em páginas de `https://store.steampowered.com/`. O acesso a outras lojas é **opcional**: só existe depois que você o ativa no popup (o Chrome mostra um pedido de permissão), e você pode retirá-lo quando quiser.

1. **Páginas de jogos**: lê o nome e o preço exibidos na página para mostrar um aviso no topo. São informações públicas da loja.
2. **Histórico de compras da sua conta** (`/account/history/`): com você logado, lê as transações da tabela (data, itens, valor, tipo da transação e se foi presente). Para isso, a extensão pode baixar essa página em segundo plano, com a sua própria sessão, enquanto você navega na loja. Há um intervalo mínimo entre as consultas: 15 minutos, ou 1 minuto quando ainda não existe um resumo válido guardado.
3. **Pedidos da Nuuvem** (opcional, só se você ativar): com você logado, lê a lista dos seus pedidos em `secure.nuuvem.com`, usando a mesma consulta que o site da Nuuvem faz. Isso acontece em segundo plano, no máximo a cada 30 minutos, quando o Chrome abre e assim que você ativa a loja.
4. **Compras da Epic Games** (opcional, só se você ativar): com você logado, lê a lista das suas compras em `accounts.epicgames.com`, usando a mesma consulta que a página "Compras" da Epic faz. Como a Epic entrega 10 pedidos por consulta, buscar todos leva várias consultas seguidas, por isso isso acontece no máximo a cada 6 horas, quando o Chrome abre e assim que você ativa a loja.
5. **Compras da PlayStation Store** (opcional, só se você ativar): com você logado, lê o seu histórico de transações em `web.np.playstation.com`, usando a mesma consulta que a página "Histórico de transações" da PlayStation faz (15 transações por vez). Acontece no máximo a cada 6 horas, quando o Chrome abre e assim que você ativa a loja. As recargas da carteira não entram na conta.

## O que é guardado

Somente um **resumo calculado**, no armazenamento local da extensão (`chrome.storage.local`):

- totais de compras, reembolsos e presentes; economia com descontos; gasto por ano;
- a lista das compras, com o nome dos jogos, o valor pago e a data;
- da Nuuvem, da Epic Games e da PlayStation Store, se ativadas: a lista de compras pagas (nome dos jogos, valor pago e data), o total e as contagens do que não entra na conta (cancelados, gratuitos, reembolsados);
- a data da última atualização.

## O que NÃO é guardado

- Números de cartão, forma de pagamento ou qualquer dado de pagamento (nas outras lojas também não guardamos o número do pedido, cupons nem o meio de pagamento).
- Nome, e-mail, senha, identificador ou perfil da sua conta na Steam, na Nuuvem, na Epic Games ou na PlayStation Store.
- O **nome de quem recebeu** presentes que você comprou (na Steam ou na Epic). A extensão só registra que a compra foi um presente.
- Cookies ou dados de sessão.

Os valores e nomes ficam apenas no popup da extensão. Eles não são escritos na página da Steam, para que scripts da página não consigam lê-los.

## Uso e compartilhamento

Os dados são usados **exclusivamente** para exibir o resumo no popup da extensão. Não são compartilhados, vendidos, transferidos a terceiros nem usados para publicidade, análise de crédito ou qualquer outra finalidade.

## Permissões

| Permissão | Para que serve |
|---|---|
| `storage` | Guardar o resumo calculado no seu navegador |
| `alarms` | Acordar a extensão a cada 15 minutos para atualizar, em segundo plano, as lojas ativadas cujo intervalo já passou (30 minutos na Nuuvem, 6 horas na Epic e na PlayStation) |
| Acesso a `store.steampowered.com` | Ler o preço dos jogos e o seu histórico de compras, e somente nesse site |
| Acesso a `secure.nuuvem.com` (**opcional**) | Ler os seus pedidos da Nuuvem. É pedido só quando você ativa a Nuuvem no popup e pode ser retirado a qualquer momento em `chrome://extensions` |
| Acesso a `accounts.epicgames.com` (**opcional**) | Ler as suas compras da Epic Games. É pedido só quando você ativa a Epic no popup e pode ser retirado a qualquer momento em `chrome://extensions` |
| Acesso a `web.np.playstation.com` (**opcional**) | Ler o seu histórico de transações da PlayStation Store. É pedido só quando você ativa a PlayStation no popup e pode ser retirado a qualquer momento em `chrome://extensions` |

## Retenção e exclusão

Os dados permanecem no seu navegador até você **desinstalar a extensão**, o que apaga tudo o que ela guardou. Se você retirar o acesso a uma loja, a extensão deixa de consultá-la. Para apagar os dados guardados de uma loja sem desinstalar, basta retirar o acesso e remover a extensão.

## Limitações

A extensão só entende a Steam em **português do Brasil** e valores em **R$**. Em outro idioma ou moeda, ela avisa que não reconheceu o histórico em vez de mostrar valores incorretos.

## Alterações e contato

Se esta política mudar, a data acima será atualizada. Dúvidas ou pedidos: abra uma issue em https://github.com/EndrewBraga/extensao-steam/issues.
