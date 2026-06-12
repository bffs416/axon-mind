export const effectsLibrary = [
  // ==================== LENSES & SHOTS ====================
  {
    id: 'shot_ews',
    category: 'lens',
    name: 'Gran Plano General (Extreme Wide Shot)',
    tag: 'EWS',
    description: 'Muestra un gran paisaje o multitud. El sujeto apenas es visible.',
    setup: 'Cámara muy alejada del sujeto. Se recomienda un objetivo gran angular (16mm a 24mm). Ideal para establecer la escala del entorno.'
  },
  {
    id: 'shot_ws',
    category: 'lens',
    name: 'Plano General (Wide Shot / Long Shot)',
    tag: 'WS',
    description: 'Muestra al sujeto de cuerpo completo y su relación con el entorno inmediato.',
    setup: 'Ubicar la cámara a una distancia que encuadre al sujeto de pies a cabeza con algo de aire por encima y debajo.'
  },
  {
    id: 'shot_ms',
    category: 'lens',
    name: 'Plano Medio (Medium Shot)',
    tag: 'MS',
    description: 'Encuadra al sujeto desde la cintura para arriba. Muy usado en diálogos.',
    setup: 'Cámara a altura del pecho, lente de 35mm o 50mm para mantener proporciones naturales sin distorsión.'
  },
  {
    id: 'shot_cu',
    category: 'lens',
    name: 'Primer Plano (Close-Up)',
    tag: 'CU',
    description: 'Encuadra al sujeto desde los hombros o clavícula hasta arriba. Enfoque absoluto en las emociones.',
    setup: 'Acercar la cámara o usar un teleobjetivo corto (85mm). Fondo desenfocado (poca profundidad de campo).'
  },
  {
    id: 'shot_ecu',
    category: 'lens',
    name: 'Primerísimo Primer Plano (Extreme Close-Up)',
    tag: 'ECU',
    description: 'Muestra un detalle específico del sujeto (los ojos, la boca, un objeto).',
    setup: 'Usar lentes macro o acercarse al máximo con un teleobjetivo. Iluminación precisa para destacar texturas.'
  },

  // ==================== ANGLES ====================
  {
    id: 'angle_eye',
    category: 'angle',
    name: 'Ángulo Normal (Eye Level)',
    tag: 'Normal',
    description: 'Cámara situada a la altura de los ojos del sujeto. Neutral y realista.',
    setup: 'Alinear la altura del trípode exactamente con la mirada del actor. Evita cualquier sensación de superioridad/inferioridad.'
  },
  {
    id: 'angle_low',
    category: 'angle',
    name: 'Plano Contrapicado (Low Angle)',
    tag: 'Contrapicado',
    description: 'Cámara apunta hacia arriba. Hace que el sujeto luzca poderoso, amenazante o heroico.',
    setup: 'Colocar la cámara por debajo de los ojos del sujeto inclinada hacia arriba. Lentes angulares exageran la altura del sujeto.'
  },
  {
    id: 'angle_high',
    category: 'angle',
    name: 'Plano Picado (High Angle)',
    tag: 'Picado',
    description: 'Cámara apunta hacia abajo. Hace al sujeto verse vulnerable, pequeño o desamparado.',
    setup: 'Colocar la cámara por encima de la cabeza del sujeto, apuntando hacia abajo en un ángulo aproximado de 30-45 grados.'
  },
  {
    id: 'angle_dutch',
    category: 'angle',
    name: 'Plano Aberrante / Alemán (Dutch Angle)',
    tag: 'Dutch Angle',
    description: 'Cámara inclinada lateralmente. Genera tensión, inestabilidad psicológica o dinamismo.',
    setup: 'Rotar la cámara sobre el eje z (eje óptico) unos 10 a 25 grados. Rompe la línea del horizonte horizontal.'
  },
  {
    id: 'angle_zenith',
    category: 'angle',
    name: 'Plano Cenital (Bird\'s Eye / Top Down)',
    tag: 'Cenital',
    description: 'Toma completamente vertical (90 grados) mirando hacia abajo.',
    setup: 'Cámara colocada directamente sobre el sujeto. Se logra con grúas, brazos boom o drones. Excelente para mapear geometría escénica.'
  },

  // ==================== MOVEMENTS ====================
  {
    id: 'move_pan',
    category: 'movement',
    name: 'Paneo (Pan)',
    tag: 'Pan',
    description: 'Movimiento horizontal de la cámara sobre su propio eje (de izquierda a derecha o viceversa).',
    setup: 'Fijar el trípode y rotar la rótula de forma fluida. Se usa para seguir al sujeto o explorar el espacio.'
  },
  {
    id: 'move_tilt',
    category: 'movement',
    name: 'Inclinación (Tilt)',
    tag: 'Tilt',
    description: 'Movimiento vertical de la cámara sobre su propio eje (arriba a abajo o viceversa).',
    setup: 'Inclinar la cámara verticalmente en el trípode. Útil para revelar la altura de un edificio o la escala de un sujeto.'
  },
  {
    id: 'move_dolly',
    category: 'movement',
    name: 'Dolly / Traveling (Track)',
    tag: 'Dolly',
    description: 'Desplazamiento físico de la cámara en el espacio (adelante, atrás o lateralmente).',
    setup: 'Montar la cámara en un riel (Dolly), slider o gimbal. Mantiene la perspectiva dinámica del fondo, a diferencia del Zoom.'
  },
  {
    id: 'move_steadicam',
    category: 'movement',
    name: 'Cámara Estabilizada (Steadicam / Gimbal)',
    tag: 'Steadicam',
    description: 'Movimiento fluido y flotante a través de pasillos o persiguiendo al actor sin vibraciones.',
    setup: 'Usar estabilizador mecánico o electrónico (Gimbal). El operador camina siguiendo al actor, planificando la ruta.'
  },

  // ==================== EFFECTS (EYECANDY / GENERY) ====================
  {
    id: 'effect_bullet_time',
    category: 'effect',
    name: 'Bullet Time (Efecto Matrix)',
    tag: 'Bullet Time',
    description: 'El tiempo se congela o va en cámara súper lenta mientras la cámara gira en 360 grados alrededor de la acción.',
    setup: 'Se realiza rodeando la escena con una hilera circular de múltiples cámaras fotográficas fijas que disparan de forma simultánea o secuencial a intervalos atómicos. En postproducción se interpolan los fotogramas.',
    referenceUrl: 'https://genery.io/effects/bullet-time'
  },
  {
    id: 'effect_dolly_zoom',
    category: 'effect',
    name: 'Efecto Vértigo (Dolly Zoom / Vertigo Effect)',
    tag: 'Dolly Zoom',
    description: 'El sujeto mantiene su tamaño en pantalla mientras el fondo se deforma (se aleja o se acerca) creando inestabilidad emocional.',
    setup: 'Desplazar físicamente la cámara hacia adelante en un dolly mientras simultáneamente se hace un zoom-out con la lente (o viceversa). Requiere coordinación matemática entre velocidad de desplazamiento y velocidad del anillo de zoom.'
  },
  {
    id: 'effect_crash_zoom',
    category: 'effect',
    name: 'Zoom Violento (Crash Zoom)',
    tag: 'Crash Zoom',
    description: 'Acercamiento rápido, abrupto y repentino al rostro de un sujeto para dramatizar una sorpresa o comedia.',
    setup: 'Operación manual rápida del zoom del objetivo a máxima velocidad. Popularizado en el cine de Quentin Tarantino e historias de artes marciales.'
  },
  {
    id: 'effect_snorricam',
    category: 'effect',
    name: 'Cámara Corporal (Snorricam)',
    tag: 'Snorricam',
    description: 'La cámara está anclada directamente al cuerpo del actor. El actor parece estático en pantalla mientras el fondo se mueve caóticamente.',
    setup: 'Colocar un arnés rígido en el torso del actor que sostenga la cámara apuntando hacia su rostro. Ideal para simular estados de shock, intoxicación o pánico.',
    referenceUrl: 'https://eyecandy.work/snorricam'
  },
  {
    id: 'effect_whip_pan',
    category: 'effect',
    name: 'Barrido (Whip Pan / Swish Pan)',
    tag: 'Whip Pan',
    description: 'Paneo tan rápido que la imagen se convierte en un desenfoque borroso, usado como corte o transición dinámica.',
    setup: 'Rotar la cámara violentamente hacia el lateral al final de una toma, y comenzar la siguiente con otro movimiento rápido en la misma dirección.'
  },
  {
    id: 'effect_split_diopter',
    category: 'effect',
    name: 'Dioptría Dividida (Split Diopter)',
    tag: 'Split Diopter',
    description: 'Mantiene enfocados simultáneamente un objeto muy cercano en primer plano y a un sujeto en segundo plano distante.',
    setup: 'Colocar un medio filtro de aumento en la mitad del objetivo de la cámara. La mitad con filtro enfoca lo cercano, la mitad vacía enfoca lo lejano.'
  }
];
