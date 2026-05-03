import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { DEFAULT_ROLE_PERMISSIONS } from '../src/utils/admin-permissions';
import { assertSeedAllowed } from '../src/utils/seed-guard';

assertSeedAllowed();

const prisma = new PrismaClient();

const SALT_ROUNDS = 10;

const TEST_ACCOUNTS = [
  {
    email: 'boyfriend@test.com',
    password: 'Test1234',
    nickname: '測試男友',
    gender: 'male' as const,
    age: 28,
    relationship_status: 'dating' as const,
  },
  {
    email: 'girlfriend@test.com',
    password: 'Test1234',
    nickname: '測試女友',
    gender: 'female' as const,
    age: 26,
    relationship_status: 'dating' as const,
  },
];

async function main() {
  console.log('🐻 開始建立測試帳號...\n');

  await prisma.adminRole.upsert({
    where: { key: 'super_admin' },
    create: {
      key: 'super_admin',
      name: 'Super Admin',
      description: '全域管理權限',
      permissions: DEFAULT_ROLE_PERMISSIONS.super_admin as unknown as object,
    },
    update: {},
  });
  await prisma.adminRole.upsert({
    where: { key: 'ops' },
    create: {
      key: 'ops',
      name: 'Ops',
      description: '運維管理權限',
      permissions: DEFAULT_ROLE_PERMISSIONS.ops as unknown as object,
    },
    update: {},
  });
  await prisma.adminRole.upsert({
    where: { key: 'marketing' },
    create: {
      key: 'marketing',
      name: 'Marketing',
      description: '行銷分析權限',
      permissions: DEFAULT_ROLE_PERMISSIONS.marketing as unknown as object,
    },
    update: {},
  });
  await prisma.adminRole.upsert({
    where: { key: 'support' },
    create: {
      key: 'support',
      name: 'Support',
      description: '客服管理權限',
      permissions: DEFAULT_ROLE_PERMISSIONS.support as unknown as object,
    },
    update: {},
  });

  if (process.env.ADMIN_SEED_EMAIL && process.env.ADMIN_SEED_PASSWORD) {
    const role = await prisma.adminRole.findUnique({ where: { key: 'super_admin' } });
    if (role) {
      const existingAdmin = await prisma.adminUser.findUnique({
        where: { email: process.env.ADMIN_SEED_EMAIL.toLowerCase() },
      });
      if (!existingAdmin) {
        const adminPasswordHash = await bcrypt.hash(process.env.ADMIN_SEED_PASSWORD, SALT_ROUNDS);
        await prisma.adminUser.create({
          data: {
            email: process.env.ADMIN_SEED_EMAIL.toLowerCase(),
            password_hash: adminPasswordHash,
            name: process.env.ADMIN_SEED_NAME || 'System Admin',
            role_id: role.id,
          },
        });
        console.log(`✅ 建立管理員帳號: ${process.env.ADMIN_SEED_EMAIL}`);
      }
    }
  }

  if (process.env.LIMITED_ADMIN_SEED_EMAIL && process.env.LIMITED_ADMIN_SEED_PASSWORD) {
    const rawLimitedRoleKey = process.env.LIMITED_ADMIN_SEED_ROLE || 'support';
    const allowedRoleKeys = ['super_admin', 'ops', 'marketing', 'support'] as const;
    if (!allowedRoleKeys.includes(rawLimitedRoleKey as (typeof allowedRoleKeys)[number])) {
      throw new Error(`LIMITED_ADMIN_SEED_ROLE 不合法: ${rawLimitedRoleKey}`);
    }
    const limitedRoleKey = rawLimitedRoleKey as (typeof allowedRoleKeys)[number];
    const role = await prisma.adminRole.findUnique({ where: { key: limitedRoleKey } });
    if (!role) {
      throw new Error(`找不到 LIMITED_ADMIN_SEED_ROLE 對應角色: ${limitedRoleKey}`);
    }
    const limitedEmail = process.env.LIMITED_ADMIN_SEED_EMAIL.toLowerCase();
    const existingAdmin = await prisma.adminUser.findUnique({
      where: { email: limitedEmail },
    });
    if (!existingAdmin) {
      const limitedPasswordHash = await bcrypt.hash(process.env.LIMITED_ADMIN_SEED_PASSWORD, SALT_ROUNDS);
      await prisma.adminUser.create({
        data: {
          email: limitedEmail,
          password_hash: limitedPasswordHash,
          name: process.env.LIMITED_ADMIN_SEED_NAME || 'Limited Admin',
          role_id: role.id,
        },
      });
      console.log(`✅ 建立低權限管理員帳號: ${limitedEmail} (${limitedRoleKey})`);
    }
  }

  for (const account of TEST_ACCOUNTS) {
    const existing = await prisma.user.findUnique({
      where: { email: account.email },
    });

    if (existing) {
      console.log(`⏭️  帳號已存在，跳過: ${account.email}`);
      continue;
    }

    const passwordHash = await bcrypt.hash(account.password, SALT_ROUNDS);

    const user = await prisma.user.create({
      data: {
        email: account.email,
        password_hash: passwordHash,
        nickname: account.nickname,
        gender: account.gender,
        age: account.age,
        relationship_status: account.relationship_status,
        email_verified: true,
        is_active: true,
        language: 'zh',
      },
    });

    console.log(`✅ 建立成功: ${account.nickname} (${account.email})`);
    console.log(`   ID: ${user.id}`);
  }

  console.log('\n========================================');
  console.log('  測試帳號資訊');
  console.log('========================================');
  console.log('  男朋友帳號:');
  console.log('    Email:    boyfriend@test.com');
  console.log('    密碼:     Test1234');
  console.log('');
  console.log('  女朋友帳號:');
  console.log('    Email:    girlfriend@test.com');
  console.log('    密碼:     Test1234');
  console.log('========================================');
  console.log('');
  console.log('配對流程:');
  console.log('  1. 用男友帳號登入 → 建立配對 → 取得邀請碼');
  console.log('  2. 用女友帳號登入 → 輸入邀請碼加入配對');
  console.log('========================================\n');
}

