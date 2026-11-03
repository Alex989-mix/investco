# Génère docs/guide/guide.html au design « néobanque » (v27.4) : 20 pages A4.
# Usage : python3 docs/guide/generer_guide.py, puis node docs/build.js
# Le texte du guide se modifie ici (pas directement dans guide.html, qui est réécrit).
import json, os
D = os.path.dirname(os.path.abspath(__file__))
ico = json.load(open(os.path.join(D, 'src', 'icones.json')))
QZ = open(os.path.join(D, 'src', 'quinzaines.html'), encoding='utf-8').read()
OUT = os.path.join(D, 'guide.html')
I = lambda k: f'<svg viewBox="0 0 24 24">{ico[k]}</svg>'
PH = lambda img, cls='': f'<div class="phone {cls}"><div class="scr"><img src="img/{img}"></div></div>'

CSS = """
@font-face{font-family:'Sora';src:url('fonts/sora-latin-400-normal.woff2') format('woff2');font-weight:400}
@font-face{font-family:'Sora';src:url('fonts/sora-latin-600-normal.woff2') format('woff2');font-weight:600}
@font-face{font-family:'Sora';src:url('fonts/sora-latin-700-normal.woff2') format('woff2');font-weight:700}
@font-face{font-family:'Sora';src:url('fonts/sora-latin-800-normal.woff2') format('woff2');font-weight:800}
@font-face{font-family:'Inter';src:url('../../app/Inter.woff2') format('woff2');font-weight:100 900}
:root{--navy:#0B1420;--navy2:#111C2A;--line:#1F2C3C;--line2:#2A3A4E;--or:#F7931A;--orange:#F7931A;--ink:#F4F6F8;--ink2:#9AABBD;--ink3:#6B7D90;--card:#111C2A}
@page{size:A4;margin:0}*{box-sizing:border-box;margin:0;padding:0}
html,body{background:var(--navy);color:var(--ink);font-family:'Inter',sans-serif;font-size:10pt;line-height:1.55;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{width:210mm;height:297mm;position:relative;overflow:hidden;page-break-after:always;background:var(--navy)}
.page:last-child{page-break-after:auto}
h1,h2,h3,.num,.big{font-family:'Sora',sans-serif;letter-spacing:-.03em}
.foot{position:absolute;left:20mm;right:20mm;bottom:11mm;display:flex;justify-content:space-between;font-size:7.5pt;color:var(--ink3)}
.logo{display:flex;align-items:center;gap:3mm;font:700 15pt 'Sora';letter-spacing:-.02em}
.logo i{width:10mm;height:10mm;border-radius:50%;background:var(--navy);display:flex;align-items:center;justify-content:center}.logo i svg{width:5.5mm;height:5.5mm}
.phone{position:absolute;border-radius:9mm;background:#000;padding:2.2mm;box-shadow:0 30px 60px rgba(0,0,0,.45),0 0 0 1px #2B3746;z-index:2}
.phone .scr{border-radius:7mm;overflow:hidden;aspect-ratio:9/19}.phone .scr img{width:100%;height:100%;object-fit:cover;object-position:top;display:block}
.phone.short .scr{aspect-ratio:9/12}
b{color:var(--ink);font-weight:600}
.path{color:var(--ink);font-weight:600;white-space:nowrap}
.k{display:inline-block;border:1px solid var(--line2);border-radius:4px;padding:0 4px;color:var(--ink);font-size:8.5pt;line-height:1.5}
/* couverture */
.cover .top{position:absolute;left:0;right:0;top:0;height:178mm;background:var(--or)}
.cover .logo{position:absolute;left:20mm;top:18mm;color:var(--navy)}
.cover h1{position:absolute;left:20mm;top:60mm;width:104mm;font:800 46pt 'Sora';line-height:.98;color:var(--navy);letter-spacing:-.045em}
.cover .tag{position:absolute;left:20mm;top:150mm;font:600 10pt 'Sora';color:var(--navy);opacity:.75}
.cover .phone{right:20mm;top:96mm;width:66mm}
.cover .bot{position:absolute;left:20mm;right:20mm;bottom:22mm}
.cover .bot .kk{font:600 8pt 'Inter';letter-spacing:.22em;text-transform:uppercase;color:var(--or)}
.cover .bot .t{font:700 26pt 'Sora';margin-top:2mm;letter-spacing:-.03em;line-height:1.1}
.cover .bot .s{color:var(--ink2);margin-top:3mm;width:100mm}
.cover .bot .v{position:absolute;right:0;bottom:0;text-align:right;color:var(--ink3);font-size:8pt}
/* sommaire */
.toc{position:absolute;left:20mm;right:20mm;top:24mm}
.toc h2{font:800 40pt 'Sora';letter-spacing:-.045em}
.toc .intro{color:var(--ink2);margin-top:3mm;width:120mm}
.toc .list{display:grid;grid-template-columns:1fr 1fr;grid-auto-flow:column;grid-template-rows:repeat(6,auto);column-gap:12mm;margin-top:13mm}
.toc .it{display:flex;align-items:baseline;gap:5mm;padding:4.2mm 0;border-top:1px solid var(--line)}
.toc .it .num{font:700 20pt 'Sora';color:var(--or);width:13mm;flex:none}
.toc .it b{display:block;font:600 11.5pt 'Sora';letter-spacing:-.02em}.toc .it span{font-size:8.5pt;color:var(--ink3)}
.toc .it .pg{margin-left:auto;font:600 9pt 'Sora';color:var(--ink3)}
.prof{position:absolute;left:20mm;right:20mm;bottom:28mm;background:var(--navy2);border-radius:6mm;padding:7mm 8mm;display:flex;gap:7mm;align-items:center}
.prof h3{font:700 13pt 'Sora';width:36mm;flex:none}
.prof .p{flex:1}.prof .p b{display:block;font:600 10pt 'Sora'}.prof .p span{font-size:8.5pt;color:var(--or)}
/* ouverture de chapitre */
.band{position:absolute;left:0;right:0;top:0;height:112mm;background:var(--navy2)}
.open .n{position:absolute;left:20mm;top:20mm;font:800 92pt 'Sora';color:var(--or);line-height:1;letter-spacing:-.06em}
.open .mod{position:absolute;left:20mm;top:62mm;font:600 8pt 'Inter';letter-spacing:.2em;text-transform:uppercase;color:var(--ink2)}
.open h2{position:absolute;left:20mm;top:69mm;width:105mm;font:800 32pt 'Sora';line-height:1.02;letter-spacing:-.045em}
.open .lead{position:absolute;left:20mm;top:97mm;width:100mm;font-size:11pt;color:var(--ink2);line-height:1.5}
.open .phone{right:20mm;top:24mm;width:56mm}
/* page suite */
.cont .hd{position:absolute;left:20mm;top:16mm;font:600 8pt 'Inter';letter-spacing:.2em;text-transform:uppercase;color:var(--ink3)}
.cont .hd b{color:var(--or);font-family:'Sora';letter-spacing:0;margin-right:2mm}
.cont .phone{right:20mm;top:26mm;width:54mm}
/* zone de texte qui contourne le téléphone */
.flow{position:absolute;left:20mm;right:20mm}
.flow::before{content:'';float:right;width:var(--w,66mm);height:var(--h,0mm)}
.flow h3{font:700 12.5pt 'Sora';margin:5.5mm 0 1.8mm;letter-spacing:-.02em}.flow>h3:first-child,.flow>.first{margin-top:0}
.flow p{color:var(--ink2);margin-bottom:2.4mm}
.flow ul{list-style:none;margin:0 0 2.6mm}.flow li{position:relative;padding-left:5mm;color:var(--ink2);margin-bottom:1.4mm}
.flow li::before{content:'';position:absolute;left:0;top:2.1mm;width:2mm;height:2mm;border-radius:50%;background:var(--or)}
.steps .st{display:flex;gap:5mm;padding:3.4mm 0;border-top:1px solid var(--line)}
.steps .st .num{font:700 14pt 'Sora';color:var(--or);width:8mm;flex:none;line-height:1.2}
.steps .st b{display:block;font:600 10.3pt 'Sora';letter-spacing:-.01em;margin-bottom:.4mm}.steps .st p{font-size:9.2pt;color:var(--ink2);line-height:1.45;margin:0}
.figs{clear:both;display:grid;grid-template-columns:repeat(3,1fr);gap:5mm;margin:5mm 0}
.figs.two{grid-template-columns:1fr 1fr}
.fig{background:var(--or);color:var(--navy);border-radius:6mm;padding:5.5mm 6mm}
.fig.alt{background:var(--navy2);color:var(--ink)}
.fig .big{font:800 18pt 'Sora';letter-spacing:-.045em;line-height:1;white-space:nowrap}.fig p{font-size:8.6pt;margin:2.5mm 0 0;line-height:1.4;color:inherit;opacity:.85}
.cols{clear:both;display:grid;grid-template-columns:1fr 1fr;gap:10mm}
.cols p{font-size:9.4pt}
.rows{margin:1mm 0 3mm;overflow:hidden}
.rows .r{display:grid;grid-template-columns:38mm 1fr;gap:4mm;padding:2.8mm 0;border-top:1px solid var(--line)}
.rows .r b{font:600 9.6pt 'Sora'}.rows .r span{color:var(--ink2);font-size:9.2pt}
.tip{overflow:hidden;border-radius:6mm;padding:5mm 7mm;background:rgba(247,147,26,.1);display:flex;gap:5mm;align-items:baseline;margin:4mm 0}
.tip b{font:700 10.5pt 'Sora';color:var(--or);flex:none}.tip p{color:var(--ink);font-size:9.4pt;margin:0}
.tip.abs{position:absolute;left:20mm;right:20mm;bottom:22mm;margin:0}
.mods{display:grid;grid-template-columns:repeat(3,1fr);gap:4.5mm 6mm}
.mods .m{display:flex;align-items:center;gap:3mm;font:600 9.5pt 'Sora';letter-spacing:-.01em}
.ico{width:9mm;height:9mm;border-radius:50%;background:rgba(247,147,26,.14);display:flex;align-items:center;justify-content:center;flex:none}
.ico svg{width:4.6mm;height:4.6mm;stroke:var(--or);fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.mods .m span{display:block;font:400 7.8pt 'Inter';color:var(--ink3)}
.os{display:grid;grid-template-columns:1fr 1fr 1fr;gap:5mm}
.os .o{border-top:2px solid var(--or);padding-top:4mm}.os .o h4{font:700 12pt 'Sora';margin:3mm 0 2mm}.os .o p{font-size:9pt}
.os .o ol{list-style:none;counter-reset:s}.os .o li{counter-increment:s;padding-left:6mm;position:relative;color:var(--ink2);font-size:9pt;margin-bottom:1.6mm}
.os .o li::before{content:counter(s);position:absolute;left:0;top:0;font:700 9pt 'Sora';color:var(--or);background:none;width:auto;height:auto}
.qa{break-inside:avoid;margin-bottom:5mm}.qa h4{font:700 10.5pt 'Sora';margin-bottom:1.2mm;letter-spacing:-.01em}.qa p{font-size:9.2pt;color:var(--ink2);margin:0}
.qcols{columns:2;column-gap:10mm}
/* quinzaines */
.qz{margin:3mm 0 2mm;clear:both}.qz .row{display:grid;grid-template-columns:30mm repeat(4,1fr);gap:1.4mm;align-items:center;margin-bottom:5.5mm}
.qz .lab{font-size:8.3pt;color:var(--ink);font-weight:600;line-height:1.3}
.qz .seg{height:9mm;border-radius:2.5mm;position:relative;display:flex;align-items:center;justify-content:center;font-size:7.6pt;font-weight:600}
.qz .on{background:var(--or);color:#0B1420}.qz .off{background:var(--navy2);color:var(--ink3)}
.qz .mk{position:absolute;top:-4.3mm;font-size:7.3pt;color:var(--ink);font-weight:700;white-space:nowrap}
.qz .head .seg{height:auto;background:none;color:var(--ink3);font-weight:500}
.qz .leg{display:flex;gap:6mm;font-size:8pt;color:var(--ink2)}.qz .leg i{display:inline-block;width:3.2mm;height:3.2mm;border-radius:1mm;margin-right:1.5mm;vertical-align:-.4mm}
.small{font-size:8pt;color:var(--ink3)}
"""

