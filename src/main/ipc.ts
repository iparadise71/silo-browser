import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import { z } from 'zod'
import { SiloError, type Channel, type Channels, type Envelope } from '@shared/ipc'

export type Handlers = {
  [C in Channel]: (...args: Channels[C]['args']) => Promise<Channels[C]['result']> | Channels[C]['result']
}

const id = z.string().min(1).max(64)

/** Validación de argumentos en la frontera: el renderer no es de confianza. */
const argSchemas: { [C in Channel]: z.ZodType } = {
  'profiles:snapshot': z.tuple([]),
  'profiles:create': z.tuple([z.unknown()]),
  'profiles:update': z.tuple([id, z.record(z.string(), z.unknown())]),
  'profiles:remove': z.tuple([id, z.object({ wipeData: z.boolean() })]),
  'profiles:duplicate': z.tuple([id]),
  'profiles:move': z.tuple([z.array(id).max(1000), id.nullable()]),
  'profiles:open': z.tuple([id]),
  'profiles:stop': z.tuple([z.array(id).min(1).max(1000)]),
  'profiles:reveal': z.tuple([id]),
  'groups:create': z.tuple([z.string().max(64)]),
  'groups:remove': z.tuple([id]),
  'browsers:state': z.tuple([z.boolean().optional()]),
  'browsers:select': z.tuple([z.string().min(1).max(4096)]),
  'browsers:pick': z.tuple([]),
  'app:info': z.tuple([]),
  'app:revealData': z.tuple([]),
  'app:downloadChrome': z.tuple([]),
  'activity:list': z.tuple([])
}

export function registerIpc(handlers: Handlers, isTrustedSender: (e: IpcMainInvokeEvent) => boolean): void {
  for (const channel of Object.keys(handlers) as Channel[]) {
    ipcMain.handle(channel, async (event, ...raw: unknown[]): Promise<Envelope<unknown>> => {
      try {
        if (!isTrustedSender(event)) throw new SiloError('INTERNAL', 'Origen no permitido.')
        const parsed = argSchemas[channel].safeParse(raw)
        if (!parsed.success) throw new SiloError('VALIDATION', 'Argumentos no válidos.')
        const fn = handlers[channel] as (...a: unknown[]) => unknown
        return { ok: true, data: await fn(...(parsed.data as unknown[])) }
      } catch (err) {
        if (err instanceof SiloError) return { ok: false, error: { code: err.code, message: err.message } }
        console.error(`[ipc] ${channel}`, err)
        return {
          ok: false,
          error: { code: 'INTERNAL', message: (err as Error)?.message ?? 'Error inesperado.' }
        }
      }
    })
  }
}
