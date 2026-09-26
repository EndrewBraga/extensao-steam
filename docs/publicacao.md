# Guia para publicar na Chrome Web Store

Checklist e textos prontos para o painel do desenvolvedor. Os nomes dos campos mudam de tempos em tempos: confira os rótulos atuais no painel e as [políticas do programa](https://developer.chrome.com/docs/webstore/program-policies/) antes de enviar.

## Antes de enviar

- [ ] Conta de desenvolvedor criada (há uma taxa única de registro) e verificação em duas etapas ativa.
- [ ] Política de privacidade acessível por uma **URL pública**. Sugestão: o `PRIVACIDADE.md` deste repositório, com o repositório público.
- [ ] Ícone de 128 px (já existe em `icons/`), ao menos 1 captura de tela (1280x800 ou 640x400) e a descrição abaixo.
- [ ] Pacote: um `.zip` com os arquivos da extensão na raiz (`manifest.json`, `*.js`, `popup.*`, `icons/`), **sem** `.git`, `docs/` nem `*.md`. Para gerar, na pasta do projeto:

  ```bash
  powershell -ExecutionPolicy Bypass -File tools/empacotar.ps1
  ```

  O arquivo sai em `dist/gastos-para-steam-<versão>.zip`. O script lê o `manifest.json` e o `popup.html` para escolher os arquivos e usa a versão do manifest no nome. **Aumente a `version` do `manifest.json` antes de enviar uma atualização**, porque a loja recusa uma versão igual à publicada.
- [ ] Publicar primeiro como **"Não listada"** para testar com poucas pessoas.

## Identidade

- **Nome**: Gastos para Steam
- **Categoria**: Compras
- **Idioma**: Português (Brasil)
- **Resumo (até 132 caracteres)**: Mostra o preço dos jogos e um resumo dos seus gastos na loja da Steam. Não afiliada à Valve.

## Descrição detalhada

> Veja quanto você já gastou na Steam e o preço de cada jogo, sem sair da loja.
>
> **O que faz**
> - Mostra um aviso com o nome e o preço do jogo nas páginas da loja.
> - Calcula o total gasto na sua conta, já descontando reembolsos.
> - Mostra a economia com descontos, a média por compra, os presentes que você deu, o gasto por ano e o ranking das suas compras mais caras.
>
> **Privacidade**
> Tudo é calculado no seu navegador. Nenhum dado é enviado para servidores, e não há anúncios nem rastreamento. Nomes de quem recebeu seus presentes não são guardados.
>
> **Limitações**
> Funciona apenas com a Steam em português do Brasil e valores em R$. Se a Steam mudar o layout da página, alguns recursos podem parar de funcionar.
>
> *Esta extensão não é afiliada, endossada ou patrocinada pela Valve Corporation. Steam é marca registrada da Valve.*

## Finalidade única

Mostrar o preço dos jogos e um resumo dos gastos do usuário na loja da Steam.

## Justificativa das permissões

- **`storage`**: guardar localmente o resumo calculado (totais e lista de compras) para exibir no popup.
- **Acesso a `https://store.steampowered.com/*`**: ler o preço exibido nas páginas de jogos e o histórico de compras do próprio usuário, na página `/account/history/`. Não é usado em nenhum outro site.
- **Código remoto**: nenhum. Todo o código está dentro do pacote.

## Práticas de privacidade (aba do painel)

Responda de forma fiel ao que a extensão faz:

- Ela acessa **informações financeiras** (histórico de compras da própria conta) e **conteúdo do site** (páginas da loja). Marque as categorias equivalentes que o painel oferecer e explique que o processamento é **local**, sem transmissão.
- Os dados **não são vendidos**, **não são usados para finalidades sem relação** com a função da extensão e **não são usados para avaliação de crédito**. Confirme as três declarações de conformidade.
- Informe a URL da política de privacidade.

## Riscos a lembrar

- **Marca**: mantenha o "não afiliada à Valve" e não use o logo nem as imagens da Steam nas capturas de tela além do que aparece na própria página.
- **Manutenção**: se a Valve mudar as classes do HTML, a extensão quebra e precisa de ajuste. Reveja de tempos em tempos.
- **Idioma**: só português do Brasil e R$. Deixe isso claro na descrição para evitar avaliações negativas.
