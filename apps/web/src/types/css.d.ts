// Allow importing CSS files in TypeScript (e.g. xterm.js stylesheet)
declare module '*.css' {
  const content: Record<string, string>
  export default content
}
