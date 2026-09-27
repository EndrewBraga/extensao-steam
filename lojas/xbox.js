// Xbox (Microsoft Store): lê o histórico de pedidos da conta Microsoft pela API JSON que a própria
// página "Histórico do pedido" usa (account.microsoft.com/billing/orders/list). Segue o padrão de
// loja externa descrito em lojas/nuuvem.js. Serve para tudo que se compra com a conta Microsoft:
// jogos do Xbox e do PC, complementos, Minecraft, Game Pass...
//
// Particularidades:
//   - Só precisa dos cookies do navegador e do cabeçalho "x-requested-with: XMLHttpRequest"
//     (sem ele o servidor responde 400/412). Não é uma credencial: é só o marcador de que a
//     chamada vem de uma página, como o site faz.
//   - Sem login a API responde 401.
//   - Uma consulta devolve vários pedidos e um "continuationToken" para a página seguinte.
//   - "localTotalInDecimal" é o total pago em reais (já com imposto). Pedidos de valor 0 são
//     jogos grátis ou resgatados por código: só são contados. O valor pode vir em outra moeda
//     ("currencyInfo.currencyCode"), e esses ficam de fora da soma.
//   - A data vem como texto ("13 de abril de 2025"), então lemos o texto em português e, se
//     não der, usamos "daysFromPurchase" (quantos dias se passaram desde a compra).
//   - O pedido traz o endereço de entrega, o cartão e o número do pedido: NADA disso é guardado.
//   - Assinaturas (Game Pass) aparecem com itemTypeName "Subscription".

import { cartoesPadrao, estadoDeLojaExterna, primeiraData, totalPorAno } from "./comum.js";

export const VERSAO_XBOX = 1;

export const LOJA = {
  id: "xbox",
  nome: "Xbox",
  origem: "https://account.microsoft.com/*",
  intervaloMinutos: 360,
  versao: VERSAO_XBOX,
  link: { texto: "Abrir meu histórico", url: "https://account.microsoft.com/billing/orders" },
};

const URL_PEDIDOS = "https://account.microsoft.com/billing/orders/list";
const LIMITE_DE_PAGINAS = 100; // trava de segurança contra um loop infinito de paginação

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

class ErroDaLoja extends Error {
  constructor(codigo, mensagem) {
    super(mensagem);
    this.codigo = codigo;
  }
}

const dois = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;

// "aaaa-mm-dd" do pedido: lê "13 de abril de 2025"; se o formato for outro, volta "daysFromPurchase" dias.
export function dataDoPedido(pedido, agora = new Date()) {
  const partes = /^(\d{1,2}) de ([a-zç]+) de (\d{4})/i.exec(String(pedido.localSubmittedDate ?? ""));
  const mes = partes ? MESES.indexOf(partes[2].toLowerCase()) : -1;
  if (partes && mes >= 0) return `${partes[3]}-${dois(mes + 1)}-${dois(Number(partes[1]))}`;

  if (typeof pedido.daysFromPurchase === "number") {
    const d = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - pedido.daysFromPurchase);
    return iso(d);
  }
  return null;
}

// Transforma a lista de pedidos da API no formato padrão das lojas.
export function interpretarPedidos(pedidos, agora = new Date()) {
  const r = { compras: [], gratuitas: 0, reembolsadas: 0, canceladas: 0, naoContadas: 0, foraDeReais: 0 };

  for (const pedido of pedidos) {
    if (!pedido || typeof pedido !== "object") continue;
    const itens = Array.isArray(pedido.items) ? pedido.items : [];
    const total = pedido.localTotalInDecimal;
    if (typeof total !== "number") { r.naoContadas++; continue; }

    if (itens.some((i) => i?.isCanceled || i?.itemState === "Canceled")) { r.canceladas++; continue; }
    if (itens.some((i) => i?.isReturned || i?.itemState === "Refunded")) { r.reembolsadas++; continue; }
    if (total === 0) { r.gratuitas++; continue; } // grátis ou resgatado por código: não é gasto
    if (pedido.currencyInfo?.currencyCode !== "BRL") { r.foraDeReais++; continue; }
    if (!itens.some((i) => i?.isCharged)) { r.naoContadas++; continue; } // não foi cobrado ainda

    r.compras.push({
      itens: itens.map((i) => (i.quantity > 1 ? `${i.localTitle} (x${i.quantity})` : i.localTitle)).filter(Boolean).join(" + ") || "Compra Microsoft",
      quantidade: itens.reduce((soma, i) => soma + (Number(i.quantity) || 1), 0),
      valor: total,
      data: dataDoPedido(pedido, agora),
      // Só guardamos SE foi presente, nunca para quem.
      presente: itens.some((i) => i?.isGift),
      assinatura: itens.some((i) => i?.itemTypeName === "Subscription"),
    });
  }

  r.compras.sort((x, y) => y.valor - x.valor);
  return r;
}

