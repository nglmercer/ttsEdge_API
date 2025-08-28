import { DataStorage } from 'json-obj-manager';
import { JSONFile } from 'json-obj-manager/node';
import path from 'path';

const tempPath = path.join(process.cwd(), 'temp');

// Define los tipos de filtro
export interface Filter {
  id: string;
  blackList: (string | { item: string; expiresAt: Date | null })[];
  whiteList: string[];
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

// Opciones para la verificación de strings
export interface CheckOptions {
  caseSensitive?: boolean;
  exactMatch?: boolean;
  partialMatch?: boolean;
}

// Resultado de la verificación
export interface CheckResult {
  isAllowed: boolean;
  isBlocked: boolean;
  matchedBlackList: (string | { item: string; expiresAt: Date | null })[];
  matchedWhiteList: string[];
  reason: 'blacklist' | 'whitelist' | 'none';
  expirationReason?: string; // Nuevo campo para ban temporal
}

const dataStorage = new DataStorage<Filter[]>(new JSONFile(path.join(tempPath, 'data/filters.json')));

/**
 * Clase para gestionar filtros de texto con listas negras y blancas
 * Permite verificar si un string debe ser permitido o bloqueado
 */
export class FilterManager {
  private filters: Filter[] = [];

  constructor() {
    this.loadBackup();
    // Opcional: un temporizador para limpiar elementos expirados periódicamente
    setInterval(() => this.cleanExpiredBlacklistItems(), 60 * 60 * 1000); // Cada hora
  }

  private normalizeItem(item: string | { item: string; expiresAt: Date | null }): string {
    return typeof item === 'string' ? item.trim() : item.item.trim();
  }

  private isItemExpired(item: { item: string; expiresAt: Date | null }): boolean {
    return item.expiresAt !== null && new Date() > item.expiresAt;
  }

  private cleanExpiredBlacklistItems(): void {
    let changed = false;
    this.filters.forEach(filter => {
      const initialLength = filter.blackList.length;
      filter.blackList = filter.blackList.filter(item => {
        if (typeof item !== 'string' && this.isItemExpired(item)) {
          changed = true;
          return false;
        }
        return true;
      });
      if (filter.blackList.length < initialLength) {
        filter.updatedAt = new Date();
        changed = true;
      }
    });
    if (changed) {
      this.saveFilters();
      console.log('Expired blacklist items cleaned.');
    }
  }

  /**
   * Crea un nuevo filtro
   */
  createFilter(blackList: string[] = [], whiteList: string[] = []): Filter {
    const newFilter: Filter = {
      id: "default",
      blackList: blackList.map(item => item.trim()),
      whiteList: whiteList.map(item => item.trim()),
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true
    };

    this.filters.push(newFilter);
    this.saveFilters();
    return newFilter;
  }

  /**
   * Actualiza un filtro existente
   */
  updateFilter(id: string, blackList?: string[], whiteList?: string[]): boolean {
    const filter = this.filters.find(f => f.id === id);
    if (!filter) return false;

    if (blackList !== undefined) {
      filter.blackList = blackList.map(item => item.trim());
    }
    if (whiteList !== undefined) {
      filter.whiteList = whiteList.map(item => item.trim());
    }
    
    filter.updatedAt = new Date();
    this.saveFilters();
    return true;
  }

  /**
   * Añade elementos a la lista negra de un filtro.
   * Puedes especificar un tiempo de expiración en segundos.
   */
  addToBlackList(id: string, items: string[], expiresInSeconds: number | null = null): boolean {
    const filter = this.filters.find(f => f.id === id);
    if (!filter) return false;

    const newBlackListItems = items.map(item => {
      const expiresAt = expiresInSeconds ? new Date(Date.now() + expiresInSeconds * 1000) : null;
      return expiresAt ? { item: item.trim(), expiresAt } : item.trim();
    });

    filter.blackList = [...filter.blackList, ...newBlackListItems].filter((value, index, self) => 
      index === self.findIndex((t) => (this.normalizeItem(t) === this.normalizeItem(value)))
    );
    
    filter.updatedAt = new Date();
    this.saveFilters();
    return true;
  }

  /**
   * Añade elementos a la lista blanca de un filtro
   */
  addToWhiteList(id: string, items: string[]): boolean {
    const filter = this.filters.find(f => f.id === id);
    if (!filter) return false;

    const newItems = items.map(item => item.trim()).filter(item => 
      !filter.whiteList.includes(item)
    );
    
    filter.whiteList.push(...newItems);
    filter.updatedAt = new Date();
    this.saveFilters();
    return true;
  }

