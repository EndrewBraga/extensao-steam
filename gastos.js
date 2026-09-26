// Roda só na página de histórico de compras (/account/history/): calcula o resumo dos seus
// gastos e o guarda para o popup exibir.
// As funções de cálculo (calcular...) vêm do resumo.js, carregado antes.
//
// Privacidade: os valores NUNCA são escritos na página. Tudo que fica no DOM aqui é texto
// sem valores, porque os scripts da própria Steam (e de outras extensões) conseguem ler a
// página. Os números aparecem só no popup da extensão.

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
banner.textContent = "Gastos em Jogos: calculando o resumo...";
banner.style.background = "#1b2838";
banner.style.color = "#66c0f4";
banner.style.padding = "10px";
banner.style.textAlign = "center";
banner.style.fontWeight = "bold";
document.body.prepend(banner);

carregarTudo().then(() => {
  const r = calcular(document);

  // Guarda o resumo para o popup. O storage é do Chrome, no seu computador.
  // ultimaTentativa avisa o atualizar.js de que os dados acabaram de ser renovados.
  chrome.storage.local
    .set({ resumo: { ...r, atualizadoEm: new Date().toISOString() }, ultimaTentativa: Date.now() })
    .then(() => {
      banner.textContent = r.idiomaNaoSuportado
        ? "Gastos em Jogos: não reconheci o histórico desta conta. A extensão só entende a Steam em português do Brasil, com valores em R$."
        : "Gastos em Jogos: resumo atualizado. Clique no ícone da extensão para ver seus gastos.";
    })
    .catch((erro) => {
      console.error("Não consegui salvar o resumo:", erro);
      banner.textContent = "Gastos em Jogos: não consegui salvar o resumo.";
    });
});
