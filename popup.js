import * as steam from "./lojas/steam.js";
import * as nuuvem from "./lojas/nuuvem.js";
import * as epic from "./lojas/epic.js";
import * as playstation from "./lojas/playstation.js";
import * as xbox from "./lojas/xbox.js";
import { formatarData, formatarReais } from "./lojas/comum.js";
import { resumoGeral } from "./geral.js";

// Lojas mostradas no popup, cada uma com a sua aba. Para adicionar uma: crie lojas/<loja>.js
// (veja o padrão em lojas/nuuvem.js), importe o módulo aqui, coloque na lista e cadastre o site
// em "optional_host_permissions" no manifest.json. A aba dela é criada sozinha.
const LOJAS = [steam, nuuvem, epic, playstation, xbox];

const $ = (seletor) => document.querySelector(seletor);

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

// Gráfico de barras: uma linha por item, com rótulo, barra proporcional e valor.
// "linhas" é uma lista de { rotulo, valor }.
function montarBarras(linhas) {
  const maximo = Math.max(...linhas.map((l) => l.valor), 1);

  return linhas.map(({ rotulo, valor }) => {
    const barra = document.createElement("div");
    barra.style.width = `${(Math.max(valor, 0) / maximo) * 100}%`;

    const trilho = document.createElement("div");
    trilho.className = "barra";
    trilho.append(barra);

    const nome = criar("span", rotulo);
    nome.title = rotulo; // nome completo ao passar o mouse, caso o "…" o corte

    const li = document.createElement("li");
    li.append(nome, trilho, criar("span", formatarReais(valor)));
    return li;
  });
}

// Lista de compras, da mais cara para a mais barata (serve para qualquer loja). Cada item:
// posição, nome, data e preço. Todas as linhas têm o mesmo tamanho: o nome fica em uma linha
// só (o CSS põe "…" no que não couber) e o texto completo aparece ao passar o mouse (title).
function montarRanking(ranking) {
  return ranking.map((compra, i) => {
    const nome = criar("span", compra.itens || "—", "nome");
    nome.title = compra.itens || "";

    // Compras com mais de um item (pacote, DLC, ou jogos pagos juntos no mesmo carrinho)
    // ganham a etiqueta "N itens". "quantidade" não existe em resumos de versões antigas.
    const detalhe = [
      compra.data && formatarData(compra.data),
      compra.presente && "presente",
      compra.assinatura && "assinatura",
      compra.quantidade > 1 && `${compra.quantidade} itens`,
    ]
      .filter(Boolean)
      .join(" · ");
    // Sem detalhe, usamos um espaço "invisível" (um espaço não-separável) para a linha manter a mesma altura.
    const info = document.createElement("div");
    info.className = "info";
    info.append(nome, criar("span", detalhe || " ", "sub"));

    const li = document.createElement("li");
    li.append(criar("span", String(i + 1), "posicao"), info, criar("span", formatarReais(compra.valor), "preco"));
    return li;
  });
}

// ---------------------------------------------------------------------------------------
// Página de cada loja. Todas têm o mesmo formato, e o que mostrar vem do "estado" que o
// módulo da loja devolve (veja lojas/comum.js):
//   ativar   -> botão para o usuário liberar o acesso ao site da loja (uma única vez)
//   mensagem -> um aviso (buscando, deslogado, erro, sem compras...)
//   dados    -> total, dois cartões e a lista de compras
// ---------------------------------------------------------------------------------------

const permissaoNegada = new Set(); // lojas em que o usuário recusou a permissão nesta sessão do popup

