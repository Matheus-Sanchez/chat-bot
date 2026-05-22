# Chat Local com LM Studio

Interface de chat para modelos carregados no LM Studio, com backend Express fazendo proxy de streaming para a API OpenAI-compatible do LM Studio.

## Requisitos

- Node.js 20 ou superior
- LM Studio com servidor HTTP ativo
- Um modelo baixado/carregado no LM Studio

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

## Rodando

```bash
npm install
npm run dev
```

Frontend Vite: `http://localhost:5173`

Backend: `http://localhost:4000`

Para acessar de outra maquina na rede, abra o endereco de rede exibido pelo Vite ou sirva o build pelo backend:

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
- `POST /models/load`: carrega/seleciona um modelo local no LM Studio
- `POST /chat`: streaming SSE de chat

## Troca de modelo pela interface

A interface mostra os modelos LLM locais retornados por `http://127.0.0.1:1234/api/v1/models`. Ao selecionar outro modelo, o backend chama `POST /api/v1/models/load` no LM Studio e passa a usar esse modelo nas proximas respostas.

Essa selecao e global para o servidor LM Studio. Se varias pessoas estiverem usando o chat na rede, a troca de modelo feita por uma delas afeta as proximas respostas das outras.

## Windows/NVIDIA e Mac

O app nao depende diretamente de CUDA, Metal ou GPU. Quem usa o hardware e o LM Studio. Para trocar de Windows/NVIDIA para Mac, normalmente basta instalar Node, abrir o LM Studio no Mac, carregar um modelo e manter `LM_STUDIO_BASE_URL=http://127.0.0.1:1234` quando backend e LM Studio estiverem na mesma maquina.
