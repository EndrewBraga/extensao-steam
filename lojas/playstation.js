// PlayStation Store: lê o histórico de transações da conta pela API GraphQL que o próprio site
// usa (web.np.playstation.com). Segue o padrão de loja externa descrito em lojas/nuuvem.js.
//
// Particularidades da PlayStation:
//   - Os valores vêm em CENTAVOS (39990 = R$ 399,90) e "purchaseDetails.total" é o que foi pago.
//   - A consulta é uma "persisted query": em vez de mandar o texto da consulta, mandamos só o
//     hash dela (o mesmo que a página do site manda). Se a PlayStation trocar o hash, a busca
//     falha com uma mensagem clara e a extensão precisa de uma atualização.
//   - O servidor exige o cabeçalho "content-type: application/json" mesmo em GET (proteção
//     contra CSRF do Apollo). Não é uma credencial: quem identifica o usuário são os cookies
//     do navegador, e a extensão nunca lê nem guarda nenhum deles.
//   - O histórico vem em páginas de 15 transações, da mais nova para a mais antiga; cada página
//     diz onde a seguinte começa ("nextEndDate") e se ainda há mais ("hasMore").
//   - Recargas da carteira (WALLET_FUNDING) não são gasto: o gasto é a compra feita depois.
//     Jogos grátis (PS Plus, demos) aparecem como compra de valor 0 e só são contados.

import { estadoDeLojaExterna, formatarReais, primeiraData, totalPorAno } from "./comum.js";

export const VERSAO_PLAYSTATION = 1;

export const LOJA = {
  id: "playstation",
  nome: "PlayStation Store",
  origem: "https://web.np.playstation.com/*",
  intervaloMinutos: 360,
  versao: VERSAO_PLAYSTATION,
  link: { texto: "Abrir meu histórico", url: "https://store.playstation.com/pt-br/pages/latest" },
};

const URL_API = "https://web.np.playstation.com/api/graphql/v1//op";
const HASH_DA_CONSULTA = "496f6f30273e14e92498da51447f773b1c9e30c3cfefb8739627c31673d08751";
const INICIO_DO_HISTORICO = "1994-12-03T00:00:00.000Z"; // antes do lançamento do primeiro PlayStation
const TAMANHO_DA_PAGINA = 15;
const LIMITE_DE_PAGINAS = 200; // trava de segurança contra um loop infinito de paginação

class ErroDaLoja extends Error {
  constructor(codigo, mensagem) {
    super(mensagem);
    this.codigo = codigo;
  }
}

// "aaaa-mm-dd" no fuso do usuário (o service worker roda no fuso do computador dele).
function dataLocal(iso) {
  const milissegundos = Date.parse(iso);
  if (Number.isNaN(milissegundos)) return null;
  const d = new Date(milissegundos);
  const dois = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;
}

const temReembolso = (t) => [t.refundItems, t.chargeRefunds, t.walletRefunds].some((r) => Array.isArray(r) ? r.length > 0 : !!r);

// Transforma a lista de transações da API no formato padrão das lojas.
export function interpretarTransacoes(transacoes) {
  const r = { compras: [], gratuitas: 0, reembolsadas: 0, naoContadas: 0, foraDeReais: 0 };

  for (const t of transacoes) {
    if (!t || typeof t !== "object") continue;
    if (t.invoiceType === "WALLET_FUNDING") continue; // recarga da carteira: não é gasto
    if (t.invoiceType !== "PRODUCT_PURCHASE") { r.naoContadas++; continue; } // tipo que não conhecemos

    const detalhes = t.purchaseDetails;
    if (!detalhes || typeof detalhes.total !== "number") { r.naoContadas++; continue; }
    if (temReembolso(t)) { r.reembolsadas++; continue; }
    if (detalhes.total === 0) { r.gratuitas++; continue; } // grátis: não é gasto

    // A API não traz a moeda como campo; ela só aparece no texto do valor ("R$399,90").
    if (!String(detalhes.displayOfTotal ?? "").includes("R$")) { r.foraDeReais++; continue; }

    const produtos = Array.isArray(detalhes.productPurchases) ? detalhes.productPurchases : [];
    r.compras.push({
      itens: produtos.map((p) => (p.quantity > 1 ? `${p.productName} (x${p.quantity})` : p.productName)).join(" + "),
      quantidade: produtos.reduce((soma, p) => soma + (Number(p.quantity) || 1), 0),
      valor: detalhes.total / 100,
      data: dataLocal(t.date),
    });
  }

  r.compras.sort((x, y) => y.valor - x.valor);
  return r;
}