function criarPainelDaLoja(loja) {
  const aba = criar("button", loja.nome);
  aba.setAttribute("role", "tab");
  aba.setAttribute("aria-selected", "false");
  aba.dataset.aba = loja.id;
  $(".abas").append(aba);

  const partes = [];

  // Só as lojas que exigem permissão (têm "origem") ganham o bloco de ativar.
  if (loja.origem) {
    const ativar = document.createElement("div");
    ativar.dataset.parte = "ativar";
    const botao = criar("button", `Ativar ${loja.nome}`, "botao");
    botao.addEventListener("click", () => ativarLoja(loja));
    ativar.append(
      criar(
        "p",
        `Para mostrar seus gastos na ${loja.nome}, a extensão precisa ler os seus pedidos no site dela. Você só precisa liberar uma vez e pode desfazer quando quiser.`,
        "mensagem"
      ),
      botao
    );
    partes.push(ativar);
  }

  const mensagem = criar("p", "", "mensagem");
  mensagem.dataset.parte = "mensagem";
  partes.push(mensagem);

  // Bloco com os dados.
  const dados = document.createElement("div");
  dados.dataset.parte = "dados";
  const total = document.createElement("div");
  total.className = "total";
  const valorTotal = criar("span", "");
  valorTotal.dataset.parte = "total";
  total.append(criar("small", `Total gasto na ${loja.nome}`), valorTotal);
  const cards = document.createElement("div");
  cards.className = "cards";
  cards.dataset.parte = "cards";
  const lista = document.createElement("ol");
  lista.className = "lista-compras curta";
  lista.dataset.parte = "lista";
  const atualizado = criar("p", "", "nota");
  atualizado.dataset.parte = "atualizado";
  dados.append(total, cards, lista, atualizado);
  partes.push(dados);

  // Link para a página de pedidos da própria loja.
  if (loja.link) {
    const link = document.createElement("a");
    link.href = loja.link.url;
    link.target = "_blank";
    link.textContent = loja.link.texto;
    const rodape = document.createElement("p");
    rodape.className = "nota rodape-loja";
    rodape.append(link);
    partes.push(rodape);
  }

  const painel = document.createElement("div");
  painel.id = `painel-${loja.id}`;
  painel.hidden = true;
  painel.append(...partes);
  document.body.append(painel);
}

async function ativarLoja(loja) {
  // O pedido de permissão precisa vir de um clique do usuário, por isso é a primeira coisa
  // que acontece aqui. Quando ele libera, o background.js percebe (permissions.onAdded) e já
  // começa a buscar os pedidos.
  const concedida = await chrome.permissions.request({ origins: [loja.origem] });
  if (concedida) permissaoNegada.delete(loja.id);
  else permissaoNegada.add(loja.id);
  carregar();
}

// O botão "Atualizar" fica sempre no canto de cima. No Resumo ele atualiza todas as lojas; na
// aba de uma loja, só ela. Não aparece em lojas que ainda não foram ativadas.
let estadosDasLojas = new Map(); // id da loja -> { loja, estado }, preenchido em carregar()

// Toda loja tem o botão, menos as externas que ainda não foram ativadas.
const temBotaoAtualizar = ({ loja, estado }) => (loja.origem || loja.atualizaPelaPagina) && estado.tipo !== "ativar";

function ajustarBotaoAtualizar() {
  const nomeDaAba = document.querySelector("[role=tab][aria-selected=true]")?.dataset.aba ?? "resumo";
  const botao = $("#atualizar");

  if (nomeDaAba === "resumo") {
    botao.hidden = ![...estadosDasLojas.values()].some(temBotaoAtualizar);
    botao.dataset.loja = "";
  } else {
    const e = estadosDasLojas.get(nomeDaAba);
    botao.hidden = !(e && temBotaoAtualizar(e));
    botao.dataset.loja = nomeDaAba;
  }
  if (!botao.disabled) botao.textContent = nomeDaAba === "resumo" ? "Atualizar todas as lojas" : "Atualizar";
}

// Pede ao background.js para buscar agora (ele abre a loja em segundo plano, espera, busca e
// fecha a aba). Enquanto espera, o botão fica desligado. Quando os dados novos chegam, o popup
// se redesenha sozinho (chrome.storage.onChanged); aqui só religamos o botão.
async function atualizarLojas() {
  const botao = $("#atualizar");
  const id = botao.dataset.loja || undefined;
  botao.disabled = true;
  botao.textContent = "Atualizando...";
  try {
    await chrome.runtime.sendMessage({ tipo: "sincronizar-lojas", loja: id });
  } catch {
    // o background não respondeu; o estado de cada loja mostra o que houver
  }
  botao.disabled = false;
  await carregar();
}

function mostrarLoja(loja, estado) {
  const painel = $(`#painel-${loja.id}`);
  const parte = (nome) => painel.querySelector(`[data-parte=${nome}]`);

  const ativar = parte("ativar");
  if (ativar) ativar.hidden = estado.tipo !== "ativar";

  parte("mensagem").textContent = estado.mensagem ?? "";
  parte("mensagem").hidden = !estado.mensagem;
  parte("dados").hidden = estado.tipo !== "dados";
  if (estado.tipo !== "dados") return;

  const { total, compras, cartoes, atualizadoEm } = estado.dados;
  parte("total").textContent = formatarReais(total);
  parte("cards").replaceChildren(...cartoes.map((c) => criarCard(c.rotulo, c.valor, c.detalhe)));
  parte("lista").replaceChildren(...montarRanking(compras));
  parte("atualizado").textContent = "Atualizado em " + new Date(atualizadoEm).toLocaleString("pt-BR");
}

