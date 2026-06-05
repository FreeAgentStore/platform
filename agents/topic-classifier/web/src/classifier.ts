/**
 * Topic classifier — LLM-generated, deterministic, no model needed.
 * This code was evolved through the FunSearch-style loop:
 * feed examples -> LLM writes code -> eval -> improve -> repeat.
 *
 * v1: weighted keyword scoring with 60-80 keywords per topic
 */

export type Topic = 'technology' | 'business' | 'health' | 'sports' | 'entertainment' | 'science' | 'politics' | 'finance' | 'education' | 'travel';

export interface TopicResult {
  topic: Topic;
  secondary: Topic | null;
  confidence: number;
  scores: Record<Topic, number>;
  signals: string[];
}

const TOPICS: Record<Topic, Record<string, number>> = {
  technology: {
    software: 3, hardware: 3, ai: 3, app: 2, code: 2, programming: 2, developer: 2,
    algorithm: 2, computer: 2, internet: 2, digital: 2, startup: 2, cloud: 2,
    cybersecurity: 2, blockchain: 1, api: 2, database: 2, server: 2, browser: 1,
    javascript: 2, python: 2, typescript: 2, rust: 2, java: 2, kotlin: 2, swift: 2,
    github: 2, linux: 2, windows: 1, macos: 1, android: 2, ios: 2,
    processor: 2, gpu: 2, cpu: 2, chip: 2, semiconductor: 3, transistor: 2,
    smartphone: 2, laptop: 2, tablet: 1, wearable: 2, gadget: 1,
    tech: 2, silicon: 2, wifi: 1, bluetooth: 1, usb: 1, hdmi: 1,
    encryption: 2, firewall: 2, malware: 2, hacker: 2, vulnerability: 2,
    opensource: 2, devops: 2, kubernetes: 2, docker: 2, microservice: 2,
    framework: 2, library: 1, sdk: 2, debugging: 2, compiler: 2,
    frontend: 2, backend: 2, fullstack: 2, deploy: 1, repository: 1,
    pixel: 1, resolution: 1, bandwidth: 1, latency: 1, throughput: 1,
    neural: 2, deepfake: 2, robotics: 2, automation: 1, iot: 2,
    saas: 2, paas: 2, virtualization: 2, firmware: 2, bios: 1,
    touchscreen: 1, display: 1, monitor: 1, keyboard: 1,
    '5g': 2, fiber: 1, ethernet: 1, vpn: 2, proxy: 1,
  },
  business: {
    company: 2, ceo: 3, revenue: 3, profit: 3, market: 2, industry: 2,
    enterprise: 2, startup: 2, investor: 2, acquisition: 3, merger: 3,
    quarterly: 2, growth: 2, strategy: 2, management: 2, leadership: 2,
    corporate: 2, shareholder: 2, stakeholder: 2, valuation: 3, ipo: 3,
    entrepreneur: 2, founder: 2, executive: 2, director: 1, board: 1,
    partnership: 2, venture: 2, franchise: 2, subsidiary: 2, conglomerate: 2,
    branding: 2, marketing: 2, sales: 2, supply: 1, chain: 1,
    logistics: 2, procurement: 2, inventory: 1, wholesale: 1, retail: 1,
    b2b: 2, b2c: 2, saas: 1, scalability: 1, monetization: 2,
    layoff: 2, hiring: 2, workforce: 2, employee: 1, hr: 1,
    consultant: 1, advisory: 1, restructuring: 2, bankruptcy: 3,
    compliance: 1, regulation: 1, antitrust: 3, monopoly: 2,
    roi: 2, kpi: 2, quarterly: 2, annual: 1, fiscal: 2,
    cfo: 3, coo: 3, cto: 2, vp: 1, svp: 1,
    pitch: 1, funding: 2, seed: 1, series: 1, unicorn: 2,
    ecommerce: 2, marketplace: 2, platform: 1, disruption: 2,
    outsourcing: 2, offshoring: 2, vendor: 1, contract: 1,
  },
  health: {
    medical: 3, doctor: 3, hospital: 3, disease: 3, treatment: 3, health: 3,
    vaccine: 3, surgery: 3, patient: 3, symptom: 2, diagnosis: 2, therapy: 2,
    nutrition: 2, exercise: 2, wellness: 2, medication: 3, drug: 2,
    prescription: 2, dosage: 2, clinical: 3, trial: 2, pharmaceutical: 3,
    cancer: 3, diabetes: 3, cardiovascular: 3, respiratory: 2, neurological: 2,
    mental: 2, anxiety: 2, depression: 2, stress: 1, burnout: 1,
    immune: 2, antibody: 3, virus: 3, bacteria: 2, infection: 2,
    pandemic: 3, epidemic: 3, outbreak: 2, quarantine: 2, contagious: 2,
    nurse: 2, physician: 3, surgeon: 3, specialist: 1, dermatologist: 3,
    cardiologist: 3, pediatrician: 3, psychiatrist: 3, therapist: 2,
    organ: 2, transplant: 3, prosthetic: 2, rehabilitation: 2, recovery: 1,
    diet: 2, vitamin: 2, supplement: 2, protein: 1, calorie: 2,
    allergy: 2, asthma: 2, cholesterol: 2, blood: 1, pressure: 1,
    yoga: 1, meditation: 1, mindfulness: 1, fitness: 2, gym: 1,
    cdc: 3, who: 2, fda: 3, nih: 3, nhs: 3,
    bmi: 2, heartrate: 2, pulse: 1, fever: 2, cough: 1,
    chronic: 2, acute: 2, benign: 2, malignant: 3, tumor: 3,
  },
  sports: {
    game: 2, team: 2, player: 3, coach: 3, score: 3, championship: 3,
    league: 3, tournament: 3, athlete: 3, soccer: 3, football: 3,
    basketball: 3, baseball: 3, tennis: 3, cricket: 3, rugby: 3,
    hockey: 3, golf: 3, swimming: 2, boxing: 3, wrestling: 2,
    olympics: 3, fifa: 3, nba: 3, nfl: 3, mlb: 3, nhl: 3,
    uefa: 3, epl: 3, laliga: 3, bundesliga: 3, serie: 1,
    stadium: 3, arena: 2, pitch: 2, court: 2, field: 1,
    referee: 3, umpire: 3, foul: 2, penalty: 2, offside: 3,
    goal: 2, touchdown: 3, homerun: 3, slam: 2, ace: 2,
    medal: 2, trophy: 2, mvp: 3, rookie: 2, veteran: 1,
    halftime: 3, overtime: 2, playoff: 3, semifinal: 3, final: 1,
    transfer: 2, draft: 2, trade: 1, contract: 1, salary: 1,
    sprint: 2, marathon: 3, relay: 2, triathlon: 3, decathlon: 3,
    batting: 2, pitching: 2, dribble: 2, tackle: 2, serve: 1,
    goalkeeper: 3, striker: 3, midfielder: 3, defender: 2, quarterback: 3,
    inning: 3, quarter: 1, set: 1, match: 2, round: 1,
    comeback: 2, upset: 2, underdog: 2, rivalry: 2, derby: 2,
    fitness: 1, training: 1, workout: 1, warmup: 1,
  },
  entertainment: {
    movie: 3, film: 3, actor: 3, actress: 3, music: 3, song: 3,
    album: 3, concert: 3, celebrity: 3, streaming: 2, netflix: 3,
    disney: 3, hollywood: 3, grammy: 3, oscar: 3, emmy: 3,
    broadway: 3, theater: 2, theatre: 2, comedy: 2, drama: 2,
    horror: 2, thriller: 2, romance: 1, animation: 2, anime: 2,
    director: 2, producer: 2, screenwriter: 3, soundtrack: 3,
    blockbuster: 3, sequel: 2, prequel: 2, franchise: 1, reboot: 2,
    premiere: 2, release: 1, trailer: 2, teaser: 2, spoiler: 2,
    box: 1, office: 1, ratings: 1, review: 1, critic: 2,
    podcast: 2, youtube: 2, tiktok: 2, instagram: 1, viral: 2,
    singer: 3, rapper: 3, band: 2, dj: 2, genre: 1,
    pop: 2, rock: 2, hiphop: 2, jazz: 2, classical: 1,
    spotify: 2, itunes: 2, billboard: 3, chart: 1, hit: 1,
    performance: 1, show: 1, series: 1, episode: 2, season: 1,
    standup: 2, comedian: 3, sketch: 1, improv: 2,
    paparazzi: 3, tabloid: 2, gossip: 2, scandal: 1,
    hulu: 2, hbo: 2, paramount: 2, amazon: 1, peacock: 2,
    binge: 2, bingewatch: 3, marathon: 1, cliffhanger: 2,
    casting: 2, audition: 2, cameo: 2, voiceover: 2,
  },
  science: {
    research: 3, study: 3, experiment: 3, discovery: 3, theory: 2,
    physics: 3, chemistry: 3, biology: 3, dna: 3, space: 3,
    nasa: 3, planet: 3, quantum: 3, evolution: 2, climate: 2,
    hypothesis: 3, molecule: 3, atom: 3, particle: 3, electron: 3,
    proton: 3, neutron: 3, photon: 3, quark: 3, boson: 3,
    genome: 3, gene: 3, protein: 2, cell: 2, organism: 2,
    species: 2, fossil: 3, paleontology: 3, archaeology: 3,
    telescope: 3, microscope: 3, laboratory: 2, lab: 1, peer: 1,
    journal: 2, publication: 1, thesis: 2, dissertation: 2,
    galaxy: 3, nebula: 3, supernova: 3, blackhole: 3, cosmos: 3,
    mars: 2, jupiter: 2, saturn: 2, asteroid: 3, comet: 3,
    gravity: 2, relativity: 3, thermodynamics: 3, entropy: 3,
    electromagnetic: 3, wavelength: 2, frequency: 1, spectrum: 2,
    ecosystem: 2, biodiversity: 3, extinction: 2, conservation: 1,
    geologist: 3, botanist: 3, zoologist: 3, chemist: 3, physicist: 3,
    cern: 3, hadron: 3, collider: 3, fusion: 3, fission: 3,
    catalyst: 2, reaction: 1, compound: 1, element: 1, periodic: 2,
    neuroscience: 3, cognitive: 2, synapse: 3, cortex: 3,
    esa: 3, spacex: 2, rover: 3, satellite: 2, orbit: 2,
  },
  politics: {
    president: 3, congress: 3, senator: 3, election: 3, vote: 3,
    policy: 3, government: 3, democrat: 3, republican: 3, legislation: 3,
    law: 2, campaign: 3, party: 2, parliament: 3, prime: 2,
    minister: 2, cabinet: 2, amendment: 3, constitution: 3, bill: 2,
    bipartisan: 3, partisan: 3, caucus: 3, filibuster: 3, veto: 3,
    lobby: 2, lobbyist: 3, pac: 3, superpac: 3, donation: 1,
    ballot: 3, poll: 2, swing: 1, battleground: 2, electoral: 3,
    delegate: 2, convention: 2, primary: 2, midterm: 3, runoff: 3,
    diplomat: 3, diplomacy: 3, embassy: 3, ambassador: 3, treaty: 3,
    sanctions: 3, tariff: 2, geopolitics: 3, sovereignty: 3,
    liberal: 2, conservative: 2, progressive: 2, moderate: 1,
    left: 1, right: 1, wing: 1, centrist: 2, populist: 2,
    referendum: 3, impeachment: 3, inauguration: 3, administration: 2,
    governor: 3, mayor: 2, council: 1, legislature: 3, judiciary: 3,
    supreme: 2, court: 1, justice: 1, ruling: 2, verdict: 1,
    un: 2, nato: 3, eu: 2, g7: 3, g20: 3,
    protest: 2, rally: 2, demonstration: 2, activism: 2, activist: 2,
    democracy: 3, autocracy: 3, dictatorship: 3, regime: 2,
    voter: 2, turnout: 2, redistricting: 3, gerrymandering: 3,
  },
  finance: {
    stock: 3, investment: 3, bank: 3, trading: 3, portfolio: 3,
    cryptocurrency: 3, bitcoin: 3, inflation: 3, interest: 2, rate: 1,
    dow: 3, nasdaq: 3, forex: 3, commodity: 3, futures: 3,
    bond: 3, treasury: 3, yield: 2, dividend: 3, equity: 2,
    hedge: 2, fund: 2, mutual: 2, etf: 3, index: 1,
    bullish: 3, bearish: 3, rally: 2, correction: 2, crash: 2,
    recession: 3, depression: 2, gdp: 3, deficit: 3, debt: 2,
    mortgage: 3, loan: 2, credit: 2, debit: 1, savings: 1,
    fed: 2, federal: 1, reserve: 1, monetary: 3, fiscal: 2,
    sec: 3, fintech: 3, insurtech: 2, neobank: 2,
    ipo: 3, spac: 3, listing: 1, delisting: 2, float: 1,
    earnings: 3, revenue: 2, margin: 2, ebitda: 3, pe: 2,
    valuation: 2, capitalization: 2, liquidity: 2, volatility: 3,
    forex: 3, currency: 2, dollar: 1, euro: 1, yen: 1, yuan: 1,
    blockchain: 2, ethereum: 3, defi: 3, nft: 2, altcoin: 3,
    broker: 2, trader: 2, analyst: 1, advisor: 1, fiduciary: 3,
    retirement: 1, pension: 2, annuity: 3, ira: 2, roth: 2,
    derivative: 3, option: 2, warrant: 2, swap: 2, arbitrage: 3,
    insider: 2, short: 1, squeeze: 2, margin: 2, leverage: 2,
  },
  education: {
    school: 3, student: 3, teacher: 3, university: 3, college: 3,
    degree: 3, curriculum: 3, exam: 3, course: 3, learning: 2,
    academic: 3, professor: 3, graduation: 3, scholarship: 3,
    classroom: 3, lecture: 2, seminar: 2, tutorial: 1, workshop: 1,
    enrollment: 3, admissions: 3, tuition: 3, financial: 1, aid: 1,
    gpa: 3, sat: 3, act: 2, gre: 3, gmat: 3, mcat: 3, lsat: 3,
    thesis: 2, dissertation: 2, research: 1, publish: 1,
    bachelor: 3, master: 2, doctorate: 3, phd: 3, mba: 3,
    campus: 3, dormitory: 3, dorm: 2, dean: 3, provost: 3,
    kindergarten: 3, elementary: 2, middle: 1, high: 1,
    preschool: 3, homeschool: 3, charter: 2, magnet: 2, boarding: 2,
    algebra: 2, calculus: 2, geometry: 2, literature: 2, biology: 1,
    syllabus: 3, textbook: 3, homework: 3, assignment: 2, quiz: 2,
    principal: 2, superintendent: 3, faculty: 3, tenure: 3, adjunct: 3,
    extracurricular: 3, varsity: 2, valedictorian: 3, salutatorian: 3,
    literacy: 2, numeracy: 2, pedagogy: 3, montessori: 3, stem: 2,
    elearning: 3, mooc: 3, coursera: 2, edtech: 3, lms: 3,
    diploma: 3, certificate: 2, credential: 2, accreditation: 3,
    ivy: 2, league: 1, oxford: 2, cambridge: 2, harvard: 2, mit: 2,
  },
  travel: {
    flight: 3, hotel: 3, destination: 3, vacation: 3, tourism: 3,
    passport: 3, airport: 3, booking: 2, beach: 2, resort: 3,
    cruise: 3, backpack: 2, visa: 2, itinerary: 3, excursion: 3,
    luggage: 2, suitcase: 2, baggage: 2, boarding: 1, pass: 1,
    airline: 3, airways: 3, jetlag: 3, layover: 3, connecting: 1,
    hostel: 3, airbnb: 3, motel: 2, inn: 1, lodge: 2,
    sightseeing: 3, landmark: 2, monument: 2, attraction: 2, museum: 1,
    safari: 3, trek: 2, hiking: 2, camping: 1, roadtrip: 3,
    souvenir: 2, postcard: 2, guidebook: 2, lonely: 1, planet: 1,
    archipelago: 3, island: 2, peninsula: 2, coastline: 2, harbor: 1,
    departure: 2, arrival: 1, terminal: 1, customs: 2, immigration: 1,
    currency: 1, exchange: 1, traveler: 3, tourist: 3, pilgrim: 2,
    expedition: 3, voyage: 2, journey: 1, adventure: 1, wanderlust: 3,
    paris: 2, london: 1, tokyo: 1, rome: 1, bali: 2, dubai: 2,
    caribbean: 2, mediterranean: 2, pacific: 1, atlantic: 1,
    firstclass: 2, business: 1, economy: 1, upgrade: 1,
    allinclusive: 3, package: 1, getaway: 2, retreat: 1,
    snorkeling: 2, scuba: 2, surfing: 1, kayaking: 1, zipline: 2,
    concierge: 2, checkout: 1, checkin: 1, reservation: 2,
  },
};

