import { DeliveryData, AssociationArea, AssociationMemoryRecord } from '../types';

export interface MatchResult {
  matched: boolean;
  association?: AssociationArea;
  matchType?: 'memoria_destinatario' | 'regra_morador' | 'rua' | 'bairro' | 'cerca_virtual';
  matchDetail?: string;
  memoryRecord?: AssociationMemoryRecord;
}

/**
 * Normalizes text by converting to lowercase, removing accents and special characters.
 */
export function normalizeText(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Strips common Brazilian street type prefixes to compare the actual street core name.
 */
export function extractStreetCoreName(streetStr: string): string {
  let norm = normalizeText(streetStr);
  if (!norm) return '';
  // Strip numbers at end or after comma for street matching if present
  norm = norm.split(/,|\bnº\b|\bnumero\b|\bnum\b|\bn°\b/)[0].trim();
  // Strip common street prefixes
  norm = norm.replace(/^(rua|r|avenida|av|alameda|al|travessa|tv|praca|paca|pca|condominio|cond|residencial|res)\s+/i, '');
  return norm.trim();
}

/**
 * Strict street comparison between package street and association street rule.
 */
export function isStrictStreetMatch(pkgStreet: string, assocStreet: string): boolean {
  const pkgCore = extractStreetCoreName(pkgStreet);
  const assocCore = extractStreetCoreName(assocStreet);

  if (!pkgCore || !assocCore || assocCore.length < 2) return false;

  // 1. Exact core match
  if (pkgCore === assocCore) return true;

  // 2. Strict word boundary match (e.g. assocCore = "das flores", pkgCore = "das flores 120" or "das flores bloco b")
  const escapedAssoc = assocCore.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const boundaryRegex = new RegExp(`(?:^|\\b)${escapedAssoc}(?:$|\\b)`, 'i');

  return boundaryRegex.test(pkgCore);
}

/**
 * Strict morador (resident name) comparison.
 */
export function isStrictMoradorMatch(pkgRecipient: string, moradorRule: string): boolean {
  const normPkg = normalizeText(pkgRecipient);
  const normRule = normalizeText(moradorRule);

  if (!normPkg || !normRule || normRule.length < 3) return false;

  if (normPkg === normRule) return true;

  // Match full name token if rule is at least 4 characters long
  if (normRule.length >= 4) {
    const escapedRule = normRule.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`(?:^|\\b)${escapedRule}(?:$|\\b)`, 'i');
    if (regex.test(normPkg)) return true;
  }

  return false;
}

/**
 * Strict neighborhood comparison.
 */
export function isStrictBairroMatch(pkgBairro: string, assocBairro: string): boolean {
  const normPkg = normalizeText(pkgBairro);
  const normAssoc = normalizeText(assocBairro);

  if (!normPkg || !normAssoc || normAssoc.length < 3) return false;

  if (normPkg === normAssoc) return true;

  if (normAssoc.length >= 4) {
    const escaped = normAssoc.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`(?:^|\\b)${escaped}(?:$|\\b)`, 'i');
    if (regex.test(normPkg)) return true;
  }

  return false;
}

/**
 * Strict memory record comparison.
 */
export function isStrictMemoryMatch(
  pkgRecipient: string,
  pkgAddress: string,
  pkgBairro: string,
  mem: AssociationMemoryRecord
): boolean {
  const normPkgName = normalizeText(pkgRecipient);
  const normMemName = normalizeText(mem.nome_destinatario);

  if (!normPkgName || !normMemName) return false;

  const nameMatch = isStrictMoradorMatch(pkgRecipient, mem.nome_destinatario);
  if (!nameMatch) return false;

  const addrMatch = mem.endereco ? isStrictStreetMatch(pkgAddress, mem.endereco) : true;
  const bairroMatch = mem.bairro ? isStrictBairroMatch(pkgBairro, mem.bairro) : true;

  return nameMatch && (addrMatch || bairroMatch);
}

export interface CategorizacaoResult {
  tipo: 'RUA_COMUM' | 'ASSOCIAÇÃO';
  nomeGrupo: string;
  idAssociacao?: string;
  associacao?: AssociationArea;
}

/**
 * Categoriza estritamente um pacote entre ASSOCIAÇÃO ou RUA COMUM (evitando captura fantasma).
 */