async function seedContent() {
  console.log('\n🐻 開始建立內容資料...\n');

  const tips = [
    {
      title: '衝突時的「暫停鍵」技巧',
      content: '當你感覺自己快要說出傷害性的話時，試試「5-4-3-2-1」法則：找到5個看得到的東西、4個摸得到的、3個聽得到的、2個聞得到的、1個嚐得到的。這能幫助你的神經系統從「戰鬥模式」回到「安全模式」。',
      content_type: 'tip' as const,
      tags: ['溝通', '情緒管理', '衝突處理'],
      language: 'zh' as const,
    },
    {
      title: '「我訊息」的力量',
      content: '把「你總是遲到」換成「當你遲到的時候，我會覺得自己不被重視，我希望我們能一起找到準時的方法」。「我訊息」描述的是你的感受和需求，不會讓對方感覺被攻擊。',
      content_type: 'tip' as const,
      tags: ['溝通', 'NVC', '表達技巧'],
      language: 'zh' as const,
    },
    {
      title: '每日感恩練習',
      content: '每天睡前，花一分鐘想一件今天對方做的讓你感到溫暖的事。不需要是什麼大事——也許只是一杯水、一個眼神、或是幫你關了燈。然後把這件事告訴對方。Gottman 的研究顯示，這種小小的肯定能顯著改善關係品質。',
      content_type: 'tip' as const,
      tags: ['習慣養成', 'Gottman', '正向回饋'],
      language: 'zh' as const,
    },
    {
      title: '修復嘗試：吵架時的安全網',
      content: '「修復嘗試」是 Gottman 研究中預測關係幸福的最強指標之一。它可以是一個幽默的表情、一句「我覺得我們又卡住了」、或是伸出手牽對方。關鍵不在於形式，而在於——你願意在衝突中伸出橄欖枝。',
      content_type: 'tip' as const,
      tags: ['Gottman', '衝突修復', '關係維護'],
      language: 'zh' as const,
    },
    {
      title: '理解不同的「愛的語言」',
      content: 'Gary Chapman 提出五種「愛的語言」：肯定的言語、精心的時刻、接受禮物、服務的行動、身體的接觸。當你覺得「我已經這麼努力了，對方怎麼還感受不到」時，也許不是你付出不夠，而是你們使用了不同的語言。試著學習對方的語言。',
      content_type: 'tip' as const,
      tags: ['愛的語言', '理解差異', '關係成長'],
      language: 'zh' as const,
    },
    {
      title: '面對衝突的勇氣',
      content: '很多人害怕衝突，選擇忍耐和迴避。但心理學家指出：健康的關係不是沒有衝突，而是有能力處理衝突。當你願意坐下來說「我們來聊聊」，你就已經在為這段關係做最重要的事。',
      content_type: 'tip' as const,
      tags: ['衝突處理', '勇氣', '關係健康'],
      language: 'zh' as const,
    },
    {
      title: '華人文化中的「含蓄」不等於「不在乎」',
      content: '在華人文化中，很多人用行動而非語言表達愛——默默做家事、加班賺錢、早起為你買早餐。如果你的伴侶不太會說甜言蜜語，試著去看見那些「沒說出口的在乎」。同時，如果你是那個用行動說話的人，偶爾用語言把那份在乎「翻譯」出來，會讓對方更容易接收到。',
      content_type: 'tip' as const,
      tags: ['文化理解', '溝通', '愛的表達'],
      language: 'zh' as const,
    },
    {
      title: '「翻舊帳」背後的真正訊號',
      content: '當一個人反覆提起過去的事，通常不是因為記仇，而是因為那個傷還沒有被真正處理過。就像身體的傷口——如果沒有清潔和包紮，只是蓋上衣服假裝沒事，碰到的時候還是會痛。下次對方「翻舊帳」時，試著問自己：「那個還沒癒合的傷是什麼？」',
      content_type: 'tip' as const,
      tags: ['情緒理解', '舊帳', '傷口處理'],
      language: 'zh' as const,
    },
    {
      title: 'The Power of "Pause"',
      content: 'When you feel a heated argument building, try the 5-4-3-2-1 grounding technique: name 5 things you can see, 4 you can touch, 3 you can hear, 2 you can smell, and 1 you can taste. This helps your nervous system shift from "fight mode" back to "safe mode".',
      content_type: 'tip' as const,
      tags: ['communication', 'emotional regulation', 'conflict'],
      language: 'en' as const,
    },
    {
      title: 'Use "I" Statements',
      content: 'Replace "You always come home late" with "When you come home late, I feel unimportant, and I need us to figure out a way to manage our time better together." "I" statements focus on your feelings and needs without making the other person feel attacked.',
      content_type: 'tip' as const,
      tags: ['communication', 'NVC', 'expression'],
      language: 'en' as const,
    },
  ];

  for (const tip of tips) {
    const existing = await prisma.contentItem.findFirst({
      where: { title: tip.title },
    });
    if (existing) {
      console.log(`⏭️  內容已存在，跳過: ${tip.title}`);
      continue;
    }
    await prisma.contentItem.create({ data: tip });
    console.log(`✅ 建立成功: ${tip.title}`);
  }

  console.log(`\n✅ 內容資料建立完成（共 ${tips.length} 筆）`);
}

main()
  .then(() => seedContent())
  .catch((e) => {
    console.error('❌ Seed 失敗:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
