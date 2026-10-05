import { create } from 'zustand'
import { getSettings, updateSettings } from '../services'
import { DEFAULT_SETTINGS } from '../lib/config'

export const useSettingsStore = create((set) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,
  load: async () => {
    const settings = await getSettings()
    set({ settings, loaded: true })
  },
  save: async (patch) => {
    const settings = await updateSettings(patch)
    set({ settings })
    return settings
  },
}))
