// Só age em páginas de jogo (URL do tipo /app/620/Portal_2/).
if (location.pathname.startsWith("/app/")) {
  // Nome do jogo e bloco de compra do JOGO em si. A página também tem blocos de
  // conjuntos (bundles), que podem vir primeiro. Conjuntos têm um formulário
  // "add_bundle_to_cart", então pegamos o primeiro bloco que NÃO tem esse formulário.
  // (Não dá para exigir o formulário do jogo: jogos gratuitos não têm.)
  const nomeEl = document.querySelector("#appHubAppName");
  const compraEl = document.querySelector(
    '.game_area_purchase_game:not(:has(form[name^="add_bundle_to_cart"]))'
  );

  if (nomeEl && compraEl) {
    // Jogo em promoção tem preço final + desconto; sem promoção, só o preço normal.
    const precoFinalEl =
      compraEl.querySelector(".discount_final_price") ||
      compraEl.querySelector(".game_purchase_price");
    const descontoEl = compraEl.querySelector(".discount_pct");

    const nome = nomeEl.textContent.trim();
    const preco = precoFinalEl ? precoFinalEl.textContent.trim() : "preço não encontrado";
    const desconto = descontoEl ? ` (${descontoEl.textContent.trim()})` : "";

    const banner = document.createElement("div");
    banner.textContent = `${nome}: ${preco}${desconto}`;
    banner.style.background = "#1b2838";
    banner.style.color = "#66c0f4";
    banner.style.padding = "10px";
    banner.style.textAlign = "center";
    banner.style.fontWeight = "bold";
    document.body.prepend(banner);
  }
}
