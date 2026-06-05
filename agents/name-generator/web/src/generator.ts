/**
 * Name Generator — Markov chain character name generation engine.
 * Generates fantasy, sci-fi, medieval, and cultural character names.
 * Separate Markov tables per genre/race/gender, built from curated corpora.
 */

export interface GeneratorOptions {
  genre: 'fantasy' | 'scifi' | 'medieval' | 'modern' | 'japanese' | 'nordic' | 'arabic' | 'african';
  race?: 'human' | 'elf' | 'dwarf' | 'orc' | 'dragon' | 'demon' | 'angel' | 'fairy';
  gender?: 'male' | 'female' | 'neutral';
  length?: 'short' | 'medium' | 'long';
}

export interface GeneratedName {
  name: string;
  surname: string | null;
  full: string;
  epithet: string | null;
  meaning: string | null;
}

// ── Seed corpora ────────────────────────────────────────────────────
// Each corpus is { male: string[], female: string[], neutral: string[] }

interface Corpus {
  male: string[];
  female: string[];
  neutral: string[];
}

const FANTASY_HUMAN: Corpus = {
  male: [
    'Arthas', 'Geralt', 'Anduin', 'Kael', 'Varian', 'Lothar', 'Tirion', 'Uther',
    'Tyrael', 'Garen', 'Darius', 'Tryndamere', 'Jarvan', 'Lucian', 'Taric',
    'Conan', 'Corwin', 'Elric', 'Gareth', 'Roland', 'Cedric', 'Aldric', 'Beric',
    'Theron', 'Caspian', 'Hadrian', 'Renly', 'Stannis', 'Eddard', 'Robb',
    'Brandon', 'Jaime', 'Oberyn', 'Sandor', 'Gregor', 'Barristan', 'Davos',
    'Aragon', 'Boromir', 'Faramir', 'Theoden', 'Eomer', 'Hector', 'Tristan',
    'Garrick', 'Aldwin', 'Edric', 'Osric', 'Godric', 'Alaric', 'Darian',
    'Marcus', 'Lucius', 'Caius', 'Tiberius', 'Maximus', 'Decimus',
  ],
  female: [
    'Jaina', 'Sylvanas', 'Tyrande', 'Yrel', 'Moira', 'Talia', 'Elara',
    'Isolde', 'Rowena', 'Morgana', 'Igraine', 'Nimue', 'Viviane', 'Fiora',
    'Triss', 'Yennefer', 'Ciri', 'Cersei', 'Daenerys', 'Sansa', 'Arya',
    'Brienne', 'Catelyn', 'Margaery', 'Olenna', 'Lyanna', 'Ashara',
    'Selene', 'Aurora', 'Celeste', 'Rosalind', 'Eveline', 'Seraphina',
    'Cordelia', 'Ophelia', 'Cassandra', 'Adriana', 'Valentina', 'Livia',
    'Eloise', 'Genevieve', 'Gwendolyn', 'Beatrix', 'Thalia', 'Marian',
    'Helena', 'Calista', 'Lysandra', 'Thessaly', 'Aelina', 'Rhiannon',
  ],
  neutral: [
    'Ashton', 'Rowan', 'Quinn', 'Sage', 'Raven', 'Wren', 'Finley',
    'Avery', 'Morgan', 'Rune', 'Storm', 'Ember', 'Phoenix', 'Onyx',
    'Skyler', 'Reese', 'Blair', 'Haven', 'Seren', 'Linden', 'Briar',
  ],
};

const FANTASY_ELF: Corpus = {
  male: [
    'Legolas', 'Elrond', 'Thranduil', 'Celeborn', 'Glorfindel', 'Finrod',
    'Feanor', 'Fingolfin', 'Turgon', 'Maglor', 'Caranthir', 'Cirdan',
    'Haldir', 'Rumil', 'Orophin', 'Aegnor', 'Amras', 'Amrod',
    'Lindir', 'Erestor', 'Gildor', 'Beleg', 'Mablung', 'Daeron',
    'Ecthelion', 'Tuor', 'Voronwe', 'Saeros', 'Nellas', 'Oropher',
    'Aranwe', 'Elendir', 'Galadhor', 'Luthien', 'Nimrodel', 'Aerandir',
    'Galathil', 'Amroth', 'Thingol', 'Denethor', 'Enerdhil', 'Annael',
    'Guilin', 'Gelmir', 'Arminas', 'Ingwion', 'Amarth', 'Celebrimbor',
    'Curufin', 'Celegorm', 'Maeglin', 'Idril', 'Earendil', 'Elwing',
  ],
  female: [
    'Galadriel', 'Arwen', 'Tauriel', 'Luthien', 'Nimrodel', 'Idril',
    'Elwing', 'Aredhel', 'Finduilas', 'Nerdanel', 'Miriel', 'Nienna',
    'Alatariel', 'Artanis', 'Celebrian', 'Morwen', 'Elanor', 'Ithilwen',
    'Silinde', 'Anariel', 'Nimloth', 'Vanime', 'Earwen', 'Anaire',
    'Lalaith', 'Nellas', 'Melian', 'Varda', 'Yavanna', 'Nessa',
    'Aerin', 'Gilraen', 'Lothiriel', 'Eowyn', 'Ivorwen', 'Minaethiel',
    'Amarie', 'Tinuviel', 'Elbereth', 'Ilmare', 'Erendis', 'Lindorie',
    'Almarian', 'Inzilbeth', 'Beruthiel', 'Caladwen', 'Silivren',
    'Elerrina', 'Falathiel', 'Galadwen', 'Tindome', 'Merenwen',
  ],
  neutral: [
    'Aerin', 'Celebrin', 'Ithil', 'Lorien', 'Silvan', 'Thalion',
    'Elessar', 'Niniel', 'Ancalime', 'Elemmire', 'Tilion', 'Olorin',
  ],
};

