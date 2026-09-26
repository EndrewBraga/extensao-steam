// Nuuvem: lê os pedidos da conta pela API JSON que o próprio site usa
// (secure.nuuvem.com/api/v2/customer/orders). É um módulo ES, usado pelo background.js.
//
// PADRÃO DE LOJA EXTERNA (vale para as próximas lojas também). Cada arquivo em lojas/ exporta:
//   - LOJA: { id, nome, origem, intervaloMinutos, versao, link }   origem = permissão de site que o usuário libera
//   - sincronizar(): (usado pelo background.js) busca os dados da loja e devolve
//       { versao, atualizadoEm, compras: [{ itens, quantidade, valor, data }] (da mais cara para a
//         mais barata), total, ...contadores do que ficou de fora (cancelados, gratuitos, etc.) }
//     Erros são lançados com um "codigo": "sem-login" (a loja pediu login) ou "erro".
//   - normalizar(dados): (usado pelo popup) põe esses dados no formato que o popup entende
//   - estado(armazenado, permitido, negada): (usado pelo popup) diz o que a página da loja mostra
// Os formatos que o popup entende estão descritos em lojas/comum.js.

import { estadoDeLojaExterna, formatarReais, primeiraData, totalPorAno } from "./comum.js";

export const VERSAO_NUUVEM = 1;

export const LOJA = {
  id: "nuuvem",
  nome: "Nuuvem",
  origem: "https://secure.nuuvem.com/*",
  intervaloMinutos: 30, // de quanto em quanto tempo o background pode buscar de novo
  versao: VERSAO_NUUVEM, // aumente quando o formato dos dados guardados mudar: o background refaz na hora
  link: { texto: "Abrir meus pedidos", url: "https://secure.nuuvem.com/br-pt/account/orders" },
};

const URL_PEDIDOS = "https://secure.nuuvem.com/api/v2/customer/orders";
const LIMITE_DE_PAGINAS = 50; // trava de segurança contra um loop infinito de paginação

class ErroDaLoja extends Error {
  constructor(codigo, mensagem) {
    super(mensagem);
    this.codigo = codigo;
  }
}

// Converte "R$ 1.234,56" em 1234.56. Devolve null se o texto não for em reais.
export function valorEmReais(texto) {
  if (typeof texto !== "string" || !texto.trim().startsWith("R$")) return null;
  const numero = parseFloat(texto.replace(/[^\d,]/g, "").replace(",", "."));
  return Number.isNaN(numero) ? null : numero;
}

// Transforma a lista de pedidos da API no formato padrão das lojas.
// Só entra na conta o que foi pago e liberado ("released"). Os IDs de status da API não
// mudam com o idioma, ao contrário dos textos ("Liberado"), então usamos os IDs.
export function interpretarPedidos(pedidos) {
  const r = { compras: [], canceladas: 0, gratuitas: 0, naoContadas: 0, foraDeReais: 0 };

  for (const pedido of pedidos) {
    const a = pedido?.attributes;
    if (!a) continue;

    if (a.status_id === "canceled") { r.canceladas++; continue; }
    if (a.status_id !== "released") { r.naoContadas++; continue; } // pendente ou status que não conhecemos

    const valor = valorEmReais(a.total_value);
    if (valor === null) { r.foraDeReais++; continue; }
    if (valor === 0) { r.gratuitas++; continue; } // pedido "por conta da casa"

    const produtos = Array.isArray(a.products) ? a.products : [];
    r.compras.push({
      itens: produtos.map((p) => (p.quantity > 1 ? `${p.name} (x${p.quantity})` : p.name)).join(" + "),
      quantidade: produtos.reduce((soma, p) => soma + (Number(p.quantity) || 1), 0),
      valor,
      data: typeof a.date_iso === "string" ? a.date_iso.slice(0, 10) : null, // "aaaa-mm-dd"
    });
  }

  r.compras.sort((x, y) => y.valor - x.valor);
  return r;
}

// Busca todas as páginas de pedidos. "buscar" é o fetch (parâmetro para poder testar).
export async function buscarPedidos(buscar = fetch) {
  const pedidos = [];

  for (let pagina = 1; pagina <= LIMITE_DE_PAGINAS; pagina++) {
    const resposta = await buscar(`${URL_PEDIDOS}?store_country_code=br&language_code=pt&page=${pagina}`, {
      credentials: "include",
    });
    if (resposta.status === 401 || resposta.status === 403) {
      throw new ErroDaLoja("sem-login", "Você não está logado na Nuuvem neste Chrome.");
    }
    if (!resposta.ok) {
      throw new ErroDaLoja("erro", `A Nuuvem respondeu ${resposta.status}.`);
    }

    const json = await resposta.json();
    if (!Array.isArray(json?.data)) {
      throw new ErroDaLoja("erro", "A Nuuvem devolveu uma resposta em formato inesperado.");
    }
    pedidos.push(...json.data);

    if (!json.meta?.next_page) break; // era a última página
  }

  return pedidos;
}

export async function sincronizar(buscar = fetch) {
  const pedidos = await buscarPedidos(buscar);
  const { compras, ...contadores } = interpretarPedidos(pedidos);
  return {
    versao: VERSAO_NUUVEM,
    atualizadoEm: new Date().toISOString(),
    compras,
    total: compras.reduce((soma, c) => soma + c.valor, 0),
    ...contadores,
  };
}

// Põe os dados guardados no formato que o popup entende (veja lojas/comum.js).
export function normalizar(dados) {
  const { compras, total, canceladas = 0, gratuitas = 0 } = dados;

  // O que ficou de fora da conta, para o total não parecer errado.
  const naoContados = [
    canceladas > 0 && `${canceladas} ${canceladas === 1 ? "cancelado" : "cancelados"}`,
    gratuitas > 0 && `${gratuitas} ${gratuitas === 1 ? "gratuito" : "gratuitos"}`,
  ].filter(Boolean);

  return {
    total,
    compras,
    porAno: totalPorAno(compras),
    primeiraData: primeiraData(compras),
    cartoes: [
      { rotulo: "Pedidos", valor: String(compras.length) },
      { rotulo: "Média por pedido", valor: formatarReais(total / compras.length) },
    ],
    avisos: naoContados.length > 0 ? [`não contados: ${naoContados.join(" e ")}`] : [],
    atualizadoEm: dados.atualizadoEm,
  };
}

// "armazenado" é o que veio de chrome.storage.local: { resumo, lojas }.
export function estado(armazenado, permitido, negada) {
  return estadoDeLojaExterna(LOJA, armazenado.lojas?.[LOJA.id], permitido, negada, normalizar);
}
