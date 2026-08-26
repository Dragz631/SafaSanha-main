export const PYTHON_STREAMLIT_CODE = `import streamlit as st
import cv2
import numpy as np
from PIL import Image
from pyzbar import pyzbar
import uuid
import datetime
import json
import base64

# ---------------------------------------------------------
# CONFIGURAÇÃO DA PÁGINA (Interface Streamlit Multi-Aba)
# ---------------------------------------------------------
st.set_page_config(
    page_title="LogiScan - Sistema Completo de Logística (Passos 1, 2 e 3)",
    page_icon="📦",
    layout="wide",
)

# Inicialização de variáveis de estado
if "entregas" not in st.session_state:
    st.session_state["entregas"] = [
        {
            "id_entrega": "del_001",
            "codigo_pacote": "JT100200300BR",
            "recebedor_tipo": "proprio_morador",
            "recebedor_detalhes": "Maria Silva",
            "endereco_rua": "Rua Carlos Seidl",
            "endereco_numero": "120",
            "data_hora": "2026-07-24 14:10:00",
            "status": "pendente_baixa",
            "foto_pacote_path": "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d",
            "foto_local_path": "https://images.unsplash.com/photo-1513694203232-719a280e022f"
        },
        {
            "id_entrega": "del_hist_001",
            "codigo_pacote": "JT887766554BR",
            "recebedor_tipo": "proprio_morador",
            "recebedor_detalhes": "Fernanda Oliveira",
            "endereco_rua": "Rua das Flores",
            "endereco_numero": "105",
            "data_hora": "2026-07-23 11:15:00",
            "status": "concluido",
            "foto_pacote_path": "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d",
            "foto_local_path": "https://images.unsplash.com/photo-1513694203232-719a280e022f"
        }
    ]

st.title("🚚 LogiScan - Plataforma de Logística")
st.caption("Módulos: Passo 1 (Coleta) | Passo 2 (Geofencing & Robô) | Passo 3 (Histórico & Provas Anti-Acareação)")

# Navegação Principal
aba1, aba2, aba3 = st.tabs([
    "📱 PASSO 1: Coleta Mobile", 
    "🤖 PASSO 2: Geofencing & Robô", 
    "📅 PASSO 3: Histórico & Prova Anti-Acareação"
])

# ---------------------------------------------------------
# ABA 1: COLETA MOBILE (PASSO 1)
# ---------------------------------------------------------
with aba1:
    st.subheader("Coleta de Entrega pelo Entregador")
    st.info("Capture a foto do pacote e do local para registrar o par de evidências.")
    col_p, col_l = st.columns(2)
    with col_p:
        f_p = st.file_uploader("Foto do Pacote / Etiqueta", type=["jpg", "png"], key="f_p")
    with col_l:
        f_l = st.file_uploader("Foto do Local / Fachada", type=["jpg", "png"], key="f_l")

    codigo_p = st.text_input("Código do Pacote:", placeholder="Ex: JT123456789BR")
    rua_p = st.text_input("Rua / Logradouro:", placeholder="Ex: Rua Carlos Seidl")
    num_p = st.text_input("Número:", placeholder="Ex: 82")
    rec_det = st.text_input("Quem recebeu (Morador/Vizinho):", placeholder="Ex: Seu Zé - Casa 52")

    if st.button("Salvar Entrega", type="primary"):
        if codigo_p and f_p and f_l:
            nova = {
                "id_entrega": str(uuid.uuid4())[:8],
                "codigo_pacote": codigo_p,
                "recebedor_tipo": "vizinho",
                "recebedor_detalhes": rec_det or "Morador",
                "endereco_rua": rua_p,
                "endereco_numero": num_p,
                "data_hora": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "status": "pendente_baixa",
                "foto_pacote_path": "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d",
                "foto_local_path": "https://images.unsplash.com/photo-1513694203232-719a280e022f"
            }
            st.session_state["entregas"].insert(0, nova)
            st.success("🎉 Entrega salva com sucesso!")
        else:
            st.error("Preencha todos os campos obrigatórios.")

# ---------------------------------------------------------
# ABA 2: PAINEL & GEOFENCING (PASSO 2)
# ---------------------------------------------------------
with aba2:
    st.subheader("Painel de Agrupamento & Disparo de Robô")
    st.write("Agrupamento de entregas por Rua e Associação com Cerca Virtual.")
    st.json(st.session_state["entregas"])

# ---------------------------------------------------------
# ABA 3: HISTÓRICO, CALENDÁRIO & PROVA ANTI-ACAREAÇÃO (PASSO 3)
# ---------------------------------------------------------
with aba3:
    st.subheader("📅 Histórico & Prova de Entrega Anti-Acareação")
    
    # 1. Busca de Emergência Anti-Acareação
    st.markdown("### 🔍 Módulo de Busca de Emergência (Anti-Acareação)")
    termo_busca = st.text_input("Buscar por Código (JT...), Nome do Cliente ou Rua:", placeholder="Digite para buscar em todo o histórico...")
    
    # 2. Seletor de Data
    col_d1, col_d2 = st.columns([2, 1])
    with col_d1:
        data_selecionada = st.date_input("Filtrar por Data Operacional:", value=datetime.date(2026, 7, 24))
    with col_d2:
        modo_manual = st.selectbox("Formato de Layout:", ["Automático (Lista se Hoje / Cards se Passado)", "Lista", "Cards / Grid"])

    data_str = data_selecionada.strftime("%Y-%m-%d")
    hoje_str = datetime.date.today().strftime("%Y-%m-%d")
    e_hoje = (data_str == "2026-07-24" or data_str == hoje_str)

    # Filtrar entregas
    lista_filtrada = st.session_state["entregas"]
    if termo_busca:
        q = termo_busca.lower()
        lista_filtrada = [
            d for d in lista_filtrada 
            if q in d["codigo_pacote"].lower() or q in d.get("recebedor_detalhes","").lower() or q in d.get("endereco_rua","").lower()
        ]
    else:
        lista_filtrada = [d for d in lista_filtrada if d["data_hora"].startswith(data_str)]

    # Determinar Modo de Exibição (REGRA DE LAYOUT DO PASSO 3)
    if modo_manual == "Lista":
        layout_cards = False
    elif modo_manual == "Cards / Grid":
        layout_cards = True
    else:
        layout_cards = not e_hoje  # Lista para HOJE, Cards para DIA PASSADO

    st.markdown(f"**Exibindo {len(lista_filtrada)} pacote(s) | Layout: {'🖼️ CARDS (Arquivo Passado)' if layout_cards else '📋 LISTA (Hoje)'}**")

    if not lista_filtrada:
        st.warning("Nenhum pacote encontrado para a busca ou data selecionada.")

    # Renderização em LISTA (Hoje)
    if not layout_cards and lista_filtrada:
        st.dataframe(lista_filtrada, use_container_width=True)

    # Renderização em CARDS DE PROVA HD (Dias Passados ou Busca)
    if layout_cards and lista_filtrada:
        for ent in lista_filtrada:
            with st.container():
                st.markdown(f"#### 📦 Pacote: {ent['codigo_pacote']} - {ent['status'].upper()}")
                c1, c2 = st.columns(2)
                with c1:
                    st.image(ent["foto_pacote_path"], caption="Foto 1: Etiqueta do Pacote", use_container_width=True)
                with c2:
                    st.image(ent["foto_local_path"], caption="Foto 2: Local da Entrega", use_container_width=True)
                
                st.write(f"• **Recebedor:** {ent.get('recebedor_detalhes', 'N/I')}")
                st.write(f"• **Endereço:** {ent.get('endereco_rua', '')}, {ent.get('endereco_numero', '')}")
                st.write(f"• **Data/Hora Exata:** {ent['data_hora']}")
                
                # Gerador de Comprovante de Entrega em PDF / Print
                st.download_button(
                    label="📄 Gerar Comprovante PDF de Prova de Entrega",
                    data=f"COMPROVANTE OFICIAL DE ENTREGA\nPacote: {ent['codigo_pacote']}\nData: {ent['data_hora']}\nRecebedor: {ent.get('recebedor_detalhes')}",
                    file_name=f"comprovante_{ent['codigo_pacote']}.txt",
                    mime="text/plain"
                )
                st.divider()
`;

