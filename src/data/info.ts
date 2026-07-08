// Starter content for the public "Rules & Trails" info page. Seeded once (see
// prisma/seed.ts); thereafter the InfoSection table is fully editable by the
// admin from the Rules & Trails tab.
export type DefaultInfoSection = {
  titleEn: string;
  titleHe: string;
  bodyEn: string;
  bodyHe: string;
  sortOrder: number;
};

export const DEFAULT_INFO_SECTIONS: DefaultInfoSection[] = [
  {
    sortOrder: 1,
    titleEn: 'General Information',
    titleHe: 'מידע כללי',
    bodyEn:
      'The Gal-On Triathlon is a community event for all ages and levels. Gathering opens one hour before the first heat. Please arrive early to check in, collect your number, and warm up.',
    bodyHe:
      'טריאתלון גל-און הוא אירוע קהילתי לכל הגילאים והרמות. ההתכנסות נפתחת שעה לפני המקצה הראשון. אנא הגיעו מוקדם לרישום, קבלת מספר וחימום.',
  },
  {
    sortOrder: 2,
    titleEn: 'Competition Rules',
    titleHe: 'תקנון התחרות',
    bodyEn:
      'Helmets are mandatory on the bike leg. Follow marshals’ instructions at all times. Relay teams hand over at the transition zone only. Unsporting conduct or leaving the marked course may lead to disqualification.',
    bodyHe:
      'חובה לחבוש קסדה במקטע הרכיבה. יש לציית להוראות השופטים בכל עת. קבוצות שליחים מבצעות חילוף באזור המעבר בלבד. התנהגות לא ספורטיבית או יציאה מהמסלול המסומן עלולות להוביל לפסילה.',
  },
  {
    sortOrder: 3,
    titleEn: 'Trails & Course Map',
    titleHe: 'מסלולים ומפת התחרות',
    bodyEn:
      'Swim in the community pool, bike along the marked ring road, and run the trail loop back to the finish. A course map will be posted here before the event.',
    bodyHe:
      'שחייה בבריכה הקהילתית, רכיבה לאורך כביש הטבעת המסומן, וריצה בלולאת השביל בחזרה לקו הסיום. מפת מסלול תפורסם כאן לפני האירוע.',
  },
];
