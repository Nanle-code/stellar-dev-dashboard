export type TextDirection = "ltr" | "rtl";

export interface LocaleProfile {
  code: string;
  languageCode: string;
  label: string;
  nativeLabel: string;
  region: string;
  currency: string;
  timeZone: string;
  textDirection: TextDirection;
  numberSystem: string;
  hourCycle: "h12" | "h23" | "h24";
  layoutDensity: "compact" | "comfortable" | "spacious";
  colorMeanings: Record<string, string>;
  symbolUsage: Record<string, string>;
  regionalContent: {
    marketLabel: string;
    supportLabel: string;
    complianceNote: string;
    defaultNetworkNotice: string;
  };
}

export interface LocaleDetectionSources {
  storedLocale?: string | null;
  navigatorLanguage?: string | null;
  htmlLang?: string | null;
}

export const LOCALE_STORAGE_KEY = "stellar-dashboard-locale";

export const LOCALE_PROFILES: LocaleProfile[] = [
  {
    code: "en-US",
    languageCode: "en",
    label: "English (United States)",
    nativeLabel: "English (US)",
    region: "US",
    currency: "USD",
    timeZone: "America/New_York",
    textDirection: "ltr",
    numberSystem: "latn",
    hourCycle: "h12",
    layoutDensity: "comfortable",
    colorMeanings: {
      green: "positive balance, confirmed status",
      red: "risk, failed status, destructive action",
      blue: "informational network state",
    },
    symbolUsage: {
      decimal: ".",
      group: ",",
      currencyPosition: "before",
    },
    regionalContent: {
      marketLabel: "US Stellar market",
      supportLabel: "US business hours",
      complianceNote: "Review local money-transmission and tax reporting obligations before production use.",
      defaultNetworkNotice: "Public network values are displayed in US dollar terms when available.",
    },
  },
  {
    code: "es-ES",
    languageCode: "es",
    label: "Spanish (Spain)",
    nativeLabel: "Español (España)",
    region: "ES",
    currency: "EUR",
    timeZone: "Europe/Madrid",
    textDirection: "ltr",
    numberSystem: "latn",
    hourCycle: "h23",
    layoutDensity: "comfortable",
    colorMeanings: {
      green: "estado correcto o saldo positivo",
      red: "riesgo, error o accion irreversible",
      blue: "informacion de red",
    },
    symbolUsage: {
      decimal: ",",
      group: ".",
      currencyPosition: "after",
    },
    regionalContent: {
      marketLabel: "Mercado Stellar en Espana",
      supportLabel: "Horario laboral de Europa Central",
      complianceNote: "Incluye avisos adecuados para MiCA, proteccion de datos y obligaciones fiscales locales.",
      defaultNetworkNotice: "Los importes fiduciarios se muestran preferentemente en euros.",
    },
  },
  {
    code: "zh-CN",
    languageCode: "zh",
    label: "Chinese (China)",
    nativeLabel: "中文（中国）",
    region: "CN",
    currency: "CNY",
    timeZone: "Asia/Shanghai",
    textDirection: "ltr",
    numberSystem: "latn",
    hourCycle: "h23",
    layoutDensity: "compact",
    colorMeanings: {
      green: "可用、成功或增长",
      red: "重点提示、风险或失败",
      blue: "网络信息",
    },
    symbolUsage: {
      decimal: ".",
      group: ",",
      currencyPosition: "before",
    },
    regionalContent: {
      marketLabel: "中国区 Stellar 数据",
      supportLabel: "中国标准时间",
      complianceNote: "在上线前确认本地数据、金融服务和资产展示要求。",
      defaultNetworkNotice: "本地化金额默认使用人民币格式。",
    },
  },
  {
    code: "fr-FR",
    languageCode: "fr",
    label: "French (France)",
    nativeLabel: "Français (France)",
    region: "FR",
    currency: "EUR",
    timeZone: "Europe/Paris",
    textDirection: "ltr",
    numberSystem: "latn",
    hourCycle: "h23",
    layoutDensity: "comfortable",
    colorMeanings: {
      green: "solde positif ou etat valide",
      red: "risque, erreur ou action destructive",
      blue: "information reseau",
    },
    symbolUsage: {
      decimal: ",",
      group: "space",
      currencyPosition: "after",
    },
    regionalContent: {
      marketLabel: "Marche Stellar francais",
      supportLabel: "Heures ouvrables en France",
      complianceNote: "Verifier les exigences RGPD, MiCA et fiscales applicables.",
      defaultNetworkNotice: "Les montants fiduciaires utilisent le format euro.",
    },
  },
  {
    code: "de-DE",
    languageCode: "de",
    label: "German (Germany)",
    nativeLabel: "Deutsch (Deutschland)",
    region: "DE",
    currency: "EUR",
    timeZone: "Europe/Berlin",
    textDirection: "ltr",
    numberSystem: "latn",
    hourCycle: "h23",
    layoutDensity: "comfortable",
    colorMeanings: {
      green: "erfolgreich oder positiver Bestand",
      red: "Risiko, Fehler oder destruktive Aktion",
      blue: "Netzwerkinformation",
    },
    symbolUsage: {
      decimal: ",",
      group: ".",
      currencyPosition: "after",
    },
    regionalContent: {
      marketLabel: "Stellar-Markt Deutschland",
      supportLabel: "Geschaftszeiten Deutschland",
      complianceNote: "Lokale Vorgaben zu Datenschutz, MiCA und Steuerberichten berucksichtigen.",
      defaultNetworkNotice: "Fiat-Werte werden bevorzugt in Euro formatiert.",
    },
  },
  {
    code: "pt-BR",
    languageCode: "pt",
    label: "Portuguese (Brazil)",
    nativeLabel: "Português (Brasil)",
    region: "BR",
    currency: "BRL",
    timeZone: "America/Sao_Paulo",
    textDirection: "ltr",
    numberSystem: "latn",
    hourCycle: "h23",
    layoutDensity: "comfortable",
    colorMeanings: {
      green: "saldo positivo ou confirmacao",
      red: "risco, falha ou acao irreversivel",
      blue: "informacao da rede",
    },
    symbolUsage: {
      decimal: ",",
      group: ".",
      currencyPosition: "before",
    },
    regionalContent: {
      marketLabel: "Mercado Stellar no Brasil",
      supportLabel: "Horario de Brasilia",
      complianceNote: "Validar requisitos locais de criptoativos, privacidade e impostos.",
      defaultNetworkNotice: "Valores fiduciarios usam formato em real brasileiro.",
    },
  },
  {
    code: "ja-JP",
    languageCode: "ja",
    label: "Japanese (Japan)",
    nativeLabel: "日本語（日本）",
    region: "JP",
    currency: "JPY",
    timeZone: "Asia/Tokyo",
    textDirection: "ltr",
    numberSystem: "latn",
    hourCycle: "h23",
    layoutDensity: "compact",
    colorMeanings: {
      green: "成功または安全な状態",
      red: "重要、警告、失敗",
      blue: "ネットワーク情報",
    },
    symbolUsage: {
      decimal: ".",
      group: ",",
      currencyPosition: "before",
    },
    regionalContent: {
      marketLabel: "日本のStellar市場",
      supportLabel: "日本標準時",
      complianceNote: "資金決済、税務、個人情報保護の要件を確認してください。",
      defaultNetworkNotice: "法定通貨は日本円形式で表示されます。",
    },
  },
  {
    code: "ko-KR",
    languageCode: "ko",
    label: "Korean (Korea)",
    nativeLabel: "한국어(대한민국)",
    region: "KR",
    currency: "KRW",
    timeZone: "Asia/Seoul",
    textDirection: "ltr",
    numberSystem: "latn",
    hourCycle: "h23",
    layoutDensity: "compact",
    colorMeanings: {
      green: "성공 또는 긍정 상태",
      red: "위험, 실패 또는 중요 경고",
      blue: "네트워크 정보",
    },
    symbolUsage: {
      decimal: ".",
      group: ",",
      currencyPosition: "before",
    },
    regionalContent: {
      marketLabel: "한국 Stellar 시장",
      supportLabel: "한국 표준시",
      complianceNote: "현지 가상자산, 개인정보 및 세무 요구사항을 확인하세요.",
      defaultNetworkNotice: "법정화폐 금액은 원화 형식으로 표시됩니다.",
    },
  },
  {
    code: "ar-SA",
    languageCode: "ar",
    label: "Arabic (Saudi Arabia)",
    nativeLabel: "العربية (السعودية)",
    region: "SA",
    currency: "SAR",
    timeZone: "Asia/Riyadh",
    textDirection: "rtl",
    numberSystem: "arab",
    hourCycle: "h23",
    layoutDensity: "spacious",
    colorMeanings: {
      green: "حالة ناجحة أو رصيد موجب",
      red: "مخاطر أو فشل أو إجراء حساس",
      blue: "معلومات الشبكة",
    },
    symbolUsage: {
      decimal: "٫",
      group: "٬",
      currencyPosition: "after",
    },
    regionalContent: {
      marketLabel: "سوق Stellar المحلي",
      supportLabel: "توقيت السعودية",
      complianceNote: "تحقق من متطلبات الأصول الرقمية والخصوصية والضرائب المحلية قبل التشغيل.",
      defaultNetworkNotice: "تعرض القيم النقدية بصيغة الريال السعودي.",
    },
  },
];

