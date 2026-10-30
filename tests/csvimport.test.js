// Tests de lecture CSV : formats de grandes banques françaises et néobanques (fichiers fictifs reproduisant
// leurs particularités), formats de montants/dates, et exports crypto de type Bitstack. node tests/csvimport.test.js
const C = require('../app/js/csvimport.js');
const out = [];
const log = (t, ok, d) => { out.push(ok); console.log((ok ? 'OK  ' : 'BUG ') + t + (d !== undefined && !ok ? '  →  ' + JSON.stringify(d) : '')); };
const sig = (r) => r.rows.map((x) => x.date + ' ' + x.amount).join(' | ');
const latin1 = (s) => Uint8Array.from([...s].map((ch) => { const c = ch.charCodeAt(0); if (c < 256) return c; if (ch === '€') return 0x80; return 0x3f; }));

// --- Nombres
const A = [['-1 234,56', -1234.56], ['1.234,56', 1234.56], ['1,234.56', 1234.56], ['(12,00)', -12], ['82,40-', -82.4], ['+12 €', 12], ['−5,5', -5.5],
  ['1234.5 EUR', 1234.5], ['0,00012345', 0.00012345], [' 1 500,00', 1500], ['abc', null], ['', null], ['12', 12], ["1'234.50", 1234.5]];
A.forEach(([s, v]) => log(`Montant « ${s} » → ${v}`, C.parseAmount(s) === v, C.parseAmount(s)));
log('Montant « 1.234 » en colonne à virgule décimale → 1234', C.parseAmount('1.234', ',') === 1234 && C.parseAmount('1,234', '.') === 1234);

// --- Dates
const D = [['14/10/2026', '2026-10-14'], ['14/10/26', '2026-10-14'], ['2026-10-14', '2026-10-14'], ['2026-10-14 10:22:33', '2026-10-14'], ['14.10.2026', '2026-10-14'],
  ['14-10-2026', '2026-10-14'], ['14 oct. 2026', '2026-10-14'], ['1er octobre 2026', '2026-10-01'], ['Oct 14, 2026', '2026-10-14'], ['20261014', '2026-10-14'], ['31/02/2026', null], ['Solde', null]];
D.forEach(([s, v]) => log(`Date « ${s} » → ${v}`, C.parseDate(s) === v, C.parseDate(s)));
log('Colonne de dates américaines (10/14/2026) reconnue MDY', C.dateOrder(['10/14/2026', '10/02/2026']) === 'MDY' && C.parseDate('10/02/2026', 'MDY') === '2026-10-02');

// --- Encodage
const ca = 'Téléchargement du 22/10/2026\nCompte de Dépôt carte n° 123\n\nDate;Libellé;Débit euros;Crédit euros;\n14/10/2026;"PRLV SEPA FREE MOBILE\nECH/141026";19,99;;\n12/10/2026;VIREMENT SALAIRE OCTOBRE;;1 850,00;\n10/10/2026;CB CARREFOUR 09/10;82,40;;\n';
log('Encodage Windows-1252 (Crédit Agricole) : accents lus correctement', C.decode(latin1(ca)).includes('Libellé;Débit euros'));
log('Encodage UTF-8 avec BOM', C.decode(Uint8Array.from([0xEF, 0xBB, 0xBF, ...new TextEncoder().encode('Date;Montant')])) === 'Date;Montant');

