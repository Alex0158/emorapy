/**
 * Phase 1 資料遷移腳本：UserProfile → ProfileInsight 種子資料
 *
 * 將現有 UserProfile 中的自我報告欄位轉換為 ProfileInsight 記錄，
 * 確保老用戶在升級後不需從零開始。
 *
 * 使用方式：npx ts-node scripts/seed-profile-insights.ts
 * 冪等：重複執行不會產生重複資料（依 user_id + key 去重）
 */

import { PrismaClient, PsychDomain, InsightType } from '@prisma/client';

const prisma = new PrismaClient();

const SEED_CONFIDENCE = 0.65;
const SEED_SOURCE = 'user_profile_migration';

interface SeedInsight {
  domain: PsychDomain;
  insight_type: InsightType;
  key: string;
  value: string;
}

function buildSeeds(profile: any): SeedInsight[] {
  const seeds: SeedInsight[] = [];

  if (profile.mbti_type) {
    seeds.push({
      domain: PsychDomain.personality,
      insight_type: InsightType.trait,
      key: 'MBTI 類型',
      value: profile.mbti_type,
    });
  }

  if (profile.communication_style) {
    seeds.push({
      domain: PsychDomain.personality,
      insight_type: InsightType.trait,
      key: '溝通風格',
      value: profile.communication_style,
    });
  }

  if (profile.religion) {
    const level = profile.religious_practice_level ? `（${profile.religious_practice_level}）` : '';
    seeds.push({
      domain: PsychDomain.belief_values,
      insight_type: InsightType.cultural,
      key: '宗教信仰',
      value: `${profile.religion}${level}`,
    });
  }

  if (profile.family_structure) {
    seeds.push({
      domain: PsychDomain.family_origin,
      insight_type: InsightType.pattern,
      key: '家庭結構',
      value: profile.family_structure,
    });
  }

  if (profile.parents_relationship) {
    seeds.push({
      domain: PsychDomain.family_origin,
      insight_type: InsightType.pattern,
      key: '父母關係',
      value: profile.parents_relationship,
    });
  }

  if (profile.upbringing_environment) {
    seeds.push({
      domain: PsychDomain.family_origin,
      insight_type: InsightType.developmental,
      key: '成長環境',
      value: profile.upbringing_environment,
    });
  }

  if (profile.ethnicity) {
    seeds.push({
      domain: PsychDomain.cultural_background,
      insight_type: InsightType.cultural,
      key: '民族背景',
      value: profile.ethnicity,
    });
  }

  if (profile.cultural_identity?.length > 0) {
    seeds.push({
      domain: PsychDomain.cultural_background,
      insight_type: InsightType.cultural,
      key: '文化認同',
      value: profile.cultural_identity.join('、'),
    });
  }

  if (profile.education_level) {
    const major = profile.major_field ? `，主修 ${profile.major_field}` : '';
    seeds.push({
      domain: PsychDomain.education_cognition,
      insight_type: InsightType.trait,
      key: '教育背景',
      value: `${profile.education_level}${major}`,
    });
  }

  if (profile.occupation) {
    seeds.push({
      domain: PsychDomain.education_cognition,
      insight_type: InsightType.trait,
      key: '職業',
      value: profile.occupation,
    });
  }

  if (profile.core_values?.length > 0) {
    for (const val of profile.core_values.slice(0, 5)) {
      seeds.push({
        domain: PsychDomain.belief_values,
        insight_type: InsightType.belief,
        key: '核心價值',
        value: val,
      });
    }
  }

  return seeds;
}

async function main() {
  console.log('=== UserProfile → ProfileInsight 種子遷移 ===\n');

  const profiles = await prisma.userProfile.findMany();
  console.log(`找到 ${profiles.length} 個 UserProfile 記錄\n`);

  let created = 0;
  let skipped = 0;

  for (const profile of profiles) {
    const seeds = buildSeeds(profile);
    if (seeds.length === 0) {
      console.log(`  [跳過] user ${profile.user_id}: 無可遷移欄位`);
      continue;
    }

    for (const seed of seeds) {
      const existing = await prisma.profileInsight.findFirst({
        where: {
          user_id: profile.user_id,
          key: seed.key,
          value: seed.value,
          is_active: true,
        },
      });

      if (existing) {
        skipped++;
        continue;
      }

      await prisma.profileInsight.create({
        data: {
          user_id: profile.user_id,
          domain: seed.domain,
          insight_type: seed.insight_type,
          key: seed.key,
          value: seed.value,
          confidence: SEED_CONFIDENCE,
          evidence: SEED_SOURCE,
          is_active: true,
        },
      });
      created++;
    }

    console.log(`  [完成] user ${profile.user_id}: ${seeds.length} 個種子，新建 ${seeds.length - skipped}，跳過 ${skipped}`);
    skipped = 0;
  }

  console.log(`\n=== 遷移完成：新建 ${created} 個 ProfileInsight ===`);
}

main()
  .catch((e) => {
    console.error('遷移失敗:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
