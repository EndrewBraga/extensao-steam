const $ = (seletor) => document.querySelector(seletor);
const formatarReais = (n) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const formatarData = (iso) => new Date(iso + "T00:00:00").toLocaleDateString("pt-BR");

// Atalho para criar um elemento com texto e classe. Usamos textContent (e não
// innerHTML) porque o nome do jogo vem de fora e não deve ser tratado como HTML.
function criar(tag, texto, classe) {
  const el = document.createElement(tag);
  el.textContent = texto;
  if (classe) el.className = classe;
  return el;
}

// Um cartão: rótulo pequeno, valor em destaque e, opcionalmente, um detalhe embaixo.
// "largo" faz o cartão ocupar as duas colunas da grade.
function criarCard(rotulo, valor, detalhe, largo) {
  const card = document.createElement("div");
  card.className = largo ? "card largo" : "card";
  card.append(criar("span", rotulo, "rotulo"), criar("strong", valor, "valor"));
  if (detalhe) card.append(criar("span", detalhe, "sub"));
  return card;
}

function montarAnos(porAno) {
  const anos = Object.keys(porAno).sort(); // do mais antigo para o mais recente
  const liquidos = anos.map((ano) => porAno[ano].gasto - porAno[ano].reembolsado);
  const maximo = Math.max(...liquidos, 1);

  return anos.map((ano, i) => {
    const barra = document.createElement("div");
    barra.style.width = `${(Math.max(liquidos[i], 0) / maximo) * 100}%`;

    const trilho = document.createElement("div");
    trilho.className = "barra";
    trilho.append(barra);

    const li = document.createElement("li");
    li.append(criar("span", ano), trilho, criar("span", formatarReais(liquidos[i])));
    return li;
  });
}

// Lista de todas as compras, da mais cara para a mais barata. Cada item: posição, nome,
// data e preço. Todas as linhas têm o mesmo tamanho: o nome fica em uma linha só (o CSS
// põe "…" no que não couber) e o texto completo aparece ao passar o mouse (title).
function montarRanking(ranking) {
  return ranking.map((compra, i) => {
    const nome = criar("span", compra.itens || "—", "nome");
    nome.title = compra.itens || "";

    // Compras com mais de um item (pacote, DLC, ou jogos pagos juntos no mesmo carrinho)
    // ganham a etiqueta "N itens". "quantidade" não existe em resumos de versões antigas.
    const detalhe = [
      compra.data && formatarData(compra.data),
      compra.presente && "presente",
      compra.quantidade > 1 && `${compra.quantidade} itens`,
    ]
      .filter(Boolean)
      .join(" · ");
    // Sem detalhe, usamos um espaço "invisível" (um espaço não-separável) para a linha manter a mesma altura.
    const info = document.createElement("div");
    info.className = "info";
    info.append(nome, criar("span", detalhe || "\u00a0", "sub"));

    const li = document.createElement("li");
    li.append(criar("span", String(i + 1), "posicao"), info, criar("span", formatarReais(compra.valor), "preco"));
    return li;
  });
}

// Mostra o painel da aba escolhida e esconde o outro. Cada aba aponta para o seu painel
// pelo atributo data-aba ("resumo" -> #painel-resumo).
function selecionarAba(nome) {
  document.querySelectorAll("[role=tab]").forEach((aba) => {
    const ativa = aba.dataset.aba === nome;
    aba.setAttribute("aria-selected", String(ativa));
    $(`#painel-${aba.dataset.aba}`).hidden = !ativa;
  });
}

function mostrar(resumo) {
  const ranking = resumo.ranking ?? [];

  $("#liquido").textContent = formatarReais(resumo.gasto - resumo.reembolsado);

  // Só criamos os cartões que têm informação para mostrar.
  const cards = [];
  if (resumo.compras > 0) {
    cards.push(criarCard("Média por compra", formatarReais(resumo.gasto / resumo.compras)));
  }
  if (resumo.precoCheio > 0) {
    const economia = resumo.precoCheio - resumo.precoPago;
    const percentual = Math.round((economia / resumo.precoCheio) * 100);
    cards.push(criarCard("Economia com descontos", formatarReais(economia), `${percentual}% do preço cheio`));
  }
  if (resumo.presentes > 0) {
    cards.push(criarCard("Presentes que você deu", String(resumo.presentes), formatarReais(resumo.gastoPresentes)));
  }
  if (resumo.primeiraCompra) {
    cards.push(criarCard("Primeira compra", formatarData(resumo.primeiraCompra)));
  }
  if (ranking.length > 0) {
    // A maior compra é a primeira do ranking.
    const { itens, valor, data } = ranking[0];
    const detalhe = formatarReais(valor) + (data ? ` · ${formatarData(data)}` : "");
    cards.push(criarCard("Maior compra", itens || "—", detalhe, true));
  }
  $("#cards").replaceChildren(...cards);

  $("#anos").replaceChildren(...montarAnos(resumo.porAno));

  $("#ranking").replaceChildren(...montarRanking(ranking));
  $("#ranking-vazio").hidden = ranking.length > 0; // só aparece se a lista estiver vazia

  const aviso = $("#aviso");
  aviso.hidden = !(resumo.foraDeReais > 0);
  aviso.textContent = `${resumo.foraDeReais} transação(ões) em outra moeda não foram somadas.`;

  $("#rodape").textContent = "Atualizado em " + new Date(resumo.atualizadoEm).toLocaleString("pt-BR");
}

async function carregar() {
  const { resumo } = await chrome.storage.local.get("resumo");

  $("#conteudo").hidden = !resumo;
  $("#vazio").hidden = !!resumo;
  if (resumo) {
    mostrar(resumo);
  } else {
    $("#rodape").textContent = "";
  }
}

document.querySelectorAll("[role=tab]").forEach((aba) => {
  aba.addEventListener("click", () => selecionarAba(aba.dataset.aba));
});

// Se o resumo for atualizado com o popup aberto (por uma página da Steam), redesenha.
chrome.storage.onChanged.addListener((mudancas, area) => {
  if (area === "local" && mudancas.resumo) carregar();
});

carregar();
