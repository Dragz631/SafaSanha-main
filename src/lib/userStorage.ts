import {
  UserProfile,
  UserStreet,
  UserStorageData,
  StreetPackage,
  AssociationDelivery,
  AssociationSettings,
  AddressMemoryRecord,
  SavedResidentInfo,
  StreetSavedAddress,
  ReceiverCategory,
  DayHistoryRecord,
  HistoryPackageItem,
} from '../types';


const USERS_KEY = 'logistan_users_list_v3';
const ACTIVE_USER_ID_KEY = 'logistan_active_user_id_v3';
const USER_DATA_PREFIX = 'logistan_data_user_v3_';

export const AVATAR_COLORS = [
  { name: 'Verde Expedito', id: 'emerald', bg: 'bg-emerald-600', text: 'text-emerald-600', light: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { name: 'Azul', id: 'blue', bg: 'bg-blue-600', text: 'text-blue-600', light: 'bg-blue-50 text-blue-700 border-blue-200' },
  { name: 'Roxo', id: 'purple', bg: 'bg-purple-600', text: 'text-purple-600', light: 'bg-purple-50 text-purple-700 border-purple-200' },
  { name: 'Âmbar', id: 'amber', bg: 'bg-amber-600', text: 'text-amber-600', light: 'bg-amber-50 text-amber-700 border-amber-200' },
  { name: 'Rosa', id: 'rose', bg: 'bg-rose-600', text: 'text-rose-600', light: 'bg-rose-50 text-rose-700 border-rose-200' },
  { name: 'Ciano', id: 'cyan', bg: 'bg-cyan-600', text: 'text-cyan-600', light: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
];

export function getAvatarColorObj(colorId?: string) {
  return AVATAR_COLORS.find((c) => c.id === colorId) || AVATAR_COLORS[0];
}

// ----------------- USER PROFILES MANAGEMENT -----------------

export function getStoredUsers(): UserProfile[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Erro ao ler usuários do localStorage:', err);
    return [];
  }
}

export function saveStoredUsers(users: UserProfile[]): void {
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  } catch (err) {
    console.error('Erro ao salvar usuários no localStorage:', err);
  }
}

export function getActiveUserId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_USER_ID_KEY);
  } catch {
    return null;
  }
}

export function setActiveUserId(userId: string | null): void {
  try {
    if (userId) {
      localStorage.setItem(ACTIVE_USER_ID_KEY, userId);
    } else {
      localStorage.removeItem(ACTIVE_USER_ID_KEY);
    }
  } catch (err) {
    console.error('Erro ao salvar activeUserId no localStorage:', err);
  }
}

