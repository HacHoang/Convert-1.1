const GEMINI_MODEL = 'gemini-2.5-flash';

export async function translateWithGemini(apiKey: string, sourceText: string, style: string): Promise<string> {
  const text = sourceText.trim();
  if (!text) throw new Error('Chưa có nội dung để dịch.');
  if (!apiKey.trim()) throw new Error('Chưa có API key Gemini đang dùng.');

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{
            text: `Bạn là dịch giả truyện Trung-Việt. Hãy dịch nguyên văn tiếng Trung sang tiếng Việt tự nhiên, dễ đọc, giữ đúng nội dung, tên riêng, cách xưng hô và cấu trúc đoạn. Phong cách: ${style}. Chỉ trả về bản dịch, không giải thích, không thêm lời dẫn.`,
          }],
        },
        contents: [{ role: 'user', parts: [{ text }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 32768 },
      }),
    },
  );

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error('Gemini trả về phản hồi không đọc được.');
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new Error('API key không hợp lệ hoặc chưa được cấp quyền Gemini.');
    if (response.status === 429) throw new Error('Gemini đang giới hạn yêu cầu hoặc đã hết hạn mức API.');
    if (response.status >= 500) throw new Error('Gemini đang gặp sự cố. Hãy thử lại sau.');
    const message = (payload as { error?: { message?: unknown } })?.error?.message;
    throw new Error(typeof message === 'string' ? message : 'Gemini không nhận yêu cầu dịch.');
  }

  const data = payload as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: unknown }> };
      finishReason?: string;
    }>;
  };
  const candidate = data.candidates?.[0];
  const translated = candidate?.content?.parts?.map(part => typeof part.text === 'string' ? part.text : '').join('').trim();
  if (!translated) {
    if (candidate?.finishReason === 'SAFETY') throw new Error('Gemini không thể dịch nội dung này do bộ lọc an toàn.');
    throw new Error('Gemini không trả về bản dịch. Hãy thử lại với đoạn văn ngắn hơn.');
  }
  return translated;
}