  /**
   * Elimina elementos de la lista negra
   */
  removeFromBlackList(id: string, items: string[]): boolean {
    const filter = this.filters.find(f => f.id === id);
    if (!filter) return false;

    filter.blackList = filter.blackList.filter(blackItem => 
      !items.some(removeItem => this.normalizeItem(blackItem) === removeItem.trim())
    );
    
    filter.updatedAt = new Date();
    this.saveFilters();
    return true;
  }

  /**
   * Elimina elementos de la lista blanca
   */
  removeFromWhiteList(id: string, items: string[]): boolean {
    const filter = this.filters.find(f => f.id === id);
    if (!filter) return false;

    filter.whiteList = filter.whiteList.filter(whiteItem => 
      !items.some(removeItem => whiteItem === removeItem.trim())
    );
    
    filter.updatedAt = new Date();
    this.saveFilters();
    return true;
  }

  /**
   * Activa o desactiva un filtro
   */
  toggleFilter(id: string, isActive?: boolean): boolean {
    const filter = this.filters.find(f => f.id === id);
    if (!filter) return false;

    filter.isActive = isActive !== undefined ? isActive : !filter.isActive;
    filter.updatedAt = new Date();
    this.saveFilters();
    return true;
  }

  /**
   * Elimina un filtro completamente
   */
  deleteFilter(id: string): boolean {
    const index = this.filters.findIndex(f => f.id === id);
    if (index === -1) return false;

    this.filters.splice(index, 1);
    this.saveFilters();
    return true;
  }

  /**
   * Verifica si un string está permitido según todos los filtros activos
   */
  checkString(text: string, options: CheckOptions = {}): CheckResult {
    const {
      caseSensitive = false,
      exactMatch = false,
      partialMatch = true
    } = options;

    const processedText = caseSensitive ? text : text.toLowerCase();
    const matchedBlackList: (string | { item: string; expiresAt: Date | null })[] = [];
    const matchedWhiteList: string[] = [];
    let expirationReason: string | undefined;

    // Verificar contra todos los filtros activos
    for (const filter of this.filters.filter(f => f.isActive)) {
      // Verificar lista negra
      for (const blackItem of filter.blackList) {
        if (typeof blackItem !== 'string' && this.isItemExpired(blackItem)) {
          // Ignorar elementos expirados, se limpiarán después
          continue;
        }

        const processedBlackItem = caseSensitive ? this.normalizeItem(blackItem) : this.normalizeItem(blackItem).toLowerCase();
        
        let matches = false;
        if (exactMatch) {
          matches = processedText === processedBlackItem;
        } else if (partialMatch) {
          matches = processedText.includes(processedBlackItem);
        }

        if (matches) {
          matchedBlackList.push(blackItem);
          if (typeof blackItem !== 'string' && blackItem.expiresAt) {
            expirationReason = `Blocked until ${blackItem.expiresAt.toLocaleString()}`;
          }
        }
      }

      // Verificar lista blanca
      for (const whiteItem of filter.whiteList) {
        const processedWhiteItem = caseSensitive ? whiteItem : whiteItem.toLowerCase();
        
        let matches = false;
        if (exactMatch) {
          matches = processedText === processedWhiteItem;
        } else if (partialMatch) {
          matches = processedText.includes(processedWhiteItem);
        }

        if (matches) {
          matchedWhiteList.push(whiteItem);
        }
      }
    }

    // Determinar el resultado
    // La lista blanca tiene prioridad sobre la negra
    if (matchedWhiteList.length > 0) {
      return {
        isAllowed: true,
        isBlocked: false,
        matchedBlackList,
        matchedWhiteList,
        reason: 'whitelist'
      };
    }

    if (matchedBlackList.length > 0) {
      return {
        isAllowed: false,
        isBlocked: true,
        matchedBlackList,
        matchedWhiteList,
        reason: 'blacklist',
        expirationReason
      };
    }

    return {
      isAllowed: true,
      isBlocked: false,
      matchedBlackList,
      matchedWhiteList,
      reason: 'none'
    };
  }

  /**
   * Método de conveniencia para verificar si un string está permitido
   */
  isAllowed(text: string, options?: CheckOptions): boolean {
    return this.checkString(text, options).isAllowed;
  }

  /**
   * Método de conveniencia para verificar si un string está bloqueado
   */
  isBlocked(text: string, options?: CheckOptions): boolean {
    return this.checkString(text, options).isBlocked;
  }

