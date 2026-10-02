export type LLMModel = 'gemini-3-flash' | 'deepseek-v4-pro';

export interface LLMConfig {
  model: LLMModel;
  apiKey: string;
  customBaseUrl?: string;
}

const STORAGE_KEY = 'knn_lab_llm_config';

export function getStoredLLMConfig(): LLMConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        model: parsed.model === 'deepseek-v4-pro' ? 'deepseek-v4-pro' : 'gemini-3-flash',
        apiKey: parsed.apiKey || '',
        customBaseUrl: parsed.customBaseUrl || '',
      };
    }
  } catch (e) {
    // Ignore error
  }
  return {
    model: 'gemini-3-flash',
    apiKey: '',
    customBaseUrl: '',
  };
}

export function saveStoredLLMConfig(config: LLMConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    // Ignore error
  }
}

export interface CallLLMParams {
  config: LLMConfig;
  systemPrompt: string;
  userPrompt: string;
  history?: { role: 'user' | 'model'; text: string }[];
}

export async function callBrowserLLM({
  config,
  systemPrompt,
  userPrompt,
  history = [],
}: CallLLMParams): Promise<string> {
  const apiKey = config.apiKey.trim();
  if (!apiKey) {
    throw new Error('未检测到 API-Key！请点击右上角小齿轮 ⚙️ 设置并保存您的 API-Key。');
  }

  if (config.model === 'gemini-3-flash') {
    // Direct Browser call to Google Gemini API
    // Compatible with GitHub static pages & serverless deployment
    const modelEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const formattedContents: any[] = [];

    // History turns
    if (history && history.length > 0) {
      for (const item of history.slice(-6)) {
        formattedContents.push({
          role: item.role === 'user' ? 'user' : 'model',
          parts: [{ text: item.text }],
        });
      }
    }

    formattedContents.push({
      role: 'user',
      parts: [{ text: userPrompt }],
    });

    const body: any = {
      system_instruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: formattedContents,
      generationConfig: {
        temperature: 0.4,
      },
    };

    const response = await fetch(modelEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      const errMsg = errJson?.error?.message || response.statusText;
      throw new Error(`Gemini API 响应错误 (${response.status}): ${errMsg}`);
    }

    const data = await response.json();
    const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) {
      throw new Error('Gemini API 未返回有效文本，请检查 Prompt 或密钥配额。');
    }
    return candidateText;
  } else {
    // DeepSeek API (deepseek-v4-pro / deepseek-chat)
    // Supports standard OpenAI-compatible format
    const baseUrl = config.customBaseUrl?.trim() || 'https://api.deepseek.com/chat/completions';

    const messages: any[] = [{ role: 'system', content: systemPrompt }];

    if (history && history.length > 0) {
      for (const item of history.slice(-6)) {
        messages.push({
          role: item.role === 'user' ? 'user' : 'assistant',
          content: item.text,
        });
      }
    }

    messages.push({ role: 'user', content: userPrompt });

    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat', // DeepSeek standard model endpoint
        messages,
        temperature: 0.4,
      }),
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      const errMsg = errJson?.error?.message || errJson?.message || response.statusText;
      throw new Error(`DeepSeek API 响应错误 (${response.status}): ${errMsg}`);
    }

    const data = await response.json();
    const replyText = data?.choices?.[0]?.message?.content;
    if (!replyText) {
      throw new Error('DeepSeek API 未返回有效内容，请检查密钥与网络连通性。');
    }
    return replyText;
  }
}
