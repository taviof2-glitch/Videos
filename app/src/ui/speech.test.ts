import { describe, expect, it } from 'vitest'
import { speakable } from './speech'

describe('voz del asistente', () => {
  it('limpia el texto para leerlo', () => {
    expect(speakable('**Listo**: vendiste $4,500 hoy.\n[Venta propuesta: x] Ver https://x.com/a')).toBe('Listo: vendiste 4,500 pesos hoy. Ver el enlace')
  })
})
