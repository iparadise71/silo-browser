import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { Channel, Channels, Envelope, EventName, Events, SiloApi } from '../shared/ipc'

const EVENTS: EventName[] = ['state:changed', 'activity:added', 'menu:new-profile', 'menu:settings']

class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message)
    this.name = 'SiloError'
  }
}

const api: SiloApi = {
  async invoke<C extends Channel>(channel: C, ...args: Channels[C]['args']) {
    const res = (await ipcRenderer.invoke(channel, ...args)) as Envelope<Channels[C]['result']>
    if (res.ok) return res.data
    // Las clases no cruzan contextBridge: se envía código y mensaje en un Error plano.
    throw new ApiError(res.error.code, `${res.error.code}: ${res.error.message}`)
  },
  on<E extends EventName>(event: E, cb: (payload: Events[E]) => void) {
    if (!EVENTS.includes(event)) throw new Error(`Evento desconocido: ${event}`)
    const listener = (_e: IpcRendererEvent, payload: Events[E]) => cb(payload)
    ipcRenderer.on(event, listener)
    return () => ipcRenderer.removeListener(event, listener)
  },
  platform: process.platform
}

contextBridge.exposeInMainWorld('silo', api)