const FANTASY_DWARF: Corpus = {
  male: [
    'Thorin', 'Gimli', 'Balin', 'Dwalin', 'Bifur', 'Bofur', 'Bombur',
    'Fili', 'Kili', 'Oin', 'Gloin', 'Dori', 'Nori', 'Ori',
    'Bruenor', 'Khelgar', 'Torbin', 'Dagnal', 'Gardain', 'Harbek',
    'Thordek', 'Rurik', 'Dolgrin', 'Karrag', 'Moradin', 'Durin',
    'Dain', 'Thror', 'Thrain', 'Fundin', 'Groin', 'Nain', 'Farin',
    'Borin', 'Floi', 'Frerin', 'Gror', 'Loni', 'Nar', 'Mim',
    'Brok', 'Dvalinn', 'Norri', 'Sindri', 'Austri', 'Vestri',
    'Hrothgar', 'Tormund', 'Brokk', 'Eitri', 'Ivaldi', 'Andvari',
  ],
  female: [
    'Dis', 'Helga', 'Morda', 'Kathra', 'Ilde', 'Dagma', 'Berda',
    'Thurga', 'Gretta', 'Hilda', 'Vistra', 'Kethra', 'Bardryn',
    'Diesa', 'Falkrunn', 'Gunnloda', 'Helja', 'Sannl', 'Torbera',
    'Artin', 'Audhild', 'Dagnal', 'Eldeth', 'Gurdis', 'Liftrasa',
    'Riswynn', 'Torgga', 'Anbera', 'Brynja', 'Ingra', 'Mardred',
    'Thala', 'Kira', 'Bera', 'Groa', 'Sigrun', 'Bodil', 'Jord',
    'Gerta', 'Runia', 'Frida', 'Astrid', 'Brunhild', 'Sigrid',
  ],
  neutral: [
    'Durin', 'Flint', 'Granite', 'Onyx', 'Forge', 'Anvil', 'Stone',
    'Iron', 'Cobalt', 'Basalt', 'Ember', 'Cinder',
  ],
};

const FANTASY_ORC: Corpus = {
  male: [
    'Grommash', 'Thrall', 'Garrosh', 'Durotan', 'Orgrim', 'Guldaan',
    'Kilrogg', 'Nazgrel', 'Saurfang', 'Broxigar', 'Rexxar', 'Gromm',
    'Zuljin', 'Voljin', 'Rokhan', 'Zekhan', 'Urgot', 'Gruumsh',
    'Ilneval', 'Baghtru', 'Shargaas', 'Yurtrus', 'Luthic',
    'Azog', 'Bolg', 'Gothmog', 'Lurtz', 'Ugluk', 'Grishnakh',
    'Muzgash', 'Lagduf', 'Radbug', 'Shagrat', 'Gorbag', 'Snaga',
    'Ufthak', 'Mauhur', 'Gorgol', 'Balcmeg', 'Korgul', 'Durgash',
    'Moktar', 'Nagrub', 'Skullak', 'Thokk', 'Orghuz', 'Grukk',
    'Vargul', 'Zaggoth', 'Kruul', 'Drekthar',
  ],
  female: [
    'Draka', 'Garona', 'Griselda', 'Aggra', 'Zaela',
    'Borgakh', 'Lash', 'Urzoga', 'Ghorbash', 'Sharamash',
    'Gashna', 'Murga', 'Yagak', 'Shel', 'Emen', 'Sutha',
    'Baggi', 'Olta', 'Ovak', 'Vola', 'Grula', 'Neega',
    'Bula', 'Ruga', 'Mogra', 'Gurza', 'Kasha', 'Tugba',
    'Durga', 'Grisha', 'Morag', 'Urgha', 'Zulgha', 'Brukka',
  ],
  neutral: [
    'Thrash', 'Grok', 'Skar', 'Blud', 'Morg', 'Krag', 'Zug',
    'Thok', 'Grul', 'Vrak', 'Snarl', 'Gore',
  ],
};

const FANTASY_DRAGON: Corpus = {
  male: [
    'Alduin', 'Paarthurnax', 'Smaug', 'Balerion', 'Vhagar', 'Meraxes',
    'Drogon', 'Rhaegal', 'Viserion', 'Ancalagon', 'Glaurung', 'Shenron',
    'Deathwing', 'Alexstrasza', 'Neltharion', 'Malygos', 'Nozdormu',
    'Ysera', 'Kalecgos', 'Ebyssian', 'Wrathion', 'Sabellian',
    'Tiamat', 'Bahamut', 'Nicol', 'Chromatus', 'Galakrond',
    'Vermithrax', 'Ignarius', 'Volcanus', 'Pyraxes', 'Drakonis',
    'Typhon', 'Rhaegos', 'Zarathos', 'Xarion', 'Netheras',
  ],
  female: [
    'Alexstrasza', 'Ysera', 'Sindragosa', 'Onyxia', 'Syrax',
    'Meleys', 'Dreamfyre', 'Sunfyre', 'Tessarion', 'Moondancer',
    'Silvara', 'Kirygosa', 'Tarecgosa', 'Selendrile',
    'Pyralia', 'Ignissa', 'Shimmerscale', 'Aethera', 'Celestrix',
    'Draconia', 'Aurelia', 'Umbralys', 'Crysthia', 'Zephyrix',
  ],
  neutral: [
    'Blaze', 'Cinder', 'Ash', 'Ember', 'Frostfang', 'Stormwing',
    'Shadowfire', 'Thunderclaw', 'Starscale', 'Nightflame',
  ],
};

