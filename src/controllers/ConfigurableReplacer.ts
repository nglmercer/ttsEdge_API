// Archivo: ConfigurableReplacer.ts

// Tipos para las opciones de configuración
interface ReplacementOption {
  dataKey: string;
  defaultValue: string;
}

interface ReplacementConfig {
  [pattern: string]: ReplacementOption;
}

interface LocalStorageKeys {
  playerName: string[];
  [key: string]: string[];
}

interface ConfigOptions {
  instanceId?: string;
  replacements?: ReplacementConfig;
  removeBackslashes?: boolean;
  useLocalStorage?: boolean; // Mantener para control externo, pero la clase no lo usará directamente
  localStorageKeys?: LocalStorageKeys;
}

interface Config {
  instanceId: string;
  replacements: ReplacementConfig;
  removeBackslashes: boolean;
  useLocalStorage: boolean; // Mantener para ser parte de la configuración, si se guarda/carga
  localStorageKeys: LocalStorageKeys;
}

// Tipo para los datos de entrada
interface ReplacementData {
  [key: string]: string | number | undefined;
}

// Tipo para el mapeo de reemplazos
interface ReplacementMapping {
  original: string;
  dataKey: string;
  replaced: string;
}

// Tipo para el resultado con tracking
interface ReplacementResult {
  result: any;
  replacementMap: Map<string, ReplacementMapping>;
}

// Tipos de entrada permitidos para el procesamiento recursivo
type ProcessableInput = string | number | boolean | null | undefined | ProcessableInput[] | { [key: string]: ProcessableInput };

class ConfigurableReplacer {
  public config: Config;

  constructor(options: ConfigOptions = {}) {
    // Establece los valores predeterminados. La carga de localStorage se hará externamente.
    this.config = {
      instanceId: options.instanceId || "default",
      replacements: options.replacements || this.getDefaultReplacements(),
      removeBackslashes: options.removeBackslashes !== undefined ? options.removeBackslashes : true,
      useLocalStorage: options.useLocalStorage !== undefined ? options.useLocalStorage : false, // Por defecto, no usar localStorage
      localStorageKeys: options.localStorageKeys || {
        playerName: ["playerNameInput", "playerName"],
      },
    };
  }

  public getDefaultReplacements(): ReplacementConfig {
    return {
      uniqueId: { dataKey: "uniqueId", defaultValue: "testUser" },
      uniqueid: { dataKey: "uniqueId", defaultValue: "testUser" },
      nickname: { dataKey: "nickname", defaultValue: "testUser" },
      comment: { dataKey: "comment", defaultValue: "testComment" },
      content: { dataKey: "content", defaultValue: "testMessage" },
      "{milestoneLikes}": { dataKey: "likeCount", defaultValue: "50testLikes" },
      "{likes}": { dataKey: "likeCount", defaultValue: "50testLikes" },
      message: { dataKey: "comment", defaultValue: "testcomment" },
      giftName: { dataKey: "giftName", defaultValue: "testgiftName" },
      giftname: { dataKey: "giftName", defaultValue: "testgiftName" },
      repeatCount: { dataKey: "repeatCount", defaultValue: "123" },
      repeatcount: { dataKey: "repeatCount", defaultValue: "123" },
      playername: { dataKey: "playerName", defaultValue: "@a" },
      diamonds: { dataKey: "diamondCount", defaultValue: "50testDiamonds" },
      likecount: { dataKey: "likeCount", defaultValue: "50testLikes" },
      followRole: { dataKey: "followRole", defaultValue: "followRole 0" },
      userId: { dataKey: "userId", defaultValue: "1235646" },
      teamMemberLevel: { dataKey: "teamMemberLevel", defaultValue: "teamMemberLevel 0" },
      subMonth: { dataKey: "subMonth", defaultValue: "subMonth 0" },
      user: {dataKey: "user", defaultValue: ""},
      msg: { dataKey: "msg", defaultValue: ""},
    };
  }

