import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Clean existing records in reverse dependency order
  await prisma.monthlySummaryLog.deleteMany();
  await prisma.expenseSplit.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.friendship.deleteMany();
  await prisma.groupMember.deleteMany();
  await prisma.group.deleteMany();
  await prisma.telegramConnectToken.deleteMany();
  await prisma.passwordReset.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await argon2.hash('Password@123', {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4
  });

  // 1. Create Users (Using foreign names per UX requirement)
  const liam = await prisma.user.create({
    data: {
      name: 'Liam Vance',
      email: 'liam@example.com',
      passwordHash,
      telegramChatId: '12345678',
      telegramUsername: 'liam_vance',
      telegramConnected: true
    }
  });

  const lucas = await prisma.user.create({
    data: {
      name: 'Lucas Bennett',
      email: 'lucas@example.com',
      passwordHash,
      telegramChatId: '87654321',
      telegramUsername: 'lucas_b',
      telegramConnected: true
    }
  });

  const noah = await prisma.user.create({
    data: {
      name: 'Noah Miller',
      email: 'noah@example.com',
      passwordHash,
      telegramConnected: false
    }
  });

  console.log(`✓ Created 3 users: ${liam.name}, ${lucas.name}, ${noah.name}`);

  // Create Friendships
  await prisma.friendship.createMany({
    data: [
      { requesterId: liam.id, receiverId: lucas.id, status: 'ACCEPTED' },
      { requesterId: liam.id, receiverId: noah.id, status: 'ACCEPTED' },
      { requesterId: lucas.id, receiverId: noah.id, status: 'ACCEPTED' }
    ]
  });
  console.log('✓ Created friendships between Liam, Lucas, and Noah');

  // 2. Create Group with human-friendly invite code GOA-7K4P2X
  const group = await prisma.group.create({
    data: {
      name: 'Goa Trip',
      inviteCode: 'GOA-7K4P2X',
      createdBy: liam.id,
      members: {
        create: [
          { userId: liam.id },
          { userId: lucas.id },
          { userId: noah.id }
        ]
      }
    }
  });

  console.log(`✓ Created group: ${group.name} with 3 members`);

  // 3. Create Expenses matching prompt example:
  // Liam pays ₹2,400 for Dinner (split equally ₹800 each)
  //   Liam paid: 2400, share: 800 -> Net +1600
  //   Lucas paid: 0, share: 800 -> Net -800
  //   Noah paid: 0, share: 800 -> Net -800
  //
  // Lucas pays ₹600 for Cab (split equally ₹200 each)
  //   Lucas paid: 600, share: 200 -> Net +400 (Combined: -800 + 400 = -400)
  //   Liam paid: 0, share: 200 -> Net -200 (Combined: +1600 - 200 = +1400)
  //   Noah paid: 0, share: 200 -> Net -200 (Combined: -800 - 200 = -1000)
  //
  // Liam pays ₹600 for Groceries (Exact split: Lucas owes 500, Noah owes 100, Liam owes 0)
  //   Liam paid: 600, share: 0 -> Net +600 (Combined: +1400 + 600 = +2000)
  //   Lucas paid: 0, share: 500 -> Net -500 (Combined: -400 - 500 = -900)
  //   Noah paid: 0, share: 100 -> Net -100 (Combined: -1000 - 100 = -1100)
  //
  // Noah pays ₹1,000 for Snacks (Percentage split: Lucas 30% [300], Liam 50% [500], Noah 20% [200])
  //   Noah paid: 1000, share: 200 -> Net +800 (Combined: -1100 + 800 = -300)
  //   Lucas paid: 0, share: 300 -> Net -300 (Combined: -900 - 300 = -1200)
  //   Liam paid: 0, share: 500 -> Net -500 (Combined: +2000 - 500 = +1500)
  //
  // RESULTING NET BALANCES:
  // Liam:  +1500 (₹1,500.00 in minor units = 150000)
  // Lucas: -1200 (₹1,200.00 in minor units = -120000)
  // Noah:  -300  (₹300.00 in minor units   = -30000)
  // SETTLEMENTS:
  // Lucas -> Liam ₹1,200
  // Noah  -> Liam ₹300

  // Expense 1: Dinner (Equal split: ₹2,400 = 240000 minor units)
  await prisma.expense.create({
    data: {
      groupId: group.id,
      description: 'Dinner at Beachside Bistro',
      totalAmount: 240000,
      splitType: 'EQUAL',
      paidBy: liam.id,
      createdBy: liam.id,
      expenseDate: new Date('2026-10-01T20:30:00Z'),
      splits: {
        create: [
          { userId: liam.id, amountOwed: 80000 },
          { userId: lucas.id, amountOwed: 80000 },
          { userId: noah.id, amountOwed: 80000 }
        ]
      }
    }
  });

  // Expense 2: Cab (Equal split: ₹600 = 60000 minor units)
  await prisma.expense.create({
    data: {
      groupId: group.id,
      description: 'Airport Cab',
      totalAmount: 60000,
      splitType: 'EQUAL',
      paidBy: lucas.id,
      createdBy: lucas.id,
      expenseDate: new Date('2026-10-02T10:15:00Z'),
      splits: {
        create: [
          { userId: liam.id, amountOwed: 20000 },
          { userId: lucas.id, amountOwed: 20000 },
          { userId: noah.id, amountOwed: 20000 }
        ]
      }
    }
  });

  // Expense 3: Groceries (Exact split: ₹600 = 60000 minor units)
  await prisma.expense.create({
    data: {
      groupId: group.id,
      description: 'Supermarket Supplies',
      totalAmount: 60000,
      splitType: 'EXACT',
      paidBy: liam.id,
      createdBy: liam.id,
      expenseDate: new Date('2026-10-02T14:00:00Z'),
      splits: {
        create: [
          { userId: lucas.id, amountOwed: 50000 },
          { userId: noah.id, amountOwed: 10000 }
        ]
      }
    }
  });

  // Expense 4: Snacks (Percentage split: ₹1,000 = 100000 minor units)
  await prisma.expense.create({
    data: {
      groupId: group.id,
      description: 'Evening Snacks & Coffee',
      totalAmount: 100000,
      splitType: 'PERCENTAGE',
      paidBy: noah.id,
      createdBy: noah.id,
      expenseDate: new Date('2026-10-02T17:45:00Z'),
      splits: {
        create: [
          { userId: liam.id, amountOwed: 50000 },  // 50%
          { userId: lucas.id, amountOwed: 30000 }, // 30%
          { userId: noah.id, amountOwed: 20000 }   // 20%
        ]
      }
    }
  });

  // Expense 5: Direct 1-to-1 Expense (No group: Coffee with Lucas, ₹240 = 24000 minor units)
  await prisma.expense.create({
    data: {
      groupId: null,
      description: 'Artisan Coffee',
      totalAmount: 24000,
      splitType: 'EQUAL',
      paidBy: liam.id,
      createdBy: liam.id,
      expenseDate: new Date('2026-10-02T19:00:00Z'),
      splits: {
        create: [
          { userId: liam.id, amountOwed: 12000 },
          { userId: lucas.id, amountOwed: 12000 }
        ]
      }
    }
  });

  console.log('✓ Created 4 group expenses + 1 direct 1-to-1 friend expense');
  console.log('✨ Seed complete! Default password for all users: Password@123');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
