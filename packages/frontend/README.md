# Frontend

Interface React/Vite do chat local. Em desenvolvimento, as chamadas relativas para `/chat`, `/health`, `/models` e `/api` sao encaminhadas para `http://127.0.0.1:4000` pelo proxy do Vite.

O servidor de desenvolvimento escuta em `0.0.0.0` por padrao, entao o Vite deve exibir um endereco `Network` para acesso pela rede interna. No macOS, tambem e permitido o host Bonjour `.local`, como `http://MacBook.local:5173`.

A interface consulta `/api/network` no backend e exibe os links de acesso no
painel lateral. Em producao, use `npm run serve` na raiz para gerar o build e
servir frontend + backend pelo mesmo endereco `http://IP-DA-MAQUINA:4000`.

Se o build falhar apos copiar o projeto de Windows para macOS, rode
`npm install` na raiz para reinstalar os pacotes nativos do sistema atual.
