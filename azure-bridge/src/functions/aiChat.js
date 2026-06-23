const { app } = require('@azure/functions');
const axios = require('axios');
const { buildSystemPrompt, extractDrugName, fetchFdaContext, getRuleBasedResponse } = require('../lib/aiAssistant');

app.http('aiChat', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'bridge/ai/chat',
  handler: async (request) => {
    try {
      const body = await request.json();
      const { message, history = [], user, meds = [], allergies = [], metrics = null, docStr = 'your registered GP' } = body;
      const trimmed = (message || '').trim();
      if (!trimmed) return { status: 400, jsonBody: { error: 'Empty message' } };
      if (!user?.name) return { status: 400, jsonBody: { error: 'Missing user context' } };

      const systemPrompt = buildSystemPrompt({ user, meds, allergies, metrics, docStr });

      const drugName = extractDrugName(trimmed, meds);
      let fullPrompt = systemPrompt;
      if (drugName) {
        const fdaContext = await fetchFdaContext(drugName);
        if (fdaContext) {
          fullPrompt += `\n\n${fdaContext}\n\nUse the FDA data above to give accurate, evidence-based information about this drug. Always add a disclaimer to consult their doctor.`;
        }
      }

      const apiKey = process.env.GEMINI_API_KEY;
      const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

      if (apiKey) {
        try {
          const geminiContents = history
            .filter(h => ['user', 'assistant'].includes(h.role) && h.content)
            .map(h => ({ role: h.role === 'assistant' ? 'model' : 'user', parts: [{ text: String(h.content) }] }));
          geminiContents.push({ role: 'user', parts: [{ text: trimmed }] });

          const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
            {
              system_instruction: { parts: [{ text: fullPrompt }] },
              contents: geminiContents,
              generationConfig: { maxOutputTokens: 900 },
            },
            { timeout: 30000 }
          );

          const reply = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (reply) return { jsonBody: { reply, source: 'gemini', model } };
        } catch (geminiErr) {
          const reply = getRuleBasedResponse(trimmed, { user, meds, allergies, metrics, docStr });
          const detail = geminiErr.response?.data?.error?.message || geminiErr.message;
          return { jsonBody: { reply, source: 'local', model: 'HealthSphere AI (built-in)', geminiError: detail } };
        }
      }

      const reply = getRuleBasedResponse(trimmed, { user, meds, allergies, metrics, docStr });
      return { jsonBody: { reply, source: 'local', model: 'HealthSphere AI (built-in)', geminiError: apiKey ? 'no reply in response' : 'GEMINI_API_KEY not configured' } };
    } catch (err) {
      return { status: 500, jsonBody: { error: err.message } };
    }
  },
});