export function createNewUser(name: string, color?: string, phone?: string): UserProfile {
  const users = getStoredUsers();
  const trimmedName = name.trim();
  const newUser: UserProfile = {
    id: `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name: trimmedName || 'Entregador',
    color: color || AVATAR_COLORS[users.length % AVATAR_COLORS.length].id,
    phone: phone?.trim() || '',
    createdAt: new Date().toISOString(),
  };

  const updated = [...users, newUser];
  saveStoredUsers(updated);
  setActiveUserId(newUser.id);

  // Initialize with clean data (no hardcoded/preset streets)
  saveUserData(newUser.id, {
    streets: [],
    associationDeliveries: [],
    addressMemory: {},
    whatsappPhone: phone?.trim() || '',
    learnedItems: {},
    sessionPreferences: {},
    stats: {
      totalDelivered: 0,
      todayDelivered: 0,
      lastDeliveryDate: new Date().toISOString().split('T')[0],
    },
  });

  return newUser;
}

export function deleteUserProfile(userId: string): void {
  const users = getStoredUsers().filter((u) => u.id !== userId);
  saveStoredUsers(users);
  try {
    localStorage.removeItem(`${USER_DATA_PREFIX}${userId}`);
  } catch (err) {
    console.error('Erro ao remover dados do usuário:', err);
  }
  const currentActive = getActiveUserId();
  if (currentActive === userId) {
    setActiveUserId(users.length > 0 ? users[0].id : null);
  }
}

// ----------------- PER-USER DATA (STREETS, MEMORY, SETTINGS) -----------------

export function getUserData(userId: string): UserStorageData {
  try {
    const raw = localStorage.getItem(`${USER_DATA_PREFIX}${userId}`);
    if (!raw) {
      return {
        streets: [],
        associationDeliveries: [],
        addressMemory: {},
        learnedItems: {},
        sessionPreferences: {},
        stats: {
          totalDelivered: 0,
          todayDelivered: 0,
          lastDeliveryDate: new Date().toISOString().split('T')[0],
        },
      };
    }
    const parsed: UserStorageData = JSON.parse(raw);
    return {
      streets: parsed.streets || [],
      associationDeliveries: parsed.associationDeliveries || [],
      addressMemory: parsed.addressMemory || {},
      streetSavedAddresses: parsed.streetSavedAddresses || {},
      whatsappPhone: parsed.whatsappPhone || '',
      whatsappCustomHeader: parsed.whatsappCustomHeader || '',
      learnedItems: parsed.learnedItems || {},
      sessionPreferences: parsed.sessionPreferences || {},
      stats: parsed.stats || {
        totalDelivered: 0,
        todayDelivered: 0,
        lastDeliveryDate: new Date().toISOString().split('T')[0],
      },
    };
  } catch (err) {
    console.error(`Erro ao carregar dados do usuário ${userId}:`, err);
    return {
      streets: [],
      associationDeliveries: [],
      addressMemory: {},
      streetSavedAddresses: {},
      learnedItems: {},
      sessionPreferences: {},
      stats: { totalDelivered: 0, todayDelivered: 0 },
    };
  }
}

export function saveUserData(userId: string, data: UserStorageData): void {
  try {
    localStorage.setItem(`${USER_DATA_PREFIX}${userId}`, JSON.stringify(data));
  } catch (err) {
    console.error(`Erro ao salvar dados do usuário ${userId}:`, err);
  }
}

// ----------------- ADDRESS INTELLIGENT MEMORY -----------------

function normalizeAddressKey(streetName: string, houseNumber: string, complement?: string): string {
  const st = (streetName || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const num = (houseNumber || '').trim().toLowerCase().replace(/\s+/g, '');
  const comp = (complement || '').trim().toLowerCase().replace(/\s+/g, '');
  return `${st}___${num}___${comp}`;
}

export function rememberAddress(
  userId: string,
  record: {
    streetName: string;
    houseNumber: string;
    complement?: string;
    recipientName?: string;
    receiverCategory?: ReceiverCategory;
    receiverSubtype?: string;
    receiverName?: string;
    notes?: string;
  }
): void {
  if (!userId || !record.streetName || !record.houseNumber) return;

  const current = getUserData(userId);
  const memory = current.addressMemory || {};
  const learned = current.learnedItems || {};
  const key = normalizeAddressKey(record.streetName, record.houseNumber, record.complement);

  const existing = memory[key];

  memory[key] = {
    streetName: record.streetName.trim(),
    houseNumber: record.houseNumber.trim(),
    complement: record.complement?.trim() || undefined,
    recipientName: record.recipientName?.trim() || existing?.recipientName || '',
    lastReceiverCategory: record.receiverCategory || existing?.lastReceiverCategory,
    lastReceiverSubtype: record.receiverSubtype || existing?.lastReceiverSubtype,
    lastReceiverName: record.receiverName || existing?.lastReceiverName,
    notes: record.notes || existing?.notes,
    updatedAt: new Date().toISOString(),
  };

  // Learn receiver name and subtype dynamically
  if (record.receiverCategory && record.receiverName) {
    const learnKey = `${record.receiverCategory}___${(record.receiverSubtype || '').toLowerCase()}___${record.receiverName.trim().toLowerCase()}`;
    const prevLearned = learned[learnKey];
    learned[learnKey] = {
      id: prevLearned?.id || `learn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: record.receiverName.trim(),
      category: record.receiverCategory,
      subCategory: record.receiverSubtype?.trim() || undefined,
      count: (prevLearned?.count || 0) + 1,
      lastUsedAt: new Date().toISOString(),
    };
  }

  saveUserData(userId, {
    ...current,
    addressMemory: memory,
    learnedItems: learned,
  });
}

