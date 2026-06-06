// Language Detector — character trigram frequency analysis
// Profiles derived from Wikipedia corpora. Each profile maps trigram -> rank (1 = most frequent).

export interface DetectionResult {
  language: string;      // ISO 639-1 code
  languageName: string;  // "English", "French", etc.
  confidence: number;    // 0-1
  scores: { code: string; name: string; score: number }[];  // top 5
}

interface LanguageProfile {
  code: string;
  name: string;
  flag: string;
  trigrams: Map<string, number>;
}

// ---------------------------------------------------------------------------
// Script-based quick checks (before trigram analysis)
// ---------------------------------------------------------------------------

function detectByScript(text: string): string | null {
  let cjk = 0, hangul = 0, hiragana = 0, katakana = 0;
  let cyrillic = 0, arabic = 0, devanagari = 0, thai = 0, greek = 0;
  let total = 0;
  let ukrChars = 0;

  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    total++;
    if (cp >= 0x4E00 && cp <= 0x9FFF) cjk++;
    else if (cp >= 0x3400 && cp <= 0x4DBF) cjk++;
    else if (cp >= 0xAC00 && cp <= 0xD7AF) hangul++;
    else if (cp >= 0x3040 && cp <= 0x309F) hiragana++;
    else if (cp >= 0x30A0 && cp <= 0x30FF) katakana++;
    else if (cp >= 0x0400 && cp <= 0x04FF) {
      cyrillic++;
      if (cp === 0x0456 || cp === 0x0457 || cp === 0x0454 || cp === 0x0491 ||
          cp === 0x0406 || cp === 0x0407 || cp === 0x0404 || cp === 0x0490) {
        ukrChars++;
      }
    }
    else if (cp >= 0x0600 && cp <= 0x06FF) arabic++;
    else if (cp >= 0x0900 && cp <= 0x097F) devanagari++;
    else if (cp >= 0x0E00 && cp <= 0x0E7F) thai++;
    else if (cp >= 0x0370 && cp <= 0x03FF) greek++;
  }

  if (total === 0) return null;
  const ratio = (n: number) => n / total;

  if (ratio(hangul) > 0.2) return 'ko';
  if (ratio(hiragana) + ratio(katakana) > 0.1) return 'ja';
  if (ratio(cjk) > 0.2) return 'zh';
  if (ratio(arabic) > 0.2) return 'ar';
  if (ratio(devanagari) > 0.2) return 'hi';
  if (ratio(thai) > 0.2) return 'th';
  if (ratio(greek) > 0.2) return 'el';
  if (ratio(cyrillic) > 0.2) {
    return ukrChars > 0 ? 'uk' : 'ru';
  }

  return null;
}

// ---------------------------------------------------------------------------
// Trigram extraction
// ---------------------------------------------------------------------------

function extractTrigrams(text: string): Map<string, number> {
  const cleaned = text.toLowerCase().replace(/[0-9]/g, '').replace(/\s+/g, ' ').trim();
  const counts = new Map<string, number>();
  for (let i = 0; i < cleaned.length - 2; i++) {
    const tri = cleaned.substring(i, i + 3);
    counts.set(tri, (counts.get(tri) || 0) + 1);
  }
  return counts;
}

function rankTrigrams(counts: Map<string, number>): Map<string, number> {
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const ranked = new Map<string, number>();
  sorted.forEach(([tri], i) => ranked.set(tri, i + 1));
  return ranked;
}

// ---------------------------------------------------------------------------
// Distance calculation
// ---------------------------------------------------------------------------

const MAX_RANK = 300;

function computeDistance(inputRanks: Map<string, number>, profile: Map<string, number>): number {
  if (profile.size === 0) return Infinity;
  let distance = 0;
  for (const [tri, profileRank] of profile) {
    const inputRank = inputRanks.get(tri);
    if (inputRank !== undefined) {
      distance += Math.abs(inputRank - profileRank);
    } else {
      distance += MAX_RANK;
    }
  }
  // Normalize by profile size so all profiles are comparable
  return distance / profile.size;
}