  // Métodos para cargar y guardar la configuración, ahora estáticos o movidos fuera.
  // La clase ConfigurableReplacer ya no contiene la lógica directa de localStorage.

  public replaceWithTracking(input: ProcessableInput, data: ReplacementData = {}): ReplacementResult {
    const replacementMap = new Map<string, ReplacementMapping>();
    const result = this.processRecursivelyWithTracking(input, data, replacementMap);
    return { result, replacementMap };
  }

  private processRecursivelyWithTracking(
    input: ProcessableInput, 
    data: ReplacementData, 
    replacementMap: Map<string, ReplacementMapping>
  ): any {
    if (input === null || input === undefined) {
      return input;
    }

    if (typeof input === "string") {
      return this.replaceInStringWithTracking(input, data, replacementMap);
    }

    if (Array.isArray(input)) {
      return input.map(item => this.processRecursivelyWithTracking(item, data, replacementMap));
    }

    if (typeof input === "object" && input.constructor === Object) {
      const result: { [key: string]: any } = {};
      for (const [key, value] of Object.entries(input)) {
        result[key] = this.processRecursivelyWithTracking(value, data, replacementMap);
      }
      return result;
    }

    return input;
  }

  private replaceInStringWithTracking(
    text: string,
    data: ReplacementData,
    replacementMap: Map<string, ReplacementMapping>
  ): string {
    let currentTextState = text;

    Object.entries(this.config.replacements).forEach(([pattern, options]) => {
      const { dataKey, defaultValue } = options;
      const valueToReplaceWith = String(
        data[dataKey] === undefined ? defaultValue : data[dataKey]
      );

      const trackingRegex = new RegExp(this.escapeRegExp(pattern), "g");
      let match;
      while ((match = trackingRegex.exec(text)) !== null) {
        replacementMap.set(valueToReplaceWith, {
          original: pattern,
          dataKey: dataKey,
          replaced: valueToReplaceWith
        });
      }
      
      const replacementPerformRegex = new RegExp(this.escapeRegExp(pattern), "g");
      currentTextState = currentTextState.replace(replacementPerformRegex, valueToReplaceWith);
    });

    if (this.config.removeBackslashes) {
      currentTextState = currentTextState.replace(/\\/g, "");
    }

    return currentTextState;
  }

  public replace(input: ProcessableInput, data: ReplacementData = {}): any {
    return this.processRecursively(input, data);
  }

  private processRecursively(input: ProcessableInput, data: ReplacementData): any {
    if (input === null || input === undefined) {
      return input;
    }

    if (typeof input === "string") {
      return this.replaceInString(input, data);
    }

    if (Array.isArray(input)) {
      return input.map(item => this.processRecursively(item, data));
    }

    if (typeof input === "object" && input.constructor === Object) {
      const result: { [key: string]: any } = {};
      for (const [key, value] of Object.entries(input)) {
        result[key] = this.processRecursively(value, data);
      }
      return result;
    }

    return input;
  }

  private replaceInString(text: string, data: ReplacementData): string {
    let replacedText = text;

    Object.entries(this.config.replacements).forEach(([pattern, options]) => {
      const { dataKey, defaultValue } = options;
      const replaceValue = String(
        data[dataKey] === undefined ? defaultValue : data[dataKey]
      );
      const regex = new RegExp(this.escapeRegExp(pattern), "g");
      replacedText = replacedText.replace(regex, replaceValue);
    });

    if (this.config.removeBackslashes) {
      replacedText = replacedText.replace(/\\/g, "");
    }

    return replacedText;
  }

  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

export default ConfigurableReplacer;
export { 
  ConfigurableReplacer,
};
export type { 
  ConfigOptions, 
  ReplacementData, 
  ReplacementResult, 
  ReplacementMapping, 
  ReplacementConfig,
  ReplacementOption,
  Config // Exportar Config para que loadConfigFromLocalStorage pueda devolverla
};