import type { Env } from './validation.schema';

export default (): Env => process.env as unknown as Env;

export type WorkerConfig = Env;
