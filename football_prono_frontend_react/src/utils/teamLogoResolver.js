/**
 * Module de résolution de logos d'équipes (V1.1)
 *
 * Résout le logo actuel et officiel d'une équipe de football.
 * Fonctionnement :
 * 1. Normalisation du nom (gestion des variantes, ex: "Paris SG", "PSG" -> "psg").
 * 2. Vérification dans un dictionnaire local (mapping léger des tops clubs avec leurs logos officiels et récents).
 * 3. Fallback vers un avatar générique neutre si l'équipe n'est pas dans le dictionnaire.
 *
 * Ce module garantit le retour synchrone d'une URL de logo toujours actuelle.
 */

// Mapping des logos officiels récents (SVG ou PNG haute qualité via Wikimedia)
const TOP_CLUBS_LOGOS = {
  // France
  'psg': 'https://upload.wikimedia.org/wikipedia/fr/thumb/8/86/Paris_Saint-Germain_Logo.svg/250px-Paris_Saint-Germain_Logo.svg.png',
  'marseille': 'https://upload.wikimedia.org/wikipedia/fr/thumb/4/43/Logo_Olympique_de_Marseille.svg/200px-Logo_Olympique_de_Marseille.svg.png',
  'lyon': 'https://upload.wikimedia.org/wikipedia/fr/thumb/e/e2/Olympique_lyonnais_%28logo%29.svg/200px-Olympique_lyonnais_%28logo%29.svg.png',
  'monaco': 'https://upload.wikimedia.org/wikipedia/fr/thumb/d/d3/Logo_AS_Monaco_FC.svg/200px-Logo_AS_Monaco_FC.svg.png',
  'lille': 'https://upload.wikimedia.org/wikipedia/fr/thumb/6/62/Logo_LOSC_Lille_2018.svg/200px-Logo_LOSC_Lille_2018.svg.png',
  'lens': 'https://upload.wikimedia.org/wikipedia/fr/thumb/2/2c/Logo_RC_Lens_2014.svg/200px-Logo_RC_Lens_2014.svg.png',
  'rennes': 'https://upload.wikimedia.org/wikipedia/fr/thumb/e/e9/Logo_Stade_Rennais_FC.svg/200px-Logo_Stade_Rennais_FC.svg.png',
  
  // Angleterre
  'arsenal': 'https://upload.wikimedia.org/wikipedia/fr/thumb/5/53/Arsenal_FC.svg/200px-Arsenal_FC.svg.png',
  'manchester city': 'https://upload.wikimedia.org/wikipedia/fr/thumb/b/ba/Badge_Manchester_City_FC_2016.svg/200px-Badge_Manchester_City_FC_2016.svg.png',
  'liverpool': 'https://upload.wikimedia.org/wikipedia/fr/thumb/5/54/Logo_FC_Liverpool.svg/200px-Logo_FC_Liverpool.svg.png',
  'manchester united': 'https://upload.wikimedia.org/wikipedia/fr/thumb/b/b9/Logo_Manchester_United.svg/200px-Logo_Manchester_United.svg.png',
  'chelsea': 'https://upload.wikimedia.org/wikipedia/fr/thumb/5/51/Logo_Chelsea.svg/200px-Logo_Chelsea.svg.png',
  'tottenham': 'https://upload.wikimedia.org/wikipedia/fr/thumb/b/b4/Tottenham_Hotspur.svg/200px-Tottenham_Hotspur.svg.png',
  'newcastle': 'https://upload.wikimedia.org/wikipedia/fr/thumb/6/63/Newcastle_United_Logo.svg/200px-Newcastle_United_Logo.svg.png',
  
  // Espagne
  'real madrid': 'https://upload.wikimedia.org/wikipedia/fr/thumb/c/c7/Logo_Real_Madrid.svg/200px-Logo_Real_Madrid.svg.png',
  'barcelona': 'https://upload.wikimedia.org/wikipedia/fr/thumb/a/a1/Logo_FC_Barcelona.svg/200px-Logo_FC_Barcelona.svg.png',
  'atletico madrid': 'https://upload.wikimedia.org/wikipedia/fr/thumb/c/c1/Atletico_Madrid_logo_2017.svg/200px-Atletico_Madrid_logo_2017.svg.png',
  'sevilla': 'https://upload.wikimedia.org/wikipedia/fr/thumb/6/6d/Logo_Sevilla_FC.svg/200px-Logo_Sevilla_FC.svg.png',
  
  // Italie
  'juventus': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/Juventus_FC_2017_icon_%28black%29.svg/200px-Juventus_FC_2017_icon_%28black%29.svg.png',
  'inter': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/FC_Internazionale_Milano_2021.svg/200px-FC_Internazionale_Milano_2021.svg.png',
  'ac milan': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d0/Logo_of_AC_Milan.svg/200px-Logo_of_AC_Milan.svg.png',
  'napoli': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/28/S.S.C._Napoli_logo.svg/200px-S.S.C._Napoli_logo.svg.png',
  'roma': 'https://upload.wikimedia.org/wikipedia/fr/thumb/9/9e/Logo_AS_Roma_2013.svg/200px-Logo_AS_Roma_2013.svg.png',
  
  // Allemagne
  'bayern munich': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/FC_Bayern_M%C3%BCnchen_logo_%282017%29.svg/200px-FC_Bayern_M%C3%BCnchen_logo_%282017%29.svg.png',
  'dortmund': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/67/Borussia_Dortmund_logo.svg/200px-Borussia_Dortmund_logo.svg.png',
  'bayer leverkusen': 'https://upload.wikimedia.org/wikipedia/fr/thumb/3/30/Bayer_Leverkusen_%28logo%29.svg/200px-Bayer_Leverkusen_%28logo%29.svg.png',
  'rb leipzig': 'https://upload.wikimedia.org/wikipedia/en/thumb/0/04/RB_Leipzig_2014_logo.svg/200px-RB_Leipzig_2014_logo.svg.png',

  // Sélections Nationales
  'allemagne': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/38/DFB-Logo_2011.svg/200px-DFB-Logo_2011.svg.png',
  'cote d\'ivoire': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fe/Flag_of_C%C3%B4te_d%27Ivoire.svg/200px-Flag_of_C%C3%B4te_d%27Ivoire.svg.png'
};

