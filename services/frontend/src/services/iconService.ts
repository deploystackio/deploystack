export interface IconOption {
  value: string
  label: string
}

export class IconService {
  // Static list - always available
  static getCommonIcons(): IconOption[] {
    return [
      { value: 'none', label: 'No icon' },
      { value: 'FolderTree', label: 'FolderTree' },
      { value: 'Tags', label: 'Tags' },
      { value: 'Database', label: 'Database' },
      { value: 'Grid3x3', label: 'Grid3x3' },
      { value: 'Layers', label: 'Layers' },
      { value: 'Package', label: 'Package' },
      { value: 'Boxes', label: 'Boxes' },
      { value: 'Archive', label: 'Archive' },
      { value: 'Bookmark', label: 'Bookmark' },
      { value: 'Star', label: 'Star' },
      { value: 'Heart', label: 'Heart' },
      { value: 'Zap', label: 'Zap' },
      { value: 'Cpu', label: 'Cpu' },
      { value: 'Globe', label: 'Globe' },
      { value: 'Shield', label: 'Shield' },
      { value: 'Tool', label: 'Tool' },
      { value: 'Wrench', label: 'Wrench' },
      { value: 'Settings', label: 'Settings' },
      { value: 'Cog', label: 'Cog' },
      { value: 'Server', label: 'Server' },
      { value: 'Cloud', label: 'Cloud' },
      { value: 'Lock', label: 'Lock' },
      { value: 'Key', label: 'Key' },
      { value: 'Users', label: 'Users' },
      { value: 'User', label: 'User' },
      { value: 'Mail', label: 'Mail' },
      { value: 'Phone', label: 'Phone' },
      { value: 'Calendar', label: 'Calendar' },
      { value: 'Clock', label: 'Clock' },
      { value: 'File', label: 'File' },
      { value: 'Folder', label: 'Folder' },
      { value: 'Image', label: 'Image' },
      { value: 'Video', label: 'Video' },
      { value: 'Music', label: 'Music' },
      { value: 'Code', label: 'Code' },
      { value: 'Terminal', label: 'Terminal' },
      { value: 'Wifi', label: 'Wifi' },
      { value: 'Bluetooth', label: 'Bluetooth' },
      { value: 'Download', label: 'Download' },
      { value: 'Upload', label: 'Upload' },
      { value: 'Search', label: 'Search' },
      { value: 'Filter', label: 'Filter' },
      { value: 'Sort', label: 'Sort' },
      { value: 'List', label: 'List' },
      { value: 'Grid', label: 'Grid' },
      { value: 'Map', label: 'Map' },
      { value: 'Chart', label: 'Chart' },
      { value: 'Graph', label: 'Graph' }
    ]
  }

  // Session-level cache (persists until page refresh)
  private static sessionCache: IconOption[] | null = null

  static async getAllIcons(): Promise<IconOption[]> {
    // Check session cache first
    if (this.sessionCache) {
      console.log('[IconService] Using cached icons')
      return this.sessionCache
    }

    console.log('[IconService] Loading all icons for the first time...')

    try {
      // Dynamic import of all Lucide icons
      const lucideIcons = await import('lucide-vue-next')

      const allIcons = Object.keys(lucideIcons)
        .filter(name => name !== 'default' && typeof (lucideIcons as any)[name] === 'object')
        .map(name => ({
          value: name,
          label: name
        }))
        .sort((a, b) => a.label.localeCompare(b.label)) // Sort alphabetically

      // Cache in session
      this.sessionCache = allIcons

      console.log(`[IconService] Loaded and cached ${allIcons.length} icons`)
      return allIcons

    } catch (error) {
      console.error('[IconService] Failed to load icons:', error)

      // Fallback to common icons
      return this.getCommonIcons()
    }
  }

  static async searchIcons(query: string): Promise<IconOption[]> {
    // Less than 3 characters = show common icons only
    if (query.length < 3) {
      return this.getCommonIcons().filter(icon =>
        icon.label.toLowerCase().includes(query.toLowerCase())
      )
    }

    // 3+ characters = load all icons and search
    const allIcons = await this.getAllIcons()
    return allIcons.filter(icon =>
      icon.label.toLowerCase().includes(query.toLowerCase())
    )
  }

  // Clear cache (useful for development or if needed)
  static clearCache(): void {
    this.sessionCache = null
    console.log('[IconService] Icon cache cleared')
  }

  // Get cache status
  static isCacheLoaded(): boolean {
    return this.sessionCache !== null
  }

  // Get cache stats
  static getCacheStats(): { loaded: boolean; count: number } {
    return {
      loaded: this.sessionCache !== null,
      count: this.sessionCache?.length || 0
    }
  }
}
