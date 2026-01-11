/**
 * Database Seed Script
 * Migrates data from data.json to PostgreSQL
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface OldUserData {
  telegramId: number;
  username?: string;
  wallets: Array<{
    address: string;
    label?: string;
    addedAt: number;
    alertsEnabled?: boolean;
  }>;
}

async function main() {
  console.log('🌱 Starting database migration...');

  // Read old data.json
  const dataPath = path.join(__dirname, '..', 'data', 'data.json');
  
  if (!fs.existsSync(dataPath)) {
    console.log('⚠️  No data.json found. Skipping migration.');
    return;
  }

  const rawData = fs.readFileSync(dataPath, 'utf-8');
  const oldData: { users: Record<string, OldUserData> } = JSON.parse(rawData);

  console.log(`📊 Found ${Object.keys(oldData.users).length} users to migrate`);

  let migratedUsers = 0;
  let migratedWallets = 0;

  for (const [telegramIdStr, userData] of Object.entries(oldData.users)) {
    try {
      const telegramId = BigInt(telegramIdStr);

      // Create or update user
      const user = await prisma.user.upsert({
        where: { telegramId },
        create: {
          telegramId,
          username: userData.username,
        },
        update: {
          username: userData.username,
        },
      });

      console.log(`✅ Migrated user: ${userData.username || telegramId}`);
      migratedUsers++;

      // Migrate wallets
      for (const wallet of userData.wallets) {
        try {
          await prisma.wallet.upsert({
            where: {
              userId_address: {
                userId: user.id,
                address: wallet.address,
              },
            },
            create: {
              userId: user.id,
              address: wallet.address,
              label: wallet.label,
              addedAt: new Date(wallet.addedAt),
              alertsEnabled: wallet.alertsEnabled ?? true,
            },
            update: {
              label: wallet.label,
              alertsEnabled: wallet.alertsEnabled ?? true,
            },
          });

          console.log(`  ✅ Migrated wallet: ${wallet.label || wallet.address.slice(0, 8)}...`);
          migratedWallets++;
        } catch (error) {
          console.error(`  ❌ Failed to migrate wallet ${wallet.address}:`, error);
        }
      }
    } catch (error) {
      console.error(`❌ Failed to migrate user ${telegramIdStr}:`, error);
    }
  }

  console.log('\n🎉 Migration complete!');
  console.log(`✅ Migrated ${migratedUsers} users`);
  console.log(`✅ Migrated ${migratedWallets} wallets`);

  // Create backup of old data
  const backupPath = path.join(__dirname, '..', 'data', 'data.json.backup');
  fs.copyFileSync(dataPath, backupPath);
  console.log(`\n💾 Backup created at: ${backupPath}`);
}

main()
  .catch((e) => {
    console.error('❌ Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
