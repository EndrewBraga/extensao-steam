// Roda só na página de histórico de compras (/account/history/): soma o que você gastou,
// mostra o total em um banner e guarda o resumo para o popup exibir.
// As funções de cálculo (calcular, formatarReais...) vêm do resumo.js, carregado antes.

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const contarLinhas = () => document.querySelectorAll(".wallet_table_row").length;

// A Steam mostra só as transações mais recentes e tem um botão "Carregar mais transações".
// Clicamos nele até sumir, para somar o histórico inteiro.
async function carregarTudo() {
  // offsetParent é null quando o elemento está escondido.
  const botaoVisivel = () => {
    const botao = document.querySelector("#load_more_button");
    return botao && botao.offsetParent !== null ? botao : null;
  };

  let botao;
  while ((botao = botaoVisivel())) {
    const antes = contarLinhas();
    botao.click();
    // As linhas novas chegam de forma assíncrona: espera até 10s por elas.
    for (let i = 0; i < 20 && contarLinhas() === antes; i++) await esperar(500);
    if (contarLinhas() === antes) break; // nada novo chegou: evita loop infinito
  }
}

const banner = document.createElement("div");
banner.textContent = "Calculando o total gasto...";
banner.style.background = "#1b2838";
banner.style.color = "#66c0f4";
banner.style.padding = "10px";
banner.style.textAlign = "center";
banner.style.fontWeight = "bold";
document.body.prepend(banner);

carregarTudo().then(() => {
  const r = calcular(document);
  const liquido = r.gasto - r.reembolsado;

  let texto =
    `Total gasto: ${formatarReais(liquido)} ` +
    `(${r.compras} compras: ${formatarReais(r.gasto)}` +
    ` − ${r.reembolsos} reembolso(s): ${formatarReais(r.reembolsado)})`;
  if (r.foraDeReais > 0) {
    texto += ` — ${r.foraDeReais} transação(ões) em outra moeda não foram somadas`;
  }
  banner.textContent = texto;
  console.log("Gastos:", r);

  // Guarda o resumo para o popup. O storage é do Chrome, no seu computador.
  // ultimaTentativa avisa o atualizar.js de que os dados acabaram de ser renovados.
  chrome.storage.local
    .set({ resumo: { ...r, atualizadoEm: new Date().toISOString() }, ultimaTentativa: Date.now() })
    .then(() => { banner.textContent += " · salvo para o popup"; })
    .catch((erro) => {
      console.error("Não consegui salvar o resumo:", erro);
      banner.textContent += " · erro ao salvar para o popup";
    });
});
