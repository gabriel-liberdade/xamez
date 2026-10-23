# Testar o Xamez no Linux Mint

O Xamez atual é escrito em **TypeScript**, com **React** na interface. Depois de compilado, o navegador executa JavaScript; o motor óptico roda no próprio computador, em segundo plano. Não é necessário instalar Python.

Esta versão ainda **não é um instalador .deb ou AppImage**. Você baixa o projeto uma vez e o abre com um comando. A primeira instalação e as atualizações precisam de internet; o uso normal depois disso funciona sem internet, com o processo local em execução.

O roteiro abaixo foi preparado para Linux Mint com Firefox ou Chromium atualizado. Build e execução foram verificados em Linux x64 com Node 24; não houve teste direto em uma instalação de Mint neste ambiente.

## 1. Abrir o terminal e preparar o computador

Pressione **Ctrl + Alt + T**. Copie um bloco por vez para o terminal e pressione Enter.

```bash
sudo apt update
sudo apt install -y git curl ca-certificates xz-utils
```

O Mint pode pedir sua senha. Os caracteres não aparecem ao digitar no terminal; isso é normal.

## 2. Instalar o Node.js 24

O Node serve para preparar e iniciar o app. O NVM instala a versão adequada no seu usuário; o `nodejs` padrão dos repositórios de algumas versões do Mint pode ser antigo para o Xamez.

Baixe o instalador da versão identificada do NVM, a partir do repositório oficial, e execute-o:

```bash
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.8/install.sh -o /tmp/xamez-instalar-nvm.sh
bash /tmp/xamez-instalar-nvm.sh
```

Carregue o NVM neste terminal e instale o Node:

```bash
. "$HOME/.nvm/nvm.sh"
nvm install 24
node --version
npm --version
```

O primeiro número da versão do Node deve ser **24**, por exemplo `v24.x.x`. O npm também deve mostrar uma versão. Se você já tem NVM instalado, basta carregar o arquivo e executar `nvm install 24`.

## 3. Baixar o Xamez

A versão executável está na branch **feat/mvp-optical-simulator**, associada ao [PR #1](https://github.com/gabriel-liberdade/xamez/pull/1). A `main` ainda não deve ser usada para este roteiro enquanto o PR não for integrado.

```bash
cd ~
git clone --branch feat/mvp-optical-simulator https://github.com/gabriel-liberdade/xamez.git
cd xamez
nvm use
npm ci
```

Se a pasta `~/xamez` já existe, use a seção **Atualizar** abaixo em vez de repetir o clone. Não é preciso apagar a pasta.

`npm ci` instala as dependências e pode demorar na primeira vez. Aguarde terminar e o terminal voltar a aceitar comandos. Não use `sudo npm`.

## 4. Iniciar e abrir

Dentro da pasta `xamez`:

```bash
npm start
```

Esse comando verifica os tipos, gera o aplicativo e inicia a versão de produção no endereço local:

**http://127.0.0.1:4173**

Abra esse endereço no Firefox ou Chromium. O terminal deve mostrar que o endereço está disponível. Mantenha o terminal aberto enquanto usa o Xamez. Para encerrar, volte ao terminal e pressione **Ctrl + C**.

O serviço escuta somente no próprio computador. Não é necessário criar uma conta nem enviar seus projetos para um servidor externo. O navegador precisa desse endereço HTTP local para carregar os módulos e o Worker; abrir `index.html` por duplo clique não substitui essa etapa.

## 5. Roteiro rápido de teste visual

1. Abra o exemplo **Seu sistema · focais 8 / 14 mm** no seletor Experimento. Deve aparecer o indicador de **lentes finas aproximadas**, a tela a **90 mm**, o conjugado **210 mm** e a magnificação **−14×**.
2. Com a fenda selecionada, altere sua largura entre **0,1 / 0,3 / 0,5 / 1 mm** e digite uma altura. O traçado e os resultados devem atualizar. **Desfazer** deve restaurar a edição anterior.
3. Clique em **Posicionar tela no conjugado**. A distância após a projetora deve passar de **90 para 210 mm**. Isso é uma referência do modelo ideal; não caracteriza as suas lentes físicas.
4. Abra **Análises** e percorra tela/fluxo, footprint, manchas, perdas, paraxial e aberração. A aba de aberração deve explicar sua indisponibilidade no modo ideal; use o exemplo de superfícies reais para essa análise.
5. Em **Projeto → Editar JSON**, confira os valores. Cancele. Em **Salvar projeto**, baixe o JSON; depois use **Projeto → Importar JSON** para reabri-lo.
6. Carregue os exemplos **Espelho** e **Placa inclinada**. Confira o caminho dobrado e o feixe deslocado. Volte para a montagem e selecione Fonte/Elemento para conferir os controles.
7. Use **Refinar** para aumentar a quantidade de raios. A prévia usa até 5.000; o refinamento começa configurado para 100.000. Percentuais/mapas dependem da fonte, da amostragem e do modelo, e não precisam coincidir entre projetos diferentes.

Exporte os projetos que quiser guardar como arquivos JSON. O autosave depende do navegador e do endereço usado; mudar entre `localhost` e `127.0.0.1`, trocar navegador ou limpar seus dados cria outro contexto de armazenamento. Use sempre o endereço acima para este roteiro.

## Abrir novamente em outro dia

```bash
cd ~/xamez
. "$HOME/.nvm/nvm.sh"
nvm use
npm start
```

Depois abra **http://127.0.0.1:4173**. Não precisa repetir o download nem `npm ci` a cada abertura.

## Atualizar para o próximo commit

Encerre o app com **Ctrl + C** no terminal em que ele está rodando. Em seguida:

```bash
cd ~/xamez
. "$HOME/.nvm/nvm.sh"
git switch feat/mvp-optical-simulator
git pull --ff-only
nvm install
npm ci
npm start
```

Para saber qual versão está testando, em outro terminal:

```bash
cd ~/xamez
git log -1 --oneline
```

O hash inicial deve corresponder ao commit informado na entrega. Se `git pull` avisar que alterações locais seriam sobrescritas, pare e preserve esses arquivos; não use `git reset --hard` para contornar isso.

## Se algo não abrir

- **`node` ou `npm`: comando não encontrado:** execute `. "$HOME/.nvm/nvm.sh"` e `nvm use` dentro da pasta `xamez`.
- **Versão de Node incompatível:** dentro da pasta, execute `nvm install` e `nvm use`. A `.nvmrc` recomenda a versão 24.
- **`package.json` não encontrado:** volte à pasta com `cd ~/xamez`.
- **Porta 4173 em uso:** procure o terminal do Xamez que já está aberto e use Ctrl+C antes de iniciar outra cópia.
- **Navegador não conecta:** confirme que `npm start` ainda está rodando e que está usando exatamente `http://127.0.0.1:4173`.
- **`npm ci` falha ao baixar pacotes:** confira a conexão e copie a mensagem do erro. Não é necessário desativar a verificação TLS ou usar `sudo npm`.

Para relatar um problema, informe: versão do Mint, navegador, saída de `node --version`, hash de `git log -1 --oneline`, o que fez e a mensagem apresentada. Se o problema depender de uma montagem, inclua o JSON exportado.

## Verificação automatizada opcional

Para usar o app normalmente, os testes automatizados não são necessários. Para verificar o núcleo e a compilação:

```bash
npm test
npm run build
```

Os testes de interface Playwright exigem um navegador de teste separado. As instruções estão no README; isso não é requisito para abrir o Xamez no Firefox do Mint.