// Busca todas as páginas do histórico. "buscar" é o fetch (parâmetro para poder testar).
export async function buscarTransacoes(buscar = fetch) {
  const transacoes = [];
  let fim = new Date().toISOString();

  for (let pagina = 1; pagina <= LIMITE_DE_PAGINAS; pagina++) {
    const url = new URL(URL_API);
    url.searchParams.set("operationName", "transactionHistoryRetrieve");
    url.searchParams.set("variables", JSON.stringify({ startDate: INICIO_DO_HISTORICO, endDate: fim, limit: TAMANHO_DA_PAGINA }));
    url.searchParams.set("extensions", JSON.stringify({ persistedQuery: { version: 1, sha256Hash: HASH_DA_CONSULTA } }));

    const resposta = await buscar(url.href, { credentials: "include", headers: { "content-type": "application/json" } });
    if (resposta.status === 401 || resposta.status === 403) {
      throw new ErroDaLoja("sem-login", "Você não está logado na PlayStation Store neste Chrome.");
    }

    // Lemos como texto para poder mostrar, no erro, o que veio (só o começo, e só quando não
    // era o formato esperado).
    const texto = await resposta.text();
    let json = null;
    try {
      json = JSON.parse(texto);
    } catch {
      // não era JSON
    }
    const tipo = resposta.headers?.get?.("content-type") ?? "?";
    const pista = `status ${resposta.status}, ${tipo.split(";")[0]}, "${texto.slice(0, 120).replace(/\s+/g, " ")}"`;
    if (!json) {
      throw new ErroDaLoja("erro", resposta.ok ? `A PlayStation devolveu uma resposta inesperada (${pista}).` : `A PlayStation respondeu ${resposta.status} (${pista}).`);
    }

    // Erros do GraphQL vêm com status 200, dentro de "errors".
    const mensagens = (Array.isArray(json?.errors) ? json.errors : []).map((e) => String(e?.message ?? ""));
    if (mensagens.some((m) => /authorized|unauthor|unauthenticated/i.test(m))) {
      throw new ErroDaLoja("sem-login", "Você não está logado na PlayStation Store neste Chrome.");
    }
    if (mensagens.some((m) => /PersistedQuery/i.test(m))) {
      throw new ErroDaLoja("erro", "A PlayStation mudou o jeito de consultar o histórico. É preciso atualizar a extensão.");
    }

    const dados = json?.data?.transactionHistoryRetrieve;
    if (!dados || !Array.isArray(dados.transactions)) {
      throw new ErroDaLoja("erro", resposta.ok ? `A PlayStation devolveu uma resposta em formato inesperado (${pista}).` : `A PlayStation respondeu ${resposta.status} (${pista}).`);
    }
    transacoes.push(...dados.transactions);

    if (!dados.hasMore || !dados.nextEndDate || dados.nextEndDate === fim) break; // era a última página
    fim = dados.nextEndDate;
  }

  return transacoes;
}

export async function sincronizar(buscar = fetch) {
  const transacoes = await buscarTransacoes(buscar);
  const { compras, ...contadores } = interpretarTransacoes(transacoes);
  return {
    versao: VERSAO_PLAYSTATION,
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