// --- Banques
const banks = {
  'Crédit Agricole (en-têtes, Débit/Crédit, libellé sur 2 lignes)': [ca, '2026-10-14 -19.99 | 2026-10-12 1850 | 2026-10-10 -82.4', (r) => r.rows[0].label.includes('FREE MOBILE')],
  'Société Générale (="…", Montant de l\'opération, détail)': ['="0123456789";Compte courant\n\nDate de l\'opération;Libellé;Détail de l\'écriture;Montant de l\'opération;Devise\n14/10/2026;CARTE X1234;CARTE X1234 13/10 BOULANGERIE PAUL;-4,20;EUR\n13/10/2026;VIR RECU;VIR RECU DE M DUPONT;150,00;EUR\n',
    '2026-10-14 -4.2 | 2026-10-13 150', (r) => r.rows[0].label.includes('BOULANGERIE PAUL')],
  'Boursorama (dateOp, amount, solde à exclure)': ['dateOp;dateVal;label;category;categoryParent;supplierFound;amount;comment;accountNum;accountLabel;accountbalance\n2026-10-14;2026-10-14;"CARTE 13/10/26 MONOPRIX";"Alimentation";"Vie quotidienne";"monoprix";-23,15;;00012345;BoursoBank;1 234,56\n2026-10-12;2026-10-12;"VIR SALAIRE";"Salaires";"Revenus";"";1 900,00;;00012345;BoursoBank;1 257,71\n',
    '2026-10-14 -23.15 | 2026-10-12 1900'],
  'La Banque Postale (EUROS et FRANCS : garder les euros)': ['Numéro Compte   ;0123456X020\nType ;CCP\nCompte tenu en  ;euros\n\nDate;Libellé;Montant(EUROS);Montant(FRANCS)\n14/10/2026;ACHAT CB LECLERC;-56,30;-369,30\n',
    '2026-10-14 -56.3'],
  'BNP Paribas (catégories, montant signé)': ['Compte de chèques;****1234;Solde au 22/10/2026;1 500,00\nDate opération;Catégorie;Sous Catégorie;Libellé opération;Montant opération\n14/10/2026;Alimentation;Supermarché;FACTURE CARTE DU 13/10 AUCHAN;-61,20\n',
    '2026-10-14 -61.2', (r) => r.rows[0].label.includes('AUCHAN')],
  'Caisse d\'Épargne / Fortuneo (débits notés en négatif)': ['Date;Numéro d\'opération;Libellé;Débit;Crédit;Détail;\n14/10/2026;123;CB PHARMACIE;-12,40;;CB PHARMACIE 13/10;\n13/10/2026;124;VIR SEPA;;300,00;VIR DE LIVRET;\n',
    '2026-10-14 -12.4 | 2026-10-13 300'],
  'LCL (sans ligne de titres)': ['14/10/2026;-82,40;Carte;;CB CARREFOUR 13/10;0\n13/10/2026;1850,00;Virement;;VIR SALAIRE;0\n12/10/2026;-9,99;Prélèvement;;PRLV NETFLIX;0\n',
    '2026-10-14 -82.4 | 2026-10-13 1850 | 2026-10-12 -9.99', (r) => r.rows[2].label === 'PRLV NETFLIX'],
  'Revolut (virgules, date+heure, frais, statut refusé)': ['Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance\nCARD_PAYMENT,Current,2026-10-14 10:22:33,2026-10-15 08:01:02,Uber,-12.50,0.00,EUR,COMPLETED,487.50\nTOPUP,Current,2026-10-12 09:00:00,2026-10-12 09:00:01,Top-Up by *1234,500.00,0.00,EUR,COMPLETED,500.00\nCARD_PAYMENT,Current,2026-10-13 11:00:00,,Amazon,-30.00,0.00,EUR,DECLINED,\nEXCHANGE,Current,2026-10-16 10:00:00,2026-10-16 10:00:00,Exchanged to USD,-100.00,1.00,EUR,COMPLETED,386.50\n',
    '2026-10-15 -12.5 | 2026-10-12 500 | 2026-10-16 -101', (r) => r.skipped === 1],
  'N26 (Amount (EUR) et devise étrangère)': ['"Date","Payee","Account number","Transaction type","Payment reference","Amount (EUR)","Amount (Foreign Currency)","Type Foreign Currency","Exchange Rate"\n"2026-10-14","Lidl","","MasterCard Payment","","-34.12","","",""\n"2026-10-10","Shop US","","MasterCard Payment","","-9.20","-10.00","USD","1.087"\n',
    '2026-10-14 -34.12 | 2026-10-10 -9.2'],
  'Qonto (montant sans signe + colonne Side)': ['Settlement date (UTC),Operation date (UTC),Total amount (incl. VAT),Currency,Counterparty name,Side,Status\n15-10-2026 08:00:00,14-10-2026 10:00:00,120.00,EUR,OVH,debit,settled\n13-10-2026 08:00:00,13-10-2026 08:00:00,2000.00,EUR,Client SAS,credit,settled\n',
    '2026-10-14 -120 | 2026-10-13 2000'],
  'Format Excel anglais (1,234.56, mois/jour)': ['Date,Description,Debit,Credit,Balance\n10/14/2026,RENT,"1,234.56",,"3,000.00"\n10/02/2026,PAYROLL,,"2,500.00","4,234.56"\n',
    '2026-10-14 -1234.56 | 2026-10-02 2500'],
};
for (const [name, [csv, want, extra]] of Object.entries(banks)) {
  const r = C.readBank(csv);
  log('Banque — ' + name, sig(r) === want && (!extra || extra(r)), { obtenu: sig(r), labels: r.rows.map((x) => x.label), map: r.map });
}
const uns = C.readBank('Date;Libellé;Montant\n14/10/2026;CB A;12,00\n13/10/2026;CB B;8,00\n12/10/2026;CB C;5,00\n');
log('Montants tous positifs sans débit/crédit ni sens : signalé « sans signe »', uns.unsigned === true);

