// Resumo geral: junta os dados de todas as lojas que têm dados (veja o formato em lojas/comum.js).
// Módulo ES com funções puras, sem acesso à página, para poder ser testado sozinho.

import { primeiraData } from "./lojas/comum.js";

// "entradas" é uma lista de { loja: { nome }, dados }, só com as lojas que têm dados.
export function resumoGeral(entradas) {
  let total = 0;
  let quantidade = 0;
  let primeira = null;
  let maior = null; // a compra mais cara entre todas as lojas
  const porAno = {};
  const lojas = [];

  for (const { loja, dados } of entradas) {
    total += dados.total;
    quantidade += dados.compras.length;
    lojas.push({ nome: loja.nome, total: dados.total });

    for (const [ano, valor] of Object.entries(dados.porAno)) porAno[ano] = (porAno[ano] ?? 0) + valor;

    const daLoja = dados.primeiraData ?? primeiraData(dados.compras);
    if (daLoja && (!primeira || daLoja < primeira)) primeira = daLoja;

    for (const compra of dados.compras) {
      if (!maior || compra.valor > maior.valor) maior = { ...compra, loja: loja.nome };
    }
  }

  lojas.sort((a, b) => b.total - a.total);

  return {
    total,
    quantidade,
    media: quantidade > 0 ? total / quantidade : 0,
    lojas,
    porAno,
    maior,
    primeiraData: primeira,
  };
}