const FANTASY_DEMON: Corpus = {
  male: [
    'Archimonde', 'Mannoroth', 'Tichondrius', 'Kiljaedan',
    'Mephisto', 'Diablo', 'Baal', 'Belial', 'Azmodan',
    'Balthazar', 'Asmodeus', 'Baphomet', 'Orcus', 'Demogorgon',
    'Fraz', 'Grazzt', 'Juiblex', 'Yeenoghu', 'Zuggtmoy',
    'Malchor', 'Xarthon', 'Nihilus', 'Vortigon', 'Zarakiel',
    'Infernus', 'Mordrek', 'Abaddon', 'Azazel', 'Samael',
    'Malphas', 'Phenex', 'Forneus', 'Marchosias', 'Caim',
  ],
  female: [
    'Lilith', 'Succorbenoth', 'Agrat', 'Naamah', 'Eisheth',
    'Lamashtu', 'Hecate', 'Tiamat', 'Echidna', 'Empusa',
    'Marilith', 'Nocticula', 'Malcanthet', 'Pale', 'Shami',
    'Vexoria', 'Nethys', 'Sythara', 'Morgathis', 'Xelnaga',
    'Desdemona', 'Ravenna', 'Obsidara', 'Nyxara', 'Inferna',
  ],
  neutral: [
    'Shadow', 'Void', 'Nether', 'Abyssal', 'Doom', 'Dread',
    'Blight', 'Scourge', 'Ruin', 'Havoc', 'Chaos', 'Malice',
  ],
};

const FANTASY_ANGEL: Corpus = {
  male: [
    'Michael', 'Gabriel', 'Raphael', 'Uriel', 'Azrael', 'Metatron',
    'Chamuel', 'Jophiel', 'Zadkiel', 'Haniel', 'Raziel', 'Sandalphon',
    'Seraphiel', 'Barachiel', 'Sachiel', 'Cassiel', 'Ithuriel',
    'Abdiel', 'Zaphkiel', 'Raguel', 'Sariel', 'Remiel', 'Puriel',
    'Tyrael', 'Imperius', 'Malthael', 'Auriel', 'Itherael',
    'Celestius', 'Luminos', 'Solarius', 'Aethon', 'Diviniel',
  ],
  female: [
    'Auriel', 'Seraphina', 'Celestia', 'Ariel', 'Gabrielle',
    'Michaela', 'Raphaela', 'Iridiel', 'Lumina', 'Solara',
    'Aetheria', 'Gloriana', 'Sanctiel', 'Radiance', 'Zephyriel',
    'Harmonia', 'Felicity', 'Mercy', 'Grace', 'Clarity',
    'Sereniel', 'Amaliel', 'Thaliel', 'Veradiel', 'Luminael',
  ],
  neutral: [
    'Light', 'Dawn', 'Halo', 'Virtue', 'Blessing', 'Radiant',
    'Divine', 'Sacred', 'Ethereal', 'Celestine', 'Solace', 'Haven',
  ],
};

const FANTASY_FAIRY: Corpus = {
  male: [
    'Oberon', 'Puck', 'Peaseblossom', 'Cobweb', 'Mustardseed',
    'Tithonus', 'Alberich', 'Erlking', 'Finvarra', 'Midir',
    'Tam', 'Robin', 'Sprite', 'Alder', 'Thistle', 'Bramble',
    'Fernwhistle', 'Dewdrop', 'Glimmer', 'Sparkle', 'Zephyr',
    'Foxglove', 'Clover', 'Basil', 'Thyme', 'Moss', 'Bracken',
  ],
  female: [
    'Titania', 'Tinkerbell', 'Peaseblossom', 'Mab', 'Maeve',
    'Aine', 'Niamh', 'Cliodhna', 'Fand', 'Leannan', 'Aoibhinn',
    'Dew', 'Petal', 'Blossom', 'Fern', 'Willow', 'Ivy',
    'Luna', 'Stella', 'Fleur', 'Rosalind', 'Meadow', 'Dahlia',
    'Lark', 'Wren', 'Maple', 'Hazel', 'Violet', 'Primrose',
  ],
  neutral: [
    'Breeze', 'Shimmer', 'Flutter', 'Glow', 'Spark', 'Ripple',
    'Whisper', 'Twig', 'Leaf', 'Bloom', 'Mist', 'Dusk',
  ],
};

const SCIFI: Corpus = {
  male: [
    'Zephyr', 'Kael', 'Nexus', 'Vorix', 'Thane', 'Rexar',
    'Xylan', 'Corvus', 'Draven', 'Cipher', 'Axion', 'Zenith',
    'Orion', 'Cygnus', 'Vega', 'Altair', 'Rigel', 'Sirius',
    'Arcturus', 'Pollux', 'Castor', 'Aldebaran', 'Antares',
    'Zoltan', 'Kryptex', 'Vortahn', 'Syntar', 'Nexara', 'Quasar',
    'Pulsar', 'Xander', 'Zarek', 'Kael', 'Rykard', 'Soren',
    'Theron', 'Daxton', 'Jaxon', 'Kyren', 'Lyric', 'Onyx',
    'Titan', 'Nova', 'Cosmo', 'Flux', 'Ion', 'Proton',
    'Neutron', 'Vector', 'Matrix', 'Nebula', 'Vertex', 'Helix',
  ],
  female: [
    'Nexara', 'Zephyra', 'Nova', 'Lyra', 'Celestra', 'Synthia',
    'Astraia', 'Nebula', 'Solaris', 'Vexia', 'Xylia', 'Kaida',
    'Andromeda', 'Cassiopeia', 'Electra', 'Helia', 'Iona', 'Prism',
    'Quanta', 'Rhea', 'Stellara', 'Techna', 'Umbra', 'Vera',
    'Zara', 'Aria', 'Echo', 'Siren', 'Calla', 'Elara',
    'Cyra', 'Nyx', 'Theia', 'Selene', 'Phoebe', 'Artemis',
    'Athena', 'Aura', 'Meridia', 'Galaxia', 'Photon', 'Spectra',
  ],
  neutral: [
    'Zero', 'Null', 'Apex', 'Core', 'Flux', 'Glitch', 'Hack',
    'Jolt', 'Nano', 'Pixel', 'Qubit', 'Rogue', 'Spark',
    'Trace', 'Unity', 'Vex', 'Warp', 'Xen', 'Byte', 'Data',
  ],
};