// --- Crypto : exports de type Bitstack (format non publié : plusieurs variantes plausibles)
const bs1 = 'Date;Type;Montant (EUR);Quantité (BTC);Prix du BTC (EUR);Frais (EUR)\n14/10/2026 08:00;Achat récurrent;10,00;0,00016234;61 598,12;0,15\n13/10/2026 19:20;Arrondi;0,37;0,00000601;61 560,00;0,00\n10/10/2026;Parrainage;0,00;0,00002000;61 000,00;0\n09/10/2026;Retrait;0;0,00100000;;\n05/10/2026;Vente;150,00;0,00245000;61 224,49;1,50\n';
const c1 = C.readCrypto(bs1);
const k1 = c1.rows.map((x) => [x.date, x.kind, x.q, x.eur, x.fee].join(' ')).join(' | ');
log('Bitstack (FR) : récurrent, arrondi, parrainage gratuit, retrait ignoré, vente', k1 === '2026-10-14 Achat 0.00016234 10 0.15 | 2026-10-13 Achat 0.00000601 0.37 0 | 2026-10-10 Gratuit 0.00002 0 0 | 2026-10-09 Ignorer 0.001 0 0 | 2026-10-05 Vente 0.00245 150 1.5', k1);
const bs2 = 'date,type,fiat_amount,fiat_currency,crypto_amount,crypto_currency,fee,status\n2026-10-14T08:00:00Z,BUY,10.00,EUR,0.00016234,BTC,0.15,completed\n2026-10-13T19:20:00Z,ROUND_UP,0.37,EUR,0.00000601,BTC,0.00,completed\n2026-10-12T19:20:00Z,BUY,5.00,EUR,0.00008,BTC,0.00,failed\n2026-10-10T10:00:00Z,REFERRAL_BONUS,0,EUR,0.00002,BTC,0,completed\n';
const c2 = C.readCrypto(bs2);
const k2 = c2.rows.map((x) => [x.date, x.kind, x.q, x.eur].join(' ')).join(' | ');
log('Bitstack (EN) : BUY / ROUND_UP / bonus ; transaction échouée ignorée', k2 === '2026-10-14 Achat 0.00016234 10 | 2026-10-13 Achat 0.00000601 0.37 | 2026-10-10 Gratuit 0.00002 0' && c2.skipped === 1, k2);
const bs3 = 'Date;Opération;Sats reçus;Montant investi\n14/10/2026;Achat programmé;16234;10,00 €\n';
const c3 = C.readCrypto(bs3);
log('Quantité en satoshis convertie en BTC (16 234 sats = 0,00016234 BTC)', c3.rows.length === 1 && c3.rows[0].q === 0.00016234 && c3.rows[0].eur === 10, c3.rows);
log('Détection fichier crypto vs bancaire', C.looksCrypto(bs1) && C.looksCrypto(bs2) && C.looksCrypto(bs3) && !C.looksCrypto(banks['Crédit Agricole (en-têtes, Débit/Crédit, libellé sur 2 lignes)'][0]));
log('Relevé bancaire qui mentionne Bitstack / Coinbase : reste un relevé bancaire', !C.looksCrypto('Date;Libellé;Montant\n15/10/2026;PRLV SEPA BITSTACK SAS;-10,00\n16/10/2026;CB COINBASE BTC;-50,00\n')
  && !C.looksCrypto('15/10/2026;-10,00;Prélèvement;;PRLV BITSTACK;0\n'));
