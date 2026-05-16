
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://blwaxxacneipoaufpiag.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJsd2F4eGFjbmVpcG9hdWZwaWFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5Mzg0ODgsImV4cCI6MjA3MzUxNDQ4OH0.MYorhHHAEOnFj5DPYZHozi5pyDZbtJQDBOeD2Te3WXU'
);

const phrases = [
  { es: '¡Hola! ¿Cómo estás hoy?', en: 'Hi! How are you today?', cat: 'Saludos' },
  { es: 'Mucho gusto en conocerte.', en: 'Nice to meet you.', cat: 'Saludos' },
  { es: '¿Cómo se dice esto en inglés?', en: 'How do you say this in English?', cat: 'Supervivencia' },
  { es: '¿Puedes hablar más despacio, por favor?', en: 'Can you speak more slowly, please?', cat: 'Supervivencia' },
  { es: 'No entiendo, ¿puedes explicarlo?', en: 'I don\'t understand, can you explain it?', cat: 'Supervivencia' },
  { es: '¿Dónde está el baño?', en: 'Where is the bathroom?', cat: 'Necesidades' },
  { es: '¿Cuánto cuesta esto?', en: 'How much is this?', cat: 'Compras' },
  { es: 'Necesito un café antes de empezar.', en: 'I need a coffee before starting.', cat: 'Productividad' },
  { es: 'Hoy tuve un día muy productivo.', en: 'Today I had a very productive day.', cat: 'Productividad' },
  { es: 'La práctica hace al maestro.', en: 'Practice makes perfect.', cat: 'Aprendizaje' },
  { es: '¡Nos vemos luego!', en: 'See you later!', cat: 'Social' },
  { es: '¡Buen provecho!', en: 'Enjoy your meal!', cat: 'Comida' },
  { es: '¿Qué me recomiendas?', en: 'What do you recommend?', cat: 'Social' },
  { es: 'Mañana será un mejor día.', en: 'Tomorrow will be a better day.', cat: 'Mindset' },
  { es: 'Hecho es mejor que perfecto.', en: 'Done is better than perfect.', cat: 'Mindset' }
];

