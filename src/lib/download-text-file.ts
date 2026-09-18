/** Triggers a browser download of `content` as a file — no server round-trip. */
export function downloadTextFile(filename: string, content: string, mimeType = "text/markdown;charset=utf-8"): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