export function normalizeStreetName(streetName: string): string {
  return (streetName || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function saveAddressToStreetMemory(
  userId: string,
  streetName: string,
  houseNumber: string,
  complement?: string,
  recipientName?: string,
  receiverData?: {
    category?: ReceiverCategory;
    subtype?: string;
    receiverName?: string;
    isDelivered?: boolean;
  }
): void {
  if (!userId || !streetName || !houseNumber) return;
  const current = getUserData(userId);
  const streetAddresses = current.streetSavedAddresses || {};
  const stKey = normalizeStreetName(streetName);

  const list: StreetSavedAddress[] = [...(streetAddresses[stKey] || [])];
  const cleanHouse = houseNumber.trim();
  const cleanComp = complement?.trim() || undefined;
  const cleanRecipient = recipientName?.trim() || 'Morador';

  const houseIndex = list.findIndex(
    (h) => h.houseNumber.toLowerCase().replace(/\s+/g, '') === cleanHouse.toLowerCase().replace(/\s+/g, '')
  );

  const now = new Date().toISOString();

  if (houseIndex === -1) {
    const newResident: SavedResidentInfo = {
      id: `res_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      recipientName: cleanRecipient,
      complement: cleanComp,
      lastReceiverCategory: receiverData?.category,
      lastReceiverSubtype: receiverData?.subtype,
      lastReceiverName: receiverData?.receiverName,
      timesDelivered: receiverData?.isDelivered ? 1 : 0,
      lastSeenAt: now,
    };
    list.push({
      streetName: streetName.trim(),
      houseNumber: cleanHouse,
      residents: [newResident],
      updatedAt: now,
    });
  } else {
    const house = { ...list[houseIndex], residents: [...list[houseIndex].residents] };
    const residentIndex = house.residents.findIndex(
      (r) =>
        r.recipientName.toLowerCase() === cleanRecipient.toLowerCase() &&
        (r.complement || '').toLowerCase() === (cleanComp || '').toLowerCase()
    );

    if (residentIndex === -1) {
      house.residents.push({
        id: `res_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        recipientName: cleanRecipient,
        complement: cleanComp,
        lastReceiverCategory: receiverData?.category,
        lastReceiverSubtype: receiverData?.subtype,
        lastReceiverName: receiverData?.receiverName,
        timesDelivered: receiverData?.isDelivered ? 1 : 0,
        lastSeenAt: now,
      });
    } else {
      const res = { ...house.residents[residentIndex] };
      res.lastSeenAt = now;
      if (cleanComp) res.complement = cleanComp;
      if (receiverData?.category) res.lastReceiverCategory = receiverData.category;
      if (receiverData?.subtype) res.lastReceiverSubtype = receiverData.subtype;
      if (receiverData?.receiverName) res.lastReceiverName = receiverData.receiverName;
      if (receiverData?.isDelivered) {
        res.timesDelivered = (res.timesDelivered || 0) + 1;
      }
      house.residents[residentIndex] = res;
    }
    house.updatedAt = now;
    list[houseIndex] = house;
  }

  // Ordena casas por número crescente
  list.sort((a, b) => {
    const numA = parseInt(a.houseNumber.replace(/\D/g, '')) || 0;
    const numB = parseInt(b.houseNumber.replace(/\D/g, '')) || 0;
    if (numA !== numB) return numA - numB;
    return a.houseNumber.localeCompare(b.houseNumber, undefined, { numeric: true });
  });

  streetAddresses[stKey] = list;

  saveUserData(userId, {
    ...current,
    streetSavedAddresses: streetAddresses,
  });
}

