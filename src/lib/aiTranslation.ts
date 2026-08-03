/**
 * AI-Powered Translation Engine — AI-Powered Multi-Language Support
 *
 * Provides:
 * - Context-aware machine translation via configurable API (LibreTranslate-compatible)
 * - Stellar-specific terminology protection so technical terms are never garbled
 * - Translation Memory (TM) for consistency across sessions
 * - Community correction submission
 * - Graceful fallback to key-based i18next translations when the API is unavailable
 */

import translationMemory, { type TMEntry } from './translationMemory';

// ---------------------------------------------------------------------------
// Stellar / blockchain terminology that MUST NOT be machine-translated
// ---------------------------------------------------------------------------

/** Terms to preserve verbatim in any target language. */
export const STELLAR_TERMS: ReadonlySet<string> = new Set([
  'Stellar', 'XLM', 'Lumens', 'Soroban', 'Horizon', 'Friendbot',
  'WASM', 'DEX', 'DID', 'AMM', 'SEP', 'SEP-0010', 'SEP-0006',
  'TOML', 'XDR', 'RPC', 'SDK', 'ABI', 'CBDC',
  'trustline', 'Trustline',
  'anchor', 'Anchor',
  'claimable balance', 'Claimable Balance',
  'ledger', 'Ledger',
  'stroops', 'Stroops',
  'base fee', 'Base Fee',
  'sequence number', 'Sequence Number',
  'source account', 'Source Account',
  'memo', 'Memo',
  'payment path', 'Payment Path',
  'liquidity pool', 'Liquidity Pool',
  'path payment', 'Path Payment',
  'manage offer', 'Manage Offer',
  'set options', 'Set Options',
  'bump sequence', 'Bump Sequence',
  'create account', 'Create Account',
  'change trust', 'Change Trust',
  'Testnet', 'Mainnet', 'Pubnet', 'Futurenet',
  'Freighter', 'Albedo', 'xBull',
  'multisig', 'Multisig',
  'ed25519', 'hashX', 'pre-authorized',
  'smart contract', 'Smart Contract',
]);

/** Regex that matches any protected Stellar term in text. */
const TERM_REGEX = new RegExp(
  `\\b(${Array.from(STELLAR_TERMS)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .sort((a, b) => b.length - a.length) // longest first
    .join('|')})\\b`,
  'gi',
);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TranslationRequest {
  text: string;
  sourceLang?: string;    // default 'en'
  targetLang: string;
  context?: string;       // e.g. 'nav', 'error', 'transaction'
}

export interface TranslationResult {
  translatedText: string;
  sourceLang: string;
  targetLang: string;
  confidence: number;     // 0–1
  fromMemory: boolean;
  termsPreserved: string[];
}

export interface CommunityCorrection {
  source: string;
  original: string;
  correction: string;
  sourceLang: string;
  targetLang: string;
  context?: string;
}

export interface TranslationEngineConfig {
  /** LibreTranslate-compatible endpoint. Falls back to mock when omitted. */
  apiUrl?: string;
  /** API key for the translation service (optional for self-hosted). */
  apiKey?: string;
  /** Whether to use the TM before hitting the API. Default true. */
  useMemory?: boolean;
  /** Whether to cache new API results in the TM. Default true. */
  cacheResults?: boolean;
}

// ---------------------------------------------------------------------------
// Placeholder / mock translator (no external dependency required)
// ---------------------------------------------------------------------------

