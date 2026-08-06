// Flag emoji are just two Unicode regional-indicator symbols built from an
// ISO 3166-1 alpha-2 code — deriving them from a slug->ISO2 map is more
// maintainable than hand-typing ~130 emoji.
const SLUG_TO_ISO2: Record<string, string> = {
  albania: "AL", algeria: "DZ", angola: "AO", argentina: "AR", armenia: "AM",
  australia: "AU", austria: "AT", azerbaijan: "AZ", bahrain: "BH", bangladesh: "BD",
  belarus: "BY", belgium: "BE", bhutan: "BT", bolivia: "BO", "bosnia-and-herzegovina": "BA",
  botswana: "BW", brazil: "BR", brunei: "BN", bulgaria: "BG", cambodia: "KH",
  cameroon: "CM", canada: "CA", "cape-verde": "CV", chile: "CL", china: "CN",
  colombia: "CO", "costa-rica": "CR", croatia: "HR", cuba: "CU", cyprus: "CY",
  "czech-republic": "CZ", denmark: "DK", "dominican-republic": "DO", ecuador: "EC",
  egypt: "EG", estonia: "EE", eswatini: "SZ", ethiopia: "ET", fiji: "FJ",
  finland: "FI", france: "FR", georgia: "GE", germany: "DE", ghana: "GH",
  greece: "GR", guatemala: "GT", honduras: "HN", "hong-kong": "HK", hungary: "HU",
  iceland: "IS", india: "IN", indonesia: "ID", iran: "IR", iraq: "IQ",
  ireland: "IE", israel: "IL", italy: "IT", "ivory-coast": "CI", jamaica: "JM",
  japan: "JP", jordan: "JO", kazakhstan: "KZ", kenya: "KE", kuwait: "KW",
  kyrgyzstan: "KG", laos: "LA", latvia: "LV", lebanon: "LB", lithuania: "LT",
  luxembourg: "LU", malaysia: "MY", maldives: "MV", malta: "MT", mauritius: "MU",
  mexico: "MX", moldova: "MD", mongolia: "MN", montenegro: "ME", morocco: "MA",
  mozambique: "MZ", myanmar: "MM", namibia: "NA", nepal: "NP", netherlands: "NL",
  "new-zealand": "NZ", nicaragua: "NI", nigeria: "NG", "north-macedonia": "MK",
  norway: "NO", oman: "OM", pakistan: "PK", panama: "PA", "papua-new-guinea": "PG",
  paraguay: "PY", peru: "PE", philippines: "PH", poland: "PL", portugal: "PT",
  qatar: "QA", romania: "RO", russia: "RU", rwanda: "RW", samoa: "WS",
  "saudi-arabia": "SA", senegal: "SN", serbia: "RS", seychelles: "SC",
  singapore: "SG", slovakia: "SK", slovenia: "SI", somalia: "SO",
  "south-africa": "ZA", "south-korea": "KR", "south-sudan": "SS", spain: "ES",
  "sri-lanka": "LK", sudan: "SD", sweden: "SE", switzerland: "CH", syria: "SY",
  taiwan: "TW", tanzania: "TZ", thailand: "TH", "trinidad-and-tobago": "TT",
  tunisia: "TN", turkey: "TR", uae: "AE", uganda: "UG", uk: "GB", ukraine: "UA",
  uruguay: "UY", usa: "US", uzbekistan: "UZ", vanuatu: "VU", venezuela: "VE",
  vietnam: "VN", yemen: "YE", zambia: "ZM", zimbabwe: "ZW",
};

export function flagEmoji(countrySlug: string): string {
  const iso2 = SLUG_TO_ISO2[countrySlug];
  if (!iso2) return "🏳️";
  const codePoints = [...iso2.toUpperCase()].map((c) => 0x1f1e6 + (c.charCodeAt(0) - 65));
  return String.fromCodePoint(...codePoints);
}
