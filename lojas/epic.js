// Epic Games: lê os pedidos da conta pela API JSON que o próprio site usa
// (accounts.epicgames.com/account/v2/payment/ajaxGetOrderHistory). Segue o padrão de loja
// externa descrito em lojas/nuuvem.js.
//
// Particularidades da Epic:
//   - Os valores vêm em CENTAVOS (1240 = R$ 12,40) e "total.amount" é o que foi realmente pago.
//   - A maioria dos pedidos é de jogos grátis (valor 0): não entram na conta, só são contados.
//   - O servidor ignora o tamanho de página e devolve sempre 10 pedidos, então uma sincronização
//     completa são dezenas de requisições. Por isso o intervalo da Epic é longo (6 horas).
//   - Um reembolso é um pedido à parte (orderType "REFUND"), ligado à compra pelo mesmo offerId.

import { estadoDeLojaExterna, formatarReais, primeiraData, totalPorAno } from "./comum.js";

export const VERSAO_EPIC = 1;

export const LOJA = {
  id: "epic",
  nome: "Epic Games",
  origem: "https://accounts.epicgames.com/*",
  intervaloMinutos: 360,
  versao: VERSAO_EPIC,
  link: { texto: "Abrir minhas compras", url: "https://www.epicgames.com/account/transactions" },
};

const URL_PEDIDOS = "https://accounts.epicgames.com/account/v2/payment/ajaxGetOrderHistory";
const LIMITE_DE_PAGINAS = 200; // trava de segurança contra um loop infinito de paginação

class ErroDaLoja extends Error {
  constructor(codigo, mensagem) {
    super(mensagem);
    this.codigo = codigo;
  }
}

// "aaaa-mm-dd" no fuso do usuário (o service worker roda no fuso do computador dele).
function dataLocal(milissegundos) {
  const d = new Date(milissegundos);
  const dois = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;
}

// Transforma a lista de pedidos da API no formato padrão das lojas.
export function interpretarPedidos(pedidos) {
  const r = { compras: [], gratuitas: 0, reembolsadas: 0, naoContadas: 0, foraDeReais: 0 };

  // 1) Reembolsos: para cada oferta reembolsada, guardamos quantas vezes ela foi devolvida.
  const devolvidas = new Map();
  for (const pedido of pedidos) {
    if (pedido?.orderType !== "REFUND") continue;
    for (const item of pedido.items ?? []) {
      devolvidas.set(item.offerId, (devolvidas.get(item.offerId) ?? 0) + 1);
    }
  }

  // 2) Compras.
  for (const pedido of pedidos) {
    if (!pedido || typeof pedido !== "object") continue;
    if (pedido.orderType === "REFUND") continue;
    if (pedido.orderType !== "PURCHASE") { r.naoContadas++; continue; } // tipo que não conhecemos

    const total = pedido.total;
    if (!total || typeof total.amount !== "number") { r.naoContadas++; continue; }
    if (total.currency !== "BRL") { r.foraDeReais++; continue; }
    if (total.amount === 0) { r.gratuitas++; continue; } // jogo grátis: não é gasto

    const itens = Array.isArray(pedido.items) ? pedido.items : [];

    // Compra que foi reembolsada: fica de fora da conta (e da lista).
    const reembolsada = itens.find((i) => (devolvidas.get(i.offerId) ?? 0) > 0);
    if (reembolsada) {
      devolvidas.set(reembolsada.offerId, devolvidas.get(reembolsada.offerId) - 1);
      r.reembolsadas++;
      continue;
    }

    r.compras.push({
      itens: itens.map((i) => (i.quantity > 1 ? `${i.description} (x${i.quantity})` : i.description)).join(" + "),
      quantidade: itens.reduce((soma, i) => soma + (Number(i.quantity) || 1), 0),
      valor: total.amount / 100,
      data: typeof pedido.createdAtMillis === "number" ? dataLocal(pedido.createdAtMillis) : null,
      // Só guardamos SE foi presente, nunca para quem (giftRecipient é dado de outra pessoa).
      presente: itens.some((i) => !!i.giftRecipient),
    });
  }

  r.compras.sort((x, y) => y.valor - x.valor);
  return r;
}

// Busca todas as páginas de pedidos. "buscar" é o fetch (parâmetro para poder testar).
export async function buscarPedidos(buscar = fetch) {
  const pedidos = [];
  let token = "";

  for (let pagina = 1; pagina <= LIMITE_DE_PAGINAS; pagina++) {
    const url = `${URL_PEDIDOS}?count=10&sortDir=DESC&sortBy=DATE&locale=pt-BR${
      token ? `&nextPageToken=${encodeURIComponent(token)}` : ""
    }`;
    // redirect "manual": sem login a Epic redireciona para a página de entrada. Não queremos
    // seguir esse redirecionamento (é outro site), só reconhecer que estamos deslogados.
    const resposta = await buscar(url, { credentials: "include", redirect: "manual" });

    if (resposta.type === "opaqueredirect" || resposta.status === 401 || resposta.status === 403) {
      throw new ErroDaLoja("sem-login", "Você não está logado na Epic Games neste Chrome.");
    }
    if (!resposta.ok) {
      throw new ErroDaLoja("erro", `A Epic respondeu ${resposta.status}.`);
    }

    let json;
    try {
      json = await resposta.json();
    } catch {
      throw new ErroDaLoja("erro", "A Epic devolveu uma resposta em formato inesperado.");
    }
    if (!Array.isArray(json?.orders)) {
      throw new ErroDaLoja("erro", "A Epic devolveu uma resposta em formato inesperado.");
    }
    pedidos.push(...json.orders);

    token = json.nextPageToken || "";
    if (!token) break; // era a última página
  }

  return pedidos;
}

export async function sincronizar(buscar = fetch) {
  const pedidos = await buscarPedidos(buscar);
  const { compras, ...contadores } = interpretarPedidos(pedidos);
  return {
    versao: VERSAO_EPIC,
    atualizadoEm: new Date().toISOString(),
    compras,
    total: compras.reduce((soma, c) => soma + c.valor, 0),
    ...contadores,
  };
}

// Põe os dados guardados no formato que o popup entende (veja lojas/comum.js).
export function normalizar(dados) {
  const { compras, total, gratuitas = 0, reembolsadas = 0, naoContadas = 0, foraDeReais = 0 } = dados;

  const avisos = [];
  if (reembolsadas > 0) avisos.push(`${reembolsadas} ${reembolsadas === 1 ? "reembolsada não contada" : "reembolsadas não contadas"}`);
  if (foraDeReais > 0) avisos.push(`${foraDeReais} em outra moeda não ${foraDeReais === 1 ? "somada" : "somadas"}`);
  if (naoContadas > 0) avisos.push(`${naoContadas} de tipo desconhecido não ${naoContadas === 1 ? "contado" : "contados"}`);

  return {
    total,
    compras,
    porAno: totalPorAno(compras),
    primeiraData: primeiraData(compras),
    cartoes: [
      { rotulo: "Compras pagas", valor: String(compras.length), detalhe: `média de ${formatarReais(total / compras.length)}` },
      { rotulo: "Jogos grátis resgatados", valor: String(gratuitas) },
    ],
    avisos,
    atualizadoEm: dados.atualizadoEm,
  };
}

// "armazenado" é o que veio de chrome.storage.local: { resumo, lojas }.
export function estado(armazenado, permitido, negada) {
  return estadoDeLojaExterna(LOJA, armazenado.lojas?.[LOJA.id], permitido, negada, normalizar);
}
