import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

import fs from 'fs';

interface DeliveryRecord {
  id_entrega: string;
  codigo_pacote: string;
  recebedor_tipo: string;
  recebedor_detalhes: string;
  foto_pacote_path: string;
  foto_local_path: string;
  data_hora: string;
  status: string;
  origem_leitura?: string;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DELIVERIES_FILE = path.join(DATA_DIR, 'deliveries.json');

function loadPersistedDeliveries(): DeliveryRecord[] {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DELIVERIES_FILE)) {
      const raw = fs.readFileSync(DELIVERIES_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch (err) {
    console.warn('Aviso: Falha ao ler entregas salvas em disco:', err);
  }
  return [];
}

function savePersistedDeliveries(data: DeliveryRecord[]): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DELIVERIES_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Aviso: Falha ao salvar entregas em disco:', err);
  }
}

const deliveriesStore: DeliveryRecord[] = loadPersistedDeliveries();

// Lazy initialization of Gemini API
let genAI: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI | null {
  if (!genAI && process.env.GEMINI_API_KEY) {
    genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return genAI;
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Middleware for body parsing
  app.use(express.json({ limit: '15mb' }));

  // API Routes
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // Get all registered deliveries
  app.get('/api/deliveries', (_req, res) => {
    res.json(deliveriesStore);
  });

  // Save new delivery
  app.post('/api/deliveries', (req, res) => {
    const delivery = req.body as DeliveryRecord;
    if (!delivery || !delivery.codigo_pacote) {
      res.status(400).json({ error: 'Dados inválidos da entrega' });
      return;
    }
    // Remove if existing id
    const existingIndex = deliveriesStore.findIndex(d => d.id_entrega === delivery.id_entrega);
    if (existingIndex >= 0) {
      deliveriesStore[existingIndex] = delivery;
    } else {
      deliveriesStore.unshift(delivery);
    }
    savePersistedDeliveries(deliveriesStore);
    res.json({ success: true, delivery });
  });

  // Delete delivery
  app.delete('/api/deliveries/:id', (req, res) => {
    const { id } = req.params;
    const index = deliveriesStore.findIndex(d => d.id_entrega === id);
    if (index >= 0) {
      deliveriesStore.splice(index, 1);
      savePersistedDeliveries(deliveriesStore);
      res.json({ success: true, message: 'Entrega removida com sucesso' });
    } else {
      res.status(404).json({ error: 'Entrega não encontrada' });
    }
  });

  // Gemini Vision OCR endpoint for package photos (Extract full label text and barcode)
  app.post('/api/ocr-gemini', async (req, res) => {
    try {
      const { imageBase64, knownCode } = req.body;
      if (!imageBase64) {
        res.status(400).json({ error: 'Imagem base64 não fornecida' });
        return;
      }

      const ai = getGenAI();
      if (!ai) {
        res.status(503).json({ error: 'Chave GEMINI_API_KEY não configurada no servidor' });
        return;
      }

      // Strip header prefix if present
      const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

      // Try multiple model aliases in case of high demand, quota limits or temporary rate limits
      const modelsToTry = [
        'gemini-3.6-flash',
        'gemini-flash-latest',
        'gemini-3.7-flash',
        'gemini-3.1-pro-preview',
      ];
      let response: any = null;
      let lastError: any = null;

      for (const modelName of modelsToTry) {
        try {
          response = await ai.models.generateContent({
            model: modelName,
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    inlineData: {
                      data: cleanBase64,
                      mimeType: 'image/jpeg',
                    },
                  },
                  {
                    text: `Você é um especialista em leitura OCR de etiquetas de encomendas e logística no Brasil (J&T Express, SHEIN, TikTok, Shopee, Anjun, Correios, Mercado Livre).

Analise a imagem da etiqueta fornecida e extraia SOMENTE estas informações principais:
1. nome_destinatario: O NOME da pessoa/morador que está no campo "DESTINATÁRIO" ou abaixo de "DESTINATÁRIO" (ex: "diego vicente", "Rafael Costa dos santos", "KELY DA CONCEICAO MARINHO", "Juliana Marques Ramos Rodrigues", "Shirlei Costa de Araujo", "Laelson Soares"). Ignore números de telefone com asterisco (ex: 2198127****) ou CPFs.
2. numero_casa: O NÚMERO da residência/casa/prédio impresso no endereço do destinatário (ex: "563", "785", "48", "32", "41", "311", "41 A"). Extraia apenas o número da casa.
3. codigo_pacote: O código do pacote, código de barras ou número de rastreio/pedido impresso na etiqueta (ex: "999881543324883", "888030863714641", etc).
4. complemento: Bloco, Casa 2, Apto, se houver explicitamente junto ao número.

Responda ESTRITAMENTE um JSON no seguinte formato (sem Markdown adicional):
{
  "nome_destinatario": "",
  "numero_casa": "",
  "codigo_pacote": "",
  "complemento": ""
}
Não invente dados. Se não localizar algum campo, deixe como string vazia "".`,
                  },
                ],
              },
            ],
          });
          if (response && response.text) break;
        } catch (err: any) {
          lastError = err;
          // Silently proceed to next model fallback when temporary 503 / high demand occurs
        }
      }

      if (!response) {
        res.json({
          success: false,
          code: null,
          data: null,
          message: 'Leitura por visão computacional indisponível no momento. Use digitação ou código de barras.',
          errorDetails: lastError?.message || 'Falha em todas as tentativas do modelo',
        });
        return;
      }

      const rawText = response.text ? response.text.trim() : '';
      let extractedData = {
        codigo_pacote: '',
        nome_destinatario: '',
        numero_casa: '',
        complemento: '',
      };

      try {
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          extractedData = JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        console.warn('Falha ao converter resposta da IA em JSON direto:', e);
      }

      const codeFromIa = (extractedData.codigo_pacote || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
      const finalCode = (codeFromIa.length >= 4 ? codeFromIa : knownCode || '').toUpperCase();

      const name = (extractedData.nome_destinatario || '').trim();
      const number = (extractedData.numero_casa || '').trim();
      const complement = (extractedData.complemento || '').trim();

      const hasData = Boolean(name || number || finalCode);

      if (hasData) {
        res.json({
          success: true,
          code: finalCode,
          data: {
            codigo_pacote: finalCode,
            nome_destinatario: name,
            numero_casa: number,
            complemento: complement,
          },
        });
      } else {
        res.json({
          success: false,
          code: null,
          data: null,
          message: 'Nenhum dado legível reconhecido na etiqueta.',
        });
      }
    } catch (error: any) {
      console.warn('Aviso: Erro controlado na chamada Gemini OCR:', error?.message || error);
      res.json({
        success: false,
        code: null,
        data: null,
        message: 'Leitura temporariamente indisponível. Por favor, prossiga manualmente.',
        details: error?.message || 'Erro interno no processamento',
      });
    }
  });

  // Vite middleware setup for dev / static in production
  const isProduction =
    process.env.NODE_ENV === 'production' ||
    (!process.env.VITE_DEV && fs.existsSync(path.join(process.cwd(), 'dist', 'index.html')));

  if (!isProduction) {
    try {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } catch (viteErr) {
      console.warn('Vite dev middleware falhou, caindo para static dist:', viteErr);
      const distPath = path.join(process.cwd(), 'dist');
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server SafaSanha rodando em http://localhost:${PORT}`);
  });

  process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception capturada no servidor:', err);
  });
  process.on('unhandledRejection', (reason) => {
    console.error('Unhandled Rejection capturada no servidor:', reason);
  });
}

startServer();
