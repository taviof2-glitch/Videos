import { describe, expect, it } from 'vitest'
import { categoryOf, socialText } from './galleryCats'

describe('galería', () => {
  it('reconoce el tipo de mueble por el título', () => {
    expect(categoryOf('Closet de recámara')).toBe('closet')
    expect(categoryOf('Clóset infantil')).toBe('closet')
    expect(categoryOf('Cocina integral')).toBe('cocina')
    expect(categoryOf('Mueble de TV negro')).toBe('tv')
    expect(categoryOf('Repisa')).toBe('otro')
    expect(socialText({ title: 'Closet', category: 'closet', business: 'House Lite', phone: '378 123 4567' })).toContain('#closet')
  })
})