const MEDIEVAL: Corpus = {
  male: [
    'William', 'Edmund', 'Geoffrey', 'Richard', 'Henry', 'Edward',
    'Robert', 'Roger', 'Ralph', 'Walter', 'Hugh', 'Thomas',
    'John', 'Baldwin', 'Stephen', 'Alan', 'Gilbert', 'Simon',
    'Peter', 'Nicholas', 'Adam', 'Philip', 'Bernard', 'Raymond',
    'Godfrey', 'Reginald', 'Humphrey', 'Gervase', 'Ranulf',
    'Oswald', 'Ethelred', 'Leofric', 'Aelfric', 'Wulfstan',
    'Cedric', 'Aldhelm', 'Dunstan', 'Godwin', 'Harold', 'Edgar',
    'Alfred', 'Athelstan', 'Egbert', 'Aethelwulf', 'Offa',
    'Cuthbert', 'Wilfred', 'Anselm', 'Becket', 'Percival',
    'Lancelot', 'Galahad', 'Gawain', 'Tristan', 'Gareth',
  ],
  female: [
    'Eleanor', 'Matilda', 'Isolde', 'Beatrice', 'Margaret',
    'Catherine', 'Elizabeth', 'Isabella', 'Joan', 'Alice',
    'Agnes', 'Cecily', 'Constance', 'Blanche', 'Philippa',
    'Maud', 'Edith', 'Adela', 'Bertha', 'Hildegard',
    'Gisela', 'Heloise', 'Yvette', 'Rosalind', 'Millicent',
    'Guinevere', 'Elaine', 'Vivian', 'Nimue', 'Igraine',
    'Rowena', 'Godiva', 'Aethelflaed', 'Ealdgyth', 'Aldith',
    'Sybil', 'Petronilla', 'Eustacia', 'Aveline', 'Rohese',
    'Clarice', 'Juliana', 'Lettice', 'Thomasina', 'Amice',
    'Hawise', 'Idonea', 'Basilia', 'Gunhild', 'Aldara',
  ],
  neutral: [
    'Robin', 'Avery', 'Ashley', 'Aubrey', 'Jocelyn', 'Hilary',
    'Evelyn', 'Marion', 'Francis', 'Leslie', 'Merle', 'Lindsey',
  ],
};

const MODERN: Corpus = {
  male: [
    'James', 'Oliver', 'Ethan', 'Liam', 'Noah', 'Mason',
    'Logan', 'Lucas', 'Jackson', 'Aiden', 'Sebastian', 'Mateo',
    'Jack', 'Owen', 'Daniel', 'Alexander', 'Elijah', 'Benjamin',
    'Henry', 'Caleb', 'Ryan', 'Nathan', 'Dylan', 'Wyatt',
    'Leo', 'Miles', 'Felix', 'Jasper', 'Oscar', 'Arthur',
    'Theodore', 'Finn', 'Hugo', 'Milo', 'August', 'Arlo',
    'Atlas', 'Silas', 'Ezra', 'Luca', 'Kai', 'River',
    'Asher', 'Rowan', 'Cole', 'Xavier', 'Adrian', 'Ivan',
  ],
  female: [
    'Olivia', 'Emma', 'Sophia', 'Ava', 'Luna', 'Mia',
    'Charlotte', 'Amelia', 'Harper', 'Evelyn', 'Abigail', 'Ella',
    'Scarlett', 'Grace', 'Lily', 'Aria', 'Chloe', 'Zoey',
    'Penelope', 'Layla', 'Riley', 'Nora', 'Camila', 'Hazel',
    'Violet', 'Aurora', 'Savannah', 'Audrey', 'Brooklyn', 'Leah',
    'Stella', 'Maya', 'Isla', 'Willow', 'Ivy', 'Emilia',
    'Jade', 'Piper', 'Sage', 'Ruby', 'Iris', 'Clara',
    'Wren', 'Freya', 'Eloise', 'Mabel', 'June', 'Daisy',
  ],
  neutral: [
    'Riley', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Quinn',
    'Sage', 'Raven', 'Skyler', 'Dakota', 'Reese', 'Blair',
    'Avery', 'Rowan', 'Finley', 'Charlie', 'Emery', 'Haven',
  ],
};

