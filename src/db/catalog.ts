/**
 * Catalogue de démarrage WadAcces.
 *
 * Données réelles d'une boutique grossiste d'accessoires téléphoniques
 * (marques et gammes de prix du marché ouest-africain, en FCFA).
 * Chargé via Paramètres → « Charger le catalogue WadAcces ».
 */

export interface CatalogProduct {
  name: string;
  category: string;
  brand: string;
  model?: string;
  compatibility?: string;
  purchasePrice: number;
  retailPrice: number;
  wholesalePrice: number;
  stock: number;
  minStock: number;
  location?: string;
  supplier?: string;
}

export const CATALOG_SUPPLIERS = [
  {
    name: "Ets Diallo Import",
    company: "Ets Diallo Import & Distribution",
    phone: "+221 77 512 40 18",
    address: "Marché Sandaga, Dakar",
    notes: "Écrans, batteries et pièces détachées. Livraison sous 48h.",
  },
  {
    name: "Oraimo Distribution",
    company: "Oraimo West Africa",
    phone: "+221 78 306 22 90",
    address: "Zone industrielle, Dakar",
    notes: "Distributeur officiel Oraimo : chargeurs, powerbanks, écouteurs.",
  },
  {
    name: "China Phone Parts",
    company: "Guangzhou Phone Parts Co.",
    phone: "+86 138 2620 7744",
    address: "Guangzhou, Chine",
    notes: "Import conteneur : coques, vitres, câbles. Délai 30 jours.",
  },
  {
    name: "Sonatel Accessoires",
    company: "Sonatel Business",
    phone: "+221 33 839 90 00",
    address: "Avenue Cheikh Anta Diop, Dakar",
    notes: "Accessoires certifiés et supports auto.",
  },
];

export const CATALOG_CUSTOMERS = [
  {
    name: "Boutique Keur Massar",
    phone: "+221 77 245 31 70",
    company: "Keur Massar Mobile",
    address: "Keur Massar, Dakar",
    type: "wholesale",
    notes: "Client grossiste régulier, achats hebdomadaires.",
  },
  {
    name: "Mamadou Ba",
    phone: "+221 76 918 44 02",
    company: "Ba Télécom",
    address: "Thiès",
    type: "wholesale",
    notes: "Revendeur Thiès, paiement Mobile Money.",
  },
  {
    name: "Fatou Ndiaye",
    phone: "+221 70 655 12 38",
    address: "Pikine, Dakar",
    type: "retail",
    notes: "Cliente fidèle au détail.",
  },
  {
    name: "Atelier Réparation Colobane",
    phone: "+221 77 401 65 23",
    company: "Colobane Fix",
    address: "Colobane, Dakar",
    type: "wholesale",
    notes: "Achète écrans et batteries en gros.",
  },
];