// Busca todas as páginas de pedidos (até 7 anos, o máximo que a página da Microsoft oferece).
// "buscar" é o fetch (parâmetro para poder testar).
export async function buscarPedidos(buscar = fetch) {
  const pedidos = [];
  let token = "";

  for (let pagina = 1; pagina <= LIMITE_DE_PAGINAS; pagina++) {
    const consulta = new URLSearchParams({
      period: "SevenYears",
      orderTypeFilter: "All",
      filterChangeCount: "1",
      isInD365Orders: "true",
      isPiDetailsRequired: "true",
      timeZoneOffsetMinutes: String(new Date().getTimezoneOffset()),
    });
    if (token) consulta.set("continuationToken", token);

    const resposta = await buscar(`${URL_PEDIDOS}?${consulta}`, {
      credentials: "include",
      redirect: "manual",
      headers: { "x-requested-with": "XMLHttpRequest" },
    });

    if (resposta.type === "opaqueredirect" || resposta.status === 401 || resposta.status === 403) {
      throw new ErroDaLoja("sem-login", "Você não está logado na conta Microsoft neste Chrome.");
    }
    if (!resposta.ok) {
      throw new ErroDaLoja("erro", `A Microsoft respondeu ${resposta.status}.`);
    }

    let json;
    try {
      json = await resposta.json();
    } catch {
      throw new ErroDaLoja("erro", "A Microsoft devolveu uma resposta em formato inesperado.");
    }
    if (!Array.isArray(json?.orders)) {
      throw new ErroDaLoja("erro", "A Microsoft devolveu uma resposta em formato inesperado.");
    }
    pedidos.push(...json.orders);

    token = json.continuationToken || "";
    if (!token) break; // era a última página
  }

  return pedidos;
}

export async function sincronizar(buscar = fetch) {
  const pedidos = await buscarPedidos(buscar);
  const { compras, ...contadores } = interpretarPedidos(pedidos);
  return {
    versao: VERSAO_XBOX,
    atualizadoEm: new Date().toISOString(),
    compras,
    total: compras.reduce((soma, c) => soma + c.valor, 0),
    ...contadores,
  };
}

// Põe os dados guardados no formato que o popup entende (veja lojas/comum.js).
export function normalizar(dados) {
  const { compras, total, reembolsadas = 0, canceladas = 0, naoContadas = 0, foraDeReais = 0 } = dados;

  const avisos = [];
  const plural = (n, singular, pluralTexto) => `${n} ${n === 1 ? singular : pluralTexto}`;
  if (reembolsadas > 0) avisos.push(plural(reembolsadas, "reembolsado não contado", "reembolsados não contados"));
  if (canceladas > 0) avisos.push(plural(canceladas, "cancelado não contado", "cancelados não contados"));
  if (foraDeReais > 0) avisos.push(`${foraDeReais} em outra moeda não ${foraDeReais === 1 ? "somado" : "somados"}`);
  if (naoContadas > 0) avisos.push(`${naoContadas} de tipo desconhecido não ${naoContadas === 1 ? "contado" : "contados"}`);

  return {
    total,
    compras,
    porAno: totalPorAno(compras),
    primeiraData: primeiraData(compras),
    cartoes: cartoesPadrao(compras, total, primeiraData(compras)),
    avisos,
    atualizadoEm: dados.atualizadoEm,
  };
}

// "armazenado" é o que veio de chrome.storage.local: { resumo, lojas }.
export function estado(armazenado, permitido, negada) {
  return estadoDeLojaExterna(LOJA, armazenado.lojas?.[LOJA.id], permitido, negada, normalizar);
}
