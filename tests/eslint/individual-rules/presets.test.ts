import assert from "node:assert/strict";
import { test } from "node:test";
import { lintRule, lintParserRestriction } from "../../harness/lint-adapter.ts";

const RULE_EXAMPLES = [
    {
        ruleId: "for-direction",
        rejected: "for(let i=0;i<3;i--) { console.log(i); }",
        accepted: "for(let i=0;i<3;i++) { console.log(i); }",
    },
    {
        ruleId: "no-async-promise-executor",
        rejected: "new Promise(async resolve => { resolve(1); });",
        accepted: "new Promise(resolve => { resolve(1); });",
    },
    {
        ruleId: "no-case-declarations",
        rejected: "switch(x) { case 1: let a=2; break; }",
        accepted: "switch(x) { case 1: { let a=2; break; } }",
    },
    {
        ruleId: "no-compare-neg-zero",
        rejected: "x === -0;",
        accepted: "Object.is(x, -0);",
    },
    {
        ruleId: "no-cond-assign",
        rejected: "if (x = 1) { f(); }",
        accepted: "if (x === 1) { f(); }",
    },
    {
        ruleId: "no-constant-binary-expression",
        rejected: "const x = {} || y;",
        accepted: "const x = a || y;",
    },
    {
        ruleId: "no-constant-condition",
        rejected: "if (true) { f(); }",
        accepted: "if (x) { f(); }",
    },
    {
        ruleId: "no-control-regex",
        rejected: "const r = /\\x00/;",
        accepted: "const r = /abc/;",
    },
    {
        ruleId: "no-debugger",
        rejected: "debugger;",
        accepted: "console.log('x');",
    },
    {
        ruleId: "no-delete-var",
        rejected: "var x; delete x;",
        accepted: "const x={a:1}; delete x.a;",
    },
    {
        ruleId: "no-dupe-else-if",
        rejected: "if(x) f(); else if(x) g();",
        accepted: "if(x) f(); else if(y) g();",
    },
    {
        ruleId: "no-duplicate-case",
        rejected: "switch(x){case 1: break; case 1: break;}",
        accepted: "switch(x){case 1: break; case 2: break;}",
    },
    { ruleId: "no-empty", rejected: "if(x) {}", accepted: "if(x) { f(); }" },
    {
        ruleId: "no-empty-character-class",
        rejected: "const r=/[]/;",
        accepted: "const r=/[a]/;",
    },
    {
        ruleId: "no-empty-pattern",
        rejected: "const {} = x;",
        accepted: "const {a} = x;",
    },
    {
        ruleId: "no-empty-static-block",
        rejected: "class C {static {}}",
        accepted: "class C {static {f();}}",
    },
    {
        ruleId: "no-ex-assign",
        rejected: "try { f(); } catch(e) { e=2; }",
        accepted: "try { f(); } catch(e) { console.log(e); }",
    },
    {
        ruleId: "no-extra-boolean-cast",
        rejected: "if (Boolean(x)) f();",
        accepted: "if (x) f();",
    },
    {
        ruleId: "no-fallthrough",
        rejected: "switch(x){case 1: f(); case 2: g();}",
        accepted: "switch(x){case 1: f(); break; case 2: g();}",
    },
    {
        ruleId: "no-global-assign",
        rejected: "undefined = 1;",
        accepted: "const x = undefined;",
    },
    {
        ruleId: "no-invalid-regexp",
        rejected: "new RegExp('[');",
        accepted: "new RegExp('[a]');",
    },
    {
        ruleId: "no-irregular-whitespace",
        rejected: "const x = 1;",
        accepted: "const x = 1;",
    },
    {
        ruleId: "no-loss-of-precision",
        rejected: "const x = 9007199254740993;",
        accepted: "const x = 9007199254740991;",
    },
    {
        ruleId: "no-misleading-character-class",
        rejected: "const r=/[Á]/;",
        accepted: "const r=/[ABC]/;",
    },
    {
        ruleId: "no-prototype-builtins",
        rejected: "x.hasOwnProperty('a');",
        accepted: "Object.hasOwn(x, 'a');",
    },
    {
        ruleId: "no-regex-spaces",
        rejected: "const r=/a  b/;",
        accepted: "const r=/a {2}b/;",
    },
    {
        ruleId: "no-self-assign",
        rejected: "let x=1; x=x;",
        accepted: "let x=1; x=2;",
    },
    {
        ruleId: "no-shadow-restricted-names",
        rejected: "function f(undefined) { return undefined; }",
        accepted: "function f(value) { return value; }",
    },
    {
        ruleId: "no-sparse-arrays",
        rejected: "const x = [1,,3];",
        accepted: "const x = [1,2,3];",
    },
    {
        ruleId: "no-unassigned-vars",
        rejected: "let x; console.log(x);",
        accepted: "let x=1; console.log(x);",
    },
    {
        ruleId: "no-unexpected-multiline",
        rejected: "const x = f\n[1].map(g);",
        accepted: "const x = f;\n[1].map(g);",
    },
    {
        ruleId: "no-unsafe-finally",
        rejected: "function f(){ try { return 1; } finally { return 2; } }",
        accepted:
            "function f(){ try { return 1; } finally { console.log('done'); } }",
    },
    {
        ruleId: "no-unsafe-optional-chaining",
        rejected: "(x?.f)();",
        accepted: "x?.f();",
    },
    {
        ruleId: "no-unused-labels",
        rejected: "label: f();",
        accepted: "while(x) { break; }",
    },
    {
        ruleId: "no-unused-private-class-members",
        rejected: "class C { #x=1; }",
        accepted: "class C { #x=1; read(){return this.#x;} }",
    },
    {
        ruleId: "no-useless-assignment",
        rejected: "let x=1; x=2; console.log(x);",
        accepted: "let x=1; console.log(x); x=2; console.log(x);",
    },
    {
        ruleId: "no-useless-backreference",
        rejected: "const r=/(a\\1)/;",
        accepted: "const r=/(a)\\1/;",
    },
    {
        ruleId: "no-useless-catch",
        rejected: "try { f(); } catch(e) { throw e; }",
        accepted: "try { f(); } catch(e) { console.log(e); }",
    },
    {
        ruleId: "no-useless-escape",
        rejected: "const s='\\a';",
        accepted: "const s='a';",
    },
    {
        ruleId: "preserve-caught-error",
        rejected: "try { f(); } catch(e) { throw new Error('failed'); }",
        accepted:
            "try { f(); } catch(e) { throw new Error('failed', {cause:e}); }",
    },
    {
        ruleId: "require-yield",
        rejected: "function* f(){return 1;}",
        accepted: "function* f(){yield 1;}",
    },
    {
        ruleId: "use-isnan",
        rejected: "x === NaN;",
        accepted: "Number.isNaN(x);",
    },
    {
        ruleId: "valid-typeof",
        rejected: "typeof x === 'strnig';",
        accepted: "typeof x === 'string';",
    },
    { ruleId: "no-var", rejected: "var x=1;", accepted: "const x=1;" },
    {
        ruleId: "prefer-const",
        rejected: "let x=1; console.log(x);",
        accepted: "const x=1; console.log(x);",
    },
    {
        ruleId: "prefer-rest-params",
        rejected: "function f(){console.log(arguments);}",
        accepted: "function f(...args){console.log(args);}",
    },
    {
        ruleId: "prefer-spread",
        rejected: "f.apply(null, args);",
        accepted: "f(...args);",
    },
    {
        ruleId: "@typescript-eslint/await-thenable",
        rejected: "async function f(){await 1;}",
        accepted: "async function f(){await Promise.resolve(1);}",
    },
    {
        ruleId: "@typescript-eslint/no-array-constructor",
        rejected: "const x = new Array(1,2);",
        accepted: "const x = [1,2];",
    },
    {
        ruleId: "@typescript-eslint/no-array-delete",
        rejected: "const x=[1,2]; delete x[0];",
        accepted: "const x=[1,2]; x.splice(0,1);",
    },
    {
        ruleId: "@typescript-eslint/no-base-to-string",
        rejected: "const x = {}.toString();",
        accepted: "const x = (123).toString();",
    },
    {
        ruleId: "@typescript-eslint/no-confusing-void-expression",
        rejected: "const x = console.log('x');",
        accepted: "console.log('x');",
    },
    {
        ruleId: "@typescript-eslint/no-deprecated",
        rejected: "/** @deprecated use next */\nfunction old(){}\nold();",
        accepted: "function next(){}\nnext();",
    },
    {
        ruleId: "@typescript-eslint/no-duplicate-enum-values",
        rejected: "enum E { A=1, B=1 }",
        accepted: "enum E { A=1, B=2 }",
    },
    {
        ruleId: "@typescript-eslint/no-duplicate-type-constituents",
        rejected: "type T = string | string;",
        accepted: "type T = string | number;",
    },
    {
        ruleId: "@typescript-eslint/no-dynamic-delete",
        rejected: "function f(x:Record<string,number>, k:string){delete x[k];}",
        accepted: "function f(x:Record<string,number>){delete x['fixed'];}",
    },
    {
        ruleId: "@typescript-eslint/no-empty-object-type",
        rejected: "type T = {};",
        accepted: "type T = object;",
    },
    {
        ruleId: "@typescript-eslint/no-extra-non-null-assertion",
        rejected: "declare const x: string | undefined; x!!;",
        accepted: "declare const x: string | undefined; x!;",
    },
    {
        ruleId: "@typescript-eslint/no-extraneous-class",
        rejected: "class C {}",
        accepted: "class C { value=1; }",
    },
    {
        ruleId: "@typescript-eslint/no-floating-promises",
        rejected: "Promise.resolve(1);",
        accepted: "void Promise.resolve(1);",
    },
    {
        ruleId: "@typescript-eslint/no-for-in-array",
        rejected: "for(const key in [1,2]) console.log(key);",
        accepted: "for(const value of [1,2]) console.log(value);",
    },
    {
        ruleId: "@typescript-eslint/no-generated-empty-object-type",
        rejected: "type T = Pick<{x:number}, never>;",
        accepted: "type T = Pick<{x:number}, 'x'>;",
    },
    {
        ruleId: "@typescript-eslint/no-implied-eval",
        rejected: "setTimeout('f()', 10);",
        accepted: "setTimeout(()=>console.log('x'), 10);",
    },
    {
        ruleId: "@typescript-eslint/no-invalid-void-type",
        rejected: "let x: void;",
        accepted: "function f(): void {console.log('x');}",
    },
    {
        ruleId: "@typescript-eslint/no-meaningless-void-operator",
        rejected: "void console.log('x');",
        accepted: "void Promise.resolve(1);",
    },
    {
        ruleId: "@typescript-eslint/no-misused-new",
        rejected: "interface I { new(): I; }",
        accepted: "interface I { new(): object; }",
    },
    {
        ruleId: "@typescript-eslint/no-misused-promises",
        rejected: "if(Promise.resolve(true)) console.log('x');",
        accepted:
            "async function f(){if(await Promise.resolve(true)) console.log('x');}",
    },
    {
        ruleId: "@typescript-eslint/no-misused-spread",
        rejected: "const x = {...Promise.resolve(1)};",
        accepted: "const x = {...{a:1}};",
    },
    {
        ruleId: "@typescript-eslint/no-mixed-enums",
        rejected: "enum E { A=1, B='b' }",
        accepted: "enum E { A=1, B=2 }",
    },
    {
        ruleId: "@typescript-eslint/no-namespace",
        rejected: "namespace X { export const x=1; }",
        accepted: "export const x=1;",
    },
    {
        ruleId: "@typescript-eslint/no-non-null-asserted-nullish-coalescing",
        rejected:
            "const x = Math.random() > .5 ? 'a' : undefined; const y=x! ?? 'a';",
        accepted: "declare const x:string|undefined; const y=x ?? 'a';",
    },
    {
        ruleId: "@typescript-eslint/no-non-null-asserted-optional-chain",
        rejected: "declare const x:{a:string}|undefined; x?.a!;",
        accepted: "declare const x:{a:string}|undefined; x?.a;",
    },
    {
        ruleId: "@typescript-eslint/no-redundant-type-constituents",
        rejected: "type T = string | any;",
        accepted: "type T = string | number;",
    },
    {
        ruleId: "@typescript-eslint/no-require-imports",
        rejected: "const fs = require('node:fs');",
        accepted: "import fs from 'node:fs';",
    },
    {
        ruleId: "@typescript-eslint/no-this-alias",
        rejected: "function f(){const self=this; return self;}",
        accepted: "function f(){return this;}",
    },
    {
        ruleId: "@typescript-eslint/no-unnecessary-boolean-literal-compare",
        rejected: "declare const x:boolean; if(x === true) console.log(x);",
        accepted: "declare const x:boolean; if(x) console.log(x);",
    },
    {
        ruleId: "@typescript-eslint/no-unnecessary-condition",
        rejected: "if('always') console.log('x');",
        accepted: "declare const x:boolean; if(x) console.log('x');",
    },
    {
        ruleId: "@typescript-eslint/no-unnecessary-template-expression",
        rejected: "const x = `${'hello'}`;",
        accepted: "declare const y:string; const x = `hello ${y}`;",
    },
    {
        ruleId: "@typescript-eslint/no-unnecessary-type-arguments",
        rejected: "function f<T=string>(){} f<string>();",
        accepted: "function f<T=string>(){} f<number>();",
    },
    {
        ruleId: "@typescript-eslint/no-unnecessary-type-assertion",
        rejected: "const x=1; const y=x as 1;",
        accepted: "declare const x:unknown; const y=x as string;",
    },
    {
        ruleId: "@typescript-eslint/no-unnecessary-type-constraint",
        rejected: "function f<T extends unknown>(x:T){return x;}",
        accepted: "function f<T>(x:T){return x;}",
    },
    {
        ruleId: "@typescript-eslint/no-unnecessary-type-conversion",
        rejected: "declare const x:string; String(x);",
        accepted: "declare const x:number; String(x);",
    },
    {
        ruleId: "@typescript-eslint/no-unnecessary-type-parameters",
        rejected: "function f<T extends string>(x:T):void {console.log(x);}",
        accepted: "function f<T>(x:T):T {return x;}",
    },
    {
        ruleId: "@typescript-eslint/no-unsafe-argument",
        rejected: "declare const x:any; function f(n:number){} f(x);",
        accepted: "function f(n:number){} f(1);",
    },
    {
        ruleId: "@typescript-eslint/no-unsafe-assignment",
        rejected: "declare const x:any; const y:number=x;",
        accepted: "const y:number=1;",
    },
    {
        ruleId: "@typescript-eslint/no-unsafe-declaration-merging",
        rejected: "interface C {x:number;} class C {}",
        accepted: "interface I {x:number;} class C {x=1;}",
    },
    {
        ruleId: "@typescript-eslint/no-unsafe-enum-comparison",
        rejected: "enum E {A=1} declare const e:E; e === 1;",
        accepted: "enum E {A=1} declare const e:E; e === E.A;",
    },
    {
        ruleId: "@typescript-eslint/no-unsafe-function-type",
        rejected: "declare const f:Function;",
        accepted: "declare const f:()=>void;",
    },
    {
        ruleId: "@typescript-eslint/no-unsafe-member-access",
        rejected: "declare const x:any; x.foo;",
        accepted: "declare const x:{foo:number}; x.foo;",
    },
    {
        ruleId: "@typescript-eslint/no-unsafe-return",
        rejected: "declare const x:any; function f():number{return x;}",
        accepted: "function f():number{return 1;}",
    },
    {
        ruleId: "@typescript-eslint/no-unsafe-unary-minus",
        rejected: "declare const x:string; -x;",
        accepted: "declare const x:number; -x;",
    },
    {
        ruleId: "@typescript-eslint/no-unused-expressions",
        rejected: "1;",
        accepted: "console.log(1);",
    },
    {
        ruleId: "@typescript-eslint/no-unused-vars",
        rejected: "const x=1;",
        accepted: "export const x=1;",
    },
    {
        ruleId: "@typescript-eslint/no-useless-constructor",
        rejected: "class C {constructor(){}}",
        accepted: "class C {constructor(){console.log('x');}}",
    },
    {
        ruleId: "@typescript-eslint/no-useless-default-assignment",
        rejected: "const { x = 1 } = { x: 2 };",
        accepted: "const { x = 1 } = {} as { x?: number }; ",
    },
    {
        ruleId: "@typescript-eslint/no-wrapper-object-types",
        rejected: "let x:String;",
        accepted: "let x:string;",
    },
    {
        ruleId: "@typescript-eslint/only-throw-error",
        rejected: "throw 'failed';",
        accepted: "throw new Error('failed');",
    },
    {
        ruleId: "@typescript-eslint/prefer-as-const",
        rejected: "const x = 'hello' as 'hello';",
        accepted: "const x = 'hello' as const;",
    },
    {
        ruleId: "@typescript-eslint/prefer-literal-enum-member",
        rejected: "enum E {A=Math.random()}",
        accepted: "enum E {A=1}",
    },
    {
        ruleId: "@typescript-eslint/prefer-namespace-keyword",
        rejected: "module X { export const n=1; }",
        accepted: "namespace X { export const n=1; }",
    },
    {
        ruleId: "@typescript-eslint/prefer-promise-reject-errors",
        rejected: "Promise.reject('failed');",
        accepted: "Promise.reject(new Error('failed'));",
    },
    {
        ruleId: "@typescript-eslint/prefer-reduce-type-parameter",
        rejected: "[1].reduce((a,n)=>a+n, 0 as number);",
        accepted: "[1].reduce<number>((a,n)=>a+n, 0);",
    },
    {
        ruleId: "@typescript-eslint/prefer-return-this-type",
        rejected: "class C {f(): C {return this;}}",
        accepted: "class C {f(): this {return this;}}",
    },
    {
        ruleId: "@typescript-eslint/related-getter-setter-pairs",
        rejected: "class C {get x():number{return 1;} set x(value:string){}}",
        accepted: "class C {get x():number{return 1;} set x(value:number){}}",
    },
    {
        ruleId: "@typescript-eslint/require-await",
        rejected: "async function f(){return 1;}",
        accepted: "async function f(){return await Promise.resolve(1);}",
    },
    {
        ruleId: "@typescript-eslint/restrict-plus-operands",
        rejected: "const x=1 + 'a';",
        accepted: "const x='1' + 'a';",
    },
    {
        ruleId: "@typescript-eslint/restrict-template-expressions",
        rejected: "const x=`${{}}`;",
        accepted: "const x=`${'hello'}`;",
    },
    {
        ruleId: "@typescript-eslint/return-await",
        rejected:
            "async function f(){try{return Promise.resolve(1);}catch(e){throw e;}}",
        accepted:
            "async function f(){try{return await Promise.resolve(1);}catch(e){throw e;}}",
    },
    {
        ruleId: "@typescript-eslint/triple-slash-reference",
        rejected: '/// <reference path="other.ts" />\nexport {};',
        accepted: "export {};",
    },
    {
        ruleId: "@typescript-eslint/unbound-method",
        rejected:
            "class C {x=1; f(){return this.x;}} const c=new C(); const f=c.f;",
        accepted:
            "class C {x=1; f(){return this.x;}} const c=new C(); const f=()=>c.f();",
    },
    {
        ruleId: "@typescript-eslint/unified-signatures",
        rejected:
            "function f(x:string):void; function f(x:number):void; function f(x:string|number){}",
        accepted: "function f(x:string|number):void {}",
    },
    {
        ruleId: "@typescript-eslint/use-unknown-in-catch-callback-variable",
        rejected: "Promise.resolve(1).catch(e=>console.log(e));",
        accepted: "Promise.resolve(1).catch((e:unknown)=>console.log(e));",
    },
    {
        ruleId: "@typescript-eslint/adjacent-overload-signatures",
        rejected:
            "interface I { f(x:string):void; g():void; f(x:number):void; }",
        accepted:
            "interface I { f(x:string):void; f(x:number):void; g():void; }",
    },
    {
        ruleId: "@typescript-eslint/array-type",
        rejected: "const x:Array<number>=[];",
        accepted: "const x:number[]=[];",
    },
    {
        ruleId: "@typescript-eslint/ban-tslint-comment",
        rejected: "// tslint:disable-next-line\nconst x=1;",
        accepted: "const x=1;",
    },
    {
        ruleId: "@typescript-eslint/class-literal-property-style",
        rejected: "class C {get x(){return 1;}}",
        accepted: "class C {readonly x=1;}",
    },
    {
        ruleId: "@typescript-eslint/consistent-generic-constructors",
        rejected: "const x:Map<string,number>=new Map();",
        accepted: "const x=new Map<string,number>();",
    },
    {
        ruleId: "@typescript-eslint/consistent-indexed-object-style",
        rejected: "type T = {[key:string]:number};",
        accepted: "type T = Record<string,number>;",
    },
    {
        ruleId: "@typescript-eslint/consistent-type-definitions",
        rejected: "type T = {x:number};",
        accepted: "interface T {x:number;}",
    },
    {
        ruleId: "@typescript-eslint/dot-notation",
        rejected: "const x={a:1}; x['a'];",
        accepted: "const x={a:1}; x.a;",
    },
    {
        ruleId: "@typescript-eslint/no-confusing-non-null-assertion",
        rejected: "declare const x:number|undefined; const y=1; x! == y;",
        accepted: "declare const x:number|undefined; const y=1; x === y;",
    },
    {
        ruleId: "@typescript-eslint/no-empty-function",
        rejected: "function f(){}",
        accepted: "function f(){console.log('x');}",
    },
    {
        ruleId: "@typescript-eslint/no-inferrable-types",
        rejected: "const x:number=1;",
        accepted: "const x=1;",
    },
    {
        ruleId: "@typescript-eslint/non-nullable-type-assertion-style",
        rejected: "declare const x:string|undefined; const y=x as string;",
        accepted: "declare const x:string|undefined; const y=x!;",
    },
    {
        ruleId: "@typescript-eslint/prefer-find",
        rejected: "const x=[1,2].filter(n=>n>1)[0];",
        accepted: "const x=[1,2].find(n=>n>1);",
    },
    {
        ruleId: "@typescript-eslint/prefer-for-of",
        rejected:
            "const xs=[1,2]; for(let i=0;i<xs.length;i++){console.log(xs[i]);}",
        accepted: "const xs=[1,2]; for(const x of xs){console.log(x);}",
    },
    {
        ruleId: "@typescript-eslint/prefer-function-type",
        rejected: "interface F {(x:number):number;}",
        accepted: "type F = (x:number)=>number;",
    },
    {
        ruleId: "@typescript-eslint/prefer-includes",
        rejected: "const xs=[1,2]; xs.indexOf(1) !== -1;",
        accepted: "const xs=[1,2]; xs.includes(1);",
    },
    {
        ruleId: "@typescript-eslint/prefer-nullish-coalescing",
        rejected: "declare const x:string|undefined; const y=x || 'fallback';",
        accepted: "declare const x:string|undefined; const y=x ?? 'fallback';",
    },
    {
        ruleId: "@typescript-eslint/prefer-optional-chain",
        rejected: "declare const x:{a:number}|undefined; const y=x && x.a;",
        accepted: "declare const x:{a:number}|undefined; const y=x?.a;",
    },
    {
        ruleId: "@typescript-eslint/prefer-regexp-exec",
        rejected: "const x='abc'.match(/a/);",
        accepted: "const x=/a/.exec('abc');",
    },
    {
        ruleId: "@typescript-eslint/prefer-string-starts-ends-with",
        rejected: "declare const x:string; x.indexOf('a') === 0;",
        accepted: "declare const x:string; x.startsWith('a');",
    },
];

