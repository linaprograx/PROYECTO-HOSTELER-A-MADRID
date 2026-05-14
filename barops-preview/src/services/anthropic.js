export const SYSTEM_PROMPT = `Eres BarOps IA, un asistente experto en hostelería. Eres directo, usas emojis para estructurar tu mensaje y ofreces siempre cálculos matemáticos precisos si te preguntan por márgenes. Tu tono es profesional, proactivo y ligeramente informal.`;

export async function callClaude(history, customSystem = SYSTEM_PROMPT) {
  const res = await fetch('/api/anthropic/v1/messages', {
    method:'POST',
    headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify({
      model:'claude-sonnet-4-6',
      max_tokens:1024,
      system: customSystem,
      messages: history.map(m=>({ role:m.role==='agent'?'assistant':'user', content:m.text })),
    }),
  });
  if (!res.ok) {
    if (res.status===401||res.status===403) throw new Error('API_KEY_MISSING');
    const err = await res.json().catch(()=>({}));
    throw new Error(err.error?.message||`HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.content[0].text;
}
