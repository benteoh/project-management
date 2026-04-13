function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function toCsvRow(cells: string[]): string {
  return cells.map(escapeCsvCell).join(",");
}

export function toCsvContent(headers: string[], rows: string[][]): string {
  const lines = [toCsvRow(headers), ...rows.map((r) => toCsvRow(r))];
  return `${lines.join("\r\n")}\r\n`;
}
