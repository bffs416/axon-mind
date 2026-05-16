
export const GUITAR_MASTER_CATALOG = [
  // NIVEL 1: ADN (Intervalos y Notas base)
  { id: 'int-1', name: 'Tónica de LA (Cuerda 6)', desc: 'Busca el LA en el traste 5 de la cuerda más gruesa. Esta será nuestra base.', level: 1, type: 'interval', positions: [{ string: 6, fret: 5, label: 'A' }] },
  { id: 'int-2', name: 'Tercera Mayor de LA', desc: 'Desde tu LA (6ª cuerda), la 3ª Mayor está en la 5ª cuerda, traste 4. ¡Suena alegre!', level: 1, type: 'interval', positions: [{ string: 6, fret: 5, label: 'A' }, { string: 5, fret: 4, label: 'C#' }] },
  { id: 'int-3', name: 'Quinta Justa de LA', desc: 'La nota que da fuerza. Traste 7 en la 5ª cuerda. Es la base de los Power Chords.', level: 1, type: 'interval', positions: [{ string: 6, fret: 5, label: 'A' }, { string: 5, fret: 7, label: 'E' }] },
  { id: 'adn-triad-major', name: 'Tríada Mayor de LA (ADN)', desc: 'Combina la 1ª, 3ª y 5ª. Este es el sándwich completo.', level: 1, type: 'triad', positions: [{ string: 6, fret: 5, label: 'A' }, { string: 5, fret: 4, label: 'C#' }, { string: 5, fret: 7, label: 'E' }] },

  // NIVEL 2: TRIADAS (El superpoder del mástil)
  { id: 'tri-major-pos1', name: 'Tríada RE Mayor (Pos. 1)', desc: 'Cuerdas 1, 2 y 3. Trastes 2, 3, 2. La forma más brillante.', level: 2, type: 'triad', positions: [{ string: 1, fret: 2, label: 'E' }, { string: 2, fret: 3, label: 'D' }, { string: 3, fret: 2, label: 'A' }] },
  { id: 'tri-minor-pos1', name: 'Tríada RE Menor (Pos. 1)', desc: 'Igual que la anterior, pero baja el traste 2 al 1 en la 1ª cuerda. ¡Suena triste!', level: 2, type: 'triad', positions: [{ string: 1, fret: 1, label: 'F' }, { string: 2, fret: 3, label: 'D' }, { string: 3, fret: 2, label: 'A' }] },

  // NIVEL 3: CAGED (Conectando el mástil)
  { id: 'caged-c', name: 'Forma de DO (C)', desc: 'Usa la forma del acorde de Do abierto pero muévelo por el mástil.', level: 3, type: 'scale', positions: [{ string: 5, fret: 3, label: 'C' }, { string: 4, fret: 2, label: 'E' }, { string: 2, fret: 1, label: 'C' }] }
];
