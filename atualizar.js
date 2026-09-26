// Roda em qualquer página da loja e mantém o resumo de gastos atualizado sem você precisar
// abrir o histórico de compras: baixa a página de histórico em segundo plano, calcula
// e guarda. As funções de cálculo vêm do resumo.js, carregado antes.

// Não atualiza mais de uma vez a cada 15 minutos, para não ficar pedindo a página à Steam
// a cada clique.
const INTERVALO_ATUALIZACAO_MS = 15 * 60 * 1000;

// Se não existe um resumo utilizável guardado (primeira vez, ou resumo de uma versão antiga),
// não faz sentido esperar tanto: tentamos de novo em 1 minuto. Ainda assim há uma espera,
// para não ficar pedindo a página a cada clique caso algo esteja falhando (deslogado, por exemplo).
const INTERVALO_SEM_RESUMO_MS = 60 * 1000;

// Deixa o resultado na tag <html> (atributo data-gastos-status) para dar para conferir o que
// aconteceu inspecionando a página, já que este script trabalha em silêncio.
const registrarStatus = (texto) => {
  document.documentElement.dataset.gastosStatus = texto;
};

async function atualizarEmSegundoPlano() {
  // Na página de histórico quem cuida disso é o gastos.js.
  if (location.pathname.startsWith("/account/history")) return;

  const { ultimaTentativa, resumo: resumoAtual } = await chrome.storage.local.get([
    "ultimaTentativa",
    "resumo",
  ]);
  // Um resumo de outra versão (guardado por uma versão antiga da extensão) não serve: trata
  // como se não existisse, para refazer logo.
  const resumoValido = resumoAtual?.versao === VERSAO_RESUMO;
  const intervalo = resumoValido ? INTERVALO_ATUALIZACAO_MS : INTERVALO_SEM_RESUMO_MS;
  if (ultimaTentativa && Date.now() - ultimaTentativa < intervalo) {
    const minutos = Math.round((Date.now() - ultimaTentativa) / 60000);
    registrarStatus(
      `aguardando: última tentativa há ${minutos} min` +
        (resumoValido ? "" : " (resumo ausente ou desatualizado)")
    );
    return;
  }

  // Marcamos a tentativa ANTES de baixar. Assim, se der erro ou você abrir várias abas
  // ao mesmo tempo, não repetimos o pedido em seguida.
  await chrome.storage.local.set({ ultimaTentativa: Date.now() });

  // Como estamos numa página da própria loja, o fetch já leva os seus cookies de login.
  const resposta = await fetch("/account/history/", { credentials: "include" });
  if (!resposta.ok) {
    registrarStatus(`erro: a Steam respondeu ${resposta.status}`);
    return;
  }

  // DOMParser transforma o texto HTML em um documento que podemos consultar com
  // querySelector, sem abrir a página.
  const doc = new DOMParser().parseFromString(await resposta.text(), "text/html");

  // Sem tabela: você não está logado (a Steam devolveu a tela de login). Não mexe em nada.
  if (!doc.querySelector(".wallet_table_row")) {
    registrarStatus("sem dados: você está logado na Steam?");
    return;
  }

  // Se existem mais transações além da primeira leva, o resumo ficaria incompleto e
  // sobrescreveria um resumo bom. Nesse caso deixamos para o gastos.js, que clica em
  // "Carregar mais" quando você abre o histórico.
  if (temMaisTransacoes(doc)) {
    registrarStatus("histórico grande: abra o histórico de compras para atualizar");
    return;
  }

  const resumo = { ...calcular(doc), atualizadoEm: new Date().toISOString() };
  await chrome.storage.local.set({ resumo });
  registrarStatus(
    resumo.idiomaNaoSuportado
      ? "idioma da conta não suportado (só português do Brasil)"
      : `atualizado em ${resumo.atualizadoEm}`
  );
}

atualizarEmSegundoPlano().catch((erro) => {
  console.error("Falha ao atualizar os gastos:", erro);
  registrarStatus(`falha: ${erro.message}`);
});
