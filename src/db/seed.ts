import { db } from "@/db";
import { users, categories, storeSettings } from "@/db/schema";
import { hashPassword } from "@/lib/auth";
import { eq, count } from "drizzle-orm";

const DEFAULT_CATEGORIES = [
  "Écrans",
  "Chargeurs",
  "Câbles",
  "Écouteurs",
  "Powerbanks",
  "Batteries",
  "Coques",
  "Pochettes",
  "Vitres / incassables",
  "Adaptateurs",
  "Supports",
  "Bluetooth",
  "Autres accessoires",
];

let categoriesSeeded = false;

export async function initializeDatabase(): Promise<void> {
  const settingsCount = await db.select({ c: count() }).from(storeSettings);
  if (Number(settingsCount[0].c) === 0) {
    await db.insert(storeSettings).values({
      storeName: "WadAcces",
      currency: "FCFA",
      lowStockThreshold: 5,
      enableVoiceFeedback: true,
    });
  } else {
    const [current] = await db.select().from(storeSettings).limit(1);
    if (current && (current.storeName === "Ma Boutique" || current.storeName === "Grossiste")) {
      await db
        .update(storeSettings)
        .set({ storeName: "WadAcces", updatedAt: new Date() })
        .where(eq(storeSettings.id, current.id));
    }
  }

  // Comptes par défaut : créés UNIQUEMENT à la première installation.
  // Ainsi, un compte retiré par l'administrateur n'est jamais recréé.
  const [{ c: userCount }] = await db.select({ c: count() }).from(users);
  if (Number(userCount) === 0) {
    const adminHash = await hashPassword("admin");
    const vendorPin = await hashPassword("1234");
    const managerPin = await hashPassword("5678");
    await db.insert(users).values([
      {
        username: "admin",
        fullName: "Administrateur",
        passwordHash: adminHash,
        role: "admin",
        active: true,
        permissions: [],
      },
      {
        username: "vendeur",
        fullName: "Vendeur",
        passwordHash: vendorPin,
        pinCode: vendorPin,
        role: "vendor",
        active: true,
        permissions: [],
      },
      {
        username: "gestionnaire",
        fullName: "Gestionnaire",
        passwordHash: managerPin,
        pinCode: managerPin,
        role: "manager",
        active: true,
        permissions: [],
      },
    ]);
  }

  // Catégories de départ : uniquement si aucune catégorie n'existe encore.
  // Une catégorie retirée par l'administrateur ne réapparaît donc jamais.
  if (!categoriesSeeded) {
    const [{ c: categoryCount }] = await db.select({ c: count() }).from(categories);
    if (Number(categoryCount) === 0) {
      await db.insert(categories).values(DEFAULT_CATEGORIES.map((name) => ({ name })));
    }
    categoriesSeeded = true;
  }
}