export function getStreetSavedAddresses(userId: string, streetName: string): StreetSavedAddress[] {
  if (!userId || !streetName) return [];
  const current = getUserData(userId);
  const streetAddresses = current.streetSavedAddresses || {};
  const stKey = normalizeStreetName(streetName);
  const found = streetAddresses[stKey];
  if (found && found.length > 0) {
    return found;
  }

  // Auto-migra dados antigos do addressMemory se ainda não houver lista salva
  const legacyMemory = current.addressMemory || {};
  const legacyKeyPrefix = `${streetName.trim().toLowerCase()}___`;
  const seededList: StreetSavedAddress[] = [];

  for (const k in legacyMemory) {
    if (k.startsWith(legacyKeyPrefix)) {
      const rec = legacyMemory[k];
      let h = seededList.find(
        (x) => x.houseNumber.toLowerCase().replace(/\s+/g, '') === rec.houseNumber.toLowerCase().replace(/\s+/g, '')
      );
      if (!h) {
        h = {
          streetName: rec.streetName,
          houseNumber: rec.houseNumber,
          residents: [],
          updatedAt: rec.updatedAt || new Date().toISOString(),
        };
        seededList.push(h);
      }
      h.residents.push({
        id: `res_leg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        recipientName: rec.recipientName || 'Morador',
        complement: rec.complement,
        lastReceiverCategory: rec.lastReceiverCategory,
        lastReceiverSubtype: rec.lastReceiverSubtype,
        lastReceiverName: rec.lastReceiverName,
        timesDelivered: 1,
        lastSeenAt: rec.updatedAt || new Date().toISOString(),
      });
    }
  }

  if (seededList.length > 0) {
    seededList.sort((a, b) => {
      const numA = parseInt(a.houseNumber.replace(/\D/g, '')) || 0;
      const numB = parseInt(b.houseNumber.replace(/\D/g, '')) || 0;
      if (numA !== numB) return numA - numB;
      return a.houseNumber.localeCompare(b.houseNumber, undefined, { numeric: true });
    });
    streetAddresses[stKey] = seededList;
    saveUserData(userId, {
      ...current,
      streetSavedAddresses: streetAddresses,
    });
    return seededList;
  }

  return [];
}

export function deleteSavedResident(
  userId: string,
  streetName: string,
  houseNumber: string,
  residentId: string
): void {
  if (!userId || !streetName || !houseNumber || !residentId) return;
  const current = getUserData(userId);
  const streetAddresses = current.streetSavedAddresses || {};
  const stKey = normalizeStreetName(streetName);
  const list = streetAddresses[stKey];
  if (!list) return;

  const hIndex = list.findIndex(
    (h) => h.houseNumber.toLowerCase().replace(/\s+/g, '') === houseNumber.toLowerCase().replace(/\s+/g, '')
  );
  if (hIndex === -1) return;

  const house = { ...list[hIndex] };
  house.residents = house.residents.filter((r) => r.id !== residentId);
  if (house.residents.length === 0) {
    list.splice(hIndex, 1);
  } else {
    list[hIndex] = house;
  }
  streetAddresses[stKey] = list;

  saveUserData(userId, {
    ...current,
    streetSavedAddresses: streetAddresses,
  });
}

export function deleteSavedHouse(
  userId: string,
  streetName: string,
  houseNumber: string
): void {
  if (!userId || !streetName || !houseNumber) return;
  const current = getUserData(userId);
  const streetAddresses = current.streetSavedAddresses || {};
  const stKey = normalizeStreetName(streetName);
  const list = streetAddresses[stKey];
  if (!list) return;

  streetAddresses[stKey] = list.filter(
    (h) => h.houseNumber.toLowerCase().replace(/\s+/g, '') !== houseNumber.toLowerCase().replace(/\s+/g, '')
  );

  saveUserData(userId, {
    ...current,
    streetSavedAddresses: streetAddresses,
  });
}

export function lookupAddressMemory(
  userId: string,
  streetName: string,
  houseNumber: string,
  complement?: string
): AddressMemoryRecord | null {
  if (!userId || !streetName || !houseNumber) return null;
  const current = getUserData(userId);
  const memory = current.addressMemory || {};
  const exactKey = normalizeAddressKey(streetName, houseNumber, complement);

  if (memory[exactKey]) return memory[exactKey];

  // Try lookup without complement if not found
  const baseKey = normalizeAddressKey(streetName, houseNumber, '');
  if (memory[baseKey]) return memory[baseKey];

  // Search prefix
  const prefix = `${streetName.trim().toLowerCase()}___${houseNumber.trim().toLowerCase()}___`;
  for (const k in memory) {
    if (k.startsWith(prefix)) {
      return memory[k];
    }
  }

  return null;
}

export function getFrequentReceiversForAddress(
  userId: string,
  streetName: string,
  houseNumber: string
): AddressMemoryRecord[] {
  if (!userId || !streetName || !houseNumber) return [];
  const current = getUserData(userId);
  const memory = current.addressMemory || {};
  const prefix = `${streetName.trim().toLowerCase()}___${houseNumber.trim().toLowerCase()}___`;
  
  const matches: AddressMemoryRecord[] = [];
  for (const k in memory) {
    if (k.startsWith(prefix) && memory[k].lastReceiverName) {
      matches.push(memory[k]);
    }
  }
  return matches;
}

export function getFrequentReceiversForCategory(
  userId: string,
  category: ReceiverCategory
): string[] {
  if (!userId) return [];
  const current = getUserData(userId);
  const memory = current.addressMemory || {};
  const learned = current.learnedItems || {};
  const namesMap = new Map<string, { count: number; lastUsed: string }>();

  // 1. From address memory
  for (const k in memory) {
    const item = memory[k];
    if (item.lastReceiverCategory === category && item.lastReceiverName) {
      const name = item.lastReceiverName.trim();
      const existing = namesMap.get(name) || { count: 0, lastUsed: item.updatedAt || '' };
      namesMap.set(name, { count: existing.count + 1, lastUsed: item.updatedAt || existing.lastUsed });
    }
  }

  // 2. From learnedItems
  for (const k in learned) {
    const item = learned[k];
    if (item.category === category && item.name) {
      const name = item.name.trim();
      const existing = namesMap.get(name) || { count: 0, lastUsed: item.lastUsedAt || '' };
      namesMap.set(name, {
        count: existing.count + item.count,
        lastUsed: item.lastUsedAt || existing.lastUsed,
      });
    }
  }

  return Array.from(namesMap.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([name]) => name);
}

// ----------------- RECEIVER DESCRIPTION FORMATTER -----------------

export function buildReceiverFullDescription(
  category?: ReceiverCategory,
  subtype?: string,
  name?: string,
  recipientName?: string
): string {
  const cleanName = (name || '').trim();
  const cleanSubtype = (subtype || '').trim();

  switch (category) {
    case 'proprio':
      return cleanName ? `Próprio Morador (${cleanName})` : (recipientName ? `Próprio Morador (${recipientName})` : `Próprio Morador`);
    case 'familiar':
      if (cleanSubtype && cleanName) {
        return `Familiar (${cleanSubtype} - ${cleanName})`;
      } else if (cleanName) {
        return `Familiar (${cleanName})`;
      } else if (cleanSubtype) {
        return `Familiar (${cleanSubtype})`;
      }
      return `Familiar`;
    case 'vizinho':
      return cleanName ? `Vizinho (${cleanName})` : `Vizinho`;
    case 'portaria':
      if (cleanSubtype && cleanName) {
        return `Portaria (${cleanSubtype} - ${cleanName})`;
      } else if (cleanName) {
        return `Portaria (${cleanName})`;
      }
      return `Portaria / Prédio`;
    case 'seguranca':
      if (cleanSubtype && cleanName) {
        return `Segurança (${cleanSubtype} - ${cleanName})`;
      } else if (cleanName) {
        return `Segurança (${cleanName})`;
      }
      return `Segurança / Vigilância`;
    case 'comercio':
      return cleanName ? `Estabelecimento Comercial (${cleanName})` : `Estabelecimento Comercial`;
    default:
      return cleanName || 'Recebedor Autorizado';
  }
}

// ----------------- WHATSAPP MESSAGE FORMATTERS & SENDER -----------------

export function formatDeliveryWhatsAppMessage(
  userName: string,
  streetName: string,
  pkg: StreetPackage
): string {
  const dateStr = pkg.deliveredAt ? new Date(pkg.deliveredAt) : new Date();
  const timeFormatted = dateStr.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const dateFormatted = dateStr.toLocaleDateString('pt-BR');

  const receiverDesc =
    pkg.deliveredTo ||
    buildReceiverFullDescription(
      pkg.receiverCategory,
      pkg.receiverSubtype,
      pkg.receiverName,
      pkg.recipientName
    );

  const addressText = pkg.complement
    ? `${streetName}, ${pkg.houseNumber} (${pkg.complement})`
    : `${streetName}, ${pkg.houseNumber || 'S/N'}`;

  const codeText = pkg.code
    ? (pkg.code.startsWith('#') ? pkg.code : `#${pkg.code}`)
    : `#${pkg.id.replace(/\D/g, '').slice(-4) || '101'}`;

  const lines = [
    `📦 *Entrega realizada*`,
    `👤 *Cliente:* ${pkg.recipientName || 'Não informado'}`,
    `🤝 *Recebido por:* ${receiverDesc}`,
    `📍 *Endereço:* ${addressText}`,
    `🏷️ *Pacote:* ${codeText}`,
    `📅 *Data:* ${dateFormatted}`,
    `⏰ *Horário:* ${timeFormatted}`,
  ];

  if (pkg.notes) {
    lines.push(`📝 *Obs:* ${pkg.notes}`);
  }

  return lines.join('\n');
}

export function formatFailureWhatsAppMessage(
  userName: string,
  streetName: string,
  pkg: StreetPackage
): string {
  const dateStr = pkg.deliveredAt ? new Date(pkg.deliveredAt) : new Date();
  const timeFormatted = dateStr.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const dateFormatted = dateStr.toLocaleDateString('pt-BR');

  const addressText = pkg.complement
    ? `${streetName}, ${pkg.houseNumber} (${pkg.complement})`
    : `${streetName}, ${pkg.houseNumber || 'S/N'}`;

  const codeText = pkg.code
    ? (pkg.code.startsWith('#') ? pkg.code : `#${pkg.code}`)
    : `#${pkg.id.replace(/\D/g, '').slice(-4) || '101'}`;

  const lines = [
    `❌ *Entrega não realizada (Insucesso)*`,
    `👤 *Cliente:* ${pkg.recipientName || 'Não informado'}`,
    `📍 *Endereço:* ${addressText}`,
    `⚠️ *Motivo:* ${pkg.failureReason || 'Morador Ausente'}`,
    `🏷️ *Pacote:* ${codeText}`,
    `📅 *Data:* ${dateFormatted}`,
    `⏰ *Horário:* ${timeFormatted}`,
  ];

  return lines.join('\n');
}

export function formatStreetSummaryWhatsAppMessage(
  userName: string,
  street: UserStreet
): string {
  const total = street.packages.length;
  const delivered = street.packages.filter((p) => p.status === 'delivered').length;
  const failed = street.packages.filter((p) => p.status === 'failed').length;
  const pending = total - delivered - failed;

  const now = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const today = new Date().toLocaleDateString('pt-BR');

  const lines = [
    `🚚 *LOGISTAN [EXPEDITO] - RESUMO DA RUA*`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `👤 *Entregador:* ${userName}`,
    `📍 *Rua:* ${street.name}${street.neighborhood ? ` (${street.neighborhood})` : ''}`,
    `📊 *Status:* ${street.isCompleted ? '✅ 100% Concluída' : '⏳ Em Andamento'}`,
    `📦 *Total de Pacotes:* ${total}`,
    `✅ *Entregues:* ${delivered}`,
    failed > 0 ? `❌ *Falhas/Ausentes:* ${failed}` : '',
    pending > 0 ? `⏳ *Pendentes:* ${pending}` : '',
    `⏰ *Horário:* ${today} às ${now}`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━`,
  ];

  if (delivered > 0) {
    lines.push(`📋 *Entregas Realizadas:*`);
    street.packages
      .filter((p) => p.status === 'delivered')
      .forEach((p, idx) => {
        const compl = p.complement ? ` (${p.complement})` : '';
        const rec = p.deliveredTo || 'Entregue';
        lines.push(` ${idx + 1}. Nº ${p.houseNumber}${compl} - ${p.recipientName ? `${p.recipientName} • ` : ''}${rec}`);
      });
  }

  if (failed > 0) {
    lines.push(`\n❌ *Insucessos:*`);
    street.packages
      .filter((p) => p.status === 'failed')
      .forEach((p, idx) => {
        const compl = p.complement ? ` (${p.complement})` : '';
        lines.push(` ${idx + 1}. Nº ${p.houseNumber}${compl} - ${p.recipientName || 'Morador'}: ${p.failureReason || 'Ausente'}`);
      });
  }

  return lines.filter(Boolean).join('\n');
}

export function formatDaySummaryWhatsAppMessage(
  userName: string,
  streets: UserStreet[]
): string {
  const totalStreets = streets.length;
  const completedStreets = streets.filter((s) => s.isCompleted).length;

  let totalPackages = 0;
  let totalDelivered = 0;
  let totalFailed = 0;

  streets.forEach((s) => {
    totalPackages += s.packages.length;
    totalDelivered += s.packages.filter((p) => p.status === 'delivered').length;
    totalFailed += s.packages.filter((p) => p.status === 'failed').length;
  });

  const pendingPackages = totalPackages - totalDelivered - totalFailed;
  const progressPercent = totalPackages > 0 ? Math.round((totalDelivered / totalPackages) * 100) : 0;

  const now = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const today = new Date().toLocaleDateString('pt-BR');

  const lines = [
    `🚚 *LOGISTAN [EXPEDITO] - PRESTAÇÃO DE CONTAS DO DIA*`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `👤 *Entregador:* ${userName}`,
    `📅 *Data:* ${today} às ${now}`,
    `📊 *Progresso Geral:* ${progressPercent}% CONCLUÍDO`,
    `📦 *Total:* ${totalPackages} | ✅ *Entregas:* ${totalDelivered} | ⏳ *Pendentes:* ${pendingPackages} | ❌ *Falhas:* ${totalFailed}`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `📍 *RUAS REGISTRADAS (${totalStreets}) - ${completedStreets} CONCLUÍDAS:*`,
  ];

  streets.forEach((s) => {
    const sDelivered = s.packages.filter((p) => p.status === 'delivered').length;
    const sTotal = s.packages.length;
    const icon = s.isCompleted ? '✅' : sDelivered > 0 ? '🔄' : '⏳';
    lines.push(`${icon} *${s.name}*: ${sDelivered}/${sTotal} entregues`);
  });

  // Highlight failures if any
  const allFailures: { street: string; pkg: StreetPackage }[] = [];
  streets.forEach((s) => {
    s.packages.filter((p) => p.status === 'failed').forEach((pkg) => {
      allFailures.push({ street: s.name, pkg });
    });
  });

  if (allFailures.length > 0) {
    lines.push(`\n⚠️ *RELATÓRIO DE INSUCESSOS (${allFailures.length}):*`);
    allFailures.forEach(({ street, pkg }, i) => {
      const compl = pkg.complement ? ` (${pkg.complement})` : '';
      lines.push(`${i + 1}. *${street}*, Nº ${pkg.houseNumber}${compl} - ${pkg.recipientName || 'Morador'} -> *Motivo:* ${pkg.failureReason || 'Ausente'}`);
    });
  }

  lines.push(`\n_Relatório gerado automaticamente pelo Logistan Expedito_`);

  return lines.join('\n');
}

export function openWhatsApp(text: string, phone?: string): void {
  const cleanPhone = phone ? phone.replace(/\D/g, '') : '';
  const encodedText = encodeURIComponent(text);
  
  let url = '';
  if (cleanPhone) {
    const finalPhone = cleanPhone.length <= 11 ? `55${cleanPhone}` : cleanPhone;
    url = `https://wa.me/${finalPhone}?text=${encodedText}`;
  } else {
    url = `https://api.whatsapp.com/send?text=${encodedText}`;
  }

  window.open(url, '_blank', 'noopener,noreferrer');
}

export function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text).then(() => true).catch(() => false);
  } else {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      textArea.remove();
      return Promise.resolve(true);
    } catch {
      textArea.remove();
      return Promise.resolve(false);
    }
  }
}