pages = []
def foot(n): return f'<div class="foot"><span>Invest.co · Guide utilisateur · v{{{{VERSION}}}}</span><span>{n}</span></div>'
def opener(num, mod, title, lead, img, body, top=122, h=26, short=False):
    pages.append(('open', f'''<div class="band"></div><div class="n">{num}</div><div class="mod">{mod}</div><h2>{title}</h2><p class="lead">{lead}</p>
  {PH(img, 'short' if short else '')}
  <div class="flow" style="top:{top}mm;--h:{h}mm">{body}</div>'''))
def cont(num, label, img, body, h=128, short=False, extra=''):
    ph = PH(img, 'short' if short else '') if img else ''
    pages.append(('cont', f'''<div class="hd"><b>{num}</b>{label}</div>{ph}
  <div class="flow" style="top:30mm;--h:{h if img else 0}mm">{body}</div>{extra}'''))
st = lambda items: '<div class="steps">' + ''.join(f'<div class="st"><span class="num">{i+1}</span><div><b>{a}</b><p>{b}</p></div></div>' for i, (a, b) in enumerate(items)) + '</div>'
figs = lambda items, cls='': f'<div class="figs {cls}">' + ''.join(f'<div class="fig{" alt" if i else ""}"><div class="big">{a}</div><p>{b}</p></div>' for i, (a, b) in enumerate(items)) + '</div>'
rows = lambda items: '<div class="rows">' + ''.join(f'<div class="r"><b>{a}</b><span>{b}</span></div>' for a, b in items) + '</div>'
tip = lambda a, b, cls='': f'<div class="tip {cls}"><b>{a}</b><p>{b}</p></div>'