  /**
   * Obtiene un filtro por ID
   */
  getFilter(id: string): Filter | undefined {
    return this.filters.find(f => f.id === id);
  }

  /**
   * Obtiene todos los filtros
   */
  getAllFilters(activeOnly = false): readonly Filter[] {
    return activeOnly ? this.filters.filter(f => f.isActive) : [...this.filters];
  }

  /**
   * Obtiene estadísticas de los filtros
   */
  getStats() {
    const totalFilters = this.filters.length;
    const activeFilters = this.filters.filter(f => f.isActive).length;
    const totalBlackListItems = this.filters.reduce((sum, f) => 
      sum + f.blackList.filter(item => typeof item === 'string' || !this.isItemExpired(item)).length
    , 0);
    const totalWhiteListItems = this.filters.reduce((sum, f) => sum + f.whiteList.length, 0);

    return {
      totalFilters,
      activeFilters,
      inactiveFilters: totalFilters - activeFilters,
      totalBlackListItems,
      totalWhiteListItems
    };
  }

  /**
   * Limpia todos los filtros
   */
  clearAll(): void {
    this.filters.length = 0;
    this.saveFilters();
  }

  /**
   * Guarda los filtros en el archivo
   */
  private saveFilters(): void {
    dataStorage.save('data', this.filters);
  }

  /**
   * Carga los filtros desde el archivo
   */
  async loadBackup(): Promise<void> {
    try {
      const data = await dataStorage.load('data');
      if (data) {
        this.filters = data.map(filter => ({
          ...filter,
          createdAt: new Date(filter.createdAt),
          updatedAt: new Date(filter.updatedAt),
          blackList: filter.blackList.map(item => {
            if (typeof item === 'object' && item !== null && 'item' in item && 'expiresAt' in item) {
              return {
                item: item.item,
                expiresAt: item.expiresAt ? new Date(item.expiresAt) : null
              };
            }
            return item;
          })
        }));
        this.cleanExpiredBlacklistItems(); // Limpiar al cargar
      }
    } catch (error) {
      console.error('Error loading filters backup:', error);
      this.filters = [];
    }
  }

  /**
   * Busca filtros por contenido
   */
  searchFilters(query: string): Filter[] {
    const lowerQuery = query.toLowerCase();
    return this.filters.filter(filter => 
      filter.blackList.some(item => this.normalizeItem(item).toLowerCase().includes(lowerQuery)) ||
      filter.whiteList.some(item => item.toLowerCase().includes(lowerQuery))
    );
  }
}

// Instancia singleton
export const filterManager = new FilterManager();

// Funciones de conveniencia (exportadas directamente para su uso)

/**
 * Verifica si un string está permitido según todos los filtros activos.
 */
export function checkText(text: string, options?: CheckOptions): CheckResult {
  return filterManager.checkString(text, options);
}

/**
 * Verifica si un string está permitido.
 */
export function isTextAllowed(text: string, options?: CheckOptions): boolean {
  return filterManager.isAllowed(text, options);
}

/**
 * Verifica si un string está bloqueado.
 */
export function isTextBlocked(text: string, options?: CheckOptions): boolean {
  return filterManager.isBlocked(text, options);
}

/**
 * Añade elementos a la lista negra de un filtro específico.
 * @param filterId El ID del filtro.
 * @param items Los elementos a añadir.
 * @param expiresInSeconds El tiempo de expiración en segundos (opcional).
 */
export function addItemsToBlacklist(filterId: string, items: string[], expiresInSeconds: number | null = null): boolean {
  return filterManager.addToBlackList(filterId, items, expiresInSeconds);
}

/**
 * Elimina elementos de la lista negra de un filtro específico.
 * @param filterId El ID del filtro.
 * @param items Los elementos a eliminar.
 */
export function removeItemsFromBlacklist(filterId: string, items: string[]): boolean {
  return filterManager.removeFromBlackList(filterId, items);
}

/**
 * Añade elementos a la lista blanca de un filtro específico.
 * @param filterId El ID del filtro.
 * @param items Los elementos a añadir.
 */
export function addItemsToWhitelist(filterId: string, items: string[]): boolean {
  return filterManager.addToWhiteList(filterId, items);
}

/**
 * Elimina elementos de la lista blanca de un filtro específico.
 * @param filterId El ID del filtro.
 * @param items Los elementos a eliminar.
 */
export function removeItemsFromWhitelist(filterId: string, items: string[]): boolean {
  return filterManager.removeFromWhiteList(filterId, items);
}