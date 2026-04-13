function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** One CSV record line: splits on commas outside double quotes (`""` = literal quote). */
export function parseCsvDataLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

export function toCsvRow(cells: string[]): string {
  return cells.map(escapeCsvCell).join(",");
}

export function toCsvContent(headers: string[], rows: string[][]): string {
  const lines = [toCsvRow(headers), ...rows.map((r) => toCsvRow(r))];
  return `${lines.join("\r\n")}\r\n`;
}