# 1 · couverture
pages.append(('cover', f'''<div class="top"></div>
  <div class="logo"><i><svg viewBox="0 0 24 24" fill="none" stroke="#F7931A" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15l5-5 3 3 6-7"/><circle cx="18" cy="6" r="1.7" fill="#F7931A" stroke="none"/></svg></i>Invest.co</div>
  <h1>Votre patrimoine, enfin lisible.</h1>
  <div class="tag">Épargne · Bourse · Crypto · Immobilier · Budget</div>
  {PH('tableau.png')}
  <div class="bot"><div class="kk">Guide utilisateur</div><div class="t">Prise en main<br>en 20 minutes</div><div class="s">Installez l'appli, choisissez vos modules et suivez tout votre argent au même endroit.</div>
    <div class="v">Version {{{{VERSION}}}}<br>Édition {{{{EDITION}}}}</div></div>'''))
# 2 · sommaire
TOC = [('01', "Installer l'appli", 'Android, iPhone, ordinateur', 3), ('02', 'Votre appli à la carte', 'Modules et profils', 4), ('03', 'Premiers réglages', 'Données, fiscalité', 6),
       ('04', 'Épargne et assurance-vie', 'Quinzaines, plafonds, contrats', 7), ('05', 'Bourse et crypto', 'PEA, dividendes, direct', 11), ('06', 'Importer vos relevés', 'Banques, plateformes', 12),
       ('07', 'Budget', 'Prévu et réel, récurrentes', 14), ('08', 'Immobilier et crowdfunding', 'Biens, crédits, projets', 15), ('09', 'Accueil, analyse et sécurité', 'Chiffres clés, verrouillage', 18),
       ('10', 'Questions fréquentes', 'Confidentialité, appareils', 21), ('11', 'Informations importantes', 'Limites et avertissements', 22)]
pages.append(('tocp', '<div class="toc"><h2>Sommaire</h2><p class="intro">Onze chapitres courts. Commencez par les deux premiers, puis lisez ceux de vos modules.</p><div class="list">'
  + ''.join(f'<div class="it"><span class="num">{n}</span><div><b>{t}</b><span>{d}</span></div><span class="pg">{p}</span></div>' for n, t, d, p in TOC) + '''</div></div>
  <div class="prof"><h3>Votre parcours</h3><div class="p"><b>Épargnant</b><span>02 · 04 · 07</span></div><div class="p"><b>Bourse</b><span>02 · 05 · 06</span></div><div class="p"><b>Immobilier</b><span>02 · 08</span></div><div class="p"><b>Tout</b><span>Tout le guide</span></div></div>'''))
