import { describe, expect, it } from 'vitest'
import { joinResults } from './dictation'

describe('dictado', () => {
  it('junta frases finales y lo que se está diciendo', () => {
    expect(joinResults([{ text: 'vendí un closet', final: true }, { text: ' a Juan', final: false }])).toBe('vendí un closet a Juan')
  })
  it('no repite cuando el navegador manda todo lo dicho otra vez', () => {
    expect(joinResults([{ text: 'vendí un closet', final: true }, { text: 'vendí un closet a Juan', final: true }])).toBe('vendí un closet a Juan')
    expect(joinResults([{ text: 'hola', final: true }, { text: 'hola', final: true }])).toBe('hola')
    expect(joinResults([{ text: 'vendí', final: true }, { text: 'vendí un closet', final: false }])).toBe('vendí un closet')
  })
})