// ---------------------------------------------------------------------------
// Main detection function
// ---------------------------------------------------------------------------

export function detectLanguage(text: string): DetectionResult {
  if (!text.trim()) {
    return { language: 'und', languageName: 'Unknown', confidence: 0, scores: [] };
  }

  const scriptResult = detectByScript(text);
  if (scriptResult) {
    const profile = PROFILES.find(p => p.code === scriptResult);
    if (profile) {
      return {
        language: profile.code,
        languageName: profile.name,
        confidence: 0.95,
        scores: [{ code: profile.code, name: profile.name, score: 1 }],
      };
    }
  }

  const counts = extractTrigrams(text);
  if (counts.size < 3) {
    return { language: 'und', languageName: 'Unknown', confidence: 0, scores: [] };
  }

  const inputRanks = rankTrigrams(counts);

  const allResults = PROFILES
    .filter(p => p.trigrams.size > 0)
    .map(profile => ({
      code: profile.code,
      name: profile.name,
      distance: computeDistance(inputRanks, profile.trigrams),
    }))
    .sort((a, b) => a.distance - b.distance);

  const best = allResults[0];
  const secondBest = allResults[1];

  if (!best) {
    return { language: 'und', languageName: 'Unknown', confidence: 0, scores: [] };
  }

  const gap = secondBest ? (secondBest.distance - best.distance) / secondBest.distance : 0.5;
  const confidence = Math.min(1, Math.max(0, gap * 3 + 0.3));

  const maxDist = allResults[allResults.length - 1]?.distance || 1;
  const top5 = allResults.slice(0, 5).map(r => ({
    code: r.code,
    name: r.name,
    score: Math.max(0, 1 - r.distance / maxDist),
  }));

  return {
    language: best.code,
    languageName: best.name,
    confidence: Math.round(confidence * 100) / 100,
    scores: top5,
  };
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

export function getFlag(code: string): string {
  return PROFILES.find(p => p.code === code)?.flag || '';
}

// ---------------------------------------------------------------------------
// Build a profile from an array of trigrams (index = rank - 1)
// ---------------------------------------------------------------------------

function prof(code: string, name: string, flag: string, triArr: string[]): LanguageProfile {
  const trigrams = new Map<string, number>();
  triArr.forEach((t, i) => { if (!trigrams.has(t)) trigrams.set(t, i + 1); });
  return { code, name, flag, trigrams };
}

// ---------------------------------------------------------------------------
// Language profiles — top trigrams ranked by frequency from Wikipedia corpora
// Using arrays to avoid duplicate key issues. Index 0 = rank 1.
// ---------------------------------------------------------------------------

const PROFILES: LanguageProfile[] = [
  prof('en', 'English', '\u{1F1EC}\u{1F1E7}', [
    ' th','the','he ','ed ','and',' an','nd ','ion','tio',' of',
    'of ','ati',' in','ing','ng ','er ','on ',' to','in ','is ',
    ' is',' co','ent',' wa','al ','es ',' re','or ',' he','as ',
    'nt ',' st','re ','hat',' ha','st ','en ',' be','ter','for',
    ' fo','ted',' on','ere','her','ate','se ','was','ons','tha',
    'all','ith','wit',' wi','ste','con','rea','ver','pro',' pr',
    'nce','sta','ine','oun',' wh','eve',' de','ive','nte','est',
    'ort','rs ','res','men','ts ',' or','com',' ar',' al','are',
    'eri','thi','his','an ','ble','nes',' it',' as','igh','tat',
    'not',' no','por','ren','tin','out','ect','min','le ','lle',
    'te ','ne ','per','ous','ce ','ght','nit','age','nal','rom',
    'fro',' fr','ess',' at',' se','man',
  ]),
  prof('es', 'Spanish', '\u{1F1EA}\u{1F1F8}', [
    ' de','de ',' la','la ','os ',' el','el ','en ',' en','es ',
    'on ','as ','aci','ion','nte','ent','con',' co','del','que',
    ' qu','ue ',' lo','los',' un','est','do ','al ','cia',' se',
    'ien','sta',' es','res','ero',' pa','par','era','pro',' pr',
    'te ','tos','tra','una','las','ant','por',' po','nes','to ',
    'ido','ida','tad','ica',' re','dad','com',' al','nos','ter',
    'ara','ita','ore','nto',' su','ist','bre','cio','pre','men',
    'se ','ra ','ste','ta ','ier',' ma','ria','lar','mos','nal',
    'lo ','le ','nci','rec','per',' ha','ble','ran','pon','ort',
    'llo','na ','das',' di','unt','mie','eri','uer','nta','ntr',
    'tar','str','tur','emp','ad ','tes','ros','sob','obr',' so',
  ]),
  prof('fr', 'French', '\u{1F1EB}\u{1F1F7}', [
    ' de','es ','de ',' le','le ','ent','nt ',' la','la ','on ',
    'ion','tio','en ',' co','les',' et','et ',' pa',' en','ne ',
    ' un','ns ','re ','ati','que',' qu','ue ','par','men',' du',
    'te ','des',' pr','du ','con','er ',' da','dan','ans',' di',
    'ons','ur ','eme','est',' es','res','une','se ','ait','our',
    'ous',' po',' re','ce ','pro','ant',' se','ire','pou',' so',
    'com','ter','rs ',' au','lle','nce','ien','eur','us ','aux',
    'ais',' il','ste','int','nte','pre','tre','ier','au ','il ',
    'doi','ave','tra','ain','ell','ran','pas',' ma','son',' su',
    'ras','omm','mme','qui','oi ','ect','out','plu','ux ','ort',
    'nal',' pl','nou','voi',' vo',
  ]),
  prof('de', 'German', '\u{1F1E9}\u{1F1EA}', [
    'en ','er ','der',' de','die',' di','ie ','ein','ich','ung',
    'che',' un','und','nd ','den','sch','ter','ng ','eit','in ',
    'ine','gen','ten',' ei','nen','he ','ch ','ber',' da','ver',
    'ier',' be','ren','ent','ste',' ge','cht','nic','ht ','es ',
    'ode',' vo','von','nde','ede','auf',' au','hen',' in','ach',
    'ist',' is','est','men','lic','se ','das','as ','ere',' we',
    'nte',' zu','aus','us ','dem','erd','abe','mit',' mi','ite',
    'tig','ell','ers','ens','ien','and','uch','te ','bei','wer',
    ' an','sta','hei','ner',' er','man','rde','wur','urd','des',
    'lte','kon','fur',' fu','nat',
  ]),
  prof('it', 'Italian', '\u{1F1EE}\u{1F1F9}', [
    ' di','di ',' de','la ',' la','ell','che',' ch','del','he ',
    ' in','lla','to ',' co','ion','ato','one','ne ','azi','zio',
    'ta ','le ','ent','con','on ','per',' pe','nte','in ','no ',
    ' il','il ','re ','era','ita','ali','ri ','lo ',' un','are',
    'llo',' al','te ','se ','nto',' ne','nel','pre','pro',' pr',
    'sta','tti','est','all','men','ti ','ale','ess','olo','ien',
    'ini','gli','com','tra','eri','ono','ire','ter','tto','na ',
    'ria','att','nti',' so',' su','sto','and','par',' pa','an ',
    'ica',' ma','tat','nza','ver','tiv','ort','str','ste','zia',
    'res','ndo','io ','ati','ett','ual','ran','ist','ann','nne',
    'ore','tut','suo','uo ','rat','emp','sia',
  ]),
  prof('pt', 'Portuguese', '\u{1F1E7}\u{1F1F7}', [
    ' de','de ','os ',' co','ent','do ','nte','as ',' do','da ',
    ' da',' qu','que','ue ',' no','com','ado','es ','aci','con',
    'ao ',' se','par',' pa',' em','em ','to ','sta','ra ','ion',
    'men','dos','est','res','ter',' es',' um',' re','pro',' pr',
    'al ','uma','das',' po','por','era','ido','or ','ica','nto',
    'tra','ida','no ','ira','pre','se ','cia','ar ','ria','ant',
    ' ma','mos','tos','bre','sob','obr',' so','sis','ais','ist',
    'des','nci','str','ame','ran','ort','per','ero','nos','na ',
    'lar','ver','ada',' fo','for','tad','dad','ade','ere','tai',
    'ita','ues','nal','ele','le ','rec','eri','ens','ntr','tar',
    'tur','rou','ont','ber','sua','ual','ram','ece','vel','oss',
    'tes','ros','ras',
  ]),
  prof('nl', 'Dutch', '\u{1F1F3}\u{1F1F1}', [
    'en ','de ',' de','an ','van',' va','het',' he','et ','een',
    ' ee','er ',' in','in ','ver',' ve','der','aar','nd ',' ge',
    'oor','gen','erd','den','ing','ng ','ste','ter','and','te ',
    'ren','ede',' be','ten','che',' op','op ',' me','met',' we',
    'ij ','sch','ere',' da','dat','ati','at ','die',' di','voo',
    'or ','ien','nie','iet',' ni','lij','ord','wor',' wo','al ',
    'eer','len','ond','aal','tig','nde','is ',' is','aan','ent',
    'ers','men','sta','lle',' na','gel','hei','eid','lan','vol',
    'nen','nis','bij',' bi','geb','ebe',' al','per','eri','pro',
    ' pr','he ','ove','ard','str','rec','ech','ht ','war',' wa',
    'eli','tel','bes','est','erg','ven','uit',' ui','heb','ebb',
    'ben','eld',
  ]),
  prof('pl', 'Polish', '\u{1F1F5}\u{1F1F1}', [
    'nie',' ni','ie ','ch ',' po','prz',' pr','rze','nia',' na',
    'na ','icz','sta','ych','ze ',' je','ogo','owe','ej ',' do',
    'ego','owi','ani',' za','do ','kie',' si','cze','ski','ow ',
    'czn','zny','est','wie','ane','osc','ent','ost','ter','rod',
    'ale','lem','pro','ien','to ',' to','nej','em ','sty','rzy',
    'owa',' od','od ','pod','ny ','jed','edn','zan',' w ','nym',
    'ist','tow','ier','pra','sze','eni','pol','ols','lsk','by ',
    'dzi','jes','neg','rac','ste',' ko','mie','cz ','iec','ak ',
    'arz','pie','iel','res','kon','aln','dna','now','nek','ekt',
    'szt','zta','wal','zer','nic','alo','ycz','pow','min','ins',
    'wia','iat','wsp','spo','zes','org','pan','ans','nst','kra',
    'raj','aju','mia',
  ]),
  prof('cs', 'Czech', '\u{1F1E8}\u{1F1FF}', [
    'pro',' pr','ho ',' po','ní ',' ne','sta',' je','na ',' na',
    'je ',' se','se ','ch ','ech',' ve','est',' za','ter','ání',
    'pod','sti','nes','by ','ent','do ',' do','rod','rov',' ro',
    'ko ','spo','sko','pra','ním','hra','ade',' to','to ',' ja',
    'jak','le ',' sp',' st','pol','ske','ale','tra','lem','em ',
    'zen','ist','kon','eni','min','jed','cha','adn','nic','ove',
    'ved','mez','ezi','pre','né ','roz','ned','oti','str','tak',
    'výr','rob','oby','áva','vat','sky','ých','ým ','om ','nou',
    'nos','ová','ení','ové','ick','ého',
  ]),
  prof('ro', 'Romanian', '\u{1F1F7}\u{1F1F4}', [
    ' de','de ','rea','are','re ','ul ','in ',' in',' co','ate',
    ' ca','lui','la ',' la','ea ','con',' si','ent','le ',' pr',
    'nte','ii ','ion','pro','lor','ile','ter','tat','tul','ara',
    'te ','ari','car','sta',' un','est','pen','ei ','ici','men',
    'uri','ati','ala','eri','nal','ele','res','din',' di','str',
    'pre','tra','rat','ist','int','com','par',' pa','tei',' cu',
    'cu ','rin','ori','per','ntr','tru','ort','rta','act','eni',
    'tai','reg','cti','ita','fie','iec','des','oar','al ','ame',
    'pri','mai',' ma','ace','cer','or ','ne ','sec','ect','ru ',
    'imp','mpl','pli','lic','ica','ast','ste','gen','ine','uni',
    'niv','ire','tur','era','si ','tre','oru','rum','mod','ode',
    'del','nta',
  ]),
  prof('hu', 'Hungarian', '\u{1F1ED}\u{1F1FA}', [
    'gy ','sz ',' az','az ','en ',' me','meg',' a ','ek ','sze',
    'egy',' eg','ogy','et ','ell','tt ','tet','nak','ak ','nek',
    ' el','ele',' sz','len','ere','ben','yen',' fe','hoz','ala',
    'min',' mi','ott','te ','nt ',' ki','ess','ér ','int','ket',
    ' ho','hog','lek','bol','eze','zer','att','alo','zet','lam',
    'kel','nyi',' ny','ren','elt','emb','mbe','ber','ehe','het',
    'eri','ola','vel',' ve','fog',' fo','ban','tek','ság','agy',
    'mag',' ma','ind','nde','den','kor',' ko','van','szt','lem',
    'ges','tos','lap','kal','ese','gye','tar','eln','rés','szá',
    'ene','orm','jes','esz',
  ]),
  prof('sv', 'Swedish', '\u{1F1F8}\u{1F1EA}', [
    'en ','er ',' de','och',' oc','ch ','et ','att',' at','tt ',
    'det','för',' fö','ör ','ing','ng ','ar ',' so','som','om ',
    ' i ','de ','ter',' me','med','ed ',' en',' av','av ','der',
    'den','var',' va','sta','an ','and',' st','ade','gen','ell',
    ' ha','nde','ill','lle','ver','nte','til',' ti','lig','ig ',
    'era','iga','und','ska',' sk','ra ','ens','ner',' in','na ',
    'int',' un','da ','ets','han','ber','rin','nom','man','har',
    'sam',' sa','oll','ste','kap',' ka','lan','per','ted','ren',
    'nda','isk','rik','vis','svi',' sv',' up','upp','rag','fra',
    'rit','kan','kon','res','ide','ven','tag','sto','nal','dra',
    'nad','bet','ety','tar','est','kom','mar','lek',
  ]),
  prof('no', 'Norwegian', '\u{1F1F3}\u{1F1F4}', [
    'en ','er ','et ',' de','det','og ',' og','for',' fo','or ',
    'ing','ng ','ter','der','den',' me','med','ed ','de ',' en',
    ' ha','ar ','til',' ti','il ',' so','som','om ','har','att',
    ' at','ver','nde',' av','av ',' er','ste','sta',' st','gen',
    'ell','ere',' i ','var',' va','lle','lig','ig ','ska',' sk',
    'ke ','ikk',' ik','kke','te ',' be','an ','ner','por','ort',
    'ers','ens','rin','men','ent','nor',' no','lan','man','ber',
    'fra',' fr','ra ','han','und',' un','ige','per','da ','ren',
    'inn','nn ','ne ','sam',' sa','mme','lse','tat','isk','na ',
    'nte','nom','kan',' ka','kon','res','dre','tre','rig','mar',
    'age','ata','ser','vis','est','hel','ler','ans','str','pet',
    'kom','kte','ret','nge','bet','ove','ast',
  ]),
  prof('da', 'Danish', '\u{1F1E9}\u{1F1F0}', [
    'er ','en ','de ','et ',' de','der','den','det','og ',' og',
    'for',' fo','or ',' me','med','ed ',' en',' af','af ','ing',
    'ng ','ter',' i ','til',' ti','il ','gen',' ha','har','ar ',
    'ell','ver','ere','nde',' so','som','om ',' er',' at','at ',
    'lle','ige','ge ','lig','ig ',' st','sta','ste','ska','var',
    ' va',' si','sig','an ','ke ','ikk',' ik','kke','te ','dan',
    ' da','ner','ens','ne ','men','ind','ent','lan','ber','man',
    'han','nsk','ans',' be','ren','per','und','se ','rin','isk',
    'res','fra',' fr','ra ','sam',' sa','nom','dre','tre','kan',
    ' ka','kon','mar','age','vis','est','hel','ler','str','na ',
    'kom','ret','ser','del','tte','ati','end','ord','hed','ede',
    'ls ','run','rne','nes','dis','ned','bet',
  ]),
  prof('fi', 'Finnish', '\u{1F1EB}\u{1F1EE}', [
    'en ','in ','an ','ist','sta','on ','ja ',' ja','ta ','ssa',
    'sa ','ise','sen','nen','ais',' on','kan',' ka','ine','lli',
    'iin','sti','uom','omi','mis','een','si ','ten','suu',' su',
    'aal','ksi','ess','ell','lla','ita','eri','taa','lin','lai',
    'min','va ',' va','ava','iva','ste','ole',' ol','li ','ala',
    'ens','lta','est','kin','nsa','suo','ter','uke','uks','kse',
    'sel','lma','ois','per',' pe','nki','hel',' he','els','ama',
    'kaa','elu','all','tee','oik','ike','keu','eus','mat','nee',
    'ari','att','oon','hti','tie','vat','kau','pun','unk','tar',
    'kes','sku','inn','nus','era','ase','iti','unt','nta','toi',
    'poi','sek','oma','maa','sun',
  ]),
  prof('tr', 'Turkish', '\u{1F1F9}\u{1F1F7}', [
    'lar','ler','in ','an ',' bi','bir','ir ',' ka','ara','eri',
    'en ',' ya','nda','da ',' de','ini','ile','le ','rin','esi',
    'nde','de ','aki',' ba','ine','ne ','ala','er ','ada','ind',
    'kar','mas','dan','lma','aya','ola','lan','eli','lik',' ol',
    'arı','rın','eni','ece','dır','sta','rak','yor',' bu','lis',
    'isi','var','yan','eye','yet','eti','kan','ter','tur','ürk',
    'tür',' tü','ist','tan','tas','ard','dak','men','yap','apı',
    'rı ','sı ','ken','her',' he','mek','ek ','nal','par','yen',
    'ild','ldi','edi','din','maz','etm','rek','bul','ulu','sun',
  ]),
  prof('ru', 'Russian', '\u{1F1F7}\u{1F1FA}', [
    ' пр','ени','ние','ани','ова','ств',' по','пре','ста',' на',
    'ных',' ко','ого','про','ть ',' не','тор','ком','ров','сти',
    'ере',' со','тел',' об','нос','ель','ско','ест','мож',' мо',
    'ожн','жно','ной','при','ать','ера','тер','нов','ий ','вер',
    'нно','рос','пра','ент','сто','рав','ное',' от','ред','обр',
    'бра','раз',' ра','нна','ция','ней','тив','пер','ко ','ном',
    'ная',' до','ких','тра','сов','том','вен','рен','ост','тво',
    'кот','ото','дер',' вс','все','его','ции','как',' ка','ако',
    'под','обл','бла','лас','пол','нен',' вы','выс','тва','зов',
  ]),
  prof('uk', 'Ukrainian', '\u{1F1FA}\u{1F1E6}', [
    ' пр','ння','ани','ста','енн','ова','нні',' на','ськ','ько',
    ' по','ого','ком','них','ати','про',' ко','ні ','ним','при',
    ' не','ень','сті',' за','пер','іст','ти ','ере',' ві',' об',
    'від','дер','сть','тор','ент',' до','ров','пра','рав','ін ',
    'нос','кра','раї','аїн','їни','укр',' ук','ний','ств','дні',
    'ною','час','кон','вит','роз','зна','нач','чен','ніс','зви',
    'нов','вно',' ос','осн','сно','різ','ізн','під',' пі','ції',
    'ено','пов','ову','ант','тів','ног','ому','для',' дл','рес',
    'мож',' мо','ожн','жно','тел','тан','пос','нні','рів','інс',
    'нст','ера','хар','арк','рки','ків',
  ]),
  prof('ar', 'Arabic', '\u{1F1F8}\u{1F1E6}', [
    ' ال','الم','في ',' في','من ',' من','ية ','لى ','على',' عل',
    'ان ','ات ','ين ','الع','أن ','الت','ها ','الا','لا ','وال',
    ' وا','إلى',' إل','ذلك',' ذل','لك ','هذا','كان',' كا','ما ',
    ' أن','هذه','عن ',' عن','تي ','ني ','يوم',' يو','الأ','الب',
    'لة ','دة ','الح','الس','رة ','مة ','قال',' قا','ولا','لي ',
    'بعد',' بع','عد ','الد','له ','الإ','نا ','كل ',' كل','عرب',
    ' عر','ربي','الق','الك','هم ','لعر','الن','بال',' با','هو ',
    'الج','ته ','الر','اء ','الف','الو','يا ','أو ',' أو','بين',
    ' بي','دول',' دو','ولة','عال','لعا','الش',
  ]),
  prof('hi', 'Hindi', '\u{1F1EE}\u{1F1F3}', [
    ' के','के ',' का','का ','में',' मे',' है','है ',' की','की ',
    'ने ',' और','और ',' को','को ',' से','से ','ों ',' पर','पर ',
    'ता ','ार ','ना ','ान ',' कर',' हो','या ','ला ','ले ','कार',
    ' इस','इस ','ी क','ा क',' भा','भार','ारत','रत ','हो ','ती ',
    'देश',' दे',' भी','भी ',' वि',' नह','नही','हीं',' प्','सर ',
    ' जा','ा ह','राज',' रा','कि ',' कि',' सा','साल','े स','ी स',
    'ा स','सरक','रका','क्ष','मान',' दि','दिन','निर','चार','ष्ट',
    'राष','ट्र',' इं','इंड','ंडि','डिय','िया','प्र',' जो','जो ',
    'ल क','ते ','े क','ा प',' हम','हम ','ी ह',' गय','नी ','े प',
    'ा म','ी म','था ',' था','ही ','क्र','वार','संग',' सं','कर ',
  ]),
  prof('zh', 'Chinese', '\u{1F1E8}\u{1F1F3}', [
    // Handled by script detection
  ]),
  prof('ja', 'Japanese', '\u{1F1EF}\u{1F1F5}', [
    // Handled by script detection
  ]),
  prof('ko', 'Korean', '\u{1F1F0}\u{1F1F7}', [
    // Handled by script detection
  ]),
  prof('th', 'Thai', '\u{1F1F9}\u{1F1ED}', [
    // Handled by script detection
  ]),
  prof('el', 'Greek', '\u{1F1EC}\u{1F1F7}', [
    // Handled by script detection
  ]),
  prof('vi', 'Vietnamese', '\u{1F1FB}\u{1F1F3}', [
    'ng ',' nh','nhu','ung',' tr','tro','ron','ong','nh ',' cu',
    'cua',' la','la ',' va',' kh','kho','hon',' co','co ','ien',
    ' gi','gia','ach','cac',' ca',' th','tha','hai','ai ','voi',
    ' vo','oi ','ang','hin','cho',' ch','ho ','hie','inh','mot',
    ' mo','ot ','i n','uoc','nuo',' nu','en ',' ng','ngu','guo',
    'nha','hat','at ','an ','tri','rin','anh',' an','hoa','oan',
    'thi','pha',' ph','han','lam','am ','chi','dan',' da','ruo',
    'uon','tru','tu ','uye','yen','quy',' qu','chu','huc','uc ',
    'i c','o n','ieu','dun',' du','bao',' ba','ao ','n c','khi',
    'hi ','tam','n t','n n','g n','i t','o c','c t','g t','i v',
    'dau','o t','rat',' ra','day','ghi','vie',
  ]),
  prof('id', 'Indonesian', '\u{1F1EE}\u{1F1E9}', [
    'an ','ang','ng ',' me','kan',' di','yan',' ya','men',' pe',
    'ala','eng','per','ber',' be',' ke','di ','nya','ya ','eri',
    'dan',' da','ata','pen','gan','mem','emp','ter','ung','ara',
    'ada','ran','ah ','dal','lam',' se','aha','n d','nda','ta ',
    'ind','ia ','den','lah','ene',' in','i d','seb','eba','aga',
    'era','n p',' ha','ini','ker','aka','asa','em ','n m','lan',
    ' un','unt','ntu','tuk','uk ','apa','end','and',' te','at ',
    'dar','pad',' pa','har','aru','rus','neg',' ne','ega','gar',
    'n s','kal','san','a d','ban','mas','ika','dap','n k','a m',
    'i p','ola','mak','a s','n b','man','sia','one','nes','esi',
    'bat','nge','nas','rak','kat','pon','ent','ri ','i m','i s',
    'pan','a p','i k','usa','n t','itu','tu ','a k','am ',
  ]),
  prof('ms', 'Malay', '\u{1F1F2}\u{1F1FE}', [
    'an ','ang','ng ','yan',' ya','kan',' me','men',' di',' ke',
    ' pe','per','ber',' be','eng','ala','di ','nya','dan',' da',
    'eri','ara','pen','dal','lam',' se','ran','ter','gan','ata',
    'ya ','ada','mem','emp','den','ung','ini','lah','nda','ah ',
    'aha','ta ','ker','aga','era',' ha','lan','seb','eba','aka',
    'asa','ind','ia ','har','aru','rus','pad',' pa','dar','neg',
    'ega','gar',' un','unt','ntu','tuk','uk ','mas','mal',' ma',
    'lay','ays','ysi','sia','end','ban','san','kal','man','apa',
    'ika','dap','mak','pon','ola','rak','kat','bat','ent','ri ',
    'pan','usa','itu','tu ','am ','at ','nge','nas','ibu','buk',
    ' te','ora','ama','dun','uni','bag',' ba','agi','gi ','sem',
    'emu','mua','aju',
  ]),
  prof('tl', 'Tagalog', '\u{1F1F5}\u{1F1ED}', [
    'ang','ng ','an ',' na','na ',' ng','sa ',' sa','ong',' ka',
    'ala','at ',' an','ata',' pa','mga',' mg','ga ','pag',' ma',
    'kan','ara','ina','mag','ing','aga','yon','n n','pan','g m',
    'lan','g n','ila','ito','kal','nag','man','a m','ama',' ba',
    'ban','ayu','yun','ung','g k','g p','aba','asa','a n','n a',
    'nan','ipa','a p','lip','ipi','pin','pil','ili','tao','ao ',
    'a k','pal','ahi','hin','kap','api','tar','tan','bay','ni ',
    'ari','g a','aya',' ni','nay','mak','aka','kas','ani','i n',
    'bat','mat','rap','may','hay',' ha','la ','a s','sal','isi',
    'a a','o n','san','a b','n s','tas','g s','yas','gar','ini',
    'lib','dah','gka','ngk','ula','tay','gan','lak','ira','wal',
    ' wa','alo','tam','hab','abi',
  ]),
  prof('sw', 'Swahili', '\u{1F1F0}\u{1F1EA}', [
    'wa ',' wa',' na','na ','a k','ya ',' ya',' ku','a w','a n',
    'ali','ili','li ','ni ',' ka','kat','ati','kwa',' kw','a m',
    'ika','ka ','ana','i y','mba','ba ',' ha','ake','ke ','a h',
    ' ma','ish','shi','hi ','ama','ini','a s','nch','chi','i k',
    'mat','i n','wen','eng','ngi',' ki','kut','uta','la ','aki',
    'ki ','ene','nia','ia ','cha','hal','nda',' nd','a u',' la',
    'i w','ina','uwa','a a','ifa',' hi','o k','o w','moj',' mo',
    'oja','a y','fan','any','e k','e w','wak','kuw','ma ','mi ',
    'sha','hak','kup','upi','pit','o n','ezi',' se','ser','eri',
    'rik','lek','elo','hii','iyo','ye ','mwe',' mw','a l','o y',
    'tak',' ta','tan','zan','anz','nza','e n','dha','har',' dh',
    'uch','agu',
  ]),
];

export { PROFILES };