export const PYTHON_MAPEADOR_CODE = `"""
LogiScan - SCRIPT 1: Mapeador de Coordenadas (PASSO 4)
Utilitário para capturar as posições (X, Y) do mouse na tela do Emulador Android.
"""

import pyautogui
import time
import sys

# Ativar trava de segurança do PyAutoGUI
pyautogui.FAILSAFE = True

print("=" * 65)
print(" 🎯 LOGISCAN — MAPEADOR DE COORDENADAS PARA O EMULADOR ANDROID")
print("=" * 65)
print(" Instruções:")
print(" 1. Abra o Emulador Android (BlueStacks, LDPlayer, Android Studio, etc).")
print(" 2. Posicione o cursor do mouse sobre o elemento desejado no app.")
print(" 3. A posição (X, Y) será exibida no terminal a cada 2 segundos.")
print(" 4. Para encerrar, mova o cursor rapidamente para o CANTO SUPERIOR ESQUERDO.")
print("=" * 65 + "\\n")

try:
    contador = 1
    while True:
        x, y = pyautogui.position()
        print(f"[{contador:02d}] 📍 Coordenadas atuais do mouse: X = {x:4d} | Y = {y:4d}")
        time.sleep(2)
        contador += 1
except pyautogui.FailSafeException:
    print("\\n🛑 Trava de segurança ativada (Mouse no canto superior esquerdo). Programa encerrado.")
except KeyboardInterrupt:
    print("\\n👋 Mapeador encerrado pelo usuário (Ctrl+C).")
`;