// Aliases pour normaliser les variantes de noms (désambiguïsation) vers une clé de base
const TEAM_ALIASES = {
  'germany': 'allemagne',
  'côte d\'ivoire': 'cote d\'ivoire',
  'côte d’ivoire': 'cote d\'ivoire',
  'ivory coast': 'cote d\'ivoire',
  'paris sg': 'psg',
  'paris saint germain': 'psg',
  'paris saint-germain': 'psg',
  'om': 'marseille',
  'olympique de marseille': 'marseille',
  'ol': 'lyon',
  'olympique lyonnais': 'lyon',
  'asm': 'monaco',
  'as monaco': 'monaco',
  'losc': 'lille',
  'losc lille': 'lille',
  'rcl': 'lens',
  'racing club de lens': 'lens',
  'stade rennais': 'rennes',
  
  'man utd': 'manchester united',
  'man united': 'manchester united',
  'mufc': 'manchester united',
  'man city': 'manchester city',
  'mcfc': 'manchester city',
  'spurs': 'tottenham',
  'tottenham hotspur': 'tottenham',
  'newcastle united': 'newcastle',
  
  'real': 'real madrid',
  'real madrid cf': 'real madrid',
  'barca': 'barcelona',
  'fc barcelona': 'barcelona',
  'atletico': 'atletico madrid',
  'atlético madrid': 'atletico madrid',
  'fc sevilla': 'sevilla',
  
  'juve': 'juventus',
  'juventus fc': 'juventus',
  'inter milan': 'inter',
  'milan ac': 'ac milan',
  'milan': 'ac milan',
  'ssc napoli': 'napoli',
  'as roma': 'roma',
  
  'bayern': 'bayern munich',
  'fc bayern munich': 'bayern munich',
  'fc bayern münchen': 'bayern munich',
  'bvb': 'dortmund',
  'borussia dortmund': 'dortmund',
  'leverkusen': 'bayer leverkusen',
  'leipzig': 'rb leipzig'
};

// Simple in-memory cache pour ne pas recalculer inutilement (même si c'est rapide en local)
const memoryCache = new Map();

/**
 * Nettoie et normalise le nom de l'équipe pour faciliter le matching.
 */
function normalizeName(name) {
  if (!name) return '';
  let cleanName = name.toLowerCase().trim();
  // Nettoyage de préfixes/suffixes communs qui peuvent gêner le matching exact
  cleanName = cleanName.replace(/\b(fc|cf|ac|as|sc)\b/g, '').trim();
  // Remplacer les multi-espaces
  cleanName = cleanName.replace(/\s+/g, ' ');
  return cleanName;
}

/**
 * Obtient l'URL du logo officiel actuel de l'équipe.
 * @param {string} teamName - Le nom brut de l'équipe.
 * @param {object} options - Options (ex: size, etc. non utilisées en V1 mais prêtes).
 * @returns {string} URL de l'image (SVG, PNG ou Fallback)
 */
export function getTeamLogo(teamName, _options = {}) {
  if (!teamName) return '';

  const cacheKey = teamName.toLowerCase().trim();
  if (memoryCache.has(cacheKey)) {
    return memoryCache.get(cacheKey);
  }

  // 1. Essai de normalisation agressive
  const normalized = normalizeName(teamName);
  
  // 2. Chercher dans les alias
  const aliasKey = TEAM_ALIASES[normalized] || TEAM_ALIASES[cacheKey] || normalized || cacheKey;
  
  // 3. Chercher dans les logos officiels
  let logoUrl = TOP_CLUBS_LOGOS[aliasKey];

  // 4. Si introuvable, génération d'un placeholder (neutre, esthétique)
  if (!logoUrl) {
    // Ex: avatar stylisé avec l'initiale ou les deux premières lettres
    // On utilise l'API ui-avatars, très rapide et sans dépendance
    const shortName = encodeURIComponent(teamName.substring(0, 3));
    logoUrl = `https://ui-avatars.com/api/?name=${shortName}&background=1e2330&color=ccff00&bold=true&font-size=0.4&size=128`;
  }

  memoryCache.set(cacheKey, logoUrl);
  return logoUrl;
}
