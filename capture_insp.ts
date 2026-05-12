import { workflow, node, trigger } from '@n8n/workflow-sdk';

const startTrigger = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Webhook',
    parameters: {
      httpMethod: 'POST',
      path: 'capture-inspiration',
      responseMode: 'responseNode'
    },
    position: [100, 300]
  },
  output: [{ body: { url: 'https://example.com' } }]
});

const extractMetadata = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Extract Metadata',
    parameters: {
      method: 'GET',
      url: '={{ $json.body.url }}'
    },
    position: [300, 300]
  },
  output: [{ data: '<html>...</html>' }]
});

const parseHTML = node({
  type: 'n8n-nodes-base.html',
  version: 1.2,
  config: {
    name: 'Parse HTML',
    parameters: {
      operation: 'extractHtmlContent',
      dataPropertyName: 'data',
      extractionValues: {
        values: [
          { key: 'title', cssSelector: 'title', returnValue: 'text' },
          { key: 'description', cssSelector: 'meta[name="description"]', returnValue: 'attribute', attribute: 'content' }
        ]
      }
    },
    position: [500, 300]
  },
  output: [{ title: 'Example', description: 'Desc' }]
});

const classify = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Classify with Groq',
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
      "content": "You are a content classifier. Based on the title and description, classify the URL into one category: 3D, Dev, Video, Marketing, or General. Respond with JSON: {\\"category\\": \\"category_name\\", \\"action_step\\": \\"one action to take\\"}"
    },
    {
      "role": "user",
      "content": "Title: {{ $json.title }}\\nDesc: {{ $json.description }}"
    }
  ],
  "temperature": 0.2,
  "response_format": {
    "type": "json_object"
  }
}`
    },
    position: [700, 300]
  },
  output: [{ choices: [{ message: { content: '{"category":"Dev","action_step":"Read docs"}' } }] }]
});

const saveToSupabase = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Save to Supabase',
    parameters: {
      operation: 'executeQuery',
      query: 'INSERT INTO inspirations (url, title, description, category, action_step) VALUES ($1, $2, $3, $4, $5)',
      options: {
        queryReplacement: '={{ [ $(\'Webhook\').item.json.body.url, $(\'Parse HTML\').item.json.title, $(\'Parse HTML\').item.json.description, JSON.parse($json.choices[0].message.content).category, JSON.parse($json.choices[0].message.content).action_step ] }}'
      }
    },
    position: [900, 300]
  },
  output: [{}]
});

const respond = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond',
    parameters: {
      respondWith: 'json',
      responseBody: '={{ JSON.stringify({ success: true, message: "Inspiration captured!" }) }}'
    },
    position: [1100, 300]
  },
  output: [{}]
});

export default workflow('6xmOK0q5Nea67XAH', 'Axon - Capture Inspiration')
  .add(startTrigger)
  .to(extractMetadata)
  .to(parseHTML)
  .to(classify)
  .to(saveToSupabase)
  .to(respond);