const translations = {
  fr: {
    '¡Hola! ¿Cómo estás hoy?': 'Salut! Comment ça va aujourd\'hui?',
    'Mucho gusto en conocerte.': 'Enchanté de vous rencontrer.',
    '¿Cómo se dice esto en inglés?': 'Comment dit-on ceci en anglais?',
    '¿Puedes hablar más despacio, por favor?': 'Peux-tu parler plus lentement, s\'il te plaît?',
    'No entiendo, ¿puedes explicarlo?': 'Je ne comprends pas, peux-tu expliquer?',
    '¿Dónde está el baño?': 'Où sont les toilettes?',
    '¿Cuánto cuesta esto?': 'Combien ça coûte?',
    'Necesito un café antes de empezar.': 'J\'ai besoin d\'un café antes de commencer.',
    'Hoy tuve un día muy productivo.': 'J\'ai eu une journée très productive aujourd\'hui.',
    'La práctica hace al maestro.': 'C\'est en forgeant qu\'on devient forgeron.',
    '¡Nos vemos luego!': 'À plus tard!',
    '¡Buen provecho!': 'Bon appétit!',
    '¿Qué me recomiendas?': 'Que me recommandez-vous?',
    'Mañana será un mejor día.': 'Demain sera un meilleur jour.',
    'Hecho es mejor que perfecto.': 'Fait vaut mieux que parfait.'
  },
  de: {
    '¡Hola! ¿Cómo estás hoy?': 'Hallo! Wie geht es dir heute?',
    'Mucho gusto en conocerte.': 'Freut mich, dich kennenzulernen.',
    '¿Cómo se dice esto en inglés?': 'Wie sagt man das auf Englisch?',
    '¿Puedes hablar más despacio, por favor?': 'Kannst du bitte langsamer sprechen?',
    'No entiendo, ¿puedes explicarlo?': 'Ich verstehe nicht, kannst du es erklären?',
    '¿Dónde está el baño?': 'Wo ist die Toilette?',
    '¿Cuánto cuesta esto?': 'Was kostet das?',
    'Necesito un café antes de empezar.': 'Ich brauche einen Kaffee, bevor ich anfange.',
    'Hoy tuve un día muy productivo.': 'Ich hatte heute einen sehr produktiven Tag.',
    'La práctica hace al maestro.': 'Übung macht den Meister.',
    '¡Nos vemos luego!': 'Bis später!',
    '¡Buen provecho!': 'Guten Appetit!',
    '¿Qué me recomiendas?': 'Was empfiehlst du?',
    'Mañana será un mejor día.': 'Morgen wird ein besserer Tag sein.',
    'Hecho es mejor que perfecto.': 'Fertig ist besser als perfekt.'
  },
  pt: {
    '¡Hola! ¿Cómo estás hoy?': 'Olá! Como você está hoje?',
    'Mucho gusto en conocerte.': 'Muito prazer em conhecê-lo.',
    '¿Cómo se dice esto en inglés?': 'Como se diz isso em inglês?',
    '¿Puedes hablar más despacio, por favor?': 'Você puede falar mais devagar, por favor?',
    'No entiendo, ¿puedes explicarlo?': 'Não entendo, você pode explicar?',
    '¿Dónde está el baño?': 'Onde fica o banheiro?',
    '¿Cuánto cuesta esto?': 'Quanto custa isso?',
    'Necesito un café antes de empezar.': 'Preciso de um café antes de começar.',
    'Hoy tuve un día muy productivo.': 'Hoje tive um dia muito produtivo.',
    'La práctica hace al maestro.': 'A prática leva à perfeição.',
    '¡Nos vemos luego!': 'Até logo!',
    '¡Buen provecho!': 'Bom apetite!',
    '¿Qué me recomiendas?': 'O que você recomenda?',
    'Mañana será un mejor día.': 'Amanhã será un dia melhor.',
    'Hecho es mejor que perfecto.': 'Feito é melhor que perfeito.'
  }
};

async function seed() {
  console.log('🚀 Reiniciando carga masiva de frases (corrigiendo language_id)...');

  for (const p of phrases) {
    // Check if phrase already exists to avoid duplicates
    const { data: existingPhrase } = await supabase
      .from('polyglot_phrases')
      .select('id')
      .eq('source_es', p.es)
      .limit(1);

    let phraseId;
    if (existingPhrase && existingPhrase.length > 0) {
      phraseId = existingPhrase[0].id;
    } else {
      const { data: phraseData, error: phraseError } = await supabase
        .from('polyglot_phrases')
        .insert([{ source_es: p.es, source_en: p.en, category: p.cat }])
        .select()
        .single();
      if (phraseError) {
        console.error(`Error inserting phrase ${p.es}:`, phraseError.message);
        continue;
      }
      phraseId = phraseData.id;
    }

    const entryInserts = [];

    // Add translations for allowed languages
    for (const lang of ['fr', 'de', 'pt']) {
      const text = translations[lang][p.es];
      if (text) {
        entryInserts.push({
          phrase_id: phraseId,
          language_id: lang,
          native_text: text,
          srs_level: 0,
          next_review: new Date().toISOString()
        });
      }
    }
    
    // Note: 'en' is NOT allowed in entries, so we skip it.
    // It's already in polyglot_phrases.source_en.

    if (entryInserts.length > 0) {
      // Check for existing entries to avoid duplication
      const { data: existingEntries } = await supabase
        .from('polyglot_entries')
        .select('language_id')
        .eq('phrase_id', phraseId);
      
      const existingLangs = new Set(existingEntries?.map(e => e.language_id) || []);
      const newEntries = entryInserts.filter(e => !existingLangs.has(e.language_id));

      if (newEntries.length > 0) {
        const { error: entryError } = await supabase
          .from('polyglot_entries')
          .insert(newEntries);
        if (entryError) console.error(`Error inserting entries for ${p.es}:`, entryError.message);
      }
    }
  }

  console.log('✅ Carga masiva completada con éxito.');
}

seed();
