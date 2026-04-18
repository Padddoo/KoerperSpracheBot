import mammoth from "mammoth";

export async function extractTextFromFile(
  file: File,
): Promise<{ filename: string; text: string }> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const name = file.name.toLowerCase();

  if (name.endsWith(".pdf")) {
    const pdfParse = (await import("pdf-parse")).default;
    const result = await pdfParse(buffer);
    return { filename: file.name, text: result.text };
  }

  if (name.endsWith(".docx")) {
    const result = await mammoth.extractRawText({ buffer });
    return { filename: file.name, text: result.value };
  }

  if (name.endsWith(".txt") || name.endsWith(".md")) {
    return { filename: file.name, text: buffer.toString("utf8") };
  }

  throw new Error(
    `Dateiformat nicht unterstützt: ${file.name}. Bitte PDF oder DOCX hochladen.`,
  );
}