const PROFILE_BY_CODE = new Map(LOCALE_PROFILES.map((profile) => [profile.code.toLowerCase(), profile]));
const PROFILE_BY_LANGUAGE = new Map(LOCALE_PROFILES.map((profile) => [profile.languageCode, profile]));

export function normalizeLocaleCode(value?: string | null) {
  if (!value) return LOCALE_PROFILES[0].code;
  const normalized = value.replace("_", "-");
  const exact = PROFILE_BY_CODE.get(normalized.toLowerCase());
  if (exact) return exact.code;
  const language = normalized.slice(0, 2).toLowerCase();
  return PROFILE_BY_LANGUAGE.get(language)?.code || LOCALE_PROFILES[0].code;
}

export function getLocaleProfile(value?: string | null) {
  const code = normalizeLocaleCode(value);
  return PROFILE_BY_CODE.get(code.toLowerCase()) || LOCALE_PROFILES[0];
}

export function detectBestLocale(sources: LocaleDetectionSources = {}) {
  return getLocaleProfile(sources.storedLocale || sources.navigatorLanguage || sources.htmlLang);
}

export function loadPersistedLocale(storage: Pick<Storage, "getItem"> | null | undefined = globalThis.localStorage) {
  try {
    const stored = storage?.getItem(LOCALE_STORAGE_KEY);
    return stored ? normalizeLocaleCode(stored) : null;
  } catch {
    return null;
  }
}

