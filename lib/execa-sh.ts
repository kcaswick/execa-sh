import {$} from 'execa';

export const execaSh = new Proxy((templatesOrOptions: unknown, ...expressions: Parameters<typeof $>) => {
  return $(templatesOrOptions as any, ...expressions);
}, {})
