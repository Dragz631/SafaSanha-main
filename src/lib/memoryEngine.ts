import {
  ReceiverCategory,
  LearnedItemRecord,
  SessionStatePreferences,
  BackupDataPayload,
  UserProfile,
  UserStorageData,
} from '../types';
import {
  getUserData,
  saveUserData,
  getStoredUsers,
  saveStoredUsers,
  getActiveUserId,
  setActiveUserId,
} from './userStorage';

/**
 * Normaliza chave de item aprendido para indexação rápida
 */
function normalizeKey(category: string, name: string, subCategory?: string): string {
  const c = (category || '').trim().toLowerCase();
  const n = (name || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const s = (subCategory || '').trim().toLowerCase().replace(/\s+/g, ' ');
  return `${c}___${s}___${n}`;
}

/**
 * Aprende dinamicamente qualquer termo, recebedor, motivo ou atalho digitado pelo entregador
 */
export function learnItem(
  userId: string,
  category: ReceiverCategory | 'association' | 'association_attendant' | 'failure_reason' | 'shortcut_tag' | 'subtype',
  name: string,
  subCategory?: string
): void {
  const cleanName = (name || '').trim();
  if (!userId || !cleanName || cleanName.length < 2) return;

  const currentData = getUserData(userId);
  const learned = currentData.learnedItems || {};
  const key = normalizeKey(category, cleanName, subCategory);

  const prev = learned[key];
  learned[key] = {
    id: prev?.id || `learn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    name: cleanName,
    category,
    subCategory: subCategory?.trim() || undefined,
    count: (prev?.count || 0) + 1,
    lastUsedAt: new Date().toISOString(),
  };

  saveUserData(userId, {
    ...currentData,
    learnedItems: learned,
  });
}

/**
 * Retorna itens aprendidos ordenados por maior frequência e uso mais recente
 */
export function getLearnedItems(
  userId: string,
  category: ReceiverCategory | 'association' | 'association_attendant' | 'failure_reason' | 'shortcut_tag' | 'subtype',
  subCategory?: string,
  limit: number = 10
): string[] {
  if (!userId) return [];
  const currentData = getUserData(userId);
  const learned = currentData.learnedItems || {};

  const items: LearnedItemRecord[] = [];
  const subTarget = subCategory ? subCategory.trim().toLowerCase() : null;

  for (const k in learned) {
    const item = learned[k];
    if (item.category === category) {
      if (subTarget && item.subCategory) {
        if (item.subCategory.toLowerCase() === subTarget) {
          items.push(item);
        }
      } else {
        items.push(item);
      }
    }
  }

  // Ordena por frequência descendente e recência
  items.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime();
  });

  return items.slice(0, limit).map((i) => i.name);
}

/**
 * Salva preferências de sessão ativas do usuário
 */
export function saveSessionPreferences(
  userId: string,
  prefs: Partial<SessionStatePreferences>
): void {
  if (!userId) return;
  const current = getUserData(userId);
  saveUserData(userId, {
    ...current,
    sessionPreferences: {
      ...(current.sessionPreferences || {}),
      ...prefs,
    },
  });
}

/**
 * Recupera preferências de sessão ativas do usuário
 */
export function getSessionPreferences(userId: string): SessionStatePreferences {
  if (!userId) return {};
  const current = getUserData(userId);
  return current.sessionPreferences || {};
}

/**
 * Exporta banco de dados completo do usuário / aplicação em formato JSON
 */
export function exportFullDatabase(): string {
  try {
    const users = getStoredUsers();
    const activeUserId = getActiveUserId();
    const usersData: Record<string, UserStorageData> = {};

    users.forEach((u) => {
      usersData[u.id] = getUserData(u.id);
    });

    const payload: BackupDataPayload = {
      version: '3.0.0',
      exportedAt: new Date().toISOString(),
      users,
      activeUserId,
      usersData,
    };

    return JSON.stringify(payload, null, 2);
  } catch (err) {
    console.error('Erro ao exportar banco de dados:', err);
    throw err;
  }
}

/**
 * Importa banco de dados completo de backup JSON
 */
export function importFullDatabase(jsonContent: string): {
  success: boolean;
  usersCount: number;
  message: string;
} {
  try {
    const parsed = JSON.parse(jsonContent) as BackupDataPayload;
    if (!parsed || !Array.isArray(parsed.users)) {
      return { success: false, usersCount: 0, message: 'Arquivo de backup inválido ou corrompido.' };
    }

    // Salva usuários
    saveStoredUsers(parsed.users);

    // Salva dados de cada usuário
    if (parsed.usersData) {
      Object.entries(parsed.usersData).forEach(([userId, data]) => {
        saveUserData(userId, data);
      });
    }

    // Restaura usuário ativo
    if (parsed.activeUserId) {
      setActiveUserId(parsed.activeUserId);
    } else if (parsed.users.length > 0) {
      setActiveUserId(parsed.users[0].id);
    }

    return {
      success: true,
      usersCount: parsed.users.length,
      message: `Sucesso! ${parsed.users.length} perfil(is) e dados restaurados perfeitamente.`,
    };
  } catch (err: any) {
    console.error('Erro ao importar backup:', err);
    return {
      success: false,
      usersCount: 0,
      message: `Erro ao importar: ${err?.message || 'Formato JSON inválido.'}`,
    };
  }
}
