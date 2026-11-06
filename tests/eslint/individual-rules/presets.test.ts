import { lintExamples, lintParserExamples } from "../harness/lint.ts";

// Smoke-test the effective preset options; detailed policy tests live beside this file.
lintExamples(
    "for-direction",
    "for(let i=0;i<3;i--) { console.log(i); }",
    "for(let i=0;i<3;i++) { console.log(i); }",
);
lintExamples(
    "no-async-promise-executor",
    "new Promise(async resolve => { resolve(1); });",
    "new Promise(resolve => { resolve(1); });",
);
lintExamples(
    "no-case-declarations",
    "switch(x) { case 1: let a=2; break; }",
    "switch(x) { case 1: { let a=2; break; } }",
);
lintExamples("no-compare-neg-zero", "x === -0;", "Object.is(x, -0);");
lintExamples("no-cond-assign", "if (x = 1) { f(); }", "if (x === 1) { f(); }");
lintExamples(
    "no-constant-binary-expression",
    "const x = {} || y;",
    "const x = a || y;",
);
lintExamples("no-constant-condition", "if (true) { f(); }", "if (x) { f(); }");
lintExamples("no-control-regex", "const r = /\\x00/;", "const r = /abc/;");
lintExamples("no-debugger", "debugger;", "console.log('x');");
lintExamples("no-delete-var", "var x; delete x;", "const x={a:1}; delete x.a;");
lintExamples(
    "no-dupe-else-if",
    "if(x) f(); else if(x) g();",
    "if(x) f(); else if(y) g();",
);
lintExamples(
    "no-duplicate-case",
    "switch(x){case 1: break; case 1: break;}",
    "switch(x){case 1: break; case 2: break;}",
);
lintExamples("no-empty", "if(x) {}", "if(x) { f(); }");
lintExamples("no-empty-character-class", "const r=/[]/;", "const r=/[a]/;");
lintExamples("no-empty-pattern", "const {} = x;", "const {a} = x;");
lintExamples(
    "no-empty-static-block",
    "class C {static {}}",
    "class C {static {f();}}",
);
lintExamples(
    "no-ex-assign",
    "try { f(); } catch(e) { e=2; }",
    "try { f(); } catch(e) { console.log(e); }",
);
lintExamples("no-extra-boolean-cast", "if (Boolean(x)) f();", "if (x) f();");
lintExamples(
    "no-fallthrough",
    "switch(x){case 1: f(); case 2: g();}",
    "switch(x){case 1: f(); break; case 2: g();}",
);
lintExamples("no-global-assign", "undefined = 1;", "const x = undefined;");
lintExamples("no-invalid-regexp", "new RegExp('[');", "new RegExp('[a]');");
lintExamples("no-irregular-whitespace", "const x = 1;", "const x = 1;");
lintExamples(
    "no-loss-of-precision",
    "const x = 9007199254740993;",
    "const x = 9007199254740991;",
);
lintExamples(
    "no-misleading-character-class",
    "const r=/[Á]/;",
    "const r=/[ABC]/;",
);
lintParserExamples(
    "no-nonoctal-decimal-escape",
    "const s='\\8';",
    "const s='8';",
);
lintParserExamples("no-octal", "const x = 071;", "const x = 0o71;");
lintExamples(
    "no-prototype-builtins",
    "x.hasOwnProperty('a');",
    "Object.hasOwn(x, 'a');",
);
lintExamples("no-regex-spaces", "const r=/a  b/;", "const r=/a {2}b/;");
lintExamples("no-self-assign", "let x=1; x=x;", "let x=1; x=2;");
lintExamples(
    "no-shadow-restricted-names",
    "function f(undefined) { return undefined; }",
    "function f(value) { return value; }",
);
lintExamples("no-sparse-arrays", "const x = [1,,3];", "const x = [1,2,3];");
lintExamples(
    "no-unassigned-vars",
    "let x; console.log(x);",
    "let x=1; console.log(x);",
);
lintExamples(
    "no-unexpected-multiline",
    "const x = f\n[1].map(g);",
    "const x = f;\n[1].map(g);",
);
lintExamples(
    "no-unsafe-finally",
    "function f(){ try { return 1; } finally { return 2; } }",
    "function f(){ try { return 1; } finally { console.log('done'); } }",
);
lintExamples("no-unsafe-optional-chaining", "(x?.f)();", "x?.f();");
lintExamples("no-unused-labels", "label: f();", "while(x) { break; }");
lintExamples(
    "no-unused-private-class-members",
    "class C { #x=1; }",
    "class C { #x=1; read(){return this.#x;} }",
);
lintExamples(
    "no-useless-assignment",
    "let x=1; x=2; console.log(x);",
    "let x=1; console.log(x); x=2; console.log(x);",
);
lintExamples(
    "no-useless-backreference",
    "const r=/(a\\1)/;",
    "const r=/(a)\\1/;",
);
lintExamples(
    "no-useless-catch",
    "try { f(); } catch(e) { throw e; }",
    "try { f(); } catch(e) { console.log(e); }",
);
lintExamples("no-useless-escape", "const s='\\a';", "const s='a';");
lintExamples(
    "preserve-caught-error",
    "try { f(); } catch(e) { throw new Error('failed'); }",
    "try { f(); } catch(e) { throw new Error('failed', {cause:e}); }",
);
lintExamples(
    "require-yield",
    "function* f(){return 1;}",
    "function* f(){yield 1;}",
);
lintExamples("use-isnan", "x === NaN;", "Number.isNaN(x);");
lintExamples(
    "valid-typeof",
    "typeof x === 'strnig';",
    "typeof x === 'string';",
);
lintExamples("no-var", "var x=1;", "const x=1;");
lintExamples(
    "prefer-const",
    "let x=1; console.log(x);",
    "const x=1; console.log(x);",
);
lintExamples(
    "prefer-rest-params",
    "function f(){console.log(arguments);}",
    "function f(...args){console.log(args);}",
);
lintExamples("prefer-spread", "f.apply(null, args);", "f(...args);");
lintExamples(
    "@typescript-eslint/await-thenable",
    "async function f(){await 1;}",
    "async function f(){await Promise.resolve(1);}",
);
lintExamples(
    "@typescript-eslint/no-array-constructor",
    "const x = new Array(1,2);",
    "const x = [1,2];",
);
lintExamples(
    "@typescript-eslint/no-array-delete",
    "const x=[1,2]; delete x[0];",
    "const x=[1,2]; x.splice(0,1);",
);
lintExamples(
    "@typescript-eslint/no-base-to-string",
    "const x = {}.toString();",
    "const x = (123).toString();",
);
lintExamples(
    "@typescript-eslint/no-confusing-void-expression",
    "const x = console.log('x');",
    "console.log('x');",
);
lintExamples(
    "@typescript-eslint/no-deprecated",
    "/** @deprecated use next */\nfunction old(){}\nold();",
    "function next(){}\nnext();",
);
lintExamples(
    "@typescript-eslint/no-duplicate-enum-values",
    "enum E { A=1, B=1 }",
    "enum E { A=1, B=2 }",
);
lintExamples(
    "@typescript-eslint/no-duplicate-type-constituents",
    "type T = string | string;",
    "type T = string | number;",
);
lintExamples(
    "@typescript-eslint/no-dynamic-delete",
    "function f(x:Record<string,number>, k:string){delete x[k];}",
    "function f(x:Record<string,number>){delete x['fixed'];}",
);
lintExamples(
    "@typescript-eslint/no-empty-object-type",
    "type T = {};",
    "type T = object;",
);
lintExamples(
    "@typescript-eslint/no-extra-non-null-assertion",
    "declare const x: string | undefined; x!!;",
    "declare const x: string | undefined; x!;",
);
lintExamples(
    "@typescript-eslint/no-extraneous-class",
    "class C {}",
    "class C { value=1; }",
);
lintExamples(
    "@typescript-eslint/no-floating-promises",
    "Promise.resolve(1);",
    "void Promise.resolve(1);",
);
lintExamples(
    "@typescript-eslint/no-for-in-array",
    "for(const key in [1,2]) console.log(key);",
    "for(const value of [1,2]) console.log(value);",
);
lintExamples(
    "@typescript-eslint/no-generated-empty-object-type",
    "type T = Pick<{x:number}, never>;",
    "type T = Pick<{x:number}, 'x'>;",
);
lintExamples(
    "@typescript-eslint/no-implied-eval",
    "setTimeout('f()', 10);",
    "setTimeout(()=>console.log('x'), 10);",
);
lintExamples(
    "@typescript-eslint/no-invalid-void-type",
    "let x: void;",
    "function f(): void {console.log('x');}",
);
lintExamples(
    "@typescript-eslint/no-meaningless-void-operator",
    "void console.log('x');",
    "void Promise.resolve(1);",
);
lintExamples(
    "@typescript-eslint/no-misused-new",
    "interface I { new(): I; }",
    "interface I { new(): object; }",
);
lintExamples(
    "@typescript-eslint/no-misused-promises",
    "if(Promise.resolve(true)) console.log('x');",
    "async function f(){if(await Promise.resolve(true)) console.log('x');}",
);
lintExamples(
    "@typescript-eslint/no-misused-spread",
    "const x = {...Promise.resolve(1)};",
    "const x = {...{a:1}};",
);
lintExamples(
    "@typescript-eslint/no-mixed-enums",
    "enum E { A=1, B='b' }",
    "enum E { A=1, B=2 }",
);
lintExamples(
    "@typescript-eslint/no-namespace",
    "namespace X { export const x=1; }",
    "export const x=1;",
);
lintExamples(
    "@typescript-eslint/no-non-null-asserted-nullish-coalescing",
    "const x = Math.random() > .5 ? 'a' : undefined; const y=x! ?? 'a';",
    "declare const x:string|undefined; const y=x ?? 'a';",
);
lintExamples(
    "@typescript-eslint/no-non-null-asserted-optional-chain",
    "declare const x:{a:string}|undefined; x?.a!;",
    "declare const x:{a:string}|undefined; x?.a;",
);
lintExamples(
    "@typescript-eslint/no-redundant-type-constituents",
    "type T = string | any;",
    "type T = string | number;",
);
lintExamples(
    "@typescript-eslint/no-require-imports",
    "const fs = require('node:fs');",
    "import fs from 'node:fs';",
);
lintExamples(
    "@typescript-eslint/no-this-alias",
    "function f(){const self=this; return self;}",
    "function f(){return this;}",
);
lintExamples(
    "@typescript-eslint/no-unnecessary-boolean-literal-compare",
    "declare const x:boolean; if(x === true) console.log(x);",
    "declare const x:boolean; if(x) console.log(x);",
);
lintExamples(
    "@typescript-eslint/no-unnecessary-condition",
    "if('always') console.log('x');",
    "declare const x:boolean; if(x) console.log('x');",
);
lintExamples(
    "@typescript-eslint/no-unnecessary-template-expression",
    "const x = `${'hello'}`;",
    "declare const y:string; const x = `hello ${y}`;",
);
lintExamples(
    "@typescript-eslint/no-unnecessary-type-arguments",
    "function f<T=string>(){} f<string>();",
    "function f<T=string>(){} f<number>();",
);
lintExamples(
    "@typescript-eslint/no-unnecessary-type-assertion",
    "const x=1; const y=x as 1;",
    "declare const x:unknown; const y=x as string;",
);
lintExamples(
    "@typescript-eslint/no-unnecessary-type-constraint",
    "function f<T extends unknown>(x:T){return x;}",
    "function f<T>(x:T){return x;}",
);
lintExamples(
    "@typescript-eslint/no-unnecessary-type-conversion",
    "declare const x:string; String(x);",
    "declare const x:number; String(x);",
);
lintExamples(
    "@typescript-eslint/no-unnecessary-type-parameters",
    "function f<T extends string>(x:T):void {console.log(x);}",
    "function f<T>(x:T):T {return x;}",
);
lintExamples(
    "@typescript-eslint/no-unsafe-argument",
    "declare const x:any; function f(n:number){} f(x);",
    "function f(n:number){} f(1);",
);
lintExamples(
    "@typescript-eslint/no-unsafe-assignment",
    "declare const x:any; const y:number=x;",
    "const y:number=1;",
);
lintExamples(
    "@typescript-eslint/no-unsafe-declaration-merging",
    "interface C {x:number;} class C {}",
    "interface I {x:number;} class C {x=1;}",
);
lintExamples(
    "@typescript-eslint/no-unsafe-enum-comparison",
    "enum E {A=1} declare const e:E; e === 1;",
    "enum E {A=1} declare const e:E; e === E.A;",
);
lintExamples(
    "@typescript-eslint/no-unsafe-function-type",
    "declare const f:Function;",
    "declare const f:()=>void;",
);
lintExamples(
    "@typescript-eslint/no-unsafe-member-access",
    "declare const x:any; x.foo;",
    "declare const x:{foo:number}; x.foo;",
);
lintExamples(
    "@typescript-eslint/no-unsafe-return",
    "declare const x:any; function f():number{return x;}",
    "function f():number{return 1;}",
);
lintExamples(
    "@typescript-eslint/no-unsafe-unary-minus",
    "declare const x:string; -x;",
    "declare const x:number; -x;",
);
lintExamples(
    "@typescript-eslint/no-unused-expressions",
    "1;",
    "console.log(1);",
);
lintExamples(
    "@typescript-eslint/no-unused-vars",
    "const x=1;",
    "export const x=1;",
);
lintExamples(
    "@typescript-eslint/no-useless-constructor",
    "class C {constructor(){}}",
    "class C {constructor(){console.log('x');}}",
);
lintExamples(
    "@typescript-eslint/no-useless-default-assignment",
    "const { x = 1 } = { x: 2 };",
    "const { x = 1 } = {} as { x?: number }; ",
);
lintExamples(
    "@typescript-eslint/no-wrapper-object-types",
    "let x:String;",
    "let x:string;",
);
lintExamples(
    "@typescript-eslint/only-throw-error",
    "throw 'failed';",
    "throw new Error('failed');",
);
lintExamples(
    "@typescript-eslint/prefer-as-const",
    "const x = 'hello' as 'hello';",
    "const x = 'hello' as const;",
);
lintExamples(
    "@typescript-eslint/prefer-literal-enum-member",
    "enum E {A=Math.random()}",
    "enum E {A=1}",
);
lintExamples(
    "@typescript-eslint/prefer-namespace-keyword",
    "module X { export const n=1; }",
    "namespace X { export const n=1; }",
);
lintExamples(
    "@typescript-eslint/prefer-promise-reject-errors",
    "Promise.reject('failed');",
    "Promise.reject(new Error('failed'));",
);
lintExamples(
    "@typescript-eslint/prefer-reduce-type-parameter",
    "[1].reduce((a,n)=>a+n, 0 as number);",
    "[1].reduce<number>((a,n)=>a+n, 0);",
);
lintExamples(
    "@typescript-eslint/prefer-return-this-type",
    "class C {f(): C {return this;}}",
    "class C {f(): this {return this;}}",
);
lintExamples(
    "@typescript-eslint/related-getter-setter-pairs",
    "class C {get x():number{return 1;} set x(value:string){}}",
    "class C {get x():number{return 1;} set x(value:number){}}",
);
lintExamples(
    "@typescript-eslint/require-await",
    "async function f(){return 1;}",
    "async function f(){return await Promise.resolve(1);}",
);
lintExamples(
    "@typescript-eslint/restrict-plus-operands",
    "const x=1 + 'a';",
    "const x='1' + 'a';",
);
lintExamples(
    "@typescript-eslint/restrict-template-expressions",
    "const x=`${{}}`;",
    "const x=`${'hello'}`;",
);
lintExamples(
    "@typescript-eslint/return-await",
    "async function f(){try{return Promise.resolve(1);}catch(e){throw e;}}",
    "async function f(){try{return await Promise.resolve(1);}catch(e){throw e;}}",
);
lintExamples(
    "@typescript-eslint/triple-slash-reference",
    '/// <reference path="other.ts" />\nexport {};',
    "export {};",
);
lintExamples(
    "@typescript-eslint/unbound-method",
    "class C {x=1; f(){return this.x;}} const c=new C(); const f=c.f;",
    "class C {x=1; f(){return this.x;}} const c=new C(); const f=()=>c.f();",
);
lintExamples(
    "@typescript-eslint/unified-signatures",
    "function f(x:string):void; function f(x:number):void; function f(x:string|number){}",
    "function f(x:string|number):void {}",
);
lintExamples(
    "@typescript-eslint/use-unknown-in-catch-callback-variable",
    "Promise.resolve(1).catch(e=>console.log(e));",
    "Promise.resolve(1).catch((e:unknown)=>console.log(e));",
);
lintExamples(
    "@typescript-eslint/adjacent-overload-signatures",
    "interface I { f(x:string):void; g():void; f(x:number):void; }",
    "interface I { f(x:string):void; f(x:number):void; g():void; }",
);
lintExamples(
    "@typescript-eslint/array-type",
    "const x:Array<number>=[];",
    "const x:number[]=[];",
);
lintExamples(
    "@typescript-eslint/ban-tslint-comment",
    "// tslint:disable-next-line\nconst x=1;",
    "const x=1;",
);
lintExamples(
    "@typescript-eslint/class-literal-property-style",
    "class C {get x(){return 1;}}",
    "class C {readonly x=1;}",
);
lintExamples(
    "@typescript-eslint/consistent-generic-constructors",
    "const x:Map<string,number>=new Map();",
    "const x=new Map<string,number>();",
);
lintExamples(
    "@typescript-eslint/consistent-indexed-object-style",
    "type T = {[key:string]:number};",
    "type T = Record<string,number>;",
);
lintExamples(
    "@typescript-eslint/consistent-type-definitions",
    "type T = {x:number};",
    "interface T {x:number;}",
);
lintExamples(
    "@typescript-eslint/dot-notation",
    "const x={a:1}; x['a'];",
    "const x={a:1}; x.a;",
);
lintExamples(
    "@typescript-eslint/no-confusing-non-null-assertion",
    "declare const x:number|undefined; const y=1; x! == y;",
    "declare const x:number|undefined; const y=1; x === y;",
);
lintExamples(
    "@typescript-eslint/no-empty-function",
    "function f(){}",
    "function f(){console.log('x');}",
);
lintExamples(
    "@typescript-eslint/no-inferrable-types",
    "const x:number=1;",
    "const x=1;",
);
lintExamples(
    "@typescript-eslint/non-nullable-type-assertion-style",
    "declare const x:string|undefined; const y=x as string;",
    "declare const x:string|undefined; const y=x!;",
);
lintExamples(
    "@typescript-eslint/prefer-find",
    "const x=[1,2].filter(n=>n>1)[0];",
    "const x=[1,2].find(n=>n>1);",
);
lintExamples(
    "@typescript-eslint/prefer-for-of",
    "const xs=[1,2]; for(let i=0;i<xs.length;i++){console.log(xs[i]);}",
    "const xs=[1,2]; for(const x of xs){console.log(x);}",
);
lintExamples(
    "@typescript-eslint/prefer-function-type",
    "interface F {(x:number):number;}",
    "type F = (x:number)=>number;",
);
lintExamples(
    "@typescript-eslint/prefer-includes",
    "const xs=[1,2]; xs.indexOf(1) !== -1;",
    "const xs=[1,2]; xs.includes(1);",
);
lintExamples(
    "@typescript-eslint/prefer-nullish-coalescing",
    "declare const x:string|undefined; const y=x || 'fallback';",
    "declare const x:string|undefined; const y=x ?? 'fallback';",
);
lintExamples(
    "@typescript-eslint/prefer-optional-chain",
    "declare const x:{a:number}|undefined; const y=x && x.a;",
    "declare const x:{a:number}|undefined; const y=x?.a;",
);
lintExamples(
    "@typescript-eslint/prefer-regexp-exec",
    "const x='abc'.match(/a/);",
    "const x=/a/.exec('abc');",
);
lintExamples(
    "@typescript-eslint/prefer-string-starts-ends-with",
    "declare const x:string; x.indexOf('a') === 0;",
    "declare const x:string; x.startsWith('a');",
);
