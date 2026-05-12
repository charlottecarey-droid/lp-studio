// Re-export of the shared template engine. Single source of truth lives in
// `@workspace/lp-template-engine` so the studio runtime, the studio preview,
// and the api-server validator can never drift apart.
export * from "@workspace/lp-template-engine";
