// Steam: transforma o resumo que os scripts de conteúdo guardam (chave "resumo") no formato
// padrão das lojas (veja lojas/comum.js). Diferente das outras lojas, a Steam não usa o
// background.js nem permissão opcional: quem lê as páginas dela são o gastos.js e o atualizar.js,
// que rodam dentro da própria loja.

import { cartoesPadrao } from "./comum.js";

export const LOJA = {
  id: "steam",
  nome: "Steam",
  link: { texto: "Abrir histórico de compras", url: "https://store.steampowered.com/account/history/" },
  // Sem "origem": não pede permissão. O botão "Atualizar" existe mesmo assim, porque o
  // background.js abre esse link em segundo plano e o gastos.js atualiza o resumo na página.
  atualizaPelaPagina: true,
};

export function normalizar(resumo) {
  // A lista da Steam (ranking) já vem sem as compras reembolsadas. O total é o líquido:
  // o que foi pago menos o que foi reembolsado.
  const compras = resumo.ranking ?? [];
  const total = resumo.gasto - resumo.reembolsado;

  // Gasto por ano, também líquido de reembolsos.
  const porAno = {};
  for (const [ano, v] of Object.entries(resumo.porAno ?? {})) porAno[ano] = v.gasto - v.reembolsado;

  return {
    total,
    compras,
    porAno,
    primeiraData: resumo.primeiraCompra ?? null,
    cartoes: cartoesPadrao(compras, total, resumo.primeiraCompra ?? null),
    avisos: resumo.foraDeReais > 0 ? [`${resumo.foraDeReais} transação(ões) em outra moeda não foram somadas`] : [],
    atualizadoEm: resumo.atualizadoEm,
  };
}

// "armazenado" é o que veio de chrome.storage.local: { resumo, lojas }.
export function estado({ resumo }) {
  if (!resumo) {
    return {
      tipo: "mensagem",
      mensagem:
        "Ainda não há dados da Steam. Eles são carregados sozinhos quando você navega na loja da Steam (logado na sua conta). Você também pode clicar em Atualizar (no canto de cima) para carregar agora.",
    };
  }
  if (resumo.idiomaNaoSuportado) {
    return {
      tipo: "mensagem",
      mensagem: "Não consegui entender o histórico de compras desta conta. A extensão só funciona com a Steam em português do Brasil e valores em R$.",
    };
  }
  return { tipo: "dados", dados: normalizar(resumo) };
}
