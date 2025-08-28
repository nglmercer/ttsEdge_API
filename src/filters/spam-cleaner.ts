// spam-cleaner.ts - Versión Mejorada

interface CleanerOptions {
  minRepetitions?: number;  // Mínimo de repeticiones para considerar spam
  maxLength?: number;       // Longitud máxima del mensaje final
  preserveSpacing?: boolean; // Mantener espaciado original
  caseSensitive?: boolean;  // Sensible a mayúsculas/minúsculas
}

interface CleanerResult {
  original: string;
  cleaned: string;
  wasSpam: boolean;
  repetitionsFound: number;
  pattern?: string;
  reductionPercentage: number;
}

class SpamCleaner {
  private options: Required<CleanerOptions>;

  constructor(options: CleanerOptions = {}) {
    this.options = {
      minRepetitions: 3,
      maxLength: 200,
      preserveSpacing: true,
      caseSensitive: false,
      ...options
    };
  }

  /**
   * Limpia un mensaje eliminando repeticiones spam
   */
  clean(message: string): CleanerResult {
    const original = message;
    let cleaned = message.trim();
    
    if (!cleaned) {
      return this.createResult(original, '', false, 0);
    }

    // First clean URLs
    cleaned = this.cleanUrls(cleaned);
    
    // Aplicar limpieza en cascada - orden importa
    let currentText = cleaned;
    let totalRepetitions = 0;
    let wasSpam = false;
    let mainPattern = '';

    // 1. Limpiar caracteres repetidos primero (más específico)
    const charResult = this.cleanRepeatedChars(currentText);
    if (charResult.wasSpam) {
      currentText = charResult.cleaned;
      totalRepetitions = Math.max(totalRepetitions, charResult.repetitionsFound);
      wasSpam = true;
      mainPattern = mainPattern || charResult.pattern || '';
    }

    // 2. Limpiar frases repetidas
    const phraseResult = this.cleanRepeatedPhrases(currentText);
    if (phraseResult.wasSpam) {
      currentText = phraseResult.cleaned;
      totalRepetitions = Math.max(totalRepetitions, phraseResult.repetitionsFound);
      wasSpam = true;
      mainPattern = mainPattern || phraseResult.pattern || '';
    }

    // 3. Limpiar palabras repetidas (más general)
    const wordResult = this.cleanRepeatedWords(currentText);
    if (wordResult.wasSpam) {
      currentText = wordResult.cleaned;
      totalRepetitions = Math.max(totalRepetitions, wordResult.repetitionsFound);
      wasSpam = true;
      mainPattern = mainPattern || wordResult.pattern || '';
    }

    // Truncar si excede longitud máxima
    if (currentText.length > this.options.maxLength) {
      currentText = currentText.substring(0, this.options.maxLength - 3) + '...';
    }

    return this.createResult(original, currentText, wasSpam, totalRepetitions, mainPattern);
  }

