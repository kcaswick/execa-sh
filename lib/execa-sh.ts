import { $, Options, Execa$, ExecaChildProcess, StdoutStderrAll, TemplateExpression } from "execa";
import { type Buffer } from "node:buffer";
import type { L } from "ts-toolbelt";

export const execaSh2 = new Proxy((templatesOrOptions: unknown, ...expressions: L.Drop<Parameters<typeof $>, 1>) => {
  const helloString = "Hello, world!";
  const test = $`echo ${helloString}`;
  return $(templatesOrOptions as any, ...expressions);
}, {});

function isOptions<StdoutStderrType extends StdoutStderrAll | null = string>(
  options: unknown
): options is Options<StdoutStderrType> {
  return typeof options === "object" && options !== null && !Array.isArray(options);
}

function isTemplateStringsArray(templates: unknown): templates is TemplateStringsArray {
  return Array.isArray(templates) && typeof templates[0] === "string";
}

function create$<EncodingType = string>(options: Options<EncodingType> = {}): Execa$ {
  function execaSh<StdoutStderrType extends StdoutStderrAll = string>(options: Options<undefined>): Execa$<StdoutStderrType>;
  function execaSh(options: Options): Execa$;
  // Xfunction execaSh(options: Options<null>): Execa$<Buffer>;
  function execaSh<StdoutStderrType extends StdoutStderrAll = string>(
    templates: TemplateStringsArray,
    ...expressions: TemplateExpression[]
  ): ExecaChildProcess<StdoutStderrType>;
  function execaSh<StdoutStderrType extends StdoutStderrAll = string>(
    templatesOrOptions: Options<StdoutStderrType | null> | TemplateStringsArray,
    ...expressions: TemplateExpression[]
  ) {
    if (isOptions/* <EncodingType> */(templatesOrOptions)) {
      return create$<EncodingType>({ ...options, ...templatesOrOptions } as Options<EncodingType>);
    }

    if (isTemplateStringsArray(templatesOrOptions)) {
      const test = $`echo ${"Hello, world!"}`;
      // TODO: Insert parsing here
      return $(templatesOrOptions, ...expressions);
    }
  }

  execaSh.sync = (templates: TemplateStringsArray, ...expressions: TemplateExpression[]) => {
    if (!Array.isArray(templates)) {
      throw new TypeError("Please use $(options).sync`command` instead of $.sync(options)`command`.");
    }

    return $.sync(templates, ...expressions);
  };

  return execaSh as Execa$;
}

export const execaSh: Execa$ = create$();