# 3 · 01 installer
OS = [('Android', 'Chrome', ["Ouvrez le lien d'accès dans <b>Chrome</b>.", 'Menu <span class="k">⋮</span> › <b>Installer l\'application</b>.', 'Lancez Invest.co depuis son icône.']),
      ('iPhone', 'Safari', ["Ouvrez le lien d'accès dans <b>Safari</b>.", '<span class="k">Partager</span> › <b>Sur l\'écran d\'accueil</b>.', 'Lancez Invest.co depuis son icône.']),
      ('Ordinateur', 'Chrome, Edge, Safari', ["Ouvrez le lien d'accès.", 'Chrome et Edge proposent de l\'installer.', 'Chaque appareil garde ses propres données.'])]
opener('01', 'Socle commun', "Installer<br>l'appli", "Une application web qui s'installe sur votre écran d'accueil, sans passer par un store.", 'accueil.png',
  '<div class="os" style="clear:both;margin-top:30mm">' + ''.join(f'<div class="o"><span class="ico">{I("card" if i == 2 else "lock")}</span><h4>{a}</h4><p class="small" style="margin-bottom:3mm">{b}</p><ol>' + ''.join(f'<li>{x}</li>' for x in L) + '</ol></div>' for i, (a, b, L) in enumerate(OS)) + '</div>'
  + figs([('Hors ligne', "L'appli s'ouvre sans réseau ; seuls les cours ont besoin d'une connexion."), ('Mises à jour', 'Un bandeau orange « Nouvelle version », un appui suffit.'), ('Sauvegarde', 'Une copie de vos données est faite avant chaque mise à jour.')]), h=0, short=True)
# 4 · 02 à la carte
MODS = [('bank', 'Épargne', '04'), ('shield', 'Assurance-vie', '04'), ('chart', 'Bourse', '05'), ('bolt', 'Crypto', '05'), ('home', 'Immobilier', '08'), ('build', 'Crowdfunding', '08'), ('wallet', 'Budget', '07'), ('bag', 'Achat-revente', '09'), ('pie', 'Analyse', '09'), ('upload', 'Import', '06')]
opener('02', 'Démarrer · modules', 'Votre appli<br>à la carte', "N'affichez que ce que vous suivez. Le reste se rajoute en un geste, sans rien perdre.", 'composer.png',
  st([('Partir de vos données', 'Au premier lancement, touchez « Partir de mes données ».'), ('Choisir un point de départ', 'Épargnant, Bourse, Immobilier ou Tout.'), ('Ajuster', 'Touchez les tuiles pour ajouter ou retirer un module.'), ('Continuer', "L'appli s'ouvre avec vos seuls onglets.")])
  + '<h3 style="clear:both;margin-top:9mm">Dix modules au choix</h3><div class="mods">' + ''.join(f'<div class="m"><span class="ico">{I(k)}</span><div>{n}<span>Chapitre {c}</span></div></div>' for k, n, c in MODS) + '</div>'
  + '<p class="small" style="margin-top:4mm">En préparation : PER, SCPI, or, comptes à l\'étranger, autres actifs.</p>', top=120, h=30)
# 5 · 02 suite
cont('02', 'Votre appli à la carte', 'modules.png',
  '<h3>Changer de modules à tout moment</h3><p>Ouvrez <span class="path">Réglages › Modules</span>.</p><ul><li><b>Dans votre appli</b> : touchez Masquer pour retirer un module ; les flèches règlent l\'ordre des onglets.</li><li><b>Catalogue</b> : touchez une tuile pour la rajouter.</li><li><b>Prévus</b> : les modules à venir.</li></ul>'
  + '<h3>Modules liés</h3><p><b>Crowdfunding et Épargne</b> : masquer l\'Épargne masque aussi le Crowdfunding, dont le portefeuille est un compte d\'épargne.</p><p><b>Bourse et Crypto</b> partagent un onglet, « Crypto » si vous ne gardez que la Crypto.</p>'
  + figs([('Rien supprimé', 'Un module masqué garde toutes ses données.'), ('Total juste', 'Sa valeur reste dans votre patrimoine, ligne « Modules masqués ».'), ('Fiscalité', 'Le récap fiscal compte toujours tout.')])
  + '<h3>Vous ne trouvez pas un écran ?</h3>' + rows([("L'onglet Budget", 'Activez le module Budget'), ("L'onglet Revente", 'Activez Achat-revente'), ('Le lien Analyse', 'Activez Analyse et fiscalité'), ('Un onglet de Placements', 'Activez Épargne, Assurance-vie, Bourse, Crypto, Immobilier ou Crowdfunding'), ('Importer un relevé', 'Activez Import de relevés')]), h=124)
