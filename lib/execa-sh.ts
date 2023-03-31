import {$} from 'execa';

export const execaSh = new Proxy((templatesOrOptions: unknown, ...expressions: Parameters<typeof $>) => {
  const helloString = "Hello, world!";
  const test = $`echo ${helloString}`;
  return $(/* templatesOrOptions as any, */ ...expressions);
}, {})
