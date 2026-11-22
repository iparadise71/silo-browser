import type { SiloApi } from '../shared/ipc'

declare global {
  interface Window {
    silo: SiloApi
  }
}

export {}
