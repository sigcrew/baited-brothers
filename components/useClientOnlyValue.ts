// This function is web-only as native doesn't currently support server (or build-time) rendering.
export const useClientOnlyValue = <S, C>(server: S, client: C): S | C =>
  client;