# 6 · 03 premiers réglages
opener('03', 'Socle commun', 'Premiers<br>réglages', "Deux minutes pour des chiffres justes : votre point de départ et votre situation fiscale.", 'reglages.png',
  "<h3>Partir de vos données</h3><p>Avec <b>Partir de mes données</b>, l'appli démarre avec un simple compte courant ; les exemples sont effacés.</p>"
  + '<h3 style="clear:both;margin-top:10mm">Votre situation fiscale</h3><p>Ouvrez <span class="path">Réglages › Ma situation fiscale</span> pour des revenus nets d\'impôt fiables :</p>'
  + rows([("Tranche d'imposition", 'Votre TMI, sur votre avis d\'impôt : 0, 11, 30, 41 ou 45 %.'), ('Crypto, compte-titres', 'Prélèvement forfaitaire unique (PFU) ou barème.'), ('Crowdfunding', 'PFU ou barème pour les intérêts.'), ('Achat-revente', 'Ventes occasionnelles ou activité (micro-BIC).'), ('Foyer fiscal', 'Personne seule ou couple : abattement de l\'assurance-vie après 8 ans.')])
  + tip('Taux à jour', 'Taux des livrets, plafonds et prélèvements sont fournis avec leur date. À consulter dans Réglages › Paramètres réglementaires.'), h=30)
# 7 · 04 épargne
opener('04', 'Module Épargne réglementée', 'Épargne<br>et livrets', 'Vos livrets, PEL, assurance-vie et liquidités, avec les intérêts de l\'année.', 'epargne.png',
  st([('Ajouter un produit', '<span class="path">Placements › Épargne › + Produit</span> : type, établissement, date.'), ('Saisir le solde', 'Laissez cochée « Argent déjà détenu » : ni épargne nouvelle, ni gain.'), ('Suivre les opérations', 'Versements et retraits se saisissent sur la fiche du produit.')])
  + figs([('Quinzaines', 'Les intérêts des livrets suivent la règle officielle.'), ('Plafonds', 'Une alerte quand un livret approche de son plafond.'), ('Taux datés', 'Un nouveau taux s\'applique à sa date, l\'ancien au passé.')]), h=28)
# 8 · 04 suite quinzaines
cont('04', 'Épargne et livrets', None,
  '<h3>Les intérêts à la quinzaine</h3><p style="max-width:150mm">Sur les livrets réglementés (Livret A, LDDS, LEP, Livret Jeune, CEL), les intérêts se calculent par périodes de quinze jours : du 1<sup>er</sup> au 15 et du 16 à la fin du mois.</p>'
  + QZ + figs([('Versement', 'Il rapporte dès la quinzaine suivante : versé le 10 mars, intérêts dès le 16.'), ('Retrait', 'Il cesse de rapporter dès le début de la quinzaine en cours.')], 'two')
  + tip('Le bon réflexe', 'Versez le 15 ou le dernier jour du mois, retirez le 1<sup>er</sup> ou le 16. Les intérêts sont versés le 31 décembre.')
  + '<h3>Comptes au jour le jour</h3><p>Livrets bancaires, assurance-vie et portefeuilles de plateforme rapportent chaque jour le taux annuel divisé par le nombre de jours de l\'année.</p>'
  + '<h3>Les explications à portée de main</h3><p>Dans l\'appli, touchez les boutons <span class="k">?</span> à côté des titres : votre saisie en cours est conservée.</p>')
# 8 bis · 04 assurance-vie (v28)
cont('04', 'Assurance-vie', 'assurance_vie.png',
  '<h3>Un contrat, plusieurs supports</h3><p>Le module <b>Assurance-vie</b> suit chaque contrat support par support : le fonds en euros et vos unités de compte (ETF, fonds, SCPI).</p>'
  + st([('Convertir ou créer', 'Sur la fiche de votre assurance-vie, touchez <b>Convertir en contrat complet</b> : le solde devient le fonds en euros, au centime près. Ou <span class="path">Ajouter › Contrat d\'assurance-vie</span>.'),
        ('Ajouter les supports', '<b>+ Support</b> : fonds en euros avec son taux, ou unité de compte avec son symbole.'), ('Saisir les opérations', 'Versement, rachat, arbitrage, frais ou intérêts, depuis la fiche du contrat.')])
  + '<h3>La valeur des unités de compte</h3>' + rows([('Avec un symbole', 'Parts détenues × cours, mis à jour par « Cours des UC » ou Actualiser.'), ('Sans symbole', 'La valeur lue sur votre relevé, avec sa date.'), ('Ni l\'un ni l\'autre', 'Estimée au montant investi, signalé sur la fiche.')]), h=128)
cont('04', 'Assurance-vie', None,
  '<h3>Chaque opération à sa place</h3>' + rows([('Versement', 'Argent nouveau : il compte dans votre épargne de l\'année.'), ('Rachat', 'Argent retiré : seule la part de gains est imposable.'), ('Arbitrage', 'Passage d\'un support à l\'autre : la valeur ne change pas, ce n\'est ni un versement ni un gain.'),
    ('Frais', 'Prélevés par l\'assureur : ils réduisent la valeur sans être un retrait.'), ('Intérêts', 'Crédités sur le fonds en euros, nets de prélèvements sociaux : un gain.')])
  + figs([('8 ans', 'La date figure sur chaque contrat : au-delà, les rachats sont moins imposés.'), ('4 600 €', 'Abattement annuel sur les gains rachetés, 9 200 € pour un couple, tous contrats confondus.'), ('Chaque année', 'Les prélèvements sociaux du fonds en euros sont déjà retenus.')])
  + '<h3>Ce qui est imposé lors d\'un rachat</h3><p style="max-width:160mm">La part de gains : rachat × (valeur du contrat − versements) ÷ valeur. Avant 8 ans, elle relève du prélèvement forfaitaire. Après 8 ans, l\'abattement de votre foyer s\'applique d\'abord, puis un taux réduit jusqu\'à 150 000 € de versements. Choisissez votre foyer dans <span class="path">Réglages › Ma situation fiscale</span>.</p>'
  + tip('Une unité de compte « estimée » ?', 'Sans cours ni valeur relevée, l\'appli retient le montant investi. Ouvrez le support et indiquez son symbole Yahoo Finance ou la valeur de votre dernier relevé.')
  + tip('Masquer le module', 'Vos contrats restent comptés dans votre patrimoine net et votre récap fiscal, sur la ligne « Modules masqués ».'))
