
export const GUITAR_MASTER_CATALOG = [
  // NIVEL 1: ADN (Intervalos y Notas base)
  { id: 'int-1', name: 'La Tónica (1)', desc: 'La nota raíz de cualquier acorde o escala.', level: 1, type: 'interval', positions: [{ string: 6, fret: 5, label: 'A' }] },
  { id: 'int-2', name: 'Tercera Mayor (3)', desc: 'Define el sonido alegre. 2 tonos arriba de la tónica.', level: 1, type: 'interval', positions: [{ string: 5, fret: 4, label: 'C#' }] },
  { id: 'int-3', name: 'Quinta Justa (5)', desc: 'La estabilidad. 3 tonos y medio arriba.', level: 1, type: 'interval', positions: [{ string: 5, fret: 7, label: 'E' }] },
  { id: 'adn-triad-major', name: 'Triada Mayor ADN', desc: 'Combina 1, 3 y 5.', level: 1, type: 'triad', positions: [{ string: 6, fret: 5 }, { string: 5, fret: 4 }, { string: 5, fret: 7 }] },

  // NIVEL 2: TRIADAS (El superpoder del mástil)
  { id: 'tri-major-pos1', name: 'Triada Mayor (Posición 1)', desc: 'Cuerdas 1, 2 y 3. Forma de Re.', level: 2, type: 'triad', positions: [{ string: 1, fret: 5 }, { string: 2, fret: 5 }, { string: 3, fret: 6 }] },
  { id: 'tri-minor-pos1', name: 'Triada Menor (Posición 1)', desc: 'Baja la tercera medio traste.', level: 2, type: 'triad', positions: [{ string: 1, fret: 5 }, { string: 2, fret: 5 }, { string: 3, fret: 5 }] },

  // NIVEL 3: CAGED (Conectando el mástil)
  { id: 'caged-c', name: 'Forma de C (Do)', desc: 'Mueve la forma de Do abierto por el mástil.', level: 3, type: 'scale', positions: [{ string: 5, fret: 3 }, { string: 4, fret: 2 }, { string: 2, fret: 1 }] },
  { id: 'caged-a', name: 'Forma de A (La)', desc: 'Cejilla en el traste X con forma de La.', level: 3, type: 'scale', positions: [{ string: 5, fret: 5 }, { string: 4, fret: 7 }, { string: 3, fret: 7 }, { string: 2, fret: 7 }] }
];
