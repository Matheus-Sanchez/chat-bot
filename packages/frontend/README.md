# Frontend

Interface React/Vite do chat local. Em desenvolvimento, as chamadas relativas para `/chat`, `/health`, `/models` e `/api` sao encaminhadas para `http://127.0.0.1:4000` pelo proxy do Vite.

O servidor de desenvolvimento escuta em `0.0.0.0` por padrao, entao o Vite deve exibir um endereco `Network` para acesso pela rede interna. No macOS, tambem e permitido o host Bonjour `.local`, como `http://MacBook.local:5173`.
