// Partes compartilhadas pelo popup e pelos módulos de cada loja (lojas/<loja>.js).
// É um módulo ES, sem acesso à página (só funções puras), para poder ser testado sozinho.

export const formatarReais = (n) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const formatarData = (iso) => new Date(iso + "T00:00:00").toLocaleDateString("pt-BR");

// Soma o valor das compras por ano: { "2024": 123.4, "2025": 50 }. Compras sem data ficam de fora.
export function totalPorAno(compras) {
  const anos = {};
  for (const compra of compras) {
    if (!compra.data) continue;
    const ano = compra.data.slice(0, 4);
    anos[ano] = (anos[ano] ?? 0) + compra.valor;
  }
  return anos;
}

// A data mais antiga entre as compras ("aaaa-mm-dd"), ou null.
export function primeiraData(compras) {
  return compras.reduce((menor, c) => (c.data && (!menor || c.data < menor) ? c.data : menor), null);
}

// O que a página de uma loja deve mostrar. Cada loja devolve um "estado" com uma destas formas:
//   { tipo: "ativar",   mensagem }   falta o usuário liberar o acesso ao site da loja
//   { tipo: "mensagem", mensagem }   não há o que listar (ainda buscando, deslogado, erro, vazio)
//   { tipo: "dados",    dados }      dados prontos para mostrar, no formato descrito abaixo
//
// Formato de "dados" (é o que o popup e o resumo geral entendem, para qualquer loja):
//   { total, compras: [{ itens, quantidade, valor, data, presente? }], porAno: { "2024": valor },
//     primeiraData, cartoes: [{ rotulo, valor, detalhe? }], avisos: [texto], atualizadoEm }

// Estado de uma loja "externa" (que exige permissão e é atualizada pelo background.js).
// "dados" é o que o background guardou em chrome.storage.local.lojas.<id>; "normalizar" é a
// função da loja que transforma esses dados no formato acima.
export function estadoDeLojaExterna(loja, dados, permitido, negada, normalizar) {
  if (!permitido) {
    return { tipo: "ativar", mensagem: negada ? "Sem essa permissão eu não consigo ler os seus pedidos." : "" };
  }
  if (!dados) {
    return { tipo: "mensagem", mensagem: `Buscando seus pedidos na ${loja.nome}...` };
  }
  if (!dados.compras) {
    // Nunca conseguimos buscar com sucesso.
    return {
      tipo: "mensagem",
      mensagem:
        dados.status === "sem-login"
          ? `Entre na sua conta da ${loja.nome} neste Chrome. A extensão tenta de novo sozinha em alguns minutos.`
          : `Não consegui buscar seus pedidos: ${dados.erro?.mensagem ?? "erro desconhecido"}`,
    };
  }
  if (dados.compras.length === 0) {
    // Algumas lojas (Epic) têm muitos jogos grátis, que não contam como compra.
    const gratis = dados.gratuitas > 0 ? ` Você resgatou ${dados.gratuitas} ${dados.gratuitas === 1 ? "jogo grátis" : "jogos grátis"}.` : "";
    return { tipo: "mensagem", mensagem: `Nenhuma compra paga encontrada na ${loja.nome}.${gratis}` };
  }

  const normalizado = normalizar(dados);
  // Se a última tentativa falhou, os dados mostrados são da última que deu certo. Mostramos a
  // hora da tentativa para o usuário ver que o botão "Atualizar" funcionou e o que fazer.
  const hora = dados.ultimaTentativa
    ? " às " + new Date(dados.ultimaTentativa).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : "";
  if (dados.status === "sem-login") normalizado.avisos.push(`não consegui atualizar${hora}: você não está logado, entre na loja e clique em Atualizar`);
  else if (dados.status === "erro") normalizado.avisos.push(`não consegui atualizar${hora}`);
  return { tipo: "dados", dados: normalizado };
}
