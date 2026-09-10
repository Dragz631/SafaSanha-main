import { DeliveryData } from '../types';

export interface SafasanhasoPayload {
  id_entrega: string;
  codigo_pacote: string;
  nome_destinatario: string;
  endereco_rua: string;
  numero_casa: string;
  complemento?: string;
  endereco_completo: string;
  recebedor_tipo: string;
  recebedor_detalhes: string;
  foto_pacote_base64: string;
  foto_local_base64: string;
  data_hora: string;
  status: string;
  timestamp_sync?: string;
  group_key?: string;
  group_total?: number;
  group_index?: number;
  is_last_in_group?: boolean;
}

const STORAGE_QUEUE_KEY = 'safasanhaso_sync_queue';
const SERVER_URL_KEY = 'safasanhaso_server_url';

// URL padrão de conexão (auto-detecta porta 4000 no mesmo host ou localhost)
export function getSafasanhasoUrl(): string {
  try {
    const saved = localStorage.getItem(SERVER_URL_KEY);
    if (saved && saved.trim()) return saved.trim();

    if (typeof window !== 'undefined' && window.location) {
      const hostname = window.location.hostname || 'localhost';
      // Se estiver no mobile ou desktop, tenta se conectar na porta 4000 do host
      return `http://${hostname}:4000`;
    }
  } catch (_e) {}
  return 'http://localhost:4000';
}

export function setSafasanhasoUrl(url: string) {
  try {
    localStorage.setItem(SERVER_URL_KEY, url.trim());
  } catch (_e) {}
}

// Fila Offline Persistente
export function getPendingQueue(): SafasanhasoPayload[] {
  try {
    const raw = localStorage.getItem(STORAGE_QUEUE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (_e) {}
  return [];
}

function savePendingQueue(queue: SafasanhasoPayload[]) {
  try {
    localStorage.setItem(STORAGE_QUEUE_KEY, JSON.stringify(queue));
  } catch (_e) {}
}

export function enqueueDeliveryForSync(delivery: DeliveryData) {
  const enderecoRua = delivery.endereco_rua || 'Rua Carlos Seidl';
  const numeroCasa = delivery.numero_casa || delivery.endereco_numero || 'S/N';
  const complemento = delivery.complemento || '';
  const groupKey = `${enderecoRua}#${numeroCasa}#${complemento}`;
  const payload: SafasanhasoPayload = {
    id_entrega: delivery.id_entrega,
    codigo_pacote: delivery.codigo_pacote,
    nome_destinatario: delivery.nome_destinatario || 'Cliente',
    endereco_rua: enderecoRua,
    numero_casa: numeroCasa,
    complemento,
    endereco_completo: delivery.endereco_completo || `${enderecoRua}, ${numeroCasa}`,
    recebedor_tipo: delivery.recebedor_tipo,
    recebedor_detalhes: delivery.recebedor_detalhes,
    foto_pacote_base64: delivery.foto_pacote_path || '',
    foto_local_base64: delivery.foto_local_path || '',
    data_hora: delivery.data_hora || new Date().toISOString(),
    status: delivery.status,
    group_key: groupKey,
    group_total: 1,
    group_index: 1,
    is_last_in_group: true,
  };

  const queue = getPendingQueue();
  // Evita duplicatas na fila
  const filtered = queue.filter((item) => item.id_entrega !== payload.id_entrega);
  filtered.push(payload);
  savePendingQueue(filtered);

  // Dispara tentativa imediata de envio em segundo plano
  triggerSync();
}

let isSyncing = false;
type SyncListener = (status: { isOnline: boolean; pendingCount: number; lastSyncTime?: string }) => void;
const listeners: Set<SyncListener> = new Set();

export function subscribeSyncStatus(listener: SyncListener) {
  listeners.add(listener);
  // Notifica estado inicial
  listener({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    pendingCount: getPendingQueue().length,
  });
  return () => {
    listeners.delete(listener);
  };
}

function notifyListeners(isOnline: boolean, lastSyncTime?: string) {
  const count = getPendingQueue().length;
  listeners.forEach((fn) => fn({ isOnline, pendingCount: count, lastSyncTime }));
}

// Envia a fila pendente para o SafaSanhaso Desktop com batch e delay
export async function triggerSync(): Promise<{ sent: number; remaining: number }> {
  if (isSyncing) return { sent: 0, remaining: getPendingQueue().length };
  isSyncing = true;

  const queue = getPendingQueue();
  if (queue.length === 0) {
    isSyncing = false;
    notifyListeners(true);
    return { sent: 0, remaining: 0 };
  }

  const serverUrl = getSafasanhasoUrl();
  let sentCount = 0;
  const remainingQueue: SafasanhasoPayload[] = [];

  const BATCH_SIZE = 3;
  const MIN_INTERVAL_MS = 4000;

  const batch = queue.slice(0, BATCH_SIZE);

  for (let i = 0; i < batch.length; i++) {
    const item = batch[i];
    try {
      // Jitter para evitar pico
      const jitter = Math.floor(Math.random() * 1500);
      await new Promise(r => setTimeout(r, i > 0 ? MIN_INTERVAL_MS + jitter : 0));
      const res = await fetch(`${serverUrl}/api/sync/delivery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
        // Timeout curto de 6 segundos para não travar conexões lentas
        signal: AbortSignal.timeout(6000),
      });

      if (res.ok) {
        sentCount++;
      } else {
        remainingQueue.push(item);
      }
    } catch (_err) {
      // Falha de rede/offline: mantém o item na fila para reenvio posterior
      remainingQueue.push(item);
    }
  }

  // Mantém itens não processados no início da fila
  const notProcessed = queue.slice(BATCH_SIZE);
  const newQueue = [...remainingQueue, ...notProcessed];
  savePendingQueue(newQueue);
  isSyncing = false;

  const isSuccess = sentCount > 0 || remainingQueue.length === 0;
  notifyListeners(isSuccess, sentCount > 0 ? new Date().toLocaleTimeString('pt-BR') : undefined);

  return { sent: sentCount, remaining: remainingQueue.length };
}

// Sincroniza plano de ruas do dia para o SafaSanhaso
export async function syncStreetsPlan(date: string, streets: any[]) {
  try {
    const serverUrl = getSafasanhasoUrl();
    const payload = { date, helper_id: 'ajudante_01', streets };
    const res = await fetch(`${serverUrl}/api/sync/streets-plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Inicia escutas de reconexão de rede
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    triggerSync();
  });

  // Tenta sincronizar periodicamente se houver itens na fila
  setInterval(() => {
    const queue = getPendingQueue();
    if (queue.length > 0) {
      triggerSync();
    }
  }, 15000);
}
