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
- [Estrutura de Arquivos e Persistência](#-estrutura-de-arquivos-e-persistência)
- [Endpoints da API](#-endpoints-da-api)

---

## ✨ Visão Geral e Recursos

- 📸 **Scanner de Código de Barras e OCR com IA:** Leitura automática de etiquetas e código de pacotes via câmera ou upload com Google Gemini Vision.
- 💬 **Integração com WhatsApp:** Gera modelos de mensagem prontos para moradores/recebedores.
- 🗂️ **Organização por Rua e Lote:** Agrupamento inteligente de encomendas por endereço.
- 💾 **Persistência de Dados:** Salva e recupera as entregas registradas em arquivo JSON seguro (`data/deliveries.json`).
- 🐳 **Pronto para Docker:** Imagem enxuta baseada em Node 22 Alpine, pronta para deploy em TrueNAS, servidores Linux ou nuvem.

---

## 🔑 Pré-requisitos e Variáveis de Ambiente

Antes de iniciar, você precisará de uma **chave de API do Google Gemini** para habilitar o OCR por IA:
1. Acesse o [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Crie ou copie sua chave de API gratuita.

### Variáveis configuráveis:
| Variável | Padrão | Descrição |
| :--- | :--- | :--- |
| `GEMINI_API_KEY` | *(Obrigatório para OCR)* | Chave de API do Gemini para extração de texto de etiquetas. |
| `PORT` | `3000` | Porta TCP em que o servidor web irá rodar. |
| `NODE_ENV` | `production` | Modo de execução (`production` para servidor compilado). |
| `DATA_DIR` | `/app/data` | Diretório onde o arquivo de entregas `deliveries.json` será persistido. |

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
      - DATA_DIR=/app/data
    volumes:
      - /mnt/seu-pool/apps/safasanha/data:/app/data
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

## 📁 Estrutura de Arquivos e Persistência

```
SafaSanha/
├── data/                  # Diretório persistente de entregas (deliveries.json)
├── dist/                  # Build de produção (Vite SPA + server.cjs)
├── public/                # Manifest PWA e ícones estáticos
├── src/                   # Código fonte React + TypeScript
│   ├── components/        # Componentes visuais (Wizard de entrega, OCR, WhatsApp)
│   ├── lib/               # Motores de associação, OCR e scanner de código
│   ├── utils/             # Utilitários e helpers do WhatsApp
│   └── App.tsx            # Componente principal
├── Dockerfile             # Multi-stage Docker build
├── docker-compose.yml     # Orquestração do container para TrueNAS SCALE
├── server.ts              # Servidor Express com API Gemini OCR e rotas
├── package.json           # Dependências e scripts do projeto
├── .env.example           # Modelo de variáveis de ambiente
└── README.md              # Este guia de instalação
```

---

## 🔌 Endpoints da API

- **`GET /api/health`**
  - Retorna o status de saúde do serviço, timestamp e quantidade de entregas salvas.
  - Exemplo de resposta: `{"status": "ok", "service": "SafaSanha - LogiScan", "deliveriesCount": 12}`

- **`GET /api/deliveries`**
  - Retorna a lista de todas as entregas cadastradas no sistema.

- **`POST /api/deliveries`**
  - Cadastra ou atualiza uma entrega e salva automaticamente no arquivo `data/deliveries.json`.

- **`DELETE /api/deliveries/:id`**
  - Remove uma entrega pelo ID.

- **`POST /api/ocr-gemini`**
  - Recebe a imagem em base64 da etiqueta e retorna os dados extraídos pelo Google Gemini (código de pacote, nome do destinatário, número da casa, complemento).

---

Feito com 💚 para logística e entregas ágeis!