export function archiveDayHistory(
  userId: string,
  userName: string,
  streets: UserStreet[],
  failedResolutions: Record<string, 'reroute' | 'return_to_hub'>
): { updatedStreets: UserStreet[]; newRecord: DayHistoryRecord } {
  const currentData = getUserData(userId);
  const now = new Date();
  const dateFormatted = now.toLocaleDateString('pt-BR');

  const deliveredPackages: HistoryPackageItem[] = [];
  const failedPackages: HistoryPackageItem[] = [];

  const streetsSummary = streets.map((s) => {
    const sDelivered = s.packages.filter((p) => p.status === 'delivered');
    const sFailed = s.packages.filter((p) => p.status === 'failed');

    sDelivered.forEach((p) => {
      deliveredPackages.push({ ...p, streetName: s.name });
    });

    sFailed.forEach((p) => {
      const res = failedResolutions[p.id] || p.failedResolution || 'return_to_hub';
      failedPackages.push({ ...p, streetName: s.name, failedResolution: res });
    });

    return {
      streetName: s.name,
      total: s.packages.length,
      delivered: sDelivered.length,
      failed: sFailed.length,
    };
  });

  const totalPkgs = deliveredPackages.length + failedPackages.length;
  const summaryMessage = formatDaySummaryWhatsAppMessage(userName, streets);

  const newRecord: DayHistoryRecord = {
    id: `history_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    date: dateFormatted,
    finishedAt: now.toISOString(),
    totalPackages: totalPkgs,
    deliveredCount: deliveredPackages.length,
    failedCount: failedPackages.length,
    streetsSummary,
    deliveredPackages,
    failedPackages,
    summaryMessage,
  };

  // Prepare updated streets for the next day/route:
  // Keep only failed packages designated as 'reroute', resetting them to pending
  const updatedStreets: UserStreet[] = streets.map((s) => {
    const keptPackages = s.packages
      .filter((p) => {
        if (p.status === 'failed') {
          const res = failedResolutions[p.id] || p.failedResolution || 'return_to_hub';
          return res === 'reroute';
        }
        return false;
      })
      .map((p) => ({
        ...p,
        status: 'pending' as const,
        deliveredTo: undefined,
        deliveredAt: undefined,
        failureReason: undefined,
        failedResolution: undefined,
      }));

    return {
      ...s,
      packages: keptPackages,
      isCompleted: false,
    };
  });

  const updatedHistory = [newRecord, ...(currentData.history || [])];

  saveUserData(userId, {
    ...currentData,
    streets: updatedStreets,
    history: updatedHistory,
  });

  return {
    updatedStreets,
    newRecord,
  };
}

export function getDayHistories(userId: string): DayHistoryRecord[] {
  const currentData = getUserData(userId);
  return currentData.history || [];
}

export function getAssociationSettings(userId: string): AssociationSettings {
  if (!userId) return { name: '', attendant: '', phone: '' };
  const current = getUserData(userId);
  return current.associationSettings || { name: '', attendant: '', phone: '' };
}

export function saveAssociationSettings(userId: string, settings: AssociationSettings): void {
  if (!userId) return;
  const current = getUserData(userId);
  saveUserData(userId, {
    ...current,
    associationSettings: settings,
  });
}

export function formatAssociationListWhatsAppMessage(
  userName: string,
  associationName: string,
  attendantName: string,
  deliveries: AssociationDelivery[]
): string {
  const total = deliveries.length;
  const now = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const today = new Date().toLocaleDateString('pt-BR');

  const lines = [
    `🏢 *LISTA DE ENCOMENDAS - ASSOCIAÇÃO*`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `📍 *Associação:* ${associationName || 'Associação de Moradores'}`,
    `🤝 *Responsável:* ${attendantName || 'Responsável na Sede'}`,
    `🚚 *Entregador:* ${userName}`,
    `📅 *Data:* ${today} às ${now}`,
    `📦 *Total de Encomendas Deixadas:* ${total} ${total === 1 ? 'pacote' : 'pacotes'}`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `📋 *RELAÇÃO DE MORADORES E ENDEREÇOS:*`,
    ``,
  ];

  deliveries.forEach((item, index) => {
    const compl = item.complement ? ` (${item.complement})` : '';
    const code = item.code ? ` • 🏷️ Cód: ${item.code}` : '';
    lines.push(`${index + 1}. 👤 *${item.recipientName || 'Morador'}*`);
    lines.push(`   📍 ${item.streetName}, Nº ${item.houseNumber}${compl}${code}`);
    if (item.notes) {
      lines.push(`   📝 Obs: ${item.notes}`);
    }
    lines.push(``);
  });

  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`_Lista gerada pelo LogiScan [EXPEDITO] para entrega e conferência dos moradores._`);

  return lines.join('\n');
}

export function formatGroupDeliveryWhatsAppMessage(
  userName: string,
  streetName: string,
  houseNumber: string,
  packages: StreetPackage[],
  receiverDesc: string
): string {
  const dateStr = new Date();
  const timeFormatted = dateStr.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const dateFormatted = dateStr.toLocaleDateString('pt-BR');

  const total = packages.length;
  const lines = [
    `📦 *ENTREGA EM CONDOMÍNIO / PORTARIA (${total} PACOTES)*`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `👤 *Entregador:* ${userName}`,
    `📍 *Endereço:* ${streetName}, Nº ${houseNumber}`,
    `🤝 *Recebido por:* ${receiverDesc || 'Portaria / Prédio'}`,
    `📅 *Data:* ${dateFormatted} às ${timeFormatted}`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `📋 *RELAÇÃO DE PACOTES ENTREGUES:*`,
    ``,
  ];

  packages.forEach((pkg, idx) => {
    const compl = pkg.complement ? ` (${pkg.complement})` : '';
    const codeText = pkg.code
      ? (pkg.code.startsWith('#') ? pkg.code : `#${pkg.code}`)
      : `#${pkg.id.replace(/\D/g, '').slice(-4) || `${idx + 101}`}`;
    lines.push(`${idx + 1}. 👤 *${pkg.recipientName || 'Morador'}*${compl} • 🏷️ ${codeText}`);
  });

  lines.push(``);
  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`_Comprovante de entrega coletiva gerado pelo LogiScan Expedito_`);

  return lines.join('\n');
}
