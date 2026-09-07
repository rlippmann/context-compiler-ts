declare module '@ar-nelson/foldcase' {
  interface Foldcase {
    (value: string): string;
    full(value: string): string;
    simple(value: string): string;
    charFull(value: string): string;
    charSimple(value: string): string;
  }

  const foldcase: Foldcase;
  export default foldcase;
}
