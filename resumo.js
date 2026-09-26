// Lógica de cálculo dos gastos, compartilhada pelos outros scripts da extensão.
// Este arquivo só define funções: quem as usa são o gastos.js (página de histórico)
// e o atualizar.js (atualização em segundo plano nas outras páginas da loja).

// Versão do formato do resumo guardado. Sempre que os campos mudarem, aumente este número:
// o atualizar.js vê que o resumo antigo é de outra versão e o refaz logo.
const VERSAO_RESUMO = 4;

// Converte "R$ 1.234,56" em 1234.56. Texto sem número vira 0.
function textoParaNumero(texto) {
  const numero = parseFloat(texto.replace(/[^\d,]/g, "").replace(",", "."));
  return isNaN(numero) ? 0 : numero;
}

const formatarReais = (n) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const limparEspacos = (texto) => texto.replace(/\s+/g, " ").trim();

// A Steam escreve o mês abreviado em português, com ponto: "25/jan./2026".
const MESES = { "jan.": 1, "fev.": 2, "mar.": 3, "abr.": 4, "mai.": 5, "jun.": 6,
                "jul.": 7, "ago.": 8, "set.": 9, "out.": 10, "nov.": 11, "dez.": 12 };

// Converte "25/jan./2026" em { ano: 2026, iso: "2026-01-25" }. Devolve null se não entender.
function lerData(texto) {
  const [dia, mes, ano] = limparEspacos(texto).split("/");
  const numeroMes = MESES[(mes ?? "").toLowerCase()];
  if (!numeroMes || !ano) return null;
  const doisDigitos = (n) => String(n).padStart(2, "0");
  return { ano: Number(ano), iso: `${ano}-${doisDigitos(numeroMes)}-${doisDigitos(dia)}` };
}

// Lista com o nome de cada item de uma linha (uma compra pode ter vários: pacote, DLC,
// ou jogos diferentes pagos juntos no mesmo carrinho). Removemos a parte "Presente enviado
// a fulano" (nome de outra pessoa, que não queremos guardar) e a marca de reembolsado.
function itensDaLinha(linha) {
  const copia = linha.querySelector(".wht_items")?.cloneNode(true);
  if (!copia) return [];
  copia.querySelectorAll(".wth_payment, .wth_item_refunded").forEach((el) => el.remove());
  // Divs "folha" (sem outra div dentro) são uma por item.
  return [...copia.querySelectorAll("div")]
    .filter((div) => !div.querySelector("div"))
    .map((div) => limparEspacos(div.textContent))
    .filter(Boolean);
}

// Os nomes da linha juntos, separados por " + ".
const nomesDosItens = (linha) => itensDaLinha(linha).join(" + ");

// Diz se o histórico tem mais transações além das que estão na tabela. A Steam esconde
// o botão "Carregar mais transações" (com style="display: none") quando não há mais.
// Serve para documentos baixados com fetch, que não têm layout: não dá para usar offsetParent.
function temMaisTransacoes(doc) {
  const botao = doc.querySelector("#load_more_button");
  if (!botao) return false;
  for (let el = botao; el; el = el.parentElement) {
    if (/display:\s*none/.test(el.getAttribute("style") ?? "")) return false;
  }
  return true;
}

