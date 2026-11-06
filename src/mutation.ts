/**
 * Mutation permissions for the Mycoscope ESLint rules. Enable both
 * no-foreign-mutation and no-permission-escalation; TypeScript alone does not
 * enforce these optional phantom markers at assignment/call boundaries.
 *
 * Unmarked references are read-only to the linter, including fresh locals.
 * A fresh allocation may be annotated Mut; MutDeep also requires authorized
 * descendants. Aliases retain grants; an explicitly unmarked view drops them.
 *
 * Field grants describe nested references: { readonly child: Mut<Child> } lets
 * a callee edit child, without granting replacement of the parent's child slot.
 * Selecting individual scalar slots is a separate contract, not encoded here.
 *
 * No freezing, copying, exclusive borrowing, or value-stability promise.
 * Third-party implementations/declaration contracts remain trusted; known
 * builtin mutators are checked, but arbitrary external effects are not proven.
 */
import type { Writable, WritableDeep } from "type-fest";

// Optional, private phantom key: no runtime allocation or public brand constructor.
// The lint rules recognize this declaration by symbol, not the names of the aliases.
declare const mutationPermission: unique symbol;

/** Authorizes mutation of direct properties, array slots, or collection entries. */
export type Mut<T extends object> = Writable<T> & {
    readonly [mutationPermission]?: "shallow";
};

/** Authorizes mutation of the reference and everything reachable through it. */
export type MutDeep<T extends object> = WritableDeep<T> & {
    readonly [mutationPermission]?: "deep";
};
