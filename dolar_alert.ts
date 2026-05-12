import { workflow, node, trigger, ifElse, expr } from '@n8n/workflow-sdk';

const start = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: {
    name: 'Every Hour',
    parameters: {
      rule: { interval: [{ field: 'hours', hoursInterval: 1 }] }
    },
    position: [100, 300]
  },
  output: [{}]
});

const getDolar = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Get USD/COP',
    parameters: {
      method: 'GET',
      url: 'https://open.er-api.com/v6/latest/USD'
    },
    position: [300, 300]
  },
  output: [{ rates: { COP: 3550 } }]
});

const checkPrice = ifElse({
  version: 2.3,
  config: {
    name: 'Check Price',
    parameters: {
      conditions: {
        options: {},
        conditions: [
          { leftValue: '={{ $json.rates.COP }}', operator: { type: 'number', operation: 'gte' }, rightValue: 3500 },
          { leftValue: '={{ $json.rates.COP }}', operator: { type: 'number', operation: 'lte' }, rightValue: 3600 }
        ]
      }
    },
    position: [500, 300]
  }
});

const saveToInbox = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Send to Inbox',
    parameters: {
      operation: 'executeQuery',
      query: 'INSERT INTO inbox (content, status) VALUES ($1, \'new\')',
      options: {
        queryReplacement: '={{ [ "🚨 ALERTA DOLAR: El dolar está a $" + $(\'Get USD/COP\').item.json.rates.COP ] }}'
      }
    },
    position: [700, 200]
  },
  output: [{}]
});

const saveToDb = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Save History',
    parameters: {
      operation: 'executeQuery',
      query: 'INSERT INTO dolar_history (rate, created_at, alert_sent) VALUES ($1, now(), true)',
      options: {
        queryReplacement: '={{ [ $(\'Get USD/COP\').item.json.rates.COP ] }}'
      }
    },
    position: [900, 200]
  },
  output: [{}]
});

export default workflow('h4cL4I495CDIOskP', 'Axon - Alerta Dolar')
  .add(start)
  .to(getDolar)
  .to(checkPrice
    .onTrue(saveToInbox.to(saveToDb))
  );