// Lê a tabela de transações de um documento (a própria página ou uma baixada com fetch).
function calcular(doc) {
  const r = {
    versao: VERSAO_RESUMO,
    compras: 0, gasto: 0,             // compras na loja (inclui presentes)
    reembolsos: 0, reembolsado: 0,
    presentes: 0, gastoPresentes: 0,  // compras de presente para outras pessoas
    precoCheio: 0, precoPago: 0,      // para calcular a economia com descontos
    ranking: [],                      // todas as compras (sem as reembolsadas), da mais cara para a
                                      // mais barata: [{ itens, quantidade, valor, data, presente }]
    primeiraCompra: null,             // "aaaa-mm-dd"
    porAno: {},                       // { 2025: { gasto, reembolsado } }
    foraDeReais: 0,
  };

  const comprasValidas = []; // compras não reembolsadas, para montar o ranking no final
  const linhas = [...doc.querySelectorAll(".wallet_table_row")];
  const tipoDe = (linha) => limparEspacos(linha.querySelector(".wht_type")?.textContent ?? "");
  const totalDe = (linha) => limparEspacos(linha.querySelector(".wht_total")?.textContent ?? "");
  const chaveDe = (linha) => nomesDosItens(linha) + "|" + totalDe(linha);

  // A Steam NÃO marca a compra original como reembolsada: só cria uma linha "Reembolso".
  // Para ignorar a compra reembolsada na economia e na "maior compra", anotamos cada
  // reembolso (itens + valor) e, ao achar a compra igual, riscamos da lista.
  const reembolsosPendentes = new Map();
  linhas.filter((l) => tipoDe(l).startsWith("Reembolso")).forEach((l) => {
    reembolsosPendentes.set(chaveDe(l), (reembolsosPendentes.get(chaveDe(l)) ?? 0) + 1);
  });

  linhas.forEach((linha) => {
    const tipo = tipoDe(linha);
    const total = totalDe(linha);

    // "Compra Visa", "Compra Pix", "Compra de presente ..." e as compras divididas
    // entre carteira e cartão começam com "Compra". Vendas no Mercado da Comunidade
    // e depósitos na carteira não são gasto na loja, então ficam de fora.
    const ehCompra = tipo.startsWith("Compra");
    const ehReembolso = tipo.startsWith("Reembolso");
    if (!ehCompra && !ehReembolso) return;

    if (!/\d/.test(total)) return; // itens grátis não têm valor
    if (!total.startsWith("R$")) { // não somamos dólar com real
      r.foraDeReais++;
      return;
    }

    const valor = textoParaNumero(total);
    const data = lerData(linha.querySelector(".wht_date")?.textContent ?? "");
    const doAno = data ? (r.porAno[data.ano] ??= { gasto: 0, reembolsado: 0 }) : null;

    if (ehReembolso) {
      r.reembolsos++;
      r.reembolsado += valor;
      if (doAno) doAno.reembolsado += valor;
      return;
    }

    r.compras++;
    r.gasto += valor;
    if (doAno) doAno.gasto += valor;
    if (data && (!r.primeiraCompra || data.iso < r.primeiraCompra)) r.primeiraCompra = data.iso;

    if (tipo.startsWith("Compra de presente")) {
      r.presentes++;
      r.gastoPresentes += valor;
    }

    // Compras reembolsadas não contam para economia nem para o ranking.
    const chave = chaveDe(linha);
    if ((reembolsosPendentes.get(chave) ?? 0) > 0) {
      reembolsosPendentes.set(chave, reembolsosPendentes.get(chave) - 1);
      return;
    }

    // Com desconto, a Steam mostra o preço cheio riscado e o preço pago; sem desconto, só um preço.
    const coluna = linha.querySelector(".wht_base_price");
    const pagoEl = coluna?.querySelector(".wht_discounted_price");
    const cheioEl = coluna?.querySelector(".wht_original_price");
    if (coluna && /\d/.test(coluna.textContent)) {
      const pago = textoParaNumero((pagoEl ?? coluna).textContent);
      r.precoPago += pago;
      r.precoCheio += cheioEl ? textoParaNumero(cheioEl.textContent) : pago;
    }

    const itens = itensDaLinha(linha);
    comprasValidas.push({
      itens: itens.join(" + "),
      quantidade: itens.length, // quantos itens vieram nessa compra
      valor,
      data: data?.iso ?? null,
      presente: tipo.startsWith("Compra de presente"),
    });
  });

  // Da mais cara para a mais barata.
  r.ranking = comprasValidas.sort((a, b) => b.valor - a.valor);

  return r;
}