export const CATALOG_PRODUCTS: CatalogProduct[] = [
  // Écrans
  { name: "Écran iPhone 13 (OLED)", category: "Écrans", brand: "Apple", model: "iPhone 13", compatibility: "iPhone 13, iPhone 13 Pro", purchasePrice: 25000, retailPrice: 35000, wholesalePrice: 32000, stock: 15, minStock: 5, location: "Vitrine A1", supplier: "Ets Diallo Import" },
  { name: "Écran iPhone 12 (Incell)", category: "Écrans", brand: "Apple", model: "iPhone 12", compatibility: "iPhone 12, iPhone 12 Pro", purchasePrice: 18000, retailPrice: 27000, wholesalePrice: 24000, stock: 12, minStock: 4, location: "Vitrine A1", supplier: "Ets Diallo Import" },
  { name: "Écran iPhone 11", category: "Écrans", brand: "Apple", model: "iPhone 11", compatibility: "iPhone 11", purchasePrice: 14000, retailPrice: 22000, wholesalePrice: 19500, stock: 18, minStock: 5, location: "Vitrine A1", supplier: "Ets Diallo Import" },
  { name: "Écran Samsung A12", category: "Écrans", brand: "Samsung", model: "Galaxy A12", compatibility: "Galaxy A12, A02s", purchasePrice: 11000, retailPrice: 18000, wholesalePrice: 15500, stock: 20, minStock: 6, location: "Vitrine A2", supplier: "Ets Diallo Import" },
  { name: "Écran Samsung A32", category: "Écrans", brand: "Samsung", model: "Galaxy A32", compatibility: "Galaxy A32 4G", purchasePrice: 16000, retailPrice: 25000, wholesalePrice: 22000, stock: 9, minStock: 4, location: "Vitrine A2", supplier: "Ets Diallo Import" },
  { name: "Écran Tecno Spark 10", category: "Écrans", brand: "Tecno", model: "Spark 10", compatibility: "Spark 10, Spark 10C", purchasePrice: 9000, retailPrice: 15000, wholesalePrice: 13000, stock: 22, minStock: 6, location: "Vitrine A3", supplier: "China Phone Parts" },
  { name: "Écran Infinix Hot 12", category: "Écrans", brand: "Infinix", model: "Hot 12", compatibility: "Hot 12, Hot 12i", purchasePrice: 8500, retailPrice: 14000, wholesalePrice: 12000, stock: 16, minStock: 5, location: "Vitrine A3", supplier: "China Phone Parts" },
  { name: "Écran Itel A56", category: "Écrans", brand: "Itel", model: "A56", compatibility: "Itel A56, A56 Pro", purchasePrice: 6000, retailPrice: 10000, wholesalePrice: 8500, stock: 25, minStock: 8, location: "Vitrine A3", supplier: "China Phone Parts" },

  // Chargeurs
  { name: "Chargeur Samsung 25W Type-C", category: "Chargeurs", brand: "Samsung", model: "EP-TA800", compatibility: "Samsung Galaxy S/A Series", purchasePrice: 3500, retailPrice: 6000, wholesalePrice: 5000, stock: 60, minStock: 15, location: "Rayon B1", supplier: "Sonatel Accessoires" },
  { name: "Chargeur iPhone 20W USB-C", category: "Chargeurs", brand: "Apple", model: "A2305", compatibility: "iPhone 8 à iPhone 15", purchasePrice: 4000, retailPrice: 7000, wholesalePrice: 6000, stock: 45, minStock: 12, location: "Rayon B1", supplier: "Sonatel Accessoires" },
  { name: "Chargeur Oraimo 18W Charge Rapide", category: "Chargeurs", brand: "Oraimo", model: "OCW-E63D", compatibility: "Universel Android", purchasePrice: 2500, retailPrice: 4500, wholesalePrice: 3800, stock: 80, minStock: 20, location: "Rayon B1", supplier: "Oraimo Distribution" },
  { name: "Chargeur secteur double USB 2.4A", category: "Chargeurs", brand: "Remax", model: "RP-U31", compatibility: "Universel", purchasePrice: 1500, retailPrice: 3000, wholesalePrice: 2400, stock: 100, minStock: 25, location: "Rayon B2", supplier: "China Phone Parts" },
  { name: "Chargeur voiture 3.1A double port", category: "Chargeurs", brand: "Baseus", model: "CCALL-YD01", compatibility: "Universel", purchasePrice: 2000, retailPrice: 4000, wholesalePrice: 3200, stock: 40, minStock: 10, location: "Rayon B2", supplier: "China Phone Parts" },

  // Câbles
  { name: "Câble Type-C 1m tressé", category: "Câbles", brand: "Oraimo", model: "OCD-C53", compatibility: "Android USB-C", purchasePrice: 1000, retailPrice: 2500, wholesalePrice: 1800, stock: 150, minStock: 30, location: "Rayon C1", supplier: "Oraimo Distribution" },
  { name: "Câble Lightning 1m", category: "Câbles", brand: "Apple", model: "MXLY2", compatibility: "iPhone 5 à 14", purchasePrice: 1200, retailPrice: 3000, wholesalePrice: 2200, stock: 120, minStock: 30, location: "Rayon C1", supplier: "Sonatel Accessoires" },
  { name: "Câble Micro-USB 1m", category: "Câbles", brand: "Remax", model: "RC-134m", compatibility: "Android Micro-USB", purchasePrice: 700, retailPrice: 1500, wholesalePrice: 1100, stock: 200, minStock: 40, location: "Rayon C1", supplier: "China Phone Parts" },
  { name: "Câble Type-C vers Type-C 60W", category: "Câbles", brand: "Baseus", model: "CATWJ-01", compatibility: "Charge rapide PD", purchasePrice: 1800, retailPrice: 4000, wholesalePrice: 3200, stock: 70, minStock: 15, location: "Rayon C2", supplier: "China Phone Parts" },

  // Écouteurs
  { name: "Écouteurs Oraimo FreePods 3", category: "Écouteurs", brand: "Oraimo", model: "OEB-E104D", compatibility: "Bluetooth universel", purchasePrice: 9000, retailPrice: 15000, wholesalePrice: 13000, stock: 35, minStock: 8, location: "Vitrine D1", supplier: "Oraimo Distribution" },
  { name: "Écouteurs filaires 3.5mm", category: "Écouteurs", brand: "Remax", model: "RM-512", compatibility: "Jack 3.5mm universel", purchasePrice: 800, retailPrice: 2000, wholesalePrice: 1500, stock: 180, minStock: 40, location: "Rayon D2", supplier: "China Phone Parts" },
  { name: "Écouteurs Type-C Samsung", category: "Écouteurs", brand: "Samsung", model: "EO-IC100", compatibility: "Samsung USB-C", purchasePrice: 2500, retailPrice: 5000, wholesalePrice: 4000, stock: 50, minStock: 12, location: "Rayon D2", supplier: "Sonatel Accessoires" },
  { name: "Casque Bluetooth JBL Tune 510", category: "Écouteurs", brand: "JBL", model: "Tune 510BT", compatibility: "Bluetooth universel", purchasePrice: 18000, retailPrice: 28000, wholesalePrice: 25000, stock: 12, minStock: 3, location: "Vitrine D1", supplier: "Sonatel Accessoires" },

  // Powerbanks
  { name: "Powerbank Oraimo 10000mAh", category: "Powerbanks", brand: "Oraimo", model: "OPB-P104D", compatibility: "Universel", purchasePrice: 7000, retailPrice: 12000, wholesalePrice: 10000, stock: 40, minStock: 10, location: "Vitrine E1", supplier: "Oraimo Distribution" },
  { name: "Powerbank Oraimo 20000mAh", category: "Powerbanks", brand: "Oraimo", model: "OPB-P205D", compatibility: "Universel charge rapide", purchasePrice: 12000, retailPrice: 20000, wholesalePrice: 17500, stock: 25, minStock: 6, location: "Vitrine E1", supplier: "Oraimo Distribution" },
  { name: "Powerbank solaire 20000mAh", category: "Powerbanks", brand: "Remax", model: "RPP-96", compatibility: "Universel", purchasePrice: 9000, retailPrice: 16000, wholesalePrice: 14000, stock: 18, minStock: 5, location: "Vitrine E1", supplier: "China Phone Parts" },

  // Batteries
  { name: "Batterie iPhone 11", category: "Batteries", brand: "Apple", model: "iPhone 11", compatibility: "iPhone 11", purchasePrice: 6000, retailPrice: 11000, wholesalePrice: 9500, stock: 22, minStock: 6, location: "Tiroir F1", supplier: "Ets Diallo Import" },
  { name: "Batterie Samsung A10/A20", category: "Batteries", brand: "Samsung", model: "EB-BA750ABU", compatibility: "Galaxy A10, A20, A30", purchasePrice: 4000, retailPrice: 8000, wholesalePrice: 6800, stock: 30, minStock: 8, location: "Tiroir F1", supplier: "Ets Diallo Import" },
  { name: "Batterie Tecno BL-49BT", category: "Batteries", brand: "Tecno", model: "BL-49BT", compatibility: "Tecno Spark séries", purchasePrice: 3000, retailPrice: 6000, wholesalePrice: 5000, stock: 35, minStock: 10, location: "Tiroir F2", supplier: "China Phone Parts" },

  // Coques
  { name: "Coque silicone iPhone 13", category: "Coques", brand: "Générique", model: "iPhone 13", compatibility: "iPhone 13", purchasePrice: 700, retailPrice: 2000, wholesalePrice: 1400, stock: 150, minStock: 30, location: "Rayon G1", supplier: "China Phone Parts" },
  { name: "Coque antichoc Samsung A54", category: "Coques", brand: "Générique", model: "Galaxy A54", compatibility: "Galaxy A54 5G", purchasePrice: 900, retailPrice: 2500, wholesalePrice: 1800, stock: 90, minStock: 20, location: "Rayon G1", supplier: "China Phone Parts" },
  { name: "Coque transparente Tecno Spark 10", category: "Coques", brand: "Générique", model: "Spark 10", compatibility: "Tecno Spark 10", purchasePrice: 500, retailPrice: 1500, wholesalePrice: 1000, stock: 120, minStock: 30, location: "Rayon G2", supplier: "China Phone Parts" },
  { name: "Coque Infinix Hot 30", category: "Coques", brand: "Générique", model: "Hot 30", compatibility: "Infinix Hot 30", purchasePrice: 500, retailPrice: 1500, wholesalePrice: 1000, stock: 110, minStock: 30, location: "Rayon G2", supplier: "China Phone Parts" },

  // Vitres / incassables
  { name: "Vitre incassable iPhone 13/14", category: "Vitres / incassables", brand: "Générique", model: "iPhone 13/14", compatibility: "iPhone 13, 13 Pro, 14", purchasePrice: 400, retailPrice: 1500, wholesalePrice: 1000, stock: 250, minStock: 50, location: "Comptoir H1", supplier: "China Phone Parts" },
  { name: "Vitre incassable Samsung A14", category: "Vitres / incassables", brand: "Générique", model: "Galaxy A14", compatibility: "Galaxy A14", purchasePrice: 350, retailPrice: 1200, wholesalePrice: 800, stock: 220, minStock: 50, location: "Comptoir H1", supplier: "China Phone Parts" },
  { name: "Vitre incassable universelle 6.5\"", category: "Vitres / incassables", brand: "Générique", compatibility: "Écrans 6.5 pouces", purchasePrice: 250, retailPrice: 1000, wholesalePrice: 650, stock: 300, minStock: 60, location: "Comptoir H2", supplier: "China Phone Parts" },

  // Pochettes
  { name: "Pochette étanche smartphone", category: "Pochettes", brand: "Générique", compatibility: "Jusqu'à 7 pouces", purchasePrice: 800, retailPrice: 2500, wholesalePrice: 1800, stock: 60, minStock: 15, location: "Rayon I1", supplier: "China Phone Parts" },
  { name: "Pochette ceinture cuir", category: "Pochettes", brand: "Générique", compatibility: "Universel 6 pouces", purchasePrice: 1200, retailPrice: 3000, wholesalePrice: 2300, stock: 45, minStock: 12, location: "Rayon I1", supplier: "China Phone Parts" },

  // Adaptateurs
  { name: "Adaptateur OTG Type-C vers USB", category: "Adaptateurs", brand: "Baseus", model: "CAHUB-AP", compatibility: "Android USB-C", purchasePrice: 800, retailPrice: 2000, wholesalePrice: 1500, stock: 70, minStock: 15, location: "Rayon J1", supplier: "China Phone Parts" },
  { name: "Adaptateur Lightning vers Jack 3.5", category: "Adaptateurs", brand: "Apple", compatibility: "iPhone 7 et plus", purchasePrice: 1500, retailPrice: 3500, wholesalePrice: 2800, stock: 40, minStock: 10, location: "Rayon J1", supplier: "Sonatel Accessoires" },

  // Supports
  { name: "Support voiture magnétique", category: "Supports", brand: "Baseus", model: "SUER-A01", compatibility: "Universel", purchasePrice: 1800, retailPrice: 4000, wholesalePrice: 3200, stock: 50, minStock: 12, location: "Rayon K1", supplier: "Sonatel Accessoires" },
  { name: "Trépied téléphone 1m + télécommande", category: "Supports", brand: "Générique", compatibility: "Universel", purchasePrice: 3500, retailPrice: 7000, wholesalePrice: 5800, stock: 20, minStock: 5, location: "Rayon K1", supplier: "China Phone Parts" },

  // Bluetooth
  { name: "Enceinte Bluetooth Oraimo SoundGo", category: "Bluetooth", brand: "Oraimo", model: "OBS-33D", compatibility: "Bluetooth 5.0", purchasePrice: 8000, retailPrice: 14000, wholesalePrice: 12000, stock: 22, minStock: 6, location: "Vitrine L1", supplier: "Oraimo Distribution" },
  { name: "Montre connectée Oraimo Watch 2", category: "Bluetooth", brand: "Oraimo", model: "OSW-16", compatibility: "Android / iOS", purchasePrice: 11000, retailPrice: 19000, wholesalePrice: 16500, stock: 15, minStock: 4, location: "Vitrine L1", supplier: "Oraimo Distribution" },

  // Autres accessoires
  { name: "Carte mémoire 32Go classe 10", category: "Autres accessoires", brand: "SanDisk", model: "SDSQUNR-032G", compatibility: "Universel microSD", purchasePrice: 2500, retailPrice: 5000, wholesalePrice: 4200, stock: 55, minStock: 15, location: "Comptoir M1", supplier: "Sonatel Accessoires" },
  { name: "Carte mémoire 64Go classe 10", category: "Autres accessoires", brand: "SanDisk", model: "SDSQUAB-064G", compatibility: "Universel microSD", purchasePrice: 4000, retailPrice: 8000, wholesalePrice: 6800, stock: 40, minStock: 10, location: "Comptoir M1", supplier: "Sonatel Accessoires" },
  { name: "Stylet capacitif", category: "Autres accessoires", brand: "Générique", compatibility: "Écrans tactiles", purchasePrice: 400, retailPrice: 1200, wholesalePrice: 800, stock: 80, minStock: 20, location: "Comptoir M2", supplier: "China Phone Parts" },
];