// ---------------------------------------------------------------------------------------
// Resumo geral: junta as lojas que têm dados.
// ---------------------------------------------------------------------------------------

function mostrarResumoGeral(entradas) {
  const comDados = entradas.filter((e) => e.estado.tipo === "dados");

  const mensagem = $("#resumo-mensagem");
  mensagem.textContent =
    comDados.length === 0
      ? "Ainda não há dados. Abra a loja da Steam (logado na sua conta) ou ative outra loja na aba dela."
      : "";
  mensagem.hidden = comDados.length > 0;
  $("#resumo-conteudo").hidden = comDados.length === 0;
  if (comDados.length === 0) return;

  const geral = resumoGeral(comDados.map((e) => ({ loja: e.loja, dados: e.estado.dados })));

  $("#liquido").textContent = formatarReais(geral.total);

  const cards = [
    criarCard("Compras", String(geral.quantidade), geral.primeiraData ? `desde ${formatarData(geral.primeiraData)}` : ""),
    criarCard("Média por compra", formatarReais(geral.media)),
  ];
  if (geral.maior) {
    const { itens, valor, data, loja } = geral.maior;
    const detalhe = [formatarReais(valor), data && formatarData(data), loja].filter(Boolean).join(" · ");
    cards.push(criarCard("Maior compra", itens || "—", detalhe, true));
  }
  $("#cards").replaceChildren(...cards);

  // "Por loja" só faz sentido com mais de uma loja.
  $("#lojas-titulo").hidden = geral.lojas.length < 2;
  $("#lojas-barras").hidden = geral.lojas.length < 2;
  $("#lojas-barras").replaceChildren(...montarBarras(geral.lojas.map((l) => ({ rotulo: l.nome, valor: l.total }))));

  const anos = Object.keys(geral.porAno).sort(); // do mais antigo para o mais recente
  $("#anos").replaceChildren(...montarBarras(anos.map((ano) => ({ rotulo: ano, valor: geral.porAno[ano] }))));

  // Lojas que ainda não entraram na conta, e o que fazer.
  const pendentes = entradas
    .filter((e) => e.estado.tipo !== "dados")
    .map((e) => `${e.loja.nome} (${e.estado.tipo === "ativar" ? "ative na aba dela" : "sem dados ainda"})`);
  $("#pendentes").textContent = pendentes.length > 0 ? `Ainda não incluídas: ${pendentes.join(", ")}.` : "";
  $("#pendentes").hidden = pendentes.length === 0;
}

// Mostra o painel da aba escolhida e esconde os outros. Cada aba aponta para o seu painel
// pelo atributo data-aba ("resumo" -> #painel-resumo).
function selecionarAba(nome) {
  document.querySelectorAll("[role=tab]").forEach((aba) => {
    const ativa = aba.dataset.aba === nome;
    aba.setAttribute("aria-selected", String(ativa));
    $(`#painel-${aba.dataset.aba}`).hidden = !ativa;
  });
  ajustarBotaoAtualizar();
}

async function carregar() {
  const armazenado = await chrome.storage.local.get(["resumo", "lojas"]);

  const entradas = [];
  for (const modulo of LOJAS) {
    const { LOJA } = modulo;
    // A Steam não pede permissão (não tem "origem"); as outras lojas, sim.
    const permitido = LOJA.origem ? await chrome.permissions.contains({ origins: [LOJA.origem] }) : true;
    const estado = modulo.estado(armazenado, permitido, permissaoNegada.has(LOJA.id));
    mostrarLoja(LOJA, estado);
    entradas.push({ loja: LOJA, estado });
  }
  estadosDasLojas = new Map(entradas.map((e) => [e.loja.id, e]));
  ajustarBotaoAtualizar();
  mostrarResumoGeral(entradas);
}

// As abas das lojas são criadas antes do primeiro carregar(). O clique nas abas usa delegação
// (um único ouvinte no <nav>), que também vale para as abas criadas depois.
LOJAS.forEach((modulo) => criarPainelDaLoja(modulo.LOJA));
$("#atualizar").addEventListener("click", atualizarLojas);
$(".abas").addEventListener("click", (evento) => {
  const aba = evento.target.closest("[role=tab]");
  if (aba) selecionarAba(aba.dataset.aba);
});

// Se os dados mudarem com o popup aberto (por uma página da Steam ou pelo background.js),
// ou se a permissão de uma loja mudar, redesenha.
chrome.storage.onChanged.addListener((mudancas, area) => {
  if (area === "local" && (mudancas.resumo || mudancas.lojas)) carregar();
});
chrome.permissions.onAdded.addListener(carregar);
chrome.permissions.onRemoved.addListener(carregar);

carregar();