const JAPANESE: Corpus = {
  male: [
    'Takeshi', 'Akira', 'Haruto', 'Hiroshi', 'Kenji', 'Yuto',
    'Ren', 'Sora', 'Kaito', 'Daiki', 'Riku', 'Hayato',
    'Minato', 'Sota', 'Hinata', 'Yamato', 'Kota', 'Asahi',
    'Ryo', 'Shota', 'Yuki', 'Haru', 'Tatsuya', 'Shinji',
    'Kazuki', 'Makoto', 'Naoki', 'Ryota', 'Ichiro', 'Saburo',
    'Masaru', 'Isamu', 'Satoshi', 'Kenzo', 'Taro', 'Jiro',
    'Noboru', 'Susumu', 'Hajime', 'Mamoru', 'Shin', 'Kai',
    'Jun', 'Kou', 'Aki', 'Sei', 'Rei', 'Toma', 'Soma', 'Itsuki',
  ],
  female: [
    'Sakura', 'Yuki', 'Hana', 'Aoi', 'Himari', 'Yui',
    'Mei', 'Koharu', 'Rin', 'Mio', 'Ichika', 'Misaki',
    'Rio', 'Akari', 'Hina', 'Saki', 'Nozomi', 'Kaede',
    'Ayaka', 'Haruka', 'Emi', 'Kana', 'Miku', 'Yuna',
    'Nanami', 'Shiori', 'Mana', 'Yuri', 'Asuka', 'Hitomi',
    'Noriko', 'Chihiro', 'Fumiko', 'Keiko', 'Midori', 'Naomi',
    'Reiko', 'Sayuri', 'Tomoko', 'Yoko', 'Ai', 'Mai',
    'Risa', 'Sora', 'Tsumugi', 'Kokona', 'Riko', 'Miyu',
  ],
  neutral: [
    'Hikaru', 'Sora', 'Haru', 'Yuki', 'Ren', 'Aki',
    'Makoto', 'Hinata', 'Nao', 'Mitsuki', 'Aoba', 'Shion',
  ],
};

const NORDIC: Corpus = {
  male: [
    'Ragnar', 'Bjorn', 'Eirik', 'Sigurd', 'Leif', 'Harald',
    'Thorstein', 'Ivar', 'Gunnar', 'Olaf', 'Sven', 'Ulf',
    'Rollo', 'Floki', 'Halfdan', 'Hakon', 'Rolf', 'Styrbjorn',
    'Thorfinn', 'Ketil', 'Asmund', 'Brynjar', 'Dagfinn', 'Einar',
    'Frode', 'Geir', 'Haavard', 'Ingvar', 'Jarle', 'Knut',
    'Lodvar', 'Magnus', 'Njord', 'Orm', 'Peder', 'Torbjorn',
    'Vidar', 'Yngve', 'Arne', 'Brage', 'Dag', 'Erling',
    'Finn', 'Gorm', 'Helge', 'Jarl', 'Kolbjorn', 'Sigvald',
    'Trygve', 'Vegard', 'Sten', 'Birger',
  ],
  female: [
    'Sigrid', 'Freya', 'Astrid', 'Ingrid', 'Gudrun', 'Helga',
    'Brynhild', 'Thyra', 'Ragnhild', 'Aud', 'Solveig', 'Torhild',
    'Gunnhild', 'Alfhild', 'Hallgerd', 'Hervor', 'Thordis',
    'Asgerd', 'Bergthora', 'Grimhild', 'Jorunn', 'Ljufa',
    'Signy', 'Svanhild', 'Valdis', 'Ylva', 'Alva', 'Embla',
    'Freja', 'Hilda', 'Idun', 'Liv', 'Nanna', 'Saga',
    'Sif', 'Turid', 'Vigdis', 'Dagny', 'Eira', 'Gerd',
    'Hulda', 'Inga', 'Kari', 'Runa', 'Tove', 'Unnr',
  ],
  neutral: [
    'Storm', 'Ash', 'Frost', 'Rune', 'Tor', 'Eld',
    'Bjork', 'Sten', 'Skald', 'Kald', 'Mork', 'Lys',
  ],
};

const ARABIC: Corpus = {
  male: [
    'Ahmad', 'Khalil', 'Omar', 'Hassan', 'Tariq', 'Rashid',
    'Kareem', 'Malik', 'Farid', 'Samir', 'Nabil', 'Yusuf',
    'Ibrahim', 'Hamza', 'Idris', 'Jamal', 'Zaid', 'Amir',
    'Faisal', 'Mustafa', 'Sultan', 'Salim', 'Nadir', 'Basir',
    'Darian', 'Rafiq', 'Wahid', 'Zahir', 'Qasim', 'Bilal',
    'Hakim', 'Nassir', 'Othman', 'Rami', 'Sami', 'Talal',
    'Walid', 'Yasir', 'Badr', 'Dawud', 'Harith', 'Jabir',
    'Latif', 'Mahdi', 'Numan', 'Sharif', 'Thabit', 'Abbas',
  ],
  female: [
    'Layla', 'Fatima', 'Amira', 'Zara', 'Yasmin', 'Noor',
    'Samira', 'Hana', 'Leila', 'Maryam', 'Aisha', 'Zahra',
    'Nadira', 'Soraya', 'Farah', 'Dalal', 'Rania', 'Salma',
    'Jamila', 'Hafsa', 'Inaya', 'Khadija', 'Lubna', 'Malika',
    'Nawal', 'Rawiya', 'Safiya', 'Thuraya', 'Wafa', 'Yara',
    'Basma', 'Dunya', 'Ghada', 'Habiba', 'Iman', 'Jihan',
    'Karima', 'Lamis', 'Munira', 'Najwa', 'Rasha', 'Sana',
  ],
  neutral: [
    'Shams', 'Noor', 'Hayat', 'Aman', 'Ihsan', 'Salam',
    'Rida', 'Hilal', 'Kamal', 'Jamal', 'Widad', 'Badr',
  ],
};

