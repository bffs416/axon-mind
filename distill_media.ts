import { workflow, node, trigger } from '@n8n/workflow-sdk';

const startTrigger = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Webhook',
    parameters: {
      httpMethod: 'POST',
      path: 'distill-media',
      responseMode: 'responseNode'
    },
    position: [100, 300]
  },
  output: [{ body: { url: 'https://www.tiktok.com/@lopeztips/video/7553353956886433055' } }]
});

const getCobaltUrl = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Get Audio URL (Cobalt)',
    parameters: {
      method: 'POST',
      url: 'http://192.168.2.16:8089/',
      sendHeaders: true,
      headerParameters: {
        parameters: [
          { name: 'Accept', value: 'application/json' },
          { name: 'Content-Type', value: 'application/json' }
        ]
      },
      sendBody: true,
      specifyBody: 'json',
      jsonBody: `={
  "url": "{{ $json.body.url }}",
  "downloadMode": "audio"
}`
    },
    position: [300, 300]
  },
  output: [{ url: 'https://audio.url', status: 'redirect' }]
});

const downloadAudio = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Download Audio',
    parameters: {
      method: 'GET',
      url: '={{ $json.url }}',
      responseFormat: 'file',
      outputPropertyName: 'audioFile'
    },
    position: [500, 300]
  },
  output: [{ audioFile: { mimeType: 'audio/mpeg', data: 'base64...' } }]
});

const transcribeAudio = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Transcribe (Groq Whisper)',
    parameters: {
      method: 'POST',
      url: 'https://api.groq.com/openai/v1/audio/transcriptions',
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'groqApi',
      sendBody: true,
      contentType: 'multipart-form-data',
      bodyParameters: {
        parameters: [
          { parameterType: 'form-data', name: 'model', value: 'whisper-large-v3-turbo' },
          { parameterType: 'form-data', name: 'response_format', value: 'json' },
          { parameterType: 'form-data', name: 'language', value: 'es' }
        ]
      },
      sendBinaryData: true,
      binaryPropertyName: 'audioFile:file'
    },
    position: [700, 300]
  },
  output: [{ text: 'Transcription goes here...' }]
});

const analyzeText = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Analyze Content (Groq LLaMA)',
    parameters: {
      method: 'POST',
      url: 'https://api.groq.com/openai/v1/chat/completions',
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'groqApi',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: `={
  "model": "llama-3.3-70b-versatile",
  "messages": [
    {
      "role": "system",
      "content": "Eres un asistente experto en destilar contenido educativo. Recibirás una transcripción de un video. Tu tarea es extraer: 1) Título descriptivo. 2) Resumen corto. 3) Lista de herramientas mencionadas. 4) Pasos accionables. Responde SIEMPRE en JSON EXACTO: {\\"title\\": \\"\\", \\"summary\\": \\"\\", \\"tools\\": [], \\"steps\\": []}"
    },
    {
      "role": "user",
      "content": "Transcripción: {{ $json.text }}"
    }
  ],
  "temperature": 0.3,
  "response_format": {
    "type": "json_object"
  }
}`
    },
    position: [900, 300]
  },
  output: [{ choices: [{ message: { content: '{"title":"Example","summary":"...","tools":[],"steps":[]}' } }] }]
});

const respond = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond',
    parameters: {
      respondWith: 'json',
      responseBody: '={{ JSON.parse($json.choices[0].message.content) }}'
    },
    position: [1100, 300]
  },
  output: [{}]
});

export default workflow('', 'Axon - Destilador de Redes')
  .add(startTrigger)
  .to(getCobaltUrl)
  .to(downloadAudio)
  .to(transcribeAudio)
  .to(analyzeText)
  .to(respond);