# 9 · 05 bourse
opener('05', 'Modules Bourse et Crypto', 'Bourse<br>et crypto', "Vos titres regroupés par enveloppe, avec la variation du jour et le gain depuis l'achat.", 'pea.png',
  '<div style="height:26mm"></div>' + figs([('150 000 €', 'Plafond de versements du PEA, suivi automatiquement.'), ('5 ans', 'Avant 5 ans, un retrait clôture le PEA.'), ('En direct', 'Les cours crypto se mettent à jour en continu.')])
  + '<div class="cols"><div><h3 class="first">Ajouter un titre</h3><p><span class="path">Placements › Bourse › + Actif</span> : nom, symbole et enveloppe. Un ETF parisien se saisit avec son code Euronext, par exemple <b>CW8</b>.</p><h3>Suivre vos titres</h3><p>Touchez une ligne pour le prix de revient, les <b>seuils de revente</b> et les opérations. Actions et ETF s\'actualisent avec <b>Actualiser</b>.</p></div>'
  + '<div><h3 class="first">La fiche PEA</h3><p>Renseignez l\'ouverture et vos versements : plafond restant, liquidités et ancienneté s\'affichent seuls.</p><h3>Dividendes</h3><p><span class="path">Ajouter › Opération › Dividende</span>, montant net reçu. Le total apparaît dans votre récap fiscal.</p></div></div>'
  + tip('Astuce', 'Seulement des cryptos ? Masquez la Bourse dans Réglages › Modules : l\'onglet devient « Crypto ».'), h=0)
# 10 · 06 import
opener('06', 'Module Import de relevés', 'Importer<br>vos relevés', 'Plutôt que de tout saisir, importez le relevé de votre banque : le format est reconnu tout seul.', 'import_banque.png',
  st([('Exporter', 'Depuis votre banque, exportez vos opérations en CSV.'), ('Importer', '<span class="path">Ajouter › Importer un relevé › Fichier CSV</span>.'), ('Vérifier', 'Chaque ligne reçoit un type et une catégorie, modifiables.'), ('Valider', 'Touchez Importer.')])
  + figs([('Zéro doublon', 'Les relevés qui se chevauchent sont dédoublonnés.'), ('Investi ≠ dépensé', 'Les virements vers vos plateformes vont en « Investissement ».'), ('Tous formats', 'Débit / crédit, montant signé, dates françaises ou anglaises.')]), top=120, h=30)
# 11 · 06 suite
cont('06', 'Importer vos relevés', 'import_bitstack.png',
  '<h3>Export d\'une plateforme crypto</h3><p>Exemple avec Bitstack :</p>' + st([('Demander l\'export', 'Compte › Documents › Déclaration fiscale : le fichier arrive par e-mail.'), ('Importer le CSV', 'L\'onglet Plateforme s\'ouvre tout seul.'), ('Vérifier et valider', 'L\'actif est créé s\'il n\'existe pas encore.')])
  + rows([('Achat', 'Ponctuel, programmé ou arrondi : ajouté au prix de revient.'), ('Gratuit', 'Parrainage, bonus : crypto reçue à coût nul.'), ('Vente', 'Plus-value calculée au prix de revient moyen.'), ('Ignorer', 'Retrait vers votre portefeuille, dépôt d\'euros.')])
  + tip('Frais', 'Le montant est compté frais inclus. Décochez l\'option si votre plateforme les facture en plus.')
  + '<h3>Relevé d\'un livret</h3><p>Onglet <b>Épargne</b> de l\'import, puis le compte concerné : versements, retraits, intérêts et virements sont rattachés sans double comptage, et le solde est comparé à celui du relevé.</p>', h=126)
# 12 · 07 budget
opener('07', 'Module Budget', 'Budget', 'Où part votre argent chaque mois, ce qui revient, et l\'écart avec ce que vous aviez prévu.', 'budget.png',
  '<h3>Fixer vos budgets</h3><p>Touchez <b>Budgets</b> et donnez un montant à chaque catégorie. Un budget dépassé s\'affiche en rouge en haut de l\'écran.</p>'
  + figs([('Prévu et réel', 'Une barre par catégorie, avec le reste ou le dépassement.'), ('Récurrentes', 'Loyer, abonnements : enregistrés à chaque échéance.'), ('Automatique', 'Les libellés sont classés seuls ; vos règles passent en priorité.')])
  + '<div class="cols"><div><h3 class="first">Dépenses récurrentes</h3><p>Ajoutez-les avec <b>+ Récurrente</b>. L\'appli repère aussi celles qui reviennent chaque mois et vous propose de les ajouter.</p></div><div><h3 class="first">Vos règles</h3><p><span class="path">Réglages › Règles de catégories</span> : par exemple « boulangerie » vers Courses.</p></div></div>'
  + tip('Investir n\'est pas dépenser', 'Le solde du mois isole la part investie (« dont X € investis ») de vos dépenses courantes.'), h=28)
