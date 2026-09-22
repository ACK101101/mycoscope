interface Config<Names extends string> {
  // allow for some sort of naming
  systems: { name: Names; path: string }[];
  connections: [Names, Names][];
  exempt: string[];
}

export function defineConfig<Names extends string>(config: Config<Names>): Config<Names> {
  return config;
}
