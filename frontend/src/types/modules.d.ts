declare module '*.svg' {
  const content: string;
  export default content;
}

declare module '*.jsx' {
  const anyComponent: any;
  export default anyComponent;
}
