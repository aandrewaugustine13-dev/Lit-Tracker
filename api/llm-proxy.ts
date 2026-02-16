/**
 * Vercel Serverless Function: LLM API Proxy
 * 
 * Proxies LLM API requests to avoid CORS issues when calling from browser.
 * Supports: OpenAI, Grok, DeepSeek, Groq, Gemini, Anthropic
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

interface ProxyRequest {
  provider: 'openai' | 'grok' | 'deepseek' | 'groq' | 'gemini' | 'anthropic';
  apiKey: string;
  model?: string;
  prompt: string; // System prompt
  script: string; // User content
}

interface ProxyResponse {
  text?: string;
  error?: string;
}

const DEFAULT_MODELS: Record<string, string> = {
  groq: 'llama-3.3-70b-versatile',
  openai: 'gpt-4o',
  deepseek: 'deepseek-chat',
  grok: 'grok-2-latest',
  gemini: 'gemini-2.0-flash',
  anthropic: 'claude-sonnet-4-5-20250929',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '86400');
    return res.status(200).end();
  }

  // Set CORS headers for actual request
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body as ProxyRequest;

    // Validate required fields
    if (!body.provider) {
      return res.status(400).json({ error: 'Missing required field: provider' });
    }
    if (!body.apiKey) {
      return res.status(400).json({ error: 'Missing required field: apiKey' });
    }
    if (!body.prompt) {
      return res.status(400).json({ error: 'Missing required field: prompt' });
    }
    if (!body.script) {
      return res.status(400).json({ error: 'Missing required field: script' });
    }

    const { provider, apiKey, prompt, script } = body;
    const model = body.model || DEFAULT_MODELS[provider];

    let responseText: string;

    switch (provider) {
      case 'groq':
        responseText = await callGroq(prompt, script, apiKey, model);
        break;
      case 'openai':
        responseText = await callOpenAI(prompt, script, apiKey, model);
        break;
      case 'deepseek':
        responseText = await callDeepSeek(prompt, script, apiKey, model);
        break;
      case 'grok':
        responseText = await callGrok(prompt, script, apiKey, model);
        break;
      case 'gemini':
        responseText = await callGemini(prompt, script, apiKey, model);
        break;
      case 'anthropic':
        responseText = await callAnthropic(prompt, script, apiKey, model);
        break;
      default:
        return res.status(400).json({ error: `Unsupported provider: ${provider}` });
    }

    const response: ProxyResponse = { text: responseText };
    return res.status(200).json(response);

  } catch (error: any) {
    console.error('Proxy error:', error);
    const errorMessage = error.message || 'Unknown error occurred';
    return res.status(500).json({ error: errorMessage });
  }
}

// ============= API CALL FUNCTIONS =============

async function callGroq(
  prompt: string,
  script: string,
  apiKey: string,
  model: string
): Promise<string> {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: script },
      ],
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Groq API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

async function callOpenAI(
  prompt: string,
  script: string,
  apiKey: string,
  model: string
): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: script },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

async function callDeepSeek(
  prompt: string,
  script: string,
  apiKey: string,
  model: string
): Promise<string> {
  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: script },
      ],
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`DeepSeek API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

async function callGrok(
  prompt: string,
  script: string,
  apiKey: string,
  model: string
): Promise<string> {
  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: script },
      ],
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Grok API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

async function callGemini(
  prompt: string,
  script: string,
  apiKey: string,
  model: string
): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: `${prompt}\n\n${script}` }],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}

async function callAnthropic(
  prompt: string,
  script: string,
  apiKey: string,
  model: string
): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 16384,
      messages: [
        { role: 'user', content: `${prompt}\n\n${script}` },
      ],
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.content[0].text;
}