for (const { ruleId, rejected, accepted } of RULE_EXAMPLES) {
    void test(`${ruleId} rejects its violation`, async () => {
        const diagnostics = await lintRule(ruleId, rejected);
        assert.ok(
            diagnostics.length > 0,
            `${ruleId} did not reject its violation`,
        );
        assert.ok(
            diagnostics.every((diagnostic) => diagnostic.id === ruleId),
            JSON.stringify(diagnostics),
        );
    });
    void test(`${ruleId} accepts its control`, async () => {
        const diagnostics = await lintRule(ruleId, accepted);
        assert.deepEqual(diagnostics, []);
    });
}

void test("no-nonoctal-decimal-escape syntax is rejected by the parser", async () => {
    const diagnostics = await lintParserRestriction(
        "no-nonoctal-decimal-escape",
        "const s='\\8';",
    );
    assert.ok(
        diagnostics.some(
            (diagnostic) =>
                diagnostic.fatal === true && diagnostic.id === "(no rule)",
        ),
        JSON.stringify(diagnostics),
    );
});
void test("no-nonoctal-decimal-escape control is accepted by the parser", async () => {
    const diagnostics = await lintParserRestriction(
        "no-nonoctal-decimal-escape",
        "const s='8';",
    );
    assert.deepEqual(diagnostics, []);
});

void test("no-octal syntax is rejected by the parser", async () => {
    const diagnostics = await lintParserRestriction(
        "no-octal",
        "const x = 071;",
    );
    assert.ok(
        diagnostics.some(
            (diagnostic) =>
                diagnostic.fatal === true && diagnostic.id === "(no rule)",
        ),
        JSON.stringify(diagnostics),
    );
});
void test("no-octal control is accepted by the parser", async () => {
    const diagnostics = await lintParserRestriction(
        "no-octal",
        "const x = 0o71;",
    );
    assert.deepEqual(diagnostics, []);
});
