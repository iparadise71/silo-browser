import type {
  ActivityEntry,
  AppInfo,
  BrowserState,
  Group,
  Profile,
  ProfileInput,
  ProfilePatch,
  Snapshot
} from './model'

/**
 * Contrato del IPC: cada canal declara sus argumentos y su resultado.
 * Main implementa `Handlers`, el preload expone `SiloApi`.
 */
export interface Channels {
  'profiles:snapshot': { args: []; result: Snapshot }
  'profiles:create': { args: [input: ProfileInput]; result: Profile }
  'profiles:update': { args: [id: string, patch: ProfilePatch]; result: Profile }
  'profiles:remove': { args: [id: string, opts: { wipeData: boolean }]; result: void }
  'profiles:duplicate': { args: [id: string]; result: Profile }
  'profiles:move': { args: [ids: string[], groupId: string | null]; result: void }
  'profiles:open': { args: [id: string]; result: { mode: 'launched' | 'window' } }
  'profiles:stop': { args: [ids: string[]]; result: { closed: number; forced: number; failed: string[] } }
  'profiles:reveal': { args: [id: string]; result: void }
  'groups:create': { args: [name: string]; result: Group }
  'groups:remove': { args: [id: string]; result: void }
  'browsers:state': { args: [refresh?: boolean]; result: BrowserState }
  'browsers:select': { args: [path: string]; result: BrowserState }
  'browsers:pick': { args: []; result: BrowserState | null }
  'app:info': { args: []; result: AppInfo }
  'app:revealData': { args: []; result: void }
  'app:downloadChrome': { args: []; result: void }
  'activity:list': { args: []; result: ActivityEntry[] }
}

export type Channel = keyof Channels

/** Eventos que main empuja al renderer. */
export interface Events {
  'state:changed': Snapshot
  'activity:added': ActivityEntry
  'menu:new-profile': void
  'menu:settings': void
}

export type EventName = keyof Events

/** Respuesta envuelta para que el error llegue con código al renderer. */
export type Envelope<T> = { ok: true; data: T } | { ok: false; error: { code: ErrorCode; message: string } }

export type ErrorCode =
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'DUPLICATE_NAME'
  | 'PROFILE_RUNNING'
  | 'NO_BROWSER'
  | 'LAUNCH_FAILED'
  | 'INVALID_BROWSER'
  | 'INTERNAL'

export class SiloError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'SiloError'
  }
}

type Invoke = { [C in Channel]: (...args: Channels[C]['args']) => Promise<Channels[C]['result']> }

export interface SiloApi {
  invoke: <C extends Channel>(channel: C, ...args: Channels[C]['args']) => Promise<Channels[C]['result']>
  on: <E extends EventName>(event: E, cb: (payload: Events[E]) => void) => () => void
  platform: NodeJS.Platform
}

export type { Invoke }
