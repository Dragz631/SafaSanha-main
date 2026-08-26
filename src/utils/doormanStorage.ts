/**
 * Utilitário de persistência de porteiros e zeladores por endereço/número no LocalStorage
 */

const STORAGE_KEY = 'logiscan_saved_doormen_v1';

export interface DoormanRecord {
  street: string;
  number: string;
  names: string[];
  lastUpdated: string;
}

// Chave normalizada para busca
export const getAddressKey = (street: string, houseNumber: string): string => {
  const cleanStreet = (street || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const cleanNumber = (houseNumber || '').trim().toLowerCase();
  return `${cleanStreet}:::${cleanNumber}`;
};

// Carrega todos os registros do LocalStorage
export const loadAllDoormenRecords = (): Record<string, string[]> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null) {
      return parsed;
    }
  } catch (err) {
    console.warn('Erro ao carregar lista de porteiros:', err);
  }
  return {};
};

// Salva todo o mapa no LocalStorage
const saveAllDoormenRecords = (records: Record<string, string[]>): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch (err) {
    console.warn('Erro ao salvar porteiros no LocalStorage:', err);
  }
};

/**
 * Obtém a lista de nomes de porteiros para um endereço específico
 * Tenta busca exata por (rua + número) e também por (apenas número) como fallback
 */
export const getDoormenForAddress = (street: string, houseNumber: string): string[] => {
  const records = loadAllDoormenRecords();
  const exactKey = getAddressKey(street, houseNumber);
  const numberOnlyKey = `number_only:::${(houseNumber || '').trim().toLowerCase()}`;

  const exactList = records[exactKey] || [];
  const numberOnlyList = records[numberOnlyKey] || [];

  // Combina e remove duplicatas
  const set = new Set<string>();
  exactList.forEach((n) => set.add(n.trim()));
  numberOnlyList.forEach((n) => set.add(n.trim()));

  return Array.from(set).filter(Boolean);
};

/**
 * Limpa e formata o nome de um porteiro/zelador
 * Ex: "Portaria (José)" -> "José"
 * Ex: "Zelador Marcos" -> "Marcos"
 */
export const cleanDoormanName = (rawText: string): string => {
  if (!rawText) return '';
  let name = rawText.trim();

  // Remove prefixos comuns se o usuário digitou
  name = name.replace(/^(portaria|porteiro|zelador|zeladora|vigilante|guarita|guarda)\s*[-:]?\s*/i, '');
  // Remove parênteses envolventes se houver
  name = name.replace(/^\((.*?)\)$/, '$1');
  // Se sobrou algo como "(José)", extrai o interior
  const parenMatch = name.match(/\((.*?)\)/);
  if (parenMatch && parenMatch[1]?.trim()) {
    name = parenMatch[1].trim();
  }

  return name.trim();
};

/**
 * Salva um novo porteiro para determinado endereço
 */
export const saveDoormanForAddress = (
  street: string,
  houseNumber: string,
  rawDoormanName: string
): void => {
  const cleaned = cleanDoormanName(rawDoormanName);
  if (!cleaned || cleaned.length < 2) return;

  const records = loadAllDoormenRecords();
  const exactKey = getAddressKey(street, houseNumber);
  const numberOnlyKey = `number_only:::${(houseNumber || '').trim().toLowerCase()}`;

  const currentExact = records[exactKey] || [];
  if (!currentExact.some((n) => n.toLowerCase() === cleaned.toLowerCase())) {
    records[exactKey] = [cleaned, ...currentExact];
  }

  if (houseNumber && houseNumber !== 'S/N') {
    const currentNumberOnly = records[numberOnlyKey] || [];
    if (!currentNumberOnly.some((n) => n.toLowerCase() === cleaned.toLowerCase())) {
      records[numberOnlyKey] = [cleaned, ...currentNumberOnly];
    }
  }

  saveAllDoormenRecords(records);
};

/**
 * Remove um porteiro salvo para um endereço
 */
export const removeDoormanForAddress = (
  street: string,
  houseNumber: string,
  doormanNameToRemove: string
): void => {
  const records = loadAllDoormenRecords();
  const exactKey = getAddressKey(street, houseNumber);
  const numberOnlyKey = `number_only:::${(houseNumber || '').trim().toLowerCase()}`;
  const targetLower = doormanNameToRemove.trim().toLowerCase();

  if (records[exactKey]) {
    records[exactKey] = records[exactKey].filter((n) => n.trim().toLowerCase() !== targetLower);
    if (records[exactKey].length === 0) delete records[exactKey];
  }

  if (records[numberOnlyKey]) {
    records[numberOnlyKey] = records[numberOnlyKey].filter((n) => n.trim().toLowerCase() !== targetLower);
    if (records[numberOnlyKey].length === 0) delete records[numberOnlyKey];
  }

  saveAllDoormenRecords(records);
};
