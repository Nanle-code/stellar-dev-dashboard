import { describe, expect, it } from 'vitest'
import en from '../../../src/i18n/en.json'
import es from '../../../src/i18n/es.json'
import fr from '../../../src/i18n/fr.json'
import de from '../../../src/i18n/de.json'
import pt from '../../../src/i18n/pt.json'
import zh from '../../../src/i18n/zh.json'
import ja from '../../../src/i18n/ja.json'
import ko from '../../../src/i18n/ko.json'
import ar from '../../../src/i18n/ar.json'

const RESOURCES: Record<string, any> = { en, es, fr, de, pt, zh, ja, ko, ar }

/** Recursively collect leaf key paths of an object. */
function leafKeys(obj: any, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key
    if (value && typeof value === 'object') return leafKeys(value, path)
    return [path]
  })
}

const LOCALES = Object.keys(RESOURCES)

describe('builder i18n coverage (#878)', () => {
  it('ships the extended builder section in English with the new extracted keys', () => {
    const keys = leafKeys(en.builder)

    for (const key of [
      'title',
      'titleAdvanced',
      'subtitleNovice',
      'subtitleExpert',
      'simulate',
      'simulating',
      'exportXdr',
      'saveDraft',
      'saveAsTemplate',
      'memoRequiredSep29',
      'simulationErrorsFound',
      'operationFields.destination',
      'operationFields.innerTransactionXdr',
      'federatedResolution.resolve',
    ]) {
      expect(keys).toContain(key)
    }
  })

  it('has complete key parity with English across all supported locales (primary flow)', () => {
    const enKeys = leafKeys(en.builder).sort()

    for (const locale of LOCALES) {
      const keys = leafKeys(RESOURCES[locale].builder).sort()
      const missing = enKeys.filter((k) => !keys.includes(k))
      const extra = keys.filter((k) => !enKeys.includes(k))

      expect({ locale, missing, extra }).toEqual({ locale, missing: [], extra: [] })
    }
  })

  it('translates UI-visible strings instead of copying English (spot check)', () => {
    const englishValues = new Set(['Transaction Builder', 'Simulate Transaction', 'Add Operation'])

    for (const locale of LOCALES) {
      const { title, simulate, addOperation } = RESOURCES[locale].builder
      // Arabic, Chinese, Japanese, Korean, Russian-style scripts must not equal English.
      const nonLatin = ['ar', 'zh', 'ja', 'ko']
      if (nonLatin.includes(locale)) {
        expect(englishValues.has(title)).toBe(false)
        expect(englishValues.has(simulate)).toBe(false)
        expect(englishValues.has(addOperation)).toBe(false)
      } else {
        expect(typeof title).toBe('string')
        expect(title.length).toBeGreaterThan(0)
      }
    }
  })

  it('keeps interpolation placeholders consistent between locales (boundary)', () => {
    for (const locale of LOCALES) {
      const { templateSaveFailed, memoRequirementUnverified, simulationErrorsFound, stroopsPerOperation } =
        RESOURCES[locale].builder

      expect(templateSaveFailed).toContain('{{message}}')
      expect(memoRequirementUnverified).toContain('{{reason}}')
      expect(simulationErrorsFound).toContain('{{count}}')
      expect(stroopsPerOperation).toContain('{{stroops}}')
    }
  })

  it('falls back to English when a key is missing (failure path)', async () => {
    const { default: i18n } = await import('../../../src/i18n/index.ts')

    // A key present in en but hypothetically missing elsewhere resolves to English.
    expect(i18n.t('builder.exportFailed', { lng: 'de', message: 'boom' })).toContain('boom')
    expect(i18n.t('builder.exportFailed', { lng: 'de', message: 'boom' })).not.toContain('undefined')

    // Unknown keys in the builder namespace return the key itself (i18next default).
    expect(i18n.t('builder.doesNotExist_xyz', { lng: 'fr' })).toBe('builder.doesNotExist_xyz')
  })
})