# 13 · 08 immobilier
opener('08', 'Modules Immobilier et Crowdfunding', 'Immobilier et<br>crowdfunding', 'Vos biens, leurs loyers et leurs crédits, puis vos projets de financement participatif.', 'immo.png',
  '<h3>Ajouter un bien</h3><p><span class="path">Placements › Immobilier › + Bien</span>, puis le régime : résidence principale, location nue ou LMNP.</p>'
  + figs([('Rendement net', 'Loyers encaissés moins toutes les charges, sur le coût de revient.'), ('Cash-flow', 'Le même, mensualité du crédit déduite.'), ('Plus-value', 'Valeur estimée moins le coût de revient.')])
  + '<div class="cols"><div><h3 class="first">Coût d\'acquisition</h3><p>Prix d\'achat, frais de notaire et travaux, saisis séparément : leur somme forme le coût de revient.</p></div><div><h3 class="first">Loyers et charges</h3><p>Loyer hors charges, vacance en mois par an, gestion, taxe foncière, assurance PNO, entretien, copropriété.</p></div></div>'
  + tip('Avant impôt', 'Rendement et cash-flow sont calculés avant impôt sur les revenus fonciers ou BIC.'), h=28)
# 14 · 08 suite crédits
cont('08', 'Immobilier et crowdfunding', 'bricks.png',
  '<h3>Crédits</h3><p><b>+ Crédit</b> : capital, taux nominal, durée, date de déblocage et assurance, puis rattachez-le à son bien. Vous obtenez la mensualité, le tableau d\'amortissement et le capital restant dû, déduit de votre patrimoine net.</p>'
  + tip('À vérifier', 'Le capital restant dû doit concorder avec le tableau de votre banque.')
  + '<h3>Valeur estimée</h3><p>Ajoutez une estimation datée à chaque nouvelle évaluation : les précédentes sont conservées, la plus récente compte.</p>'
  + '<h3>Crowdfunding</h3><p><span class="path">Placements › Crowdfunding</span> : capital placé, revenus mensuels nets, portefeuille de la plateforme et une fiche par projet avec sa progression.</p><p>Une pastille signale ce qui demande votre attention : versements à pointer, capital à récupérer.</p>', h=124)
# 15 · 08 suite projets
cont('08', 'Crowdfunding', 'bricks_detail.png',
  '<h3>L\'échéancier d\'un projet</h3><p>Touchez un projet : ses versements, du plus récent au plus ancien, avec le montant net de chacun.</p>'
  + '<h3>Versements automatiques</h3><p>Activez l\'option : chaque échéance d\'un projet « En cours » est comptée reçue à sa date et créditée sur le portefeuille. Un projet en retard reste à pointer ; <b>Tout pointer</b> règle tout en un geste.</p>'
  + '<h3>Un mois différent</h3><p>Touchez la ligne du mois pour saisir le montant reçu, ou « pas encore reçu ». Seul ce mois change.</p>'
  + figs([('Partiel', 'Le capital remboursé revient au portefeuille ; les intérêts sont recalculés.'), ('Total', 'Le projet passe en « Remboursé » ; les échéances suivantes disparaissent.')], 'two')
  + '<h3>Le portefeuille</h3><p>L\'argent non investi y reste, rémunéré au jour le jour. Les projets y sont payés, les versements y reviennent.</p>', h=124)
# 16 · 09 accueil
opener('09', 'Socle · Analyse · Achat-revente', 'Accueil, analyse<br>et sécurité', 'Votre patrimoine net, sa variation du jour et depuis le 1<sup>er</sup> janvier, en un coup d\'œil.', 'tableau.png',
  '<div style="height:26mm"></div>' + figs([('Disponible', 'Livrets et comptes, exprimés en mois de dépenses.'), ('Revenus passifs', 'Intérêts, crowdfunding et dividendes, par mois.'), ('Épargné', 'Ce mois-ci, face à votre moyenne.')])
  + '<div class="cols"><div><h3 class="first">Où est votre argent</h3><p>Vos actifs par classe, avec une barre de couleur ; touchez une ligne pour l\'ouvrir. <b>À surveiller</b> garde les trois alertes utiles, puis vos <b>objectifs</b>.</p></div>'
  + '<div><h3 class="first">L\'écran Analyse</h3><p>Gains de l\'année, évolution, répartition brute ou nette de crédits, performance, cash-flow et <b>récap fiscal</b>. L\'<b>Achat-revente</b> suit le même modèle.</p></div></div>', h=0)
# 17 · 09 suite chiffres
cont('09', 'Accueil, analyse et sécurité', 'cashflow.png',
  '<h3>Comprendre vos chiffres</h3>' + rows([('Valeur au 1<sup>er</sup> janvier', 'Reconstituée seule ; modifiable dans Réglages › Avancé.'), ('Épargne versée', 'Ce que vous avez mis de côté dans l\'année.'), ('Gain', 'Le reste de la variation de votre patrimoine.'), ('Reprise d\'existant', 'Un compte que vous aviez déjà : ni épargne, ni gain.'), ('Performance', 'Placements financiers seuls, après trois mois de recul.')])
  + '<h3>Plus-values crypto</h3><p>Calculées sur tout le portefeuille (formulaire 2086). Si vos ventes de l\'année ne dépassent pas 305 €, rien n\'est imposable.</p>'
  + '<h3>Cash-flow</h3><p>Revenus, dépenses courantes et montant épargné, mois par mois sur un an.</p>', h=124)
