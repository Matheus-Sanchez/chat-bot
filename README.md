# Chat Local com LM Studio

Interface de chat para modelos carregados no LM Studio, com backend Express fazendo proxy de streaming para a API OpenAI-compatible do LM Studio.

## Requisitos

- Node.js 20 ou superior
- LM Studio com servidor HTTP ativo
- Um modelo baixado/carregado no LM Studio

Este projeto funciona em Windows e macOS. Use sempre o terminal do mesmo
ambiente onde o Node.js foi instalado:

- Windows: PowerShell ou Windows Terminal com Node instalado no Windows
- macOS: Terminal, iTerm ou outro terminal com Node instalado no macOS
- Windows + WSL: use Windows ou WSL do inicio ao fim, sem misturar os dois

Confirme no terminal em que voce vai iniciar o projeto:

```bash
node -v
npm -v
```

Se algum comando nao for encontrado, instale ou ajuste o Node.js nesse mesmo
ambiente antes de continuar.

Se o projeto foi copiado de outra maquina ou de um ambiente Windows, rode
`npm install` no macOS antes de iniciar. Dependencias nativas do frontend,
como o SWC usado pelo Vite/React, precisam do binario correto para o sistema
atual.

O endpoint esperado por padrao e:

```txt
http://127.0.0.1:1234/v1/chat/completions
```

## Configuracao

Crie um `.env` na raiz usando `.env.example` como base.

No Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

No macOS, Linux ou WSL:

```bash
cp .env.example .env
```

Para LM Studio rodando na mesma maquina do backend:

```env
LM_STUDIO_BASE_URL=http://127.0.0.1:1234
LM_STUDIO_MODEL=auto
HOST=0.0.0.0
PORT=4000
FRONTEND_HOST=0.0.0.0
FRONTEND_PORT=5173
```

`HOST` controla o backend. `FRONTEND_HOST` controla o Vite em desenvolvimento. Para acesso pela rede interna, mantenha ambos como `0.0.0.0`.

`LM_STUDIO_MODEL=auto` usa o primeiro modelo retornado por `/v1/models`. Se quiser fixar um modelo especifico, use o `id` retornado por:

No Windows PowerShell:

```powershell
curl.exe http://127.0.0.1:1234/v1/models
```

No macOS, Linux ou WSL:

```bash
curl http://127.0.0.1:1234/v1/models
```

Modelos com raciocinio podem gastar muitos tokens antes da resposta final. Por isso o padrao de `LM_STUDIO_MAX_TOKENS` e `2048`; se uma resposta terminar sem conteudo final, aumente esse valor no `.env`.

### LM Studio em outro ambiente

Quando backend e LM Studio rodam no mesmo ambiente, mantenha:

```env
LM_STUDIO_BASE_URL=http://127.0.0.1:1234
```

Se voce iniciar o backend dentro do WSL e o LM Studio estiver aberto no Windows,
`127.0.0.1` pode apontar para o WSL, nao para o Windows. Nesse caso, prefira
rodar tambem o backend pelo PowerShell/Windows Terminal. Se precisar usar WSL,
troque `LM_STUDIO_BASE_URL` pelo IP do host Windows acessivel a partir do WSL.

## Rodando

Execute os comandos na raiz do repositorio:

```bash
npm install
npm run dev
```

Os comandos acima sao os mesmos em Windows PowerShell, macOS, Linux e WSL.

### Desenvolvimento

No modo desenvolvimento, o backend e o frontend rodam em portas separadas. Abra
o frontend do Vite:

- Frontend local: `http://localhost:5173`
- Frontend na rede: use o endereco `Network` exibido pelo Vite, por exemplo `http://192.168.1.50:5173`
- Backend/API: `http://localhost:4000`

O painel lateral da interface tambem mostra os links locais e de rede
retornados pelo backend, facilitando abrir o chat por outro computador ou
celular na mesma rede.

Se o `npm run dev` falhar com erro de `concurrently`, rode os dois processos em terminais separados:

```bash
npm run dev:backend
```

```bash
npm run dev:frontend
```

No modo desenvolvimento, o endereco `http://localhost:4000` e apenas a API/backend. A interface fica em `http://localhost:5173` e chama a API pelo proxy do Vite.

### Servindo tudo pelo backend

Para usar o Mac como servidor unico de backend, frontend e ponte com o LM
Studio, rode:

```bash
npm run serve
```

Esse comando roda o build do frontend e inicia o backend. Depois acesse
`http://IP-DA-MAQUINA:4000`. Nesse modo, o backend entrega a interface React
gerada em `packages/frontend/dist`, entao nao e necessario abrir a porta `5173`
para outros dispositivos.

Se iniciar apenas `npm start` sem existir `packages/frontend/dist`, o backend
mostra uma pagina simples com os links esperados do frontend em desenvolvimento
e da API.

No macOS, se o Vite exibir apenas `Local`, confirme que o `.env` tem `FRONTEND_HOST=0.0.0.0` e que o Firewall do macOS permite conexoes para o Node.js. As maquinas tambem precisam estar na mesma rede, sem isolamento de clientes no roteador.

### Resumo por sistema

Windows PowerShell:

```powershell
Copy-Item .env.example .env
npm install
npm run dev
```

macOS:

```bash
cp .env.example .env
npm install
npm run dev
```

WSL:

```bash
cp .env.example .env
npm install
npm run dev
```

No WSL, lembre de instalar o Node dentro do WSL. Se o LM Studio estiver no
Windows, veja a observacao sobre `LM_STUDIO_BASE_URL` na secao de configuracao.

## Verificacoes

```bash
npm run lint
npm test
npm run test:lmstudio
```

`npm run test:lmstudio` conversa com o LM Studio real em `LM_STUDIO_BASE_URL`.

## Endpoints

- `GET /health`: status do backend e conectividade com o LM Studio
- `GET /api/network`: links locais e de rede do frontend/backend
- `GET /models`: modelos LLM locais baixados no LM Studio e modelo ativo
- `POST /models/load`: valida a selecao de um modelo local sem carrega-lo imediatamente
- `GET /queue`: estado da fila de mensagens aguardando o LM Studio
- `POST /chat`: streaming SSE de chat

O backend processa apenas uma mensagem por vez no LM Studio. Requisicoes simultaneas ficam em fila e o stream envia eventos `status` para a interface mostrar quando a mensagem esta aguardando, preparando o modelo, raciocinando ou recebendo a resposta.

## Troca de modelo pela interface

A interface mostra os modelos LLM locais retornados por `http://127.0.0.1:1234/api/v1/models`. Ao selecionar outro modelo, a escolha fica salva no navegador do usuario e e enviada junto com a proxima mensagem.

Quando a mensagem chega na vez dela na fila, o backend descarrega os modelos LLM carregados no LM Studio, carrega o modelo solicitado por aquela mensagem e so entao envia o prompt. Assim, a troca de modelo de um usuario nao interrompe outro processamento em andamento.

## Windows/NVIDIA e Mac

O app nao depende diretamente de CUDA, Metal ou GPU. Quem usa o hardware e o LM Studio. Para trocar de Windows/NVIDIA para Mac, normalmente basta instalar Node, abrir o LM Studio no Mac, carregar um modelo e manter `LM_STUDIO_BASE_URL=http://127.0.0.1:1234` quando backend e LM Studio estiverem na mesma maquina.