const TOPIC_PHRASES: Record<Topic, [string, number][]> = {
  technology: [
    ["artificial intelligence", 3], ["machine learning", 3], ["deep learning", 3],
    ["open source", 2], ["data science", 2], ["big data", 2],
    ["cloud computing", 3], ["edge computing", 2], ["quantum computing", 3],
    ["virtual reality", 3], ["augmented reality", 3], ["mixed reality", 2],
    ["self driving", 3], ["autonomous vehicle", 3], ["electric vehicle", 2],
    ["natural language processing", 3], ["computer vision", 3],
    ["internet of things", 3], ["smart home", 2], ["smart city", 2],
    ["tech giant", 2], ["silicon valley", 3], ["tech industry", 2],
    ["web development", 2], ["mobile app", 2], ["operating system", 2],
  ],
  business: [
    ["supply chain", 3], ["venture capital", 3], ["private equity", 3],
    ["market share", 2], ["profit margin", 2], ["bottom line", 2],
    ["board of directors", 3], ["chief executive", 3], ["annual report", 2],
    ["small business", 2], ["fortune 500", 3], ["wall street", 2],
    ["going public", 2], ["due diligence", 3], ["hostile takeover", 3],
    ["joint venture", 2], ["market cap", 2], ["burn rate", 2],
  ],
  health: [
    ["mental health", 3], ["public health", 3], ["clinical trial", 3],
    ["side effect", 2], ["blood pressure", 2], ["heart disease", 3],
    ["immune system", 2], ["health care", 2], ["healthcare system", 2],
    ["world health organization", 3], ["centers for disease control", 3],
    ["emergency room", 2], ["intensive care", 3], ["primary care", 2],
    ["weight loss", 2], ["body mass index", 2], ["chronic pain", 2],
    ["substance abuse", 2], ["eating disorder", 3], ["sleep disorder", 2],
  ],
  sports: [
    ["world cup", 3], ["super bowl", 3], ["world series", 3],
    ["grand slam", 3], ["premier league", 3], ["champions league", 3],
    ["all star", 2], ["hall of fame", 3], ["record breaking", 2],
    ["injury report", 2], ["starting lineup", 2], ["game winning", 2],
    ["hat trick", 3], ["free throw", 2], ["home run", 3],
    ["yellow card", 3], ["red card", 3], ["penalty kick", 3],
    ["extra time", 2], ["injury time", 2], ["full time", 1],
  ],
  entertainment: [
    ["box office", 3], ["tv show", 3], ["reality tv", 3],
    ["red carpet", 3], ["award show", 3], ["music video", 3],
    ["social media", 1], ["fan base", 2], ["world tour", 3],
    ["opening weekend", 3], ["post credits", 3], ["end credits", 2],
    ["film festival", 3], ["cannes film", 3], ["sundance film", 3],
    ["golden globe", 3], ["best picture", 3], ["best actor", 3],
    ["chart topping", 3], ["number one hit", 3], ["debut album", 3],
  ],
  science: [
    ["peer reviewed", 3], ["controlled experiment", 3], ["double blind", 3],
    ["scientific method", 3], ["big bang", 3], ["dark matter", 3],
    ["dark energy", 3], ["black hole", 3], ["climate change", 2],
    ["global warming", 2], ["greenhouse gas", 2], ["carbon dioxide", 2],
    ["genetic engineering", 3], ["stem cell", 3], ["gene editing", 3],
    ["crispr cas9", 3], ["particle accelerator", 3], ["higgs boson", 3],
    ["periodic table", 3], ["string theory", 3], ["standard model", 3],
    ["hubble telescope", 3], ["james webb", 3], ["international space station", 3],
  ],
  politics: [
    ["white house", 3], ["capitol hill", 3], ["oval office", 3],
    ["executive order", 3], ["state of the union", 3], ["foreign policy", 3],
    ["domestic policy", 3], ["gun control", 3], ["immigration reform", 3],
    ["climate policy", 2], ["tax reform", 2], ["healthcare bill", 2],
    ["supreme court", 3], ["civil rights", 3], ["human rights", 2],
    ["political party", 3], ["swing state", 3], ["electoral college", 3],
    ["national security", 2], ["homeland security", 3],
    ["united nations", 3], ["european union", 2],
  ],
  finance: [
    ["stock market", 3], ["wall street", 3], ["interest rate", 3],
    ["hedge fund", 3], ["mutual fund", 3], ["exchange traded", 3],
    ["dow jones", 3], ["s&p 500", 3], ["s&p500", 3],
    ["federal reserve", 3], ["central bank", 3], ["monetary policy", 3],
    ["bear market", 3], ["bull market", 3], ["market crash", 3],
    ["price target", 2], ["earnings call", 3], ["annual return", 2],
    ["credit score", 2], ["debt ceiling", 3], ["fiscal cliff", 3],
    ["initial public offering", 3], ["day trading", 3],
  ],
  education: [
    ["higher education", 3], ["student loan", 3], ["financial aid", 2],
    ["ivy league", 3], ["public school", 2], ["private school", 2],
    ["community college", 3], ["graduate school", 3],
    ["distance learning", 3], ["online course", 2], ["online learning", 2],
    ["common core", 3], ["standardized test", 3], ["entrance exam", 3],
    ["class size", 2], ["teacher shortage", 3], ["school district", 2],
    ["study abroad", 3], ["exchange program", 2], ["gap year", 2],
    ["dean's list", 3], ["cum laude", 3], ["summa cum laude", 3],
  ],
  travel: [
    ["round trip", 3], ["one way", 1], ["travel insurance", 3],
    ["travel advisory", 3], ["all inclusive", 3], ["bed and breakfast", 3],
    ["road trip", 3], ["world heritage", 3], ["national park", 2],
    ["frequent flyer", 3], ["travel ban", 3], ["border crossing", 2],
    ["duty free", 2], ["jet lag", 3], ["time zone", 1],
    ["carry on", 2], ["checked bag", 2], ["overhead bin", 2],
    ["travel guide", 2], ["bucket list", 2], ["off the beaten path", 3],
    ["tourist trap", 2], ["hidden gem", 2], ["local cuisine", 2],
  ],
};

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9'\s&]/g, ' ').split(/\s+/).filter(Boolean);
}

