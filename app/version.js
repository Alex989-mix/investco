/* Version de l'appli Invest.co.
   C'est le SEUL endroit à modifier à chaque nouvelle version : le service worker (sw.js)
   et l'appli (index.html) lisent tous les deux ce fichier. Changer APP_VERSION suffit
   pour que chaque appareil détecte la mise à jour et propose de l'installer. */
self.APP_VERSION = '17.0';
self.APP_RELEASE = {
  date: '2026-10-22',
  notes: [
    'Immobilier : ajoute tes biens (valeur estimée datée, loyers, charges) et tes crédits (mensualité, tableau d\'amortissement, capital restant dû). Le tableau de bord affiche ton patrimoine net, crédits déduits.',
    'Budget : tableau prévu / réel par catégorie, avec le mois précédent et la moyenne des 3 derniers mois. Les dépenses qui reviennent chaque mois sont repérées et peuvent devenir des récurrentes en un clic.',
    'Import de relevé : tes règles de catégories (mot-clé → catégorie) passent en premier, et les opérations déjà importées sont ignorées.',
    'Objectifs d\'épargne : plusieurs objectifs, avec échéance, comptes suivis et effort mensuel nécessaire.',
    'Alertes : plafonds des livrets et du PEA, budgets dépassés, versements Bricks, objectifs en retard, seuils de déclaration des plateformes de vente.',
    'Achat-revente : plateforme, frais de plateforme et d\'envoi, marge brute et nette, durée de vente, stock immobilisé. Régime fiscal au choix : ventes occasionnelles (non imposables) ou activité d\'achat-revente (micro-BIC).',
    'Fiscalité : indique ta tranche d\'imposition (TMI) une fois ; les taux (PFU 31,4 %, prélèvements sociaux 18,6 % ou 17,2 % selon le produit) viennent de paramètres réglementaires datés, consultables et complétables dans Réglages.',
    'Fiabilité : les montants sont désormais enregistrés en centimes, sans erreur d\'arrondi.'
  ]
};