const AFRICAN: Corpus = {
  male: [
    'Kwame', 'Kofi', 'Amara', 'Chidi', 'Emeka', 'Oba',
    'Jelani', 'Zuberi', 'Tendai', 'Sekou', 'Mandela', 'Kenyatta',
    'Abioye', 'Adebayo', 'Chinua', 'Dayo', 'Ekene', 'Folami',
    'Gbenga', 'Idris', 'Kamau', 'Lekan', 'Mwangi', 'Nkem',
    'Olumide', 'Chukwu', 'Simba', 'Thabo', 'Uzoma', 'Yemi',
    'Zuri', 'Akachi', 'Bongani', 'Chikezie', 'Dumi', 'Efe',
    'Femi', 'Gideon', 'Jabari', 'Kato', 'Lethabo', 'Malachi',
    'Nnamdi', 'Osei', 'Tafari', 'Wole', 'Ayodele', 'Azikiwe',
  ],
  female: [
    'Amara', 'Zuri', 'Nia', 'Aaliyah', 'Imani', 'Ayana',
    'Chioma', 'Folake', 'Nkechi', 'Adaeze', 'Binta', 'Chiamaka',
    'Deka', 'Ebele', 'Funke', 'Hadiza', 'Ife', 'Jamila',
    'Kehinde', 'Lola', 'Morayo', 'Ngozi', 'Ogechi', 'Pumla',
    'Sade', 'Thandiwe', 'Uchenna', 'Wanjiku', 'Yetunde', 'Zainab',
    'Abena', 'Bisi', 'Chipo', 'Dalila', 'Eshe', 'Fola',
    'Halima', 'Iyabo', 'Kaya', 'Lindiwe', 'Makena', 'Nalini',
  ],
  neutral: [
    'Amani', 'Baraka', 'Deka', 'Enzi', 'Furaha', 'Haki',
    'Imara', 'Jua', 'Kazi', 'Mwanga', 'Neema', 'Shujaa',
  ],
};

// ── Race to corpus mapping ──────────────────────────────────────────

const FANTASY_RACE_MAP: Record<string, Corpus> = {
  human: FANTASY_HUMAN,
  elf: FANTASY_ELF,
  dwarf: FANTASY_DWARF,
  orc: FANTASY_ORC,
  dragon: FANTASY_DRAGON,
  demon: FANTASY_DEMON,
  angel: FANTASY_ANGEL,
  fairy: FANTASY_FAIRY,
};

const GENRE_MAP: Record<string, Corpus> = {
  scifi: SCIFI,
  medieval: MEDIEVAL,
  modern: MODERN,
  japanese: JAPANESE,
  nordic: NORDIC,
  arabic: ARABIC,
  african: AFRICAN,
};

// ── Surname seed corpora ────────────────────────────────────────────

const SURNAME_SEEDS: Record<string, string[]> = {
  fantasy: [
    'Shadowmere', 'Ironforge', 'Stormborn', 'Brightblade', 'Darkhollow',
    'Firebrand', 'Frostweaver', 'Goldleaf', 'Hawkwind', 'Moonwhisper',
    'Nightshade', 'Oakheart', 'Ravencrest', 'Silverhand', 'Thornwall',
    'Wildfire', 'Blackthorn', 'Crowley', 'Dragonsbane', 'Emberheart',
    'Grimwald', 'Highcastle', 'Lightfoot', 'Mistwalker', 'Starfall',
    'Wolfsbane', 'Ashborne', 'Bloodraven', 'Crystalvale', 'Dawnbreaker',
  ],
  scifi: [
    'Xenaris', 'Voltara', 'Cygnax', 'Heliosphere', 'Nebulax',
    'Quasaron', 'Stellaris', 'Tachyon', 'Voidwalker', 'Warpsign',
    'Zeronis', 'Axiomatic', 'Baryonis', 'Chromius', 'Darkmatter',
    'Entropis', 'Fusioncore', 'Graviton', 'Hypernova', 'Ionfield',
  ],
  medieval: [
    'Ashford', 'Blackwood', 'Crawford', 'Dunmore', 'Fairfax',
    'Greenfield', 'Hartwell', 'Kingsley', 'Lancaster', 'Montague',
    'Northwood', 'Pemberton', 'Ravenswood', 'Stratford', 'Whitmore',
    'Wycliffe', 'Beaumont', 'Courtenay', 'Fitzroy', 'Hastings',
  ],
  modern: [
    'Smith', 'Johnson', 'Williams', 'Brown', 'Davis', 'Miller',
    'Wilson', 'Moore', 'Taylor', 'Anderson', 'Thomas', 'Jackson',
    'White', 'Harris', 'Martin', 'Thompson', 'Garcia', 'Martinez',
    'Robinson', 'Clark', 'Rodriguez', 'Lewis', 'Lee', 'Walker',
  ],
  japanese: [
    'Sato', 'Suzuki', 'Takahashi', 'Tanaka', 'Watanabe', 'Ito',
    'Yamamoto', 'Nakamura', 'Kobayashi', 'Kato', 'Yoshida', 'Yamada',
    'Sasaki', 'Yamaguchi', 'Matsumoto', 'Inoue', 'Kimura', 'Hayashi',
    'Shimizu', 'Yamazaki', 'Mori', 'Abe', 'Ikeda', 'Hashimoto',
  ],
  nordic: [
    'Eriksson', 'Johansson', 'Svensson', 'Nilsson', 'Petersson',
    'Gustafsson', 'Andersson', 'Olsson', 'Lindberg', 'Bergstrom',
    'Sundberg', 'Holmgren', 'Bjornsson', 'Thorsson', 'Magnusson',
    'Haraldsson', 'Sigurdsson', 'Ragnarsson', 'Gunnarsson', 'Leifsson',
  ],
  arabic: [
    'Al-Rashid', 'Al-Amin', 'Al-Hakim', 'Ibn-Khaldun', 'Al-Farabi',
    'Al-Ghazali', 'Al-Biruni', 'Al-Razi', 'Al-Kindi', 'Al-Mahdi',
    'Al-Mansur', 'Al-Mutamid', 'Al-Nasir', 'Al-Walid', 'Al-Zahir',
    'Bin-Laden', 'Ibn-Sina', 'Al-Jazari', 'Al-Khwarizmi', 'Al-Tusi',
  ],
  african: [
    'Okonkwo', 'Achebe', 'Mandela', 'Kenyatta', 'Nkrumah',
    'Soyinka', 'Tutu', 'Mugabe', 'Nyerere', 'Lumumba',
    'Adichie', 'Ngugi', 'Diop', 'Senghor', 'Cabral',
    'Sankara', 'Selassie', 'Mosheshoe', 'Shaka', 'Cetshwayo',
  ],
};