log('Export crypto sans titres (quantités à 8 décimales) reconnu', C.looksCrypto('14/10/2026;Achat;10,00;0,00016234\n13/10/2026;Arrondi;0,37;0,00000601\n'));

// ===== v21.1 : relevé d'un compte d'épargne =====
const LA = 'Livret A n° 12345678901\nRelevé du 01/01/2026 au 30/10/2026\nDate;Libellé;Débit;Crédit;Solde\n31/12/2025;INTERETS 2025;;245,60;14 245,60\n15/03/2026;VIR DEPUIS COMPTE CHEQUE;;500,00;14 745,60\n20/06/2026;RETRAIT GUICHET;300,00;;14 445,60\n10/09/2026;VERSEMENT ESPECES;;200,00;14 645,60\n';
const rl = C.readBank(LA);
log('Relevé Livret A : 4 opérations, colonne Solde reconnue', rl.rows.length === 4 && rl.map.balance === 4 && rl.rows[0].balance === 14245.6, rl.map);
log('Relevé Livret A reconnu comme relevé d\'épargne (titre)', C.looksSaving(LA) && !C.looksSaving('Compte courant n° 1\nDate;Libellé;Montant\n01/10/2026;VIR LIVRET A;-200,00\n') && !C.looksSaving('Date;Libellé;Montant\n14/03/2026;VIR LIVRET A;-500,00\n'));
log('Nature des lignes : intérêts, virement, retrait, versement', JSON.stringify(rl.rows.map((r) => C.savingKind(r.label, r.amount))) === '["Intérêts","Transfert","Retrait","Dépôt"]');
const bi = C.balanceInfo(rl.rows);
log('Soldes : départ 14 000 € (avant les intérêts du 31/12), fin 14 645,60 €', bi && bi.opening === 14000 && bi.closing === 14645.6 && bi.from === '2025-12-31', bi);
const rev = C.readBank('Date;Libellé;Montant;Solde\n10/09/2026;VERSEMENT;200,00;14 645,60\n20/06/2026;RETRAIT;-300,00;14 445,60\n15/03/2026;VIR RECU;500,00;14 745,60\n');
const bi2 = C.balanceInfo(rev.rows);
log('Relevé du plus récent au plus ancien : soldes retrouvés (départ 14 245,60 €)', bi2 && bi2.opening === 14245.6 && bi2.closing === 14645.6, bi2);
log('Sans colonne Solde : pas de solde déduit', C.balanceInfo(C.readBank('Date;Libellé;Montant\n10/09/2026;VERSEMENT;200,00\n').rows) === null);

console.log(out.every(Boolean) ? `\n✓ csvimport.js : ${out.length} tests OK` : '\n✗ csvimport.js : erreurs');
process.exitCode = out.every(Boolean) ? 0 : 1;