  /**
   * Removes URLs from text
   */
  private cleanUrls(text: string): string {
    // Remove URLs with protocol
    text = text.replace(/(https?:\/\/[^\s]+)/gi, '');
    
    // Remove common URL patterns without protocol
    text = text.replace(/(www\.[^\s]+)/gi, '');
    text = text.replace(/([^\s]+\.(com|net|org|edu|gov|mil|info|biz|tv)([^\s]*)?)/gi, '');
    
    // Remove Twitch specific patterns
    text = text.replace(/([^\s]+\.twitch\.[^\s]+)/gi, '');
    text = text.replace(/tmi\.twitch\.tv/gi, '');
    text = text.replace(/#[a-zA-Z0-9_]+/g, ''); // Remove channel names
    text = text.replace(/:[a-zA-Z0-9_]+\.[^\s]+/g, ''); // Remove colon prefixed domains
    
    // Clean up any double spaces left after URL removal
    return text.replace(/\s+/g, ' ').trim();
  }

  /**
   * Limpia palabras repetidas consecutivas
   */
  private cleanRepeatedWords(text: string): CleanerResult {
    const words = text.split(/\s+/);
    if (words.length < this.options.minRepetitions) {
      return this.createResult(text, text, false, 0);
    }

    const cleaned: string[] = [];
    let maxRepetitions = 0;
    let spamPattern = '';
    let i = 0;

    while (i < words.length) {
      const currentWord = words[i];
      let repetitionCount = 1;
      
      // Contar repeticiones consecutivas
      while (i + repetitionCount < words.length) {
        const nextWord = words[i + repetitionCount];
        const current = this.options.caseSensitive ? currentWord : currentWord.toLowerCase();
        const next = this.options.caseSensitive ? nextWord : nextWord.toLowerCase();
        
        if (current === next) {
          repetitionCount++;
        } else {
          break;
        }
      }

      if (repetitionCount >= this.options.minRepetitions) {
        // Es spam - solo agregar una instancia
        cleaned.push(currentWord);
        maxRepetitions = Math.max(maxRepetitions, repetitionCount);
        spamPattern = currentWord;
        i += repetitionCount;
      } else {
        // No es spam - agregar todas las palabras de esta secuencia
        for (let j = 0; j < repetitionCount; j++) {
          cleaned.push(words[i + j]);
        }
        i += repetitionCount;
      }
    }

    const result = cleaned.join(' ');
    return this.createResult(text, result, maxRepetitions >= this.options.minRepetitions, maxRepetitions, spamPattern);
  }

  /**
   * Limpia frases repetidas mejorada
   */
  private cleanRepeatedPhrases(text: string): CleanerResult {
    const words = text.split(/\s+/);
    
    // Probar diferentes longitudes de frases (de más larga a más corta)
    for (let phraseLength = Math.min(5, Math.floor(words.length / this.options.minRepetitions)); phraseLength >= 2; phraseLength--) {
      const result = this.findAndCleanRepeatedPhrase(text, phraseLength);
      if (result.wasSpam) {
        return result;
      }
    }

    return this.createResult(text, text, false, 0);
  }

  private findAndCleanRepeatedPhrase(text: string, phraseLength: number): CleanerResult {
    const words = text.split(/\s+/);
    if (words.length < phraseLength * this.options.minRepetitions) {
      return this.createResult(text, text, false, 0);
    }

    // Buscar secuencias consecutivas de frases repetidas
    for (let i = 0; i <= words.length - phraseLength * this.options.minRepetitions; i++) {
      const phrase = words.slice(i, i + phraseLength).join(' ');
      let repetitions = 1;
      let nextIndex = i + phraseLength;

      // Contar repeticiones consecutivas de esta frase
      while (nextIndex + phraseLength <= words.length) {
        const nextPhrase = words.slice(nextIndex, nextIndex + phraseLength).join(' ');
        const currentNorm = this.options.caseSensitive ? phrase : phrase.toLowerCase();
        const nextNorm = this.options.caseSensitive ? nextPhrase : nextPhrase.toLowerCase();
        
        if (currentNorm === nextNorm) {
          repetitions++;
          nextIndex += phraseLength;
        } else {
          break;
        }
      }

      if (repetitions >= this.options.minRepetitions) {
        // Construir el texto limpio
        const before = words.slice(0, i).join(' ');
        const after = words.slice(i + phraseLength * repetitions).join(' ');
        const cleanedParts = [before, phrase, after].filter(part => part.trim().length > 0);
        const cleaned = cleanedParts.join(' ');
        
        return this.createResult(text, cleaned, true, repetitions, phrase);
      }
    }

    return this.createResult(text, text, false, 0);
  }

  /**
   * Limpia caracteres repetidos excesivos mejorada
   */
  private cleanRepeatedChars(text: string): CleanerResult {
    let maxRepetitions = 0;
    let spamChar = '';
    let cleaned = text;
    
    // Buscar secuencias de caracteres repetidos
    const matches = text.match(/(.)\1{2,}/g);
    
    if (matches) {
      for (const match of matches) {
        if (match.length >= this.options.minRepetitions) {
          maxRepetitions = Math.max(maxRepetitions, match.length);
          spamChar = match[0];
        }
      }
      
      if (maxRepetitions >= this.options.minRepetitions) {
        // Reducir repeticiones excesivas a máximo 2
        cleaned = text.replace(/(.)\1{2,}/g, (match, char) => {
          return match.length >= this.options.minRepetitions ? char + char : match;
        });
      }
    }

    return this.createResult(text, cleaned, maxRepetitions >= this.options.minRepetitions, maxRepetitions, spamChar);
  }

  private createResult(original: string, cleaned: string, wasSpam: boolean, repetitions: number, pattern?: string): CleanerResult {
    const reductionPercentage = original.length > 0 
      ? Math.round((1 - cleaned.length / original.length) * 100) 
      : 0;
    
    return {
      original,
      cleaned,
      wasSpam,
      repetitionsFound: repetitions,
      pattern,
      reductionPercentage
    };
  }

  /**
   * Procesa múltiples mensajes en lote
   */
  cleanBatch(messages: string[]): CleanerResult[] {
    return messages.map(message => this.clean(message));
  }

  /**
   * Actualiza las opciones del limpiador
   */
  updateOptions(newOptions: Partial<CleanerOptions>): void {
    this.options = { ...this.options, ...newOptions };
  }
}

// Función de conveniencia para crear instancias
function createCleaner(options?: CleanerOptions): SpamCleaner {
  return new SpamCleaner(options);
}

// Función de limpieza rápida
function quickClean(message: string, options?: CleanerOptions): string {
  const cleaner = new SpamCleaner(options);
  if(isUrl(message)){
    console.log("isUrl",message)
    return ''
  }
  return cleaner.clean(message).cleaned;
}

/**
 * Checks if a string is a URL
 */
function isUrl(text: string): boolean {
  try {
    new URL(text);
    return true;
  } catch {
    // Check for common URL patterns without protocol
    const urlPattern = /^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+([/?].*)?$/i;
    return urlPattern.test(text);
  }
}

export { SpamCleaner, createCleaner, quickClean };