// ── Epithet templates ───────────────────────────────────────────────

const EPITHET_TEMPLATES: Record<string, string[][]> = {
  fantasy: [
    ['the', 'Wise', 'Bold', 'Brave', 'Fierce', 'Swift', 'Silent', 'Cunning', 'Radiant', 'Fearless', 'Unyielding', 'Valiant', 'Merciful', 'Relentless'],
    ['bane', 'Shadow', 'Storm', 'Doom', 'Dragon', 'Night', 'Flame', 'Frost', 'Thunder', 'Death', 'Soul', 'World'],
    ['walker', 'Shadow', 'Storm', 'Star', 'Moon', 'Sun', 'Dream', 'Wind', 'Fire', 'Ice', 'Spirit', 'Void'],
    ['of', 'the North', 'the South', 'the Eternal Flame', 'the Silver Tower', 'the Iron Mountains', 'the Crimson Keep', 'the Ancient Wood'],
  ],
  scifi: [
    ['unit', 'Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Omega', 'Sigma', 'Theta', 'Lambda', 'Zeta'],
    ['class', 'Alpha', 'Omega', 'Prime', 'Apex', 'Null', 'Void', 'Quantum', 'Stellar', 'Nebula'],
    ['prime', 'One', 'Zero', 'Null'],
  ],
  medieval: [
    ['the', 'Great', 'Pious', 'Just', 'Fair', 'Bold', 'Unready', 'Confessor', 'Brave', 'Good', 'Wise', 'Terrible', 'Conqueror', 'Magnificent'],
    ['of', 'Wessex', 'Normandy', 'Aquitaine', 'Castile', 'Aragon', 'Bavaria', 'Saxony', 'Burgundy', 'Flanders'],
    ['heart', 'Lion', 'Iron', 'Brave', 'Strong', 'True', 'Steel', 'Stone', 'Gold'],
  ],
  japanese: [
    ['no', 'Kaze', 'Yama', 'Umi', 'Tsuki', 'Hoshi', 'Hikari', 'Kage'],
  ],
  nordic: [
    ['the', 'Bold', 'Red', 'Black', 'White', 'Great', 'Fierce', 'Wise', 'Boneless', 'Ironside', 'Bloodaxe', 'Fairhair', 'Bluetooth', 'Finehair'],
    ['slayer', 'Dragon', 'Giant', 'Wolf', 'Bear', 'Troll', 'Serpent'],
  ],
  arabic: [
    ['al', 'Kabir', 'Amin', 'Hakim', 'Rashid', 'Adil', 'Karim', 'Aziz', 'Nasir', 'Hamid'],
  ],
  african: [
    ['the', 'Great', 'Wise', 'Mighty', 'Swift', 'Brave', 'Fearless', 'Just', 'Strong'],
    ['of', 'the Savanna', 'the River', 'the Mountain', 'the Plains', 'the Forest'],
  ],
};

// ── Markov chain engine ─────────────────────────────────────────────

type TransitionTable = Map<string, Map<string, number>>;

function buildTransitions(names: string[], order: number = 2): TransitionTable {
  const table: TransitionTable = new Map();

  for (const name of names) {
    const lower = name.toLowerCase();
    const padded = '^'.repeat(order) + lower + '$';

    for (let i = 0; i < padded.length - order; i++) {
      const key = padded.slice(i, i + order);
      const next = padded[i + order];
      if (!table.has(key)) table.set(key, new Map());
      const counts = table.get(key)!;
      counts.set(next, (counts.get(next) || 0) + 1);
    }
  }

  return table;
}

function pickWeighted(counts: Map<string, number>): string {
  const total = Array.from(counts.values()).reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (const [ch, count] of counts) {
    r -= count;
    if (r <= 0) return ch;
  }
  return Array.from(counts.keys())[0];
}

function generateFromTable(table: TransitionTable, order: number, minLen: number, maxLen: number): string {
  let result = '';
  let key = '^'.repeat(order);

  for (let i = 0; i < maxLen + 5; i++) {
    const counts = table.get(key);
    if (!counts || counts.size === 0) break;

    const next = pickWeighted(counts);
    if (next === '$') {
      if (result.length >= minLen) break;
      // Too short, try continuing
      continue;
    }

    result += next;
    key = key.slice(1) + next;

    if (result.length >= maxLen) break;
  }

  if (result.length < minLen) return '';

  // Capitalize first letter
  return result.charAt(0).toUpperCase() + result.slice(1);
}

// ── Length constraints ──────────────────────────────────────────────

function getLengthBounds(length: string | undefined): [number, number] {
  switch (length) {
    case 'short': return [3, 6];
    case 'long': return [8, 14];
    default: return [4, 10]; // medium
  }
}

