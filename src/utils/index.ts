import type { UserDisplay, MessageContent, UserIdentifier, Messages } from "../services/messageQueue"; // Importa UserIdentifier también

// --- Constantes de Claves Originales (para los tipos y como base para extractValue) ---
// Estas deben reflejar las claves exactas de tus tipos UserDisplay, MessageContent, UserIdentifier.
// No deben contener variantes de casing o redundancias como 'displayname' y 'displayName'.
const ORIGINAL_USER_IDENTIFIER_KEYS: Array<keyof UserIdentifier> = ['id'];
const ORIGINAL_USER_DISPLAY_KEYS: Array<keyof UserDisplay> = ['displayName', 'nickname', 'username'];
const ORIGINAL_MESSAGE_CONTENT_KEYS: Array<keyof MessageContent> = ['message', 'content', 'comment', 'text', 'msg'];
function selectValueByPriority<T, K extends keyof T>(
  obj: T,
  priorityKeys: K[]
): T[K] | undefined {
  for (const key of priorityKeys) {
    if (obj[key] !== undefined && obj[key] !== null) {
      return obj[key];
    }
  }
  return undefined;
}

/**
 * Función genérica para extraer un valor de un objeto anidado o con claves opcionales.
 * Transforma todas las claves del objeto a minúsculas para una búsqueda insensible al caso.
 * @param obj El objeto del cual extraer el valor.
 * @param possibleKeys Un array de posibles nombres de clave a buscar. Se asume que estos nombres
 *                     corresponden al casing preferido en tu sistema (ej. camelCase),
 *                     y la función los convertirá a minúsculas para la búsqueda real.
 * @returns El primer valor encontrado para una de las claves, o undefined si no se encuentra nada.
 */
function extractValue<T>(obj: any, possibleKeys: string[]): T | undefined {
  if (typeof obj !== 'object' || obj === null) {
    return undefined;
  }

  // Función auxiliar para normalizar las claves de un objeto a minúsculas
  const normalizeKeysToLowercase = (inputObj: any): { [key: string]: any } => {
    const normalized: { [key: string]: any } = {};
    for (const key in inputObj) {
      if (Object.prototype.hasOwnProperty.call(inputObj, key)) {
        // Manejar el caso donde el valor es un objeto anidado, también normalizamos sus claves
        if (typeof inputObj[key] === 'object' && inputObj[key] !== null && !Array.isArray(inputObj[key])) {
            normalized[key.toLowerCase()] = normalizeKeysToLowercase(inputObj[key]);
        } else {
            normalized[key.toLowerCase()] = inputObj[key];
        }
      }
    }
    return normalized;
  };

  // Normalizar el objeto de entrada a minúsculas de forma recursiva
  const fullyNormalizedObj = normalizeKeysToLowercase(obj);

  // Normalizar también las posibles claves a buscar (ya que las compararemos con las claves normalizadas)
  const normalizedPossibleKeys = possibleKeys.map(key => key.toLowerCase());

  // Función recursiva auxiliar para buscar el valor en el objeto normalizado
  const findValueInNormalizedObjRecursive = (currentObj: any): T | undefined => {
    if (typeof currentObj !== 'object' || currentObj === null) {
      return undefined;
    }

    // Iterar sobre las claves posibles normalizadas
    for (const key of normalizedPossibleKeys) {
      if (currentObj.hasOwnProperty(key) && currentObj[key] !== undefined && currentObj[key] !== null) {
        return currentObj[key] as T;
      }
    }

    // Manejar anidación común: 'data' y 'payload' ya están normalizadas recursivamente
    if (currentObj.hasOwnProperty('data') && typeof currentObj.data === 'object') {
        const foundInData = findValueInNormalizedObjRecursive(currentObj.data);
        if (foundInData !== undefined) return foundInData;
    }

    if (currentObj.hasOwnProperty('payload') && typeof currentObj.payload === 'object') {
        const foundInPayload = findValueInNormalizedObjRecursive(currentObj.payload);
        if (foundInPayload !== undefined) return foundInPayload;
    }

    return undefined;
  };

  return findValueInNormalizedObjRecursive(fullyNormalizedObj);
}


/**
 * Procesa un objeto de respuesta de la IA para extraer la información de Messages.
 * Utiliza 'extractValue' para buscar los campos de forma insensible al caso y anidada.
 * @param iaResponse El objeto de respuesta de la IA.
 * @returns Un objeto Messages con la información extraída.
 */
function processIaResponse(iaResponse: any): Messages {
  const result: Messages = {};

  // Extraer el ID principal y uniqueId. Ya que extractValue busca el primero,
  // aquí estamos rellenando solo los campos a los que apunta.
  result.id = extractValue<string>(iaResponse, ORIGINAL_USER_IDENTIFIER_KEYS as string[]);
  // El uniqueId lo extraeremos de la misma forma, si existe y no es el mismo que 'id'
  result.uniqueId = extractValue<string>(iaResponse, ORIGINAL_USER_IDENTIFIER_KEYS.filter(k => k !== 'id') as string[]);


  // Para los campos de UserDisplay, extraemos uno por uno de sus posibles nombres
  result.nickname = extractValue<string>(iaResponse, ORIGINAL_USER_DISPLAY_KEYS as string[]);
  result.displayName = extractValue<string>(iaResponse, ORIGINAL_USER_DISPLAY_KEYS as string[]);
  result.username = extractValue<string>(iaResponse, ORIGINAL_USER_DISPLAY_KEYS as string[]);


  // Extraer MessageContent de forma similar
  result.comment = extractValue<string>(iaResponse, ORIGINAL_MESSAGE_CONTENT_KEYS as string[]);
  result.content = extractValue<string>(iaResponse, ORIGINAL_MESSAGE_CONTENT_KEYS as string[]);
  result.message = extractValue<string>(iaResponse, ORIGINAL_MESSAGE_CONTENT_KEYS as string[]);
  result.msg = extractValue<string>(iaResponse, ORIGINAL_MESSAGE_CONTENT_KEYS as string[]);
  result.text = extractValue<string>(iaResponse, ORIGINAL_MESSAGE_CONTENT_KEYS as string[]);

  return result;
}

// --- Lógica para seleccionar el mensaje y el nombre para la voz ---

// Estas claves son para selectValueByPriority, que opera sobre el objeto Messages ya procesado.
// Aquí es donde defines tus prioridades de QUÉ campo de 'Messages' quieres usar.
// Ahora sí, si quieres que 'uniqueId' sea un fallback para el nombre a mostrar, ¡aquí es donde va!
const preferredUserDisplayNameKeys: Array<keyof Messages> = [ // Cambiar a keyof Messages
  "displayName",
  "nickname",
  "username",
  "uniqueId", // Incluido como un identificador final si no hay nombre de display
];

// Prioridades para MessageContent (operan sobre Messages)
const preferredMessageContentKeys: Array<keyof Messages> = [ // Cambiar a keyof Messages
  "message",
  "content",
  "comment",
  "text",
  "msg",
];

// Usando la función selectValueByPriority:
function contentTEXT(processedMessage: Messages) {
  const selectedDisplayName = selectValueByPriority(
    processedMessage,
    preferredUserDisplayNameKeys
  );
  const selectedMessageContent = selectValueByPriority(
    processedMessage,
    preferredMessageContentKeys
  );
  return {
    user: selectedDisplayName,
    msg: selectedMessageContent,
  };
}
export { contentTEXT, processIaResponse };