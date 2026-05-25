# Chat Local com LM Studio

Interface de chat para modelos carregados no LM Studio, com backend Express fazendo proxy de streaming para a API OpenAI-compatible do LM Studio.

## Requisitos

- Node.js 20 ou superior
- LM Studio com servidor HTTP ativo
- Um modelo baixado/carregado no LM Studio

Confirme no mesmo terminal em que voce vai iniciar o projeto:

```bash
node -v
npm -v
```

Se estiver usando Windows + WSL, use um ambiente de cada vez: PowerShell/Windows Terminal com Node no PATH do Windows, ou WSL com Node instalado dentro do WSL.

O endpoint esperado por padrao e:

```txt
http://127.0.0.1:1234/v1/chat/completions
```

## Configuracao

Crie um `.env` na raiz usando `.env.example` como base.

Para LM Studio rodando na mesma maquina do backend:

```env
LM_STUDIO_BASE_URL=http://127.0.0.1:1234
LM_STUDIO_MODEL=auto
HOST=0.0.0.0
PORT=4000
```

`LM_STUDIO_MODEL=auto` usa o primeiro modelo retornado por `/v1/models`. Se quiser fixar um modelo especifico, use o `id` retornado por:

```bash
curl http://127.0.0.1:1234/v1/models
```

Modelos com raciocinio podem gastar muitos tokens antes da resposta final. Por isso o padrao de `LM_STUDIO_MAX_TOKENS` e `2048`; se uma resposta terminar sem conteudo final, aumente esse valor no `.env`.

## Rodando

Execute os comandos na raiz do repositorio:

```bash
npm install
npm run dev
```

No modo desenvolvimento, abra o frontend do Vite:

- Frontend: `http://localhost:5173`
- Backend/API: `http://localhost:4000`

Se o `npm run dev` falhar com erro de `concurrently`, rode os dois processos em terminais separados:

```bash
npm run dev:backend
```

```bash
npm run dev:frontend
```

No modo desenvolvimento, o endereco `http://localhost:4000` e apenas a API/backend. A interface fica em `http://localhost:5173`.

Para acessar de outra maquina na rede, abra o endereco de rede exibido pelo Vite. Se quiser servir a interface pelo proprio backend, gere o build antes:

```bash
npm run build
npm start
```

Depois acesse `http://IP-DA-MAQUINA:4000`.

## Verificacoes

```bash
npm run lint
npm test
npm run test:lmstudio
```

`npm run test:lmstudio` conversa com o LM Studio real em `LM_STUDIO_BASE_URL`.

## Endpoints

- `GET /health`: status do backend e conectividade com o LM Studio
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