export const PYTHON_ROBO_CODE = `"""
LogiScan - SCRIPT 2: Robô de Baixa Automática em Emulador Android (PASSO 4)
Automatiza o envio de dados e fotos para o aplicativo de entregas (J&T / Transportadora).
"""

import pyautogui
import time
import json
import os
import cv2
import numpy as np

# ------------------------------------------------------------------------------
# ⚙️ CONFIGURAÇÕES DE SEGURANÇA E TEMPO
# ------------------------------------------------------------------------------
# Trava de segurança: mover o mouse para o CANTO SUPERIOR ESQUERDO aborta a execução!
pyautogui.FAILSAFE = True

# Pausa padrão (em segundos) entre comandos do PyAutoGUI
pyautogui.PAUSE = 0.8

# Arquivo JSON com os pacotes sincronizados da web
ARQUIVO_DADOS = "entregas_pendentes.json"

# ------------------------------------------------------------------------------
# 📍 COORDENADAS CONFIGURÁVEIS DO EMULADOR (Ajuste com mapeador_coordenadas.py)
# ------------------------------------------------------------------------------
COORD_CAMPO_BUSCA = (450, 180)       # Campo de pesquisa do pacote
COORD_ITEM_LISTA = (450, 260)        # Primeiro item retornado na pesquisa
COORD_BOTAO_FOTO_PACOTE = (350, 480) # Botão para capturar foto do pacote
COORD_BOTAO_FOTO_LOCAL = (550, 480)  # Botão para capturar foto do local
COORD_QUADRO_ASSINATURA = (450, 650) # Área do quadro para assinar
COORD_BOTAO_CONFIRMAR = (450, 780)   # Botão verde 'Finalizar / Dar Baixa'

# ------------------------------------------------------------------------------
# 🎥 INTEGRAÇÃO COM CÂMERA VIRTUAL (OBS STUDIO / WEBCAM VIRTUAL)
# ------------------------------------------------------------------------------
def atualizar_camera_virtual_obs(caminho_imagem):
    """
    Simula a injeção da imagem na câmera virtual do sistema/OBS
    para que o aplicativo do emulador capture a foto limpa em HD.
    """
    print(f" 📸 [CÂMERA VIRTUAL] Atualizando feed do OBS com imagem: {caminho_imagem}")
    # Se utilizando pyvirtualcam ou OBS WebSocket:
    # try:
    #     img = cv2.imread(caminho_imagem)
    #     # Enviar frame para o feed da webcam virtual...
    # except Exception as e:
    #     print(f" ⚠️ Alerta ao carregar imagem no OBS: {e}")
    time.sleep(1)

# ------------------------------------------------------------------------------
# 🤖 EXECUTOR DE BAIXA AUTOMÁTICA
# ------------------------------------------------------------------------------
def carregar_entregas_pendentes():
    if not os.path.exists(ARQUIVO_DADOS):
        dados_mock = [
            {
                "id_entrega": "del_001",
                "codigo_pacote": "JT100200300BR",
                "status": "pendente_baixa",
                "foto_pacote_path": "foto_pacote_001.jpg",
                "foto_local_path": "foto_local_001.jpg",
                "recebedor_detalhes": "Seu Zé - Casa 52"
            }
        ]
        with open(ARQUIVO_DADOS, "w", encoding="utf-8") as f:
            json.dump(dados_mock, f, indent=2, ensure_ascii=False)
        return dados_mock

    with open(ARQUIVO_DADOS, "r", encoding="utf-8") as f:
        return json.load(f)

def salvar_entregas(entregas):
    with open(ARQUIVO_DADOS, "w", encoding="utf-8") as f:
        json.dump(entregas, f, indent=2, ensure_ascii=False)

def executar_baixas_emulador():
    print("=" * 65)
    print(" 🤖 ROBÔ LOGISCAN DE BAIXA AUTOMÁTICA EM EMULADOR ANDROID (RPA)")
    print("=" * 65)
    print(" ⚠️ Mantenha o Emulador Android visível na tela principal.")
    print(" 🚨 PARA ABORTAR: Mova o mouse para o Canto Superior Esquerdo da tela.")
    print("=" * 65 + "\\n")

    entregas = carregar_entregas_pendentes()
    pendentes = [e for e in entregas if e.get("status") == "pendente_baixa"]

    if not pendentes:
        print(" ✅ Nenhum pacote com status 'pendente_baixa' encontrado.")
        return

    print(f" 🚀 Iniciando baixa de {len(pendentes)} pacote(s). Contagem regressiva: 5s...")
    for i in range(5, 0, -1):
        print(f" ⏱️ {i}...")
        time.sleep(1)

    for idx, pacote in enumerate(pendentes, 1):
        cod = pacote["codigo_pacote"]
        print(f"\\n---------------------------------------------------------")
        print(f" 📦 Processando Pacote [{idx}/{len(pendentes)}]: {cod}")
        print(f"---------------------------------------------------------")

        # 1. Clique no Campo de Pesquisa
        print(" 1️⃣ Clicando no campo de pesquisa...")
        pyautogui.click(COORD_CAMPO_BUSCA[0], COORD_CAMPO_BUSCA[1])
        time.sleep(0.5)

        # Limpar campo existente
        pyautogui.hotkey('ctrl', 'a')
        pyautogui.press('backspace')
        time.sleep(0.3)

        # Digitar o Código do Pacote
        print(f" 2️⃣ Digitando o código: {cod}")
        pyautogui.write(cod, interval=0.08)
        pyautogui.press('enter')
        time.sleep(2)

        # 2. Clicar no Item Pesquisado
        print(" 3️⃣ Abrindo detalhes do pacote...")
        pyautogui.click(COORD_ITEM_LISTA[0], COORD_ITEM_LISTA[1])
        time.sleep(1.5)

        # 3. Foto 1: Pacote via Câmera Virtual OBS
        atualizar_camera_virtual_obs(pacote.get("foto_pacote_path", "pacote.jpg"))
        print(" 4️⃣ Clicando para capturar Foto do Pacote...")
        pyautogui.click(COORD_BOTAO_FOTO_PACOTE[0], COORD_BOTAO_FOTO_PACOTE[1])
        time.sleep(2)

        # 4. Foto 2: Local via Câmera Virtual OBS
        atualizar_camera_virtual_obs(pacote.get("foto_local_path", "local.jpg"))
        print(" 5️⃣ Clicando para capturar Foto do Local...")
        pyautogui.click(COORD_BOTAO_FOTO_LOCAL[0], COORD_BOTAO_FOTO_LOCAL[1])
        time.sleep(2)

        # 5. Assinatura Rápida Automática (Drag and Drop)
        print(" 6️⃣ Gerando assinatura digital rápida no aplicativo...")
        sx, sy = COORD_QUADRO_ASSINATURA
        pyautogui.moveTo(sx - 40, sy)
        pyautogui.dragTo(sx + 40, sy, duration=0.4, button='left')
        pyautogui.dragTo(sx, sy - 30, duration=0.4, button='left')
        time.sleep(1)

        # 6. Clicar em Confirmar / Dar Baixa
        print(" 7️⃣ Clicando em 'FINALIZAR BAIXA'...")
        pyautogui.click(COORD_BOTAO_CONFIRMAR[0], COORD_BOTAO_CONFIRMAR[1])
        time.sleep(3)

        # 7. Atualizar Status no JSON Local
        pacote["status"] = "concluido"
        salvar_entregas(entregas)
        print(f" 🎉 [SUCESSO] Pacote {cod} finalizado e atualizado para 'concluido'!")

    print("\\n" + "=" * 65)
    print(" ✨ TODAS AS BAIXAS FORAM EXECUTADAS COM SUCESSO PELO ROBÔ!")
    print("=" * 65)

if __name__ == "__main__":
    executar_baixas_emulador()
`;

export const PYTHON_INSTRUCTIONS = `
### 🛠️ Instruções de Instalação e Execução dos Scripts RPA (PASSO 4):

1. **Instale as dependências exigidas no terminal:**
\`\`\`bash
pip install pyautogui pyobsadmin opencv-python pyvirtualcam
\`\`\`

2. **Execute o Mapeador de Coordenadas (Script 1):**
\`\`\`bash
python mapeador_coordenadas.py
\`\`\`
*Passe o mouse sobre os botões do seu emulador e anote os valores de X e Y exibidos no terminal.*

3. **Atualize as coordenadas no script \`robo_baixa_jt.py\` e execute (Script 2):**
\`\`\`bash
python robo_baixa_jt.py
\`\`\`

4. **Trava de Emergência:** Mova o mouse para o **canto superior esquerdo** da tela em qualquer momento para abortar a automação instantaneamente!
`;

