/**
 * Memória Inteligente de Endereços, Casas e Moradores por Rua
 * Salva automaticamente no LocalStorage e permite re-adicionar números com 1 toque
 * Suporta sub-ruas da Manilha (Leão XIII - Rua do Meio, Canal, Penha e Letras A a K)
 */

export interface SavedResident {
  id: string;
  name: string;
  complement?: string;
  timesDelivered?: number;
  lastSeen?: string;
}

export interface SavedAddressNumber {
  street: string;
  subStreet?: string; // Para Manilha: 'Rua Leão XIII', 'Rua do Canal', 'Rua A', etc.
  houseNumber: string;
  type: 'vila' | 'apartamento' | 'casa';
  residents: SavedResident[];
  lastUpdated: string;
}

const MEMORY_STORAGE_KEY = 'logiscan_street_address_memory_v2';

export const normalizeStreetName = (street: string): string => {
  return (street || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
};

export const normalizeHouseNumber = (num: string): string => {
  return (num || '').trim().toLowerCase().replace(/^n[ºo\.]?\s*/i, '');
};

// Detecta inteligentemente se é Vila ou Apartamento pelo complemento
export const detectAddressType = (
  complement?: string,
  existingType?: 'vila' | 'apartamento' | 'casa'
): 'vila' | 'apartamento' | 'casa' => {
  if (!complement) return existingType || 'casa';
  const c = complement.toLowerCase();
  if (
    c.includes('casa') ||
    c.includes('vila') ||
    c.includes('fundos') ||
    c.includes('sobrado') ||
    c.includes('frente') ||
    c.includes('terreo') ||
    c.includes('vilinha')
  ) {
    return 'vila';
  }
  if (
    c.includes('apto') ||
    c.includes('apartamento') ||
    c.includes('bloco') ||
    c.includes('sala') ||
    c.includes('andar') ||
    c.includes('condominio') ||
    c.includes('cond') ||
    c.includes('cobertura') ||
    c.includes('edificio')
  ) {
    return 'apartamento';
  }
  return existingType || 'casa';
};

const DEFAULT_SEEDED_MEMORY: Record<string, SavedAddressNumber[]> = {
  'rua carlos seidl': [
    {
      street: 'Rua Carlos Seidl',
      houseNumber: '21',
      type: 'casa',
      residents: [
        { id: 'res_21_1', name: 'Antônio Silva', complement: 'Casa Principal', timesDelivered: 5 },
        { id: 'res_21_2', name: 'Carla Silva', complement: 'Fundos', timesDelivered: 2 },
      ],
      lastUpdated: new Date().toISOString(),
    },
    {
      street: 'Rua Carlos Seidl',
      houseNumber: '23',
      type: 'vila',
      residents: [
        { id: 'res_23_1', name: 'Marcos Vinicius', complement: 'Casa 1', timesDelivered: 8 },
        { id: 'res_23_2', name: 'Juliana Paes', complement: 'Casa 2', timesDelivered: 3 },
      ],
      lastUpdated: new Date().toISOString(),
    },
    {
      street: 'Rua Carlos Seidl',
      houseNumber: '34',
      type: 'casa',
      residents: [
        { id: 'res_34_1', name: 'Roberto Carlos', complement: 'Térreo', timesDelivered: 4 },
      ],
      lastUpdated: new Date().toISOString(),
    },
    {
      street: 'Rua Carlos Seidl',
      houseNumber: '142',
      type: 'vila',
      residents: [
        { id: 'res_142_1', name: 'Maria Oliveira Santos', complement: 'Casa 2', timesDelivered: 12 },
        { id: 'res_142_2', name: 'José Carlos', complement: 'Portaria', timesDelivered: 9 },
      ],
      lastUpdated: new Date().toISOString(),
    },
  ],
  'manilha': [
    {
      street: 'Manilha',
      subStreet: 'Rua Leão XIII',
      houseNumber: '15',
      type: 'casa',
      residents: [
        { id: 'res_m_15', name: 'Dona Neide', complement: 'Sobrado', timesDelivered: 6 },
      ],
      lastUpdated: new Date().toISOString(),
    },
    {
      street: 'Manilha',
      subStreet: 'Rua A',
      houseNumber: '8',
      type: 'casa',
      residents: [
        { id: 'res_m_8', name: 'Valter Silva', complement: 'Térreo', timesDelivered: 3 },
      ],
      lastUpdated: new Date().toISOString(),
    },
  ],
};

// Carrega todas as ruas memorizadas
export const loadAllAddressMemory = (): Record<string, SavedAddressNumber[]> => {
  try {
    const raw = localStorage.getItem(MEMORY_STORAGE_KEY);
    if (!raw) {
      saveAllAddressMemory(DEFAULT_SEEDED_MEMORY);
      return DEFAULT_SEEDED_MEMORY;
    }
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null && Object.keys(parsed).length > 0) {
      return parsed;
    }
  } catch (err) {
    console.warn('Erro ao ler memória de endereços:', err);
  }
  return DEFAULT_SEEDED_MEMORY;
};

