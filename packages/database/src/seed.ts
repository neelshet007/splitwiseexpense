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

  // 1. Create Users
  const neel = await prisma.user.create({
    data: {
      name: 'Neel Sharma',
      email: 'neel@example.com',
      passwordHash,
      telegramChatId: '12345678',
      telegramUsername: 'neel_sharma',
      telegramConnected: true
    }
  });

  const rahul = await prisma.user.create({
    data: {
      name: 'Rahul Verma',
      email: 'rahul@example.com',
      passwordHash,
      telegramChatId: '87654321',
      telegramUsername: 'rahul_v',
      telegramConnected: true
    }
  });

  const aman = await prisma.user.create({
    data: {
      name: 'Aman Gupta',
      email: 'aman@example.com',
      passwordHash,
      telegramConnected: false
    }
  });

  console.log(`✓ Created 3 users: ${neel.name}, ${rahul.name}, ${aman.name}`);

  // Create Friendships
  await prisma.friendship.createMany({
    data: [
      { requesterId: neel.id, receiverId: rahul.id, status: 'ACCEPTED' },
      { requesterId: neel.id, receiverId: aman.id, status: 'ACCEPTED' },
      { requesterId: rahul.id, receiverId: aman.id, status: 'ACCEPTED' }
    ]
  });
  console.log('✓ Created friendships between Neel, Rahul, and Aman');

  // 2. Create Group
  const group = await prisma.group.create({
    data: {
      name: 'Mumbai Friends',
      inviteCode: 'MUM-7K4P2X',
      createdBy: neel.id,
      members: {
        create: [
          { userId: neel.id },
          { userId: rahul.id },
          { userId: aman.id }
        ]
      }
    }
  });

  console.log(`✓ Created group: ${group.name} with 3 members`);

  // 3. Create Expenses matching prompt example:
  // Neel pays ₹2,400 for Dinner (split equally ₹800 each)
  //   Neel paid: 2400, share: 800 -> Net +1600
  //   Rahul paid: 0, share: 800 -> Net -800
  //   Aman paid: 0, share: 800 -> Net -800
  //
  // Rahul pays ₹600 for Cab (split equally ₹200 each)
  //   Rahul paid: 600, share: 200 -> Net +400 (Combined: -800 + 400 = -400)
  //   Neel paid: 0, share: 200 -> Net -200 (Combined: +1600 - 200 = +1400)
  //   Aman paid: 0, share: 200 -> Net -200 (Combined: -800 - 200 = -1000)
  //
  // Neel pays ₹600 for Groceries (Exact split: Rahul owes 500, Aman owes 100, Neel owes 0)
  //   Neel paid: 600, share: 0 -> Net +600 (Combined: +1400 + 600 = +2000)
  //   Rahul paid: 0, share: 500 -> Net -500 (Combined: -400 - 500 = -900)
  //   Aman paid: 0, share: 100 -> Net -100 (Combined: -1000 - 100 = -1100)
  //
  // Aman pays ₹1,000 for Snacks (Percentage split: Rahul 30% [300], Neel 50% [500], Aman 20% [200])
  //   Aman paid: 1000, share: 200 -> Net +800 (Combined: -1100 + 800 = -300)
  //   Rahul paid: 0, share: 300 -> Net -300 (Combined: -900 - 300 = -1200)
  //   Neel paid: 0, share: 500 -> Net -500 (Combined: +2000 - 500 = +1500)
  //
  // RESULTING NET BALANCES:
  // Neel:  +1500 (₹1,500.00 in minor units = 150000)
  // Rahul: -1200 (₹1,200.00 in minor units = -120000)
  // Aman:  -300  (₹300.00 in minor units   = -30000)
  // SETTLEMENTS:
  // Rahul -> Neel ₹1,200
  // Aman  -> Neel ₹300

  // Expense 1: Dinner (Equal split: ₹2,400 = 240000 minor units)
  await prisma.expense.create({
    data: {
      groupId: group.id,
      description: 'Dinner at Bastian',
      totalAmount: 240000,
      splitType: 'EQUAL',
      paidBy: neel.id,
      createdBy: neel.id,
      expenseDate: new Date('2026-10-01T20:30:00Z'),
      splits: {
        create: [
          { userId: neel.id, amountOwed: 80000 },
          { userId: rahul.id, amountOwed: 80000 },
          { userId: aman.id, amountOwed: 80000 }
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
      paidBy: rahul.id,
      createdBy: rahul.id,
      expenseDate: new Date('2026-10-02T10:15:00Z'),
      splits: {
        create: [
          { userId: neel.id, amountOwed: 20000 },
          { userId: rahul.id, amountOwed: 20000 },
          { userId: aman.id, amountOwed: 20000 }
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
      paidBy: neel.id,
      createdBy: neel.id,
      expenseDate: new Date('2026-10-02T14:00:00Z'),
      splits: {
        create: [
          { userId: rahul.id, amountOwed: 50000 },
          { userId: aman.id, amountOwed: 10000 }
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
      paidBy: aman.id,
      createdBy: aman.id,
      expenseDate: new Date('2026-10-02T17:45:00Z'),
      splits: {
        create: [
          { userId: neel.id, amountOwed: 50000 },  // 50%
          { userId: rahul.id, amountOwed: 30000 }, // 30%
          { userId: aman.id, amountOwed: 20000 }   // 20%
        ]
      }
    }
  });

  // Expense 5: Direct 1-to-1 Expense (No group: Coffee with Rahul, ₹240 = 24000 minor units)
  await prisma.expense.create({
    data: {
      groupId: null,
      description: 'Third Wave Coffee',
      totalAmount: 24000,
      splitType: 'EQUAL',
      paidBy: neel.id,
      createdBy: neel.id,
      expenseDate: new Date('2026-10-02T19:00:00Z'),
      splits: {
        create: [
          { userId: neel.id, amountOwed: 12000 },
          { userId: rahul.id, amountOwed: 12000 }
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