export function classifyTopic(text: string): TopicResult {
  const lower = text.toLowerCase();
  const words = tokenize(text);

  const scores = {} as Record<Topic, number>;
  const signalMap = {} as Record<Topic, string[]>;

  for (const topic of Object.keys(TOPICS) as Topic[]) {
    let score = 0;
    const signals: string[] = [];
    const seen = new Set<string>();

    // Word scoring
    const dict = TOPICS[topic];
    for (const w of words) {
      if (dict[w] && !seen.has(w)) {
        score += dict[w];
        signals.push(w);
        seen.add(w);
      }
    }

    // Phrase scoring
    const phrases = TOPIC_PHRASES[topic];
    for (const [phrase, weight] of phrases) {
      if (lower.includes(phrase)) {
        score += weight;
        signals.push(phrase);
      }
    }

    scores[topic] = score;
    signalMap[topic] = signals;
  }

  // Find top two
  const sorted = (Object.entries(scores) as [Topic, number][])
    .sort((a, b) => b[1] - a[1]);

  const [topTopic, topScore] = sorted[0];
  const [secondTopic, secondScore] = sorted[1];

  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
  const confidence = totalScore > 0
    ? Math.min(topScore / Math.max(totalScore, 1), 1)
    : 0;

  // Secondary topic if it has at least 40% of the primary score and at least 2 points
  const secondary = (secondScore >= topScore * 0.4 && secondScore >= 2) ? secondTopic : null;

  // Normalize scores to 0-1
  const normalizedScores = {} as Record<Topic, number>;
  for (const [topic, score] of Object.entries(scores) as [Topic, number][]) {
    normalizedScores[topic] = totalScore > 0 ? Math.round((score / totalScore) * 100) / 100 : 0;
  }

  return {
    topic: topTopic,
    secondary,
    confidence: Math.round(confidence * 100) / 100,
    scores: normalizedScores,
    signals: signalMap[topTopic],
  };
}