export function persistLocalePreference(localeCode: string, storage: Pick<Storage, "setItem"> | null | undefined = globalThis.localStorage) {
  const profile = getLocaleProfile(localeCode);
  try {
    storage?.setItem(LOCALE_STORAGE_KEY, profile.code);
  } catch {
    // Storage can be unavailable in private browsing and server-side rendering.
  }
  return profile;
}

export function isLocaleRTL(localeCode?: string | null) {
  return getLocaleProfile(localeCode).textDirection === "rtl";
}

export function formatLocaleDateTime(value: Date | string | number, localeCode?: string | null, options: Intl.DateTimeFormatOptions = {}) {
  const profile = getLocaleProfile(localeCode);
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat(profile.code, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: profile.timeZone,
    hourCycle: profile.hourCycle,
    ...options,
  }).format(date);
}

export function formatLocaleNumber(value: number, localeCode?: string | null, options: Intl.NumberFormatOptions = {}) {
  const profile = getLocaleProfile(localeCode);
  return new Intl.NumberFormat(profile.code, {
    numberingSystem: profile.numberSystem,
    maximumFractionDigits: 2,
    ...options,
  }).format(value);
}

export function formatLocaleCurrency(value: number, localeCode?: string | null, currency?: string) {
  const profile = getLocaleProfile(localeCode);
  return new Intl.NumberFormat(profile.code, {
    style: "currency",
    currency: currency || profile.currency,
    currencyDisplay: "narrowSymbol",
    numberingSystem: profile.numberSystem,
  }).format(value);
}

export function getCulturalAdaptations(localeCode?: string | null) {
  const profile = getLocaleProfile(localeCode);
  return {
    textDirection: profile.textDirection,
    layoutDensity: profile.layoutDensity,
    colorMeanings: profile.colorMeanings,
    symbolUsage: profile.symbolUsage,
  };
}

export function getRegionalContent(localeCode?: string | null) {
  return getLocaleProfile(localeCode).regionalContent;
}

export function validateLocaleFormatting(localeCode?: string | null) {
  const profile = getLocaleProfile(localeCode);
  const formattedDate = formatLocaleDateTime("2026-06-25T15:30:00Z", profile.code);
  const formattedNumber = formatLocaleNumber(1234567.89, profile.code);
  const formattedCurrency = formatLocaleCurrency(1234.56, profile.code);
  const currencyParts = new Intl.NumberFormat(profile.code, {
    style: "currency",
    currency: profile.currency,
    currencyDisplay: "narrowSymbol",
    numberingSystem: profile.numberSystem,
  }).formatToParts(1234.56);

  return {
    locale: profile.code,
    directionMatches: isLocaleRTL(profile.code) === (profile.textDirection === "rtl"),
    hasLocalizedDate: formattedDate.length > 0,
    hasLocalizedNumber: formattedNumber.length > 0,
    hasLocalizedCurrency: currencyParts.some((part) => part.type === "currency" && part.value.length > 0),
    samples: {
      date: formattedDate,
      number: formattedNumber,
      currency: formattedCurrency,
    },
  };
}

export function buildLocaleTestMatrix(locales = LOCALE_PROFILES.map((profile) => profile.code)) {
  return locales.map((localeCode) => {
    const profile = getLocaleProfile(localeCode);
    const validation = validateLocaleFormatting(profile.code);
    return {
      locale: profile.code,
      language: profile.languageCode,
      direction: profile.textDirection,
      region: profile.region,
      valid: validation.directionMatches && validation.hasLocalizedDate && validation.hasLocalizedNumber && validation.hasLocalizedCurrency,
      samples: validation.samples,
    };
  });
}
