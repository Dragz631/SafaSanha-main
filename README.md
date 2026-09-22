# SafaSanha (LogiScan) - Entregas & Zap 📦🚀

Aplicativo web mobile-first para triagem, leitura rápida de código de barras, OCR de etiquetas com Inteligência Artificial (Google Gemini) e disparo ágil de mensagens de entrega para WhatsApp.

---

## 📋 Índice
- [Visão Geral e Recursos](#-visão-geral-e-recursos)
- [Pré-requisitos e Variáveis de Ambiente](#-pré-requisitos-e-variáveis-de-ambiente)
- [Como Instalar no TrueNAS SCALE](#-como-instalar-no-truenas-scale)
  - [Opção 1: TrueNAS SCALE 24.10+ (Electric Eel) com Docker Compose (Recomendado)](#opção-1-truenas-scale-2410-electric-eel-com-docker-compose-recomendado)
  - [Opção 2: TrueNAS SCALE via Linha de Comando (SSH / Dockge / Portainer)](#opção-2-truenas-scale-via-linha-de-comando-ssh--dockge--portainer)
- [Como Instalar no TrueNAS CORE (FreeBSD Jail)](#-como-instalar-no-truenas-core-freebsd-jail)
- [Execução Local / Desenvolvimento](#-execução-local--desenvolvimento)
- [Dica Importante: Câmera do Celular & HTTPS](#-dica-importante-câmera-do-celular--https)
- [Estrutura de Arquivos](#-estrutura-de-arquivos)
- [Endpoints da API](#-endpoints-da-api)

---

## ✨ Visão Geral e Recursos

- 📸 **OCR de etiquetas por IA (opcional):** endpoint com Google Gemini Vision disponível; ainda sem botão na interface (decisão de produto pendente).
- 💬 **Integração com WhatsApp:** Gera modelos de mensagem prontos para moradores/recebedores.
- 🗂️ **Organização por Rua → Nº → destino → unidade:** número igual não significa condomínio; só agrupa com evidência explícita (Apto, Bloco, Casa 2, Condomínio X, Loja ABC…) e pede confirmação quando há dúvida.
- 🧠 **Memória operacional por destino:** lembra locais, moradores por unidade e quem já recebeu — apenas sugere; a entrega registra quem recebeu de fato.
- 💾 **Dados no aparelho:** o app funciona sozinho — pacotes, memória de destinos e histórico ficam no `localStorage` do celular (não há API de dados nem dependência de outro servidor). Se o aparelho ficar sem espaço, o app avisa em vermelho.
- 🐳 **Pronto para Docker:** Imagem enxuta baseada em Node 22 Alpine, pronta para deploy em TrueNAS, servidores Linux ou nuvem.

---

## 🔑 Pré-requisitos e Variáveis de Ambiente

Antes de iniciar, você precisará de uma **chave de API do Google Gemini** para habilitar o OCR por IA:
1. Acesse o [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Crie ou copie sua chave de API gratuita.

### Variáveis configuráveis:
| Variável | Padrão | Descrição |
| :--- | :--- | :--- |
| `GEMINI_API_KEY` | *(Opcional — só o OCR)* | Chave de API do Gemini para extração de texto de etiquetas. |
| `PORT` | `3000` | Porta TCP em que o servidor web irá rodar. |
| `NODE_ENV` | `production` | Modo de execução (`production` para servidor compilado). |

---

## 🖥️ Como Instalar no TrueNAS SCALE

O **TrueNAS SCALE** (baseado em Linux/Debian) é a plataforma ideal para rodar o SafaSanha através de containers Docker.

---

### Opção 1: TrueNAS SCALE 24.10+ (Electric Eel) com Docker Compose (Recomendado)

O TrueNAS SCALE 24.10+ suporta nativamente **Docker Compose** diretamente na interface web de **Apps**.

#### Passo 1: Transferir a pasta do SafaSanha para o TrueNAS
Copie a pasta do projeto para um Dataset do seu pool no TrueNAS (por exemplo via SMB, NFS ou SSH / SFTP):
```
/mnt/seu-pool/apps/safasanha/
```

#### Passo 2: Criar o App na Interface do TrueNAS SCALE
1. No menu lateral do TrueNAS, clique em **Apps**.
2. Clique no botão **Discover Apps** (ou **Custom App** / **Install via Docker Compose**).
3. Defina um nome para a aplicação (ex: `safasanha`).
4. Se o TrueNAS solicitar o arquivo Compose, cole o conteúdo do [`docker-compose.yml`](docker-compose.yml):

```yaml
version: '3.8'

services:
  safasanha:
    container_name: safasanha
    build:
      context: /mnt/seu-pool/apps/safasanha
      dockerfile: Dockerfile
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - GEMINI_API_KEY=sua_chave_gemini_aqui
```

5. Clique em **Install** / **Save**. O TrueNAS irá construir o container e iniciar o SafaSanha automaticamente.
6. Acesse no navegador: `http://IP_DO_SEU_TRUENAS:3000`.

---

### Opção 2: TrueNAS SCALE via Linha de Comando (SSH / Dockge / Portainer)

Se você utiliza acesso SSH ou gerenciadores como **Dockge** ou **Portainer** no TrueNAS:

1. Acesse o terminal do seu TrueNAS via SSH:
   ```bash
   ssh root@IP_DO_TRUENAS
   ```
2. Navegue até o diretório onde colocou o projeto:
   ```bash
   cd /mnt/seu-pool/apps/safasanha
   ```
3. Crie ou edite o arquivo `.env`:
   ```bash
   cp .env.example .env
   nano .env
   ```
   *Preencha o campo `GEMINI_API_KEY` com sua chave do Google Gemini e salve (`Ctrl+O`, `Enter`, `Ctrl+X`).*

4. Inicie o container com Docker Compose:
   ```bash
   docker compose up -d --build
   ```
5. Para verificar se está rodando:
   ```bash
   docker compose ps
   docker compose logs -f
   ```

---

## 🏛️ Como Instalar no TrueNAS CORE (FreeBSD Jail)

No **TrueNAS CORE** (baseado em FreeBSD), a execução é feita dentro de uma **Jail (iocage)** utilizando Node.js e PM2.

### Passo 1: Criar a Jail
1. Na interface do TrueNAS CORE, vá em **Jails** e clique em **Add**.
2. Nome da Jail: `safasanha`
3. Tipo: **Default (VNET / DHCP)** ou configure um IP fixo na sua rede.
4. Salve e inicie a Jail.

### Passo 2: Instalar o Node.js e Git na Jail
Abra a Shell da Jail (via interface do TrueNAS ou `iocage console safasanha`) e execute:
```sh
pkg update && pkg upgrade -y
pkg install -y node22 npm git
```

### Passo 3: Baixar/Copiar o SafaSanha
Dentro da Jail, crie o diretório da aplicação:
```sh
mkdir -p /usr/local/www/safasanha
cd /usr/local/www/safasanha
```
Copie os arquivos do projeto para essa pasta ou faça um `git clone`.

### Passo 4: Instalar dependências e compilar
```sh
npm install
cp .env.example .env
# Edite o .env com seu GEMINI_API_KEY
npm run build
```

### Passo 5: Rodar com PM2 (Inicialização automática no Boot)
Instale o gerenciador de processos PM2:
```sh
npm install -g pm2
pm2 start dist/server.cjs --name safasanha
pm2 startup
pm2 save
```
O serviço agora iniciará automaticamente sempre que a Jail ou o TrueNAS for reiniciado.

---

## 💻 Execução Local / Desenvolvimento

### Com Node.js direto:
1. Instale as dependências:
   ```bash
   npm install
   ```
2. Copie o arquivo de variáveis:
   ```bash
   cp .env.example .env
   ```
3. Inicie em modo de desenvolvimento (com hot-reload):
   ```bash
   npm run dev
   ```
4. Para compilar e rodar em modo de produção:
   ```bash
   npm run build
   npm start
   ```

---

## 📱 Dica Importante: Câmera do Celular & HTTPS

> [!IMPORTANT]
> **Segurança de Navegadores Mobile (Chrome, Safari, Firefox):**
> Os navegadores modernos **bloqueiam o acesso à câmera** (`navigator.mediaDevices.getUserMedia`) quando o site é acessado via `http://` com endereço IP (ex: `http://192.168.1.100:3000`). O acesso à câmera só é liberado em `localhost` ou conexões com **HTTPS**.

### Como resolver facilmente no seu TrueNAS:
1. **Tailscale (Mais fácil):**
   - Instale o App do **Tailscale** no TrueNAS e nos celulares dos entregadores.
   - Ative o **Tailscale HTTPS (MagicDNS / Certs)**. O aplicativo funcionará em `https://seunas.tailnet-name.ts.net:3000` com certificado SSL válido e câmera habilitada em qualquer lugar.
2. **Proxy Reverso com SSL (Nginx Proxy Manager / Traefik / Caddy):**
   - No TrueNAS, instale o **Nginx Proxy Manager** ou **Caddy**.
   - Aponte um domínio (ex: `entregas.suaempresa.com.br`) para o IP do container na porta `3000` com certificado SSL gratuito Let's Encrypt gerado automaticamente.
3. **Cloudflare Tunnel:**
   - Crie um túnel seguro e gratuito via Cloudflare apontando para o seu TrueNAS na porta `3000`.

---

## 📁 Estrutura de Arquivos

```
SafaSanha/
├── public/                # Manifest PWA
├── src/
│   ├── domain/            # Inteligência de endereço e memória (puro e testado):
│   │                      #   endereco, destino, memoria, agrupamento, cadastro, entrega, ruas
│   ├── state/             # Contexto React da memória operacional
│   ├── components/        # Telas e modais (Ruas, Resumo, Associação, entrega, WhatsApp)
│   ├── utils/             # WhatsApp, fotos, histórico, persistência com falha visível
│   ├── data/              # Ruas/áreas do Caju (configuração regional)
│   └── App.tsx
├── server.ts              # Express: serve o app + OCR opcional (Gemini)
├── Dockerfile · docker-compose.yml
└── README.md
```

### Testes e verificação

```bash
npm test        # Vitest: regras de endereço, destino, memória, agrupamento e transições de entrega
npm run lint    # tsc --noEmit
npm run build   # build de produção
```

---

## 🔌 Endpoints da API

- **`GET /api/health`** — `{"status":"ok","time":"..."}` (usado pelo healthcheck do Docker).
- **`POST /api/ocr-gemini`** — recebe a imagem base64 da etiqueta e devolve os dados extraídos pelo Gemini. Opcional e **sem autenticação**: exponha apenas em rede confiável.

O app não usa mais nenhuma API de dados: o Street funciona sozinho.

---

Feito com 💚 para logística e entregas ágeis!