// Salva todo o banco no LocalStorage
const saveAllAddressMemory = (data: Record<string, SavedAddressNumber[]>): void => {
  try {
    localStorage.setItem(MEMORY_STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn('Erro ao salvar memória de endereços:', err);
  }
};

// Retorna todas as casas/números já salvos para uma determinada rua
export const getSavedAddressesForStreet = (street: string, subStreet?: string): SavedAddressNumber[] => {
  const normStreet = normalizeStreetName(street);
  if (!normStreet) return [];
  const all = loadAllAddressMemory();
  const list = all[normStreet] || [];

  const filtered = list.filter((item) => {
    if (normStreet === 'manilha' && subStreet) {
      const itemSub = (item.subStreet || '').toLowerCase().trim();
      const targetSub = subStreet.toLowerCase().trim();
      return itemSub === targetSub;
    }
    return true;
  });

  // Ordena numericamente
  return [...filtered].sort((a, b) => {
    const numA = parseInt(a.houseNumber.replace(/\D/g, '')) || 0;
    const numB = parseInt(b.houseNumber.replace(/\D/g, '')) || 0;
    if (numA !== numB) return numA - numB;
    return a.houseNumber.localeCompare(b.houseNumber, undefined, { numeric: true });
  });
};

// Salva imediatamente um endereço e morador na memória da rua
export const saveAddressToMemory = (
  street: string,
  houseNumber: string,
  complement?: string,
  clientName?: string,
  subStreet?: string
): void => {
  const normStreet = normalizeStreetName(street);
  const cleanHouse = (houseNumber || '').trim();
  if (!normStreet || !cleanHouse) return;

  const cleanClient = (clientName || '').trim() || 'Morador';
  const cleanComp = (complement || '').trim() || undefined;
  const cleanSub = (subStreet || '').trim() || undefined;

  const all = loadAllAddressMemory();
  const streetList = all[normStreet] ? [...all[normStreet]] : [];

  const existingHouseIdx = streetList.findIndex((item) => {
    const matchNum = normalizeHouseNumber(item.houseNumber) === normalizeHouseNumber(cleanHouse);
    if (!matchNum) return false;
    if (normStreet === 'manilha') {
      const itemSub = (item.subStreet || '').toLowerCase().trim();
      const targetSub = (cleanSub || '').toLowerCase().trim();
      return itemSub === targetSub;
    }
    return true;
  });

  const now = new Date().toISOString();

  if (existingHouseIdx >= 0) {
    const house = { ...streetList[existingHouseIdx] };
    const residentIdx = house.residents.findIndex(
      (r) =>
        r.name.toLowerCase().trim() === cleanClient.toLowerCase() &&
        (r.complement || '').toLowerCase().trim() === (cleanComp || '').toLowerCase().trim()
    );

    if (residentIdx >= 0) {
      const existingR = house.residents[residentIdx];
      house.residents[residentIdx] = {
        ...existingR,
        timesDelivered: (existingR.timesDelivered || 0) + 1,
        lastSeen: now,
      };
    } else {
      house.residents.push({
        id: `res_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
        name: cleanClient,
        complement: cleanComp,
        timesDelivered: 1,
        lastSeen: now,
      });
    }

    house.type = detectAddressType(cleanComp, house.type);
    if (house.residents.length > 1 && house.type === 'casa') {
      const hasHouseKeyword = house.residents.some((r) =>
        (r.complement || '').toLowerCase().includes('casa')
      );
      if (hasHouseKeyword) {
        house.type = 'vila';
      }
    }

    if (cleanSub) house.subStreet = cleanSub;
    house.lastUpdated = now;
    streetList[existingHouseIdx] = house;
  } else {
    // Novo número nesta rua
    const houseType = detectAddressType(cleanComp, 'casa');
    const newHouse: SavedAddressNumber = {
      street,
      subStreet: cleanSub,
      houseNumber: cleanHouse,
      type: houseType,
      residents: [
        {
          id: `res_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
          name: cleanClient,
          complement: cleanComp,
          timesDelivered: 1,
          lastSeen: now,
        },
      ],
      lastUpdated: now,
    };
    streetList.push(newHouse);
  }

  all[normStreet] = streetList;
  saveAllAddressMemory(all);
};

// Deleta um morador salvo
export const deleteSavedResident = (
  street: string,
  houseNumber: string,
  residentId: string,
  subStreet?: string
): void => {
  const normStreet = normalizeStreetName(street);
  const all = loadAllAddressMemory();
  if (!all[normStreet]) return;

  all[normStreet] = all[normStreet]
    .map((house) => {
      const matchNum = normalizeHouseNumber(house.houseNumber) === normalizeHouseNumber(houseNumber);
      if (!matchNum) return house;
      if (normStreet === 'manilha' && subStreet) {
        if ((house.subStreet || '').toLowerCase().trim() !== subStreet.toLowerCase().trim()) {
          return house;
        }
      }
      return {
        ...house,
        residents: house.residents.filter((r) => r.id !== residentId),
      };
    })
    .filter((house) => house.residents.length > 0);

  saveAllAddressMemory(all);
};

// Deleta uma casa inteira salva
export const deleteSavedHouse = (street: string, houseNumber: string, subStreet?: string): void => {
  const normStreet = normalizeStreetName(street);
  const all = loadAllAddressMemory();
  if (!all[normStreet]) return;

  all[normStreet] = all[normStreet].filter((house) => {
    const matchNum = normalizeHouseNumber(house.houseNumber) === normalizeHouseNumber(houseNumber);
    if (!matchNum) return true;
    if (normStreet === 'manilha' && subStreet) {
      return (house.subStreet || '').toLowerCase().trim() !== subStreet.toLowerCase().trim();
    }
    return false;
  });

  saveAllAddressMemory(all);
};
