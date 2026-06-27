// Tests für die Lieferantenartikel→Zutat Matching-Engine (lib/supplier-matching/matchEngine.ts)
// Run: node --import ./tests/register.mjs --test tests/supplierMatch.test.ts
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { classifyArticle, scoreNames, articleName, cleanIngredientName, type MatchableIngredient } from '@/lib/supplier-matching/matchEngine'

const INGREDIENTS: MatchableIngredient[] = [
  { id: 'parmesan', name: 'Parmesan' },
  { id: 'burrata', name: 'Burrata' },
  { id: 'haehnchen', name: 'Hähnchen' },
  { id: 'haehnchenbrust', name: 'Hähnchenbrust' },
  { id: 'tomate', name: 'Tomate' },
  { id: 'mozzarella', name: 'Mozzarella' },
]

describe('scoreNames', () => {
  test('exakte Namen ergeben 1', () => {
    assert.equal(scoreNames('Parmesan', 'Parmesan'), 1)
  })
  test('Zutat als Wort im Artikelnamen ergibt hohen Score', () => {
    assert.ok(scoreNames('Burrata', 'Burrata Pugliese 125g Frischetheke') >= 0.9)
  })
  test('völlig fremder Artikel ergibt 0', () => {
    assert.equal(scoreNames('Parmesan', 'Spülmittel Pril Zitrone'), 0)
  })
})

describe('articleName', () => {
  test('bevorzugt clean_article_name_de', () => {
    assert.equal(articleName({ clean_article_name_de: 'Parmesan gerieben', raw_article_name: 'PARM GER 1KG' }), 'Parmesan gerieben')
  })
  test('fällt auf raw_article_name zurück', () => {
    assert.equal(articleName({ clean_article_name_de: null, ingredient_name_de: null, raw_article_name: 'PARM GER' }), 'PARM GER')
  })
})

describe('cleanIngredientName', () => {
  test('entfernt führende Menge und Ländercode', () => {
    assert.equal(cleanIngredientName('125 g BROMBEEREN ES'), 'Brombeeren')
    assert.equal(cleanIngredientName('4 kg LIMETTEN BR'), 'Limetten')
    assert.equal(cleanIngredientName('ROTKOHL DE'), 'Rotkohl')
  })
  test('behält brauchbaren Rest und Title-Case', () => {
    assert.equal(cleanIngredientName('400 g ALPRO SOJAJOGHURT NATUR'), 'Alpro Sojajoghurt Natur')
  })
  test('leerer/zahliger Rest fällt auf Rohnamen zurück', () => {
    assert.equal(cleanIngredientName(''), '')
  })
})

describe('classifyArticle', () => {
  test('exakter Treffer → verknüpfen (exakt)', () => {
    const r = classifyArticle('Parmesan', INGREDIENTS)
    assert.equal(r.decision, 'link')
    assert.equal(r.matchType, 'exakt')
    assert.equal(r.ingredientId, 'parmesan')
    assert.equal(r.score, 100)
  })

  test('klarer Einzeltreffer im langen Artikelnamen → verknüpfen (starker_name)', () => {
    const r = classifyArticle('Burrata Pugliese 125g Frischetheke', INGREDIENTS)
    assert.equal(r.decision, 'link')
    assert.equal(r.matchType, 'starker_name')
    assert.equal(r.ingredientId, 'burrata')
  })

  test('längerer Artikelname trifft die spezifischere Zutat (Hähnchenbrust, nicht Hähnchen)', () => {
    const r = classifyArticle('Hähnchenbrust küchenfertig', INGREDIENTS)
    assert.equal(r.decision, 'link')
    assert.equal(r.ingredientId, 'haehnchenbrust')
  })

  test('zwei gleich starke Zutaten → Review (mehrdeutig)', () => {
    const r = classifyArticle('Tomate Mozzarella Caprese 200g', INGREDIENTS)
    assert.equal(r.decision, 'review')
    assert.equal(r.matchType, 'mehrdeutig')
    assert.ok(r.contenders.length >= 2)
    assert.ok(r.contenders.some((c) => c.id === 'tomate'))
    assert.ok(r.contenders.some((c) => c.id === 'mozzarella'))
  })

  test('kein Treffer → neue Zutat anlegen', () => {
    const r = classifyArticle('Spülmittel Pril Zitrone 1L', INGREDIENTS)
    assert.equal(r.decision, 'create')
    assert.equal(r.ingredientId, null)
  })

  test('leerer Artikelname → anlegen-Entscheidung ohne Crash', () => {
    const r = classifyArticle('   ', INGREDIENTS)
    assert.equal(r.decision, 'create')
  })

  test('leerer Katalog → immer anlegen', () => {
    const r = classifyArticle('Parmesan', [])
    assert.equal(r.decision, 'create')
    assert.equal(r.ingredientId, null)
  })
})