// ── Epithet generation ──────────────────────────────────────────────

function generateEpithet(genre: string): string | null {
  if (Math.random() > 0.5) return null; // 50% chance of no epithet

  const templates = EPITHET_TEMPLATES[genre] || EPITHET_TEMPLATES.fantasy;
  const template = templates[Math.floor(Math.random() * templates.length)];
  const type = template[0];
  const options = template.slice(1);
  const chosen = options[Math.floor(Math.random() * options.length)];

  switch (type) {
    case 'the': return `the ${chosen}`;
    case 'bane': return `${chosen}bane`;
    case 'walker': return `${chosen}walker`;
    case 'slayer': return `${chosen}slayer`;
    case 'of': return `of ${chosen}`;
    case 'unit': return `${chosen}-Unit`;
    case 'class': return `${chosen}-class`;
    case 'prime': return `Prime ${chosen}`;
    case 'heart': return `${chosen}heart`;
    case 'no': return `no ${chosen}`;
    case 'al': return `al-${chosen}`;
    default: return `the ${chosen}`;
  }
}

// ── Meaning generation (flavor text) ────────────────────────────────

const MEANINGS: string[] = [
  'Bearer of light', 'Walker between worlds', 'Born under a red moon',
  'Last of their line', 'Child of storm', 'Keeper of secrets',
  'Flame that does not die', 'Shadow in the mist', 'Voice of the deep',
  'Warden of the threshold', 'Heir to the forgotten throne',
  'Dreamer of impossible things', 'One who speaks with stars',
  'The echo that remains', 'Chosen by fire', 'Bound by oath',
  'First to cross the veil', 'Singer of the old songs',
  'Heart of the mountain', 'Sword of the dawn',
];

// ── Cache for transition tables ─────────────────────────────────────

const tableCache = new Map<string, TransitionTable>();

function getTable(names: string[], cacheKey: string): TransitionTable {
  if (!tableCache.has(cacheKey)) {
    tableCache.set(cacheKey, buildTransitions(names, 2));
  }
  return tableCache.get(cacheKey)!;
}

function getSurnameTable(genre: string): TransitionTable {
  const key = `surname:${genre}`;
  if (!tableCache.has(key)) {
    const seeds = SURNAME_SEEDS[genre] || SURNAME_SEEDS.fantasy;
    tableCache.set(key, buildTransitions(seeds, 2));
  }
  return tableCache.get(key)!;
}

// ── Public API ──────────────────────────────────────────────────────

function getCorpus(options: GeneratorOptions): { names: string[]; cacheKey: string } {
  const gender = options.gender || 'neutral';

  if (options.genre === 'fantasy') {
    const race = options.race || 'human';
    const corpus = FANTASY_RACE_MAP[race] || FANTASY_HUMAN;
    const genderNames = gender === 'male' ? corpus.male
      : gender === 'female' ? corpus.female
      : [...corpus.male, ...corpus.female, ...corpus.neutral];
    return { names: genderNames, cacheKey: `fantasy:${race}:${gender}` };
  }

  const corpus = GENRE_MAP[options.genre];
  if (!corpus) {
    return { names: FANTASY_HUMAN.neutral, cacheKey: 'fallback' };
  }

  const genderNames = gender === 'male' ? corpus.male
    : gender === 'female' ? corpus.female
    : [...corpus.male, ...corpus.female, ...corpus.neutral];
  return { names: genderNames, cacheKey: `${options.genre}:${gender}` };
}

function getGenreKey(options: GeneratorOptions): string {
  if (options.genre === 'fantasy') return 'fantasy';
  return options.genre;
}

export function generateName(options: GeneratorOptions): GeneratedName {
  const { names, cacheKey } = getCorpus(options);
  const [minLen, maxLen] = getLengthBounds(options.length);
  const table = getTable(names, cacheKey);
  const genreKey = getGenreKey(options);

  // Try Markov generation, fall back to random seed if it fails
  let name = '';
  for (let attempt = 0; attempt < 20; attempt++) {
    const candidate = generateFromTable(table, 2, minLen, maxLen);
    if (candidate && candidate.length >= minLen && candidate.length <= maxLen) {
      name = candidate;
      break;
    }
  }

  // Fallback: pick a random seed name
  if (!name) {
    name = names[Math.floor(Math.random() * names.length)];
  }

  // Surname generation (60% chance)
  let surname: string | null = null;
  if (Math.random() < 0.6) {
    const surnameTable = getSurnameTable(genreKey);
    for (let attempt = 0; attempt < 10; attempt++) {
      const candidate = generateFromTable(surnameTable, 2, 4, 12);
      if (candidate) {
        surname = candidate;
        break;
      }
    }
    if (!surname) {
      const seeds = SURNAME_SEEDS[genreKey] || SURNAME_SEEDS.fantasy;
      surname = seeds[Math.floor(Math.random() * seeds.length)];
    }
  }

  const epithet = generateEpithet(genreKey);
  const meaning = Math.random() < 0.3 ? MEANINGS[Math.floor(Math.random() * MEANINGS.length)] : null;

  let full = name;
  if (surname) full += ` ${surname}`;
  if (epithet) full += `, ${epithet}`;

  return { name, surname, full, epithet, meaning };
}

export function generateBatch(options: GeneratorOptions, count: number): GeneratedName[] {
  const results: GeneratedName[] = [];
  const seenNames = new Set<string>();

  for (let i = 0; i < count * 3 && results.length < count; i++) {
    const result = generateName(options);
    if (!seenNames.has(result.name.toLowerCase())) {
      seenNames.add(result.name.toLowerCase());
      results.push(result);
    }
  }

  return results;
}