export function categorizarPacote(
  pacote: {
    id?: string;
    codigo_pacote?: string;
    endereco?: string;
    destinatario?: string;
    nomeRua?: string;
    rua?: string;
    endereco_completo?: string;
    endereco_rua?: string;
    nome_destinatario?: string;
  },
  associacoesCadastradas: AssociationArea[]
): CategorizacaoResult {
  const pacoteId = pacote.id || pacote.codigo_pacote || 'Pacote sem ID';
  const pacoteRua =
    pacote.rua ||
    pacote.nomeRua ||
    pacote.endereco_rua ||
    (pacote.endereco || pacote.endereco_completo || '').split(',')[0].trim() ||
    'Rua Não Identificada';

  const enderecoLimpo = (pacote.endereco || pacote.endereco_completo || pacote.endereco_rua || '').toLowerCase().trim();
  const nomeMorador = (pacote.destinatario || pacote.nome_destinatario || '').toLowerCase().trim();

  // Se não houver associações cadastradas, é RUA COMUM direto
  if (!associacoesCadastradas || associacoesCadastradas.length === 0) {
    const categoriaFinal = 'RUA_COMUM';
    console.log(`[Categorização LogiScan] Pacote: ${pacoteId} | Rua: ${pacoteRua} -> Resultado: ${categoriaFinal}`);
    return { tipo: 'RUA_COMUM', nomeGrupo: pacoteRua };
  }

  // Percorre as associações procurando MATCH ESTRITO
  for (const assoc of associacoesCadastradas) {
    const ruas = assoc.ruasVinculadas || assoc.ruas || [];
    const moradores = assoc.moradoresVinculados || assoc.moradores || [];

    // 1. Verifica se alguma rua cadastrada na associação BATE EXATAMENTE com a rua do pacote
    const matchRua = ruas.some((ruaAssoc) => {
      const ruaLimpa = ruaAssoc.toLowerCase().trim();
      return ruaLimpa.length > 3 && (enderecoLimpo.includes(ruaLimpa) || isStrictStreetMatch(enderecoLimpo, ruaLimpa));
    });

    // 2. Verifica se algum morador cadastrado BATE EXATAMENTE
    const matchMorador = moradores.some((m) => {
      const mLimpo = m.toLowerCase().trim();
      return mLimpo.length > 3 && (nomeMorador.includes(mLimpo) || isStrictMoradorMatch(nomeMorador, mLimpo));
    });

    if (matchRua || matchMorador) {
      const categoriaFinal = 'ASSOCIAÇÃO';
      console.log(`[Categorização LogiScan] Pacote: ${pacoteId} | Rua: ${pacoteRua} -> Resultado: ${categoriaFinal}`);
      return { tipo: 'ASSOCIAÇÃO', nomeGrupo: assoc.nome, idAssociacao: assoc.id, associacao: assoc };
    }
  }

  // FALLBACK OBRIGATÓRIO: Se não deu match perfeito em nada, É RUA COMUM!
  const categoriaFinal = 'RUA_COMUM';
  console.log(`[Categorização LogiScan] Pacote: ${pacoteId} | Rua: ${pacoteRua} -> Resultado: ${categoriaFinal}`);
  return { tipo: 'RUA_COMUM', nomeGrupo: pacoteRua };
}

/**
 * Searches for an Association match for a given package delivery using strict exact/boundary matching.
 */
export function matchDeliveryToAssociation(
  delivery: Partial<DeliveryData>,
  associations: AssociationArea[],
  memoryRecords: AssociationMemoryRecord[] = []
): MatchResult {
  const recipientName = (delivery.nome_destinatario || delivery.recebedor_detalhes || '').trim();
  const streetName = (delivery.endereco_rua || delivery.endereco_completo || '').trim();
  const neighborhood = (delivery.bairro || '').trim();

  // 1. Check Historical Learned Memory
  if (recipientName && memoryRecords.length > 0) {
    const memoryMatch = memoryRecords.find((rec) =>
      isStrictMemoryMatch(recipientName, streetName, neighborhood, rec)
    );

    if (memoryMatch) {
      const assoc = associations.find(
        (a) => a.id === memoryMatch.associacao_id || a.nome === memoryMatch.associacao_nome
      );
      if (assoc) {
        const pId = delivery.codigo_pacote || 'Pacote sem ID';
        const pRua = streetName || 'Rua Não Identificada';
        console.log(`[Categorização LogiScan] Pacote: ${pId} | Rua: ${pRua} -> Resultado: ASSOCIAÇÃO`);
        return {
          matched: true,
          association: assoc,
          matchType: 'memoria_destinatario',
          matchDetail: `Memória Aprendida: ${memoryMatch.nome_destinatario} -> ${assoc.nome}`,
          memoryRecord: memoryMatch,
        };
      }
    }
  }

  // 2. Strict Rule Categorization via categorizarPacote
  const cat = categorizarPacote(
    {
      id: delivery.codigo_pacote,
      rua: streetName,
      endereco: delivery.endereco_completo || streetName,
      destinatario: recipientName,
      endereco_completo: delivery.endereco_completo,
      endereco_rua: delivery.endereco_rua,
      nome_destinatario: delivery.nome_destinatario,
    },
    associations
  );

  if (cat.tipo === 'ASSOCIAÇÃO' && cat.associacao) {
    return {
      matched: true,
      association: cat.associacao,
      matchType: 'rua',
      matchDetail: `Regra Estrita de Associação: ${cat.nomeGrupo}`,
    };
  }

  return { matched: false };
}

/**
 * Creates or updates a memory mapping [Nome + Endereço] -> [Associação]
 */
export function createMemoryRecord(
  recipientName: string,
  address: string,
  associationId: string,
  associationName: string,
  neighborhood?: string,
  origin: 'manual' | 'ia' | 'historico' = 'manual'
): AssociationMemoryRecord {
  return {
    id: `mem_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
    nome_destinatario: recipientName.trim(),
    endereco: address.trim(),
    bairro: neighborhood ? neighborhood.trim() : undefined,
    associacao_id: associationId,
    associacao_nome: associationName,
    data_vinculo: new Date().toLocaleDateString('pt-BR'),
    origem: origin,
  };
}

