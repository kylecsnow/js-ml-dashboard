declare module 'smiles-drawer' {
  export default class SmilesDrawer {
    static apply(element: HTMLElement | string, options?: object): void;
    static parse(smiles: string, ringsystems?: boolean): object;
  }
} 