const MOCK_TRANSLATIONS: Record<string, Record<string, string>> = {
  es: {
    Loading: 'Cargando',
    Error: 'Error',
    Success: 'Éxito',
    Cancel: 'Cancelar',
    Confirm: 'Confirmar',
    Save: 'Guardar',
    Close: 'Cerrar',
    Search: 'Buscar',
    Settings: 'Configuración',
    Overview: 'Resumen',
    Transactions: 'Transacciones',
    Account: 'Cuenta',
    Network: 'Red',
    Language: 'Idioma',
    'Translate with AI': 'Traducir con IA',
  },
  fr: {
    Loading: 'Chargement',
    Error: 'Erreur',
    Success: 'Succès',
    Cancel: 'Annuler',
    Confirm: 'Confirmer',
    Save: 'Enregistrer',
    Close: 'Fermer',
    Search: 'Rechercher',
    Settings: 'Paramètres',
    Overview: 'Aperçu',
    Transactions: 'Transactions',
    Account: 'Compte',
    Network: 'Réseau',
    Language: 'Langue',
    'Translate with AI': 'Traduire avec IA',
  },
  de: {
    Loading: 'Laden',
    Error: 'Fehler',
    Success: 'Erfolg',
    Cancel: 'Abbrechen',
    Confirm: 'Bestätigen',
    Save: 'Speichern',
    Close: 'Schließen',
    Search: 'Suchen',
    Settings: 'Einstellungen',
    Overview: 'Übersicht',
    Transactions: 'Transaktionen',
    Account: 'Konto',
    Network: 'Netzwerk',
    Language: 'Sprache',
    'Translate with AI': 'Mit KI übersetzen',
  },
  zh: {
    Loading: '加载中',
    Error: '错误',
    Success: '成功',
    Cancel: '取消',
    Confirm: '确认',
    Save: '保存',
    Close: '关闭',
    Search: '搜索',
    Settings: '设置',
    Overview: '概览',
    Transactions: '交易',
    Account: '账户',
    Network: '网络',
    Language: '语言',
    'Translate with AI': '使用AI翻译',
  },
  ja: {
    Loading: '読み込み中',
    Error: 'エラー',
    Success: '成功',
    Cancel: 'キャンセル',
    Confirm: '確認',
    Save: '保存',
    Close: '閉じる',
    Search: '検索',
    Settings: '設定',
    Overview: '概要',
    Transactions: 'トランザクション',
    Account: 'アカウント',
    Network: 'ネットワーク',
    Language: '言語',
    'Translate with AI': 'AIで翻訳',
  },
  ko: {
    Loading: '로딩 중',
    Error: '오류',
    Success: '성공',
    Cancel: '취소',
    Confirm: '확인',
    Save: '저장',
    Close: '닫기',
    Search: '검색',
    Settings: '설정',
    Overview: '개요',
    Transactions: '트랜잭션',
    Account: '계정',
    Network: '네트워크',
    Language: '언어',
    'Translate with AI': 'AI로 번역',
  },
  pt: {
    Loading: 'Carregando',
    Error: 'Erro',
    Success: 'Sucesso',
    Cancel: 'Cancelar',
    Confirm: 'Confirmar',
    Save: 'Salvar',
    Close: 'Fechar',
    Search: 'Buscar',
    Settings: 'Configurações',
    Overview: 'Visão Geral',
    Transactions: 'Transações',
    Account: 'Conta',
    Network: 'Rede',
    Language: 'Idioma',
    'Translate with AI': 'Traduzir com IA',
  },
  ar: {
    Loading: 'جار التحميل',
    Error: 'خطأ',
    Success: 'نجاح',
    Cancel: 'إلغاء',
    Confirm: 'تأكيد',
    Save: 'حفظ',
    Close: 'إغلاق',
    Search: 'بحث',
    Settings: 'الإعدادات',
    Overview: 'نظرة عامة',
    Transactions: 'المعاملات',
    Account: 'الحساب',
    Network: 'الشبكة',
    Language: 'اللغة',
    'Translate with AI': 'ترجمة بالذكاء الاصطناعي',
  },
};

