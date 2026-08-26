import { DeliveryData } from '../types';

/**
 * Retorna a data formatada no padrão DD/MM/AAAA (ex: 18/08/2026) usando horário local real
 */
export function getFormattedCurrentDate(date?: Date | string): string {
  const d = date ? new Date(date) : new Date();
  if (isNaN(d.getTime())) {
    const fallback = new Date();
    const day = String(fallback.getDate()).padStart(2, '0');
    const month = String(fallback.getMonth() + 1).padStart(2, '0');
    const year = fallback.getFullYear();
    return `${day}/${month}/${year}`;
  }
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Retorna o horário formatado no padrão HH:MM (ex: 13:05) usando horário local real exato
 */
export function getFormattedCurrentTime(date?: Date | string): string {
  const d = date ? new Date(date) : new Date();
  if (isNaN(d.getTime())) {
    const fallback = new Date();
    const hours = String(fallback.getHours()).padStart(2, '0');
    const minutes = String(fallback.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Constrói a mensagem de texto pronta para o WhatsApp de ENTREGA INDIVIDUAL REALIZADA
 */
export function buildWhatsAppMessage(
  delivery: DeliveryData,
  options?: {
    customReceiver?: string;
    customTime?: string;
    customDate?: string;
  }
): string {
  const clientName = delivery.nome_destinatario || 'Cliente';
  const streetName = delivery.endereco_rua || delivery.endereco_completo?.split(',')[0]?.trim() || 'Rua';
  const houseNumber = delivery.numero_casa || delivery.endereco_numero || 'S/N';
  const complement = delivery.complemento || delivery.endereco_complemento || '';
  
  let fullAddress = `${streetName}, ${houseNumber}`;
  if (complement && complement.trim()) {
    fullAddress += ` (${complement.trim()})`;
  }

  let code = delivery.codigo_pacote || '';
  if (code && !code.startsWith('#')) {
    code = `#${code}`;
  }

  const date = options?.customDate || getFormattedCurrentDate(new Date());
  const time = options?.customTime || getFormattedCurrentTime(new Date());
  
  let receiver = 'Próprio Morador';
  if (options?.customReceiver !== undefined && options.customReceiver.trim() !== '') {
    receiver = options.customReceiver.trim();
  } else if (delivery.recebedor_detalhes && delivery.recebedor_detalhes.trim() !== '') {
    receiver = delivery.recebedor_detalhes.trim();
  }

  let msg = `📦 *Entrega realizada*\n`;
  msg += `👤 *Cliente:* ${clientName}\n`;
  msg += `🤝 *Recebedor:* ${receiver}\n`;
  msg += `📍 *Endereço:* ${fullAddress}\n`;
  if (code) {
    msg += `🏷️ *Pacote:* ${code}\n`;
  }
  msg += `📅 *Data:* ${date}\n`;
  msg += `⏰ *Horário:* ${time}`;

  return msg;
}

/**
 * Constrói a mensagem para MÚLTIPLOS PACOTES DO MESMO NÚMERO / PORTARIA
 * Agrega todos os pacotes e nomes dos recebedores em uma mensagem consolidada
 */
export function buildGroupedWhatsAppMessage(
  deliveries: DeliveryData[],
  options?: {
    customReceiver?: string;
    customTime?: string;
    customDate?: string;
    streetName?: string;
    houseNumber?: string;
  }
): string {
  if (deliveries.length === 0) return '';
  if (deliveries.length === 1) {
    return buildWhatsAppMessage(deliveries[0], options);
  }

  const first = deliveries[0];
  const streetName = options?.streetName || first.endereco_rua || first.endereco_completo?.split(',')[0]?.trim() || 'Rua';
  const houseNumber = options?.houseNumber || first.numero_casa || first.endereco_numero || 'S/N';
  const fullAddress = `${streetName}, Nº ${houseNumber}`;

  const date = options?.customDate || getFormattedCurrentDate(new Date());
  const time = options?.customTime || getFormattedCurrentTime(new Date());

  let receiver = options?.customReceiver || 'Portaria / Morador';

  let msg = `📦 *Entrega realizada (Múltiplos Pacotes)*\n`;
  msg += `📍 *Endereço:* ${fullAddress}\n`;
  msg += `🤝 *Recebedor:* ${receiver}\n`;
  msg += `📦 *Total de Pacotes:* ${deliveries.length} volumes\n\n`;
  msg += `👥 *Pacotes & Destinatários:*\n`;

  deliveries.forEach((d, idx) => {
    const name = d.nome_destinatario || d.recebedor_detalhes || 'Morador';
    let code = d.codigo_pacote || '';
    if (code && !code.startsWith('#')) code = `#${code}`;
    const comp = d.complemento || d.endereco_complemento ? ` (${d.complemento || d.endereco_complemento})` : '';
    msg += `${idx + 1}. *${name}* - ${code}${comp}\n`;
  });

  msg += `\n📅 *Data:* ${date}\n`;
  msg += `⏰ *Horário:* ${time}`;

  return msg;
}

/**
 * Constrói a mensagem para a LISTA DA ASSOCIAÇÃO DE MORADORES
 * Agrupa pessoas com o mesmo nome automaticamente somando a quantidade de pacotes
 */
export function buildAssociationWhatsAppMessage(
  associationName: string,
  groupedNames: Array<{ name: string; count: number; codes?: string[] }>,
  options?: {
    customDate?: string;
    customTime?: string;
    responsavel?: string;
  }
): string {
  const date = options?.customDate || getFormattedCurrentDate(new Date());
  const time = options?.customTime || getFormattedCurrentTime(new Date());
  const local = associationName || 'Associação de Moradores';
  
  const totalPackages = groupedNames.reduce((acc, curr) => acc + curr.count, 0);
  const totalNames = groupedNames.length;

  let msg = `📋 *Lista de Encomendas - Associação*\n`;
  msg += `🏘️ *Local:* ${local}\n`;
  if (options?.responsavel) {
    msg += `👩 *A/C:* ${options.responsavel}\n`;
  }
  msg += `📦 *Total de Pacotes:* ${totalPackages} volumes (${totalNames} destinatários)\n`;
  msg += `📅 *Data:* ${date} às ${time}\n\n`;
  msg += `📝 *Relação de Nomes:*\n`;

  groupedNames.forEach((item, idx) => {
    const pkgText = item.count > 1 ? `(${item.count} pacotes)` : `(1 pacote)`;
    const codesText = item.codes && item.codes.length > 0 ? ` [${item.codes.join(', ')}]` : '';
    msg += `${idx + 1}. *${item.name}* ${pkgText}${codesText}\n`;
  });

  msg += `\nFavor conferir os volumes na entrega. Muito obrigado! 🙏`;

  return msg;
}

/**
 * Constrói a mensagem de RESUMO GERAL DAS RUAS E TOTAIS DO DIA
 */
export function buildDailySummaryWhatsAppMessage(
  stats: {
    total: number;
    delivered: number;
    pending: number;
    insucesso: number;
    streets: Array<{ name: string; total: number; delivered: number; insucesso: number; pending: number }>;
  },
  dateStr?: string
): string {
  const date = dateStr || getFormattedCurrentDate(new Date());
  const time = getFormattedCurrentTime(new Date());
  const percent = stats.total > 0 ? Math.round((stats.delivered / stats.total) * 100) : 0;

  let msg = `📊 *Resumo de Entregas do Dia - LogiScan*\n`;
  msg += `📅 *Data:* ${date} (${time})\n\n`;
  msg += `📦 *Total Geral de Pacotes:* ${stats.total}\n`;
  msg += `✅ *Entregues:* ${stats.delivered} (${percent}%)\n`;
  msg += `⏳ *Pendentes:* ${stats.pending}\n`;
  if (stats.insucesso > 0) {
    msg += `⚠️ *Insucessos:* ${stats.insucesso}\n`;
  }
  msg += `🛣️ *Total de Ruas:* ${stats.streets.length}\n\n`;

  msg += `📍 *Status por Rua:*\n`;
  stats.streets.forEach((st, idx) => {
    const isDone = st.delivered === st.total && st.total > 0;
    const icon = isDone ? '✅' : st.insucesso > 0 ? '⚠️' : '⏳';
    msg += `${idx + 1}. *${st.name}*: ${st.delivered}/${st.total} entregues ${icon}\n`;
  });

  return msg;
}

/**
 * Constrói a mensagem de INSUCESSO DE ENTREGA
 */
export function buildInsucessoWhatsAppMessage(
  delivery: DeliveryData,
  motivo: string,
  options?: {
    customTime?: string;
    customDate?: string;
  }
): string {
  const clientName = delivery.nome_destinatario || 'Cliente';
  const streetName = delivery.endereco_rua || delivery.endereco_completo?.split(',')[0]?.trim() || 'Rua';
  const houseNumber = delivery.numero_casa || delivery.endereco_numero || 'S/N';
  const complement = delivery.complemento || delivery.endereco_complemento || '';
  
  let fullAddress = `${streetName}, ${houseNumber}`;
  if (complement && complement.trim()) {
    fullAddress += ` (${complement.trim()})`;
  }

  let code = delivery.codigo_pacote || '';
  if (code && !code.startsWith('#')) {
    code = `#${code}`;
  }

  const date = options?.customDate || getFormattedCurrentDate(new Date());
  const time = options?.customTime || getFormattedCurrentTime(new Date());

  let msg = `⚠️ *Insucesso de Entrega*\n`;
  msg += `👤 *Cliente:* ${clientName}\n`;
  msg += `📍 *Endereço:* ${fullAddress}\n`;
  if (code) {
    msg += `🏷️ *Pacote:* ${code}\n`;
  }
  msg += `❌ *Motivo:* ${motivo || 'Morador ausente / Ninguém atende'}\n`;
  msg += `📅 *Data:* ${date}\n`;
  msg += `⏰ *Horário:* ${time}`;

  return msg;
}

/**
 * Compartilha ou abre direto no WhatsApp
 */
export async function shareOrOpenWhatsApp(message: string): Promise<{ success: boolean; method: 'share' | 'whatsapp' | 'clipboard' }> {
  await copyTextToClipboard(message);

  if (navigator.share) {
    try {
      await navigator.share({
        text: message,
      });
      return { success: true, method: 'share' };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return { success: true, method: 'share' };
      }
    }
  }

  try {
    openWhatsAppWithText(message);
    return { success: true, method: 'whatsapp' };
  } catch (_e) {
    return { success: true, method: 'clipboard' };
  }
}

/**
 * Abre o WhatsApp preenchendo a caixa de texto
 */
export function openWhatsAppWithText(message: string): void {
  const encodedText = encodeURIComponent(message);
  const webUrl = `https://api.whatsapp.com/send?text=${encodedText}`;
  
  const link = document.createElement('a');
  link.href = webUrl;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Copia texto para a área de transferência
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error('Erro ao copiar texto:', err);
    return false;
  }
}
