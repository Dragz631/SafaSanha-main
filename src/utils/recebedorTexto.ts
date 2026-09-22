/**
 * Limpa e formata o nome de um porteiro/zelador digitado pelo operador.
 * Ex: "Portaria (José)" -> "José"; "Zelador Marcos" -> "Marcos"
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