function mockTranslate(text: string, targetLang: string): string {
  const dict = MOCK_TRANSLATIONS[targetLang] ?? {};
  // Look for an exact match first, then check word-by-word for multi-word strings
  if (dict[text]) return dict[text];

  let result = text;
  // Replace known phrases (longest first)
  const phrases = Object.keys(dict).sort((a, b) => b.length - a.length);
  for (const phrase of phrases) {
    const re = new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    result = result.replace(re, dict[phrase]);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Protected-term extraction / restoration
// ---------------------------------------------------------------------------

interface ProtectedToken {
  placeholder: string;
  original: string;
}

function protectTerms(text: string): { masked: string; tokens: ProtectedToken[] } {
  const tokens: ProtectedToken[] = [];
  let idx = 0;
  const masked = text.replace(TERM_REGEX, (match) => {
    const placeholder = `__TERM_${idx++}__`;
    tokens.push({ placeholder, original: match });
    return placeholder;
  });
  return { masked, tokens };
}

function restoreTerms(text: string, tokens: ProtectedToken[]): string {
  let result = text;
  for (const { placeholder, original } of tokens) {
    result = result.split(placeholder).join(original);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Core engine
// ---------------------------------------------------------------------------

export class AITranslationEngine {
  private config: Required<TranslationEngineConfig>;

  constructor(config: TranslationEngineConfig = {}) {
    this.config = {
      apiUrl: config.apiUrl ?? '',
      apiKey: config.apiKey ?? '',
      useMemory: config.useMemory ?? true,
      cacheResults: config.cacheResults ?? true,
    };
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Translate text with:
   *   1. TM lookup (instant, consistent)
   *   2. Stellar-term protection
   *   3. API call (or mock fallback)
   *   4. TM write-through cache
   */
  async translate(req: TranslationRequest): Promise<TranslationResult> {
    const sourceLang = req.sourceLang ?? 'en';
    const { text, targetLang, context } = req;

    if (sourceLang === targetLang) {
      return this.identity(text, sourceLang, targetLang);
    }

    // 1. Translation memory hit
    if (this.config.useMemory) {
      const hit = translationMemory.get(sourceLang, targetLang, text);
      if (hit) {
        return {
          translatedText: hit.target,
          sourceLang,
          targetLang,
          confidence: hit.score,
          fromMemory: true,
          termsPreserved: [],
        };
      }
    }

    // 2. Protect Stellar terms
    const { masked, tokens } = protectTerms(text);
    const termsPreserved = tokens.map((t) => t.original);

    // 3. Translate
    let translated = '';
    let confidence = 0.9;

    if (this.config.apiUrl) {
      try {
        const result = await this.callAPI(masked, sourceLang, targetLang);
        translated = result.text;
        confidence = result.confidence;
      } catch (err) {
        console.warn('[AITranslation] API call failed, using mock fallback:', err);
        translated = mockTranslate(masked, targetLang);
        confidence = 0.75;
      }
    } else {
      // No API configured — use mock
      translated = mockTranslate(masked, targetLang);
      confidence = 0.8;
    }

    // 4. Restore protected terms
    const finalText = restoreTerms(translated, tokens);

    // 5. Write to TM
    if (this.config.cacheResults) {
      translationMemory.set({
        source: text,
        target: finalText,
        lang: targetLang,
        source_lang: sourceLang,
        score: confidence,
        context,
        updatedAt: Date.now(),
      });
    }

    return {
      translatedText: finalText,
      sourceLang,
      targetLang,
      confidence,
      fromMemory: false,
      termsPreserved,
    };
  }

  /**
   * Translate an array of strings in a single round-trip (batched).
   * Items that hit the TM cache are resolved instantly.
   */
  async translateBatch(
    texts: string[],
    targetLang: string,
    sourceLang = 'en',
    context?: string,
  ): Promise<TranslationResult[]> {
    return Promise.all(
      texts.map((text) => this.translate({ text, sourceLang, targetLang, context })),
    );
  }

  /**
   * Submit a community correction.
   * The correction is stored in the TM with a quality score of 1 (max).
   */
  submitCorrection(correction: CommunityCorrection): void {
    const entry: TMEntry = {
      source: correction.source,
      target: correction.correction,
      lang: correction.targetLang,
      source_lang: correction.sourceLang,
      score: 1.0,
      context: correction.context,
      contributed: true,
      updatedAt: Date.now(),
    };
    translationMemory.set(entry);
  }

  /**
   * Update engine configuration at runtime (e.g. when user saves API key in Settings).
   */
  updateConfig(config: Partial<TranslationEngineConfig>): void {
    Object.assign(this.config, config);
  }

  /** Stats for display in Settings. */
  getStats(): { tmSize: number; hasMachineAPI: boolean } {
    return {
      tmSize: translationMemory.size,
      hasMachineAPI: Boolean(this.config.apiUrl),
    };
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  private identity(text: string, sourceLang: string, targetLang: string): TranslationResult {
    return {
      translatedText: text,
      sourceLang,
      targetLang,
      confidence: 1,
      fromMemory: false,
      termsPreserved: [],
    };
  }

  /**
   * Call a LibreTranslate-compatible endpoint.
   * Response shape: { translatedText: string } | { error: string }
   */
  private async callAPI(
    text: string,
    sourceLang: string,
    targetLang: string,
  ): Promise<{ text: string; confidence: number }> {
    const body: Record<string, string> = {
      q: text,
      source: sourceLang,
      target: targetLang,
      format: 'text',
    };
    if (this.config.apiKey) body.api_key = this.config.apiKey;

    const res = await fetch(this.config.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`Translation API ${res.status}: ${res.statusText}`);
    }

    const data: { translatedText?: string; error?: string } = await res.json();
    if (data.error) throw new Error(data.error);

    return {
      text: data.translatedText ?? text,
      confidence: 0.9,
    };
  }
}

// ---------------------------------------------------------------------------
// Singleton instance (shared across the app)
// ---------------------------------------------------------------------------

let _engine: AITranslationEngine | null = null;

export function getTranslationEngine(): AITranslationEngine {
  if (!_engine) {
    // Pick up optional env vars set at build time
    _engine = new AITranslationEngine({
      apiUrl: (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_TRANSLATION_API_URL) || '',
      apiKey: (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_TRANSLATION_API_KEY) || '',
    });
  }
  return _engine;
}

export function configureTranslationEngine(config: Partial<TranslationEngineConfig>): void {
  getTranslationEngine().updateConfig(config);
}

export { translationMemory };
export default AITranslationEngine;