# 18 · 09 suite sécurité
cont('09', 'Accueil, analyse et sécurité', 'verrou.png',
  '<h3>Verrouiller l\'appli</h3>' + st([('Activer', '<span class="path">Réglages › Verrouillage</span> › Activer le verrouillage par code.'), ('Choisir un code', 'De 4 à 6 chiffres, à confirmer.'), ('Empreinte ou visage', 'Si votre appareil le permet.')])
  + '<p style="margin-top:2mm">Le code est demandé à l\'ouverture, puis plus jusqu\'à la fermeture de l\'appli. Après cinq erreurs, la saisie est bloquée 30 secondes.</p>'
  + '<h3 style="clear:both">Sauvegarder vos données</h3>' + figs([('Export', 'Réglages › Exporter mes données : un fichier à garder.'), ('Google Drive', 'Synchronisation dans un dossier privé de votre Drive.'), ('Automatique', 'Une copie avant chaque mise à jour, restaurable.')])
  + tip('Changer d\'appareil', 'Exportez sur l\'ancien, importez sur le nouveau, ou activez Google Drive sur les deux.')
  + '<p class="small">Le verrouillage protège l\'écran, il ne chiffre pas les données : protégez aussi votre téléphone par un code.</p>', h=120)
# 19 · 10 FAQ
QA = [('Où sont mes données ?', 'Uniquement sur votre appareil. Si vous activez la synchronisation, une copie va dans un dossier privé de votre Google Drive.'),
      ('Que quitte mon appareil ?', 'Seulement les symboles de vos actifs (« CW8 », « BTC/EUR ») envoyés aux services de cours. Aucun montant, aucune donnée personnelle.'),
      ('Les cours sont-ils en temps réel ?', 'Oui pour les cryptos, tant que l\'appli est ouverte. Actions et ETF : environ 15 minutes de différé.'),
      ('J\'ai oublié mon code', 'Touchez « Code oublié ? ». La seule issue est d\'effacer les données de l\'appli, puis de les restaurer depuis un export ou Google Drive.'),
      ('Plusieurs appareils ?', 'Oui. Chacun a ses données ; utilisez l\'export ou Google Drive pour les retrouver partout.'),
      ('Mon relevé est mal lu', 'Vérifiez qu\'il s\'agit d\'un CSV, puis corrigez les colonnes dans l\'écran d\'import. Pour un PDF, contrôlez le sens de chaque montant.'),
      ('Partager un appareil ?', 'Même appareil et même navigateur = mêmes données. Chacun doit avoir son appareil ou son profil de navigateur.'),
      ('Tout supprimer ?', 'Réglages › Réinitialiser, puis une base vide. Exportez d\'abord une sauvegarde si besoin.'),
      ('Téléphone perdu ?', 'Vos données se récupèrent depuis une sauvegarde exportée ou Google Drive. Sauvegardez régulièrement.')]
pages.append(('open', '<div class="band" style="height:80mm"></div><div class="n">10</div><h2 style="top:50mm">Questions<br>fréquentes</h2>'
  + '<div class="flow" style="top:94mm"><div class="qcols">' + ''.join(f'<div class="qa"><h4>{q}</h4><p>{a}</p></div>' for q, a in QA) + '</div></div>'))
# 20 · 11 informations
INFO = [('Un outil de suivi, pas de conseil', 'Invest.co organise vos finances personnelles. Ce n\'est ni un conseil en investissement, ni un conseil fiscal, juridique ou patrimonial, et aucun produit n\'est recommandé. Les performances passées ne préjugent pas des performances futures ; tout investissement comporte un risque de perte en capital.'),
        ('Des estimations fiscales', 'Montants nets d\'impôt et récap fiscal sont estimés d\'après les règles en vigueur et vos réglages. Ils ne remplacent pas votre déclaration : vérifiez sur impots.gouv.fr et consultez un professionnel en cas de doute.'),
        ('L\'exactitude des données', 'Les calculs reposent sur ce que vous saisissez ou importez. Les cours viennent de sources tierces, sans garantie. Taux et plafonds sont mis à jour avec l\'appli et consultables dans les Réglages.'),
        ('Confidentialité', 'Vos données restent sur votre appareil et ne sont pas collectées. Protégez l\'accès à votre téléphone et gardez vos exports en lieu sûr : ils contiennent toutes vos informations en clair.'),
        ('Marques', 'Bitstack, Google Drive, Chrome, Safari et les autres noms cités sont des marques de leurs propriétaires. Leur mention est informative et n\'implique aucun partenariat.')]
pages.append(('open', '<div class="band" style="height:80mm"></div><div class="n">11</div><h2 style="top:50mm">Informations<br>importantes</h2>'
  + '<div class="flow" style="top:94mm">' + ''.join(f'<h3>{a}</h3><p style="max-width:160mm">{b}</p>' for a, b in INFO)
  + '<p class="small" style="margin-top:8mm">Guide utilisateur Invest.co, édition {{EDITION}}, version {{VERSION}} de l\'appli. Les écrans présentés utilisent des données fictives.</p></div>'))

body = ''
for i, (kind, h) in enumerate(pages):
    f = '' if kind == 'cover' else foot(i + 1)
    body += f'<section class="page {kind}">\n  {h}\n  {f}\n</section>\n'
html = f'<!doctype html>\n<html lang="fr"><head><meta charset="utf-8"><title>Invest.co — Guide utilisateur</title>\n<style>{CSS}</style></head><body>\n{body}</body></html>\n'
open(OUT, 'w', encoding='utf-8').write(html)
print(len(pages), 'pages')
